//Runs a game: the phases of each round, the LLM calls, and saving every change.
//Everything the UI shows comes from the states here, everything the player does goes through the methods here.
//Every game object is its own state, a change sets only the states of what changed and saves only those records,
//see State and storage model in DESIGN.md.
import { ActionSource, Phase, type Call, type Game, type MemoryRecord, type Round } from "#game";
import { Collection } from "#lib/collection";
import { id_random } from "#lib/ids";
import { later } from "#lib/later";
import { llm_chat, llm_json, type LlmMessage, type LlmReply } from "#lib/llm";
import { schema_check, type Schema } from "#lib/schema";
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
import { store_load, store_put_call, store_put_round, store_write, type GameWrite } from "#store";
import {
  Controller,
  world_apply,
  world_characters,
  world_chunks_ids,
  world_empty,
  type Change,
  type Character,
  type Chunk,
  type Id,
  type Location,
  type WorldApplied,
  type WorldRead,
} from "#world";
import { err, ok, type Result } from "@chocbite/ts-lib/result";
import state, { type StateLocalROS, type StateROS } from "@chocbite/ts-lib/state";

/**An LLM call that is running, with what it has written so far*/
export interface Running {
  role: Roles;
  character?: Id;
  text: string;
  reasoning: string;
}

/**Characters taking part in a round: the living player characters and the AI characters where they are*/
function cast_of(world: WorldRead): Id[] {
  const living = world_characters(world);
  const players = living.filter((c) => c.controller === Controller.Player);
  const places = new Set(players.map((c) => c.location));
  return [...players, ...living.filter((c) => c.controller === Controller.Ai && places.has(c.location))].map((c) => c.id);
}

const new_round = (game: string, n: number, world: WorldRead): Round => ({
  game,
  n,
  phase: Phase.Characters,
  cast: cast_of(world),
  actions: {},
  story: [],
  changes: [],
});

/**Some models put their thinking in the reply text instead of a separate field*/
const without_thinking = (text: string) => text.replace(/^\s*<think>[\s\S]*?<\/think>\s*/, "");

/**Strips the game id stored with world records*/
const without_game = <T extends { game: string }>({ game: _game, ...rest }: T) => rest;

class Engine {
  readonly #game = state.ros(ok<Game | undefined>(undefined));
  readonly #characters = new Collection<Character>();
  readonly #locations = new Collection<Location>();
  /**Memories of each character, an array state that is only pushed to*/
  readonly #memories = new Map<Id, StateLocalROS<string[]>>();
  readonly #round = state.ros(ok<Round | undefined>(undefined));
  readonly #history = state.ros(ok<Round[]>([]));
  readonly #running = state.ros(ok<{ [key: string]: Running }>({}));

  /**Details of the loaded game, undefined when none is*/
  readonly game = this.#game.read_only;
  /**Characters of the loaded game, removed ones too, each a state that stays the same object*/
  readonly characters = this.#characters.list;
  /**Locations of the loaded game, removed ones too, each a state that stays the same object*/
  readonly locations = this.#locations.list;
  /**The current round*/
  readonly round = this.#round.read_only;
  /**Finished rounds in order, only ever added to*/
  readonly history = this.#history.read_only;
  /**LLM calls running now, by key*/
  readonly running = this.#running.read_only;

