import { describe, expect, it } from "vitest";
import { QUICK_GAME } from "#quick";
import { store_delete_game, store_load } from "#store";
import state from "@chocbite/ts-lib/state";
import { world_apply, world_empty } from "#world";
import { ENGINE } from "./index";

/**Real id of a temporary id of the quick game, the ids are the same every time the quick game is made*/
const QUICK_IDS = world_apply(world_empty(), QUICK_GAME.changes).ids;
const q = (temp: string) => QUICK_IDS.get("new:" + temp)!;

const ids = (rows: { ok(): { ok(): { id: string } }[] } | undefined) => rows?.ok().map((s) => s.ok().id);

describe("engine", () => {
  it("changes only the state of what changed, saves it, and loads it back", async () => {
    const id = (await ENGINE.create(QUICK_GAME, "test")).unwrap();
    const goose = ENGINE.node(q("goose"))!;
    const mill = ENGINE.node(q("mill"))!;
    const crossroads = ENGINE.children(q("crossroads"))!;
    const rows = crossroads.ok();
    let mill_heard = 0;
    mill.sub(() => mill_heard++);

    (await ENGINE.edit_world([{ op: "update", thing: q("goose"), field: "name", value: "The Goose" }])).unwrap();
    expect(goose.ok().name).toBe("The Goose");
    expect(ENGINE.node(q("goose"))).toBe(goose);
    //The same array of the same states, the list only hears that a row changed
    expect(crossroads.ok()).toBe(rows);
    expect(crossroads.ok()[0]).toBe(goose);
    expect(mill_heard).toBe(0);

    (await ENGINE.edit_world([{ op: "add_memory", character: q("tamsin"), memory: "one" }])).unwrap();
    (await ENGINE.edit_world([{ op: "add_memory", character: q("tamsin"), memory: "two" }])).unwrap();
    expect(ENGINE.world.memories(q("tamsin"))).toEqual(["one", "two"]);

    //A move changes the children of both parents, the moved thing keeps its state
    const compass = ENGINE.node(q("compass"))!;
    (await ENGINE.edit_world([{ op: "move", thing: q("compass"), in: q("tamsin") }])).unwrap();
    expect(ids(ENGINE.children(q("satchel")))).toEqual([q("map")]);
    expect(ids(ENGINE.children(q("tamsin")))).toEqual([q("satchel"), q("compass")]);
    expect(ENGINE.children(q("tamsin"))!.ok()[1]).toBe(compass);

    //A list moves rows by writing a move to the rows state
    (await ENGINE.children(q("tamsin"))!.write(state.a.write.move(1, 0, 1))).unwrap();
    expect(ids(ENGINE.children(q("tamsin")))).toEqual([q("compass"), q("satchel")]);
    //The top level rows start with Global, which stays first
    (await ENGINE.roots.write(state.a.write.move(1, 2, 1))).unwrap();
    expect(ids(ENGINE.roots)).toEqual(["global", q("mill"), q("crossroads")]);
    expect((await ENGINE.roots.write(state.a.write.move(0, 2, 1))).err).toBe(true);
    //A list moves rows to another parent by inserting them there, the engine takes them out of the old one
    (await ENGINE.children(q("mill"))!.write(state.a.write.push(compass))).unwrap();
    expect(ids(ENGINE.children(q("tamsin")))).toEqual([q("satchel")]);
    expect(ids(ENGINE.children(q("mill")))).toEqual([q("edric-miller"), q("compass")]);
    //A location can not go into an item, nothing changes
    expect((await ENGINE.children(q("satchel"))!.write(state.a.write.splice(0, 0, ENGINE.node(q("mill"))!))).err).toBe(true);
    expect(ids(ENGINE.roots)).toEqual(["global", q("mill"), q("crossroads")]);

    //All or nothing, a list with a bad change changes nothing
    const bad = await ENGINE.edit_world([
      { op: "update", thing: q("mill"), field: "name", value: "Not saved" },
      { op: "move", thing: "char:nobody", in: q("mill") },
    ]);
    expect(bad.err).toBe(true);
    expect(mill.ok().name).toBe("The Old Mill");

    const records = (await store_load(id)).unwrap();
    expect(records.things.find((t) => t.id === q("goose"))?.name).toBe("The Goose");
    expect(records.game.roots).toEqual([q("mill"), q("crossroads")]);
    expect(records.memories.map((m) => [m.n, m.text])).toEqual([
      [0, "one"],
      [1, "two"],
    ]);

    (await ENGINE.load(id)).unwrap();
    expect(ENGINE.world.location(q("goose"))?.name).toBe("The Goose");
    expect(ENGINE.world.memories(q("tamsin"))).toEqual(["one", "two"]);
    expect(ids(ENGINE.roots)).toEqual(["global", q("mill"), q("crossroads")]);
    expect(ids(ENGINE.children(q("mill")))).toEqual([q("edric-miller"), q("compass")]);
    expect(ENGINE.history.ok().map((r) => r.n)).toEqual([0]);
    expect(ENGINE.round.ok()?.n).toBe(1);

    //Entry lists keep the state of an entry that did not change
    const tamsin_skills = ENGINE.skills(q("tamsin"));
    const cartography = tamsin_skills.ok()[0];
    (await ENGINE.edit_world([{ op: "set_skill", thing: q("tamsin"), skill: q("perception"), value: 50 }])).unwrap();
    expect(tamsin_skills.ok()[0]).toBe(cartography);
    expect(tamsin_skills.ok().map((s) => [s.ok().skill, s.ok().value])).toEqual([
      [q("cartography"), 70],
      [q("perception"), 50],
      [q("persuasion"), 30],
    ]);
    expect(ids(ENGINE.children("group:skills"))?.length).toBe(5);
    expect(ENGINE.world.settings.time).toBe(19 * 60 + 30);

    ENGINE.close();
    await store_delete_game(id);
  });
});
