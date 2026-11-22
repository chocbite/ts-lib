import { ok, ResultOk, err_nice, NiceError } from "#result";
import { assertType, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  state as st,
  State,
  type StateLocalROA,
  StateJsonCompatible,
  StateREA,
  StateResult,
  StateROS,
} from "..";
import {
  test_state_get,
  test_state_get_ok,
  test_state_sub,
  test_state_read,
  test_state_write,
  TestStateWrite,
  type TestStateOkSync,
  type TestStateSync,
} from "./tests_shared";
import { TEST_ERROR } from "./tests_shared";

describe("Sync states", function () {
  describe("ROS", { timeout: 100 }, function () {
    it("ok", async function () {
      const init = st.ros(ok(1));
      assertType<StateROS<number>>(init);
    });
    it("rok is true", function () {
      expect(st.ros(ok(1)).rok).toBe(true);
      expect(st.ok(1).rok).toBe(true);
    });
    it("rsync is true", function () {
      expect(st.ros(ok(1)).rsync).toBe(true);
    });
    it("writable is false", function () {
      expect(st.ros(ok(1)).writable).toBe(false);
    });
    const maker: TestStateOkSync = () => {
      const state = st.ros(ok(1));
      const set = (val: ResultOk<number>) => state.set(val);
      return { o: true, s: true, w: false, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 0);
    });
    describe("Read", async function () {
      await test_state_read(maker, 0);
    });
    it("Get", async function () {
      await test_state_get(maker);
    });
    it("GetOk", async function () {
      await test_state_get_ok(maker);
    });
    it("array elements retain their type", function () {
      const state = st.ok([1, 2, 3]);
      expectTypeOf(state.ok()[0]).toEqualTypeOf<number | undefined>();
      expectTypeOf(state.get().value[0]).toEqualTypeOf<number | undefined>();
    });
    it("tuples retain their shape", function () {
      const state = st.ok_w([1, 2] as [number, number]);
      expectTypeOf(state.ok()).toEqualTypeOf<[number, number]>();
      // @ts-expect-error Tuple replacements must retain their length.
      state.write([1, 2, 3]);
      // @ts-expect-error Tuple updates must retain their length.
      state.set_ok([1, 2, 3]);
      // @ts-expect-error Tuple members cannot be replaced with undefined.
      state.set_ok([1, undefined]);
    });
  });
  //##################################################################################################################################################
  describe("RES", { timeout: 100 }, function () {
    it("ok", async function () {
      st.res(ok(1));
    });
    it("err", async function () {
      st.res(err_nice(TEST_ERROR, "1"));
    });
    it("rok is false", function () {
      expect(st.res(ok(1)).rok).toBe(false);
      expect(st.res(err_nice(TEST_ERROR, "1")).rok).toBe(false);
    });
    it("rsync is true", function () {
      expect(st.res(ok(1)).rsync).toBe(true);
    });
    it("writable is false", function () {
      expect(st.res(ok(1)).writable).toBe(false);
    });
    const maker: TestStateSync = () => {
      const state = st.res(ok(1));
      const set = (val: StateResult<number>) => state.set(val);
      return { o: false, s: true, w: false, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 0);
    });
    describe("Read", async function () {
      await test_state_read(maker, 0);
    });
    it("Get", async function () {
      await test_state_get(maker);
    });
  });
  //##################################################################################################################################################
  describe("ROSWS", { timeout: 100 }, function () {
    it("ok", async function () {
      st.rosw(ok(1), true);
    });
    it("rok is true", function () {
      expect(st.rosw(ok(1), true).rok).toBe(true);
      expect(st.ok_w(1).rok).toBe(true);
    });
    it("rsync is true", function () {
      expect(st.rosw(ok(1), true).rsync).toBe(true);
    });
    it("writable is true", function () {
      expect(st.rosw(ok(1), true).writable).toBe(true);
    });
    const maker: TestStateOkSync = () => {
      const state = st.rosw(ok(1), true);
      const set = (val: ResultOk<number>) => state.set(val);
      return { o: true, s: true, w: true, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 0);
    });
    describe("Read", async function () {
      await test_state_read(maker, 0);
    });
    it("Get", async function () {
      await test_state_get(maker);
    });
    it("GetOk", async function () {
      await test_state_get_ok(maker);
    });
    const maker_write: TestStateWrite = () => {
      const state = st.rosw(ok(1), true);
      const set = (val: ResultOk<number>) => state.set(val);
      return { o: true, s: true, w: true, state, set };
    };
    it("Write", async function () {
      await test_state_write(maker_write, true);
    });
  });
  //##################################################################################################################################################
  describe("RESWS", { timeout: 100 }, function () {
    it("ok", async function () {
      st.resw(ok(1), true);
    });
    it("err", async function () {
      st.resw(err_nice(TEST_ERROR, "1"), true);
    });
    it("rok is false", function () {
      expect(st.resw(ok(1), true).rok).toBe(false);
      expect(st.resw(err_nice(TEST_ERROR, "1"), true).rok).toBe(false);
    });
    it("rsync is true", function () {
      expect(st.resw(ok(1), true).rsync).toBe(true);
    });
    it("writable is true", function () {
      expect(st.resw(ok(1), true).writable).toBe(true);
    });
    const maker: TestStateSync = () => {
      const state = st.resw(ok(1), true);
      const set = (val: StateResult<number>) => state.set(val);
      return { o: false, s: true, w: true, state, set };
    };
    it("Test Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 0);
    });
    describe("Test Then", async function () {
      await test_state_read(maker, 0);
    });
    it("Get", async function () {
      await test_state_get(maker);
    });
    const maker_write: TestStateWrite = () => {
      const state = st.resw(ok(1), true);
      const set = (val: StateResult<number>) => state.set(val);
      return { o: false, s: true, w: true, state, set };
    };
    it("Write", async function () {
      await test_state_write(maker_write, true);
    });
  });
});

