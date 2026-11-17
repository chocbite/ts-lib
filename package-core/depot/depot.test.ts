import type { StateArrayRead, StateArrayReadTypes } from "#state";
import state, {
  STATE_ARRAY_READ_KEY,
  type StateREA,
  type StateRES,
  type StateROS,
} from "#state";
import { NiceError } from "#result";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import depot, { type DepotChild, type DepotEntry, type DepotNode } from ".";

afterEach(() => {
  for (const type of [...depot.types.ok()])
    if (type !== depot.states) type.remove();
  for (const child of [...depot.states.children.ok()]) child.remove();
});

/**Collects the array changes a children state gives its subscribers*/
const changes = <T>(children: StateROS<readonly T[]>) => {
  const list: StateArrayReadTypes<T>[][] = [];
  children.sub(({ value }) => {
    const read = (value as StateArrayRead<T>)[STATE_ARRAY_READ_KEY];
    if (read) list.push(read.map((r) => ({ ...r, items: [...r.items] })));
  });
  return list;
};

describe("registration", () => {
  it("registers types, groups and entries", () => {
    const widgets = depot.type<number>("widgets", "Widgets", "Things");
    const basic = widgets.group("basic", "Basic", "Basic shapes");
    const rect = basic.add("rectangle", "Rectangle", "A rectangle", 5);
    expect(widgets.kind).toBe("type");
    expect(basic.kind).toBe("group");
    expect(rect.kind).toBe("entry");
    expect(rect.name).toBe("Rectangle");
    expect(rect.description).toBe("A rectangle");
    expect(rect.parent).toBe(basic);
    expect(basic.parent).toBe(widgets);
    expect(widgets.parent).toBeUndefined();
    expect(depot.types.ok()).toEqual([depot.states, widgets]);
    expect(basic.children.ok()).toEqual([rect]);
  });

  it("builds paths by walking up the parents", () => {
    const widgets = depot.type("widgets", "", "");
    const a = widgets.group("a", "", "");
    const b = a.group("b", "", "");
    expect(widgets.path).toBe("/widgets");
    expect(a.path).toBe("/widgets/a");
    expect(b.add("c", "", "", 1).path).toBe("/widgets/a/b/c");
  });

  it("lists children and types in registration order", () => {
    const widgets = depot.type("widgets", "", "");
    const colors = depot.type("colors", "", "");
    const b = widgets.add("b", "", "", 1);
    const a = widgets.group("a", "", "");
    expect(depot.types.ok()).toEqual([depot.states, widgets, colors]);
    expect(widgets.children.ok()).toEqual([b, a]);
  });

  it("throws on a duplicate id in the same group and allows it in another", () => {
    const widgets = depot.type("widgets", "", "");
    const a = widgets.group("a", "", "");
    a.add("x", "", "", 1);
    expect(() => a.add("x", "", "", 2)).toThrow("/widgets/a/x");
    expect(() => a.group("x", "", "")).toThrow("/widgets/a/x");
    expect(() => widgets.add("a", "", "", 1)).toThrow("/widgets/a");
    expect(widgets.group("b", "", "").add("x", "", "", 1).path).toBe(
      "/widgets/b/x",
    );
  });

  it("throws on a duplicate type", () => {
    depot.type("widgets", "", "");
    expect(() => depot.type("widgets", "", "")).toThrow("widgets");
  });

  it.each(["", "a/b", "a b", "a.b", "æ"])("throws on the id %j", (id) => {
    const widgets = depot.type("widgets", "", "");
    expect(() => widgets.add(id, "", "", 1)).toThrow("invalid");
    expect(() => widgets.group(id, "", "")).toThrow("invalid");
    expect(() => depot.type(id, "", "")).toThrow("invalid");
    expect(widgets.children.ok()).toEqual([]);
  });

  it("accepts letters, digits, _ and -", () => {
    const widgets = depot.type("widgets", "", "");
    expect(widgets.add("aZ0_-", "", "", 1).id).toBe("aZ0_-");
  });
});

