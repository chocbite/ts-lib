import { describe, expect, it } from "vitest";
import { world_apply, world_chunks_ids, world_empty } from "#world";
import { QUICK_GAME } from "./index";

/**Real id of a temporary id of the quick game, the ids are the same every time the quick game is made*/
const QUICK_IDS = world_apply(world_empty(), QUICK_GAME.changes).ids;
const q = (temp: string) => QUICK_IDS.get("new:" + temp)!;

describe("quick game", () => {
  it("builds without problems, the two Edrics get their own ids", () => {
    const { world, problems, ids } = world_apply(world_empty(), QUICK_GAME.changes);
    expect(problems.filter((p) => p !== undefined)).toEqual([]);
    expect(ids.get("new:edric")).not.toBe(ids.get("new:edric-miller"));
    expect(world.characters().filter((c) => c.controller === "player")).toHaveLength(1);
    const opening = world_chunks_ids(QUICK_GAME.opening, ids);
    expect(opening.map((c) => c.text).join(" ")).not.toContain("new:");
  });

  it("nests at every level", () => {
    const { world } = world_apply(world_empty(), QUICK_GAME.changes);
    expect(world.roots).toEqual([q("crossroads"), q("mill")]);
    expect(world.path(q("pip")).map((t) => t.id)).toEqual([q("coat"), q("hale"), q("square"), q("crossroads")]);
    expect(world.place(q("pip"))?.id).toBe(q("square"));
    expect(world.inside(q("satchel")).map((t) => t.id)).toEqual([q("map"), q("compass")]);
  });
});
