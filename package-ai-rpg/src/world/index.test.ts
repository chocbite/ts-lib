import { describe, expect, it } from "vitest";
import { schema_check } from "#lib/schema";
import {
  GLOBAL,
  SchemaFor,
  SKILLS,
  world_apply,
  world_attribute_texts,
  world_change_schema,
  world_chunks_ids,
  world_empty,
  world_known_as,
  world_skill_texts,
  world_time_text,
  world_visible,
  type Change,
  type Character,
} from "./index";

const person = (id: string, name: string, inside: string, controller?: "player" | "ai"): Change => ({
  op: "add_character",
  id,
  name,
  description: `${name} desc`,
  appearance: `a person called ${name}?`,
  bio: "",
  personality: "",
  goals: "",
  in: inside,
  ...(controller ? { controller } : {}),
});

const BUILD: Change[] = [
  //Things before what they are in, additions wait for their target
  person("new:mara", "Mara", "new:inn", "player"),
  person("new:mara-b", "Mara", "new:inn"),
  { op: "add_item", id: "new:key", name: "Key", description: "", in: "new:chest" },
  { op: "add_item", id: "new:chest", name: "Chest", description: "", in: "new:inn" },
  { op: "add_location", id: "new:inn", name: "Inn", description: "Where [Mara](new:mara) works", in: "new:town" },
  { op: "add_location", id: "new:town", name: "Town", description: "", in: "" },
  { op: "set_relationship", character: "new:mara", other: "new:mara-b", known_as: "the other Mara", opinion: "odd" },
  { op: "set_time", day: 2, hour: 6, minute: 5 },
];

const BUILT = world_apply(world_empty(), BUILD);
/**Real id of a temporary id of the build*/
const id = (temp: string) => BUILT.ids.get("new:" + temp)!;
const [MARA, MARA_B, INN, TOWN, KEY, CHEST] = ["mara", "mara-b", "inn", "town", "key", "chest"].map(id);

const built = () => world_apply(world_empty(), BUILD).world;

