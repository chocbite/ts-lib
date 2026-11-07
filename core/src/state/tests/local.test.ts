import { err, ok, ResultOk } from "#result";
import { assertType, describe, expect, expectTypeOf, it, vi } from "vitest";
import { state as st, StateJsonCompatible, StateResult, StateROS } from "..";
import {
  test_state_get,
  test_state_get_ok,
  test_state_sub,
  test_state_then,
  test_state_write,
  TestStateWrite,
  type TestStateOkSync,
  type TestStateSync,
} from "./tests_shared";

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
    describe("Then", async function () {
      await test_state_then(maker, 0);
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
      st.res(err("1"));
    });
    it("rok is false", function () {
      expect(st.res(ok(1)).rok).toBe(false);
      expect(st.res(err("1")).rok).toBe(false);
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
    describe("Then", async function () {
      await test_state_then(maker, 0);
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
    describe("Then", async function () {
      await test_state_then(maker, 0);
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
      st.resw(err("1"), true);
    });
    it("rok is false", function () {
      expect(st.resw(ok(1), true).rok).toBe(false);
      expect(st.resw(err("1"), true).rok).toBe(false);
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
      await test_state_then(maker, 0);
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
        .ok({ a: NaN, b: [Infinity], c: st.err<number>("Broken") })
        .to_json();
      expect(JSON.parse(json)).toEqual({ a: null, b: [null], c: null });
      const logged = error.mock.calls.map((call) => String(call[0]));
      expect(logged).toEqual([
        "state.a is NaN, written as null in JSON",
        "state.b[0] is Infinity, written as null in JSON",
        'state.c is in error "Broken", written as null in JSON',
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
