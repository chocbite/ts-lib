//The world of a game: one tree of nodes, the Global node with the definitions of attributes and skills, and the things,
//locations, characters and items, and the changes that update it.
//Changes are what the scribes, the game builder and the editors produce, applying them is the only way the world changes.
//The world is read through WorldRead, so a running game can serve it from its states without copying anything.
//See World tree and Attributes, skills and time in DESIGN.md.
import { id_code } from "#lib/ids";
import { mention_map } from "#lib/mention";
import { schema_object, type Schema, type SchemaString } from "#lib/schema";

export type Id = string;

export const Kind = {
  Location: "location",
  Character: "character",
  Item: "item",
  Global: "global",
  Group: "group",
  Attribute: "attribute",
  Skill: "skill",
} as const;
export type Kind = (typeof Kind)[keyof typeof Kind];
export const THING_KINDS = [Kind.Location, Kind.Character, Kind.Item] as const;
export type ThingKind = (typeof THING_KINDS)[number];

/**Prefix of the ids of each kind that can be added*/
const PREFIX = { location: "loc", character: "char", item: "item", attribute: "attr", skill: "skill" } as const;

/**Ids of the nodes every world has*/
export const GLOBAL = "global";
export const ATTRIBUTES = "group:attributes";
export const SKILLS = "group:skills";

export const Controller = { Player: "player", Ai: "ai" } as const;
export type Controller = (typeof Controller)[keyof typeof Controller];

export interface Relationship {
  /**The name this character knows the other by*/
  known_as: string;
  /**What this character thinks of the other*/
  opinion: string;
}

interface NodeBase {
  id: Id;
  name: string;
  /**What the node is in, empty at the top level and for removed nodes*/
  parent: Id;
  /**What is in the node, in order*/
  children: Id[];
  /**Removed from the story, kept so its id is never reused and old rounds still refer to it*/
  gone: boolean;
}

//       _______ _    _ _____ _   _  _____  _____
//      |__   __| |  | |_   _| \ | |/ ____|/ ____|
//         | |  | |__| | | | |  \| | |  __| (___
//         | |  |  __  | | | | . ` | | |_ |\___ \
//         | |  | |  | |_| |_| |\  | |__| |____) |
//         |_|  |_|  |_|_____|_| \_|\_____|_____/

export const AttributeType = { Number: "number", Text: "text", Bool: "bool" } as const;
export type AttributeType = (typeof AttributeType)[keyof typeof AttributeType];
export type Value = number | string | boolean;

/**An attribute value of a thing, of a global attribute, or of a local one defined on the thing itself*/
export interface AttributeValue {
  /**Id of the global attribute, or local:<slug> for a local one*/
  id: Id;
  value: Value;
  /**Definition of a local attribute*/
  local?: { name: string; type: AttributeType; unit: string };
}

/**A skill of a thing: a character's level, 0 to 100, or an item's bonus, -100 to 100*/
export interface SkillValue {
  skill: Id;
  value: number;
}

/**Something special a character can do, ids are local to the character*/
export interface Ability {
  id: Id;
  name: string;
  description: string;
}

/**A change of a number attribute or a skill that lasts until a time, the base value is left alone*/
export interface Effect {
  /**Local to the thing*/
  id: Id;
  /**Id of the attribute or skill it changes*/
  target: Id;
  amount: number;
  /**Time it ends, minutes since the start of day 1*/
  until: number;
  /**What causes it, like "potion"*/
  reason: string;
}

interface ThingBase extends NodeBase {
  description: string;
  attributes: AttributeValue[];
  /**Active effects, dropped when time passes their end*/
  effects: Effect[];
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
  skills: SkillValue[];
  abilities: Ability[];
  /**Experience gathered in total*/
  exp: number;
  level: number;
  /**Skill points not spent yet*/
  skill_points: number;
}

export interface Item extends ThingBase {
  kind: typeof Kind.Item;
  skills: SkillValue[];
}

export type Thing = Location | Character | Item;

//       _____ _      ____  ____          _
//      / ____| |    / __ \|  _ \   /\   | |
//     | |  __| |   | |  | | |_) | /  \  | |
//     | | |_ | |   | |  | |  _ < / /\ \ | |
//     | |__| | |___| |__| | |_) / ____ \| |____
//      \_____|______\____/|____/_/    \_\______|

export interface Settings {
  /**Minutes since the start of day 1*/
  time: number;
  /**Experience an award of each size is worth*/
  exp_small: number;
  exp_medium: number;
  exp_large: number;
  /**Experience to go from level 1 to 2*/
  level_exp: number;
  /**How many times more experience each next level needs*/
  level_growth: number;
  skill_points_per_level: number;
}

export const SETTINGS_DEFAULT: Settings = {
  time: 8 * 60,
  exp_small: 10,
  exp_medium: 30,
  exp_large: 100,
  level_exp: 100,
  level_growth: 1.5,
  skill_points_per_level: 5,
};
export type SettingsField = Exclude<keyof Settings, "time">;
export const SETTINGS_FIELDS = Object.keys(SETTINGS_DEFAULT).filter((k) => k !== "time") as SettingsField[];

export interface GlobalNode extends NodeBase {
  kind: typeof Kind.Global;
  settings: Settings;
  /**The last number given to an id, every new id takes the next one, see id_code*/
  counter: number;
}

/**A group of definitions under the Global node*/
export interface Group extends NodeBase {
  kind: typeof Kind.Group;
}

/**A global attribute, which things can have a value of*/
export interface AttributeDef extends NodeBase {
  kind: typeof Kind.Attribute;
  description: string;
  type: AttributeType;
  /**Unit of numbers, like cm*/
  unit: string;
  /**Kinds of thing that can have it*/
  kinds: ThingKind[];
}

export interface SkillDef extends NodeBase {
  kind: typeof Kind.Skill;
  description: string;
}

export type Definition = AttributeDef | SkillDef;
export type Node = Thing | GlobalNode | Group | Definition;

const is_thing = (n: Node | undefined): n is Thing => !!n && (THING_KINDS as readonly string[]).includes(n.kind);

