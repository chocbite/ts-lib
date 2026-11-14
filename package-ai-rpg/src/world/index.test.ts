import { describe, expect, it } from "vitest";
import { schema_check } from "#lib/schema";
import { world_apply, world_change_schema, world_chunks_ids, world_empty, world_known_as, type Change } from "./index";

const person = (id: string, name: string, location: string, controller?: "player" | "ai"): Change => ({
  op: "add_character",
  id,
  name,
  description: `${name} desc`,
  appearance: `a person called ${name}?`,
  bio: "",
  personality: "",
  goals: "",
  location,
  ...(controller ? { controller } : {}),
});

const BUILD: Change[] = [
  //Characters before their location, additions are reordered
  person("new:mara", "Mara", "new:inn", "player"),
  person("new:mara-b", "Mara", "new:inn"),
  { op: "add_location", id: "new:inn", name: "Inn", description: "Where [Mara](new:mara) works" },
  { op: "set_relationship", character: "new:mara", other: "new:mara-b", known_as: "the other Mara", opinion: "odd" },
  { op: "set_time", time: "Dawn" },
];

describe("world", () => {
  it("builds a world and gives real ids", () => {
    const { world, problems, ids } = world_apply(world_empty(), BUILD);
    expect(problems.every((p) => p === undefined)).toBe(true);
    expect(ids.get("new:mara")).toBe("char:mara");
    expect(ids.get("new:mara-b")).toBe("char:mara-2");
    expect(world.locations["loc:inn"].description).toBe("Where [Mara](char:mara) works");
    expect(world.characters["char:mara"].controller).toBe("player");
    expect(world.characters["char:mara-2"].controller).toBe("ai");
    expect(world.characters["char:mara"].relationships["char:mara-2"].known_as).toBe("the other Mara");
    expect(world.time).toBe("Dawn");
  });

  it("skips and explains changes that do not fit, applying the rest", () => {
    const { world } = world_apply(world_empty(), BUILD);
    const result = world_apply(world, [
      { op: "move_character", character: "char:nobody", location: "loc:inn" },
      { op: "add_memory", character: "char:mara", memory: "Saw [a stranger](new:stranger)" },
      person("new:stranger", "Stranger", "loc:inn"),
      { op: "remove_character", character: "char:mara-2" },
      { op: "add_memory", character: "char:mara-2", memory: "too late" },
      person("bad", "Bad", "loc:inn"),
    ]);
    expect(result.problems[0]).toBe("there is no character char:nobody");
    expect(result.problems[1]).toBeUndefined();
    expect(result.world.characters["char:mara"].memories).toEqual(["Saw [a stranger](char:stranger)"]);
    expect(result.problems[4]).toBe("char:mara-2 is removed");
    expect(result.problems[5]).toContain("must start with new:");
    //The original is not changed
    expect(world.characters["char:mara"].memories).toEqual([]);
  });

  it("never reuses ids of removed characters", () => {
    const { world } = world_apply(world_empty(), BUILD);
    const removed = world_apply(world, [{ op: "remove_character", character: "char:mara-2" }]).world;
    const added = world_apply(removed, [person("new:x", "Mara", "loc:inn")]);
    expect(added.ids.get("new:x")).toBe("char:mara-3");
  });

  it("gives the names characters know each other by", () => {
    const { world } = world_apply(world_empty(), BUILD);
    expect(world_known_as(world, "char:mara", "char:mara-2")).toBe("the other Mara");
    expect(world_known_as(world, "char:mara-2", "char:mara")).toBe("a person called Mara?");
    expect(world_known_as(world, "char:mara", "char:mara")).toBe("Mara");
  });

  it("limits ids in the change schema to existing ones and new ones", () => {
    const { world } = world_apply(world_empty(), BUILD);
    const schema = { type: "object", properties: { changes: world_change_schema(world) }, required: ["changes"] } as const;
    expect(schema_check(schema, { changes: [{ op: "add_memory", character: "char:mara", memory: "x" }] }).ok).toBe(true);
    expect(schema_check(schema, { changes: [{ op: "add_memory", character: "char:bob", memory: "x" }] }).err).toBe(true);
    expect(schema_check(schema, { changes: [{ op: "move_character", character: "new:bob", location: "new:hill" }] }).ok).toBe(true);
  });

  it("removes locations only when nobody is there", () => {
    const { world } = world_apply(world_empty(), [...BUILD, { op: "add_location", id: "new:mill", name: "Mill", description: "" }]);
    expect(world_apply(world, [{ op: "remove_location", location: "loc:inn" }]).problems[0]).toBe("Mara, Mara are still at Inn");
    const removed = world_apply(world, [{ op: "remove_location", location: "loc:mill" }]);
    expect(removed.problems[0]).toBeUndefined();
    expect(removed.world.locations["loc:mill"].gone).toBe(true);
    expect(world_apply(removed.world, [{ op: "move_character", character: "char:mara", location: "loc:mill" }]).problems[0]).toBe("loc:mill is removed");
  });

  it("rewrites ids in chunks", () => {
    const ids = new Map([["new:mara", "char:mara"]]);
    expect(world_chunks_ids([{ speaker: "new:mara", text: "I am [Mara](new:mara)" }], ids)).toEqual([
      { speaker: "char:mara", text: "I am [Mara](char:mara)" },
    ]);
  });
});
