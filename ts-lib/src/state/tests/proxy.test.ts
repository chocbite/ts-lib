import { sleep } from "#common";
import { err, ok, ResultOk } from "#result";
import { describe, expect, it } from "vitest";
import { state as st, StateResult } from "..";
import {
  test_state_get,
  test_state_get_ok,
  test_state_sub,
  test_state_then,
  test_state_write,
  type TestStateAll,
  type TestStateOk,
  type TestStateOkSync,
  type TestStateSync,
  type TestStateWrite,
} from "./tests_shared";

describe("Proxy with sync states", function () {
  describe("ROS", { timeout: 100 }, function () {
    it("ok", async function () {
      st.p.ros(st.ok(1));
    });
    const maker: TestStateOkSync = () => {
      const stat = st.ok(1);
      const state = st.p.ros(stat);
      const set = (val: ResultOk<number>) => stat.set(val);
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
      st.p.res(st.ok(1));
    });
    const maker: TestStateSync = () => {
      const stat = st.from(1);
      const state = st.p.res(stat);
      const set = (val: StateResult<number>) => stat.set(val);
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
  describe("ROSW", { timeout: 100 }, function () {
    it("ok", async function () {
      st.p.rosw(st.rosw(ok(1), true), undefined, {
        wout_win: (v: number) => v,
        win_wout: (v: number) => v,
      });
    });
    const maker: TestStateOkSync = () => {
      const stat = st.rosw(ok(1), true);
      const state = st.p.rosw(stat, undefined, {
        wout_win: (v: number) => v,
        win_wout: (v: number) => v,
      });
      const set = (val: ResultOk<number>) => stat.set(val);
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
      const stat = st.rosw(ok(1), true);
      const state = st.p.rosw(stat, undefined, {
        wout_win: (v: number) => v,
        win_wout: (v: number) => v,
      });
      const set = (val: ResultOk<number>) => stat.set(val);
      return { o: true, s: true, w: true, state, set };
    };
    it("Write", async function () {
      await test_state_write(maker_write, true);
    });
  });
  //##################################################################################################################################################
  describe("RESW", { timeout: 100 }, function () {
    it("ok", async function () {
      st.p.resw(st.resw(ok(1), true), undefined, {
        wout_win: (v: number) => v,
        win_wout: (v: number) => v,
      });
    });
    const maker: TestStateSync = () => {
      const stat = st.resw(ok(1), true);
      const state = st.p.resw(stat, undefined, {
        wout_win: (v: number) => v,
        win_wout: (v: number) => v,
      });
      const set = (val: StateResult<number>) => stat.set(val);
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
      const stat = st.resw(ok(1), true);
      const state = st.p.resw(stat, undefined, {
        wout_win: (v: number) => v,
        win_wout: (v: number) => v,
      });
      const set = (val: StateResult<number>) => stat.set(val);
      return { o: false, s: true, w: true, state, set };
    };
    it("Write", async function () {
      await test_state_write(maker_write, true);
    });
  });
});

describe("Proxy with async states", function () {
  //##################################################################################################################################################
  describe("ROA", { timeout: 500 }, function () {
    it("ok", async function () {
      const inner = st.r.roa.from<number>(
        async (state) => state.update_single(ok(1)),
        () => {},
        () => {},
      );
      st.p.roa(inner);
    });
    const maker: TestStateOk = () => {
      let val: ResultOk<number> = ok(1);
      const inner = st.r.roa.from<number>(
        async (state) => state.update_single(val),
        () => {},
        () => {},
      );
      const state = st.p.roa(inner);
      const set = (v: ResultOk<number>) => {
        val = v;
        inner.update_value(v);
      };
      return { o: true, s: false, w: false, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 50);
    });
    describe("Then", async function () {
      await test_state_then(maker, 50);
    });
  });
  //##################################################################################################################################################
  describe("REA", { timeout: 500 }, function () {
    it("ok", async function () {
      const inner = st.r.rea.from<number>(
        async (state) => state.update_single(ok(1)),
        () => {},
        () => {},
      );
      st.p.rea(inner);
    });
    const maker: TestStateAll = () => {
      let val: StateResult<number> = ok(1);
      const inner = st.r.rea.from<number>(
        async (state) => state.update_single(val),
        () => {},
        () => {},
      );
      const state = st.p.rea(inner);
      const set = (v: StateResult<number>) => {
        val = v;
        inner.update_value(v);
      };
      return { o: false, s: false, w: false, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 50);
    });
    describe("Then", async function () {
      await test_state_then(maker, 50);
    });
  });
  //##################################################################################################################################################
  describe("ROAW", { timeout: 500 }, function () {
    it("ok", async function () {
      const inner = st.r.roaw.from<number>(
        async (state) => state.update_single(ok(1)),
        () => {},
        () => {},
      );
      st.p.roaw(inner);
    });
    const maker: TestStateOk = () => {
      let val: ResultOk<number> = ok(1);
      const inner = st.r.roaw.from<number>(
        async (state) => state.update_single(val),
        () => {},
        () => {},
      );
      const state = st.p.roaw(inner);
      const set = (v: ResultOk<number>) => {
        val = v;
        inner.update_value(v);
      };
      return { o: true, s: false, w: true, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 50);
    });
    describe("Then", async function () {
      await test_state_then(maker, 50);
    });
  });
  //##################################################################################################################################################
  describe("REAW", { timeout: 500 }, function () {
    it("ok", async function () {
      const inner = st.r.reaw.from<number>(
        async (state) => state.update_single(ok(1)),
        () => {},
        () => {},
      );
      st.p.reaw(inner);
    });
    const maker: TestStateAll = () => {
      let val: StateResult<number> = ok(1);
      const inner = st.r.reaw.from<number>(
        async (state) => state.update_single(val),
        () => {},
        () => {},
      );
      const state = st.p.reaw(inner);
      const set = (v: StateResult<number>) => {
        val = v;
        inner.update_value(v);
      };
      return { o: false, s: false, w: true, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 50);
    });
    describe("Then", async function () {
      await test_state_then(maker, 50);
    });
  });
});

