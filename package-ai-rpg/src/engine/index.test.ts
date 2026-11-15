import { describe, expect, it } from "vitest";
import { QUICK_GAME } from "#quick";
import { store_delete_game, store_load } from "#store";
import state from "@chocbite/ts-lib/state";
import { ENGINE } from "./index";

const ids = (rows: { ok(): { ok(): { id: string } }[] } | undefined) => rows?.ok().map((s) => s.ok().id);

describe("engine", () => {
  it("changes only the state of what changed, saves it, and loads it back", async () => {
    const id = (await ENGINE.create(QUICK_GAME, "test")).unwrap();
    const goose = ENGINE.node("loc:the-wayward-goose")!;
    const mill = ENGINE.node("loc:the-old-mill")!;
    const crossroads = ENGINE.children("loc:ashen-crossroads")!;
    const rows = crossroads.ok();
    let mill_heard = 0;
    mill.sub(() => mill_heard++);

    (await ENGINE.edit_world([{ op: "update", thing: "loc:the-wayward-goose", field: "name", value: "The Goose" }])).unwrap();
    expect(goose.ok().name).toBe("The Goose");
    expect(ENGINE.node("loc:the-wayward-goose")).toBe(goose);
    //The same array of the same states, the list only hears that a row changed
    expect(crossroads.ok()).toBe(rows);
    expect(crossroads.ok()[0]).toBe(goose);
    expect(mill_heard).toBe(0);

    (await ENGINE.edit_world([{ op: "add_memory", character: "char:tamsin-vell", memory: "one" }])).unwrap();
    (await ENGINE.edit_world([{ op: "add_memory", character: "char:tamsin-vell", memory: "two" }])).unwrap();
    expect(ENGINE.world.memories("char:tamsin-vell")).toEqual(["one", "two"]);

    //A move changes the children of both parents, the moved thing keeps its state
    const compass = ENGINE.node("item:brass-compass")!;
    (await ENGINE.edit_world([{ op: "move", thing: "item:brass-compass", in: "char:tamsin-vell" }])).unwrap();
    expect(ids(ENGINE.children("item:ink-stained-satchel"))).toEqual(["item:unfinished-map"]);
    expect(ids(ENGINE.children("char:tamsin-vell"))).toEqual(["item:ink-stained-satchel", "item:brass-compass"]);
    expect(ENGINE.children("char:tamsin-vell")!.ok()[1]).toBe(compass);

    //A list moves rows by writing a move to the rows state
    (await ENGINE.children("char:tamsin-vell")!.write(state.a.write.move(1, 0, 1))).unwrap();
    expect(ids(ENGINE.children("char:tamsin-vell"))).toEqual(["item:brass-compass", "item:ink-stained-satchel"]);
    //The top level rows start with Global, which stays first
    (await ENGINE.roots.write(state.a.write.move(1, 2, 1))).unwrap();
    expect(ids(ENGINE.roots)).toEqual(["global", "loc:the-old-mill", "loc:ashen-crossroads"]);
    expect((await ENGINE.roots.write(state.a.write.move(0, 2, 1))).err).toBe(true);
    //A list moves rows to another parent by inserting them there, the engine takes them out of the old one
    (await ENGINE.children("loc:the-old-mill")!.write(state.a.write.push(compass))).unwrap();
    expect(ids(ENGINE.children("char:tamsin-vell"))).toEqual(["item:ink-stained-satchel"]);
    expect(ids(ENGINE.children("loc:the-old-mill"))).toEqual(["char:edric-2", "item:brass-compass"]);
    //A location can not go into an item, nothing changes
    expect((await ENGINE.children("item:ink-stained-satchel")!.write(state.a.write.splice(0, 0, ENGINE.node("loc:the-old-mill")!))).err).toBe(true);
    expect(ids(ENGINE.roots)).toEqual(["global", "loc:the-old-mill", "loc:ashen-crossroads"]);

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
    expect(ids(ENGINE.roots)).toEqual(["global", "loc:the-old-mill", "loc:ashen-crossroads"]);
    expect(ids(ENGINE.children("loc:the-old-mill"))).toEqual(["char:edric-2", "item:brass-compass"]);
    expect(ENGINE.history.ok().map((r) => r.n)).toEqual([0]);
    expect(ENGINE.round.ok()?.n).toBe(1);

    //Entry lists keep the state of an entry that did not change
    const tamsin_skills = ENGINE.skills("char:tamsin-vell");
    const cartography = tamsin_skills.ok()[0];
    (await ENGINE.edit_world([{ op: "set_skill", thing: "char:tamsin-vell", skill: "skill:perception", value: 50 }])).unwrap();
    expect(tamsin_skills.ok()[0]).toBe(cartography);
    expect(tamsin_skills.ok().map((s) => [s.ok().skill, s.ok().value])).toEqual([
      ["skill:cartography", 70],
      ["skill:perception", 50],
      ["skill:persuasion", 30],
    ]);
    expect(ids(ENGINE.children("group:skills"))?.length).toBe(5);
    expect(ENGINE.world.settings.time).toBe(19 * 60 + 30);

    ENGINE.close();
    await store_delete_game(id);
  });
});
