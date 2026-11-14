//Runs a game: the phases of each round, the LLM calls, and saving every change.
//Everything the UI shows comes from the states here, everything the player does goes through the methods here.
import { ActionSource, Phase, type Call, type Game, type Round } from "#game";
import { id_random } from "#lib/ids";
import { llm_chat, llm_json, type LlmMessage, type LlmReply } from "#lib/llm";
import { COWRITER, ROLES, Roles, SERVER_KEY, SERVER_URL } from "#options";
import {
  prompt_character,
  prompt_scribes,
  prompt_storyteller,
  schema_scribes,
  schema_storyteller,
  type BuilderReply,
  type ScribesReply,
  type StorytellerReply,
} from "#prompts";
import { schema_check, type Schema } from "#lib/schema";
import { later } from "#lib/later";
import { store_game, store_put, store_put_call, store_put_game, store_put_round, store_rounds } from "#store";
import {
  Controller,
  world_apply,
  world_chunks_ids,
  world_empty,
  type Change,
  type Character,
  type Chunk,
  type Id,
  type World,
  type WorldApplied,
} from "#world";
import { err, ok, type Result } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";

/**An LLM call that is running, with what it has written so far*/
export interface Running {
  role: Roles;
  character?: Id;
  text: string;
  reasoning: string;
}

/**Characters taking part in a round: the living player characters and the AI characters where they are*/
function cast_of(world: World): Id[] {
  const living = Object.values(world.characters).filter((c) => !c.gone);
  const players = living.filter((c) => c.controller === Controller.Player);
  const places = new Set(players.map((c) => c.location));
  return [...players, ...living.filter((c) => c.controller === Controller.Ai && places.has(c.location))].map((c) => c.id);
}

const new_round = (game: Game): Round => ({
  game: game.id,
  n: game.round,
  phase: Phase.Characters,
  cast: cast_of(game.world),
  actions: {},
  story: [],
  changes: [],
});

/**Some models put their thinking in the reply text instead of a separate field*/
const without_thinking = (text: string) => text.replace(/^\s*<think>[\s\S]*?<\/think>\s*/, "");

class Engine {
  readonly #game = state.ros(ok<Game | undefined>(undefined));
  readonly #rounds = state.ros(ok<Round[]>([]));
  readonly #running = state.ros(ok<{ [key: string]: Running }>({}));
  /**The loaded game, undefined when none is*/
  readonly game = this.#game.read_only;
  /**All rounds of the loaded game, the last is the current round*/
  readonly rounds = this.#rounds.read_only;
  /**LLM calls running now, by key*/
  readonly running = this.#running.read_only;

  #calls = new Map<string, AbortController>();
  /**Raised when another game is loaded, so replies for the old one are dropped*/
  #generation = 0;