describe("to_json", function () {
  it("Matches JSON.stringify for plain values", async function () {
    const value = { a: 1, b: [1, "x", null], c: { d: true } };
    expect(await st.ok(value).to_json()).toBe(JSON.stringify(value));
  });
  it("Leaves out unset optional fields like JSON.stringify", async function () {
    const value: { a?: number; b: number } = { a: undefined, b: 1 };
    const json = await st.ok(value).to_json();
    expect(JSON.parse(json)).toEqual({ b: 1 });
  });
  it("Includes states nested inside plain objects", async function () {
    const json = await st.ok({ inner: { count: st.ok(5) } }).to_json();
    expect(JSON.parse(json)).toEqual({ inner: { count: 5 } });
  });
  it("Includes states nested inside arrays", async function () {
    const json = await st.ok([[st.ok(1)], { a: st.ok(2) }]).to_json();
    expect(JSON.parse(json)).toEqual([[1], { a: 2 }]);
  });
  it("Writes NaN, Infinity and states in error as null and logs where", async function () {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const json = await st
        .ok({ a: NaN, b: [Infinity], c: st.err<number>(new NiceError(TEST_ERROR, "Broken")) })
        .to_json();
      expect(JSON.parse(json)).toEqual({ a: null, b: [null], c: null });
      const logged = error.mock.calls.map((call) => String(call[0]));
      expect(logged).toEqual([
        "state.a is NaN, written as null in JSON",
        "state.b[0] is Infinity, written as null in JSON",
        'state.c is in error "Test error: Broken", written as null in JSON',
      ]);
    } finally {
      error.mockRestore();
    }
  });
  it("Always produces valid JSON, even for values the types do not allow", async function () {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const json = await st.ok([undefined, () => 1, 1]).to_json();
      expect(JSON.parse(json)).toEqual([null, null, 1]);
      expect(error).toHaveBeenCalledTimes(2);
    } finally {
      error.mockRestore();
    }
  });
  it("StateJsonCompatible accepts JSON values and rejects others", function () {
    expectTypeOf<StateJsonCompatible<number>>().toEqualTypeOf<true>();
    expectTypeOf<
      StateJsonCompatible<{ a?: string; b: (number | null)[]; c: Date }>
    >().toEqualTypeOf<true>();
    expectTypeOf<
      StateJsonCompatible<StateROS<{ inner: StateROS<boolean> }>>
    >().toEqualTypeOf<true>();
    expectTypeOf<StateJsonCompatible<(number | undefined)[]>>().toEqualTypeOf<false>();
    expectTypeOf<StateJsonCompatible<Map<string, number>>>().toEqualTypeOf<false>();
    expectTypeOf<StateJsonCompatible<{ f: () => void }>>().toEqualTypeOf<false>();
    expectTypeOf<StateJsonCompatible<bigint>>().toEqualTypeOf<false>();
  });
});

describe("Type declarations", function () {
  it("Async errorable states read errors after narrowing", function () {
    //Only type checked, never called
    const check = (state: StateREA<number>) => {
      if (!state.rok && !state.rsync)
        expectTypeOf(state.read().then((value) => value)).toEqualTypeOf<
          PromiseLike<StateResult<number>>
        >();
    };
    expect(check).toBeTypeOf("function");
  });
  it("read_only and read_write keep the kind of state", function () {
    //Only type checked, never called
    const check = () => {
      st.resw(ok(1), true).read_only.get();
      // @ts-expect-error an errorable state has no ok()
      st.resw(ok(1), true).read_only.ok();
      // @ts-expect-error an errorable state has no ok()
      st.resw(ok(1), true).read_write.ok();
      // @ts-expect-error an async state has no get()
      st.roaw<number>().read_only.get();
      // @ts-expect-error an async state has no get()
      st.roaw<number>().read_write.get();
      // @ts-expect-error an async state has no get()
      st.reaw<number>().read_only.get();
      // @ts-expect-error an async state has no get()
      st.reaw<number>().read_write.get();
    };
    expect(check).toBeTypeOf("function");
  });
});

