import { describe, expect, it } from "vitest";
import { QUICK_GAME } from "#quick";
import { store_delete_game, store_load } from "#store";
import { ENGINE } from "./index";

describe("engine", () => {
  it("changes only the state of what changed, saves it, and loads it back", async () => {
    const id = (await ENGINE.create(QUICK_GAME, "test")).unwrap();
    const goose = ENGINE.location("loc:the-wayward-goose")!;
    const mill = ENGINE.location("loc:the-old-mill")!;
    const list = ENGINE.locations.ok();
    let mill_heard = 0;
    mill.sub(() => mill_heard++);

    (await ENGINE.edit_world([{ op: "update_location", location: "loc:the-wayward-goose", field: "name", value: "The Goose" }])).unwrap();
    expect(goose.ok().name).toBe("The Goose");
    expect(ENGINE.location("loc:the-wayward-goose")).toBe(goose);
    expect(ENGINE.locations.ok()).toBe(list);
    expect(mill_heard).toBe(0);

    (await ENGINE.edit_world([{ op: "add_memory", character: "char:tamsin-vell", memory: "one" }])).unwrap();
    (await ENGINE.edit_world([{ op: "add_memory", character: "char:tamsin-vell", memory: "two" }])).unwrap();
    expect(ENGINE.world.memories("char:tamsin-vell")).toEqual(["one", "two"]);

    //All or nothing, a list with a bad change changes nothing
    const bad = await ENGINE.edit_world([
      { op: "update_location", location: "loc:the-old-mill", field: "name", value: "Not saved" },
      { op: "move_character", character: "char:nobody", location: "loc:the-old-mill" },
    ]);
    expect(bad.err).toBe(true);
    expect(mill.ok().name).toBe("The Old Mill");

    const records = (await store_load(id)).unwrap();
    expect(records.locations.find((l) => l.id === "loc:the-wayward-goose")?.name).toBe("The Goose");
    expect(records.memories.map((m) => [m.n, m.text])).toEqual([
      [0, "one"],
      [1, "two"],
    ]);

    (await ENGINE.load(id)).unwrap();
    expect(ENGINE.world.location("loc:the-wayward-goose")?.name).toBe("The Goose");
    expect(ENGINE.world.memories("char:tamsin-vell")).toEqual(["one", "two"]);
    expect(ENGINE.history.ok().map((r) => r.n)).toEqual([0]);
    expect(ENGINE.round.ok()?.n).toBe(1);

    ENGINE.close();
    await store_delete_game(id);
  });
});