describe("content", () => {
  it("wraps a fixed value in a state", async () => {
    const entry = depot.type<number>("t", "", "").add("e", "", "", 5);
    expect((await entry.value).unwrap()).toBe(5);
  });

  it("keeps a given state", async () => {
    const value = state.from_w(5);
    const entry = depot.type<number>("t", "", "").add("e", "", "", value);
    expect(entry.value).toBe(value);
    value.set_err(new NiceError(Symbol("Test error"), "gone"));
    expect((await entry.value).err).toBe(true);
  });

  it("types the content by the type", () => {
    const entry = depot.type<number>("t", "", "").add("e", "", "", 5);
    expectTypeOf(entry).toEqualTypeOf<DepotEntry<number>>();
    expectTypeOf(entry.value).toEqualTypeOf<StateREA<number>>();
    // @ts-expect-error content must match the type
    depot.type<number>("u", "", "").add("e", "", "", "text");
  });
});

describe("removing", () => {
  it("removes an entry and frees its id", () => {
    const widgets = depot.type("widgets", "", "");
    const entry = widgets.add("a", "", "", 1);
    entry.remove();
    expect(entry.removed).toBe(true);
    expect(widgets.children.ok()).toEqual([]);
    expect(widgets.add("a", "", "", 2)).not.toBe(entry);
  });

  it("removing a group removes everything below it", () => {
    const widgets = depot.type("widgets", "", "");
    const a = widgets.group("a", "", "");
    const b = a.group("b", "", "");
    const c = b.add("c", "", "", 1);
    a.remove();
    expect([a.removed, b.removed, c.removed]).toEqual([true, true, true]);
    expect(widgets.children.ok()).toEqual([]);
    expect(a.children.ok()).toEqual([]);
    expect(b.children.ok()).toEqual([]);
  });

  it("removing a type frees its id and removes everything below it", () => {
    const widgets = depot.type("widgets", "", "");
    const entry = widgets.add("a", "", "", 1);
    widgets.remove();
    expect(entry.removed).toBe(true);
    expect(depot.types.ok()).toEqual([depot.states]);
    expect(depot.type("widgets", "", "")).not.toBe(widgets);
  });

  it("a removed group can not get children", () => {
    const widgets = depot.type("widgets", "", "");
    const a = widgets.group("a", "", "");
    const b = a.group("b", "", "");
    a.remove();
    expect(() => a.add("x", "", "", 1)).toThrow("removed");
    expect(() => b.group("x", "", "")).toThrow("removed");
  });

  it("removing twice does nothing", () => {
    const widgets = depot.type("widgets", "", "");
    const entry = widgets.add("a", "", "", 1);
    entry.remove();
    const again = widgets.add("a", "", "", 2);
    entry.remove();
    expect(widgets.children.ok()).toEqual([again]);
  });

  it("a removed node keeps its path", () => {
    const entry = depot
      .type("t", "", "")
      .group("g", "", "")
      .add("e", "", "", 1);
    entry.remove();
    expect(entry.path).toBe("/t/g/e");
  });
});

describe("children state", () => {
  it("tells subscribers what was added and removed", () => {
    const widgets = depot.type<number>("widgets", "", "");
    const list = changes<DepotChild<number>>(widgets.children);
    const a = widgets.add("a", "", "", 1);
    const b = widgets.group("b", "", "");
    a.remove();
    expect(list).toEqual([
      [{ type: "added", index: 0, items: [a] }],
      [{ type: "added", index: 1, items: [b] }],
      [{ type: "removed", index: 0, items: [a] }],
    ]);
  });

  it("the types state follows types being added and removed", () => {
    const seen: number[] = [];
    depot.types.sub(({ value }) => seen.push(value.length));
    const t = depot.type("t", "", "");
    t.remove();
    expect(seen).toEqual([2, 1]);
  });
});

