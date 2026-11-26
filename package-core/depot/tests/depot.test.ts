import type { StateArrayRead, StateArrayReadTypes } from "#state";
import state, {
  STATE_ARRAY_READ_KEY,
  type StateOrVal,
  type StateRES,
  type StateROS,
} from "#state";
import { NiceError } from "#result";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import depot, {
  type DepotChild,
  type DepotEntry,
  type DepotGroup,
  type DepotNode,
  type DepotSourceChild,
  type DepotSourceEntry,
  type DepotSourceGroup,
} from "..";

afterEach(() => {
  for (const type of [...depot.types.ok()])
    if (type !== depot.states) type.remove();
  for (const child of [...children_of(depot.states)]) child.remove();
});

/**The children of a group now, a constant or the value of their state*/
const children_of = <T>(group: {
  children: readonly T[] | StateROS<readonly T[]>;
}): readonly T[] =>
  state.is.state(group.children) ? group.children.ok() : group.children;

/**The children state of a registered group, which always has one*/
const children_state = <T>(group: {
  children: readonly T[] | StateROS<readonly T[]>;
}): StateROS<readonly T[]> => {
  if (!state.is.state(group.children))
    throw new Error("Registered groups have a children state");
  return group.children;
};

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
    expect(children_of(basic)).toEqual([rect]);
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
    expect(children_of(widgets)).toEqual([b, a]);
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
    expect(children_of(widgets)).toEqual([]);
  });

  it("accepts letters, digits, _ and -", () => {
    const widgets = depot.type("widgets", "", "");
    expect(widgets.add("aZ0_-", "", "", 1).id).toBe("aZ0_-");
  });
});

describe("content", () => {
  it("keeps a value that is not a state as it is, without a state", () => {
    const entry = depot.type<number>("t", "", "").add("e", "", "", 5);
    expect(entry.value).toBe(5);
  });

  it("keeps a given state", async () => {
    const value = state.from_w(5);
    const entry = depot.type<number>("t", "", "").add("e", "", "", value);
    expect(entry.value).toBe(value);
    value.set_err(new NiceError(Symbol("Test error"), "gone"));
    expect((await state.as_state(entry.value).read()).err).toBe(true);
  });

  it("types the content by the type", () => {
    const entry = depot.type<number>("t", "", "").add("e", "", "", 5);
    expectTypeOf(entry).toEqualTypeOf<DepotEntry<number>>();
    expectTypeOf(entry.value).toEqualTypeOf<StateOrVal<number>>();
    // @ts-expect-error content must match the type
    depot.type<number>("u", "", "").add("e", "", "", "text");
  });

  it("keeps the type of the content given to add for object types", () => {
    interface Definition {
      create(): string;
    }
    const type = depot.type<Definition>("t", "", "");
    const entry = type.add("e", "", "", { create: () => "a", size: 1 });
    expectTypeOf(entry).toEqualTypeOf<
      DepotEntry<{ create: () => string; size: number }>
    >();
    // @ts-expect-error content must still match the type
    type.add("f", "", "", { size: 1 });
  });
});

describe("removing", () => {
  it("removes an entry and frees its id", () => {
    const widgets = depot.type("widgets", "", "");
    const entry = widgets.add("a", "", "", 1);
    entry.remove();
    expect(entry.removed).toBe(true);
    expect(children_of(widgets)).toEqual([]);
    expect(widgets.add("a", "", "", 2)).not.toBe(entry);
  });

  it("removing a group removes everything below it", () => {
    const widgets = depot.type("widgets", "", "");
    const a = widgets.group("a", "", "");
    const b = a.group("b", "", "");
    const c = b.add("c", "", "", 1);
    a.remove();
    expect([a.removed, b.removed, c.removed]).toEqual([true, true, true]);
    expect(children_of(widgets)).toEqual([]);
    expect(children_of(a)).toEqual([]);
    expect(children_of(b)).toEqual([]);
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
    expect(children_of(widgets)).toEqual([again]);
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
    const list = changes<DepotChild<number>>(children_state(widgets));
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
    expect(children_of(widgets)).toEqual([rect]);
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
    children_state(widgets).sub(() => calls++);
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
    expect(children_of(machine).length).toBe(3);
  });

  it("its groups and entries can be removed", () => {
    const machine = depot.states.group("machine", "", "");
    const speed = machine.add("speed", "", "", state.ok(5));
    machine.remove();
    expect(speed.removed).toBe(true);
    expect(children_of(depot.states)).toEqual([]);
  });
});

