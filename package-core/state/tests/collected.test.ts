import { sleep } from "#common";
import { ok, ResultOk, err_nice } from "#result";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  state as st,
  StateResult,
  type StateREA,
  type StateREAW,
  type StateRES,
  type StateRESW,
  type StateROAW,
  type StateROS,
  type StateROSW,
} from "..";
import {
  test_state_get,
  test_state_get_ok,
  test_state_sub,
  test_state_read,
  type TestStateAll,
  type TestStateOk,
  type TestStateOkSync,
  type TestStateSync,
} from "./tests_shared";
import { TEST_ERROR } from "./tests_shared";

/**Waits for the subscribers to have been told, checking often, a fixed time is too short on a busy machine*/
const told = (check: () => void) =>
  vi.waitFor(check, { timeout: 1000, interval: 1 });

/**A value the test gives when it wants, for a state loading it*/
function loaded<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("Collected states", function () {
  //##################################################################################################################################################
  //      _____   ____   _____
  //     |  __ \ / __ \ / ____|
  //     | |__) | |  | | (___
  //     |  _  /| |  | |\___ \
  //     | | \ \| |__| |____) |
  //     |_|  \_\\____/|_____/
  describe("ROS", function () {
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
      await test_state_read(maker_single, 0);
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
      await test_state_read(maker_multiple, 0);
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
  describe("RES", function () {
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
      await test_state_read(maker_single, 0);
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
      await test_state_read(maker_multiple, 0);
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
  describe("ROA", function () {
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
      await test_state_read(maker_single, 50);
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
      await test_state_read(maker_multiple, 50);
    });
  });
  //##################################################################################################################################################
  //      _____  ______
  //     |  __ \|  ____|   /\
  //     | |__) | |__     /  \
  //     |  _  /|  __|   / /\ \
  //     | | \ \| |____ / ____ \
  //     |_|  \_\______/_/    \_\
  describe("REA", function () {
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
      await test_state_read(maker_single, 50);
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
      await test_state_read(maker_multiple, 50);
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
  describe("Batching", function () {
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
      expect(await state.read()).toEqual(ok(30));
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
      expect(await state.read()).toEqual(ok(30));
      state.unsub(sub);
    });

    it("ROA: waits for staggered initial states and uses updates received before initialization", async function () {
      //Loaded when the test lets them, so the order does not depend on timers
      const fast_load = loaded<ResultOk<number>>();
      const slow_load = loaded<ResultOk<number>>();
      const fast = st.roa(() => fast_load.promise);
      const slow = st.roa(() => slow_load.promise);
      const state = st.c.roa(
        (values) => ok(values[0].value + values[1].value),
        fast,
        slow,
      );
      const updates: ResultOk<number>[] = [];
      const sub = state.sub((value) => updates.push(value), true);

      fast_load.resolve(ok(1));
      await sleep(0);
      //The slow state has not loaded, nothing is told
      expect(updates).toEqual([]);

      fast.set_ok(10);
      slow_load.resolve(ok(2));
      await told(() => expect(updates).toEqual([ok(12)]));
      //Told once
      await sleep(0);
      expect(updates).toEqual([ok(12)]);
      state.unsub(sub);
    });

    it("REA: waits for staggered initial states and uses updates received before initialization", async function () {
      //Loaded when the test lets them, so the order does not depend on timers
      const fast_load = loaded<StateResult<number>>();
      const slow_load = loaded<StateResult<number>>();
      const fast = st.rea(() => fast_load.promise);
      const slow = st.rea(() => slow_load.promise);
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

      fast_load.resolve(ok(1));
      await sleep(0);
      //The slow state has not loaded, nothing is told
      expect(updates).toEqual([]);

      fast.set(ok(10));
      slow_load.resolve(ok(2));
      await told(() => expect(updates).toEqual([ok(12)]));
      //Told once
      await sleep(0);
      expect(updates).toEqual([ok(12)]);
      state.unsub(sub);
    });
  });

  describe("Edge cases", function () {
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

  describe(
    "Changing states and getter while subscribed",
    function () {
      const sum = (values: readonly StateResult<number>[]) => {
        let total = 0;
        for (const value of values) {
          if (value.err) return value;
          total += value.value;
        }
        return ok(total);
      };

      it("RES: set_states tells subscribers the new value", async function () {
        const state = st.c.res<number, StateRES<number>[]>(sum, st.ok(1));
        const updates: StateResult<number>[] = [];
        state.sub((value) => updates.push(value), true);
        //The first value is told
        await told(() => expect(updates).toEqual([ok(1)]));
        state.set_states(st.ok(1), st.ok(5));
        await told(() => expect(updates).toEqual([ok(1), ok(6)]));
      });

      it("REA: set_states tells subscribers the new value", async function () {
        const state = st.c.rea<number, StateRES<number>[]>(sum, st.ok(1));
        const updates: StateResult<number>[] = [];
        state.sub((value) => updates.push(value), true);
        //The first value is told
        await told(() => expect(updates).toEqual([ok(1)]));
        state.set_states(st.ok(1), st.ok(5));
        await told(() => expect(updates).toEqual([ok(1), ok(6)]));
        expect(await state.read()).toEqual(ok(6));
      });

      it("ROA: set_states tells subscribers the new value", async function () {
        const state = st.c.roa<
          number,
          [StateRES<number>, ...StateRES<number>[]]
        >(
          (values) =>
            ok(values.reduce((total, v) => total + (v.ok ? v.value : 0), 0)),
          st.ok(1),
        );
        const updates: StateResult<number>[] = [];
        state.sub((value) => updates.push(value), true);
        //The first value is told
        await told(() => expect(updates).toEqual([ok(1)]));
        state.set_states(st.ok(1), st.ok(5));
        await told(() => expect(updates).toEqual([ok(1), ok(6)]));
        expect(await state.read()).toEqual(ok(6));
      });

      it("REA: set_getter tells subscribers the new value", async function () {
        const state = st.c.rea<number, StateRES<number>[]>(sum, st.ok(1));
        const updates: StateResult<number>[] = [];
        state.sub((value) => updates.push(value), true);
        //The first value is told
        await told(() => expect(updates).toEqual([ok(1)]));
        state.set_getter(() => ok(10));
        await told(() => expect(updates).toEqual([ok(1), ok(10)]));
        expect(await state.read()).toEqual(ok(10));
      });

      it("REA: the first subscriber gets the first value once", async function () {
        const state = st.c.rea<number, StateRES<number>[]>(sum, st.ok(1));
        const updates: StateResult<number>[] = [];
        state.sub((value) => updates.push(value), true);
        await told(() => expect(updates).toEqual([ok(1)]));
        //And not again
        await sleep(5);
        expect(updates).toEqual([ok(1)]);
      });
    },
  );
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
    const total = st.c.rea_map(
      ([a, b]) => a * b,
      st.rea(() => sleep(1, ok(3))),
      st.res(ok(5)),
    );

    expect(await total.read()).toEqual(ok(15));
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
    const sum = st.c.resw(
      result_sum,
      { write: (_value: number) => Promise.resolve(failed) },
      a,
      b,
    );

    expect(await sum.write(9)).toBe(failed);
  });

  it("calls check and limit with the value and the states, and gives the value back without them", async () => {
    const [a, b] = states();
    const with_both = st.c.resw(
      result_sum,
      {
        write: (_value: number) => Promise.resolve(ok(undefined)),
        check: (value, collected) =>
          Promise.resolve(
            value > collected.length
              ? ok(value)
              : err_nice(TEST_ERROR, "too low"),
          ),
        limit: (value) => Promise.resolve(ok(Math.min(value, 10))),
      },
      a,
      b,
    );
    const without = st.c.resw(
      result_sum,
      { write: (_value: number) => Promise.resolve(ok(undefined)) },
      a,
      b,
    );

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

    const disabled = (result: StateResult<unknown>) =>
      !result.ok && result.error.kind === st.errors.WRITE_DISABLED;
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
    const reaw = st.c.reaw(
      (values) => values[0],
      write,
      st.rea(() => sleep(1, ok(4))),
    );
    const resw_map = st.c.resw_map(([v]) => v + 1, write, a);
    const reaw_map = st.c.reaw_map(
      ([v]) => v + 2,
      write,
      st.rea(() => sleep(1, ok(4))),
    );

    expect(rosw.ok()).toBe(4);
    expect((await roaw.read()).value).toBe(6);
    expect(await reaw.read()).toEqual(ok(4));
    expect(resw_map.get()).toEqual(ok(3));
    expect(await reaw_map.read()).toEqual(ok(6));
    for (const s of [rosw, roaw, reaw, resw_map, reaw_map])
      expect(s.writable).toBe(true);
    expectTypeOf(rosw).toMatchTypeOf<StateROSW<number, any, number>>();
    expectTypeOf(roaw).toMatchTypeOf<StateROAW<number, any, number>>();
    expectTypeOf(reaw).toMatchTypeOf<StateREAW<number, any, number>>();
    expectTypeOf(reaw_map).toMatchTypeOf<StateREAW<number, any, number>>();
  });

  it("gives a read only view that can not write", async () => {
    const write = { write: (_value: number) => Promise.resolve(ok(undefined)) };
    const view = st.c.rosw(
      (values) => ok(values[0].value),
      write,
      st.ok(1),
    ).read_only;

    expect(view.writable).toBe(false);
  });

  it("stays not writable when made without a write", async () => {
    const sum = st.c.res(result_sum, ...states());

    expect(sum.writable).toBe(false);
    expect((await sum.check!(1)).err).toBe(true);
  });
});

/**Sum of the values, the first error when one fails*/
function result_sum(
  values: readonly StateResult<number>[],
): StateResult<number> {
  let sum = 0;
  for (const value of values) {
    if (value.err) return value;
    sum += value.value;
  }
  return ok(sum);
}

describe("Reads of a subscribed collected state between a change and its microtask", function () {
  const sum_of = (runs: { count: number }) => (values: ResultOk<number>[]) => {
    runs.count++;
    return ok(values.reduce((total, value) => total + value.value, 0));
  };
  it("ROS: get gives the value of the states right after one changes", async function () {
    const a = st.ok_w(1);
    const b = st.ok_w(10);
    const sum = st.c.ros(([x, y]) => ok(x.value + y.value), a, b);
    sum.sub(() => {});
    a.set_ok(2);
    expect(sum.ok()).toBe(12);
    b.set_ok(20);
    expect(sum.get()).toEqual(ok(22));
  });
  it("RES: get gives the value of the states right after one changes", async function () {
    const a = st.from_w(1);
    const b = st.from_w(10);
    const sum = st.c.res_map(([x, y]) => x + y, a, b);
    sum.sub(() => {});
    a.set_ok(2);
    expect(sum.get()).toEqual(ok(12));
  });
  it("ROS: five sets with reads between them still tell the subscribers once, with the last value", async function () {
    const states = [1, 2, 3, 4, 5].map((v) => st.ok_w(v));
    const sum = st.c.ros(sum_of({ count: 0 }), ...(states as [typeof states[0], ...typeof states]));
    const told: number[] = [];
    sum.sub((value) => told.push(value.value));
    states.forEach((state, i) => {
      state.set_ok(10 * (i + 1));
      expect(sum.ok()).toBe(states.reduce((total, s) => total + s.ok(), 0));
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(told).toEqual([150]);
  });
  it("ROS: the getter runs once for a change read several times, and not again in the microtask", async function () {
    const runs = { count: 0 };
    const a = st.ok_w(1);
    const b = st.ok_w(10);
    const sum = st.c.ros(sum_of(runs), a, b);
    const told: number[] = [];
    sum.sub((value) => told.push(value.value));
    runs.count = 0;
    a.set_ok(2);
    expect(sum.ok()).toBe(12);
    expect(sum.ok()).toBe(12);
    await Promise.resolve();
    await Promise.resolve();
    expect(runs.count).toBe(1);
    expect(told).toEqual([12]);
  });
  it("ROS: without reads the getter runs once in the microtask, as before", async function () {
    const runs = { count: 0 };
    const a = st.ok_w(1);
    const b = st.ok_w(10);
    const sum = st.c.ros(sum_of(runs), a, b);
    sum.sub(() => {});
    runs.count = 0;
    a.set_ok(2);
    b.set_ok(20);
    await Promise.resolve();
    await Promise.resolve();
    expect(runs.count).toBe(1);
    expect(sum.ok()).toBe(22);
  });
  it("ROS: a getter that throws keeps the last value and tells no one", async function () {
    const a = st.ok_w(1);
    const sum = st.c.ros(([x]) => {
      if (x.value === 2) throw new Error("no 2");
      return ok(x.value);
    }, a);
    const told: number[] = [];
    sum.sub((value) => told.push(value.value));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    a.set_ok(2);
    expect(sum.ok()).toBe(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(told).toEqual([]);
    error.mockRestore();
  });
  it("REA: read gives the value of the states right after one changes", async function () {
    const a = st.ok_w(1);
    const b = st.ok_w(10);
    const sum = st.c.rea_map(([x, y]) => x + y, a, b);
    sum.sub(() => {});
    await sleep(1);
    a.set_ok(2);
    //Taken before anything else runs, so it is what the state has right now
    const read = sum.read();
    expect(await read).toEqual(ok(12));
  });
});

describe("Reads of states derived from a collected state, between a change and its microtask", function () {
  /**a and b, their sum, and a proxy and a collected state of the sum, all subscribed with filled buffers*/
  const chain = async () => {
    const a = st.ok_w(1);
    const b = st.ok_w(10);
    const sum = st.c.ros(([x, y]) => ok(x.value + y.value), a, b);
    const text = sum.proxy_map((v) => `sum ${v}`);
    const text_of_text = text.proxy_map((v) => `<${v}>`);
    const hundreds = st.c.ros(([s]) => ok(s.value * 100), sum);
    const told = { text: [] as string[], hundreds: [] as number[] };
    text.sub((v) => told.text.push(v.value));
    text_of_text.sub(() => {});
    hundreds.sub((v) => told.hundreds.push(v.value));
    //Fills the buffers, the derived states are told in microtasks
    a.set_ok(2);
    await sleep(0);
    told.text.length = 0;
    told.hundreds.length = 0;
    return { a, b, sum, text, text_of_text, hundreds, told };
  };
  it("a proxy of the collected state is current", async function () {
    const { a, text } = await chain();
    a.set_ok(3);
    expect(text.ok()).toBe("sum 13");
  });
  it("a proxy of a proxy of the collected state is current", async function () {
    const { a, text_of_text } = await chain();
    a.set_ok(3);
    expect(text_of_text.ok()).toBe("<sum 13>");
  });
  it("a collected state of the collected state is current", async function () {
    const { a, hundreds } = await chain();
    a.set_ok(3);
    expect(hundreds.ok()).toBe(1300);
    a.set_ok(4);
    expect(hundreds.ok()).toBe(1400);
  });
  it("the derived states are still told once, with the last value", async function () {
    const { a, b, text, hundreds, told } = await chain();
    a.set_ok(3);
    expect(text.ok()).toBe("sum 13");
    b.set_ok(20);
    expect(hundreds.ok()).toBe(2300);
    await sleep(0);
    expect(told.text).toEqual(["sum 23"]);
    expect(told.hundreds).toEqual([2300]);
  });
  it("a proxy is not told when the collected state is recomputed to the same value", async function () {
    const { a, b, told } = await chain();
    a.set_ok(3);
    b.set_ok(9);
    await sleep(0);
    expect(told.text).toEqual([]);
  });
  it("a subscriber of a source added before the collected state sees it current", async function () {
    const a = st.ok_w(1);
    const b = st.ok_w(10);
    const seen: number[] = [];
    const made: { sum?: StateROS<number> } = {};
    a.sub(() => seen.push(made.sum!.ok()));
    const sum = st.c.ros(([x, y]) => ok(x.value + y.value), a, b);
    made.sum = sum;
    const text = sum.proxy_map((v) => v * 2);
    sum.sub(() => {});
    text.sub(() => {});
    await sleep(0);
    a.set_ok(2);
    expect(seen).toEqual([12]);
  });
  it("a subscriber of a source added before a proxy sees the proxy current", async function () {
    const a = st.ok_w(1);
    const seen: number[] = [];
    const made: { doubled?: StateROS<number> } = {};
    a.sub(() => seen.push(made.doubled!.ok()));
    const doubled = a.proxy_map((v) => v * 2);
    made.doubled = doubled;
    doubled.sub(() => {});
    a.set_ok(2);
    await sleep(0);
    a.set_ok(3);
    expect(seen).toEqual([4, 6]);
  });
  it("a subscriber of a proxy sees a collected state of the same source current", async function () {
    const a = st.ok_w(1);
    const b = st.ok_w(10);
    const doubled = a.proxy_map((v) => v * 2);
    const sum = st.c.ros(([x, y]) => ok(x.value + y.value), a, b);
    const seen: number[] = [];
    //The proxy subscribes to a before the collected state does, so it is told first
    doubled.sub(() => seen.push(sum.ok()));
    sum.sub(() => {});
    a.set_ok(2);
    expect(seen).toEqual([12]);
  });
  it("read of a proxy of an async collected state is current", async function () {
    const a = st.ok_w(1);
    const b = st.ok_w(10);
    const sum = st.c.rea_map(([x, y]) => x + y, a, b);
    const text = sum.proxy_map((v) => `sum ${v}`);
    text.sub(() => {});
    //Lets the collected state get the values of its states, then fills the buffer of the proxy
    await sleep(1);
    a.set_ok(2);
    await sleep(1);
    expect(await text.read()).toEqual(ok("sum 12"));
    a.set_ok(3);
    const read = text.read();
    expect(await read).toEqual(ok("sum 13"));
  });
  it("derived subscribers count as subscribers of their state", async function () {
    const a = st.ok_w(1);
    const doubled = a.proxy_map((v) => v * 2);
    const sub = doubled.sub(() => {});
    expect(a.amount()).toBe(1);
    expect(a.in_use()).toBe(a);
    doubled.unsub(sub);
    expect(a.amount()).toBe(0);
  });
});

describe("Scheduling of collected states", function () {
  const sum = (values: ResultOk<number>[]) => ok(values.reduce((total, value) => total + value.value, 0));
  it("a chain of collected states tells its subscribers in the first microtask", async function () {
    const a = st.ok_w(1);
    const b = st.ok_w(10);
    const c1 = st.c.ros(sum, a, b);
    const c2 = st.c.ros(sum, c1);
    const c3 = st.c.ros(sum, c2);
    const told: number[] = [];
    c3.sub((value) => told.push(value.value));
    a.set_ok(2);
    await Promise.resolve();
    expect(told).toEqual([12]);
  });
  it("many collected states of one state are each told once", async function () {
    const a = st.ok_w(0);
    const told: number[] = [];
    for (let i = 0; i < 100; i++) st.c.ros(sum, a, st.ok(i)).sub((value) => told.push(value.value));
    a.set_ok(1000);
    a.set_ok(2000);
    await Promise.resolve();
    expect(told).toEqual(Array.from({ length: 100 }, (_, i) => 2000 + i));
  });
  it("a subscriber that throws does not stop the other collected states", async function () {
    const a = st.ok_w(0);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    st.c.ros(sum, a).sub(() => {
      throw new Error("subscriber");
    });
    const told: number[] = [];
    st.c.ros(sum, a).sub((value) => told.push(value.value));
    a.set_ok(1);
    await Promise.resolve();
    a.set_ok(2);
    await Promise.resolve();
    expect(told).toEqual([1, 2]);
    error.mockRestore();
  });
});
