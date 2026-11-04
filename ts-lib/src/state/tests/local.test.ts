import { err, ok, ResultOk } from "#result";
import { assertType, describe, expect, expectTypeOf, it } from "vitest";
import { state as st, StateResult, StateROS } from "..";
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