/**Nodes every world has: the Global node and its groups*/
export function world_base_nodes(): Node[] {
  return [
    { id: GLOBAL, kind: Kind.Global, name: "Global", parent: "", children: [ATTRIBUTES, SKILLS], gone: false, settings: { ...SETTINGS_DEFAULT }, counter: 0 },
    { id: ATTRIBUTES, kind: Kind.Group, name: "Attributes", parent: GLOBAL, children: [], gone: false },
    { id: SKILLS, kind: Kind.Group, name: "Skills", parent: GLOBAL, children: [], gone: false },
  ];
}

/**Fields that can be changed with an update change, and the kinds that have them*/
export const FIELDS = {
  name: [Kind.Location, Kind.Character, Kind.Item],
  description: [Kind.Location, Kind.Character, Kind.Item],
  appearance: [Kind.Character],
  bio: [Kind.Character],
  personality: [Kind.Character],
  goals: [Kind.Character],
} as const satisfies { [field: string]: readonly ThingKind[] };
export type Field = keyof typeof FIELDS;
const FIELD_NAMES = Object.keys(FIELDS) as Field[];

//      _____  ______          _____
//     |  __ \|  ____|   /\   |  __ \
//     | |__) | |__     /  \  | |  | |
//     |  _  /|  __|   / /\ \ | |  | |
//     | | \ \| |____ / ____ \| |__| |
//     |_|  \_\______/_/    \_\_____/

/**Read access to a world, lookups by id, nothing is copied*/
export abstract class WorldRead {
  /**Things at the top level, in order, the Global node is not one of them*/
  abstract readonly roots: readonly Id[];
  abstract node(id: Id): Node | undefined;
  /**Every node, removed ones too*/
  abstract nodes(): Iterable<Node>;
  /**What the character witnessed or was told, oldest first*/
  abstract memories(character: Id): readonly string[];

  get settings(): Settings {
    const g = this.node(GLOBAL);
    return g?.kind === Kind.Global ? g.settings : SETTINGS_DEFAULT;
  }
  /**Minutes since the start of day 1*/
  get time(): number {
    return this.settings.time;
  }
  thing(id: Id): Thing | undefined {
    const n = this.node(id);
    return is_thing(n) ? n : undefined;
  }
  /**Every thing, removed ones too*/
  things(): Thing[] {
    return [...this.nodes()].filter(is_thing);
  }
  character(id: Id): Character | undefined {
    const n = this.node(id);
    return n?.kind === Kind.Character ? n : undefined;
  }
  location(id: Id): Location | undefined {
    const n = this.node(id);
    return n?.kind === Kind.Location ? n : undefined;
  }
  item(id: Id): Item | undefined {
    const n = this.node(id);
    return n?.kind === Kind.Item ? n : undefined;
  }
  attribute(id: Id): AttributeDef | undefined {
    const n = this.node(id);
    return n?.kind === Kind.Attribute ? n : undefined;
  }
  skill(id: Id): SkillDef | undefined {
    const n = this.node(id);
    return n?.kind === Kind.Skill ? n : undefined;
  }
  /**Global attributes in order*/
  attributes(): AttributeDef[] {
    return (this.node(ATTRIBUTES)?.children ?? []).flatMap((id) => this.attribute(id) ?? []);
  }
  /**Skills in order*/
  skills(): SkillDef[] {
    return (this.node(SKILLS)?.children ?? []).flatMap((id) => this.skill(id) ?? []);
  }
  /**Living characters*/
  characters(): Character[] {
    return this.things().filter((t): t is Character => t.kind === Kind.Character && !t.gone);
  }
  /**Existing locations*/
  locations(): Location[] {
    return this.things().filter((t): t is Location => t.kind === Kind.Location && !t.gone);
  }
  /**Things directly in the thing, or at the top level for an empty id*/
  inside(id: Id): Thing[] {
    const ids = id ? (this.thing(id)?.children ?? []) : this.roots;
    return ids.flatMap((c) => this.thing(c) ?? []);
  }
  /**Things the thing is in, nearest first*/
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
  roots: Id[] = [];
  readonly node_map = new Map<Id, Node>();
  readonly memory_map = new Map<Id, string[]>();
  constructor(nodes: readonly Node[] = world_base_nodes()) {
    super();
    for (const n of nodes) this.node_map.set(n.id, n);
  }
  node(id: Id) {
    return this.node_map.get(id);
  }
  nodes() {
    return this.node_map.values();
  }
  memories(character: Id): readonly string[] {
    return this.memory_map.get(character) ?? [];
  }
}

/**A world with only the Global node and its groups*/
export const world_empty = (): WorldRead => new WorldPlain();

/**A piece of story, said by the speaker or narrated when the speaker is empty*/
export interface Chunk {
  /**Character saying the text, empty for narration*/
  speaker: Id;
  text: string;
}

//       _____ _    _          _   _  _____ ______  _____
//      / ____| |  | |   /\   | \ | |/ ____|  ____|/ ____|
//     | |    | |__| |  /  \  |  \| | |  __| |__  | (___
//     | |    |  __  | / /\ \ | . ` | | |_ |  __|  \___ \
//     | |____| |  | |/ ____ \| |\  | |__| | |____ ____) |
//      \_____|_|  |_/_/    \_\_| \_|\_____|______|_____/

