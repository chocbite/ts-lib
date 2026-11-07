import { sleep } from "#common";
import { err, ok, ResultOk } from "#result";
import { assertType, describe, expect, it } from "vitest";
import {
  state as st,
  StateLocalREA,
  StateLocalREAW,
  StateLocalROA,
  StateLocalROAW,
  StateREA,
  StateREAW,
  StateResult,
  StateROA,
  StateROAW,
} from "..";
import {
  test_state_sub,
  test_state_then,
  test_state_write,
  type TestStateAll,
  type TestStateWrite,
} from "./tests_shared";

describe("Initialize delayed states", function () {
  //##################################################################################################################################################
  //      _____   ____
  //     |  __ \ / __ \   /\
  //     | |__) | |  | | /  \
  //     |  _  /| |  | |/ /\ \
  //     | | \ \| |__| / ____ \
  //     |_|  \_\\____/_/    \_\
  describe("ROA", { timeout: 100 }, function () {
    it("ok", async function () {
      const init = st.roa(() => sleep(1, ok(1)));
      assertType<StateROA<number>>(init);
      assertType<StateLocalROA<number>>(init);
    });
    it("rok is true", function () {
      expect(st.roa(() => sleep(1, ok(1))).rok).toBe(true);
    });
    it("rsync is false before resolve, true after", async function () {
      const s = st.roa(() => sleep(1, ok(1)));
      expect(s.rsync).toBe(false);
      await s;
      expect(s.rsync).toBe(true);
    });
    it("writable is false", function () {
      expect(st.roa(() => sleep(1, ok(1))).writable).toBe(false);
    });
    it("cleanup successfull", async function () {
      const init = st.roa(() => sleep(1, ok(1)));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const then = init.then;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const set = init.set;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const write = init.write;
      await init;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.then).not.eq(then, "then");
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.set).not.eq(set, "set");
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.write).not.eq(write, "write");
    });
    //# Standard Tests
    const maker: TestStateAll = () => {
      const state = st.roa(() => sleep(1, ok(1)));
      const set = (val: ResultOk<number>) => state.set(val);
      return { o: true, s: false, w: false, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 5);
    });
    describe("Then", async function () {
      await test_state_then(maker, 5);
    });
    const maker_delay: TestStateAll = () => {
      const state = st.roa(() => sleep(10, ok(1)));
      const set = (val: ResultOk<number>) => state.set(val);
      return { o: true, s: false, w: false, state, set };
    };
    it("Subscribing And Unsubscribing With Actual Delay", async function () {
      await test_state_sub(maker_delay, 20);
    });
    describe("Then With Actual Delay", async function () {
      await test_state_then(maker_delay, 20);
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
      const init = st.rea(() => sleep(1, ok(1)));
      assertType<StateREA<number>>(init);
      assertType<StateLocalREA<number>>(init);
    });
    it("err", async function () {
      const init = st.rea<number>(() => sleep(1, err("1")));
      assertType<StateREA<number>>(init);
      assertType<StateLocalREA<number>>(init);
    });
    it("rok is false", function () {
      expect(st.rea(() => sleep(1, ok(1))).rok).toBe(false);
    });
    it("rsync is false before resolve, true after", async function () {
      const s = st.rea(() => sleep(1, ok(1)));
      expect(s.rsync).toBe(false);
      await s;
      expect(s.rsync).toBe(true);
    });
    it("writable is false", function () {
      expect(st.rea(() => sleep(1, ok(1))).writable).toBe(false);
    });
    it("cleanup successfull", async function () {
      const init = st.rea(() => sleep(1, ok(1)));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const then = init.then;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const set = init.set;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const write = init.write;
      await init;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.then).not.eq(then, "then");
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.set).not.eq(set, "set");
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.write).not.eq(write, "write");
    });
    //# Standard Tests
    const maker: TestStateAll = () => {
      const state = st.rea(() => sleep(1, ok(1)));
      const set = (val: StateResult<number>) => state.set(val);
      return { o: false, s: false, w: false, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 5);
    });
    describe("Then", async function () {
      await test_state_then(maker, 5);
    });
    const maker_delay: TestStateAll = () => {
      const state = st.rea(() => sleep(10, ok(1)));
      const set = (val: StateResult<number>) => state.set(val);
      return { o: false, s: false, w: false, state, set };
    };
    it("Subscribing And Unsubscribing With Actual Delay", async function () {
      await test_state_sub(maker_delay, 20);
    });
    describe("Then With Actual Delay", async function () {
      await test_state_then(maker_delay, 20);
    });
  });
  //##################################################################################################################################################
  //      _____   ____     __          __
  //     |  __ \ / __ \   /\ \        / /
  //     | |__) | |  | | /  \ \  /\  / /
  //     |  _  /| |  | |/ /\ \ \/  \/ /
  //     | | \ \| |__| / ____ \  /\  /
  //     |_|  \_\\____/_/    \_\/  \/
  describe("ROAW", { timeout: 100 }, function () {
    it("ok", async function () {
      const init = st.roaw(() => sleep(1, ok(1)));
      assertType<StateROAW<number>>(init);
      assertType<StateLocalROAW<number>>(init);
    });
    it("rok is true", function () {
      expect(st.roaw(() => sleep(1, ok(1))).rok).toBe(true);
    });
    it("rsync is false before resolve, true after", async function () {
      const s = st.roaw(() => sleep(1, ok(1)));
      expect(s.rsync).toBe(false);
      await s;
      expect(s.rsync).toBe(true);
    });
    it("writable is true", function () {
      expect(st.roaw(() => sleep(1, ok(1))).writable).toBe(true);
    });
    it("cleanup successfull", async function () {
      const init = st.roaw(() => sleep(1, ok(1)));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const then = init.then;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const set = init.set;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const write = init.write;
      await init;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.then).not.eq(then, "then");
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.set).not.eq(set, "set");
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.write).not.eq(write, "write");
    });
    //# Standard Tests
    const maker: TestStateAll = () => {
      const state = st.roaw(() => sleep(1, ok(1)));
      const set = (val: ResultOk<number>) => state.set(val);
      return { o: true, s: false, w: true, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 5);
    });
    describe("Then", async function () {
      await test_state_then(maker, 5);
    });
    const maker_delay: TestStateAll = () => {
      const state = st.roaw(() => sleep(10, ok(1)));
      const set = (val: ResultOk<number>) => state.set(val);
      return { o: true, s: false, w: true, state, set };
    };
    it("Subscribing And Unsubscribing With Actual Delay", async function () {
      await test_state_sub(maker_delay, 20);
    });
    describe("Then With Actual Delay", async function () {
      await test_state_then(maker_delay, 20);
    });
    const maker_write: TestStateWrite = () => {
      const state = st.roaw(() => sleep(10, ok(1)), true);
      const set = (val: ResultOk<number>) => state.set(val);
      return { o: true, s: false, w: true, state, set };
    };
    it("Write", async function () {
      await test_state_write(maker_write, false);
    });
  });
  //##################################################################################################################################################
  //      _____  ______     __          __
  //     |  __ \|  ____|   /\ \        / /
  //     | |__) | |__     /  \ \  /\  / /
  //     |  _  /|  __|   / /\ \ \/  \/ /
  //     | | \ \| |____ / ____ \  /\  /
  //     |_|  \_\______/_/    \_\/  \/
  describe("REAW", { timeout: 200 }, function () {
    it("ok", async function () {
      const init = st.reaw(() => sleep(1, ok(1)));
      assertType<StateREAW<number>>(init);
      assertType<StateLocalREAW<number>>(init);
    });
    it("err", async function () {
      const init = st.reaw<number>(() => sleep(1, err("1")));
      assertType<StateREAW<number>>(init);
      assertType<StateLocalREAW<number>>(init);
    });
    it("rok is false", function () {
      expect(st.reaw(() => sleep(1, ok(1))).rok).toBe(false);
    });
    it("rsync is false before resolve, true after", async function () {
      const s = st.reaw(() => sleep(1, ok(1)));
      expect(s.rsync).toBe(false);
      await s;
      expect(s.rsync).toBe(true);
    });
    it("writable is true", function () {
      expect(st.reaw(() => sleep(1, ok(1))).writable).toBe(true);
    });
    it("cleanup successfull", async function () {
      const init = st.reaw(() => sleep(1, ok(1)));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const then = init.then;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const set = init.set;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const write = init.write;
      await init;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.then).not.eq(then, "then");
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.set).not.eq(set, "set");
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(init.write).not.eq(write, "write");
    });
    //# Standard Tests
    const maker: TestStateAll = () => {
      const state = st.reaw(() => sleep(1, ok(1)));
      const set = (val: StateResult<number>) => state.set(val);
      return { o: false, s: false, w: true, state, set };
    };
    it("Subscribing And Unsubscribing", async function () {
      await test_state_sub(maker, 5);
    });
    describe("Then", async function () {
      await test_state_then(maker, 5);
    });
    const maker_delay: TestStateAll = () => {
      const state = st.reaw(() => sleep(10, ok(1)));
      const set = (val: StateResult<number>) => state.set(val);
      return { o: false, s: false, w: true, state, set };
    };
    it("Subscribing And Unsubscribing With Actual Delay", async function () {
      await test_state_sub(maker_delay, 20);
    });
    describe("Then With Actual Delay", async function () {
      await test_state_then(maker_delay, 20);
    });
    const maker_write: TestStateWrite = () => {
      const state = st.reaw(() => sleep(10, ok(1)), true);
      const set = (val: StateResult<number>) => state.set(val);
      return { o: false, s: false, w: true, state, set };
    };
    it("Write", async function () {
      await test_state_write(maker_write, false);
    });
  });

  describe("Failing init", { timeout: 200 }, function () {
    const failing = () =>
      st.rea<number>(async () => {
        throw new Error("Init failed");
      });
    it("Pending reads settle when the init function throws", async function () {
      const state = failing();
      const read = await Promise.race([
        state.then((value) => value),
        sleep(50, "pending" as const),
      ]);
      expect(read).not.toBe("pending");
    });
    it("Reads after a failed init give a result", async function () {
      const state = failing();
      state.then(() => {});
      await sleep(10);
      const read = await Promise.race([
        state.then((value) => value),
        sleep(50, "pending" as const),
      ]);
      expect(read).toHaveProperty("ok");
    });
    it("ROA: retries init on the next read after a failed init", async function () {
      let attempts = 0;
      const state = st.roa<number>(async () => {
        if (attempts++ === 0) throw new Error("Init failed");
        return ok(5);
      });
      const first = state.then((value) => value);
      await sleep(10);
      expect(await state.then((value) => value)).toEqual(ok(5));
      expect(await first).toEqual(ok(5));
      expect(attempts).toBe(2);
    });
  });

  describe("Set during init", { timeout: 200 }, function () {
    it("ROA: value set while init is running is not overwritten by init", async function () {
      const state = st.roa<number>(() => sleep(20, ok(3)));
      const values: number[] = [];
      state.sub((value) => values.push(value.value));
      const first = state.then((value) => value);
      state.set_ok(5);
      expect(await first).toEqual(ok(5));
      await sleep(40);
      expect(await state.then((value) => value)).toEqual(ok(5));
      expect(values).toEqual([5]);
    });
  });
});