describe("icons", () => {
  it("can not be given without ts-lib-ui", () => {
    const t = depot.type("t", "", "");
    // @ts-expect-error icons are typed by ts-lib-ui
    t.group("g", "", "", () => null);
    expect(children_of(t).length).toBe(1);
  });
});

describe("providers", () => {
  /**Value of a lookup now, undefined while it is an error*/
  const at = (path: string) => depot.get(path).get().unwrap_or(undefined);

  /**A constant source, a group with an entry and a sub group with an entry*/
  const constant = (): DepotSourceGroup<number> => ({
    name: "Root",
    description: "A constant source",
    children: [
      { id: "a", source: { name: "A", description: "", value: 1 } },
      {
        id: "sub",
        source: {
          name: "Sub",
          description: "",
          children: [
            { id: "b", source: { name: "B", description: "", value: 2 } },
          ],
        },
      },
    ],
  });

  it("mounts a source, its items are looked up and listed through it", () => {
    const t = depot.type<number>("t", "", "");
    const root = t.provide("root", constant());
    expect(root.kind).toBe("group");
    expect(root.path).toBe("/t/root");
    expect(root.name).toBe("Root");
    expect(children_of(t)).toEqual([root]);
    const b = at("/t/root/sub/b") as DepotEntry<number>;
    expect(b.kind).toBe("entry");
    expect(b.path).toBe("/t/root/sub/b");
    expect(b.name).toBe("B");
    expect(b.value).toBe(2);
    //A constant source gives constants, not states
    const listed = (root as DepotGroup<number>).children;
    expect(state.is.state(listed)).toBe(false);
    expect(
      (listed as readonly DepotChild<number>[]).map((child) => child.id),
    ).toEqual(["a", "sub"]);
  });

  it("gives the same node for the same path while the source object is the same", () => {
    const t = depot.type<number>("t", "", "");
    const root = t.provide("root", constant()) as DepotGroup<number>;
    const looked = at("/t/root/a");
    expect(at("/t/root/a")).toBe(looked);
    expect(children_of(root)[0]).toBe(looked);
  });

  it("makes nodes only for what is looked up, a source with child is not listed", () => {
    let listed = 0;
    const entry = { name: "E", description: "", value: 1 };
    //Counts going through the children, reading the property to see it is not a state is fine
    const children: DepotSourceChild<number>[] = [];
    children.find = () => (listed++, undefined);
    children[Symbol.iterator] = () => (listed++, [][Symbol.iterator]());
    const t = depot.type<number>("t", "", "");
    t.provide("big", {
      name: "",
      description: "",
      children,
      child: (id) => (id === "e" ? entry : undefined),
    });
    expect((at("/t/big/e") as DepotEntry<number>).value).toBe(1);
    expect(at("/t/big/x")).toBeUndefined();
    expect(listed).toBe(0);
  });

  it("walks a recursive source, each path its own node", () => {
    const leaf: DepotSourceEntry<number> = {
      name: "",
      description: "",
      value: 7,
    };
    const loop: DepotSourceGroup<number> = {
      name: "",
      description: "",
      children: [],
      child: (id) => (id === "loop" ? loop : id === "leaf" ? leaf : undefined),
    };
    depot.type<number>("t", "", "").provide("loop", loop);
    const deep = at("/t/loop/loop/loop/leaf") as DepotEntry<number>;
    expect(deep.path).toBe("/t/loop/loop/loop/leaf");
    expect(deep.value).toBe(7);
    expect(at("/t/loop/leaf")).not.toBe(deep);
  });

  it("follows a source whose children are a state", () => {
    const children = state.ok_w<DepotSourceChild<number>[]>([]);
    const t = depot.type<number>("t", "", "");
    const root = t.provide("root", {
      name: "",
      description: "",
      children,
    }) as DepotGroup<number>;
    const lookup = depot.get("/t/root/x");
    expect(lookup.get().err).toBe(true);
    const listed = root.children as StateROS<readonly DepotChild<number>[]>;
    expect(listed.ok()).toEqual([]);
    //Added
    const x = { name: "X", description: "", value: 1 };
    children.set_ok([{ id: "x", source: x }]);
    const node = lookup.get().unwrap_or(undefined);
    expect(node?.path).toBe("/t/root/x");
    expect(listed.ok()).toEqual([node]);
    //Another object under the same id is another node, the old one is removed
    children.set_ok([{ id: "x", source: { ...x } }]);
    const again = lookup.get().unwrap_or(undefined);
    expect(again).not.toBe(node);
    expect(node?.removed).toBe(true);
    //Removed
    children.set_ok([]);
    expect(lookup.get().err).toBe(true);
    expect(again?.removed).toBe(true);
    expect(listed.ok()).toEqual([]);
  });

  it("gives the name state of the source, so a rename shows", () => {
    const name = state.ok_w("Old");
    const t = depot.type<number>("t", "", "");
    t.provide("root", {
      name: "",
      description: "",
      children: [{ id: "e", source: { name, description: "", value: 1 } }],
    });
    const e = at("/t/root/e") as DepotEntry<number>;
    expect(e.name).toBe(name);
    name.set_ok("New");
    expect((e.name as StateROS<string>).ok()).toBe("New");
  });

  it("is read only in the depot, the source decides", () => {
    const t = depot.type<number>("t", "", "");
    const registered = t.add("r", "", "", 1);
    const root = t.provide("root", constant()) as DepotGroup<number>;
    const a = at("/t/root/a") as DepotEntry<number>;
    expect(() => root.add("x", "", "", 1)).toThrow("provided");
    expect(() => root.group("x", "", "")).toThrow("provided");
    expect(() => root.alias("x", registered)).toThrow("provided");
    expect(() => root.provide("x", constant())).toThrow("provided");
    expect(() => a.remove()).toThrow("provided");
    expect(() => t.alias("x", a)).toThrow("provided");
  });

  it("leaves out children whose id is not a valid depot id", () => {
    const t = depot.type<number>("t", "", "");
    const root = t.provide("root", {
      name: "",
      description: "",
      children: [
        { id: "a b", source: { name: "", description: "", value: 1 } },
        { id: "ok", source: { name: "", description: "", value: 2 } },
      ],
    }) as DepotGroup<number>;
    expect(children_of(root).map((child) => child.id)).toEqual(["ok"]);
    expect(depot.get("/t/root/a b").get().err).toBe(true);
  });

  it("unmounts when its node is removed, and stops following the source", () => {
    const children = state.ok_w<DepotSourceChild<number>[]>([
      { id: "x", source: { name: "", description: "", value: 1 } },
    ]);
    const t = depot.type<number>("t", "", "");
    const root = t.provide("root", { name: "", description: "", children });
    const x = at("/t/root/x")!;
    root.remove();
    expect(root.removed).toBe(true);
    expect(x.removed).toBe(true);
    expect(depot.get("/t/root/x").get().err).toBe(true);
    expect(children.in_use()).toBeUndefined();
    //The id is free for another mount
    t.provide("root", constant());
    expect(at("/t/root/a")?.path).toBe("/t/root/a");
  });

  it("mounts an entry source", () => {
    const t = depot.type<number>("t", "", "");
    const e = t.provide("e", { name: "E", description: "", value: 3 });
    expect(e.kind).toBe("entry");
    expect((e as DepotEntry<number>).value).toBe(3);
    expect(at("/t/e")).toBe(e);
  });

  it("types the content of a source by the type", () => {
    const t = depot.type<number>("t", "", "");
    // @ts-expect-error content must match the type
    t.provide("e", { name: "", description: "", value: "text" });
  });
});
