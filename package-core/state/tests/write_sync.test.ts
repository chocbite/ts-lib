import { err, err_nice, NiceError, ok } from "#result";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  state as st,
  type State,
  type StateOrValRESWS,
  type StateOrValROSWS,
  type StateRES,
  type StateResult,
  type StateRESW,
  type StateRESWS,
  type StateROSW,
  type StateROSWS,
} from "..";
import { TEST_ERROR } from "./tests_shared";

const refused = () => new NiceError(TEST_ERROR, "refused");

describe("States that write synchronously", function () {
  it("ok_w, from_w and err_w write synchronously", function () {
    const a = st.ok_w(1);
    const b = st.from_w(1);
    const c = st.err_w<number>(refused());
    expectTypeOf(a).toMatchTypeOf<StateROSWS<number>>();
    expectTypeOf(b).toMatchTypeOf<StateRESWS<number>>();
    expectTypeOf(c).toMatchTypeOf<StateRESWS<number>>();
    expect([a.wsync, b.wsync, c.wsync]).toEqual([true, true, true]);
    expect(a.write_sync(2)).toEqual(ok(undefined));
    expect(a.ok()).toBe(2);
    expect(b.write_sync(2)).toEqual(ok(undefined));
    expect(b.get()).toEqual(ok(2));
    expect(c.write_sync(2)).toEqual(ok(undefined));
    expect(c.get()).toEqual(ok(2));
  });
  it("rosws and resws write synchronously, also when lazy", function () {
    const a = st.rosws(ok(1));
    const b = st.resws(() => ok(1));
    expect(a.write_sync(2)).toEqual(ok(undefined));
    expect(b.write_sync(3)).toEqual(ok(undefined));
    expect([a.ok(), b.get()]).toEqual([2, ok(3)]);
  });
  it("tells subscribers before write_sync returns", function () {
    const state = st.ok_w(1);
    const seen: number[] = [];
    state.sub((v) => seen.push(v.value));
    state.write_sync(2);
    expect(seen).toEqual([2]);
  });
  it("write calls the function of then at once", function () {
    const state = st.ok_w(1);
    let result: StateResult<void> | undefined;
    void state.write(2).then((r) => (result = r));
    expect(result).toEqual(ok(undefined));
    expect(state.ok()).toBe(2);
  });
  it("applies array write instructions", function () {
    const state = st.ok_w([1, 2, 3]);
    expect(state.write_sync(st.a.write.splice(1, 1))).toEqual(ok(undefined));
    expect(state.ok()).toEqual([1, 3]);
    expect(state.write_sync(st.a.write.push(4))).toEqual(ok(undefined));
    expect(state.ok()).toEqual([1, 3, 4]);
  });
  it("applies object write instructions", function () {
    const state = st.ok_w<Record<string, number>>({ a: 1 });
    expect(state.write_sync(st.o.write.add({ b: 2 }))).toEqual(ok(undefined));
    expect(state.ok()).toEqual({ a: 1, b: 2 });
  });
});

describe("Sync setters", function () {
  it("a custom setter gives its result directly", function () {
    const state = st.rosws(ok(1), (value: number, owner) => {
      if (value > 3) return err(refused());
      owner.set_ok(value);
      return ok(undefined);
    });
    expect(state.write_sync(2)).toEqual(ok(undefined));
    expect(state.ok()).toBe(2);
    expect(state.write_sync(4)).toEqual(err(refused()));
    expect(state.ok()).toBe(2);
  });
  it("only takes a setter that gives its result directly", function () {
    const compile_only = () => {
      // @ts-expect-error an async setter can not write synchronously
      st.rosws(ok(1), async () => ok(undefined));
      const state = st.ok_w(1);
      // @ts-expect-error an async setter can not write synchronously
      state.setter = async () => ok(undefined);
    };
    expect(compile_only).toBeTypeOf("function");
  });
  it("the setter can be changed", function () {
    const state = st.ok_w(1);
    state.setter = () => err(refused());
    expect(state.write_sync(2)).toEqual(err(refused()));
    expect(state.ok()).toBe(1);
  });
});