describe("Proxy features", function () {
  //##################################################################################################################################################
  describe("transform_read", { timeout: 100 }, function () {
    it("transforms subscribed values", async function () {
      const inner = st.ok(5);
      const proxy = st.p.ros(inner, (val) => ok(val.value * 2));
      let received: ResultOk<number> | undefined;
      proxy.sub((val) => {
        received = val;
      }, true);
      await sleep(1);
      expect(received).toEqual(ok(10));
      inner.set(ok(3));
      await sleep(1);
      expect(received).toEqual(ok(6));
    });
    it("transforms get value", async function () {
      const inner = st.ok(5);
      const proxy = st.p.ros(inner, (val) => ok(val.value * 2));
      expect(proxy.get()).toEqual(ok(10));
    });
    it("transforms then value", async function () {
      const inner = st.ok(5);
      const proxy = st.p.ros(inner, (val) => ok(val.value * 2));
      const result = await proxy;
      expect(result).toEqual(ok(10));
    });
    it("transforms ok value", async function () {
      const inner = st.ok(5);
      const proxy = st.p.ros(inner, (val) => ok(val.value * 2));
      expect(proxy.ok()).toEqual(10);
    });
  });
  //##################################################################################################################################################
  describe("transform_write", { timeout: 100 }, function () {
    it("transforms written values through proxy", async function () {
      const inner = st.rosw(ok(1), true);
      const proxy = st.p.rosw(inner, undefined, {
        wout_win: (v: number) => v * 2,
        win_wout: (v: number) => v / 2,
      });
      await proxy.write(5);
      expect(inner.get()).toEqual(ok(10));
    });
  });
  //##################################################################################################################################################
  describe("set_state", { timeout: 100 }, function () {
    it("updates value when subscribed", async function () {
      const inner1 = st.ok(1);
      const inner2 = st.ok(2);
      const proxy = st.p.ros(inner1);
      let received: ResultOk<number> | undefined;
      proxy.sub((val) => {
        received = val;
      }, true);
      await sleep(1);
      expect(received).toEqual(ok(1));
      proxy.set_state(inner2);
      await sleep(1);
      expect(received).toEqual(ok(2));
    });
    it("updates get value when not subscribed", async function () {
      const inner1 = st.ok(1);
      const inner2 = st.ok(2);
      const proxy = st.p.ros(inner1);
      expect(proxy.get()).toEqual(ok(1));
      proxy.set_state(inner2);
      expect(proxy.get()).toEqual(ok(2));
    });
    it("stops listening to old state after switch", async function () {
      const inner1 = st.ok(1);
      const inner2 = st.ok(10);
      const proxy = st.p.ros(inner1);
      let received: ResultOk<number> | undefined;
      proxy.sub((val) => {
        received = val;
      }, true);
      await sleep(1);
      expect(received).toEqual(ok(1));
      proxy.set_state(inner2);
      await sleep(1);
      expect(received).toEqual(ok(10));
      inner1.set(ok(999));
      await sleep(1);
      expect(received).toEqual(ok(10));
    });
  });
  //##################################################################################################################################################
  describe("set_transform_read", { timeout: 100 }, function () {
    it("updates transform when subscribed", async function () {
      const inner = st.ok(5);
      const proxy = st.p.ros(inner, (val) => ok(val.value * 2));
      let received: ResultOk<number> | undefined;
      proxy.sub((val) => {
        received = val;
      }, true);
      await sleep(1);
      expect(received).toEqual(ok(10));
      proxy.set_transform_read((val) => ok(val.value * 3));
      await sleep(1);
      expect(received).toEqual(ok(15));
    });
    it("updates transform when not subscribed", async function () {
      const inner = st.ok(5);
      const proxy = st.p.ros(inner, (val) => ok(val.value * 2));
      expect(proxy.get()).toEqual(ok(10));
      proxy.set_transform_read((val) => ok(val.value * 3));
      expect(proxy.get()).toEqual(ok(15));
    });
  });
  //##################################################################################################################################################
  describe("write without transform", { timeout: 100 }, function () {
    it("returns error when write transform not set", async function () {
      const inner = st.rosw(ok(1), true);
      const proxy = st.p.rosw(inner);
      const result = await proxy.write(15);
      expect(result).toEqual(err("not writable"));
    });
  });
});
