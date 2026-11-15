import { describe, expect, it } from "vitest";
import { world_apply, world_chunks_ids, world_empty } from "#world";
import { QUICK_GAME } from "./index";

describe("quick game", () => {
  it("builds without problems, the two Edrics get their own ids", () => {
    const { world, problems, ids } = world_apply(world_empty(), QUICK_GAME.changes);
    expect(problems.filter((p) => p !== undefined)).toEqual([]);
    expect(ids.get("new:edric")).toBe("char:edric");
    expect(ids.get("new:edric-miller")).toBe("char:edric-2");
    expect(world.characters().filter((c) => c.controller === "player")).toHaveLength(1);
    const opening = world_chunks_ids(QUICK_GAME.opening, ids);
    expect(opening.map((c) => c.text).join(" ")).not.toContain("new:");
  });

  it("nests at every level", () => {
    const { world } = world_apply(world_empty(), QUICK_GAME.changes);
    expect(world.roots).toEqual(["loc:ashen-crossroads", "loc:the-old-mill"]);
    expect(world.path("char:pip").map((t) => t.id)).toEqual(["item:grey-wardens-coat", "char:captain-hale", "loc:market-square", "loc:ashen-crossroads"]);
    expect(world.place("char:pip")?.id).toBe("loc:market-square");
    expect(world.inside("item:ink-stained-satchel").map((t) => t.id)).toEqual(["item:unfinished-map", "item:brass-compass"]);
  });
});