describe("The write gate of a state that writes synchronously", function () {
  it("refuses writes and checks while it is closed", function () {
    const gate = st.ok_w(false);
    const state = st.ok_w(1);
    state.set_write_enabled(gate);
    const disabled = err_nice(st.errors.WRITE_DISABLED, "writing is disabled");
    expect(state.write_sync(2)).toEqual(disabled);
    expect(state.check_sync(2)).toEqual(disabled);
    expect(state.ok()).toBe(1);
    gate.write_sync(true);
    expect(state.write_sync(2)).toEqual(ok(undefined));
    expect(state.check_sync(3)).toEqual(ok(3));
  });
  it("is closed when it is in error", function () {
    const state = st.ok_w(1);
    state.set_write_enabled(st.err<boolean>(refused()));
    expect(state.write_sync(2).err).toBe(true);
  });
  it("must be a sync state", function () {
    const state = st.ok_w(1);
    const compile_only = () => {
      // @ts-expect-error an async gate can not be read synchronously
      state.set_write_enabled(st.roa(async () => ok(true)));
    };
    expect(compile_only).toBeTypeOf("function");
    state.set_write_enabled(st.ok(true));
    expectTypeOf(state.write_enabled).toEqualTypeOf<StateRES<boolean> | undefined>();
  });
});

describe("Helpers of states that write synchronously", function () {
  it("a number helper with sync limits checks and limits synchronously", function () {
    const max = st.ok_w(5);
    const state = st.rosws(st.n.help(ok(0), { max, step: st.ok(1) }));
    expect(state.write_sync(6)).toEqual(
      err_nice(st.errors.ABOVE_MAX, "6 is bigger than the limit of 5"),
    );
    expect(state.ok()).toBe(0);
    expect(state.write_sync(1.5).err).toBe(true);
    expect(state.check_sync(4)).toEqual(ok(4));
    expect(state.limit_sync(7)).toEqual(ok(5));
    expect(state.write_sync(5)).toEqual(ok(undefined));
    max.write_sync(10);
    expect(state.write_sync(7)).toEqual(ok(undefined));
    expect(state.ok()).toBe(7);
  });
  it("a number helper with an async limit can not be the helper", function () {
    const compile_only = () => {
      // @ts-expect-error max can not be read synchronously
      st.rosws(st.n.help(ok(0), { max: st.roa(async () => ok(5)) }));
    };
    expect(compile_only).toBeTypeOf("function");
    //unit is not checked, so it can be async
    st.rosws(st.n.help(ok(0), { max: st.ok(5), unit: st.roa(async () => ok("m")) }));
  });
  it("a string helper with sync limits", function () {
    const state = st.resws(st.s.help(ok("a"), { max_length: st.ok(3) }));
    expect(state.write_sync("abcd").err).toBe(true);
    expect(state.limit_sync("abcd")).toEqual(ok("abc"));
    expect(state.write_sync("abc")).toEqual(ok(undefined));
    expect(state.get()).toEqual(ok("abc"));
    const compile_only = () => {
      // @ts-expect-error max_length can not be read synchronously
      st.resws(st.s.help(ok("a"), { max_length: st.roa(async () => ok(3)) }));
    };
    expect(compile_only).toBeTypeOf("function");
  });
  it("an enum helper with a sync list", function () {
    const list = st.e.list<"a" | "b">({ a: { name: "A" }, b: { name: "B" } });
    const state = st.rosws(st.e.help(ok<"a" | "b">("a"), { list: st.ok(list) }));
    expect(state.write_sync("b")).toEqual(ok(undefined));
    expect(state.write_sync("c" as "a")).toEqual(
      err_nice(st.errors.NOT_IN_LIST, "c is not in list"),
    );
    expect(state.ok()).toBe("b");
    const compile_only = () => {
      // @ts-expect-error the list can not be read synchronously
      st.rosws(st.e.help(ok<"a" | "b">("a"), { list: st.roa(async () => ok(list)) }));
    };
    expect(compile_only).toBeTypeOf("function");
  });
  it("array and bool helpers are always sync", function () {
    const items = st.rosws(st.a.help(ok([1, 2])));
    expect(items.write_sync(st.a.write.push(3))).toEqual(ok(undefined));
    expect(items.ok()).toEqual([1, 2, 3]);
    expect(items.related().unwrap().length.ok()).toBe(3);
    const flag = st.rosws(st.b.help(ok(false)));
    expect(flag.write_sync(true)).toEqual(ok(undefined));
  });
  it("the async methods give the same answers", async function () {
    const state = st.rosws(st.n.help(ok(0), { max: st.ok(5) }));
    expect(await state.check(6)).toEqual(state.check_sync(6));
    expect(await state.limit(6)).toEqual(state.limit_sync(6));
    expect(await state.write(6)).toEqual(state.write_sync(6));
  });
  it("the async helper methods still work with async limits", async function () {
    const state = st.rosw(st.n.help(ok(0), { max: st.roa(async () => ok(5)) }));
    expect((await state.write(6)).err).toBe(true);
    expect(await state.write(5)).toEqual(ok(undefined));
  });
});

