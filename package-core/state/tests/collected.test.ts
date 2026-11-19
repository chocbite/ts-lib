import { sleep } from "#common";
import { ok, ResultOk, err_nice } from "#result";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  state as st,
  StateResult,
  type StateREA,
  type StateREAW,
  type StateRES,
  type StateRESW,
  type StateROAW,
  type StateROSW,
} from "..";
import {
  test_state_get,
  test_state_get_ok,
  test_state_sub,
  test_state_then,
  type TestStateAll,
  type TestStateOk,
  type TestStateOkSync,
  type TestStateSync,
} from "./tests_shared";
import { TEST_ERROR } from "./tests_shared";

describe("Collected states", function () {
  //##################################################################################################################################################
  //      _____   ____   _____
  //     |  __ \ / __ \ / ____|
  //     | |__) | |  | | (___
  //     |  _  /| |  | |\___ \
  //     | | \ \| |__| |____) |
  //     |_|  \_\\____/|_____/
  describe("ROS", { timeout: 100 }, function () {
    it("ok", async function () {
      const init = st.c.ros((val) => val[0], st.ok(1));
      expect(init).instanceOf(st.c.class);
    });
    const maker_single: TestStateOkSync = () => {
      const stat1 = st.ok(1);
      const state = st.c.ros((val) => val[0], stat1);
      const set = (val: ResultOk<number>) => {
        stat1.set_ok(val.value);
      };
      return { o: true, s: true, w: false, state, set };
    };
    it("Single Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker_single, 0);
    });
    describe("Single Then", async function () {
      await test_state_then(maker_single, 0);
    });
    it("Single Get", async function () {
      await test_state_get(maker_single);
    });
    it("Single GetOk", async function () {
      await test_state_get_ok(maker_single);
    });
    const maker_multiple: TestStateOkSync = () => {
      const stat1 = st.ok(0.25);
      const stat2 = st.ok(0.25);
      const stat3 = st.ok(0.25);
      const stat4 = st.ok(0.25);
      const state = st.c.ros(
        (val) => ok(val[0].value + val[1].value + val[2].value + val[3].value),
        stat1,
        stat2,
        stat3,
        stat4,
      );
      const set = (val: ResultOk<number>) => {
        stat1.set_ok(val.value / 4);
        stat2.set_ok(val.value / 4);
        stat3.set_ok(val.value / 4);
        stat4.set_ok(val.value / 4);
      };
      return { o: true, s: true, w: false, state, set };
    };
    it("Multiple Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker_multiple, 0);
    });
    describe("Multiple Then", async function () {
      await test_state_then(maker_multiple, 0);
    });
    it("Multiple Get", async function () {
      await test_state_get(maker_multiple);
    });
    it("Multiple GetOk", async function () {
      await test_state_get_ok(maker_multiple);
    });
  });
  //##################################################################################################################################################
  //      _____  ______  _____
  //     |  __ \|  ____|/ ____|
  //     | |__) | |__  | (___
  //     |  _  /|  __|  \___ \
  //     | | \ \| |____ ____) |
  //     |_|  \_\______|_____/
  describe("RES", { timeout: 100 }, function () {
    it("ok", async function () {
      const init = st.c.res((val) => val[0], st.from(1));
      expect(init).instanceOf(st.c.class);
    });
    const maker_single: TestStateSync = () => {
      const stat1 = st.from(1);
      const state = st.c.res((val) => val[0], stat1);
      const set = (val: StateResult<number>) => {
        stat1.set(val.map((v) => v));
      };
      return { o: false, s: true, w: false, state, set };
    };
    it("Single Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker_single, 0);
    });
    describe("Single Then", async function () {
      await test_state_then(maker_single, 0);
    });
    it("Single Get", async function () {
      await test_state_get(maker_single);
    });
    const maker_multiple: TestStateSync = () => {
      const stat1 = st.from(0.25);
      const stat2 = st.from(0.25);
      const stat3 = st.from(0.25);
      const stat4 = st.from(0.25);
      const state = st.c.res(
        (values) => {
          let sum = 0;
          for (const val of values) {
            if (val.err) return val;
            sum += val.value;
          }
          return ok(sum);
        },
        stat1,
        stat2,
        stat3,
        stat4,
      );
      const set = (val: StateResult<number>) => {
        stat1.set(val.map((v) => v / 4));
        stat2.set(val.map((v) => v / 4));
        stat3.set(val.map((v) => v / 4));
        stat4.set(val.map((v) => v / 4));
      };
      return { o: false, s: true, w: false, state, set };
    };
    it("Multiple Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker_multiple, 0);
    });
    describe("Multiple Then", async function () {
      await test_state_then(maker_multiple, 0);
    });
    it("Multiple Get", async function () {
      await test_state_get(maker_multiple);
    });
  });
  //##################################################################################################################################################
  //      _____   ____
  //     |  __ \ / __ \   /\
  //     | |__) | |  | | /  \
  //     |  _  /| |  | |/ /\ \
  //     | | \ \| |__| / ____ \
  //     |_|  \_\\____/_/    \_\
  describe("ROA", { timeout: 200 }, function () {
    it("ok", async function () {
      const init = st.c.roa(
        (val) => val[0],
        st.roa(() => sleep(1, ok(1))),
      );
      expect(init).instanceOf(st.c.class);
    });
    const maker_single: TestStateOk = () => {
      const stat1 = st.roa(() => sleep(1, ok(1)));
      const state = st.c.roa((val) => val[0], stat1);
      const set = (val: ResultOk<number>) => {
        stat1.set_ok(val.value);
      };
      return { o: true, s: false, w: false, state, set };
    };
    it("Single Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker_single, 50);
    });
    describe("Single Then", async function () {
      await test_state_then(maker_single, 50);
    });
    const maker_multiple: TestStateOk = () => {
      const stat1 = st.roa(() => sleep(1, ok(0.25)));
      const stat2 = st.roa(() => sleep(1, ok(0.25)));
      const stat3 = st.roa(() => sleep(1, ok(0.25)));
      const stat4 = st.roa(() => sleep(1, ok(0.25)));
      const state = st.c.roa(
        (val) => ok(val[0].value + val[1].value + val[2].value + val[3].value),
        stat1,
        stat2,
        stat3,
        stat4,
      );
      const set = (val: ResultOk<number>) => {
        stat1.set_ok(val.value / 4);
        stat2.set_ok(val.value / 4);
        stat3.set_ok(val.value / 4);
        stat4.set_ok(val.value / 4);
      };
      return { o: true, s: false, w: false, state, set };
    };
    it("Multiple Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker_multiple, 50);
    });
    describe("Multiple Then", async function () {
      await test_state_then(maker_multiple, 50);
    });
  });
  //##################################################################################################################################################
  //      _____  ______
  //     |  __ \|  ____|   /\
  //     | |__) | |__     /  \
  //     |  _  /|  __|   / /\ \
  //     | | \ \| |____ / ____ \
  //     |_|  \_\______/_/    \_\
  describe("REA", { timeout: 200 }, function () {
    it("ok", async function () {
      const init = st.c.rea(
        (val) => val[0],
        st.rea(() => sleep(1, ok(1))),
      );
      expect(init).instanceOf(st.c.class);
    });
    const maker_single: TestStateAll = () => {
      const stat1 = st.rea(() => sleep(1, ok(1)));
      const state = st.c.rea((values) => values[0], stat1);
      const set = (val: StateResult<number>) => {
        stat1.set(val.map((v) => v));
      };
      return { o: false, s: false, w: false, state, set };
    };
    it("Single Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker_single, 50);
    });
    describe("Single Then", async function () {
      await test_state_then(maker_single, 50);
    });
    const maker_multiple: TestStateAll = () => {
      const stat1 = st.rea(() => sleep(1, ok(0.25)));
      const stat2 = st.rea(() => sleep(1, ok(0.25)));
      const stat3 = st.rea(() => sleep(1, ok(0.25)));
      const stat4 = st.rea(() => sleep(1, ok(0.25)));
      const state = st.c.rea(
        (values) => {
          let sum = 0;
          for (const val of values) {
            if (val.err) return val;
            sum += val.value;
          }
          return ok(sum);
        },
        stat1,
        stat2,
        stat3,
        stat4,
      );
      const set = (val: StateResult<number>) => {
        stat1.set(val.map((v) => v / 4));
        stat2.set(val.map((v) => v / 4));
        stat3.set(val.map((v) => v / 4));
        stat4.set(val.map((v) => v / 4));
      };
      return { o: false, s: false, w: false, state, set };
    };
    it("Multiple Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker_multiple, 50);
    });
    describe("Multiple Then", async function () {
      await test_state_then(maker_multiple, 50);
    });
  });
  //##################################################################################################################################################
  //      ____        _       _     _
  //     |  _ \      | |     | |   (_)
  //     | |_) | __ _| |_ ___| |__  _ _ __   __ _
  //     |  _ < / _` | __/ __| '_ \| | '_ \ / _` |
  //     | |_) | (_| | || (__| | | | | | | | (_| |
  //     |____/ \__,_|\__\___|_| |_|_|_| |_|\__, |
  //                                          __/ |
  //                                         |___/
  describe("Batching", { timeout: 200 }, function () {
    it("ROS: transform called once when multiple states set in same event loop cycle", async function () {
      let transform_call_count = 0;
      const stat1 = st.ok(0.25);
      const stat2 = st.ok(0.25);
      const stat3 = st.ok(0.25);
      const stat4 = st.ok(0.25);
      const state = st.c.ros(
        (val) => {
          transform_call_count++;
          return ok(val[0].value + val[1].value + val[2].value + val[3].value);
        },
        stat1,
        stat2,
        stat3,
        stat4,
      );
      const sub = state.sub(() => {}, true);
      await sleep(0);
      // Reset count after initial subscription setup
      transform_call_count = 0;
      // Set all four states synchronously in the same event loop cycle
      stat1.set_ok(1);
      stat2.set_ok(2);
      stat3.set_ok(3);
      stat4.set_ok(4);
      // Wait for microtask to flush
      await sleep(1);
      expect(transform_call_count).equal(1);
      expect(state.get()).toEqual(ok(10));
      state.unsub(sub);
    });

    it("ROS: retains unchanged state values after subscribing", async function () {
      const stat1 = st.ok(1);
      const stat2 = st.ok(2);
      const state = st.c.ros(
        (values) => ok(values[0].value + values[1].value),
        stat1,
        stat2,
      );
      const sub = state.sub(() => {}, true);

      stat1.set_ok(10);
      await sleep(1);

      expect(state.get()).toEqual(ok(12));
      state.unsub(sub);
    });

    it("ROS: does not run a queued update after unsubscribing", async function () {
      const stat1 = st.ok(1);
      const stat2 = st.ok(2);
      const state = st.c.ros(
        (values) => ok(values[0].value + values[1].value),
        stat1,
        stat2,
      );
      const sub = state.sub(() => {});

      stat1.set_ok(10);
      state.unsub(sub);

      await Promise.resolve();
    });

    it("RES: transform called once when multiple states set in same event loop cycle", async function () {
      let transform_call_count = 0;
      const stat1 = st.from(0.25);
      const stat2 = st.from(0.25);
      const stat3 = st.from(0.25);
      const stat4 = st.from(0.25);
      const state = st.c.res(
        (values) => {
          transform_call_count++;
          let sum = 0;
          for (const val of values) {
            if (val.err) return val;
            sum += val.value;
          }
          return ok(sum);
        },
        stat1,
        stat2,
        stat3,
        stat4,
      );
      const sub = state.sub(() => {}, true);
      await sleep(0);
      transform_call_count = 0;
      stat1.set(ok(1));
      stat2.set(ok(2));
      stat3.set(ok(3));
      stat4.set(ok(4));
      await sleep(1);
      expect(transform_call_count).equal(1);
      expect(state.get()).toEqual(ok(10));
      state.unsub(sub);
    });

    it("ROS: transform called once per batch across multiple batches", async function () {
      let transform_call_count = 0;
      const stat1 = st.ok(1);
      const stat2 = st.ok(2);
      const state = st.c.ros(
        (val) => {
          transform_call_count++;
          return ok(val[0].value + val[1].value);
        },
        stat1,
        stat2,
      );
      const sub = state.sub(() => {}, true);
      await sleep(0);
      transform_call_count = 0;
      // First batch: set both states
      stat1.set_ok(10);
      stat2.set_ok(20);
      await sleep(1);
      expect(transform_call_count).equal(1);
      expect(state.get()).toEqual(ok(30));
      // Second batch: set both states again
      stat1.set_ok(100);
      stat2.set_ok(200);
      await sleep(1);
      expect(transform_call_count).equal(2);
      expect(state.get()).toEqual(ok(300));
      state.unsub(sub);
    });

    it("RES: transform called once per batch when error state mixed with ok state", async function () {
      let transform_call_count = 0;
      const stat1 = st.from(1);
      const stat2 = st.from(2);
      const state = st.c.res(
        (values) => {
          transform_call_count++;
          let sum = 0;
          for (const val of values) {
            if (val.err) return val;
            sum += val.value;
          }
          return ok(sum);
        },
        stat1,
        stat2,
      );
      const sub = state.sub(() => {}, true);
      await sleep(0);
      transform_call_count = 0;
      // Set one to error and another to ok in the same cycle
      stat1.set(err_nice(TEST_ERROR, "fail"));
      stat2.set(ok(5));
      await sleep(1);
      expect(transform_call_count).equal(1);
      expect(state.get()).toEqual(err_nice(TEST_ERROR, "fail"));
      state.unsub(sub);
    });

    it("ROA: transform called once when multiple states set in same event loop cycle", async function () {
      let transform_call_count = 0;
      const stat1 = st.roa(() => sleep(1, ok(0.25)));
      const stat2 = st.roa(() => sleep(1, ok(0.25)));
      const state = st.c.roa(
        (val) => {
          transform_call_count++;
          return ok(val[0].value + val[1].value);
        },
        stat1,
        stat2,
      );
      const sub = state.sub(() => {}, true);
      await sleep(50);
      // After async resolution, reset count
      transform_call_count = 0;
      // Set both states synchronously
      stat1.set_ok(10);
      stat2.set_ok(20);
      await sleep(1);
      expect(transform_call_count).equal(1);
      expect(await state).toEqual(ok(30));
      state.unsub(sub);
    });

    it("REA: transform called once when multiple states set in same event loop cycle", async function () {
      let transform_call_count = 0;
      const stat1 = st.rea(() => sleep(1, ok(0.25)));
      const stat2 = st.rea(() => sleep(1, ok(0.25)));
      const state = st.c.rea(
        (values) => {
          transform_call_count++;
          let sum = 0;
          for (const val of values) {
            if (val.err) return val;
            sum += val.value;
          }
          return ok(sum);
        },
        stat1,
        stat2,
      );
      const sub = state.sub(() => {}, true);
      await sleep(50);
      transform_call_count = 0;
      stat1.set(ok(10));
      stat2.set(ok(20));
      await sleep(1);
      expect(transform_call_count).equal(1);
      expect(await state).toEqual(ok(30));
      state.unsub(sub);
    });

    it("ROA: waits for staggered initial states and uses updates received before initialization", async function () {
      const fast = st.roa(() => sleep(1, ok(1)));
      const slow = st.roa(() => sleep(30, ok(2)));
      const state = st.c.roa(
        (values) => ok(values[0].value + values[1].value),
        fast,
        slow,
      );
      const updates: ResultOk<number>[] = [];
      const sub = state.sub((value) => updates.push(value), true);

      await sleep(10);
      expect(updates).toEqual([]);

      fast.set_ok(10);
      await sleep(30);

      expect(updates).toEqual([ok(12)]);
      state.unsub(sub);
    });

    it("REA: waits for staggered initial states and uses updates received before initialization", async function () {
      const fast = st.rea(() => sleep(1, ok(1)));
      const slow = st.rea(() => sleep(30, ok(2)));
      const state = st.c.rea(
        (values) => {
          if (values[0].err) return values[0];
          if (values[1].err) return values[1];
          return ok(values[0].value + values[1].value);
        },
        fast,
        slow,
      );
      const updates: StateResult<number>[] = [];
      const sub = state.sub((value) => updates.push(value), true);

      await sleep(10);
      expect(updates).toEqual([]);

      fast.set(ok(10));
      await sleep(30);

      expect(updates).toEqual([ok(12)]);
      state.unsub(sub);
    });
  });

  describe("Edge cases", { timeout: 200 }, function () {
    it("ROS: keeps recomputing after the getter throws once", async function () {
      const source = st.ok_w(1);
      const state = st.c.ros((values) => {
        if (values[0].value === 2) throw new Error("Getter failed");
        return values[0];
      }, source);
      const updates: number[] = [];
      state.sub((value) => updates.push(value.value));
      source.set_ok(2);
      await sleep(5);
      source.set_ok(3);
      await sleep(5);
      expect(updates).toEqual([3]);
    });

    it("ROA: getter is not run before all states have a value, when one state updates twice", async function () {
      const fast = st.ok_w(1);
      const slow = st.roa(() => sleep(30, ok(10)));
      const getter_inputs: (number | undefined)[][] = [];
      const state = st.c.roa(
        (values) => {
          getter_inputs.push(Array.from(values, (value) => value?.value));
          return ok(values[0].value + values[1].value);
        },
        fast,
        slow,
      );
      const updates: number[] = [];
      state.sub((value) => updates.push(value.value), true);
      fast.set_ok(2);
      fast.set_ok(3);
      await sleep(50);
      expect(getter_inputs).toEqual([[3, 10]]);
      expect(updates).toEqual([13]);
    });
  });
});

