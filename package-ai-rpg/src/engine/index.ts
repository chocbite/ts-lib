//Runs a game: the phases of each round, the LLM calls, and saving every change.
//Everything the UI shows comes from the states here, everything the player does goes through the methods here.
//Every game object is its own state, a change sets only the states of what changed and saves only those records,
//see State and storage model in DESIGN.md.
import { ActionSource, Phase, type Call, type Game, type MemoryRecord, type Roll, type Round, type Scribed, type ThingRecord } from "#game";
import { Keyed } from "#lib/keyed";
import { Tree, type TreeRows } from "#lib/tree";
import { id_random } from "#lib/ids";
import { later } from "#lib/later";
import { llm_chat, llm_json, type LlmMessage, type LlmReply } from "#lib/llm";
import { schema_check, type Schema } from "#lib/schema";
import { COWRITER, ROLES, Roles, SERVER_KEY, SERVER_URL } from "#options";
import {
  prompt_character,
  prompt_level_up,
  prompt_scribe_character,
  prompt_scribe_time,
  prompt_scribe_world,
  prompt_skillcheck,
  prompt_storyteller,
  schema_level_up,
  schema_scribe_character,
  schema_scribe_time,
  schema_scribe_world,
  schema_skillcheck,
  schema_storyteller,
  type BuilderReply,
  type LevelUpReply,
  type ScribesReply,
  type ScribeTimeReply,
  type SkillcheckReply,
  type StorytellerReply,
} from "#prompts";
import { rules_d100 } from "#rules";
import { store_load, store_put_call, store_put_round, store_write, type GameWrite } from "#store";
import {
  Controller,
  GLOBAL,
  world_apply,
  world_base_nodes,
  world_chunks_ids,
  world_empty,
  WorldRead,
  type Ability,
  type AttributeValue,
  type Effect,
  type Change,
  type Character,
  type Chunk,
  type Id,
  type Node,
  type SkillValue,
  type WorldApplied,
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

/**Characters taking part in a round: the living player characters and the AI characters in their places*/
function cast_of(world: WorldRead): Id[] {
  const living = world.characters();
  const players = living.filter((c) => c.controller === Controller.Player);
  const places = new Set(players.map((c) => world.place(c.id)?.id));
  return [...players, ...living.filter((c) => c.controller === Controller.Ai && places.has(world.place(c.id)?.id))].map((c) => c.id);
}

/**A new round, it starts with the level up phase when a character has skill points to spend*/
function new_round(game: string, n: number, world: WorldRead): Round {
  const leveling = world.characters().filter((c) => c.skill_points > 0).map((c) => c.id);
  return {
    game,
    n,
    phase: leveling.length ? Phase.LevelUp : Phase.Characters,
    cast: cast_of(world),
    actions: {},
    ...(leveling.length ? { leveling } : {}),
    story: [],
    changes: [],
  };
}

/**Some models put their thinking in the reply text instead of a separate field*/
const without_thinking = (text: string) => text.replace(/^\s*<think>[\s\S]*?<\/think>\s*/, "");

/**Strips the game id stored with world records*/
const without_game = ({ game: _game, ...rest }: ThingRecord) => rest;

type Entries = "attributes" | "skills" | "abilities" | "effects";
const ENTRIES: Entries[] = ["attributes", "skills", "abilities", "effects"];
type Entry = AttributeValue | SkillValue | Ability | Effect;
/**Key of an entry, an entry keeps its state while its key stays*/
const entry_key = (e: Entry) => ("skill" in e ? e.skill : e.id);
/**Entries of a list of a node, empty when the node has no such list*/
const entries_of = (node: Node | undefined, field: Entries): Entry[] =>
  node && field in node ? (node as unknown as { [f in Entries]: Entry[] })[field] : [];

/**The world of the loaded game, read from the states of the engine without copying*/
class EngineWorld extends WorldRead {
  readonly #game: StateROS<Game | undefined>;
  readonly #tree: Tree<Node>;
  readonly #memories: Map<Id, StateROS<string[]>>;
  constructor(game: StateROS<Game | undefined>, tree: Tree<Node>, memories: Map<Id, StateROS<string[]>>) {
    super();
    this.#game = game;
    this.#tree = tree;
    this.#memories = memories;
  }
  get roots() {
    return this.#game.ok()?.roots ?? [];
  }
  node(id: Id) {
    return this.#tree.value(id);
  }
  nodes() {
    return this.#tree.values();
  }
  memories(id: Id) {
    return this.#memories.get(id)?.ok() ?? [];
  }
}

class Engine {
  readonly #game = state.ros(ok<Game | undefined>(undefined));
  readonly #tree = new Tree<Node>(
    (parent, from, to, count) => this.#reorder(parent, from, to, count),
    (parent, index, ids) => this.#move_into(parent, index, ids),
  );
  /**Memories of each character, an array state that is only pushed to*/
  readonly #memories = new Map<Id, StateLocalROS<string[]>>();
  readonly #round = state.ros(ok<Round | undefined>(undefined));
  readonly #history = state.ros(ok<Round[]>([]));
  readonly #running = state.ros(ok<{ [key: string]: Running }>({}));
  /**Counts changes to the world*/
  readonly #changed = state.ros(ok(0));
  /**Entry lists of things, made when first asked for*/
  readonly #entries = new Map<string, Keyed<Entry>>();

  /**Details of the loaded game, undefined when none is*/
  readonly game = this.#game.read_only;
  /**The Global node and the things at the top level of the world, each a state that stays the same object.
   * Writing a move to it, or to the children of a node, moves nodes inside it by hand,
   * writing an insert (splice or push of node states) moves them there from wherever they are, without a removal from where they were.*/
  readonly roots: TreeRows<Node> = this.#tree.roots;
  /**Changes whenever anything in the world changes, for views showing a little of everything*/
  readonly changed = this.#changed.read_only;
  /**The current round*/
  readonly round = this.#round.read_only;
  /**Finished rounds in order, only ever added to*/
  readonly history = this.#history.read_only;
  /**LLM calls running now, by key*/
  readonly running = this.#running.read_only;

  /**The world of the loaded game, read from the states without copying*/
  readonly world: WorldRead = new EngineWorld(this.#game, this.#tree, this.#memories);

  /**State of a node*/
  node(id: Id): StateROS<Node> | undefined {
    return this.#tree.get(id);
  }
  /**States of what is in a node, writing a move to it reorders them*/
  children(id: Id): TreeRows<Node> | undefined {
    return this.#tree.children(id);
  }

  /**Attribute values of a thing, each entry a state, the array only changes where the entries change*/
  attributes(id: Id): StateROS<StateROS<AttributeValue>[]> {
    return this.#keyed(id, "attributes") as Keyed<AttributeValue>["rows"];
  }
  /**Skill levels or bonuses of a character or item*/
  skills(id: Id): StateROS<StateROS<SkillValue>[]> {
    return this.#keyed(id, "skills") as Keyed<SkillValue>["rows"];
  }
  /**Abilities of a character*/
  abilities(id: Id): StateROS<StateROS<Ability>[]> {
    return this.#keyed(id, "abilities") as Keyed<Ability>["rows"];
  }

  /**Active effects on a thing*/
  effects(id: Id): StateROS<StateROS<Effect>[]> {
    return this.#keyed(id, "effects") as Keyed<Effect>["rows"];
  }

  #keyed(id: Id, field: Entries) {
    const name = field + "/" + id;
    let keyed = this.#entries.get(name);
    if (!keyed) this.#entries.set(name, (keyed = new Keyed<Entry>(entry_key, entries_of(this.#tree.value(id), field))));
    return keyed.rows;
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
    const { game, things, memories, rounds } = records.value;
    this.#entries.clear();
    this.#tree.reset(things.map(without_game), [GLOBAL, ...game.roots]);
    const by_character = new Map<Id, string[]>(things.filter((t) => t.kind === "character").map((c) => [c.id, []]));
    for (const m of memories.sort((a, b) => a.n - b.n)) by_character.get(m.character)?.push(m.text);
    for (const [character, texts] of by_character) this.#memories.set(character, state.ros(ok(texts)));
    rounds.sort((a, b) => a.n - b.n);
    this.#history.set_ok(rounds.filter((r) => r.phase === Phase.Done));
    this.#round.set_ok(rounds.find((r) => r.phase !== Phase.Done));
    this.#game.set_ok(game);
    this.#changed.set_ok(this.#changed.ok() + 1);
    this.#step();
    return ok(undefined);
  }

  /**Makes a game from what the game builder proposed, and loads it
   * @returns the id of the new game*/
  async create(proposal: BuilderReply, premise: string): Promise<Result<string, string>> {
    const base = world_empty();
    const applied = world_apply(base, proposal.changes);
    const problems = applied.problems.filter((p) => p !== undefined);
    if (problems.length) return err("The world has problems: " + problems.join("; "));
    const now = Date.now();
    const id = id_random();
    const game: Game = {
      id,
      name: proposal.name || "Untitled",
      premise,
      created: now,
      updated: now,
      round: 1,
      roots: applied.roots ?? [],
    };
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
      //The nodes every world has and everything the changes added or touched
      things: [...new Map([...world_base_nodes(), ...applied.nodes].map((n) => [n.id, n])).values()],
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
    this.#tree.reset([], []);
    this.#entries.clear();
    this.#memories.clear();
    this.#changed.set_ok(this.#changed.ok() + 1);
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

  /**Replaces the rolls of the round, while they are reviewed*/
  edit_rolls(rolls: Roll[]) {
    if (this.#r?.phase !== Phase.RollsReview) return;
    this.#update_round((r) => (r.rolls = rolls), true);
  }

  /**Spends skill points of a character by hand, like in the level up window*/
  spend(character: Id, skill: Id, points: number) {
    return this.edit_world([{ op: "spend_skill_points", character, skill, points }]);
  }

  /**A character is done spending its skill points, the round goes on when everyone is*/
  level_done(character: Id) {
    if (this.#r?.phase !== Phase.LevelUp) return;
    this.#update_round((r) => (r.leveling = (r.leveling ?? []).filter((id) => id !== character)));
  }

  /**Replaces the story of the round, while it is reviewed*/
  edit_story(story: Chunk[]) {
    if (this.#r?.phase !== Phase.StoryReview) return;
    this.#update_round((r) => (r.story = story), true);
  }

  /**Replaces the changes of the round, while they are reviewed*/
  edit_changes(changes: Change[], sources: string[]) {
    if (this.#r?.phase !== Phase.ChangesReview) return;
    this.#update_round((r) => {
      r.changes = changes;
      r.sources = sources;
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
    if (r?.phase === Phase.RollsReview) this.#update_round((r) => (r.phase = Phase.Storyteller));
    else if (r?.phase === Phase.StoryReview) this.#update_round((r) => (r.phase = Phase.Scribes));
    else if (r?.phase === Phase.ChangesReview) this.#finish(r.changes, r.sources ?? []);
  }

  /**Runs the skillcheck, storyteller or scribes again, from their review*/
  redo() {
    const r = this.#r;
    if (r?.phase === Phase.RollsReview)
      this.#update_round((r) => {
        r.phase = Phase.Skillcheck;
        r.rolls = [];
      });
    else if (r?.phase === Phase.StoryReview)
      this.#update_round((r) => {
        r.phase = Phase.Storyteller;
        r.story = [];
      });
    else if (r?.phase === Phase.ChangesReview)
      this.#update_round((r) => {
        r.phase = Phase.Scribes;
        r.changes = [];
        r.sources = undefined;
        r.scribed = undefined;
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
    const game: Game = { ...g, ...extra.game, roots: applied.roots ?? g.roots, updated: Date.now() };
    const memories = memory_records(g.id, applied, (id) => this.world.memories(id).length);
    const saved = await store_write(g.id, {
      ...extra,
      game,
      things: applied.nodes,
      memories,
    });
    if (saved.err) return saved;
    if (generation !== this.#generation) return err("Another game was loaded");
    after?.();
    //The game first, the world reads the top level from it
    this.#game.set_ok(game);
    for (const n of applied.nodes)
      if (n.kind === "character" && !this.#memories.has(n.id)) this.#memories.set(n.id, state.ros(ok<string[]>([])));
    this.#tree.put(applied.nodes, applied.roots && [GLOBAL, ...applied.roots]);
    for (const n of applied.nodes)
      for (const field of ENTRIES) this.#entries.get(field + "/" + n.id)?.sync(entries_of(n, field));
    for (const m of memories) this.#memories.get(m.character)?.array.push(m.text);
    this.#changed.set_ok(this.#changed.ok() + 1);
    return ok(undefined);
  }

  /**Moves things inside one parent by hand, from a list
   * @param parent empty for the top level*/
  async #reorder(parent: Id, from: number, to: number, count: number): Promise<Result<void, string>> {
    const ids = (parent ? (this.world.node(parent)?.children ?? []) : [GLOBAL, ...this.world.roots]).slice(from, from + count);
    if (ids.includes(GLOBAL)) return err("Global stays first");
    //The top level rows start with Global, which is not one of the roots
    if (!parent) to = Math.max(0, to - 1);
    //Each move takes one thing out and puts it at its final index, moving down the last goes first
    const moves: Change[] = ids.map((thing, k) => ({ op: "move", thing, in: parent, index: to + k }));
    if (to > from) moves.reverse();
    const moved = await this.edit_world(moves);
    return moved.err ? moved : ok(undefined);
  }

  /**Moves things from wherever they are into a parent by hand, from a list, all or none
   * @param parent empty for the top level*/
  async #move_into(parent: Id, index: number, ids: Id[]): Promise<Result<void, string>> {
    if (ids.includes(GLOBAL)) return err("Global stays first");
    if (!parent) index = Math.max(0, index - 1);
    const moved = await this.edit_world(ids.map((thing, k) => ({ op: "move", thing, in: parent, index: index + k })));
    return moved.err ? moved : ok(undefined);
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
  #finish(changes: Change[], sources: string[]) {
    this.#queued(async () => {
      const g = this.#g;
      const r = this.#r;
      if (!g || !r) return;
      const applied = world_apply(this.world, changes);
      const done: Round = { ...structuredClone(r), changes, sources, problems: applied.problems, phase: Phase.Done };
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
      case Phase.LevelUp: {
        const leveling = r.leveling ?? [];
        if (!leveling.length) return this.#update_round((r) => (r.phase = Phase.Characters));
        for (const id of leveling) {
          const c = this.world.character(id);
          if (c?.controller === Controller.Ai && !this.#calls.has("level:" + id)) this.#level_up(c);
        }
        return;
      }
      case Phase.Characters: {
        for (const id of r.cast) {
          const c = this.world.character(id);
          if (c?.controller === Controller.Ai && !r.actions[id] && !this.#calls.has("char:" + id)) this.#decide(c);
        }
        if (r.cast.every((id) => r.actions[id])) this.#update_round((r) => (r.phase = Phase.Skillcheck));
        return;
      }
      case Phase.Skillcheck:
        if (!this.#calls.has("skillcheck")) this.#skillcheck();
        return;
      case Phase.Storyteller:
        if (!this.#calls.has("storyteller")) this.#tell();
        return;
      case Phase.Scribes:
        return this.#scribes(r);
    }
  }

  async #decide(character: Character) {
    const last = this.#history.ok().at(-1);
    const reply = await this.#call("char:" + character.id, Roles.Character, prompt_character(this.world, character, last), undefined, character.id);
    if (reply.err) return;
    const text = without_thinking(reply.value.text).trim();
    if (this.#r?.phase === Phase.Characters && !this.#r.actions[character.id])
      this.#update_round((r) => (r.actions[character.id] = { text, source: ActionSource.Ai }));
  }

  async #skillcheck() {
    const r = this.#r!;
    const schema = schema_skillcheck(this.world, r);
    const reply = await this.#call("skillcheck", Roles.Skillcheck, prompt_skillcheck(this.world, r), { name: "checks", schema });
    if (reply.err) return;
    const checks = parse<SkillcheckReply>(reply.value, schema);
    if (checks.err) return this.#update_round((r) => (r.error = "The skillcheck's reply did not fit: " + checks.error));
    if (this.#r?.phase !== Phase.Skillcheck) return;
    //One check per character of the cast, the code rolls
    const seen = new Set<Id>();
    const rolls: Roll[] = checks.value.checks
      .filter((c) => r.cast.includes(c.character) && !seen.has(c.character) && seen.add(c.character))
      .map((c) => ({ ...c, skills: c.skills.filter((s) => this.world.skill(s)), roll: rules_d100() }));
    this.#update_round((r) => {
      r.rolls = rolls;
      r.phase = COWRITER.ok() ? Phase.RollsReview : Phase.Storyteller;
    });
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

  /**Runs the sub scribes that have not recorded yet: time and world together, then every character of the cast together,
   * on the world with the world scribe's changes. When all are done, their changes go to review or are applied.*/
  #scribes(r: Round) {
    const scribed = r.scribed ?? { characters: {} };
    if (!scribed.time && !this.#calls.has("scribe:time")) this.#scribe_time();
    if (!scribed.world && !this.#calls.has("scribe:world")) this.#scribe_world();
    if (!scribed.world) return;
    const cast = r.cast.filter((id) => this.world.character(id) && !this.world.character(id)!.gone);
    const after_world = world_apply(this.world, scribed.world).world;
    for (const id of cast) {
      const c = after_world.character(id);
      if (c && !scribed.characters[id] && !this.#calls.has("scribe:char:" + id)) this.#scribe_character(after_world, c);
    }
    if (!scribed.time || cast.some((id) => !scribed.characters[id])) return;
    const changes = [...scribed.time, ...scribed.world, ...cast.flatMap((id) => scribed.characters[id])];
    const sources = [...scribed.time.map(() => "time"), ...scribed.world.map(() => "world"), ...cast.flatMap((id) => scribed.characters[id].map(() => id))];
    if (COWRITER.ok())
      this.#update_round((r) => {
        r.changes = changes;
        r.sources = sources;
        r.problems = world_apply(this.world, changes).problems;
        r.phase = Phase.ChangesReview;
      });
    else this.#finish(changes, sources);
  }

  /**Keeps what a scribe recorded, while the round is still with the scribes*/
  #scribed(record: (scribed: Scribed) => void) {
    if (this.#r?.phase !== Phase.Scribes) return;
    this.#update_round((r) => record((r.scribed ??= { characters: {} })));
  }

  async #scribe_time() {
    const r = this.#r!;
    const schema = schema_scribe_time();
    const reply = await this.#call("scribe:time", Roles.Scribes, prompt_scribe_time(this.world, r), { name: "time", schema });
    if (reply.err) return;
    const time = parse<ScribeTimeReply>(reply.value, schema);
    if (time.err) return this.#update_round((r) => (r.error = "The time scribe's reply did not fit: " + time.error));
    this.#scribed((s) => (s.time = time.value.amount > 0 ? [{ op: "pass_time", amount: time.value.amount, unit: time.value.unit }] : []));
  }

  async #scribe_world() {
    const r = this.#r!;
    const schema = schema_scribe_world(this.world);
    const reply = await this.#call("scribe:world", Roles.Scribes, prompt_scribe_world(this.world, r), { name: "changes", schema });
    if (reply.err) return;
    const changes = parse<ScribesReply>(reply.value, schema);
    if (changes.err) return this.#update_round((r) => (r.error = "The world scribe's reply did not fit: " + changes.error));
    this.#scribed((s) => (s.world = changes.value.changes));
  }

  /**@param world the world with the world scribe's changes, so the character scribe can use what it added*/
  async #scribe_character(world: WorldRead, character: Character) {
    const r = this.#r!;
    const schema = schema_scribe_character(world, character.id);
    const reply = await this.#call(
      "scribe:char:" + character.id,
      Roles.Scribes,
      prompt_scribe_character(world, r, character),
      { name: "changes", schema },
      character.id,
    );
    if (reply.err) return;
    const changes = parse<ScribesReply>(reply.value, schema);
    if (changes.err) return this.#update_round((r) => (r.error = `The scribe of ${character.name}'s reply did not fit: ${changes.error}`));
    this.#scribed((s) => (s.characters[character.id] = changes.value.changes));
  }

  /**Lets an AI character spend its skill points, raises that do not fit are left out*/
  async #level_up(character: Character) {
    const schema = schema_level_up(this.world);
    const reply = await this.#call("level:" + character.id, Roles.Character, prompt_level_up(this.world, character), { name: "raises", schema }, character.id);
    if (reply.err) return;
    const raises = parse<LevelUpReply>(reply.value, schema);
    if (raises.err) return this.#update_round((r) => (r.error = `${character.name}'s level up did not fit: ${raises.error}`));
    const changes: Change[] = raises.value.raises
      .filter((x) => x.points > 0)
      .map((x) => ({ op: "spend_skill_points", character: character.id, skill: x.skill, points: x.points }));
    const fitting = changes.filter((_, i) => world_apply(this.world, changes).problems[i] === undefined);
    if (fitting.length) await this.edit_world(fitting);
    this.level_done(character.id);
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