describe("Sync write types", function () {
  it("are assignable to the writable sync types", function () {
    const ros: StateROSW<number> = st.ok_w(1);
    const res: StateRESW<number> = st.from_w(1);
    const res_ws: StateRESWS<number> = st.ok_w(1);
    const any: State<number> = st.ok_w(1);
    expect([ros, res, res_ws, any].every((s) => s.writable)).toBe(true);
  });
  it("narrow on wsync", function () {
    const states: StateRESW<number>[] = [st.from_w(1), st.resw(ok(1))];
    const written: boolean[] = [];
    for (const state of states)
      if (state.wsync) written.push(state.write_sync(2).ok);
      else written.push(false);
    expect(written).toEqual([true, false]);
  });
  it("only states that write synchronously have the sync methods", function () {
    const state = st.rosw(ok(1));
    expect(state.wsync).toBe(false);
    const compile_only = () => {
      // @ts-expect-error a state that is not wsync has no write_sync
      state.write_sync(2);
      // @ts-expect-error a state that is not wsync has no check_sync
      state.check_sync(2);
    };
    expect(compile_only).toBeTypeOf("function");
  });
  it("the sync methods of a state that is not wsync give the not writable error", function () {
    const state = st.rosw(ok(1)) as unknown as StateROSWS<number>;
    const result = state.write_sync(2);
    expect(result.err && result.error.kind).toBe(st.errors.NOT_WRITABLE);
    expect(state.ok()).toBe(1);
  });
  it("read only states are not wsync", function () {
    const state = st.ok_w(1);
    expect(state.read_only.wsync).toBe(false);
    expect(state.proxy_map((v) => v).wsync).toBe(false);
    expect(st.ok(1).wsync).toBe(false);
    expect(st.c.ros(([a]) => a, state).wsync).toBe(false);
  });
  it("is.rosws and is.resws check wsync", function () {
    expect(st.is.rosws(st.ok_w(1))).toBe(true);
    expect(st.is.resws(st.from_w(1))).toBe(true);
    expect(st.is.rosws(st.from_w(1))).toBe(false);
    expect(st.is.resws(st.rosw(ok(1)))).toBe(false);
  });
  it("the result of write_sync is a result, not a thenable", function () {
    const result = st.ok_w(1).write_sync(2);
    expectTypeOf(result).toEqualTypeOf<StateResult<void>>();
    expect("then" in result).toBe(false);
  });
});

describe("Moving an item between two lists", function () {
  type Item = { id: number };
  /**The move an app writes with sync writes, put back when the second list refuses*/
  function move(
    from: StateROSWS<Item[], any, any>,
    to: StateROSWS<Item[], any, any>,
    item: Item,
  ): StateResult<void> {
    const index = from.ok().indexOf(item);
    const taken = from.write_sync(st.a.write.splice(index, 1));
    if (taken.err) return taken;
    const given = to.write_sync(st.a.write.push(item));
    if (given.err) from.write_sync(st.a.write.splice(index, 0, item));
    return given;
  }
  it("moves the item, and no other code runs in between", function () {
    const a = { id: 1 };
    const b = { id: 2 };
    const left = st.ok_w<Item[]>([a, b]);
    const right = st.ok_w<Item[]>([]);
    const totals: number[] = [];
    left.sub(() => totals.push(left.ok().length + right.ok().length));
    expect(move(left, right, a)).toEqual(ok(undefined));
    expect(left.ok()).toEqual([b]);
    expect(right.ok()).toEqual([a]);
    //The subscriber of the first list runs between the writes, the only code that can
    expect(totals).toEqual([1]);
  });
  it("puts the item back when the second list refuses it", function () {
    const a = { id: 1 };
    const b = { id: 2 };
    const left = st.ok_w<Item[]>([a, b]);
    const right = st.rosws(ok<Item[]>([]), () => err(refused()));
    expect(move(left, right, a)).toEqual(err(refused()));
    expect(left.ok()).toEqual([a, b]);
    expect(right.ok()).toEqual([]);
  });
});

