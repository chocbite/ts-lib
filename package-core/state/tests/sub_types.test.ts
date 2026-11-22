import { ok, type ResultOk } from "#result";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  state as st,
  type State,
  type StateOrVal,
  type StateREA,
  type StateREAW,
  type StateRES,
  type StateResult,
  type StateROA,
  type StateROS,
  type StateROSW,
  type StateSub,
} from "..";

//Type tests of sub and unsub, mostly checked by the typecheck, the runtime parts check the same calls work

describe("sub and unsub keep working where states are used", function () {
  it("infers the result of every kind in the subscriber", function () {
    st.ok(1).sub((v) => expectTypeOf(v).toEqualTypeOf<ResultOk<number>>());
    st.from(1).sub((v) => expectTypeOf(v).toEqualTypeOf<StateResult<number>>());
    st.roa(async () => ok(1)).sub((v) =>
      expectTypeOf(v).toEqualTypeOf<ResultOk<number>>(),
    );
    st.rea(async () => ok(1)).sub((v) =>
      expectTypeOf(v).toEqualTypeOf<StateResult<number>>(),
    );
  });
  it("subscribes and unsubscribes on the union types", function () {
    const on = <S extends { sub: unknown }>(state: S) => state;
    const rea: StateREA<number> = st.from(1);
    const any: State<number> = st.ok(1);
    const res: StateRES<number> = st.ok(1);
    const reaw: StateREAW<number> = st.from_w(1);
    const f1 = rea.sub((v) => v.ok && v.value);
    rea.unsub(f1);
    const f2 = any.sub((v) => v.ok && v.value);
    any.unsub(f2);
    const f3 = res.sub((v) => v.ok && v.value, true);
    res.unsub(f3);
    const f4 = reaw.sub(() => {});
    reaw.unsub(f4);
    expect(
      on(rea).amount() +
        on(any).amount() +
        on(res).amount() +
        on(reaw).amount(),
    ).toBe(0);
  });
  it("takes a subscriber that accepts more than the state gives", function () {
    const state = st.ok(1);
    const wide = (value: StateResult<number>) => value;
    state.unsub(state.sub(wide));
    const wider = (value: StateResult<unknown>) => value;
    state.unsub(state.sub(wider));
  });
  it("unsubscribes the function given to sub, also when kept in a variable typed by the state", function () {
    const state: StateREA<number> = st.from(1);
    const kept: StateSub<StateResult<number>> = () => {};
    state.sub(kept);
    state.unsub(kept);
    expect(state.amount()).toBe(0);
  });
  it("assigns states of more specific kinds to wider state types", function () {
    const ros = st.ok(1);
    const rosw = st.ok_w(1);
    const a: State<number> = ros;
    const b: StateREA<number> = rosw;
    const c: StateROS<number> = rosw;
    const d: StateROA<number> = ros;
    const e: StateREA<number | undefined> = ros;
    const f: State<unknown> = ros;
    const g: State<number, any, any> = rosw;
    expect([a, b, c, d, e, f, g].length).toBe(7);
  });
  it("assigns objects, records and arrays holding states", function () {
    interface Options {
      value: State<number>;
      label?: StateREA<string>;
      readonly items: readonly State<unknown>[];
    }
    const options: Options = {
      value: st.ok_w(1),
      label: st.ok("a"),
      items: [st.ok(1), st.from("a"), st.rea(async () => ok(true))],
    };
    interface Generic<T> {
      value: State<T>;
    }
    const generic: Generic<number | string> = {
      value: st.from<number | string>(1),
    };
    const record: Record<string, State<unknown>> = {
      a: st.ok(1),
      b: st.from("b"),
      c: st.ok_w([1]),
    };
    const mixed: State<number>[] = [
      st.ok(1),
      st.from(2),
      st.ok_w(3),
      st.roa(async () => ok(4)),
    ];
    const or_val: StateOrVal<number>[] = [1, st.ok(2), st.from(3)];
    expect([options, generic, record, mixed, or_val].length).toBe(5);
  });
  it("works on read only views, proxies, collected and remote states", function () {
    const noop = () => {};
    const source = st.ok_w(1);
    source.read_only.unsub(source.read_only.sub(noop));
    const doubled = source.proxy_map((v) => v * 2);
    doubled.unsub(
      doubled.sub((v) => expectTypeOf(v).toEqualTypeOf<ResultOk<number>>()),
    );
    const sum = st.c.ros(([a]) => ok(a.value), source);
    sum.unsub(sum.sub(noop));
    const remote = st.r.rea.from<number>(
      async (s) => s.update_single(ok(1)),
      noop,
      noop,
    );
    remote.unsub(remote.sub(noop));
    const rosw: StateROSW<number> = source;
    rosw.unsub(rosw.sub(noop));
  });
});

