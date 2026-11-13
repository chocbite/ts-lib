import { sleep } from "#common";
import { err, ok, ResultOk } from "#result";
import { describe, expect, it } from "vitest";
import { state as st, StateResult } from "..";
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
      stat1.set(err("fail"));
      stat2.set(ok(5));
      await sleep(1);
      expect(transform_call_count).equal(1);
      expect(state.get()).toEqual(err("fail"));
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