describe("Proxies that write synchronously", function () {
  it("a writable proxy of a state that writes synchronously does too", function () {
    const source = st.ok_w(1);
    const same = source.proxy_w_map((v) => v * 2);
    const result = source.proxy_w((r) => r);
    const checked = source.proxy_ok_w((r) => ok(r.value > 0));
    expectTypeOf(same).toMatchTypeOf<StateROSWS<number, any, number>>();
    expectTypeOf(result).toMatchTypeOf<StateRESWS<number, any, number>>();
    expectTypeOf(checked).toMatchTypeOf<StateROSWS<boolean, any, number>>();
    expect([same.wsync, result.wsync, checked.wsync]).toEqual([true, true, true]);
    expect(same.write_sync(4)).toEqual(ok(undefined));
    expect(source.ok()).toBe(4);
    expect(same.ok()).toBe(8);
    expect(checked.write_sync(-1)).toEqual(ok(undefined));
    expect(checked.ok()).toBe(false);
  });
  it("passes checks, limits and the gate of the source on", function () {
    const gate = st.ok_w(true);
    const source = st.rosws(st.n.help(ok(0), { max: st.ok(5) }));
    source.set_write_enabled(gate);
    const proxy = source.proxy_w_map((v) => v);
    expect(proxy.write_sync(6).err).toBe(true);
    expect(proxy.limit_sync(6)).toEqual(ok(5));
    expect(proxy.check_sync(4)).toEqual(ok(4));
    gate.write_sync(false);
    const closed = proxy.write_sync(4);
    expect(closed.err && closed.error.kind).toBe(st.errors.WRITE_DISABLED);
    expect(source.ok()).toBe(0);
  });
  it("a sync write form keeps sync writes, with a write type of its own", async function () {
    const source = st.ok_w(1);
    const text = source.proxy_w_map((v) => String(v), {
      write_sync: (value: string, state) => state.write_sync(Number(value)),
      check_sync: (value) => (isNaN(Number(value)) ? err(refused()) : ok(value)),
    });
    expectTypeOf(text).toMatchTypeOf<StateROSWS<string, any, string>>();
    expect(text.wsync).toBe(true);
    expect(text.write_sync("7")).toEqual(ok(undefined));
    expect(source.ok()).toBe(7);
    expect(text.check_sync("x")).toEqual(err(refused()));
    expect(await text.check("x")).toEqual(err(refused()));
    expect(text.limit_sync("x")).toEqual(ok("x"));
    let result: StateResult<void> | undefined;
    void text.write("8").then((r) => (result = r));
    expect(result).toEqual(ok(undefined));
    expect(source.ok()).toBe(8);
  });
  it("a sync write form goes through the write gate of the source", function () {
    const source = st.ok_w(1);
    source.set_write_enabled(st.ok(false));
    let calls = 0;
    const proxy = source.proxy_w_map((v) => v, {
      write_sync: (_value: number) => (calls++, ok(undefined)),
      check_sync: (value) => (calls++, ok(value)),
    });
    expect(proxy.write_sync(2).err).toBe(true);
    expect(proxy.check_sync(2).err).toBe(true);
    expect(calls).toBe(0);
  });
  it("an async write form makes a proxy that does not write synchronously", async function () {
    const source = st.ok_w(1);
    const text = source.proxy_w_map((v) => String(v), {
      write: (value: string, state) => state.write(Number(value)),
    });
    expectTypeOf(text).toMatchTypeOf<StateROSW<string, any, string>>();
    expect(text.wsync).toBe(false);
    expect((text.write_sync as unknown as (v: string) => StateResult<void>)("2").err).toBe(true);
    expect(await text.write("3")).toEqual(ok(undefined));
    expect(source.ok()).toBe(3);
    const compile_only = () => {
      // @ts-expect-error an async write form does not write synchronously
      text.write_sync("4");
    };
    expect(compile_only).toBeTypeOf("function");
  });
  it("a sync write form is only for states that write synchronously", function () {
    const compile_only = () => {
      // @ts-expect-error rosw does not write synchronously
      st.rosw(ok(1)).proxy_w_map((v) => v, { write_sync: (_v: number) => ok(undefined) });
    };
    expect(compile_only).toBeTypeOf("function");
  });
  it("a proxy of a state that does not write synchronously does not either", function () {
    const proxy = st.rosw(ok(1)).proxy_w_map((v) => v);
    expectTypeOf(proxy).not.toMatchTypeOf<StateRESWS<number, any, number>>();
    expect(proxy.wsync).toBe(false);
  });
  it("set_state of a proxy that writes synchronously only takes such states", function () {
    const proxy = st.ok_w(1).proxy_w_map((v) => v);
    const next = st.ok_w(5);
    proxy.set_state(next);
    expect(proxy.write_sync(6)).toEqual(ok(undefined));
    expect(next.ok()).toBe(6);
    const compile_only = () => {
      // @ts-expect-error rosw does not write synchronously
      proxy.set_state(st.rosw(ok(1)));
      // @ts-expect-error an async write form does not write synchronously
      proxy.set_write({ write: async () => ok(undefined) });
    };
    expect(compile_only).toBeTypeOf("function");
    proxy.set_write({ write_sync: (value, state) => state.write_sync(value + 1) });
    expect(proxy.write_sync(1)).toEqual(ok(undefined));
    expect(next.ok()).toBe(2);
  });
  it("a proxy of a proxy writes synchronously", function () {
    const source = st.from_w(1);
    const chained = source.proxy_w_map((v) => v).proxy_w_map((v) => v);
    expectTypeOf(chained).toMatchTypeOf<StateRESWS<number, any, number>>();
    expect(chained.write_sync(3)).toEqual(ok(undefined));
    expect(source.get()).toEqual(ok(3));
  });
  it("a read only proxy of a state that writes synchronously is read only", function () {
    const proxy = st.ok_w(1).proxy_map((v) => v);
    expect(proxy.writable).toBe(false);
    expect(proxy.wsync).toBe(false);
  });
});