describe("sub and unsub are typed by the subscriber", function () {
  it("sub gives back the function it was given, with its own type", function () {
    const state = st.ok(1);
    const counted = state.sub((v: ResultOk<number>) => v.value + 1);
    expectTypeOf(counted).toEqualTypeOf<(v: ResultOk<number>) => number>();
    state.unsub(counted);
    const rea: StateREA<number> = st.from(1);
    const shown = rea.sub((v: StateResult<number>) => String(v.ok));
    expectTypeOf(shown).toEqualTypeOf<(v: StateResult<number>) => string>();
    rea.unsub(shown);
  });
  it("refuses what is not a subscriber of the state", function () {
    const state = st.ok(1);
    const compile_only = () => {
      // @ts-expect-error the type of sub is the function it is given, not anything
      state.sub<number>(() => {});
      // @ts-expect-error a subscriber of another value type
      state.sub((v: ResultOk<string>) => v);
      // @ts-expect-error only subscribers can be unsubscribed
      state.unsub("not a subscriber");
      // @ts-expect-error only subscribers can be unsubscribed
      state.unsub(1);
      // @ts-expect-error a subscriber of another value type
      state.unsub((v: ResultOk<string>) => v);
    };
    expect(compile_only).toBeTypeOf("function");
  });
});

describe("sub and unsub in generic code", function () {
  it("work in a function generic over the value", async function () {
    function last<T>(state: State<T>): () => T | undefined {
      let seen: T | undefined;
      const sub = state.sub((v) => {
        if (v.ok) seen = v.value;
      });
      state.unsub(sub);
      state.sub((v) => {
        if (v.ok) seen = v.value;
      }, true);
      return () => seen;
    }
    const get = last(st.ok(4));
    await Promise.resolve();
    expect(get()).toBe(4);
  });
  it("work in a function generic over the state", function () {
    function count<S extends State<number>>(state: S): () => void {
      let n = 0;
      const sub = state.sub(() => n++);
      expect(state.has(sub)).toBe(state);
      return () => state.unsub(sub);
    }
    const state = st.ok_w(1);
    count(state)();
    expect(state.amount()).toBe(0);
  });
  it("work on a field of a generic class", function () {
    class Shown<T> {
      readonly #state: StateREA<T>;
      #last?: T;
      readonly #sub = (v: StateResult<T>) => {
        if (v.ok) this.#last = v.value;
      };
      constructor(state: StateREA<T>) {
        this.#state = state;
        this.#state.sub(this.#sub, true);
      }
      stop() {
        this.#state.unsub(this.#sub);
      }
      get last() {
        return this.#last;
      }
    }
    const state = st.ok_w("a");
    const shown = new Shown<string>(state);
    expect(shown.last).toBe("a");
    shown.stop();
    expect(state.amount()).toBe(0);
  });
  it("work on a state made of a value or state, and on the owner of a local state", function () {
    const of = st.as_state<number>(5 as StateOrVal<number>);
    of.unsub(of.sub((v) => v));
    const owner = st.rosw(ok(1));
    const sub = owner.sub((v) =>
      expectTypeOf(v).toEqualTypeOf<ResultOk<number>>(),
    );
    expect(owner.has(sub)).toBe(owner);
    owner.unsub(sub);
  });
});

describe("The type of the subscriber comes from the state", function () {
  it("also when what sub gives is kept in a variable of a wider type", function () {
    const state = st.from(1);
    const kept: StateSub<any> = state.sub((v) => {
      expectTypeOf(v).toEqualTypeOf<StateResult<number>>();
    });
    state.unsub(kept);
    expect(state.amount()).toBe(0);
  });
});
