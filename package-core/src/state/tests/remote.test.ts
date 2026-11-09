import { sleep } from "#common";
import { ok, ResultOk } from "#result";
import { assertType, describe, expect, it } from "vitest";
import {
  state as st,
  StateREA,
  StateRemoteFuncREA,
  StateRemoteFuncREAW,
  StateRemoteFuncROA,
  StateRemoteFuncROAW,
  StateResult,
  StateROA,
  StateROAW,
} from "..";
import {
  test_state_sub,
  test_state_then,
  type TestStateAll,
  type TestStateOk,
  type TestStateWrite,
} from "./tests_shared";

describe("Resource states", function () {
  //##################################################################################################################################################
  //      _____   ____
  //     |  __ \ / __ \   /\
  //     | |__) | |  | | /  \
  //     |  _  /| |  | |/ /\ \
  //     | | \ \| |__| / ____ \
  //     |_|  \_\\____/_/    \_\
  describe("ROA", { timeout: 500 }, function () {
    it("ok", async function () {
      const init = st.r.roa.from<number>(
        () => {},
        () => {},
        () => {},
      );
      assertType<StateROA<number>>(init);
      assertType<StateRemoteFuncROA<number>>(init);
    });
    const maker: TestStateOk = () => {
      let val: ResultOk<number> = ok(1);
      const state = st.r.roa.from<number>(
        async (state) => state.update_single(val),
        () => {},
        () => {},
      );
      const set = (v: ResultOk<number>) => {
        val = v;
        state.update_value(v);
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
  //      _____  ______
  //     |  __ \|  ____|   /\
  //     | |__) | |__     /  \
  //     |  _  /|  __|   / /\ \
  //     | | \ \| |____ / ____ \
  //     |_|  \_\______/_/    \_\
  describe("REA", { timeout: 500 }, function () {
    it("ok", async function () {
      const init = st.r.rea.from<number>(
        () => {},
        () => {},
        () => {},
      );
      assertType<StateREA<number>>(init);
      assertType<StateRemoteFuncREA<number>>(init);
    });
    const maker: TestStateAll = () => {
      let val: StateResult<number> = ok(1);
      const state = st.r.rea.from<number>(
        async (state) => state.update_single(val),
        () => {},
        () => {},
      );
      const set = (v: StateResult<number>) => {
        val = v;
        state.update_value(v);
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
  //      _____   ____     __          __
  //     |  __ \ / __ \   /\ \        / /
  //     | |__) | |  | | /  \ \  /\  / /
  //     |  _  /| |  | |/ /\ \ \/  \/ /
  //     | | \ \| |__| / ____ \  /\  /
  //     |_|  \_\\____/_/    \_\/  \/
  describe("ROAW", { timeout: 500 }, function () {
    it("ok", async function () {
      const init = st.r.roaw.from<number>(
        () => {},
        () => {},
        () => {},
      );
      assertType<StateROAW<number>>(init);
      assertType<StateRemoteFuncROAW<number>>(init);
    });
    const maker: TestStateWrite = () => {
      let val: ResultOk<number> = ok(1);
      const state = st.r.roaw.from<number>(
        async (state) => state.update_single(val),
        () => {},
        () => {},
      );
      const set = (v: ResultOk<number>) => {
        val = v;
        state.update_value(v);
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
  //      _____  ______     __          __
  //     |  __ \|  ____|   /\ \        / /
  //     | |__) | |__     /  \ \  /\  / /
  //     |  _  /|  __|   / /\ \ \/  \/ /
  //     | | \ \| |____ / ____ \  /\  /
  //     |_|  \_\______/_/    \_\/  \/
  describe("REAW", { timeout: 500 }, function () {
    it("ok", async function () {
      const init = st.r.reaw.from<number>(
        () => {},
        () => {},
        () => {},
      );
      assertType<StateREA<number>>(init);
      assertType<StateRemoteFuncREAW<number>>(init);
    });
    const maker: TestStateWrite = () => {
      let val: StateResult<number> = ok(1);
      const state = st.r.reaw.from<number>(
        async (state) => state.update_single(val),
        () => {},
        () => {},
      );
      const set = (v: StateResult<number>) => {
        val = v;
        state.update_value(v);
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

describe("Resource state failures", { timeout: 500 }, function () {
  it("REA: read resolves to an error when the timeout is reached", async function () {
    const state = st.r.rea.from<number>(
      () => {},
      () => {},
      () => {},
      { timeout: 30 },
    );
    const read = await Promise.race([
      state.then((value) => value),
      sleep(100, "pending" as const),
    ]);
    expect(read).not.toBe("pending");
    expect((read as StateResult<number>).ok).toBe(false);
  });
  it("ROA: a read after the timeout retries and resolves all pending reads", async function () {
    let attempts = 0;
    const state = st.r.roa.from<number>(
      (state) => {
        if (attempts++ > 0) state.update_single(ok(5));
      },
      () => {},
      () => {},
      { timeout: 30 },
    );
    const first = state.then((value) => value);
    await sleep(50);
    expect(await state.then((value) => value)).toEqual(ok(5));
    expect(await first).toEqual(ok(5));
    expect(attempts).toBe(2);
  });
  it("REAW: debounced write resolves to an error when write_action rejects", async function () {
    const state = st.r.reaw.from<number>(
      () => {},
      () => {},
      () => {},
      async () => {
        throw new Error("Connection lost");
      },
      { write_debounce: 10 },
    );
    const result = await Promise.race([
      state.write(5),
      sleep(100, "pending" as const),
    ]);
    expect(result).not.toBe("pending");
    expect((result as StateResult<void>).ok).toBe(false);
  });
  it("REAW: write without debounce resolves to an error when write_action rejects", async function () {
    const state = st.r.reaw.from<number>(
      () => {},
      () => {},
      () => {},
      async () => {
        throw new Error("Connection lost");
      },
    );
    await expect(Promise.resolve(state.write(5))).resolves.toHaveProperty(
      "ok",
      false,
    );
  });
});