describe("Collected states that write synchronously", function () {
  const pair = () => {
    const a = st.ok_w(1);
    const b = st.ok_w(2);
    const sum = st.c.rosws(
      ([x, y]) => ok(x.value + y.value),
      {
        write_sync: (value: number, [x, y]) => {
          const half = Math.floor(value / 2);
          const first = x.write_sync(half);
          if (first.err) return first;
          return y.write_sync(value - half);
        },
        check_sync: (value) => (value < 0 ? err(refused()) : ok(value)),
      },
      a,
      b,
    );
    return { a, b, sum };
  };
  it("write synchronously through their sync write form", function () {
    const { a, b, sum } = pair();
    expectTypeOf(sum).toMatchTypeOf<StateROSWS<number, any, number>>();
    expect(sum.wsync).toBe(true);
    expect(sum.write_sync(9)).toEqual(ok(undefined));
    expect([a.ok(), b.ok()]).toEqual([4, 5]);
    expect(sum.ok()).toBe(9);
    expect(sum.check_sync(-1)).toEqual(err(refused()));
    expect(sum.limit_sync(-1)).toEqual(ok(-1));
  });
  it("write and check give the same answers at once", async function () {
    const { sum } = pair();
    let result: StateResult<void> | undefined;
    void sum.write(4).then((r) => (result = r));
    expect(result).toEqual(ok(undefined));
    expect(await sum.check(-1)).toEqual(err(refused()));
  });
  it("have a sync write gate", function () {
    const { sum } = pair();
    const gate = st.ok_w(false);
    sum.set_write_enabled(gate);
    expect(sum.write_sync(3).err).toBe(true);
    expect(sum.check_sync(3).err).toBe(true);
    gate.write_sync(true);
    expect(sum.write_sync(3)).toEqual(ok(undefined));
    const compile_only = () => {
      // @ts-expect-error the gate must be a sync state
      sum.set_write_enabled(st.roa(async () => ok(true)));
    };
    expect(compile_only).toBeTypeOf("function");
  });
  it("resws and resws_map make states that can fail", function () {
    const a = st.from_w(1);
    const write = { write_sync: (value: number, [x]: [typeof a]) => x.write_sync(value) };
    const one = st.c.resws(([x]) => x, write, a);
    const mapped = st.c.resws_map(([x]) => x * 10, write, a);
    expectTypeOf(one).toMatchTypeOf<StateRESWS<number, any, number>>();
    expectTypeOf(mapped).toMatchTypeOf<StateRESWS<number, any, number>>();
    expect(mapped.write_sync(2)).toEqual(ok(undefined));
    expect(mapped.get()).toEqual(ok(20));
    expect(one.get()).toEqual(ok(2));
  });
  it("collected states with an async write form do not write synchronously", function () {
    const a = st.ok_w(1);
    const sum = st.c.rosw(([x]) => x, { write: (value: number, [x]) => x.write(value) }, a);
    expect(sum.wsync).toBe(false);
  });
});