describe("get", () => {
  const node = (s: StateRES<DepotNode<any>>) => s.get().unwrap_or(undefined);
  const error = (s: StateRES<DepotNode<any>>) => {
    const r = s.get();
    return r.err ? r.error : undefined;
  };

  it("gives a state of the node at a path", () => {
    const widgets = depot.type("widgets", "", "");
    const rect = widgets.group("basic", "", "").add("rect", "", "", 1);
    expect(node(depot.get("/widgets"))).toBe(widgets);
    expect(node(depot.get("/widgets/basic/rect"))).toBe(rect);
  });

  it("gives the same state for the same path", () => {
    expect(depot.get("/a/b")).toBe(depot.get("/a/b"));
  });

  it("is an error until registered and after removed", () => {
    const s = depot.get("/widgets/basic/rect");
    expect(error(s)?.kind).toBe(depot.errors.NOT_REGISTERED);
    //Normal use, a path can be held before it is registered, so only a message
    expect(error(s)?.cause).toBeUndefined();
    expect(error(s)?.message).toBe('Depot path "/widgets/basic/rect" is not registered');
    const widgets = depot.type("widgets", "", "");
    const basic = widgets.group("basic", "", "");
    expect(error(s)).toBeDefined();
    const rect = basic.add("rect", "", "", 1);
    expect(node(s)).toBe(rect);
    basic.remove();
    expect(error(s)).toBeDefined();
    const again = widgets.group("basic", "", "").add("rect", "", "", 2);
    expect(node(s)).toBe(again);
    widgets.remove();
    expect(error(s)).toBeDefined();
  });

  it("tells subscribers only when the node changes", () => {
    const seen: unknown[] = [];
    depot.get("/t/a").sub((r) => seen.push(r.ok ? r.value.id : "err"));
    const t = depot.type("t", "", "");
    t.add("b", "", "", 1);
    const a = t.add("a", "", "", 1);
    t.add("c", "", "", 1);
    a.remove();
    expect(seen).toEqual(["a", "err"]);
  });

  it.each(["", "a", "/", "/a/", "//a", "/a b"])(
    "is an error for the invalid path %j",
    (path) => {
      expect(error(depot.get(path))?.kind).toBe(depot.errors.INVALID_PATH);
      //A bug in the code giving the path, the stack shows it
      expect(error(depot.get(path))?.cause?.stack).toContain("depot.test");
      expect(error(depot.get(path))?.message).toBe(`Depot path "${path}" is invalid`);
    },
  );

  it("can not walk through an entry", () => {
    depot.type("t", "", "").add("e", "", "", 1);
    expect(error(depot.get("/t/e/x"))).toBeDefined();
  });

  it("follows an entry being replaced by a group with the same id", () => {
    const t = depot.type("t", "", "");
    const s = depot.get("/t/e/x");
    t.add("e", "", "", 1).remove();
    const x = t.group("e", "", "").add("x", "", "", 1);
    expect(node(s)).toBe(x);
  });

  it("follows changes deep below an alias target", () => {
    const t = depot.type("t", "", "");
    const a = t.group("a", "", "");
    const b = a.group("b", "", "");
    t.alias("short", b);
    const s = depot.get("/t/short/c");
    const c = b.add("c", "", "", 1);
    expect(node(s)).toBe(c);
    a.remove();
    expect(error(s)).toBeDefined();
  });

  it("a type gives typed states of paths inside it", () => {
    const widgets = depot.type<number>("widgets", "", "");
    const rect = widgets.group("basic", "", "").add("rect", "", "", 1);
    const s = widgets.get("/basic/rect");
    expectTypeOf(s).toEqualTypeOf<StateRES<DepotNode<number>>>();
    expect(node(s)).toBe(rect);
    expect(widgets.get("/basic/rect")).toBe(s);
  });

  it("the lookups of a removed type stay errors when the id is registered again", () => {
    const old = depot.type("t", "", "");
    const s = old.get("/a");
    old.remove();
    depot.type("t", "", "").add("a", "", "", 1);
    expect(error(s)?.kind).toBe(depot.errors.TYPE_REMOVED);
    //Not supposed to happen, so a full Error
    expect(error(s)?.cause).toBeInstanceOf(Error);
    expect(error(s)?.message).toBe('Depot type "t" is removed');
    expect(node(depot.get("/t/a"))).toBeDefined();
  });
});