describe("Collected states with ok values", () => {
  it("gives res_map the plain values and makes an ok result of what it returns", () => {
    const speed = st.res(ok(4));
    const name = st.res(ok("pump"));

    const label = st.c.res_map(([s, n]) => `${n}: ${s}`, speed, name);

    expect(label.get()).toEqual(ok("pump: 4"));
    expectTypeOf(label).toMatchTypeOf<StateRES<string>>();
  });

  it("passes the first error on unchanged without calling the transform", () => {
    const first = err_nice(TEST_ERROR, "first");
    let calls = 0;
    const label = st.c.res_map(
      ([a, b, c]) => {
        calls++;
        return a + b + c;
      },
      st.res(ok(1)),
      st.res<number>(first),
      st.res<number>(err_nice(TEST_ERROR, "second")),
    );

    expect(label.get()).toBe(first);
    expect(calls).toBe(0);
  });

  it("gives rea_map the plain values of async states", async () => {
    const total = st.c.rea_map(([a, b]) => a * b, st.rea(() => sleep(1, ok(3))), st.res(ok(5)));

    expect(await total).toEqual(ok(15));
    expectTypeOf(total).toMatchTypeOf<StateREA<number>>();
  });

  it("follows changes of the states like the other collected states", async () => {
    const a = st.resw(ok(1));
    const sum = st.c.res_map(([v]) => v * 10, a);
    const seen: unknown[] = [];
    sum.sub((value) => seen.push(value.ok && value.value));

    a.set(ok(2));
    await sleep(0);
    a.set(err_nice(TEST_ERROR, "gone"));
    await sleep(0);

    expect(seen).toEqual([20, false]);
  });
});

