//The world of a game: one tree of things, locations, characters and items, and the changes that update it.
//Changes are what the scribes, the game builder and the editors produce, applying them is the only way the world changes.
//The world is read through WorldRead, so a running game can serve it from its states without copying anything.
//See World tree in DESIGN.md.
import { id_make } from "#lib/ids";
import { mention_map } from "#lib/mention";
import { schema_object, type Schema, type SchemaString } from "#lib/schema";

export type Id = string;

export const Kind = { Location: "location", Character: "character", Item: "item" } as const;
export type Kind = (typeof Kind)[keyof typeof Kind];

/**Prefix of the ids of each kind*/
const PREFIX = { location: "loc", character: "char", item: "item" } as const satisfies { [K in Kind]: string };

export const Controller = { Player: "player", Ai: "ai" } as const;
export type Controller = (typeof Controller)[keyof typeof Controller];

export interface Relationship {
  /**The name this character knows the other by*/
  known_as: string;
  /**What this character thinks of the other*/
  opinion: string;
}

interface ThingBase {
  id: Id;
  name: string;
  description: string;
  /**What the thing is in, empty at the top level and for removed things*/
  parent: Id;
  /**What is in the thing, in order*/
  children: Id[];
  /**Removed from the story, kept so its id is never reused and old rounds still refer to it*/
  gone: boolean;
}

export interface Location extends ThingBase {
  kind: typeof Kind.Location;
}

/**A character, its memories are kept apart, see WorldRead.memories*/
export interface Character extends ThingBase {
  kind: typeof Kind.Character;
  /**What others see before they know this character, used as its name until they learn it*/
  appearance: string;
  bio: string;
  personality: string;
  goals: string;
  relationships: { [other: Id]: Relationship };
  controller: Controller;
}

export interface Item extends ThingBase {
  kind: typeof Kind.Item;
}

export type Thing = Location | Character | Item;

/**Fields that can be changed with an update change, and the kinds that have them*/
export const FIELDS = {
  name: [Kind.Location, Kind.Character, Kind.Item],
  description: [Kind.Location, Kind.Character, Kind.Item],
  appearance: [Kind.Character],
  bio: [Kind.Character],
  personality: [Kind.Character],
  goals: [Kind.Character],
} as const satisfies { [field: string]: readonly Kind[] };
export type Field = keyof typeof FIELDS;
const FIELD_NAMES = Object.keys(FIELDS) as Field[];

/**Read access to a world, lookups by id, nothing is copied*/
export abstract class WorldRead {
  /**Time in the story, free text*/
  abstract readonly time: string;
  /**Things at the top level, in order*/
  abstract readonly roots: readonly Id[];
  abstract thing(id: Id): Thing | undefined;
  /**Every thing, removed ones too*/
  abstract things(): Iterable<Thing>;
  /**What the character witnessed or was told, oldest first*/
  abstract memories(character: Id): readonly string[];

  character(id: Id): Character | undefined {
    const t = this.thing(id);
    return t?.kind === Kind.Character ? t : undefined;
  }
  location(id: Id): Location | undefined {
    const t = this.thing(id);
    return t?.kind === Kind.Location ? t : undefined;
  }
  item(id: Id): Item | undefined {
    const t = this.thing(id);
    return t?.kind === Kind.Item ? t : undefined;
  }
  /**Living characters*/
  characters(): Character[] {
    return [...this.things()].filter((t): t is Character => t.kind === Kind.Character && !t.gone);
  }
  /**Existing locations*/
  locations(): Location[] {
    return [...this.things()].filter((t): t is Location => t.kind === Kind.Location && !t.gone);
  }
  /**What is directly in the thing, or at the top level for an empty id*/
  inside(id: Id): Thing[] {
    const ids = id ? (this.thing(id)?.children ?? []) : this.roots;
    return ids.flatMap((c) => this.thing(c) ?? []);
  }
  /**What the thing is in, nearest first*/
  path(id: Id): Thing[] {
    const path: Thing[] = [];
    for (let t = this.thing(this.thing(id)?.parent ?? ""); t && path.length < 1000; t = this.thing(t.parent)) path.push(t);
    return path;
  }
  /**The nearest location the thing is in, a location is its own place*/
  place(id: Id): Location | undefined {
    const t = this.thing(id);
    if (t?.kind === Kind.Location) return t;
    return this.path(id).find((p): p is Location => p.kind === Kind.Location);
  }
}

