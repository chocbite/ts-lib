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

const built = () => world_apply(world_empty(), BUILD).world;

describe("world", () => {
  it("builds a tree and gives real ids", () => {
    const { world, problems, ids } = world_apply(world_empty(), BUILD);
    expect(problems.every((p) => p === undefined)).toBe(true);
    expect(ids.get("new:mara")).toBe("char:mara");
    expect(ids.get("new:mara-b")).toBe("char:mara-2");
    expect(ids.get("new:key")).toBe("item:key");
    expect(world.roots).toEqual(["loc:town"]);
    expect(world.location("loc:inn")?.children).toEqual(["char:mara", "char:mara-2", "item:chest"]);
    expect(world.path("item:key").map((t) => t.id)).toEqual(["item:chest", "loc:inn", "loc:town"]);
    expect(world.place("item:key")?.id).toBe("loc:inn");
    expect(world.location("loc:inn")?.description).toBe("Where [Mara](char:mara) works");
    expect(world.character("char:mara")?.controller).toBe("player");
    expect(world.character("char:mara-2")?.controller).toBe("ai");
    expect(world.character("char:mara")?.relationships["char:mara-2"].known_as).toBe("the other Mara");
    expect(world_time_text(world.time)).toBe("Day 2, 06:05");
  });

  it("returns only what the changes touched", () => {
    const world = built();
    const result = world_apply(world, [
      { op: "update", thing: "loc:inn", field: "name", value: "Old Inn" },
      { op: "add_memory", character: "char:mara", memory: "rain" },
    ]);
    expect(result.nodes.map((t) => t.id)).toEqual(["loc:inn"]);
    expect(result.roots).toBeUndefined();
    expect(result.memories).toEqual([{ character: "char:mara", text: "rain" }]);
    //The world it was applied to keeps its values
    expect(world.location("loc:inn")?.name).toBe("Inn");
    expect(result.world.location("loc:inn")?.name).toBe("Old Inn");
  });

  it("moves things, touching the thing and both parents", () => {
    const world = built();
    const result = world_apply(world, [{ op: "move", thing: "item:key", in: "char:mara" }]);
    expect(result.problems[0]).toBeUndefined();
    expect(result.nodes.map((t) => t.id).sort()).toEqual(["char:mara", "item:chest", "item:key"]);
    expect(result.world.thing("item:key")?.parent).toBe("char:mara");
    expect(result.world.item("item:chest")?.children).toEqual([]);
    expect(world.item("item:chest")?.children).toEqual(["item:key"]);
  });

  it("reorders inside a parent with an index", () => {
    const result = world_apply(built(), [{ op: "move", thing: "item:chest", in: "loc:inn", index: 0 }]);
    expect(result.world.location("loc:inn")?.children).toEqual(["item:chest", "char:mara", "char:mara-2"]);
  });

  it("keeps the rules of what goes where", () => {
    const world = built();
    const problem = (change: Change) => world_apply(world, [change]).problems[0];
    expect(problem({ op: "move", thing: "loc:inn", in: "item:chest" })).toBe("a location can only be in a location, not in item:chest");
    expect(problem({ op: "move", thing: "char:mara", in: "" })).toBe("a character must be in something");
    expect(problem({ op: "move", thing: "item:chest", in: "item:key" })).toBe("item:chest can not go inside itself");
    expect(problem({ op: "move", thing: "loc:town", in: "loc:inn" })).toBe("loc:town can not go inside itself");
    expect(problem({ op: "update", thing: "item:key", field: "bio", value: "x" })).toBe("an item has no bio");
    //A character in a character, and a location to the top level
    expect(problem({ op: "move", thing: "char:mara-2", in: "char:mara" })).toBeUndefined();
    expect(world_apply(world, [{ op: "move", thing: "loc:inn", in: "" }]).roots).toEqual(["loc:town", "loc:inn"]);
    //A failed move leaves the thing where it was
    const failed = world_apply(world, [{ op: "move", thing: "item:chest", in: "item:key" }]);
    expect(failed.world.location("loc:inn")?.children).toEqual(["char:mara", "char:mara-2", "item:chest"]);
    expect(failed.world.thing("item:chest")?.parent).toBe("loc:inn");
  });

  it("skips and explains changes that do not fit, applying the rest", () => {
    const world = built();
    const result = world_apply(world, [
      { op: "move", thing: "char:nobody", in: "loc:inn" },
      { op: "add_memory", character: "char:mara", memory: "Saw [a stranger](new:stranger)" },
      person("new:stranger", "Stranger", "loc:inn"),
      { op: "remove", thing: "char:mara-2" },
      { op: "add_memory", character: "char:mara-2", memory: "too late" },
      person("bad", "Bad", "loc:inn"),
      person("new:lost", "Lost", "new:never"),
    ]);
    expect(result.problems[0]).toBe("there is nothing with the id char:nobody");
    expect(result.problems[1]).toBeUndefined();
    expect(result.world.memories("char:mara")).toEqual(["Saw [a stranger](char:stranger)"]);
    expect(result.problems[4]).toBe("char:mara-2 is removed");
    expect(result.problems[5]).toContain("must start with new:");
    expect(result.problems[6]).toBe("there is nothing with the id new:never");
    //The original is not changed
    expect(world.memories("char:mara")).toEqual([]);
  });

  it("removes only things with nothing inside, and takes them out of the tree", () => {
    const world = built();
    expect(world_apply(world, [{ op: "remove", thing: "item:chest" }]).problems[0]).toBe("Key is still in Chest");
    const removed = world_apply(world, [{ op: "remove", thing: "item:key" }]).world;
    expect(removed.item("item:key")?.gone).toBe(true);
    expect(removed.item("item:chest")?.children).toEqual([]);
    expect(world_apply(removed, [{ op: "move", thing: "item:key", in: "loc:inn" }]).problems[0]).toBe("item:key is removed");
  });

  it("never reuses ids of removed things", () => {
    const removed = world_apply(built(), [{ op: "remove", thing: "char:mara-2" }]).world;
    const added = world_apply(removed, [person("new:x", "Mara", "loc:inn")]);
    expect(added.ids.get("new:x")).toBe("char:mara-3");
  });

  it("shows characters what is with them, not what is inside others", () => {
    const world = world_apply(built(), [
      { op: "add_location", id: "new:cellar", name: "Cellar", description: "", in: "loc:inn" },
      { op: "add_item", id: "new:pocket", name: "Pocket", description: "", in: "char:mara-2" },
      person("new:tiny", "Tiny", "new:pocket"),
    ]).world;
    const ids = (viewer: string) => world_visible(world, viewer).map((t) => t.id);
    expect(ids("char:mara")).toEqual(["char:mara-2", "item:chest", "loc:cellar", "loc:town"]);
    expect(ids("char:tiny")).toEqual(["item:pocket"]);
  });

  it("gives the names characters know each other by", () => {
    const world = built();
    expect(world_known_as(world, "char:mara", "char:mara-2")).toBe("the other Mara");
    expect(world_known_as(world, "char:mara-2", "char:mara")).toBe("a person called Mara?");
    expect(world_known_as(world, "char:mara", "char:mara")).toBe("Mara");
  });

  it("gives each scribe a schema with only its own changes", () => {
    const world = built();
    const check = (schema: ReturnType<typeof world_change_schema>, changes: unknown[]) =>
      schema_check({ type: "object", properties: { changes: schema }, required: ["changes"] }, { changes }).ok;
    const mara = world_change_schema(world, SchemaFor.ScribeCharacter, "char:mara");
    expect(check(mara, [{ op: "add_memory", character: "char:mara", memory: "x" }])).toBe(true);
    //Only its own character
    expect(check(mara, [{ op: "add_memory", character: "char:mara-2", memory: "x" }])).toBe(false);
    //What it sees can be picked up, what is inside the chest it can not see
    expect(check(mara, [{ op: "move", thing: "item:chest", in: "char:mara" }])).toBe(true);
    expect(check(mara, [{ op: "move", thing: "item:key", in: "char:mara" }])).toBe(false);
    const scribe_world = world_change_schema(world, SchemaFor.ScribeWorld);
    expect(check(scribe_world, [{ op: "move", thing: "new:bob", in: "new:hill" }])).toBe(true);
    expect(check(scribe_world, [{ op: "move", thing: "char:mara", in: "loc:town" }])).toBe(false);
    expect(check(scribe_world, [{ op: "add_memory", character: "char:mara", memory: "x" }])).toBe(false);
  });

  it("rewrites ids in chunks", () => {
    const ids = new Map([["new:mara", "char:mara"]]);
    expect(world_chunks_ids([{ speaker: "new:mara", text: "I am [Mara](new:mara)" }], ids)).toEqual([
      { speaker: "char:mara", text: "I am [Mara](char:mara)" },
    ]);
  });

  it("defines attributes and skills under Global, and checks values against them", () => {
    const world = world_apply(built(), [
      { op: "define_attribute", id: "new:height", name: "Height", description: "", type: "number", unit: "cm", kinds: ["character"] },
      { op: "define_skill", id: "new:climb", name: "Climbing", description: "" },
      { op: "set_attribute", thing: "char:mara", attribute: "new:height", value: 170 },
      { op: "set_skill", thing: "char:mara", skill: "new:climb", value: 40 },
      { op: "set_skill", thing: "item:key", skill: "new:climb", value: 10 },
    ]).world;
    expect(world.node(SKILLS)?.children).toEqual(["skill:climbing"]);
    expect(world.attributes().map((a) => a.id)).toEqual(["attr:height"]);
    const problem = (change: Change) => world_apply(world, [change]).problems[0];
    expect(problem({ op: "set_attribute", thing: "char:mara", attribute: "attr:height", value: "tall" })).toBe('Height takes a number, not "tall"');
    expect(problem({ op: "set_attribute", thing: "item:key", attribute: "attr:height", value: 3 })).toBe("an item has no Height");
    expect(problem({ op: "set_skill", thing: "char:mara", skill: "skill:climbing", value: 120 })).toBe("Climbing of a character is 0 to 100, not 120");
    expect(problem({ op: "remove_definition", definition: "skill:climbing" })).toBe("Climbing is still used");
    expect(problem({ op: "update_definition", definition: "attr:height", field: "type", value: "text" })).toBe("things have values of Height, its type can not change");
    expect(problem({ op: "move", thing: GLOBAL, in: "loc:town" })).toBe("Global can not be moved");
    //The code does the arithmetic
    const grown = world_apply(world, [{ op: "add_to_attribute", thing: "char:mara", attribute: "attr:height", amount: 5 }]).world;
    expect(grown.character("char:mara")?.attributes).toEqual([{ id: "attr:height", value: 175 }]);
  });

  it("counts only the skill bonuses of items directly inside a character", () => {
    const world = world_apply(built(), [
      { op: "define_skill", id: "new:climb", name: "Climbing", description: "" },
      { op: "set_skill", thing: "char:mara", skill: "new:climb", value: 40 },
      { op: "add_item", id: "new:rope", name: "Rope", description: "", in: "char:mara" },
      { op: "add_item", id: "new:bag", name: "Bag", description: "", in: "char:mara" },
      { op: "add_item", id: "new:hook", name: "Hook", description: "", in: "new:bag" },
      { op: "set_skill", thing: "new:rope", skill: "new:climb", value: 10 },
      { op: "set_skill", thing: "new:hook", skill: "new:climb", value: 20 },
    ]).world;
    expect(world_skill_texts(world, world.character("char:mara")!)).toEqual(["Climbing 50 (40, +10 from Rope)"]);
  });

  it("awards experience in words and levels up in code", () => {
    const world = world_apply(built(), [
      { op: "update_settings", field: "level_exp", value: 50 },
      { op: "award_exp", character: "char:mara", amount: "medium", reason: "" },
      { op: "award_exp", character: "char:mara", amount: "medium", reason: "" },
    ]).world;
    const mara = world.character("char:mara") as Character;
    //30 + 30 reaches level 2 at 50, level 3 needs 50 + 75
    expect([mara.exp, mara.level, mara.skill_points]).toEqual([60, 2, 5]);
  });

  it("keeps abilities with their character, and moves time on", () => {
    const result = world_apply(built(), [
      { op: "add_ability", character: "char:mara", name: "Night sight", description: "Sees in the dark" },
      { op: "add_ability", character: "char:mara", name: "Night sight", description: "Again" },
      { op: "pass_time", amount: 2.5, unit: "hours" },
    ]);
    expect(result.world.character("char:mara")?.abilities.map((a) => a.id)).toEqual(["ability:night-sight", "ability:night-sight-2"]);
    expect(world_time_text(result.world.time)).toBe("Day 2, 08:35");
    expect(result.nodes.map((n) => n.id)).toEqual(["char:mara", GLOBAL]);
  });

  it("adds effects on top of values and drops them when their time has passed", () => {
    const world = world_apply(built(), [
      { op: "define_attribute", id: "new:height", name: "Height", description: "", type: "number", unit: "cm", kinds: ["character"] },
      { op: "set_attribute", thing: "char:mara", attribute: "new:height", value: 170 },
      { op: "add_effect", thing: "char:mara", target: "new:height", amount: 5, duration: 1, unit: "hours", reason: "potion" },
    ]).world;
    expect(world_attribute_texts(world, world.thing("char:mara")!)).toEqual(["Height: 175 cm (170, +5 from potion for 1 h)"]);
    const later = world_apply(world, [{ op: "pass_time", amount: 30, unit: "minutes" }]).world;
    expect(world_attribute_texts(later, later.thing("char:mara")!)).toEqual(["Height: 175 cm (170, +5 from potion for 30 min)"]);
    const gone = world_apply(later, [{ op: "pass_time", amount: 30, unit: "minutes" }]);
    expect(world_attribute_texts(gone.world, gone.world.thing("char:mara")!)).toEqual(["Height: 170 cm"]);
    expect(gone.nodes.map((n) => n.id).sort()).toEqual(["char:mara", GLOBAL]);
    expect(world_apply(world, [{ op: "add_effect", thing: "char:mara", target: "new:nothing", amount: 1, duration: 1, unit: "hours", reason: "" }]).problems[0]).toBe(
      "new:nothing is not a number attribute or skill",
    );
  });

  it("spends skill points within the points and the 100 limit", () => {
    const world = world_apply(built(), [
      { op: "define_skill", id: "new:climb", name: "Climbing", description: "" },
      { op: "set_skill", thing: "char:mara", skill: "new:climb", value: 97 },
      { op: "award_exp", character: "char:mara", amount: "large", reason: "" },
    ]).world;
    expect(world.character("char:mara")?.skill_points).toBe(5);
    const problem = (points: number) => world_apply(world, [{ op: "spend_skill_points", character: "char:mara", skill: "skill:climbing", points }]).problems[0];
    expect(problem(4)).toBe("Climbing can not go over 100");
    expect(problem(6)).toBe("Mara has only 5 skill points");
    const spent = world_apply(world, [{ op: "spend_skill_points", character: "char:mara", skill: "skill:climbing", points: 3 }]).world.character("char:mara")!;
    expect([spent.skills[0].value, spent.skill_points]).toEqual([100, 2]);
  });
});