describe("Writable collected states", () => {
  const states = () => [st.resw(ok(1)), st.resw(ok(2))] as const;

  it("is writable and calls write with the value and the states", async () => {
    const [a, b] = states();
    const calls: unknown[] = [];
    const sum = st.c.resw(
      (values) => result_sum(values),
      {
        write: (value: number, collected) => {
          calls.push([value, collected]);
          return Promise.resolve(ok(undefined));
        },
      },
      a,
      b,
    );

    expect(sum.writable).toBe(true);
    expect(await sum.write(9)).toEqual(ok(undefined));
    expect(calls).toEqual([[9, [a, b]]]);
    expectTypeOf(sum).toMatchTypeOf<StateRESW<number, any, number>>();
  });

  it("gives the result of write, an error included", async () => {
    const [a, b] = states();
    const failed = err_nice(TEST_ERROR, "refused");
    const sum = st.c.resw(result_sum, { write: (_value: number) => Promise.resolve(failed) }, a, b);

    expect(await sum.write(9)).toBe(failed);
  });

  it("calls check and limit with the value and the states, and gives the value back without them", async () => {
    const [a, b] = states();
    const with_both = st.c.resw(
      result_sum,
      {
        write: (_value: number) => Promise.resolve(ok(undefined)),
        check: (value, collected) =>
          Promise.resolve(value > collected.length ? ok(value) : err_nice(TEST_ERROR, "too low")),
        limit: (value) => Promise.resolve(ok(Math.min(value, 10))),
      },
      a,
      b,
    );
    const without = st.c.resw(result_sum, { write: (_value: number) => Promise.resolve(ok(undefined)) }, a, b);

    expect(await with_both.limit(50)).toEqual(ok(10));
    expect((await with_both.check(1)).err).toBe(true);
    expect(await with_both.check(5)).toEqual(ok(5));
    expect(await without.limit(50)).toEqual(ok(50));
    expect(await without.check(50)).toEqual(ok(50));
  });

  it("applies the write gate to write, check and limit", async () => {
    const [a, b] = states();
    let writes = 0;
    const sum = st.c.resw(
      result_sum,
      {
        write: (_value: number) => {
          writes++;
          return Promise.resolve(ok(undefined));
        },
      },
      a,
      b,
    );
    sum.set_write_enabled(st.ok(false));

    const disabled = (result: StateResult<unknown>) => !result.ok && result.error.kind === st.errors.WRITE_DISABLED;
    expect(disabled(await sum.write(1))).toBe(true);
    expect(disabled(await sum.check(1))).toBe(true);
    expect(disabled(await sum.limit(1))).toBe(true);
    expect(writes).toBe(0);
  });

  it("has rosw, roaw and reaw, and ok forms of resw and reaw", async () => {
    const write = { write: (_value: number) => Promise.resolve(ok(undefined)) };
    const a = st.ok(2);
    const rosw = st.c.rosw((values) => ok(values[0].value * 2), write, a);
    const roaw = st.c.roaw((values) => ok(values[0].value * 3), write, a);
    const reaw = st.c.reaw((values) => values[0], write, st.rea(() => sleep(1, ok(4))));
    const resw_map = st.c.resw_map(([v]) => v + 1, write, a);
    const reaw_map = st.c.reaw_map(([v]) => v + 2, write, st.rea(() => sleep(1, ok(4))));

    expect(rosw.ok()).toBe(4);
    expect((await roaw).value).toBe(6);
    expect(await reaw).toEqual(ok(4));
    expect(resw_map.get()).toEqual(ok(3));
    expect(await reaw_map).toEqual(ok(6));
    for (const s of [rosw, roaw, reaw, resw_map, reaw_map]) expect(s.writable).toBe(true);
    expectTypeOf(rosw).toMatchTypeOf<StateROSW<number, any, number>>();
    expectTypeOf(roaw).toMatchTypeOf<StateROAW<number, any, number>>();
    expectTypeOf(reaw).toMatchTypeOf<StateREAW<number, any, number>>();
    expectTypeOf(reaw_map).toMatchTypeOf<StateREAW<number, any, number>>();
  });

  it("gives a read only view that can not write", async () => {
    const write = { write: (_value: number) => Promise.resolve(ok(undefined)) };
    const view = st.c.rosw((values) => ok(values[0].value), write, st.ok(1)).read_only;

    expect(view.writable).toBe(false);
  });

  it("stays not writable when made without a write", async () => {
    const sum = st.c.res(result_sum, ...states());

    expect(sum.writable).toBe(false);
    expect((await sum.check!(1)).err).toBe(true);
  });
});

/**Sum of the values, the first error when one fails*/
function result_sum(values: readonly StateResult<number>[]): StateResult<number> {
  let sum = 0;
  for (const value of values) {
    if (value.err) return value;
    sum += value.value;
  }
  return ok(sum);
}