/**A world in plain maps, for worlds that are not running, like an empty world to build on*/
export class WorldPlain extends WorldRead {
  time = "";
  roots: Id[] = [];
  readonly thing_map = new Map<Id, Thing>();
  readonly memory_map = new Map<Id, string[]>();
  thing(id: Id) {
    return this.thing_map.get(id);
  }
  things() {
    return this.thing_map.values();
  }
  memories(character: Id): readonly string[] {
    return this.memory_map.get(character) ?? [];
  }
}

export const world_empty = (): WorldRead => new WorldPlain();

/**A piece of story, said by the speaker or narrated when the speaker is empty*/
export interface Chunk {
  /**Character saying the text, empty for narration*/
  speaker: Id;
  text: string;
}

export type Change =
  | {
      op: "add_location";
      /**Temporary id, new:<slug>, replaced by a real id when applied*/
      id: string;
      name: string;
      description: string;
      /**Location it is in, empty for the top level*/
      in: Id;
    }
  | {
      op: "add_character";
      id: string;
      name: string;
      description: string;
      appearance: string;
      bio: string;
      personality: string;
      goals: string;
      in: Id;
      /**Only the game builder adds player characters, the scribes leave it out*/
      controller?: Controller;
    }
  | { op: "add_item"; id: string; name: string; description: string; in: Id }
  | { op: "update"; thing: Id; field: Field; value: string }
  /**Puts the thing in another, at the end, or at the index when given (only by hand)*/
  | { op: "move"; thing: Id; in: Id; index?: number }
  /**Removes a thing with nothing in it*/
  | { op: "remove"; thing: Id }
  | { op: "add_memory"; character: Id; memory: string }
  | { op: "set_relationship"; character: Id; other: Id; known_as: string; opinion: string }
  | { op: "set_time"; time: string };

export const NEW_ID_PATTERN = "^new:[a-z0-9]+(-[a-z0-9]+)*$";

/**Schema of a change list, ids are limited to the existing ones and new: ids, so a model forced into it can not make up ids*/
export function world_change_schema(world: WorldRead, builder = false): Schema {
  const ref = (ids: string[]): Schema => {
    const pattern: SchemaString = { type: "string", pattern: NEW_ID_PATTERN };
    return ids.length ? { anyOf: [{ type: "string", enum: ids }, pattern] } : pattern;
  };
  const living = [...world.things()].filter((t) => !t.gone);
  const character = ref(world.characters().map((c) => c.id));
  const thing = ref(living.map((t) => t.id));
  const location_or_top = ref(["", ...world.locations().map((l) => l.id)]);
  const text: Schema = { type: "string" };
  const op = (name: string): Schema => ({ type: "string", enum: [name] });
  const new_id: Schema = { type: "string", pattern: NEW_ID_PATTERN };
  const add_character = {
    op: op("add_character"),
    id: new_id,
    name: text,
    description: text,
    appearance: text,
    bio: text,
    personality: text,
    goals: text,
    in: thing,
  };
  return {
    type: "array",
    items: {
      anyOf: [
        schema_object({ op: op("add_location"), id: new_id, name: text, description: text, in: location_or_top }),
        schema_object(builder ? { ...add_character, controller: { type: "string", enum: Object.values(Controller) } } : add_character),
        schema_object({ op: op("add_item"), id: new_id, name: text, description: text, in: thing }),
        schema_object({ op: op("update"), thing, field: { type: "string", enum: FIELD_NAMES }, value: text }),
        schema_object({ op: op("move"), thing, in: ref(["", ...living.map((t) => t.id)]) }),
        schema_object({ op: op("remove"), thing }),
        schema_object({ op: op("add_memory"), character, memory: text }),
        schema_object({ op: op("set_relationship"), character, other: character, known_as: text, opinion: text }),
        schema_object({ op: op("set_time"), time: text }),
      ],
    },
  };
}

