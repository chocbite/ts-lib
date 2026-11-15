//The world of a game: characters and locations, and the changes that update it.
//Changes are what the scribes, the game builder and the editors produce, applying them is the only way the world changes.
//The world is read through WorldRead, so a running game can serve it from its states without copying anything.
import { id_make } from "#lib/ids";
import { mention_map } from "#lib/mention";
import { schema_object, type Schema, type SchemaString } from "#lib/schema";

export type Id = string;

export const Controller = { Player: "player", Ai: "ai" } as const;
export type Controller = (typeof Controller)[keyof typeof Controller];

export interface Relationship {
  /**The name this character knows the other by*/
  known_as: string;
  /**What this character thinks of the other*/
  opinion: string;
}

/**A character, its memories are kept apart, see WorldRead.memories*/
export interface Character {
  id: Id;
  name: string;
  /**Short description telling this character apart from others, for the storyteller and scribes*/
  description: string;
  /**What others see before they know this character, used as its name until they learn it*/
  appearance: string;
  bio: string;
  personality: string;
  goals: string;
  location: Id;
  relationships: { [other: Id]: Relationship };
  controller: Controller;
  /**Removed from the story, kept so its id is never reused and old rounds still refer to it*/
  gone: boolean;
}

export interface Location {
  id: Id;
  name: string;
  description: string;
  gone: boolean;
}

/**Read access to a world, lookups by id, nothing is copied*/
export interface WorldRead {
  /**Time in the story, free text*/
  readonly time: string;
  character(id: Id): Character | undefined;
  location(id: Id): Location | undefined;
  /**Every character, removed ones too*/
  characters(): Iterable<Character>;
  /**Every location, removed ones too*/
  locations(): Iterable<Location>;
  /**What the character witnessed or was told, oldest first*/
  memories(character: Id): readonly string[];
}

