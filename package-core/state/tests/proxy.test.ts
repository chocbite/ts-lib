import { sleep } from "#common";
import { ok, ResultOk, err_nice, NiceError, type Option } from "#result";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  state as st,
  StateResult,
  type StateREA,
  type StateRES,
  type StateROA,
  type StateROS,
  type StateREAW,
  type StateRESW,
  type StateROAW,
  type StateROSW,
  type StateProxyWrite,
} from "..";
import {
  test_state_get,
  test_state_get_ok,
  test_state_sub,
  test_state_read,
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
      st.ok(1).proxy_map((v) => v);
    });
    const maker: TestStateOkSync = () => {
      const stat = st.ok(1);
      const state = stat.proxy_map((v) => v);
      const set = (val: ResultOk<number>) => stat.set(val);
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
  });
  //##################################################################################################################################################
  describe("RES", { timeout: 100 }, function () {
    it("ok", async function () {
      st.ok(1).proxy((v) => v);
    });
    const maker: TestStateSync = () => {
      const stat = st.from(1);
      const state = stat.proxy((v) => v);
      const set = (val: StateResult<number>) => stat.set(val);
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
  describe("ROSW", { timeout: 100 }, function () {
    it("ok", async function () {
      st.rosw(ok(1), true).proxy_w_map((v) => v);
    });
    const maker: TestStateOkSync = () => {
      const stat = st.rosw(ok(1), true);
      const state = stat.proxy_w_map((v) => v);
      const set = (val: ResultOk<number>) => stat.set(val);
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
      const stat = st.rosw(ok(1), true);
      const state = stat.proxy_w_map((v) => v);
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
      st.resw(ok(1), true).proxy_w((v) => v);
    });
    const maker: TestStateSync = () => {
      const stat = st.resw(ok(1), true);
      const state = stat.proxy_w((v) => v);
      const set = (val: StateResult<number>) => stat.set(val);
      return { o: false, s: true, w: true, state, set };
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
    const maker_write: TestStateWrite = () => {
      const stat = st.resw(ok(1), true);
      const state = stat.proxy_w((v) => v);
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
      inner.proxy_map((v) => v);
    });
    const maker: TestStateOk = () => {
      let val: ResultOk<number> = ok(1);
      const inner = st.r.roa.from<number>(
        async (state) => state.update_single(val),
        () => {},
        () => {},
      );
      const state = inner.proxy_map((v) => v);
      const set = (v: ResultOk<number>) => {
        val = v;
        inner.update_value(v);
      };
      return { o: true, s: false, w: false, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 50);
    });
    describe("Read", async function () {
      await test_state_read(maker, 50);
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
      inner.proxy((v) => v);
    });
    const maker: TestStateAll = () => {
      let val: StateResult<number> = ok(1);
      const inner = st.r.rea.from<number>(
        async (state) => state.update_single(val),
        () => {},
        () => {},
      );
      const state = inner.proxy((v) => v);
      const set = (v: StateResult<number>) => {
        val = v;
        inner.update_value(v);
      };
      return { o: false, s: false, w: false, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 50);
    });
    describe("Read", async function () {
      await test_state_read(maker, 50);
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
      inner.proxy_w_map((v) => v);
    });
    const maker: TestStateOk = () => {
      let val: ResultOk<number> = ok(1);
      const inner = st.r.roaw.from<number>(
        async (state) => state.update_single(val),
        () => {},
        () => {},
      );
      const state = inner.proxy_w_map((v) => v);
      const set = (v: ResultOk<number>) => {
        val = v;
        inner.update_value(v);
      };
      return { o: true, s: false, w: true, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 50);
    });
    describe("Read", async function () {
      await test_state_read(maker, 50);
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
      inner.proxy_w((v) => v);
    });
    const maker: TestStateAll = () => {
      let val: StateResult<number> = ok(1);
      const inner = st.r.reaw.from<number>(
        async (state) => state.update_single(val),
        () => {},
        () => {},
      );
      const state = inner.proxy_w((v) => v);
      const set = (v: StateResult<number>) => {
        val = v;
        inner.update_value(v);
      };
      return { o: false, s: false, w: true, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 50);
    });
    describe("Read", async function () {
      await test_state_read(maker, 50);
    });
  });
});