describe("aliases", () => {
  const node = (s: StateRES<DepotNode<any>>) => s.get().unwrap_or(undefined);

  it("the alias path gives the target", () => {
    const widgets = depot.type("widgets", "", "");
    const basic = widgets.group("basic", "", "");
    const rect = basic.add("rectangle", "", "", 1);
    const alias = basic.alias("rect", rect);
    expect(alias.kind).toBe("alias");
    expect(alias.target).toBe(rect);
    expect(alias.path).toBe("/widgets/basic/rect");
    expect(node(depot.get("/widgets/basic/rect"))).toBe(rect);
  });

  it("is not listed among the children", () => {
    const widgets = depot.type("widgets", "", "");
    const rect = widgets.add("rectangle", "", "", 1);
    widgets.alias("rect", rect);
    expect(widgets.children.ok()).toEqual([rect]);
  });

  it("an alias of a group resolves paths below it", () => {
    const widgets = depot.type("widgets", "", "");
    const shapes = widgets.group("shapes", "", "");
    const rect = shapes.add("rect", "", "", 1);
    widgets.alias("basic", shapes);
    expect(node(depot.get("/widgets/basic/rect"))).toBe(rect);
  });

  it("works for a resource moved to another group", () => {
    const widgets = depot.type("widgets", "", "");
    const old = widgets.group("old", "", "");
    const fresh = widgets.group("new", "", "");
    const s = depot.get("/widgets/old/rect");
    old.add("rect", "", "", 1).remove();
    const rect = fresh.add("rect", "", "", 1);
    old.alias("rect", rect);
    expect(node(s)).toBe(rect);
  });

  it("is an error once the target is removed", () => {
    const widgets = depot.type("widgets", "", "");
    const basic = widgets.group("basic", "", "");
    const rect = basic.add("rectangle", "", "", 1);
    widgets.alias("rect", rect);
    const s = depot.get("/widgets/rect");
    basic.remove();
    expect(s.get().err).toBe(true);
  });

  it("shares the id space of the group", () => {
    const widgets = depot.type("widgets", "", "");
    const rect = widgets.add("rect", "", "", 1);
    const other = widgets.add("other", "", "", 1);
    expect(() => widgets.alias("rect", other)).toThrow("already registered");
    widgets.alias("r", rect);
    expect(() => widgets.add("r", "", "", 1)).toThrow("already registered");
  });

  it("removing an alias frees its id and keeps the target", () => {
    const widgets = depot.type("widgets", "", "");
    const rect = widgets.add("rect", "", "", 1);
    const alias = widgets.alias("r", rect);
    const s = depot.get("/widgets/r");
    alias.remove();
    expect(s.get().err).toBe(true);
    expect(rect.removed).toBe(false);
    expect(widgets.add("r", "", "", 1).path).toBe("/widgets/r");
  });

  it("removing an alias does not change the children state", () => {
    const widgets = depot.type("widgets", "", "");
    const rect = widgets.add("rect", "", "", 1);
    const alias = widgets.alias("r", rect);
    let calls = 0;
    widgets.children.sub(() => calls++);
    alias.remove();
    expect(calls).toBe(0);
  });

  it("throws for a removed target or a target in another type", () => {
    const a = depot.type("a", "", "");
    const b = depot.type("b", "", "");
    const in_b = b.add("x", "", "", 1);
    expect(() => a.alias("x", in_b)).toThrow("not in the type");
    in_b.remove();
    expect(() => b.alias("y", in_b)).toThrow("removed");
  });
});

describe("states type", () => {
  it("is registered by the depot", () => {
    expect(depot.states.kind).toBe("type");
    expect(depot.states.path).toBe("/states");
    expect(depot.types.ok()[0]).toBe(depot.states);
    expect(depot.get("/states").get().unwrap_or(undefined)).toBe(depot.states);
  });

  it("can not be removed or registered again", () => {
    expect(() => depot.states.remove()).toThrow("can not be removed");
    expect(depot.states.removed).toBe(false);
    expect(() => depot.type("states", "", "")).toThrow("already registered");
  });

  it("the content of an entry is the registered state itself", () => {
    const speed = state.ok_w(5);
    const machine = depot.states.group("machine", "Machine", "");
    const entry = machine.add("speed", "Speed", "rpm", speed);
    expect(entry.value).toBe(speed);
    expect(depot.get("/states/machine/speed").get().unwrap_or(undefined)).toBe(
      entry,
    );
  });

  it("takes states of any type", () => {
    const machine = depot.states.group("machine", "", "");
    machine.add("speed", "", "", state.ok(5));
    machine.add("name", "", "", state.from_w("a"));
    machine.add("fixed", "", "", true);
    expect(machine.children.ok().length).toBe(3);
  });

  it("its groups and entries can be removed", () => {
    const machine = depot.states.group("machine", "", "");
    const speed = machine.add("speed", "", "", state.ok(5));
    machine.remove();
    expect(speed.removed).toBe(true);
    expect(depot.states.children.ok()).toEqual([]);
  });
});

describe("icons", () => {
  it("can not be given without ts-lib-ui", () => {
    const t = depot.type("t", "", "");
    // @ts-expect-error icons are typed by ts-lib-ui
    t.group("g", "", "", () => null);
    expect(t.children.ok().length).toBe(1);
  });
});