/**A world in plain maps, for worlds that are not running, like an empty world to build on*/
export class WorldPlain implements WorldRead {
  time = "";
  readonly character_map = new Map<Id, Character>();
  readonly location_map = new Map<Id, Location>();
  readonly memory_map = new Map<Id, string[]>();
  character(id: Id) {
    return this.character_map.get(id);
  }
  location(id: Id) {
    return this.location_map.get(id);
  }
  characters() {
    return this.character_map.values();
  }
  locations() {
    return this.location_map.values();
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

export const CharacterFields = ["name", "description", "appearance", "bio", "personality", "goals"] as const;
export type CharacterField = (typeof CharacterFields)[number];
export const LocationFields = ["name", "description"] as const;
export type LocationField = (typeof LocationFields)[number];

export type Change =
  | {
      op: "add_location";
      /**Temporary id, new:<slug>, replaced by a real id when applied*/
      id: string;
      name: string;
      description: string;
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
      location: Id;
      /**Only the game builder adds player characters, the scribes leave it out*/
      controller?: Controller;
    }
  | { op: "update_character"; character: Id; field: CharacterField; value: string }
  | { op: "move_character"; character: Id; location: Id }
  | { op: "remove_character"; character: Id }
  | { op: "add_memory"; character: Id; memory: string }
  | { op: "set_relationship"; character: Id; other: Id; known_as: string; opinion: string }
  | { op: "update_location"; location: Id; field: LocationField; value: string }
  /**Only made by hand in the editors, not in the schema an LLM gets*/
  | { op: "remove_location"; location: Id }
  | { op: "set_time"; time: string };

export const NEW_ID_PATTERN = "^new:[a-z0-9]+(-[a-z0-9]+)*$";

/**Living characters*/
export const world_characters = (world: WorldRead) => [...world.characters()].filter((c) => !c.gone);
/**Existing locations*/
export const world_locations = (world: WorldRead) => [...world.locations()].filter((l) => !l.gone);

/**Schema of a change list, ids are limited to the existing ones and new: ids, so a model forced into it can not make up ids*/
export function world_change_schema(world: WorldRead, builder = false): Schema {
  const ref = (ids: string[]): Schema => {
    const pattern: SchemaString = { type: "string", pattern: NEW_ID_PATTERN };
    return ids.length ? { anyOf: [{ type: "string", enum: ids }, pattern] } : pattern;
  };
  const character = ref(world_characters(world).map((c) => c.id));
  const location = ref(world_locations(world).map((l) => l.id));
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
    location,
  };
  return {
    type: "array",
    items: {
      anyOf: [
        schema_object({ op: op("add_location"), id: new_id, name: text, description: text }),
        schema_object(
          builder
            ? { ...add_character, controller: { type: "string", enum: Object.values(Controller) } }
            : add_character,
        ),
        schema_object({
          op: op("update_character"),
          character,
          field: { type: "string", enum: CharacterFields },
          value: text,
        }),
        schema_object({ op: op("move_character"), character, location }),
        schema_object({ op: op("remove_character"), character }),
        schema_object({ op: op("add_memory"), character, memory: text }),
        schema_object({ op: op("set_relationship"), character, other: character, known_as: text, opinion: text }),
        schema_object({
          op: op("update_location"),
          location,
          field: { type: "string", enum: LocationFields },
          value: text,
        }),
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
  /**New values of the characters the changes touched or added*/
  characters: Character[];
  /**New values of the locations the changes touched or added*/
  locations: Location[];
  /**Memories added, in order*/
  memories: MemoryAdded[];
  /**New time, undefined when unchanged*/
  time: string | undefined;
}

/**A world with changes on top of another, only what the changes touch is copied*/
class WorldOverlay implements WorldRead {
  readonly #base: WorldRead;
  readonly touched_characters = new Map<Id, Character>();
  readonly touched_locations = new Map<Id, Location>();
  readonly memories_added: MemoryAdded[] = [];
  new_time: string | undefined;

  constructor(base: WorldRead) {
    this.#base = base;
  }
  get time() {
    return this.new_time ?? this.#base.time;
  }
  character(id: Id) {
    return this.touched_characters.get(id) ?? this.#base.character(id);
  }
  location(id: Id) {
    return this.touched_locations.get(id) ?? this.#base.location(id);
  }
  *characters() {
    for (const c of this.#base.characters()) yield this.touched_characters.get(c.id) ?? c;
    for (const c of this.touched_characters.values()) if (!this.#base.character(c.id)) yield c;
  }
  *locations() {
    for (const l of this.#base.locations()) yield this.touched_locations.get(l.id) ?? l;
    for (const l of this.touched_locations.values()) if (!this.#base.location(l.id)) yield l;
  }
  memories(character: Id): readonly string[] {
    const added = this.memories_added.filter((m) => m.character === character).map((m) => m.text);
    return added.length ? [...this.#base.memories(character), ...added] : this.#base.memories(character);
  }
  /**A copy of the character to change, copied the first time only*/
  edit_character(c: Character): Character {
    let copy = this.touched_characters.get(c.id);
    if (!copy) this.touched_characters.set(c.id, (copy = structuredClone(c)));
    return copy;
  }
  /**A copy of the location to change, copied the first time only*/
  edit_location(l: Location): Location {
    let copy = this.touched_locations.get(l.id);
    if (!copy) this.touched_locations.set(l.id, (copy = structuredClone(l)));
    return copy;
  }
}

const is_add = (c: Change) => c.op === "add_location" || c.op === "add_character";

/**Applies changes on top of the world, without changing or copying it, changes that do not fit are skipped and explained.
 * Additions are applied first, so other changes can refer to what they add by its temporary id.*/
export function world_apply(world: WorldRead, changes: readonly Change[]): WorldApplied {
  const next = new WorldOverlay(world);
  const problems: (string | undefined)[] = changes.map(() => undefined);
  const ids = new Map<string, Id>();
  const given = new Set<Id>();
  const taken = (id: string) => !!next.character(id) || !!next.location(id) || given.has(id);

  //Real ids first, so text in any change can be rewritten to them
  for (const change of changes)
    if (is_add(change) && change.id.startsWith("new:") && !ids.has(change.id)) {
      const id = id_make(change.op === "add_location" ? "loc" : "char", change.name, taken);
      ids.set(change.id, id);
      given.add(id);
    }
  const real = (id: string) => ids.get(id) ?? id;
  const text = (t: string) => mention_map(t, (shown, id) => ({ text: shown, id: real(id) }));

  const character = (id: Id) => {
    const c = next.character(real(id));
    if (!c) return fail(`there is no character ${id}`);
    if (c.gone) fail(`${id} is removed`);
    return c;
  };
  const location = (id: Id) => {
    const l = next.location(real(id));
    if (!l) return fail(`there is no location ${id}`);
    if (l.gone) fail(`${id} is removed`);
    return l;
  };

  const apply = (change: Change) => {
    switch (change.op) {
      case "add_location": {
        const id = ids.get(change.id);
        if (!id) return fail(`the id of a new location must start with new:, not ${change.id}`);
        if (next.location(id)) fail(`${change.id} is added twice`);
        next.touched_locations.set(id, { id, name: change.name, description: text(change.description), gone: false });
        return;
      }
      case "add_character": {
        const id = ids.get(change.id);
        if (!id) return fail(`the id of a new character must start with new:, not ${change.id}`);
        if (next.character(id)) fail(`${change.id} is added twice`);
        next.touched_characters.set(id, {
          id,
          name: change.name,
          description: text(change.description),
          appearance: text(change.appearance),
          bio: text(change.bio),
          personality: text(change.personality),
          goals: text(change.goals),
          location: location(change.location).id,
          relationships: {},
          controller: change.controller ?? Controller.Ai,
          gone: false,
        });
        return;
      }
      case "update_character":
        if (!CharacterFields.includes(change.field)) fail(`${change.field} is not a character field`);
        next.edit_character(character(change.character))[change.field] = text(change.value);
        return;
      case "move_character": {
        const to = location(change.location).id;
        next.edit_character(character(change.character)).location = to;
        return;
      }
      case "remove_character":
        next.edit_character(character(change.character)).gone = true;
        return;
      case "add_memory":
        next.memories_added.push({ character: character(change.character).id, text: text(change.memory) });
        return;
      case "set_relationship": {
        const c = character(change.character);
        const other = character(change.other);
        if (c.id === other.id) fail("a character can not have a relationship with itself");
        next.edit_character(c).relationships[other.id] = { known_as: change.known_as, opinion: text(change.opinion) };
        return;
      }
      case "update_location":
        if (!LocationFields.includes(change.field)) fail(`${change.field} is not a location field`);
        next.edit_location(location(change.location))[change.field] = text(change.value);
        return;
      case "remove_location": {
        const l = location(change.location);
        const here = [...next.characters()].filter((c) => !c.gone && c.location === l.id);
        if (here.length) fail(`${here.map((c) => c.name).join(", ")} ${here.length > 1 ? "are" : "is"} still at ${l.name}`);
        next.edit_location(l).gone = true;
        return;
      }
      case "set_time":
        next.new_time = change.time;
        return;
      default:
        fail(`unknown change ${(change as { op: string }).op}`);
    }
  };

  const order = [...changes.keys()].sort((a, b) => Number(is_add(changes[b])) - Number(is_add(changes[a])));
  //Locations before characters, a new character may stand in a new location
  order.sort((a, b) => Number(changes[b].op === "add_location") - Number(changes[a].op === "add_location"));
  for (const i of order) {
    try {
      apply(changes[i]);
    } catch (e) {
      problems[i] = e instanceof ChangeProblem ? e.message : String(e);
    }
  }
  return {
    world: next,
    problems,
    ids,
    characters: [...next.touched_characters.values()],
    locations: [...next.touched_locations.values()],
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

/**Readable one line summary of a change, for review*/
export function world_change_text(world: WorldRead, change: Change): string {
  const name = (id: string) => world.character(id)?.name ?? world.location(id)?.name ?? id;
  switch (change.op) {
    case "add_location":
      return `New location ${change.name}: ${change.description}`;
    case "add_character":
      return `New character ${change.name} at ${name(change.location)}: ${change.description}`;
    case "update_character":
      return `${name(change.character)}, ${change.field}: ${change.value}`;
    case "move_character":
      return `${name(change.character)} moves to ${name(change.location)}`;
    case "remove_character":
      return `${name(change.character)} leaves the story`;
    case "add_memory":
      return `${name(change.character)} remembers: ${change.memory}`;
    case "set_relationship":
      return `${name(change.character)} knows ${name(change.other)} as "${change.known_as}": ${change.opinion}`;
    case "update_location":
      return `${name(change.location)}, ${change.field}: ${change.value}`;
    case "remove_location":
      return `${name(change.location)} is removed`;
    case "set_time":
      return `Time: ${change.time}`;
    default:
      return JSON.stringify(change);
  }
}
