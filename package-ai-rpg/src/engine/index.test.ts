import { describe, expect, it } from "vitest";
import { QUICK_GAME } from "#quick";
import { store_delete_game, store_load } from "#store";
import state from "@chocbite/ts-lib/state";
import { ENGINE } from "./index";

const ids = (rows: { ok(): { ok(): { id: string } }[] } | undefined) => rows?.ok().map((s) => s.ok().id);

describe("engine", () => {
  it("changes only the state of what changed, saves it, and loads it back", async () => {
    const id = (await ENGINE.create(QUICK_GAME, "test")).unwrap();
    const goose = ENGINE.thing("loc:the-wayward-goose")!;
    const mill = ENGINE.thing("loc:the-old-mill")!;
    const crossroads = ENGINE.children("loc:ashen-crossroads")!;
    const rows = crossroads.ok();
    let mill_heard = 0;
    mill.sub(() => mill_heard++);

    (await ENGINE.edit_world([{ op: "update", thing: "loc:the-wayward-goose", field: "name", value: "The Goose" }])).unwrap();
    expect(goose.ok().name).toBe("The Goose");
    expect(ENGINE.thing("loc:the-wayward-goose")).toBe(goose);
    //The same array of the same states, the list only hears that a row changed
    expect(crossroads.ok()).toBe(rows);
    expect(crossroads.ok()[0]).toBe(goose);
    expect(mill_heard).toBe(0);

    (await ENGINE.edit_world([{ op: "add_memory", character: "char:tamsin-vell", memory: "one" }])).unwrap();
    (await ENGINE.edit_world([{ op: "add_memory", character: "char:tamsin-vell", memory: "two" }])).unwrap();
    expect(ENGINE.world.memories("char:tamsin-vell")).toEqual(["one", "two"]);

    //A move changes the children of both parents, the moved thing keeps its state
    const compass = ENGINE.thing("item:brass-compass")!;
    (await ENGINE.edit_world([{ op: "move", thing: "item:brass-compass", in: "char:tamsin-vell" }])).unwrap();
    expect(ids(ENGINE.children("item:ink-stained-satchel"))).toEqual(["item:unfinished-map"]);
    expect(ids(ENGINE.children("char:tamsin-vell"))).toEqual(["item:ink-stained-satchel", "item:brass-compass"]);
    expect(ENGINE.children("char:tamsin-vell")!.ok()[1]).toBe(compass);

    //A list moves rows by writing a move to the rows state
    (await ENGINE.children("char:tamsin-vell")!.write(state.a.write.move(1, 0, 1))).unwrap();
    expect(ids(ENGINE.children("char:tamsin-vell"))).toEqual(["item:brass-compass", "item:ink-stained-satchel"]);
    (await ENGINE.roots.write(state.a.write.move(0, 1, 1))).unwrap();
    expect(ids(ENGINE.roots)).toEqual(["loc:the-old-mill", "loc:ashen-crossroads"]);
    expect((await ENGINE.roots.write(state.a.write.push(compass))).err).toBe(true);

    //All or nothing, a list with a bad change changes nothing
    const bad = await ENGINE.edit_world([
      { op: "update", thing: "loc:the-old-mill", field: "name", value: "Not saved" },
      { op: "move", thing: "char:nobody", in: "loc:the-old-mill" },
    ]);
    expect(bad.err).toBe(true);
    expect(mill.ok().name).toBe("The Old Mill");

    const records = (await store_load(id)).unwrap();
    expect(records.things.find((t) => t.id === "loc:the-wayward-goose")?.name).toBe("The Goose");
    expect(records.game.roots).toEqual(["loc:the-old-mill", "loc:ashen-crossroads"]);
    expect(records.memories.map((m) => [m.n, m.text])).toEqual([
      [0, "one"],
      [1, "two"],
    ]);

    (await ENGINE.load(id)).unwrap();
    expect(ENGINE.world.location("loc:the-wayward-goose")?.name).toBe("The Goose");
    expect(ENGINE.world.memories("char:tamsin-vell")).toEqual(["one", "two"]);
    expect(ids(ENGINE.roots)).toEqual(["loc:the-old-mill", "loc:ashen-crossroads"]);
    expect(ids(ENGINE.children("char:tamsin-vell"))).toEqual(["item:brass-compass", "item:ink-stained-satchel"]);
    expect(ENGINE.history.ok().map((r) => r.n)).toEqual([0]);
    expect(ENGINE.round.ok()?.n).toBe(1);

    ENGINE.close();
    await store_delete_game(id);
  });
});