describe("world", () => {
  it("builds a tree and gives real ids", () => {
    const { world, problems, ids } = world_apply(world_empty(), BUILD);
    expect(problems.every((p) => p === undefined)).toBe(true);
    expect(ids.get("new:mara")).toBe(MARA);
    expect(ids.get("new:mara-b")).toBe(MARA_B);
    expect(ids.get("new:key")).toBe(KEY);
    expect(world.roots).toEqual([TOWN]);
    expect(world.location(INN)?.children).toEqual([MARA, MARA_B, CHEST]);
    expect(world.path(KEY).map((t) => t.id)).toEqual([CHEST, INN, TOWN]);
    expect(world.place(KEY)?.id).toBe(INN);
    expect(world.location(INN)?.description).toBe(`Where [Mara](${MARA}) works`);
    expect(world.character(MARA)?.controller).toBe("player");
    expect(world.character(MARA_B)?.controller).toBe("ai");
    expect(world.character(MARA)?.relationships[MARA_B].known_as).toBe("the other Mara");
    expect(world_time_text(world.time)).toBe("Day 2, 06:05");
  });

  it("returns only what the changes touched", () => {
    const world = built();
    const result = world_apply(world, [
      { op: "update", thing: INN, field: "name", value: "Old Inn" },
      { op: "add_memory", character: MARA, memory: "rain" },
    ]);
    expect(result.nodes.map((t) => t.id)).toEqual([INN]);
    expect(result.roots).toBeUndefined();
    expect(result.memories).toEqual([{ character: MARA, text: "rain" }]);
    //The world it was applied to keeps its values
    expect(world.location(INN)?.name).toBe("Inn");
    expect(result.world.location(INN)?.name).toBe("Old Inn");
  });

  it("moves things, touching the thing and both parents", () => {
    const world = built();
    const result = world_apply(world, [{ op: "move", thing: KEY, in: MARA }]);
    expect(result.problems[0]).toBeUndefined();
    expect(result.nodes.map((t) => t.id).sort()).toEqual([MARA, CHEST, KEY].sort());
    expect(result.world.thing(KEY)?.parent).toBe(MARA);
    expect(result.world.item(CHEST)?.children).toEqual([]);
    expect(world.item(CHEST)?.children).toEqual([KEY]);
  });

  it("reorders inside a parent with an index", () => {
    const result = world_apply(built(), [{ op: "move", thing: CHEST, in: INN, index: 0 }]);
    expect(result.world.location(INN)?.children).toEqual([CHEST, MARA, MARA_B]);
  });

  it("keeps the rules of what goes where", () => {
    const world = built();
    const problem = (change: Change) => world_apply(world, [change]).problems[0];
    expect(problem({ op: "move", thing: INN, in: CHEST })).toBe(`a location can only be in a location, not in ${CHEST}`);
    expect(problem({ op: "move", thing: MARA, in: "" })).toBe("a character must be in something");
    expect(problem({ op: "move", thing: CHEST, in: KEY })).toBe(`${CHEST} can not go inside itself`);
    expect(problem({ op: "move", thing: TOWN, in: INN })).toBe(`${TOWN} can not go inside itself`);
    expect(problem({ op: "update", thing: KEY, field: "bio", value: "x" })).toBe("an item has no bio");
    //A character in a character, and a location to the top level
    expect(problem({ op: "move", thing: MARA_B, in: MARA })).toBeUndefined();
    expect(world_apply(world, [{ op: "move", thing: INN, in: "" }]).roots).toEqual([TOWN, INN]);
    //A failed move leaves the thing where it was
    const failed = world_apply(world, [{ op: "move", thing: CHEST, in: KEY }]);
    expect(failed.world.location(INN)?.children).toEqual([MARA, MARA_B, CHEST]);
    expect(failed.world.thing(CHEST)?.parent).toBe(INN);
  });

  it("skips and explains changes that do not fit, applying the rest", () => {
    const world = built();
    const result = world_apply(world, [
      { op: "move", thing: "char:nobody", in: INN },
      { op: "add_memory", character: MARA, memory: "Saw [a stranger](new:stranger)" },
      person("new:stranger", "Stranger", INN),
      { op: "remove", thing: MARA_B },
      { op: "add_memory", character: MARA_B, memory: "too late" },
      person("bad", "Bad", INN),
      person("new:lost", "Lost", "new:never"),
    ]);
    expect(result.problems[0]).toBe("there is nothing with the id char:nobody");
    expect(result.problems[1]).toBeUndefined();
    expect(result.world.memories(MARA)).toEqual([`Saw [a stranger](${result.ids.get("new:stranger")})`]);
    expect(result.problems[4]).toBe(`${MARA_B} is removed`);
    expect(result.problems[5]).toContain("must start with new:");
    expect(result.problems[6]).toBe("there is nothing with the id new:never");
    //The original is not changed
    expect(world.memories(MARA)).toEqual([]);
  });

  it("removes only things with nothing inside, and takes them out of the tree", () => {
    const world = built();
    expect(world_apply(world, [{ op: "remove", thing: CHEST }]).problems[0]).toBe("Key is still in Chest");
    const removed = world_apply(world, [{ op: "remove", thing: KEY }]).world;
    expect(removed.item(KEY)?.gone).toBe(true);
    expect(removed.item(CHEST)?.children).toEqual([]);
    expect(world_apply(removed, [{ op: "move", thing: KEY, in: INN }]).problems[0]).toBe(`${KEY} is removed`);
  });

  it("never reuses ids of removed things", () => {
    const removed = world_apply(built(), [{ op: "remove", thing: MARA_B }]).world;
    const added = world_apply(removed, [person("new:x", "Mara", INN)]);
    const x = added.ids.get("new:x")!;
    expect(x).toMatch(/^char:[a-z2-9]{4}$/);
    expect([MARA, MARA_B]).not.toContain(x);
  });

  it("shows characters what is with them, not what is inside others", () => {
    const result = world_apply(built(), [
      { op: "add_location", id: "new:cellar", name: "Cellar", description: "", in: INN },
      { op: "add_item", id: "new:pocket", name: "Pocket", description: "", in: MARA_B },
      person("new:tiny", "Tiny", "new:pocket"),
    ]);
    const world = result.world;
    const added = (temp: string) => result.ids.get("new:" + temp)!;
    const ids = (viewer: string) => world_visible(world, viewer).map((t) => t.id);
    expect(ids(MARA)).toEqual([MARA_B, CHEST, added("cellar"), TOWN]);
    expect(ids(added("tiny"))).toEqual([added("pocket")]);
  });

  it("gives the names characters know each other by", () => {
    const world = built();
    expect(world_known_as(world, MARA, MARA_B)).toBe("the other Mara");
    expect(world_known_as(world, MARA_B, MARA)).toBe("a person called Mara?");
    expect(world_known_as(world, MARA, MARA)).toBe("Mara");
  });

  it("gives each scribe a schema with only its own changes", () => {
    const world = built();
    const check = (schema: ReturnType<typeof world_change_schema>, changes: unknown[]) =>
      schema_check({ type: "object", properties: { changes: schema }, required: ["changes"] }, { changes }).ok;
    const mara = world_change_schema(world, SchemaFor.ScribeCharacter, MARA);
    expect(check(mara, [{ op: "add_memory", character: MARA, memory: "x" }])).toBe(true);
    //Only its own character
    expect(check(mara, [{ op: "add_memory", character: MARA_B, memory: "x" }])).toBe(false);
    //What it sees can be picked up, what is inside the chest it can not see
    expect(check(mara, [{ op: "move", thing: CHEST, in: MARA }])).toBe(true);
    expect(check(mara, [{ op: "move", thing: KEY, in: MARA }])).toBe(false);
    const scribe_world = world_change_schema(world, SchemaFor.ScribeWorld);
    expect(check(scribe_world, [{ op: "move", thing: "new:bob", in: "new:hill" }])).toBe(true);
    expect(check(scribe_world, [{ op: "move", thing: MARA, in: TOWN }])).toBe(false);
    expect(check(scribe_world, [{ op: "add_memory", character: MARA, memory: "x" }])).toBe(false);
  });

  it("rewrites ids in chunks", () => {
    const ids = new Map([["new:mara", MARA]]);
    expect(world_chunks_ids([{ speaker: "new:mara", text: "I am [Mara](new:mara)" }], ids)).toEqual([
      { speaker: MARA, text: `I am [Mara](${MARA})` },
    ]);
  });

  it("defines attributes and skills under Global, and checks values against them", () => {
    const result = world_apply(built(), [
      { op: "define_attribute", id: "new:height", name: "Height", description: "", type: "number", unit: "cm", kinds: ["character"] },
      { op: "define_skill", id: "new:climb", name: "Climbing", description: "" },
      { op: "set_attribute", thing: MARA, attribute: "new:height", value: 170 },
      { op: "set_skill", thing: MARA, skill: "new:climb", value: 40 },
      { op: "set_skill", thing: KEY, skill: "new:climb", value: 10 },
    ]);
    const world = result.world;
    const [HEIGHT, CLIMB] = [result.ids.get("new:height")!, result.ids.get("new:climb")!];
    expect(world.node(SKILLS)?.children).toEqual([CLIMB]);
    expect(world.attributes().map((a) => a.id)).toEqual([HEIGHT]);
    const problem = (change: Change) => world_apply(world, [change]).problems[0];
    expect(problem({ op: "set_attribute", thing: MARA, attribute: HEIGHT, value: "tall" })).toBe('Height takes a number, not "tall"');
    expect(problem({ op: "set_attribute", thing: KEY, attribute: HEIGHT, value: 3 })).toBe("an item has no Height");
    expect(problem({ op: "set_skill", thing: MARA, skill: CLIMB, value: 120 })).toBe("Climbing of a character is 0 to 100, not 120");
    expect(problem({ op: "remove_definition", definition: CLIMB })).toBe("Climbing is still used");
    expect(problem({ op: "update_definition", definition: HEIGHT, field: "type", value: "text" })).toBe("things have values of Height, its type can not change");
    expect(problem({ op: "move", thing: GLOBAL, in: TOWN })).toBe("Global can not be moved");
    //The code does the arithmetic
    const grown = world_apply(world, [{ op: "add_to_attribute", thing: MARA, attribute: HEIGHT, amount: 5 }]).world;
    expect(grown.character(MARA)?.attributes).toEqual([{ id: HEIGHT, value: 175 }]);
  });

  it("counts only the skill bonuses of items directly inside a character", () => {
    const world = world_apply(built(), [
      { op: "define_skill", id: "new:climb", name: "Climbing", description: "" },
      { op: "set_skill", thing: MARA, skill: "new:climb", value: 40 },
      { op: "add_item", id: "new:rope", name: "Rope", description: "", in: MARA },
      { op: "add_item", id: "new:bag", name: "Bag", description: "", in: MARA },
      { op: "add_item", id: "new:hook", name: "Hook", description: "", in: "new:bag" },
      { op: "set_skill", thing: "new:rope", skill: "new:climb", value: 10 },
      { op: "set_skill", thing: "new:hook", skill: "new:climb", value: 20 },
    ]).world;
    expect(world_skill_texts(world, world.character(MARA)!)).toEqual(["Climbing 50 (40, +10 from Rope)"]);
  });

  it("awards experience in words and levels up in code", () => {
    const world = world_apply(built(), [
      { op: "update_settings", field: "level_exp", value: 50 },
      { op: "award_exp", character: MARA, amount: "medium", reason: "" },
      { op: "award_exp", character: MARA, amount: "medium", reason: "" },
    ]).world;
    const mara = world.character(MARA) as Character;
    //30 + 30 reaches level 2 at 50, level 3 needs 50 + 75
    expect([mara.exp, mara.level, mara.skill_points]).toEqual([60, 2, 5]);
  });

  it("keeps abilities with their character, and moves time on", () => {
    const result = world_apply(built(), [
      { op: "add_ability", character: MARA, name: "Night sight", description: "Sees in the dark" },
      { op: "add_ability", character: MARA, name: "Night sight", description: "Again" },
      { op: "pass_time", amount: 2.5, unit: "hours" },
    ]);
    const abilities = result.world.character(MARA)!.abilities;
    expect(abilities.map((a) => a.name)).toEqual(["Night sight", "Night sight"]);
    expect(abilities[0].id).not.toBe(abilities[1].id);
    expect(abilities[0].id).toMatch(/^ability:[a-z2-9]{4}$/);
    expect(world_time_text(result.world.time)).toBe("Day 2, 08:35");
    expect(result.nodes.map((n) => n.id).sort()).toEqual([GLOBAL, MARA].sort());
  });

  it("adds effects on top of values and drops them when their time has passed", () => {
    const world = world_apply(built(), [
      { op: "define_attribute", id: "new:height", name: "Height", description: "", type: "number", unit: "cm", kinds: ["character"] },
      { op: "set_attribute", thing: MARA, attribute: "new:height", value: 170 },
      { op: "add_effect", thing: MARA, target: "new:height", amount: 5, duration: 1, unit: "hours", reason: "potion" },
    ]).world;
    expect(world_attribute_texts(world, world.thing(MARA)!)).toEqual(["Height: 175 cm (170, +5 from potion for 1 h)"]);
    const later = world_apply(world, [{ op: "pass_time", amount: 30, unit: "minutes" }]).world;
    expect(world_attribute_texts(later, later.thing(MARA)!)).toEqual(["Height: 175 cm (170, +5 from potion for 30 min)"]);
    const gone = world_apply(later, [{ op: "pass_time", amount: 30, unit: "minutes" }]);
    expect(world_attribute_texts(gone.world, gone.world.thing(MARA)!)).toEqual(["Height: 170 cm"]);
    expect(gone.nodes.map((n) => n.id).sort()).toEqual([MARA, GLOBAL].sort());
    expect(world_apply(world, [{ op: "add_effect", thing: MARA, target: "new:nothing", amount: 1, duration: 1, unit: "hours", reason: "" }]).problems[0]).toBe(
      "new:nothing is not a number attribute or skill",
    );
  });

  it("spends skill points within the points and the 100 limit", () => {
    const result = world_apply(built(), [
      { op: "define_skill", id: "new:climb", name: "Climbing", description: "" },
      { op: "set_skill", thing: MARA, skill: "new:climb", value: 97 },
      { op: "award_exp", character: MARA, amount: "large", reason: "" },
    ]);
    const world = result.world;
    const CLIMB = result.ids.get("new:climb")!;
    expect(world.character(MARA)?.skill_points).toBe(5);
    const problem = (points: number) => world_apply(world, [{ op: "spend_skill_points", character: MARA, skill: CLIMB, points }]).problems[0];
    expect(problem(4)).toBe("Climbing can not go over 100");
    expect(problem(6)).toBe("Mara has only 5 skill points");
    const spent = world_apply(world, [{ op: "spend_skill_points", character: MARA, skill: CLIMB, points: 3 }]).world.character(MARA)!;
    expect([spent.skills[0].value, spent.skill_points]).toEqual([100, 2]);
  });

  it("keeps local attributes apart, by id when given and else by name", () => {
    const add = (name: string, value: number, attribute?: string): Change => ({
      op: "set_local_attribute",
      thing: CHEST,
      name,
      type: "number",
      unit: "",
      value,
      ...(attribute ? { attribute } : {}),
    });
    const world = world_apply(built(), [add("Weight", 1), add("Width", 2), add("weight", 3)]).world;
    const [weight] = world.item(CHEST)!.attributes.map((v) => v.id);
    expect(world.item(CHEST)?.attributes.map((v) => [v.local?.name, v.value])).toEqual([
      ["weight", 3],
      ["Width", 2],
    ]);
    //Renamed by id, the id stays, a name can not be taken twice
    const renamed = world_apply(world, [add("Mass", 3, weight)]).world;
    expect(renamed.item(CHEST)?.attributes[0]).toEqual({ id: weight, value: 3, local: { name: "Mass", type: "number", unit: "" } });
    expect(world_apply(world, [add("Width", 3, weight)]).problems[0]).toBe("Chest already has Width");
  });
});