export const ExpAward = { Small: "small", Medium: "medium", Large: "large" } as const;
export type ExpAward = (typeof ExpAward)[keyof typeof ExpAward];
export const TimeUnit = { Minutes: "minutes", Hours: "hours", Days: "days" } as const;
export type TimeUnit = (typeof TimeUnit)[keyof typeof TimeUnit];
const MINUTES = { minutes: 1, hours: 60, days: 24 * 60 } as const satisfies { [U in TimeUnit]: number };

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
  /**Puts the thing in another, at the end, or at the index when given (only by hand).
   * Definitions can only be moved inside their group.*/
  | { op: "move"; thing: Id; in: Id; index?: number }
  /**Removes a thing with nothing in it*/
  | { op: "remove"; thing: Id }
  | { op: "add_memory"; character: Id; memory: string }
  | { op: "set_relationship"; character: Id; other: Id; known_as: string; opinion: string }
  //Definitions
  | { op: "define_attribute"; id: string; name: string; description: string; type: AttributeType; unit: string; kinds: ThingKind[] }
  | { op: "define_skill"; id: string; name: string; description: string }
  /**Only by hand*/
  | { op: "update_definition"; definition: Id; field: "name" | "description" | "unit"; value: string }
  /**Only by hand, while nothing uses it*/
  | { op: "update_definition"; definition: Id; field: "type"; value: AttributeType }
  /**Only by hand*/
  | { op: "update_definition"; definition: Id; field: "kinds"; value: ThingKind[] }
  /**Only by hand, while nothing uses it*/
  | { op: "remove_definition"; definition: Id }
  //Values on things
  | { op: "set_attribute"; thing: Id; attribute: Id; value: Value }
  | { op: "add_to_attribute"; thing: Id; attribute: Id; amount: number }
  /**Sets an attribute only this thing has: the one with the id when given (renaming it), else the one with the name, else a new one*/
  | { op: "set_local_attribute"; thing: Id; name: string; type: AttributeType; unit: string; value: Value; attribute?: Id }
  | { op: "remove_attribute"; thing: Id; attribute: Id }
  | { op: "set_skill"; thing: Id; skill: Id; value: number }
  | { op: "remove_skill"; thing: Id; skill: Id }
  | { op: "add_ability"; character: Id; name: string; description: string }
  /**Only by hand*/
  | { op: "update_ability"; character: Id; ability: Id; field: "name" | "description"; value: string }
  | { op: "remove_ability"; character: Id; ability: Id }
  | { op: "award_exp"; character: Id; amount: ExpAward; reason: string }
  /**Raises a skill of a character with its unspent skill points*/
  | { op: "spend_skill_points"; character: Id; skill: Id; points: number }
  /**A change of a number attribute or skill that ends after the duration*/
  | { op: "add_effect"; thing: Id; target: Id; amount: number; duration: number; unit: TimeUnit; reason: string }
  | { op: "remove_effect"; thing: Id; effect: Id }
  //Time and settings
  | { op: "set_time"; day: number; hour: number; minute: number }
  | { op: "pass_time"; amount: number; unit: TimeUnit }
  /**Only by hand*/
  | { op: "update_settings"; field: SettingsField; value: number };

export const NEW_ID_PATTERN = "^new:[a-z0-9]+(-[a-z0-9]+)*$";

/**Who a change schema is for, each gets the changes it may make*/
export const SchemaFor = {
  Builder: "builder",
  /**New things, and changes to things outside the characters of the scene*/
  ScribeWorld: "scribe_world",
  /**Changes to one character and what it carries, see world_change_schema*/
  ScribeCharacter: "scribe_character",
} as const;
export type SchemaFor = (typeof SchemaFor)[keyof typeof SchemaFor];

/**Schema of a change list, ids are limited to the existing ones and new: ids, so a model forced into it can not make up ids
 * @param self the character a character scribe is for*/
export function world_change_schema(world: WorldRead, role: SchemaFor, self?: Id): Schema {
  const ref = (ids: string[], allow_new = true): Schema => {
    const pattern: SchemaString = { type: "string", pattern: NEW_ID_PATTERN };
    if (!allow_new) return { type: "string", enum: ids.length ? ids : [""] };
    return ids.length ? { anyOf: [{ type: "string", enum: ids }, pattern] } : pattern;
  };
  const living = world.things().filter((t) => !t.gone);
  const all_things = ref(living.map((t) => t.id));
  const text: Schema = { type: "string" };
  const number: Schema = { type: "number" };
  const value: Schema = { anyOf: [number, text, { type: "boolean" }] };
  const type: Schema = { type: "string", enum: Object.values(AttributeType) };
  const op = (name: string): Schema => ({ type: "string", enum: [name] });
  const new_id: Schema = { type: "string", pattern: NEW_ID_PATTERN };
  const attribute = ref(world.attributes().map((a) => a.id));
  const skill = ref(world.skills().map((s) => s.id));
  const unit: Schema = { type: "string", enum: Object.values(TimeUnit) };
  const add_location = schema_object({ op: op("add_location"), id: new_id, name: text, description: text, in: ref(["", ...world.locations().map((l) => l.id)]) });
  const add_character = {
    op: op("add_character"),
    id: new_id,
    name: text,
    description: text,
    appearance: text,
    bio: text,
    personality: text,
    goals: text,
    in: all_things,
  };
  const add_item = schema_object({ op: op("add_item"), id: new_id, name: text, description: text, in: all_things });
  const define_skill = schema_object({ op: op("define_skill"), id: new_id, name: text, description: text });
  /**Changes of attributes and effects of the things
   * @param has ids of the attributes the things have, the only ones that can be removed*/
  const values = (things: Schema, has: string[]) => [
    schema_object({ op: op("set_attribute"), thing: things, attribute, value }),
    schema_object({ op: op("add_to_attribute"), thing: things, attribute, amount: number }),
    schema_object({ op: op("set_local_attribute"), thing: things, name: text, type, unit: text, value }),
    schema_object({ op: op("remove_attribute"), thing: things, attribute: ref([...new Set(has)], false) }),
    schema_object({ op: op("add_effect"), thing: things, target: text, amount: number, duration: number, unit, reason: text }),
  ];

  if (role === SchemaFor.Builder) {
    const character = ref(world.characters().map((c) => c.id));
    return {
      type: "array",
      items: {
        anyOf: [
          add_location,
          schema_object({ ...add_character, controller: { type: "string", enum: Object.values(Controller) } }),
          add_item,
          schema_object({ op: op("set_relationship"), character, other: character, known_as: text, opinion: text }),
          schema_object({
            op: op("define_attribute"),
            id: new_id,
            name: text,
            description: text,
            type,
            unit: text,
            kinds: { type: "array", items: { type: "string", enum: THING_KINDS } },
          }),
          define_skill,
          schema_object({ op: op("set_attribute"), thing: all_things, attribute, value }),
          schema_object({ op: op("set_local_attribute"), thing: all_things, name: text, type, unit: text, value }),
          schema_object({ op: op("set_skill"), thing: all_things, skill, value: number }),
          schema_object({ op: op("add_ability"), character, name: text, description: text }),
          schema_object({ op: op("set_time"), day: number, hour: number, minute: number }),
        ],
      },
    };
  }

  if (role === SchemaFor.ScribeWorld) {
    //Everything but the characters themselves, those are for their own scribes
    const not_characters = ref(living.filter((t) => t.kind !== Kind.Character).map((t) => t.id));
    return {
      type: "array",
      items: {
        anyOf: [
          add_location,
          schema_object(add_character),
          add_item,
          schema_object({ op: op("update"), thing: not_characters, field: { type: "string", enum: ["name", "description"] }, value: text }),
          schema_object({ op: op("move"), thing: not_characters, in: ref(["", ...living.map((t) => t.id)]) }),
          schema_object({ op: op("remove"), thing: not_characters }),
          define_skill,
          schema_object({ op: op("set_skill"), thing: ref(living.filter((t) => t.kind === Kind.Item).map((t) => t.id)), skill, value: number }),
          ...values(
            not_characters,
            living.filter((t) => t.kind !== Kind.Character).flatMap((t) => t.attributes.map((v) => v.id)),
          ),
        ],
      },
    };
  }

  //A character scribe changes its character and what it carries, and moves what it sees
  const me = self ? world.character(self) : undefined;
  const own = me ? [me.id, ...world_subtree(world, me.id).filter((t) => !t.gone).map((t) => t.id)] : [];
  const seen = me ? world_visible(world, me.id).map((t) => t.id) : [];
  const just_me = ref(me ? [me.id] : [], false);
  const others = ref(world.characters().filter((c) => c.id !== me?.id).map((c) => c.id));
  return {
    type: "array",
    items: {
      anyOf: [
        schema_object({ op: op("add_memory"), character: just_me, memory: text }),
        schema_object({ op: op("set_relationship"), character: just_me, other: others, known_as: text, opinion: text }),
        schema_object({ op: op("update"), thing: just_me, field: { type: "string", enum: FIELD_NAMES }, value: text }),
        schema_object({ op: op("move"), thing: ref([...own, ...seen]), in: ref(["", ...living.map((t) => t.id)]) }),
        schema_object({ op: op("remove"), thing: ref(own.filter((id) => id !== me?.id)) }),
        schema_object({ op: op("award_exp"), character: just_me, amount: { type: "string", enum: Object.values(ExpAward) }, reason: text }),
        schema_object({ op: op("add_ability"), character: just_me, name: text, description: text }),
        schema_object({ op: op("remove_ability"), character: just_me, ability: text }),
        ...values(
          ref(own),
          own.flatMap((id) => world.thing(id)?.attributes.map((v) => v.id) ?? []),
        ),
      ],
    },
  };
}