describe("Nested states that write synchronously", function () {
  it("write to an inner state that writes synchronously", function () {
    const ada = { name: st.ok_w("Ada") };
    const bob = { name: st.ok_w("Bob") };
    const selected = st.ok_w(ada);
    const name = selected.nested((p) => p.name);
    expectTypeOf(name).toMatchTypeOf<StateROSWS<string, any, string>>();
    expect(name.wsync).toBe(true);
    expect(name.write_sync("Ada L")).toEqual(ok(undefined));
    expect(ada.name.ok()).toBe("Ada L");
    selected.write_sync(bob);
    expect(name.write_sync("Bobby")).toEqual(ok(undefined));
    expect(bob.name.ok()).toBe("Bobby");
    expect(name.check_sync("x")).toEqual(ok("x"));
    expect(name.limit_sync("x")).toEqual(ok("x"));
  });
  it("also while subscribed, after the outer state changed", function () {
    const ada = { name: st.ok_w("Ada") };
    const bob = { name: st.ok_w("Bob") };
    const selected = st.ok_w(ada);
    const name = selected.nested((p) => p.name);
    const seen: string[] = [];
    name.sub((v) => seen.push(v.value));
    selected.write_sync(bob);
    name.write_sync("Bobby");
    expect(seen).toEqual(["Bob", "Bobby"]);
    expect(ada.name.ok()).toBe("Ada");
  });
  it("do not when an inner state does not write synchronously", function () {
    const selected = st.ok_w({ name: st.rosw(ok("Ada")) });
    const name = selected.nested((p) => p.name);
    expectTypeOf(name).not.toMatchTypeOf<StateRESWS<string, any, string>>();
    expect(name.wsync).toBe(false);
    expect((name as unknown as StateROSWS<string, any, string>).write_sync("x").err).toBe(true);
  });
  it("do not when the outer state is async, the inner state is not known at once", function () {
    const selected = st.roa(async () => ok({ name: st.ok_w("Ada") }));
    const name = selected.nested((p) => p.name);
    expectTypeOf(name).not.toMatchTypeOf<StateRESWS<string, any, string>>();
    expect(name.wsync).toBe(false);
  });
  it("do not when the value can be plain or missing", function () {
    const selected = st.ok_w({ name: st.ok_w("Ada") as StateROSWS<string, any, string> | undefined });
    const name = selected.nested((p) => p.name, refused());
    expectTypeOf(name).not.toMatchTypeOf<StateRESWS<string, any, string>>();
  });
});

describe("Initial value or a state that writes synchronously", function () {
  it("narrows to the state with is.state_of", function () {
    const written: number[] = [];
    const write = (value: StateOrValROSWS<number, any, number>) => {
      if (st.is.state_of(value)) written.push(value.write_sync(2).ok ? value.ok() : -1);
      else written.push(value);
    };
    write(1);
    write(st.ok_w(1));
    expect(written).toEqual([1, 2]);
    const maybe: StateOrValRESWS<number, any, number> = st.from_w(1);
    if (st.is.state_of(maybe)) expectTypeOf(maybe).toEqualTypeOf<StateRESWS<number, any, number>>();
  });
});
