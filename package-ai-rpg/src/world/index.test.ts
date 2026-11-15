import { describe, expect, it } from "vitest";
import { schema_check } from "#lib/schema";
import { world_apply, world_change_schema, world_chunks_ids, world_empty, world_known_as, world_visible, type Change } from "./index";

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
  { op: "set_time", time: "Dawn" },
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
    expect(world.time).toBe("Dawn");
  });

  it("returns only what the changes touched", () => {
    const world = built();
    const result = world_apply(world, [
      { op: "update", thing: "loc:inn", field: "name", value: "Old Inn" },
      { op: "add_memory", character: "char:mara", memory: "rain" },
    ]);
    expect(result.things.map((t) => t.id)).toEqual(["loc:inn"]);
    expect(result.roots).toBeUndefined();
    expect(result.memories).toEqual([{ character: "char:mara", text: "rain" }]);
    expect(result.time).toBeUndefined();
    //The world it was applied to keeps its values
    expect(world.location("loc:inn")?.name).toBe("Inn");
    expect(result.world.location("loc:inn")?.name).toBe("Old Inn");
  });

  it("moves things, touching the thing and both parents", () => {
    const world = built();
    const result = world_apply(world, [{ op: "move", thing: "item:key", in: "char:mara" }]);
    expect(result.problems[0]).toBeUndefined();
    expect(result.things.map((t) => t.id).sort()).toEqual(["char:mara", "item:chest", "item:key"]);
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

  it("limits ids in the change schema to existing ones and new ones", () => {
    const world = built();
    const schema = { type: "object", properties: { changes: world_change_schema(world) }, required: ["changes"] } as const;
    expect(schema_check(schema, { changes: [{ op: "add_memory", character: "char:mara", memory: "x" }] }).ok).toBe(true);
    expect(schema_check(schema, { changes: [{ op: "add_memory", character: "char:bob", memory: "x" }] }).err).toBe(true);
    expect(schema_check(schema, { changes: [{ op: "move", thing: "new:bob", in: "new:hill" }] }).ok).toBe(true);
    expect(schema_check(schema, { changes: [{ op: "move", thing: "item:key", in: "char:mara" }] }).ok).toBe(true);
  });

  it("rewrites ids in chunks", () => {
    const ids = new Map([["new:mara", "char:mara"]]);
    expect(world_chunks_ids([{ speaker: "new:mara", text: "I am [Mara](new:mara)" }], ids)).toEqual([
      { speaker: "char:mara", text: "I am [Mara](char:mara)" },
    ]);
  });
});
