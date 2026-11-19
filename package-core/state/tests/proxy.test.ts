import { sleep } from "#common";
import { ok, ResultOk, err_nice } from "#result";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  state as st,
  StateResult,
  type StateROSW,
  type StateProxyWrite,
} from "..";
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

/**Kind of the errors tests make themselves*/
const TEST_KIND = Symbol("Test error");

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
      st.p.rosw(st.rosw(ok(1), true));
    });
    const maker: TestStateOkSync = () => {
      const stat = st.rosw(ok(1), true);
      const state = st.p.rosw(stat);
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
      const state = st.p.rosw(stat);
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
      st.p.resw(st.resw(ok(1), true));
    });
    const maker: TestStateSync = () => {
      const stat = st.resw(ok(1), true);
      const state = st.p.resw(stat);
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
      const state = st.p.resw(stat);
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
  describe("write", { timeout: 100 }, function () {
    it("calls write with the value and the source state", async function () {
      const inner = st.rosw(ok(1), true);
      const proxy = st.p.rosw(inner, undefined, {
        write: (value: number, source) => source.write(value * 2),
      });
      expect(await proxy.write(5)).toEqual(ok(undefined));
      expect(inner.get()).toEqual(ok(10));
    });
    it("gives the error of write", async function () {
      const failed = err_nice(TEST_KIND, "refused");
      const proxy = st.p.rosw(st.rosw(ok(1), true), undefined, {
        write: (_value: number) => Promise.resolve(failed),
      });
      expect(await proxy.write(5)).toBe(failed);
    });
    it("can have a write type of its own", async function () {
      const inner = st.rosw(ok(1), true);
      const proxy = st.p.rosw(inner, (val) => ok(String(val.value)), {
        write: (value: string, source) => source.write(Number(value)),
      });
      await proxy.write("7");
      expect(inner.get()).toEqual(ok(7));
      expect(proxy.ok()).toBe("7");
      expectTypeOf(proxy).toMatchTypeOf<StateROSW<string, any, string>>();
    });
    it("needs write when the write type differs from the source", function () {
      const inner = st.rosw(ok(1), true);
      const compile_only = () => {
        // @ts-expect-error a write type of its own needs write
        st.p.rosw<typeof inner, number, number, number, string>(inner);
      };
      expect(compile_only).toBeTypeOf("function");
      expectTypeOf(st.p.rosw(inner)).toMatchTypeOf<StateROSW<number, any, number>>();
    });
    it("runs write, check and limit behind the write gate of the source", async function () {
      const inner = st.rosw(ok(1), true);
      inner.set_write_enabled(st.ok(false));
      let calls = 0;
      const count = (value: number) => {
        calls++;
        return Promise.resolve(ok(value));
      };
      const proxy = st.p.rosw(inner, undefined, {
        write: (_value: number) => {
          calls++;
          return Promise.resolve(ok(undefined));
        },
        check: count,
        limit: count,
      });
      const disabled = (result: StateResult<unknown>) =>
        !result.ok && result.error.kind === st.errors.WRITE_DISABLED;
      expect(disabled(await proxy.write(1))).toBe(true);
      expect(disabled(await proxy.check(1))).toBe(true);
      expect(disabled(await proxy.limit(1))).toBe(true);
      expect(calls).toBe(0);
    });
    it("has the write form as a type", function () {
      expectTypeOf<StateProxyWrite<StateROSW<number, any, number>, string>>()
        .toHaveProperty("write");
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
    it("passes write through when write transform not set", async function () {
      const inner = st.rosw(ok(1), true);
      const proxy = st.p.rosw(inner);
      const result = await proxy.write(15);
      expect(result).toEqual(ok(undefined));
      expect(inner.ok()).toBe(15);
    });
  });
  //##################################################################################################################################################
  describe("limit and check", { timeout: 100 }, function () {
    const inner_of = () =>
      st.rosw(st.n.help(ok(5), { min: st.ok(0), max: st.ok(10) }), true);
    it("limits and checks through the source without write", async function () {
      const proxy = st.p.rosw(inner_of());
      expect(await proxy.limit(11)).toEqual(ok(10));
      expect(await proxy.limit(-11)).toEqual(ok(0));
      expect(await proxy.check(3)).toEqual(ok(3));
      expect(await proxy.check(11)).toEqual(
        err_nice(st.errors.ABOVE_MAX, "11 is bigger than the limit of 10"),
      );
    });
    it("calls check and limit of the write form with the value and the source", async function () {
      const proxy = st.p.rosw(inner_of(), undefined, {
        write: (value: number, source) => source.write(value * 2),
        limit: (value, source) =>
          source.limit(value * 2).then((limited) => limited.map((v) => v / 2)),
        check: (value, source) =>
          source.check(value * 2).then((checked) => checked.map(() => value)),
      });
      expect(await proxy.limit(11)).toEqual(ok(5));
      expect(await proxy.limit(-11)).toEqual(ok(0));
      expect(await proxy.check(3)).toEqual(ok(3));
      expect(await proxy.check(11)).toEqual(
        err_nice(st.errors.ABOVE_MAX, "22 is bigger than the limit of 10"),
      );
    });
    it("gives the value as it is when the write form has no check or limit", async function () {
      const proxy = st.p.rosw(inner_of(), undefined, {
        write: (value: number, source) => source.write(value),
      });
      expect(await proxy.limit(50)).toEqual(ok(50));
      expect(await proxy.check(50)).toEqual(ok(50));
    });
  });
});

describe("Proxy with in place changed values", { timeout: 100 }, function () {
  it("Passes on every array change of the source", async function () {
    const source = st.ok_w([1, 2]);
    const proxy = st.p.ros(source);
    const values: number[][] = [];
    proxy.sub((val) => values.push([...val.value]));
    source.array.push(3);
    source.array.push(4);
    source.array.pop();
    expect(values).toEqual([
      [1, 2, 3],
      [1, 2, 3, 4],
      [1, 2, 3],
    ]);
  });
});

describe("Proxy flags", { timeout: 100 }, function () {
  it("ROS over an errorable source reports ok", function () {
    const proxy = st.p.ros(st.from(1), (value) =>
      ok(value.ok ? value.value : 0),
    );
    expect(proxy.rok).toBe(true);
    expect(st.is.ros(proxy)).toBe(true);
  });
  it("ROS over a writable source reports not writable", function () {
    const proxy = st.p.ros(st.ok_w(1));
    expect(proxy.writable).toBe(false);
  });
  it("ROSW without write transform, writable matches whether write works", async function () {
    const proxy = st.p.rosw(st.ok_w(1));
    const result = await proxy.write(5);
    expect(proxy.writable).toBe(result.ok);
  });
});
