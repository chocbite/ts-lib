import { err, ok, ResultOk } from "#result";
import { describe, expect, it } from "vitest";
import { state as st, StateResult } from "..";
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

describe("Initialize lazy states", function () {
  describe("ROS", { timeout: 100 }, function () {
    it("ok", async function () {
      st.ros(() => ok(1));
    });
    it("rok is true", function () {
      expect(st.ros(() => ok(1)).rok).toBe(true);
    });
    it("rsync is true after access", async function () {
      const s = st.ros(() => ok(1));
      await s;
      expect(s.rsync).toBe(true);
    });
    it("writable is false", function () {
      expect(st.ros(() => ok(1)).writable).toBe(false);
    });
    it("cleanup successfull", async function () {
      const init = st.ros(() => ok(1));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const get = init.get;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const set = init.set;
      await init;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.get).not.eq(get, "get");
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.set).not.eq(set, "set");
    });
    const maker: TestStateOkSync = () => {
      const state = st.ros(() => ok(1));
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
  });
  //##################################################################################################################################################
  describe("RES", { timeout: 100 }, function () {
    it("ok", async function () {
      st.res(() => ok(1));
    });
    it("err", async function () {
      st.res(() => err("1"));
    });
    it("rok is false", function () {
      expect(st.res(() => ok(1)).rok).toBe(false);
    });
    it("rsync is true after access", async function () {
      const s = st.res(() => ok(1));
      await s;
      expect(s.rsync).toBe(true);
    });
    it("writable is false", function () {
      expect(st.res(() => ok(1)).writable).toBe(false);
    });
    it("cleanup successfull", async function () {
      const init = st.res(() => ok(1));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const get = init.get;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const set = init.set;
      await init;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.get).not.eq(get, "get");
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.set).not.eq(set, "set");
    });
    const maker: TestStateSync = () => {
      const state = st.res(() => ok(1));
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
  describe("ROS_WS", { timeout: 100 }, function () {
    it("ok", async function () {
      st.rosw(() => ok(1));
    });
    it("rok is true", function () {
      expect(st.rosw(() => ok(1)).rok).toBe(true);
    });
    it("rsync is true after access", async function () {
      const s = st.rosw(() => ok(1));
      await s;
      expect(s.rsync).toBe(true);
    });
    it("writable is true", function () {
      expect(st.rosw(() => ok(1)).writable).toBe(true);
    });
    it("cleanup successfull", async function () {
      const init = st.rosw(() => ok(1));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const set = init.set;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const write = init.write;
      await init;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.set).not.eq(set);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.write).not.eq(write);
    });
    const maker: TestStateOkSync = () => {
      const state = st.rosw(() => ok(1));
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
      const state = st.rosw(() => ok(1), true);
      const set = (val: ResultOk<number>) => state.set(val);
      return { o: true, s: true, w: true, state, set };
    };
    it("Write", async function () {
      await test_state_write(maker_write, true);
    });
  });
  //##################################################################################################################################################
  describe("RES_WS", { timeout: 100 }, function () {
    it("ok", async function () {
      st.resw(() => ok(1));
    });
    it("err", async function () {
      st.resw(() => err("1"));
    });
    it("rok is false", function () {
      expect(st.resw(() => ok(1)).rok).toBe(false);
    });
    it("rsync is true after access", async function () {
      const s = st.resw(() => ok(1));
      await s;
      expect(s.rsync).toBe(true);
    });
    it("writable is true", function () {
      expect(st.resw(() => ok(1)).writable).toBe(true);
    });
    it("cleanup successfull", async function () {
      const init = st.resw(() => ok(1));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const set = init.set;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const write = init.write;
      await init;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.set).not.eq(set, "set");
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.write).not.eq(write, "write");
    });
    const maker: TestStateSync = () => {
      const state = st.resw(() => ok(1));
      const set = (val: StateResult<number>) => state.set(val);
      return { o: false, s: true, w: true, state, set };
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
    const maker_write: TestStateWrite = () => {
      const state = st.resw(() => ok(1), true);
      const set = (val: StateResult<number>) => state.set(val);
      return { o: false, s: true, w: true, state, set };
    };
    it("Write", async function () {
      await test_state_write(maker_write, true);
    });
  });
});