//                _____  _____  _  __     __
//          /\   |  __ \|  __ \| | \ \   / /
//         /  \  | |__) | |__) | |  \ \_/ /
//        / /\ \ |  ___/|  ___/| |   \   /
//       / ____ \| |    | |    | |____| |
//      /_/    \_\_|    |_|    |______|_|

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
  /**New values of the nodes the changes touched or added*/
  nodes: Node[];
  /**New top level, undefined when unchanged*/
  roots: Id[] | undefined;
  /**Memories added, in order*/
  memories: MemoryAdded[];
}

/**A world with changes on top of another, only what the changes touch is copied*/
class WorldOverlay extends WorldRead {
  readonly #base: WorldRead;
  readonly touched = new Map<Id, Node>();
  readonly memories_added: MemoryAdded[] = [];
  new_roots: Id[] | undefined;

  constructor(base: WorldRead) {
    super();
    this.#base = base;
  }
  get roots() {
    return this.new_roots ?? this.#base.roots;
  }
  node(id: Id) {
    return this.touched.get(id) ?? this.#base.node(id);
  }
  *nodes() {
    for (const n of this.#base.nodes()) yield this.touched.get(n.id) ?? n;
    for (const n of this.touched.values()) if (!this.#base.node(n.id)) yield n;
  }
  memories(character: Id): readonly string[] {
    const added = this.memories_added.filter((m) => m.character === character).map((m) => m.text);
    return added.length ? [...this.#base.memories(character), ...added] : this.#base.memories(character);
  }
  /**A copy of the node to change, copied the first time only*/
  edit<T extends Node>(n: T): T {
    let copy = this.touched.get(n.id) as T | undefined;
    if (!copy) this.touched.set(n.id, (copy = structuredClone(n)));
    return copy;
  }
  /**The children of the parent to change, the top level for an empty id*/
  edit_children(parent: Id): Id[] {
    if (!parent) return (this.new_roots ??= [...this.#base.roots]);
    return this.edit(this.node(parent)!).children;
  }
}

const ADDS = ["add_location", "add_character", "add_item", "define_attribute", "define_skill"] as const;
type Add = Extract<Change, { op: (typeof ADDS)[number] }>;
type AddThing = Extract<Change, { op: "add_location" | "add_character" | "add_item" }>;
/**The kind with its article, "an item"*/
const a = (kind: Kind) => (kind === Kind.Item || kind === Kind.Attribute ? "an " : "a ") + kind;
const is_add = (c: Change): c is Add => (ADDS as readonly string[]).includes(c.op);
const kind_of = (c: Add): keyof typeof PREFIX =>
  ({ add_location: Kind.Location, add_character: Kind.Character, add_item: Kind.Item, define_attribute: Kind.Attribute, define_skill: Kind.Skill })[c.op];
/**Where an addition goes, definitions go in their group*/
const target_of = (c: Add) => (c.op === "define_attribute" ? ATTRIBUTES : c.op === "define_skill" ? SKILLS : c.in);

/**Total experience needed to reach the level*/
export function world_level_exp(settings: Settings, level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += Math.round(settings.level_exp * settings.level_growth ** (l - 1));
  return total;
}

/**Time as day and clock, "Day 3, 14:20"*/
export function world_time_text(minutes: number): string {
  const day = Math.floor(minutes / MINUTES.days) + 1;
  const rest = ((minutes % MINUTES.days) + MINUTES.days) % MINUTES.days;
  return `Day ${day}, ${String(Math.floor(rest / 60)).padStart(2, "0")}:${String(rest % 60).padStart(2, "0")}`;
}

/**Checks that the value fits the attribute type*/
function check_value(type: AttributeType, value: Value, name: string) {
  const expected = { number: "number", text: "string", bool: "boolean" }[type];
  if (typeof value !== expected || (typeof value === "number" && !Number.isFinite(value)))
    fail(`${name} takes ${{ number: "a number", text: "text", bool: "yes or no" }[type]}, not ${JSON.stringify(value)}`);
}

/**Applies changes on top of the world, without changing or copying it, changes that do not fit are skipped and explained.
 * Additions are applied first, each once what it goes in exists, so other changes can refer to them by their temporary id.*/
export function world_apply(world: WorldRead, changes: readonly Change[]): WorldApplied {
  const next = new WorldOverlay(world);
  const problems: (string | undefined)[] = changes.map(() => undefined);
  const ids = new Map<string, Id>();
  /**A new id from the counter of the Global node, never given before, removed things included*/
  const new_id = (prefix: string) => {
    const global = next.edit(next.node(GLOBAL) as GlobalNode);
    return `${prefix}:${id_code(++global.counter)}`;
  };

  //Real ids first, so text in any change can be rewritten to them
  for (const change of changes)
    if (is_add(change) && change.id.startsWith("new:") && !ids.has(change.id)) ids.set(change.id, new_id(PREFIX[kind_of(change)]));
  const real = (id: string) => ids.get(id) ?? id;
  const text = (t: string) => mention_map(t, (shown, id) => ({ text: shown, id: real(id) }));

  const node = (id: Id): Node => {
    const n = next.node(real(id));
    if (!n) return fail(`there is nothing with the id ${id}`);
    if (n.gone) fail(`${id} is removed`);
    return n;
  };
  const thing = (id: Id): Thing => {
    const n = node(id);
    if (!is_thing(n)) fail(`${id} is not a location, character or item`);
    return n;
  };
  const character = (id: Id) => {
    const t = thing(id);
    if (t.kind !== Kind.Character) fail(`${id} is not a character`);
    return t;
  };
  const attribute = (id: Id) => {
    const n = node(id);
    if (n.kind !== Kind.Attribute) fail(`${id} is not an attribute`);
    return n;
  };
  const skill = (id: Id) => {
    const n = node(id);
    if (n.kind !== Kind.Skill) fail(`${id} is not a skill`);
    return n;
  };
  const edit_settings = () => next.edit(next.node(GLOBAL) as GlobalNode).settings;

  /**Puts the thing in the target, checking it can go there, it must be out of any parent*/
  const put = (t: Thing, target: Id, index?: number) => {
    const into = target ? thing(target) : undefined;
    if (t.kind === Kind.Location) {
      if (into && into.kind !== Kind.Location) fail(`a location can only be in a location, not in ${into.id}`);
    } else if (!into) fail(`${a(t.kind)} must be in something`);
    if (into && (into.id === t.id || next.path(into.id).some((p) => p.id === t.id))) fail(`${t.id} can not go inside itself`);
    insert(next.edit_children(into?.id ?? ""), t.id, index);
    next.edit(t).parent = into?.id ?? "";
  };
  const insert = (children: Id[], id: Id, index?: number) =>
    children.splice(index === undefined ? children.length : Math.max(0, Math.min(index, children.length)), 0, id);
  /**Takes the node out of its parent*/
  const take_out = (n: Node) => {
    const children = next.edit_children(n.parent);
    const i = children.indexOf(n.id);
    if (i >= 0) children.splice(i, 1);
    next.edit(n).parent = "";
  };

  const add_thing = (change: AddThing, id: Id) => {
    const base = { id, name: change.name, description: text(change.description), parent: "", children: [], gone: false, attributes: [], effects: [] };
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
            skills: [],
            abilities: [],
            exp: 0,
            level: 1,
            skill_points: 0,
          }
        : change.op === "add_item"
          ? { ...base, kind: Kind.Item, skills: [] }
          : { ...base, kind: Kind.Location };
    //Checked before it is added, so a failure leaves nothing behind
    const target = change.in ? thing(change.in) : undefined;
    if (t.kind !== Kind.Location && !target) fail(`${a(t.kind)} must be in something`);
    if (t.kind === Kind.Location && target && target.kind !== Kind.Location) fail(`a location can only be in a location, not in ${target.id}`);
    next.touched.set(id, t);
    put(t, change.in ? real(change.in) : "");
  };

  const add = (change: Add) => {
    const id = ids.get(change.id);
    if (!id) return fail(`the id of a new ${kind_of(change)} must start with new:, not ${change.id}`);
    if (next.node(id)) fail(`${change.id} is added twice`);
    if (change.op !== "define_attribute" && change.op !== "define_skill") return add_thing(change, id);
    const base = { id, name: change.name, description: text(change.description), parent: target_of(change), children: [], gone: false };
    const def: Definition =
      change.op === "define_skill"
        ? { ...base, kind: Kind.Skill }
        : { ...base, kind: Kind.Attribute, type: change.type, unit: change.unit, kinds: change.kinds.filter((k) => (THING_KINDS as readonly string[]).includes(k)) };
    if (def.kind === Kind.Attribute && !Object.values(AttributeType).includes(def.type)) fail(`${def.type} is not an attribute type`);
    next.touched.set(id, def);
    insert(next.edit_children(def.parent), id);
  };

  /**Whether any thing has a value of the definition*/
  const used = (def: Definition) =>
    next.things().some((t) => (def.kind === Kind.Attribute ? t.attributes.some((v) => v.id === def.id) : "skills" in t && t.skills.some((s) => s.skill === def.id)));

  const apply = (change: Change) => {
    switch (change.op) {
      case "add_location":
      case "add_character":
      case "add_item":
      case "define_attribute":
      case "define_skill":
        return add(change);
      case "update": {
        const t = thing(change.thing);
        const kinds: readonly ThingKind[] | undefined = FIELDS[change.field];
        if (!kinds) fail(`${change.field} is not a field`);
        if (!kinds.includes(t.kind)) fail(`${a(t.kind)} has no ${change.field}`);
        (next.edit(t) as unknown as { [field: string]: string })[change.field] = text(change.value);
        return;
      }
      case "move": {
        const n = node(change.thing);
        const target = real(change.in);
        //Definitions are only reordered inside their group
        if (n.kind === Kind.Attribute || n.kind === Kind.Skill) {
          if (target !== n.parent) fail(`${a(n.kind)} stays in its group`);
          const children = next.edit_children(n.parent);
          children.splice(children.indexOf(n.id), 1);
          insert(children, n.id, change.index);
          return;
        }
        if (!is_thing(n)) fail(`${n.name} can not be moved`);
        const t = n;
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
      case "update_definition": {
        const n = node(change.definition);
        if (n.kind !== Kind.Attribute && n.kind !== Kind.Skill) fail(`${change.definition} is not an attribute or skill`);
        const def = n;
        if (change.field === "name" || change.field === "description") {
          next.edit(def)[change.field] = change.field === "name" ? change.value : text(change.value);
          return;
        }
        if (def.kind !== Kind.Attribute) fail(`a skill has no ${change.field}`);
        const attr = def;
        if (change.field === "type") {
          if (!Object.values(AttributeType).includes(change.value)) fail(`${change.value} is not an attribute type`);
          if (change.value !== attr.type && used(attr)) fail(`things have values of ${attr.name}, its type can not change`);
          next.edit(attr).type = change.value;
        } else if (change.field === "kinds") {
          const kinds = change.value.filter((k) => (THING_KINDS as readonly string[]).includes(k));
          const holders = next.things().filter((t) => !kinds.includes(t.kind) && t.attributes.some((v) => v.id === attr.id));
          if (holders.length) fail(`${holders.map((t) => t.name).join(", ")} ${holders.length > 1 ? "have" : "has"} ${attr.name}`);
          next.edit(attr).kinds = kinds;
        } else next.edit(attr).unit = change.value;
        return;
      }
      case "remove_definition": {
        const n = node(change.definition);
        if (n.kind !== Kind.Attribute && n.kind !== Kind.Skill) fail(`${change.definition} is not an attribute or skill`);
        const def = n;
        if (used(def)) fail(`${def.name} is still used`);
        take_out(def);
        next.edit(next.node(def.id)!).gone = true;
        return;
      }
      case "set_attribute": {
        const t = thing(change.thing);
        const attr = attribute(change.attribute);
        if (!attr.kinds.includes(t.kind)) fail(`${a(t.kind)} has no ${attr.name}`);
        check_value(attr.type, change.value, attr.name);
        const values = next.edit(t).attributes;
        const existing = values.find((v) => v.id === attr.id);
        if (existing) existing.value = change.value;
        else values.push({ id: attr.id, value: change.value });
        return;
      }
      case "add_to_attribute": {
        const t = thing(change.thing);
        const v = t.attributes.find((v) => v.id === real(change.attribute));
        if (!v) return fail(`${t.name} has no value of ${change.attribute}`);
        const type = v.local?.type ?? attribute(v.id).type;
        if (type !== AttributeType.Number || typeof v.value !== "number") fail(`${change.attribute} is not a number`);
        if (!Number.isFinite(change.amount)) fail(`${change.amount} is not a number`);
        next.edit(t).attributes.find((e) => e.id === v.id)!.value = (v.value) + change.amount;
        return;
      }
      case "set_local_attribute": {
        const t = thing(change.thing);
        if (!Object.values(AttributeType).includes(change.type)) fail(`${change.type} is not an attribute type`);
        check_value(change.type, change.value, change.name);
        if (!change.name.trim()) fail("a local attribute needs a name");
        const values = next.edit(t).attributes;
        const same_name = (v: AttributeValue) => v.local?.name.trim().toLowerCase() === change.name.trim().toLowerCase();
        const i = change.attribute ? values.findIndex((v) => v.id === change.attribute && v.local) : values.findIndex(same_name);
        if (change.attribute && i < 0) fail(`${t.name} has no local attribute ${change.attribute}`);
        //Two local attributes of one thing never share a name, the name is how the scribes find them
        if (values.some((v, j) => j !== i && same_name(v))) fail(`${t.name} already has ${change.name}`);
        const local = { name: change.name, type: change.type, unit: change.unit };
        if (i >= 0) values[i] = { id: values[i].id, value: change.value, local };
        else values.push({ id: new_id("local"), value: change.value, local });
        return;
      }
      case "remove_attribute": {
        const t = thing(change.thing);
        const i = t.attributes.findIndex((v) => v.id === real(change.attribute));
        if (i < 0) fail(`${t.name} has no ${change.attribute}`);
        next.edit(t).attributes.splice(i, 1);
        return;
      }
      case "set_skill": {
        const t = thing(change.thing);
        const s = skill(change.skill);
        if (t.kind === Kind.Location) fail("a location has no skills");
        const [min, max] = t.kind === Kind.Character ? [0, 100] : [-100, 100];
        if (!Number.isFinite(change.value) || change.value < min || change.value > max) fail(`${s.name} of ${a(t.kind)} is ${min} to ${max}, not ${change.value}`);
        const skills = next.edit<Character | Item>(t).skills;
        const existing = skills.find((v) => v.skill === s.id);
        if (existing) existing.value = Math.round(change.value);
        else skills.push({ skill: s.id, value: Math.round(change.value) });
        return;
      }
      case "remove_skill": {
        const t = thing(change.thing);
        if (t.kind === Kind.Location) fail("a location has no skills");
        const i = t.skills.findIndex((v) => v.skill === real(change.skill));
        if (i < 0) fail(`${t.name} has no ${change.skill}`);
        next.edit<Character | Item>(t).skills.splice(i, 1);
        return;
      }
      case "add_ability": {
        const c = character(change.character);
        const abilities = next.edit(c).abilities;
        abilities.push({ id: new_id("ability"), name: change.name, description: text(change.description) });
        return;
      }
      case "update_ability": {
        const c = character(change.character);
        const ability = next.edit(c).abilities.find((x) => x.id === change.ability);
        if (!ability) return fail(`${c.name} has no ability ${change.ability}`);
        ability[change.field] = change.field === "name" ? change.value : text(change.value);
        return;
      }
      case "remove_ability": {
        const c = character(change.character);
        const i = c.abilities.findIndex((x) => x.id === change.ability);
        if (i < 0) fail(`${c.name} has no ability ${change.ability}`);
        next.edit(c).abilities.splice(i, 1);
        return;
      }
      case "award_exp": {
        const c = character(change.character);
        const settings = next.settings;
        const amount = { small: settings.exp_small, medium: settings.exp_medium, large: settings.exp_large }[change.amount];
        if (amount === undefined) fail(`${change.amount} is not an award size`);
        const edited = next.edit(c);
        edited.exp += amount;
        //Levels up as long as the experience reaches the next level, each level gives skill points
        while (edited.exp >= world_level_exp(settings, edited.level + 1) && edited.level < 1000) {
          edited.level++;
          edited.skill_points += settings.skill_points_per_level;
        }
        return;
      }
      case "spend_skill_points": {
        const c = character(change.character);
        const s = skill(change.skill);
        if (!Number.isInteger(change.points) || change.points < 1) fail(`${change.points} is not a number of points to spend`);
        if (change.points > c.skill_points) fail(`${c.name} has only ${c.skill_points} skill points`);
        const edited = next.edit(c);
        const existing = edited.skills.find((v) => v.skill === s.id);
        if ((existing?.value ?? 0) + change.points > 100) fail(`${s.name} can not go over 100`);
        if (existing) existing.value += change.points;
        else edited.skills.push({ skill: s.id, value: change.points });
        edited.skill_points -= change.points;
        return;
      }
      case "add_effect": {
        const t = thing(change.thing);
        const target = real(change.target);
        const local = t.attributes.find((v) => v.id === target)?.local;
        const def = next.node(target);
        if (local ? local.type !== AttributeType.Number : !(def?.kind === Kind.Skill || (def?.kind === Kind.Attribute && def.type === AttributeType.Number)))
          fail(`${change.target} is not a number attribute or skill`);
        if (!Number.isFinite(change.amount) || change.amount === 0) fail(`an effect of ${change.amount} changes nothing`);
        const minutes = MINUTES[change.unit];
        if (!minutes || !Number.isFinite(change.duration) || change.duration <= 0) fail(`an effect can not last ${change.duration} ${change.unit}`);
        const effects = next.edit(t).effects;
        effects.push({ id: new_id("effect"), target, amount: change.amount, until: next.time + Math.round(change.duration * minutes), reason: change.reason });
        return;
      }
      case "remove_effect": {
        const t = thing(change.thing);
        const i = t.effects.findIndex((e) => e.id === change.effect);
        if (i < 0) fail(`${t.name} has no effect ${change.effect}`);
        next.edit(t).effects.splice(i, 1);
        return;
      }
      case "set_time": {
        const parts = [change.day, change.hour, change.minute];
        if (parts.some((p) => !Number.isInteger(p) || p < 0) || change.day < 1 || change.hour > 23 || change.minute > 59)
          fail(`day ${change.day} ${change.hour}:${change.minute} is not a time`);
        edit_settings().time = (change.day - 1) * MINUTES.days + change.hour * 60 + change.minute;
        return;
      }
      case "pass_time": {
        const minutes = MINUTES[change.unit];
        if (!minutes) fail(`${change.unit} is not a unit of time`);
        if (!Number.isFinite(change.amount) || change.amount < 0) fail(`time can not pass by ${change.amount}`);
        edit_settings().time += Math.round(change.amount * minutes);
        return;
      }
      case "update_settings": {
        if (!SETTINGS_FIELDS.includes(change.field)) fail(`${change.field} is not a setting`);
        if (!Number.isFinite(change.value) || change.value < 0) fail(`${change.field} can not be ${change.value}`);
        if (change.field === "level_growth" && change.value < 1) fail("each level needs at least as much as the one before");
        edit_settings()[change.field] = change.value;
        return;
      }
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
      const target_id = target_of(changes[i] as Add);
      const target = real(target_id);
      if (target && !next.node(target) && ids.has(target_id)) return true;
      progress = true;
      run(i);
      return false;
    });
  }
  for (const i of waiting) problems[i] = `${target_of(changes[i] as Add)} is never added`;
  for (const i of changes.keys()) if (!is_add(changes[i])) run(i);
  //Effects whose time has passed are dropped, when the time changed
  if (next.time !== world.time)
    for (const t of next.things())
      if (t.effects.some((e) => e.until <= next.time)) next.edit(t).effects = t.effects.filter((e) => e.until > next.time);

  return {
    world: next,
    problems,
    ids,
    nodes: [...next.touched.values()],
    roots: next.new_roots,
    memories: next.memories_added,
  };
}

/**Why a change can not be applied*/
class ChangeProblem extends Error {}
function fail(problem: string): never {
  throw new ChangeProblem(problem);
}

//      _    _ ______ _      _____  ______ _____   _____
//     | |  | |  ____| |    |  __ \|  ____|  __ \ / ____|
//     | |__| | |__  | |    | |__) | |__  | |__) | (___
//     |  __  |  __| | |    |  ___/|  __| |  _  / \___ \
//     | |  | | |____| |____| |    | |____| | \ \ ____) |
//     |_|  |_|______|______|_|    |______|_|  \_\_____/

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

/**Effects on a target, as text, "+5 from potion for 40 min"*/
function effect_texts(world: WorldRead, thing: Thing, target: Id): string[] {
  return thing.effects
    .filter((e) => e.target === target)
    .map((e) => `${e.amount >= 0 ? "+" : ""}${e.amount} from ${e.reason || "an effect"} for ${duration_text(e.until - world.time)}`);
}

/**A duration in minutes as text, "40 min", "3 h", "2 days"*/
export function world_duration_text(minutes: number): string {
  if (minutes < 60) return `${Math.max(0, Math.round(minutes))} min`;
  if (minutes < MINUTES.days) return `${Math.round(minutes / 60)} h`;
  const days = Math.round(minutes / MINUTES.days);
  return `${days} day${days === 1 ? "" : "s"}`;
}
const duration_text = world_duration_text;

/**Sum of the active effects on a target*/
const effect_sum = (thing: Thing, target: Id) => thing.effects.filter((e) => e.target === target).reduce((sum, e) => sum + e.amount, 0);

/**Name, value and unit of each attribute of the thing, effects added to the value, "Height: 185 cm (180, +5 from potion for 40 min)"*/
export function world_attribute_texts(world: WorldRead, thing: Thing): string[] {
  return thing.attributes.map((v) => {
    const def = v.local ?? world.attribute(v.id);
    const unit = def?.unit ? " " + def.unit : "";
    if (typeof v.value === "number") {
      const effects = effect_texts(world, thing, v.id);
      const total = v.value + effect_sum(thing, v.id);
      return `${def?.name ?? v.id}: ${total}${unit}${effects.length ? ` (${v.value}, ${effects.join(", ")})` : ""}`;
    }
    const value = typeof v.value === "boolean" ? (v.value ? "yes" : "no") : v.value;
    return `${def?.name ?? v.id}: ${value}${unit}`;
  });
}

/**Items directly inside a character, the ones that count for its skills*/
const held = (world: WorldRead, thing: Thing) =>
  thing.kind === Kind.Character ? world.inside(thing.id).filter((t): t is Item => t.kind === Kind.Item && !t.gone) : [];

/**Total of a skill of a character: its level, the bonuses of the items directly inside it and the active effects*/
export function world_skill_total(world: WorldRead, character: Character, skill: Id): number {
  const own = character.skills.find((s) => s.skill === skill)?.value ?? 0;
  const items = held(world, character).reduce((sum, i) => sum + (i.skills.find((s) => s.skill === skill)?.value ?? 0), 0);
  return own + items + effect_sum(character, skill);
}

/**Skills of a character, with the bonuses of the items directly inside it and effects, "Climbing 50 (40, +10 from Rope)",
 * or the skill bonuses of an item*/
export function world_skill_texts(world: WorldRead, thing: Character | Item): string[] {
  if (thing.kind === Kind.Item) return thing.skills.map((s) => `${world.skill(s.skill)?.name ?? s.skill} ${s.value >= 0 ? "+" : ""}${s.value}`);
  const items = held(world, thing);
  const ids = [...new Set([...thing.skills.map((s) => s.skill), ...items.flatMap((i) => i.skills.map((s) => s.skill)), ...thing.effects.map((e) => e.target)])].filter(
    (id) => world.skill(id),
  );
  return ids.map((id) => {
    const own = thing.skills.find((s) => s.skill === id)?.value ?? 0;
    const extra = [
      ...items.flatMap((i) => i.skills.filter((s) => s.skill === id).map((s) => `${s.value >= 0 ? "+" : ""}${s.value} from ${i.name}`)),
      ...effect_texts(world, thing, id),
    ];
    return `${world.skill(id)!.name} ${world_skill_total(world, thing, id)}${extra.length ? ` (${own}, ${extra.join(", ")})` : ""}`;
  });
}

/**Readable one line summary of a change, for review*/
export function world_change_text(world: WorldRead, change: Change): string {
  const name = (id: string) => (id ? (world.node(id)?.name ?? id) : "the top level");
  switch (change.op) {
    case "add_location":
    case "add_character":
    case "add_item":
      return `New ${kind_of(change)} ${change.name} in ${name(change.in)}: ${change.description}`;
    case "define_attribute":
      return `New attribute ${change.name} (${change.type}${change.unit ? ", " + change.unit : ""}): ${change.description}`;
    case "define_skill":
      return `New skill ${change.name}: ${change.description}`;
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
    case "update_definition":
      return `${name(change.definition)}, ${change.field}: ${JSON.stringify(change.value)}`;
    case "remove_definition":
      return `${name(change.definition)} is removed`;
    case "set_attribute":
      return `${name(change.thing)}, ${name(change.attribute)}: ${JSON.stringify(change.value)}`;
    case "add_to_attribute":
      return `${name(change.thing)}, ${name(change.attribute)} ${change.amount >= 0 ? "+" : ""}${change.amount}`;
    case "set_local_attribute":
      return `${name(change.thing)}, ${change.name}: ${JSON.stringify(change.value)}${change.unit ? " " + change.unit : ""}`;
    case "remove_attribute":
      return `${name(change.thing)} loses ${name(change.attribute)}`;
    case "set_skill":
      return `${name(change.thing)}, ${name(change.skill)}: ${change.value}`;
    case "remove_skill":
      return `${name(change.thing)} loses ${name(change.skill)}`;
    case "add_ability":
      return `${name(change.character)} can now: ${change.name}, ${change.description}`;
    case "update_ability":
      return `${name(change.character)}, ability ${change.ability}, ${change.field}: ${change.value}`;
    case "remove_ability":
      return `${name(change.character)} loses ability ${change.ability}`;
    case "award_exp":
      return `${name(change.character)} gains ${change.amount} experience: ${change.reason}`;
    case "spend_skill_points":
      return `${name(change.character)} raises ${name(change.skill)} by ${change.points}`;
    case "add_effect":
      return `${name(change.thing)}, ${name(change.target)} ${change.amount >= 0 ? "+" : ""}${change.amount} for ${change.duration} ${change.unit}: ${change.reason}`;
    case "remove_effect":
      return `${name(change.thing)} loses effect ${change.effect}`;
    case "set_time":
      return `Time: ${world_time_text((change.day - 1) * MINUTES.days + change.hour * 60 + change.minute)}`;
    case "pass_time":
      return `${change.amount} ${change.unit} pass`;
    case "update_settings":
      return `Setting ${change.field}: ${change.value}`;
    default:
      return JSON.stringify(change);
  }
}