describe("Proxy features", function () {
  //##################################################################################################################################################
  describe("transform_read", { timeout: 100 }, function () {
    it("transforms subscribed values", async function () {
      const inner = st.ok(5);
      const proxy = inner.proxy_map((v) => v * 2);
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
      const proxy = inner.proxy_map((v) => v * 2);
      expect(proxy.get()).toEqual(ok(10));
    });
    it("transforms then value", async function () {
      const inner = st.ok(5);
      const proxy = inner.proxy_map((v) => v * 2);
      const result = await proxy.read();
      expect(result).toEqual(ok(10));
    });
    it("transforms ok value", async function () {
      const inner = st.ok(5);
      const proxy = inner.proxy_map((v) => v * 2);
      expect(proxy.ok()).toEqual(10);
    });
  });
  //##################################################################################################################################################
  describe("write", { timeout: 100 }, function () {
    it("calls write with the value and the source state", async function () {
      const inner = st.rosw(ok(1), true);
      const proxy = inner.proxy_w_map((v) => v, {
        write: (value: number, source) => source.write(value * 2),
      });
      expect(await proxy.write(5)).toEqual(ok(undefined));
      expect(inner.get()).toEqual(ok(10));
    });
    it("gives the error of write", async function () {
      const failed = err_nice(TEST_KIND, "refused");
      const proxy = st.rosw(ok(1), true).proxy_w_map((v) => v, {
        write: (_value: number) => Promise.resolve(failed),
      });
      expect(await proxy.write(5)).toBe(failed);
    });
    it("can have a write type of its own", async function () {
      const inner = st.rosw(ok(1), true);
      const proxy = inner.proxy_w_map((v) => String(v), {
        write: (value: string, source) => source.write(Number(value)),
      });
      await proxy.write("7");
      expect(inner.get()).toEqual(ok(7));
      expect(proxy.ok()).toBe("7");
      expectTypeOf(proxy).toMatchTypeOf<StateROSW<string, any, string>>();
    });
    it("runs write, check and limit behind the write gate of the source", async function () {
      const inner = st.rosw(ok(1), true);
      inner.set_write_enabled(st.ok(false));
      let calls = 0;
      const count = (value: number) => {
        calls++;
        return Promise.resolve(ok(value));
      };
      const proxy = inner.proxy_w_map((v) => v, {
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
      const proxy = inner1.proxy_map((v) => v);
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
      const proxy = inner1.proxy_map((v) => v);
      expect(proxy.get()).toEqual(ok(1));
      proxy.set_state(inner2);
      expect(proxy.get()).toEqual(ok(2));
    });
    it("stops listening to old state after switch", async function () {
      const inner1 = st.ok(1);
      const inner2 = st.ok(10);
      const proxy = inner1.proxy_map((v) => v);
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
      const proxy = inner.proxy_map((v) => v * 2);
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
      const proxy = inner.proxy_map((v) => v * 2);
      expect(proxy.get()).toEqual(ok(10));
      proxy.set_transform_read((val) => ok(val.value * 3));
      expect(proxy.get()).toEqual(ok(15));
    });
  });
  //##################################################################################################################################################
  describe("write without transform", { timeout: 100 }, function () {
    it("passes write through when write transform not set", async function () {
      const inner = st.rosw(ok(1), true);
      const proxy = inner.proxy_w_map((v) => v);
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
      const proxy = inner_of().proxy_w_map((v) => v);
      expect(await proxy.limit(11)).toEqual(ok(10));
      expect(await proxy.limit(-11)).toEqual(ok(0));
      expect(await proxy.check(3)).toEqual(ok(3));
      expect(await proxy.check(11)).toEqual(
        err_nice(st.errors.ABOVE_MAX, "11 is bigger than the limit of 10"),
      );
    });
    it("calls check and limit of the write form with the value and the source", async function () {
      const proxy = inner_of().proxy_w_map((v) => v, {
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
      const proxy = inner_of().proxy_w_map((v) => v, {
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
    const proxy = source.proxy_map((v) => v);
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
    const proxy = st.from(1).proxy_ok((value) =>
      ok(value.ok ? value.value : 0),
    );
    expect(proxy.rok).toBe(true);
    expect(st.is.ros(proxy)).toBe(true);
  });
  it("ROS over a writable source reports not writable", function () {
    const proxy = st.ok_w(1).proxy_map((v) => v);
    expect(proxy.writable).toBe(false);
  });
  it("ROSW without write transform, writable matches whether write works", async function () {
    const proxy = st.ok_w(1).proxy_w_map((v) => v);
    const result = await proxy.write(5);
    expect(proxy.writable).toBe(result.ok);
  });
});

describe("Proxy map forms", { timeout: 100 }, function () {
  const failed = () => err_nice(TEST_KIND, "Source failed");

  it("gives res_map the plain value and makes an ok result of what it returns", function () {
    const source = st.res<number>(ok(4));
    const doubled = source.proxy_map((value) => value * 2);
    expect(doubled.get()).toEqual(ok(8));
    expectTypeOf(doubled.get()).toEqualTypeOf<StateResult<number>>();
  });

  it("passes the error of the source on as it is, without calling the function", function () {
    const error = failed();
    const source = st.res<number>(error);
    let calls = 0;
    const doubled = source.proxy_map((value) => {
      calls++;
      return value * 2;
    });
    expect(doubled.get()).toBe(error);
    expect(calls).toBe(0);
  });

  it("gives rea_map the plain value of an async state", async function () {
    const source = st.rea(() => sleep(1, ok(3)));
    const text = source.proxy_map((value) => `${value} items`);
    expect(await text.read()).toEqual(ok("3 items"));
  });

  it("writes through resw_map and reaw_map to the source, or through the write form", async function () {
    const sync = st.resw<number>(ok(1), true);
    const shown = sync.proxy_w_map((value) => value + 1);
    await shown.write(5);
    expect(sync.get()).toEqual(ok(5));
    expect(shown.get()).toEqual(ok(6));

    const async_source = st.reaw<number>(() => sleep(1, ok(1)), true);
    const text = async_source.proxy_w_map((value) => String(value), {
      write: (value: string, source) => source.write(Number(value)),
    });
    expect((await text.write("7")).ok).toBe(true);
    expect(await text.read()).toEqual(ok("7"));
  });
});

describe("Proxy methods of states", { timeout: 100 }, function () {
  it("proxy gives the result and makes a sync state that can fail from a sync state", function () {
    const source = st.ros(ok(5));
    const checked = source.proxy((result) =>
      result.value > 3 ? err_nice(TEST_KIND, "Too big") : ok(result.value),
    );
    expect(checked.rsync).toBe(true);
    expect(checked.rok).toBe(false);
    expect(checked.get().err).toBe(true);
    expectTypeOf(checked).toMatchTypeOf<StateRES<number>>();
  });

  it("proxy makes an async state from an async state", async function () {
    const source = st.rea(() => sleep(1, ok(2)));
    const proxied = source.proxy((result) => result.map((value) => value * 3));
    expect(proxied.rsync).toBe(false);
    expect(await proxied.read()).toEqual(ok(6));
    expectTypeOf(proxied).toMatchTypeOf<StateREA<number>>();
  });

  it("proxy_map keeps a sync ok state ok", function () {
    const source = st.ros(ok(2));
    const label = source.proxy_map((value) => `#${value}`);
    expect(label.rok).toBe(true);
    expect(label.ok()).toBe("#2");
    expectTypeOf(label).toMatchTypeOf<StateROS<string>>();
  });

  it("proxy_map keeps an async ok state ok", async function () {
    const source = st.roa(() => sleep(1, ok(2)));
    const label = source.proxy_map((value) => value + 1);
    expect(label.rok).toBe(true);
    expect(label.rsync).toBe(false);
    expect(await label.read()).toEqual(ok(3));
    expectTypeOf(label).toMatchTypeOf<StateROA<number>>();
  });

  it("proxy_map passes the error of a state that can fail on as it is", function () {
    const error = err_nice(TEST_KIND, "Source failed");
    const source = st.res<number>(error);
    const doubled = source.proxy_map((value) => value * 2);
    expect(doubled.get()).toBe(error);
    expectTypeOf(doubled).toMatchTypeOf<StateRES<number>>();
  });

  it("follows the source while subscribed", function () {
    const source = st.rosw(ok(1), true);
    const doubled = source.proxy_map((value) => value * 2);
    const seen: unknown[] = [];
    doubled.sub((result) => seen.push(result));
    source.set_ok(4);
    expect(seen).toEqual([ok(8)]);
  });

  it("can be called on the union types of states, like a parameter of type StateREA", async function () {
    const label = (temperature: StateREA<number>) => temperature.proxy_map((value) => `${value} °C`);
    const checked = (temperature: StateRES<number>) =>
      temperature.proxy((result) => (result.ok ? ok(result.value > 0) : ok(false)));
    expect(await label(st.res(ok(20))).read()).toEqual(ok("20 °C"));
    expect(checked(st.ros(ok(-1))).get()).toEqual(ok(false));
    expectTypeOf(label).returns.toMatchTypeOf<StateREA<string>>();
    expectTypeOf(checked).returns.toMatchTypeOf<StateRES<boolean>>();
  });

  it("is on writable states, read only views and every proxy", function () {
    const source = st.rosw(ok(1), true);
    expect(source.read_only.proxy_map((value) => value + 1).ok()).toBe(2);
    expect(source.proxy_map((value) => value + 1).proxy_map((value) => value * 10).ok()).toBe(20);
    expect(st.c.ros(([a, b]) => ok(a.value + b.value), st.ok(1), st.ok(2)).proxy_map((v) => -v).ok()).toBe(-3);
  });
});

describe("Writable proxy methods of states", { timeout: 100 }, function () {
  it("proxy_w gives the result, makes a writable sync state that can fail, and writes to the source", async function () {
    const source = st.rosw(ok(5), true);
    const checked = source.proxy_w((result) =>
      result.value > 9 ? err_nice(TEST_KIND, "Too big") : ok(result.value),
    );
    expect(checked.rsync).toBe(true);
    expect(checked.rok).toBe(false);
    expect(checked.writable).toBe(true);
    expect((await checked.write(12)).ok).toBe(true);
    expect(source.ok()).toBe(12);
    expect(checked.get().err).toBe(true);
    expectTypeOf(checked).toMatchTypeOf<StateRESW<number, Option<{}>, number>>();
  });

  it("proxy_w makes an async writable state from an async one", async function () {
    const source = st.reaw<number>(() => sleep(1, ok(2)), true);
    const proxied = source.proxy_w((result) => result.map((value) => value * 3));
    expect(proxied.rsync).toBe(false);
    expect(await proxied.read()).toEqual(ok(6));
    expectTypeOf(proxied).toMatchTypeOf<StateREAW<number, Option<{}>, number>>();
  });

  it("proxy_w_map keeps the kind of the state and its write type", async function () {
    const source = st.rosw(ok(2), true);
    const doubled = source.proxy_w_map((value) => value * 2);
    expect(doubled.rok).toBe(true);
    expect(doubled.ok()).toBe(4);
    await doubled.write(7);
    expect(source.ok()).toBe(7);
    expectTypeOf(doubled).toMatchTypeOf<StateROSW<number, Option<{}>, number>>();
    const async_ok = st.roaw<number>(() => sleep(1, ok(1)), true).proxy_w_map((value) => value + 1);
    expect(async_ok.rok).toBe(true);
    expect(await async_ok.read()).toEqual(ok(2));
    expectTypeOf(async_ok).toMatchTypeOf<StateROAW<number, Option<{}>, number>>();
  });

  it("passes the error of a state that can fail on as it is with proxy_w_map", function () {
    const error = err_nice(TEST_KIND, "Source failed");
    const source = st.resw<number>(error, true);
    const doubled = source.proxy_w_map((value) => value * 2);
    expect(doubled.get()).toBe(error);
    expectTypeOf(doubled).toMatchTypeOf<StateRESW<number, Option<{}>, number>>();
  });

  it("takes a write form, which gives the proxy a write type of its own", async function () {
    const source = st.rosw(ok(1), true);
    const text = source.proxy_w_map((value) => String(value), {
      write: (value: string, state) => state.write(Number(value)),
      check: async (value) => (isNaN(Number(value)) ? err_nice(TEST_KIND, "Not a number") : ok(value)),
    });
    expect((await text.write("8")).ok).toBe(true);
    expect(source.ok()).toBe(8);
    expect(text.ok()).toBe("8");
    expect((await text.check("x")).err).toBe(true);
    expectTypeOf(text).toMatchTypeOf<StateROSW<string, Option<{}>, string>>();
    const checked = source.proxy_w((result) => ok(result.value > 0), {
      write: (value: boolean, state) => state.write(value ? 1 : 0),
    });
    await checked.write(false);
    expect(source.ok()).toBe(0);
    expectTypeOf(checked).toMatchTypeOf<StateRESW<boolean, Option<{}>, boolean>>();
  });

  it("needs the write form for another write type, and is only on writable states", function () {
    const compile_only = () => {
      const source = st.rosw(ok(1), true);
      // @ts-expect-error a write type of its own needs the write form
      const text: StateROSW<string, Option<{}>, string> = source.proxy_w_map((value) => String(value));
      return text;
    };
    expect(compile_only).toBeTypeOf("function");
    //Read only states have no writable proxies
    expectTypeOf(st.ros(ok(1))).not.toHaveProperty("proxy_w_map");
    expectTypeOf(st.res(ok(1))).not.toHaveProperty("proxy_w");
  });

  it("goes through the write gate of the source", async function () {
    const source = st.rosw(ok(1), true);
    source.set_write_enabled(st.ok(false));
    const doubled = source.proxy_w_map((value) => value * 2);
    const written = await doubled.write(3);
    expect(!written.ok && written.error.kind).toBe(st.errors.WRITE_DISABLED);
    expect(source.ok()).toBe(1);
  });
});

describe("Proxy methods give the owner of the proxy", function () {
  it("proxy_map of a declared REA can be pointed at another REA", async function () {
    const first: StateREA<number> = st.from(1);
    const second: StateREA<number> = st.from(5);
    const doubled = first.proxy_map((v) => v * 2);
    expectTypeOf(doubled).toMatchTypeOf<StateREA<number>>();
    doubled.set_state(second);
    expect(await doubled.read()).toEqual(ok(10));
  });
  it("proxy_map of a ROS stays a ROS and can be pointed at another ROS", function () {
    const doubled = st.ok(1).proxy_map((v) => v * 2);
    expectTypeOf(doubled.ok()).toEqualTypeOf<number>();
    doubled.set_state(st.ok(4));
    expect(doubled.ok()).toBe(8);
    const compile_only = () => {
      // @ts-expect-error an error capable state could fail, the proxy is ok
      doubled.set_state(st.from(4));
    };
    expect(compile_only).toBeTypeOf("function");
  });
  it("set_transform_read changes the transform", function () {
    const source = st.ok(3);
    const shown = source.proxy((v) => v.map((n) => `${n}`));
    shown.set_transform_read((v) => v.map((n) => `#${n}`));
    expect(shown.get()).toEqual(ok("#3"));
  });
  it("proxy_w_map of a declared REAW keeps its owner and writes to the new state", async function () {
    const first: StateREAW<number> = st.from_w(1);
    const second = st.from_w(2);
    const shown = first.proxy_w_map((v) => v + 1);
    expectTypeOf(shown).toMatchTypeOf<StateREAW<number>>();
    shown.set_state(second);
    await shown.write(9);
    expect(second.get()).toEqual(ok(9));
    expect(first.get()).toEqual(ok(1));
  });
});

describe("proxy_ok", function () {
  const BROKEN = Symbol("Broken");
  it("makes an ok state of a sync state that can fail", function () {
    const source = st.from(2);
    const shown = source.proxy_ok((v) => (v.ok ? v : ok(0)));
    expectTypeOf(shown.ok()).toEqualTypeOf<number>();
    expect(shown.rok).toBe(true);
    expect(shown.rsync).toBe(true);
    expect(shown.ok()).toBe(2);
    source.set_err(new NiceError(BROKEN, "broken"));
    expect(shown.ok()).toBe(0);
  });
  it("makes an async ok state of an async state that can fail", async function () {
    const source = st.rea(async () => err_nice(BROKEN, "broken") as StateResult<number>);
    const shown = source.proxy_ok((v) => (v.ok ? v : ok(-1)));
    expectTypeOf(shown).toMatchTypeOf<StateROA<number>>();
    expect(shown.rok).toBe(true);
    expect(shown.rsync).toBe(false);
    expect(await shown.read()).toEqual(ok(-1));
  });
  it("of a declared RES can be pointed at another RES", function () {
    const first: StateRES<number> = st.from(1);
    const shown = first.proxy_ok((v) => (v.ok ? v : ok(0)));
    shown.set_state(st.err<number>(new NiceError(BROKEN, "broken")));
    expect(shown.ok()).toBe(0);
  });
  it("proxy_ok_w writes to the state", async function () {
    const source = st.from_w(1);
    const shown = source.proxy_ok_w((v) => (v.ok ? v : ok(0)));
    expectTypeOf(shown).toMatchTypeOf<StateROSW<number, any, number>>();
    await shown.write(4);
    expect(source.get()).toEqual(ok(4));
  });
  it("works on states that are ok, like proxy_map with the result", async function () {
    const shown = st.ok(1).proxy_ok((v) => v);
    expectTypeOf(shown.ok()).toEqualTypeOf<number>();
    expect(shown.ok()).toBe(1);
    const doubled = st.roa(() => sleep(1, ok(2))).proxy_ok((v) => ok(v.value * 2));
    expectTypeOf(doubled).toMatchTypeOf<StateROA<number>>();
    expect(await doubled.read()).toEqual(ok(4));
    const written = st.ok_w(1).proxy_ok_w((v) => v);
    await written.write(5);
    expect(written.ok()).toBe(5);
  });
  it("needs a transform, and proxy_ok_w is only on writable states", function () {
    //The calls do not compile, so lint sees what they give as any
    /* eslint-disable @typescript-eslint/no-unsafe-call */
    const compile_only = () => {
      // @ts-expect-error the transform makes it ok, it can not be left out
      st.from(1).proxy_ok();
      // @ts-expect-error proxy_ok_w is only on writable states
      st.from(1).proxy_ok_w((v: StateResult<number>) => (v.ok ? v : ok(0)));
    };
    /* eslint-enable @typescript-eslint/no-unsafe-call */
    expect(compile_only).toBeTypeOf("function");
  });
  it("is on the read only view of a state that can fail", function () {
    const shown = st.from(3).read_only.proxy_ok((v) => (v.ok ? v : ok(0)));
    expect(shown.ok()).toBe(3);
  });
});

describe("The state export", function () {
  it("has no proxy factories, the methods of the states make proxies", function () {
    expect("p" in st).toBe(false);
    expect("proxy" in st).toBe(false);
  });
});