  /**The world of the loaded game, read from the states without copying*/
  readonly world: WorldRead = ((game, characters, locations, memories) => ({
    get time() {
      return game.ok()?.time ?? "";
    },
    character: (id: Id) => characters.value(id),
    location: (id: Id) => locations.value(id),
    characters: () => characters.values(),
    locations: () => locations.values(),
    memories: (id: Id) => memories.get(id)?.ok() ?? [],
  }))(this.#game, this.#characters, this.#locations, this.#memories);

  /**State of a character*/
  character(id: Id): StateROS<Character> | undefined {
    return this.#characters.get(id);
  }
  /**State of a location*/
  location(id: Id): StateROS<Location> | undefined {
    return this.#locations.get(id);
  }

  #calls = new Map<string, AbortController>();
  /**Raised when another game is loaded, so replies and saves for the old one are dropped*/
  #generation = 0;
  /**Changes to the world run one after another, each one on the result of the one before*/
  #queue: Promise<unknown> = Promise.resolve();

  get #g(): Game | undefined {
    return this.#game.ok();
  }
  get #r(): Round | undefined {
    return this.#round.ok();
  }

  //      _      ____          _____
  //     | |    / __ \   /\   |  __ \
  //     | |   | |  | | /  \  | |  | |
  //     | |   | |  | |/ /\ \ | |  | |
  //     | |___| |__| / ____ \| |__| |
  //     |______\____/_/    \_\_____/

  /**Loads a stored game and continues where it was*/
  async load(id: string): Promise<Result<void, string>> {
    this.close();
    const generation = this.#generation;
    const records = await store_load(id);
    if (records.err) return records;
    if (generation !== this.#generation) return err("Another game was loaded");
    const { game, characters, locations, memories, rounds } = records.value;
    this.#characters.reset(characters.map(without_game));
    this.#locations.reset(locations.map(without_game));
    const by_character = new Map<Id, string[]>(characters.map((c) => [c.id, []]));
    for (const m of memories.sort((a, b) => a.n - b.n)) by_character.get(m.character)?.push(m.text);
    for (const [character, texts] of by_character) this.#memories.set(character, state.ros(ok(texts)));
    rounds.sort((a, b) => a.n - b.n);
    this.#history.set_ok(rounds.filter((r) => r.phase === Phase.Done));
    this.#round.set_ok(rounds.find((r) => r.phase !== Phase.Done));
    this.#game.set_ok(game);
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
    const id = id_random();
    const game: Game = { id, name: proposal.name || "Untitled", premise, created: now, updated: now, time: applied.time ?? "", round: 1 };
    //The opening is the story of round 0, so the first round starts after it
    const opening: Round = {
      game: id,
      n: 0,
      phase: Phase.Done,
      cast: cast_of(applied.world),
      actions: {},
      story: world_chunks_ids(proposal.opening, applied.ids),
      changes: [],
    };
    const saved = await store_write(id, {
      game,
      characters: applied.characters,
      locations: applied.locations,
      memories: memory_records(id, applied, () => 0),
      rounds: [opening, new_round(id, 1, applied.world)],
    });
    if (saved.err) return saved;
    const loaded = await this.load(id);
    return loaded.err ? loaded : ok(id);
  }

  /**Stops the loaded game, running calls are cancelled*/
  close() {
    this.#generation++;
    for (const controller of this.#calls.values()) controller.abort();
    this.#calls.clear();
    this.#running.set_ok({});
    this.#game.set_ok(undefined);
    this.#round.set_ok(undefined);
    this.#history.set_ok([]);
    this.#characters.reset([]);
    this.#locations.reset([]);
    this.#memories.clear();
  }

  //      _____  _           __     ________ _____
  //     |  __ \| |        /\\ \   / /  ____|  __ \
  //     | |__) | |       /  \\ \_/ /| |__  | |__) |
  //     |  ___/| |      / /\ \\   / |  __| |  _  /
  //     | |    | |____ / ____ \| |  | |____| | \ \
  //     |_|    |______/_/    \_\_|  |______|_|  \_\

  /**A player character's action for the round, can be changed until the storyteller starts*/
  submit(character: Id, text: string) {
    const r = this.#r;
    const c = this.world.character(character);
    if (!r || !c || r.phase !== Phase.Characters || !r.cast.includes(character)) return;
    this.#update_round((r) => (r.actions[character] = { text, source: c.controller === Controller.Player ? ActionSource.Player : ActionSource.Edited }));
  }

  /**Replaces what an AI character decided, the call deciding it is cancelled*/
  set_action(character: Id, text: string) {
    const r = this.#r;
    if (!r || r.phase !== Phase.Characters || !r.cast.includes(character)) return;
    this.#cancel("char:" + character);
    this.#update_round((r) => (r.actions[character] = { text, source: ActionSource.Edited }), true);
  }

  /**Lets an AI character decide again*/
  redecide(character: Id) {
    const r = this.#r;
    if (!r || r.phase !== Phase.Characters) return;
    this.#cancel("char:" + character);
    this.#update_round((r) => delete r.actions[character]);
  }

  /**Replaces the story of the round, while it is reviewed*/
  edit_story(story: Chunk[]) {
    if (this.#r?.phase !== Phase.StoryReview) return;
    this.#update_round((r) => (r.story = story), true);
  }

  /**Replaces the changes of the round, while they are reviewed*/
  edit_changes(changes: Change[]) {
    if (this.#r?.phase !== Phase.ChangesReview) return;
    this.#update_round((r) => {
      r.changes = changes;
      r.problems = world_apply(this.world, changes).problems;
    }, true);
  }

  /**Changes the world by hand, from the editors, all changes are applied or none
   * @returns what was applied, with the real ids of anything added*/
  edit_world(changes: Change[]): Promise<Result<WorldApplied, string>> {
    return this.#queued(async () => {
      if (!this.#g) return err("No game is loaded");
      const applied = world_apply(this.world, changes);
      const problems = applied.problems.filter((p) => p !== undefined);
      if (problems.length) return err(problems.join("; "));
      const saved = await this.#commit(applied);
      return saved.err ? saved : ok(applied);
    });
  }

  /**Goes on from a review*/
  next() {
    const r = this.#r;
    if (r?.phase === Phase.StoryReview) this.#update_round((r) => (r.phase = Phase.Scribes));
    else if (r?.phase === Phase.ChangesReview) this.#finish(r.changes);
  }

  /**Runs the storyteller or scribes again, from their review*/
  redo() {
    const r = this.#r;
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

  /**Continues after a failure*/
  retry() {
    if (this.#r?.error) this.#update_round((r) => (r.error = undefined));
  }

  //       _____ _    _          _   _  _____ ______  _____
  //      / ____| |  | |   /\   | \ | |/ ____|  ____|/ ____|
  //     | |    | |__| |  /  \  |  \| | |  __| |__  | (___
  //     | |    |  __  | / /\ \ | . ` | | |_ |  __|  \___ \
  //     | |____| |  | |/ ____ \| |\  | |__| | |____ ____) |
  //      \_____|_|  |_/_/    \_\_| \_|\_____|______|_____/

  /**Runs changes to the world one after another, so each is checked against the world the one before left*/
  #queued<T>(run: () => Promise<T>): Promise<T> {
    const result = this.#queue.then(run);
    this.#queue = result.catch(() => undefined);
    return result;
  }

  /**Saves applied changes, and only when saved sets the states of what changed.
   * Must run in the queue, after world_apply on the current world.
   * @param extra more records to save in the same transaction, like the rounds of a finished round
   * @param after runs when saved, before the states of the world are set*/
  async #commit(applied: WorldApplied, extra: GameWrite = {}, after?: () => void): Promise<Result<void, string>> {
    const g = this.#g;
    if (!g) return err("No game is loaded");
    const generation = this.#generation;
    const game: Game = { ...g, ...extra.game, time: applied.time ?? g.time, updated: Date.now() };
    const memories = memory_records(g.id, applied, (id) => this.world.memories(id).length);
    const saved = await store_write(g.id, {
      ...extra,
      game,
      characters: applied.characters,
      locations: applied.locations,
      memories,
    });
    if (saved.err) return saved;
    if (generation !== this.#generation) return err("Another game was loaded");
    after?.();
    for (const l of applied.locations) this.#locations.put(l);
    for (const c of applied.characters) {
      if (!this.#memories.has(c.id)) this.#memories.set(c.id, state.ros(ok<string[]>([])));
      this.#characters.put(c);
    }
    for (const m of memories) this.#memories.get(m.character)?.array.push(m.text);
    this.#game.set_ok(game);
    return ok(undefined);
  }

  //      _____   ____  _    _ _   _ _____   _____
  //     |  __ \ / __ \| |  | | \ | |  __ \ / ____|
  //     | |__) | |  | | |  | |  \| | |  | | (___
  //     |  _  /| |  | | |  | | . ` | |  | |\___ \
  //     | | \ \| |__| | |__| | |\  | |__| |____) |
  //     |_|  \_\\____/ \____/|_| \_|_____/|_____/

  /**Changes the current round, saves it and goes on with whatever the round needs next
   * @param save_later saves after a pause, for text being typed*/
  #update_round(change: (round: Round) => void, save_later = false) {
    const old = this.#r;
    if (!old) return;
    //A round is small, a copy per change is cheap
    const round = structuredClone(old);
    change(round);
    this.#round.set_ok(round);
    if (save_later)
      later(`round/${round.game}/${round.n}`, () => {
        const current = this.#r;
        if (current?.game === round.game && current.n === round.n) store_put_round(current);
      });
    else store_put_round(round);
    this.#step();
  }

  /**Applies the changes, ends the round and starts the next, the world, the finished round and the next round are saved together*/
  #finish(changes: Change[]) {
    this.#queued(async () => {
      const g = this.#g;
      const r = this.#r;
      if (!g || !r) return;
      const applied = world_apply(this.world, changes);
      const done: Round = { ...structuredClone(r), changes, problems: applied.problems, phase: Phase.Done };
      const next = new_round(g.id, r.n + 1, applied.world);
      const saved = await this.#commit(applied, { game: { ...g, round: next.n }, rounds: [done, next] }, () => {
        this.#history.array.push(done);
        this.#round.set_ok(next);
      });
      if (saved.err) this.#update_round((r) => (r.error = "Saving the round failed: " + saved.error));
      else this.#step();
    });
  }

  /**Starts what the current round needs next*/
  #step() {
    const r = this.#r;
    if (!this.#g || !r || r.error) return;
    switch (r.phase) {
      case Phase.Characters: {
        for (const id of r.cast) {
          const c = this.world.character(id);
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
    const r = this.#r!;
    const last = this.#history.ok().at(-1);
    const reply = await this.#call("char:" + character.id, Roles.Character, prompt_character(this.world, r, character, last), undefined, character.id);
    if (reply.err) return;
    const text = without_thinking(reply.value.text).trim();
    if (this.#r?.phase === Phase.Characters && !this.#r.actions[character.id])
      this.#update_round((r) => (r.actions[character.id] = { text, source: ActionSource.Ai }));
  }

  async #tell() {
    const r = this.#r!;
    const reply = await this.#call("storyteller", Roles.Storyteller, prompt_storyteller(this.world, r, this.#history.ok()), {
      name: "story",
      schema: schema_storyteller(r),
    });
    if (reply.err) return;
    const story = parse<StorytellerReply>(reply.value, schema_storyteller(r));
    if (story.err) return this.#update_round((r) => (r.error = "The storyteller's reply did not fit: " + story.error));
    if (this.#r?.phase !== Phase.Storyteller) return;
    this.#update_round((r) => {
      r.story = story.value.story.filter((c) => c.text.trim());
      r.phase = COWRITER.ok() ? Phase.StoryReview : Phase.Scribes;
    });
  }

  async #scribe() {
    const r = this.#r!;
    const schema = schema_scribes(this.world);
    const reply = await this.#call("scribes", Roles.Scribes, prompt_scribes(this.world, r), { name: "changes", schema });
    if (reply.err) return;
    const changes = parse<ScribesReply>(reply.value, schema);
    if (changes.err) return this.#update_round((r) => (r.error = "The scribes' reply did not fit: " + changes.error));
    if (this.#r?.phase !== Phase.Scribes) return;
    if (COWRITER.ok())
      this.#update_round((r) => {
        r.changes = changes.value.changes;
        r.problems = world_apply(this.world, r.changes).problems;
        r.phase = Phase.ChangesReview;
      });
    else this.#finish(changes.value.changes);
  }

  //       _____          _      _       _____
  //      / ____|   /\   | |    | |     / ____|
  //     | |       /  \  | |    | |    | (___
  //     | |      / /\ \ | |    | |     \___ \
  //     | |____ / ____ \| |____| |____ ____) |
  //      \_____/_/    \_\______|______|_____/

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
    const round = this.#r!.n;
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
      this.#update_round((r) => (r.error = `${role === Roles.Character ? (this.world.character(character!)?.name ?? "A character") : role}: ${reply.error}`));
    return reply;
  }
}

/**Records for the memories the changes add, numbered after the memories the characters have
 * @param count number of memories a character has now*/
function memory_records(game: string, applied: WorldApplied, count: (character: Id) => number): MemoryRecord[] {
  const next = new Map<Id, number>();
  return applied.memories.map((m) => {
    const n = next.get(m.character) ?? count(m.character);
    next.set(m.character, n + 1);
    return { game, character: m.character, n, text: m.text };
  });
}

function parse<T>(reply: LlmReply, schema: Schema): Result<T, string> {
  const json = llm_json(without_thinking(reply.text));
  return json.err ? json : schema_check<T>(schema, json.value);
}

export const ENGINE = new Engine();