/**A memory added by a change*/
export interface MemoryAdded {
  character: Id;
  text: string;
}

export interface WorldApplied {
  /**The world with the changes, the original with an overlay of what changed*/
  world: WorldRead;
  /**Problem per change, by index, undefined for changes that were applied*/
  problems: (string | undefined)[];
  /**Real ids given to temporary new: ids*/
  ids: Map<string, Id>;
  /**New values of the things the changes touched or added*/
  things: Thing[];
  /**New top level, undefined when unchanged*/
  roots: Id[] | undefined;
  /**Memories added, in order*/
  memories: MemoryAdded[];
  /**New time, undefined when unchanged*/
  time: string | undefined;
}

/**A world with changes on top of another, only what the changes touch is copied*/
class WorldOverlay extends WorldRead {
  readonly #base: WorldRead;
  readonly touched = new Map<Id, Thing>();
  readonly memories_added: MemoryAdded[] = [];
  new_time: string | undefined;
  new_roots: Id[] | undefined;

  constructor(base: WorldRead) {
    super();
    this.#base = base;
  }
  get time() {
    return this.new_time ?? this.#base.time;
  }
  get roots() {
    return this.new_roots ?? this.#base.roots;
  }
  thing(id: Id) {
    return this.touched.get(id) ?? this.#base.thing(id);
  }
  *things() {
    for (const t of this.#base.things()) yield this.touched.get(t.id) ?? t;
    for (const t of this.touched.values()) if (!this.#base.thing(t.id)) yield t;
  }
  memories(character: Id): readonly string[] {
    const added = this.memories_added.filter((m) => m.character === character).map((m) => m.text);
    return added.length ? [...this.#base.memories(character), ...added] : this.#base.memories(character);
  }
  /**A copy of the thing to change, copied the first time only*/
  edit<T extends Thing>(t: T): T {
    let copy = this.touched.get(t.id) as T | undefined;
    if (!copy) this.touched.set(t.id, (copy = structuredClone(t)));
    return copy;
  }
  /**The children of the parent to change, the top level for an empty id*/
  edit_children(parent: Id): Id[] {
    if (!parent) return (this.new_roots ??= [...this.#base.roots]);
    return this.edit(this.thing(parent)!).children;
  }
}

const ADDS = ["add_location", "add_character", "add_item"] as const;
type Add = Extract<Change, { op: (typeof ADDS)[number] }>;
/**The kind with its article, "an item"*/
const a = (kind: Kind) => (kind === Kind.Item ? "an " : "a ") + kind;
const is_add = (c: Change): c is Add => (ADDS as readonly string[]).includes(c.op);
const kind_of = (c: Add): Kind => (c.op === "add_location" ? Kind.Location : c.op === "add_character" ? Kind.Character : Kind.Item);

/**Applies changes on top of the world, without changing or copying it, changes that do not fit are skipped and explained.
 * Additions are applied first, each once what it goes in exists, so other changes can refer to them by their temporary id.*/
export function world_apply(world: WorldRead, changes: readonly Change[]): WorldApplied {
  const next = new WorldOverlay(world);
  const problems: (string | undefined)[] = changes.map(() => undefined);
  const ids = new Map<string, Id>();
  const given = new Set<Id>();
  const taken = (id: string) => !!next.thing(id) || given.has(id);

  //Real ids first, so text in any change can be rewritten to them
  for (const change of changes)
    if (is_add(change) && change.id.startsWith("new:") && !ids.has(change.id)) {
      const id = id_make(PREFIX[kind_of(change)], change.name, taken);
      ids.set(change.id, id);
      given.add(id);
    }
  const real = (id: string) => ids.get(id) ?? id;
  const text = (t: string) => mention_map(t, (shown, id) => ({ text: shown, id: real(id) }));

  const thing = (id: Id): Thing => {
    const t = next.thing(real(id));
    if (!t) return fail(`there is nothing with the id ${id}`);
    if (t.gone) fail(`${id} is removed`);
    return t;
  };
  const character = (id: Id) => {
    const t = thing(id);
    if (t.kind !== Kind.Character) fail(`${id} is not a character`);
    return t;
  };

  /**Puts the thing in the target, checking it can go there, it must be out of any parent*/
  const put = (t: Thing, target: Id, index?: number) => {
    const into = target ? thing(target) : undefined;
    if (t.kind === Kind.Location) {
      if (into && into.kind !== Kind.Location) fail(`a location can only be in a location, not in ${into.id}`);
    } else if (!into) fail(`${a(t.kind)} must be in something`);
    if (into && (into.id === t.id || next.path(into.id).some((p) => p.id === t.id))) fail(`${t.id} can not go inside itself`);
    const children = next.edit_children(into?.id ?? "");
    children.splice(index === undefined ? children.length : Math.max(0, Math.min(index, children.length)), 0, t.id);
    next.edit(t).parent = into?.id ?? "";
  };
  /**Takes the thing out of its parent*/
  const take_out = (t: Thing) => {
    const children = next.edit_children(t.parent);
    const i = children.indexOf(t.id);
    if (i >= 0) children.splice(i, 1);
    next.edit(t).parent = "";
  };

  const add = (change: Add) => {
    const id = ids.get(change.id);
    if (!id) return fail(`the id of a new ${kind_of(change)} must start with new:, not ${change.id}`);
    if (next.thing(id)) fail(`${change.id} is added twice`);
    const base = { id, name: change.name, description: text(change.description), parent: "", children: [], gone: false };
    const t: Thing =
      change.op === "add_character"
        ? {
            ...base,
            kind: Kind.Character,
            appearance: text(change.appearance),
            bio: text(change.bio),
            personality: text(change.personality),
            goals: text(change.goals),
            relationships: {},
            controller: change.controller ?? Controller.Ai,
          }
        : { ...base, kind: change.op === "add_location" ? Kind.Location : Kind.Item };
    //Checked before it is added, so a failure leaves nothing behind
    const target = change.in ? thing(change.in) : undefined;
    if (t.kind !== Kind.Location && !target) fail(`${a(t.kind)} must be in something`);
    if (t.kind === Kind.Location && target && target.kind !== Kind.Location) fail(`a location can only be in a location, not in ${target.id}`);
    next.touched.set(id, t);
    put(t, change.in ? real(change.in) : "");
  };

  const apply = (change: Change) => {
    switch (change.op) {
      case "add_location":
      case "add_character":
      case "add_item":
        return add(change);
      case "update": {
        const t = thing(change.thing);
        const kinds: readonly Kind[] | undefined = FIELDS[change.field];
        if (!kinds) fail(`${change.field} is not a field`);
        if (!kinds.includes(t.kind)) fail(`${a(t.kind)} has no ${change.field}`);
        (next.edit(t) as unknown as { [field: string]: string })[change.field] = text(change.value);
        return;
      }
      case "move": {
        const t = thing(change.thing);
        const target = real(change.in);
        if (target) thing(target);
        //Checked on a trial first, so a failure leaves the thing where it was
        const from = t.parent;
        const index = next.edit_children(from).indexOf(t.id);
        take_out(t);
        try {
          put(next.thing(t.id)!, target, change.index);
        } catch (e) {
          next.edit_children(from).splice(index, 0, t.id);
          next.edit(next.thing(t.id)!).parent = from;
          throw e;
        }
        return;
      }
      case "remove": {
        const t = thing(change.thing);
        const inside = next.inside(t.id).filter((c) => !c.gone);
        if (inside.length) fail(`${inside.map((c) => c.name).join(", ")} ${inside.length > 1 ? "are" : "is"} still in ${t.name}`);
        take_out(t);
        next.edit(next.thing(t.id)!).gone = true;
        return;
      }
      case "add_memory":
        next.memories_added.push({ character: character(change.character).id, text: text(change.memory) });
        return;
      case "set_relationship": {
        const c = character(change.character);
        const other = character(change.other);
        if (c.id === other.id) fail("a character can not have a relationship with itself");
        next.edit(c).relationships[other.id] = { known_as: change.known_as, opinion: text(change.opinion) };
        return;
      }
      case "set_time":
        next.new_time = change.time;
        return;
      default:
        fail(`unknown change ${(change as { op: string }).op}`);
    }
  };

  const run = (i: number) => {
    try {
      apply(changes[i]);
      return true;
    } catch (e) {
      problems[i] = e instanceof ChangeProblem ? e.message : String(e);
      return false;
    }
  };
  //Additions whose target is added later wait for it, until nothing more can be added
  let waiting = [...changes.keys()].filter((i) => is_add(changes[i]));
  for (let progress = true; waiting.length && progress; ) {
    progress = false;
    waiting = waiting.filter((i) => {
      const target = real((changes[i] as Add).in);
      if (target && !next.thing(target) && ids.has((changes[i] as Add).in)) return true;
      progress = true;
      run(i);
      return false;
    });
  }
  for (const i of waiting) problems[i] = `${(changes[i] as Add).in} is never added`;
  for (const i of changes.keys()) if (!is_add(changes[i])) run(i);

  return {
    world: next,
    problems,
    ids,
    things: [...next.touched.values()],
    roots: next.new_roots,
    memories: next.memories_added,
    time: next.new_time,
  };
}

/**Why a change can not be applied*/
class ChangeProblem extends Error {}
function fail(problem: string): never {
  throw new ChangeProblem(problem);
}

/**Rewrites temporary ids in text and speaker of chunks to the real ids*/
export function world_chunks_ids(chunks: readonly Chunk[], ids: Map<string, Id>): Chunk[] {
  return chunks.map((c) => ({
    speaker: ids.get(c.speaker) ?? c.speaker,
    text: mention_map(c.text, (shown, id) => ({ text: shown, id: ids.get(id) ?? id })),
  }));
}

/**Name a character knows another by, its appearance when they have not met*/
export function world_known_as(world: WorldRead, viewer: Id, other: Id): string {
  if (viewer === other) return world.character(other)?.name ?? other;
  const known = world.character(viewer)?.relationships[other]?.known_as;
  return known || world.character(other)?.appearance || "someone";
}

/**Everything inside the thing, at any depth, in tree order*/
export function world_subtree(world: WorldRead, id: Id): Thing[] {
  return world.inside(id).flatMap((t) => [t, ...world_subtree(world, t.id)]);
}

/**What a character can see: what is with it where it is, without what is inside other characters and items.
 * In a location that is what is in the location and the location around it, inside a character or item what is in there with it.*/
export function world_visible(world: WorldRead, viewer: Id): Thing[] {
  const c = world.thing(viewer);
  if (!c) return [];
  const around = world.thing(c.parent);
  const here = world.inside(c.parent).filter((t) => t.id !== viewer && !t.gone);
  if (around?.kind !== Kind.Location) return around ? [around, ...here] : here;
  const outside = world.location(around.parent);
  return outside ? [...here, outside] : here;
}

/**Readable one line summary of a change, for review*/
export function world_change_text(world: WorldRead, change: Change): string {
  const name = (id: string) => (id ? (world.thing(id)?.name ?? id) : "the top level");
  switch (change.op) {
    case "add_location":
    case "add_character":
    case "add_item":
      return `New ${kind_of(change)} ${change.name} in ${name(change.in)}: ${change.description}`;
    case "update":
      return `${name(change.thing)}, ${change.field}: ${change.value}`;
    case "move":
      return `${name(change.thing)} goes into ${name(change.in)}`;
    case "remove":
      return `${name(change.thing)} is removed`;
    case "add_memory":
      return `${name(change.character)} remembers: ${change.memory}`;
    case "set_relationship":
      return `${name(change.character)} knows ${name(change.other)} as "${change.known_as}": ${change.opinion}`;
    case "set_time":
      return `Time: ${change.time}`;
    default:
      return JSON.stringify(change);
  }
}