describe("read", function () {
  it("gives the result type of each kind", async function () {
    expectTypeOf(st.ros(ok(1)).read()).toEqualTypeOf<PromiseLike<ResultOk<number>>>();
    expectTypeOf(st.res(ok(1)).read()).toEqualTypeOf<PromiseLike<StateResult<number>>>();
    expectTypeOf(st.roa(async () => ok(1)).read()).toEqualTypeOf<PromiseLike<ResultOk<number>>>();
    //State is a union of the kinds, reading it gives what awaiting it gives
    const any: State<number> = st.ok(1);
    expectTypeOf(await any.read()).toEqualTypeOf(await any.read());
  });
  it("the read only view reads the state", async function () {
    const state = st.ok_w(1);
    state.set_ok(4);
    expect(await state.read_only.read()).toEqual(ok(4));
  });
});

describe("Shape of local states", function () {
  const noop = () => {};
  type Local = State<number> & Pick<StateLocalROA<number>, "set_onsub" | "set_onunsub" | "set_ok">;
  const kinds: [string, () => Local][] = [
    ["plain", () => st.rosw(ok(1))],
    ["lazy ros", () => st.ros(() => ok(1))],
    ["lazy res", () => st.res(() => ok(1))],
    ["lazy rosw", () => st.rosw(() => ok(1))],
    ["lazy resw", () => st.resw(() => ok(1))],
    ["delayed roa", () => st.roa(async () => ok(1))],
    ["delayed rea", () => st.rea(async () => ok(1))],
    ["delayed roaw", () => st.roaw(async () => ok(1))],
    ["delayed reaw", () => st.reaw(async () => ok(1))],
    ["delayed without init", () => st.roa<number>()],
  ];
  //Methods put on the instance give the state a shape of its own, deleting them makes V8 store its properties as a slow dictionary
  for (const [name, make] of kinds)
    it(`${name} has no methods of its own, before and after it has a value`, async function () {
      const state = make();
      state.set_onsub(noop);
      state.set_onunsub(noop);
      expect(Object.getOwnPropertyNames(state)).toEqual([]);
      if (name === "delayed without init") state.set_ok(1);
      await state.read();
      state.sub(noop);
      state.unsub(noop);
      expect(Object.getOwnPropertyNames(state)).toEqual([]);
    });
});

describe("Write before the first read", function () {
  //A setter that sends the value on, like to a device, without setting the state
  const send = async () => ok(undefined);
  it("a lazy state still runs its init function after a write that does not set it", async function () {
    const state = st.rosw(() => ok(1), send);
    expect(await state.write(5)).toEqual(ok(undefined));
    expect(state.get()).toEqual(ok(1));
  });
  it("a delayed state still runs its init function after a write that does not set it", async function () {
    const state = st.roaw(async () => ok(1), send);
    expect(await state.write(5)).toEqual(ok(undefined));
    expect(await state.read()).toEqual(ok(1));
  });
  it("a write that sets the state wins over the init function", async function () {
    const lazy = st.rosw(() => ok(1));
    await lazy.write(5);
    expect(lazy.get()).toEqual(ok(5));
    const delayed = st.roaw(async () => ok(1));
    await delayed.write(5);
    expect(await delayed.read()).toEqual(ok(5));
  });
});

describe("set with the value the state has", function () {
  const told = <T>(state: { sub(f: (v: T) => void): unknown }) => {
    const seen: T[] = [];
    state.sub((v) => seen.push(v));
    return seen;
  };
  it("tells no one when the same number, string, boolean or null is set again", function () {
    for (const value of [5, "text", true, null]) {
      const state = st.ok_w<unknown>(value);
      const seen = told(state);
      state.set_ok(value);
      state.set(ok(value));
      expect(seen).toEqual([]);
      state.set_ok("other");
      expect(seen).toEqual([ok("other")]);
    }
  });
  it("still tells when an object or array is set again, it can have changed in place", function () {
    const list = [1, 2];
    const state = st.ok_w(list);
    const seen = told(state);
    list.push(3);
    state.set_ok(list);
    expect(seen.length).toBe(1);
    const record = { a: 1 };
    const object = st.ok_w(record);
    const seen_object = told(object);
    object.set_ok(record);
    expect(seen_object.length).toBe(1);
  });
  it("still tells when an error is set, also the same error again", function () {
    const error = new NiceError(TEST_ERROR, "broken");
    const state = st.from_w(1);
    const seen = told(state);
    state.set_err(error);
    state.set_err(error);
    expect(seen.length).toBe(2);
    state.set_ok(1);
    expect(seen.length).toBe(3);
  });
  it("tells when an ok value replaces an error with an equal value before it", function () {
    const state = st.from_w(1);
    state.set_err(new NiceError(TEST_ERROR, "broken"));
    const seen = told(state);
    state.set_ok(1);
    expect(seen).toEqual([ok(1)]);
  });
  it("lazy and delayed states tell no one when their value is set again", async function () {
    const lazy = st.ros(() => ok(1));
    const seen_lazy = told(lazy);
    lazy.get();
    lazy.set_ok(1);
    expect(seen_lazy).toEqual([]);
    const delayed = st.roa(async () => ok(1));
    await delayed.read();
    const seen_delayed = told(delayed);
    delayed.set_ok(1);
    expect(seen_delayed).toEqual([]);
  });
});