  get #g(): Game | undefined {
    return this.#game.ok();
  }
  get #round(): Round | undefined {
    return this.#rounds.ok().at(-1);
  }

  /**Loads a stored game and continues where it was*/
  async load(id: string): Promise<Result<void, string>> {
    this.close();
    const game = await store_game(id);
    if (game.err) return game;
    if (!game.value) return err("The game does not exist");
    const rounds = await store_rounds(id);
    if (rounds.err) return rounds;
    this.#rounds.set_ok(rounds.value.sort((a, b) => a.n - b.n));
    this.#game.set_ok(game.value);
    this.#step();
    return ok(undefined);
  }

  /**Makes a game from what the game builder proposed, and loads it
   * @returns the id of the new game*/
  async create(proposal: BuilderReply, premise: string): Promise<Result<string, string>> {
    const applied = world_apply(world_empty(), proposal.changes);
    const problems = applied.problems.filter((p) => p !== undefined);
    if (problems.length) return err("The world has problems: " + problems.join("; "));
    const now = Date.now();
    const game: Game = { id: id_random(), name: proposal.name || "Untitled", premise, created: now, updated: now, world: applied.world, round: 1 };
    //The opening is the story of round 0, so the first round starts after it
    const opening: Round = {
      game: game.id,
      n: 0,
      phase: Phase.Done,
      cast: cast_of(game.world),
      actions: {},
      story: world_chunks_ids(proposal.opening, applied.ids),
      changes: [],
    };
    const saved = await store_put(game, opening, new_round(game));
    if (saved.err) return saved;
    const loaded = await this.load(game.id);
    return loaded.err ? loaded : ok(game.id);
  }

  /**Stops the loaded game, running calls are cancelled*/
  close() {
    this.#generation++;
    for (const controller of this.#calls.values()) controller.abort();
    this.#calls.clear();
    this.#running.set_ok({});
    this.#game.set_ok(undefined);
    this.#rounds.set_ok([]);
  }

  //      _____  _           __     ________ _____
  //     |  __ \| |        /\\ \   / /  ____|  __ \
  //     | |__) | |       /  \\ \_/ /| |__  | |__) |
  //     |  ___/| |      / /\ \\   / |  __| |  _  /
  //     | |    | |____ / ____ \| |  | |____| | \ \
  //     |_|    |______/_/    \_\_|  |______|_|  \_\

  /**A player character's action for the round, can be changed until the storyteller starts*/
  submit(character: Id, text: string) {
    const r = this.#round;
    const c = this.#g?.world.characters[character];
    if (!r || !c || r.phase !== Phase.Characters || !r.cast.includes(character)) return;
    this.#update_round((r) => (r.actions[character] = { text, source: c.controller === Controller.Player ? ActionSource.Player : ActionSource.Edited }));
  }

  /**Replaces what an AI character decided, the call deciding it is cancelled*/
  set_action(character: Id, text: string) {
    const r = this.#round;
    if (!r || r.phase !== Phase.Characters || !r.cast.includes(character)) return;
    this.#cancel("char:" + character);
    this.#update_round((r) => (r.actions[character] = { text, source: ActionSource.Edited }), true);
  }

  /**Lets an AI character decide again*/
  redecide(character: Id) {
    const r = this.#round;
    if (!r || r.phase !== Phase.Characters) return;
    this.#cancel("char:" + character);
    this.#update_round((r) => delete r.actions[character]);
  }

  /**Replaces the story of the round, while it is reviewed*/
  edit_story(story: Chunk[]) {
    if (this.#round?.phase !== Phase.StoryReview) return;
    this.#update_round((r) => (r.story = story), true);
  }

  /**Replaces the changes of the round, while they are reviewed*/
  edit_changes(changes: Change[]) {
    const g = this.#g;
    if (!g || this.#round?.phase !== Phase.ChangesReview) return;
    this.#update_round((r) => {
      r.changes = changes;
      r.problems = world_apply(g.world, changes).problems;
    }, true);
  }

  /**Changes the world by hand, from the editors, all changes are applied or none
   * @returns the applied world, with the real ids of anything added*/
  edit_world(changes: Change[]): Result<WorldApplied, string> {
    const g = this.#g;
    if (!g) return err("No game is loaded");
    const applied = world_apply(g.world, changes);
    const problems = applied.problems.filter((p) => p !== undefined);
    if (problems.length) return err(problems.join("; "));
    const game: Game = { ...g, world: applied.world, updated: Date.now() };
    this.#game.set_ok(game);
    store_put_game(game);
    return ok(applied);
  }

  /**Goes on from a review*/
  next() {
    const r = this.#round;
    if (r?.phase === Phase.StoryReview) this.#update_round((r) => (r.phase = Phase.Scribes));
    else if (r?.phase === Phase.ChangesReview) this.#finish(r.changes);
  }

  /**Runs the storyteller or scribes again, from their review*/
  redo() {
    const r = this.#round;
    if (r?.phase === Phase.StoryReview)
      this.#update_round((r) => {
        r.phase = Phase.Storyteller;
        r.story = [];
      });
    else if (r?.phase === Phase.ChangesReview)
      this.#update_round((r) => {
        r.phase = Phase.Scribes;
        r.changes = [];
        r.problems = undefined;
      });
  }

  /**Continues after a failed call*/
  retry() {
    if (this.#round?.error) this.#update_round((r) => (r.error = undefined));
  }

  //      _____  _    _ _   _ _   _ _____ _   _  _____
  //     |  __ \| |  | | \ | | \ | |_   _| \ | |/ ____|
  //     | |__) | |  | |  \| |  \| | | | |  \| | |  __
  //     |  _  /| |  | | . ` | . ` | | | | . ` | | |_ |
  //     | | \ \| |__| | |\  | |\  |_| |_| |\  | |__| |
  //     |_|  \_\\____/|_| \_|_| \_|_____|_| \_|\_____|

  /**Changes the current round, saves it and goes on with whatever the round needs next
   * @param save_later saves after a pause, for text being typed*/
  #update_round(change: (round: Round) => void, save_later = false) {
    const rounds = this.#rounds.ok();
    const old = rounds.at(-1);
    if (!old) return;
    const round = structuredClone(old);
    change(round);
    this.#rounds.set_ok([...rounds.slice(0, -1), round]);
    if (save_later) later(`round/${round.game}/${round.n}`, () => store_put_round(this.#round_by(round.game, round.n) ?? round));
    else store_put_round(round);
    this.#step();
  }

  #round_by(game: string, n: number) {
    return this.#g?.id === game ? this.#rounds.ok().find((r) => r.n === n) : undefined;
  }

  /**Applies the changes, ends the round and starts the next*/
  #finish(changes: Change[]) {
    const g = this.#g;
    const r = this.#round;
    if (!g || !r) return;
    const applied = world_apply(g.world, changes);
    const done: Round = { ...structuredClone(r), changes, problems: applied.problems, phase: Phase.Done };
    const game: Game = { ...g, world: applied.world, round: r.n + 1, updated: Date.now() };
    const next = new_round(game);
    this.#game.set_ok(game);
    this.#rounds.set_ok([...this.#rounds.ok().slice(0, -1), done, next]);
    store_put(game, done, next);
    this.#step();
  }

  /**Starts what the current round needs next*/
  #step() {
    const g = this.#g;
    const r = this.#round;
    if (!g || !r || r.error) return;
    switch (r.phase) {
      case Phase.Characters: {
        for (const id of r.cast) {
          const c = g.world.characters[id];
          if (c?.controller === Controller.Ai && !r.actions[id] && !this.#calls.has("char:" + id)) this.#decide(c);
        }
        if (r.cast.every((id) => r.actions[id])) this.#update_round((r) => (r.phase = Phase.Storyteller));
        return;
      }
      case Phase.Storyteller:
        if (!this.#calls.has("storyteller")) this.#tell();
        return;
      case Phase.Scribes:
        if (!this.#calls.has("scribes")) this.#scribe();
        return;
    }
  }

  async #decide(character: Character) {
    const g = this.#g!;
    const r = this.#round!;
    const last = this.#rounds.ok().find((x) => x.n === r.n - 1);
    const reply = await this.#call("char:" + character.id, Roles.Character, prompt_character(g.world, r, character, last), undefined, character.id);
    if (reply.err) return;
    const text = without_thinking(reply.value.text).trim();
    if (this.#round?.phase === Phase.Characters && !this.#round.actions[character.id])
      this.#update_round((r) => (r.actions[character.id] = { text, source: ActionSource.Ai }));
  }

  async #tell() {
    const g = this.#g!;
    const r = this.#round!;
    const earlier = this.#rounds.ok().filter((x) => x.n < r.n);
    const reply = await this.#call("storyteller", Roles.Storyteller, prompt_storyteller(g.world, r, earlier), {
      name: "story",
      schema: schema_storyteller(r),
    });
    if (reply.err) return;
    const story = parse<StorytellerReply>(reply.value, schema_storyteller(r));
    if (story.err) return this.#update_round((r) => (r.error = "The storyteller's reply did not fit: " + story.error));
    if (this.#round?.phase !== Phase.Storyteller) return;
    this.#update_round((r) => {
      r.story = story.value.story.filter((c) => c.text.trim());
      r.phase = COWRITER.ok() ? Phase.StoryReview : Phase.Scribes;
    });
  }

  async #scribe() {
    const g = this.#g!;
    const r = this.#round!;
    const schema = schema_scribes(g.world);
    const reply = await this.#call("scribes", Roles.Scribes, prompt_scribes(g.world, r), { name: "changes", schema });
    if (reply.err) return;
    const changes = parse<ScribesReply>(reply.value, schema);
    if (changes.err) return this.#update_round((r) => (r.error = "The scribes' reply did not fit: " + changes.error));
    if (this.#round?.phase !== Phase.Scribes) return;
    if (COWRITER.ok())
      this.#update_round((r) => {
        r.changes = changes.value.changes;
        r.problems = world_apply(g.world, r.changes).problems;
        r.phase = Phase.ChangesReview;
      });
    else this.#finish(changes.value.changes);
  }

  #cancel(key: string) {
    this.#calls.get(key)?.abort();
    this.#calls.delete(key);
    const running = { ...this.#running.ok() };
    delete running[key];
    this.#running.set_ok(running);
  }

  /**Runs an LLM call, shows it as running, and stores it for debugging.
   * A failure stops the round until it is retried, a cancelled call gives an error and does nothing else.*/
  async #call(
    key: string,
    role: Roles,
    messages: LlmMessage[],
    schema?: { name: string; schema: Schema },
    character?: Id,
  ): Promise<Result<LlmReply, string>> {
    const generation = this.#generation;
    const g = this.#g!;
    const round = this.#round!.n;
    const controller = new AbortController();
    this.#calls.set(key, controller);
    const show = (text: string, reasoning: string) => {
      if (this.#calls.get(key) === controller) this.#running.set_ok({ ...this.#running.ok(), [key]: { role, character, text, reasoning } });
    };
    show("", "");
    const started = Date.now();
    const model = ROLES[role].model.ok();
    const reply = await llm_chat(
      { url: SERVER_URL.ok(), key: SERVER_KEY.ok() },
      { model, messages, schema, thinking: ROLES[role].thinking.ok(), signal: controller.signal, on_text: show },
    );
    const call: Call = {
      id: id_random(),
      game: g.id,
      round,
      role,
      character,
      model,
      messages,
      reply: reply.ok ? reply.value.text : "",
      reasoning: reply.ok ? reply.value.reasoning : "",
      error: reply.err ? reply.error : undefined,
      started,
      ms: Date.now() - started,
      prompt_tokens: reply.ok ? reply.value.prompt_tokens : undefined,
      reply_tokens: reply.ok ? reply.value.reply_tokens : undefined,
    };
    store_put_call(call);
    if (generation !== this.#generation || this.#calls.get(key) !== controller) return err("cancelled");
    this.#cancel(key);
    if (reply.err && reply.error !== "cancelled")
      this.#update_round((r) => (r.error = `${role === Roles.Character ? (g.world.characters[character!]?.name ?? "A character") : role}: ${reply.error}`));
    return reply;
  }
}

function parse<T>(reply: LlmReply, schema: Schema): Result<T, string> {
  const json = llm_json(without_thinking(reply.text));
  return json.err ? json : schema_check<T>(schema, json.value);
}

export const ENGINE = new Engine();
