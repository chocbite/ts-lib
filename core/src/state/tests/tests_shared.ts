import { sleep } from "#common";
import { err, ok, ResultOk } from "#result";
import { expect, it } from "vitest";
import type {
  StateResult as SR,
  StateREA,
  StateREAW,
  StateRES,
  StateRESW,
  StateROA,
  StateROAW,
  StateROS,
  StateROSW,
  StateSub,
} from "../types";

function err_gen() {
  return "Test Error";
}

type StateType<O, SY, W, ST, R> = {
  o: O;
  s: SY;
  w: W;
  ws?: number;
  state: ST;
  set: (val: R) => void;
};
type RERR = SR<number>;
type ROK = ResultOk<number>;

export type TestStateAll = (
  setter?: (w: number) => void,
) =>
  | StateType<true, true, false, StateROS<number>, ROK>
  | StateType<true, true, true, StateROSW<number>, ROK>
  | StateType<true, false, false, StateROA<number>, ROK>
  | StateType<true, false, true, StateROAW<number>, ROK>
  | StateType<false, true, false, StateRES<number>, RERR>
  | StateType<false, true, true, StateRESW<number>, RERR>
  | StateType<false, false, false, StateREA<number>, RERR>
  | StateType<false, false, true, StateREAW<number>, RERR>;

export type TestStateOk = () =>
  | StateType<true, true, false, StateROS<number>, ROK>
  | StateType<true, true, true, StateROSW<number>, ROK>
  | StateType<true, false, false, StateROA<number>, ROK>
  | StateType<true, false, true, StateROAW<number>, ROK>;

export type TestStateSync = () =>
  | StateType<true, true, false, StateROS<number>, ROK>
  | StateType<true, true, true, StateROSW<number>, ROK>
  | StateType<false, true, false, StateRES<number>, RERR>
  | StateType<false, true, true, StateRESW<number>, RERR>;

export type TestStateOkSync = () =>
  | StateType<true, true, false, StateROS<number>, ROK>
  | StateType<true, true, true, StateROSW<number>, ROK>;

export type TestStateWrite = () =>
  | StateType<true, true, true, StateROSW<number>, ROK>
  | StateType<true, false, true, StateROAW<number>, ROK>
  | StateType<false, true, true, StateRESW<number>, RERR>
  | StateType<false, false, true, StateREAW<number>, RERR>;

//       _____ _    _ ____   _____  _____ _____  _____ ____  ______
//      / ____| |  | |  _ \ / ____|/ ____|  __ \|_   _|  _ \|  ____|
//     | (___ | |  | | |_) | (___ | |    | |__) | | | | |_) | |__
//      \___ \| |  | |  _ < \___ \| |    |  _  /  | | |  _ <|  __|
//      ____) | |__| | |_) |____) | |____| | \ \ _| |_| |_) | |____
//     |_____/ \____/|____/|_____/ \_____|_|  \_\_____|____/|______|
/**Tests different cases of subscribing and unsubscribing to a state
 * @param wait Time to wait after subscribing first time for async states
 */
export async function test_state_sub(
  state_maker: TestStateAll,
  wait: number,
): Promise<void> {
  const made = state_maker();
  const { state, set } = made;
  const warn_backup = console.error;
  console.error = () => {
    count += 100000000;
  };
  let count = 0;
  const sub1 = state.sub<StateSub<SR<number>>>(() => {
    count++;
  }, true);
  expect(state.in_use()).equal(state);
  expect(state.has(sub1)).equal(state);
  expect(state.amount()).equal(1);
  await sleep(wait ?? 1);
  expect(count).equal(1);
  const sub2 = state.sub<StateSub<SR<number>>>(() => {
    count += 10;
  });
  expect(state.in_use()).equal(state);
  expect(state.has(sub2)).equal(state);
  expect(state.amount()).equal(2);
  expect(count).equal(1);
  set(ok(8));
  await sleep(1);
  expect(count).equal(12);
  const sub3 = state.sub<StateSub<SR<number>>>(() => {
    count += 100;
    throw new Error("Gaurded against crash");
  });
  expect(state.in_use()).equal(state);
  expect(state.has(sub3)).equal(state);
  expect(state.amount()).equal(3);
  set(ok(12));
  await sleep(1);
  expect(count).equal(100000123);
  state.unsub(sub1);
  state.unsub(sub2);
  expect(state.in_use()).equal(state);
  expect(state.has(sub3)).equal(state);
  expect(state.amount()).equal(1);
  set(ok(13));
  await sleep(1);
  expect(count).equal(200000223);
  state.unsub(sub3);
  expect(state.in_use()).equal(undefined);
  expect(state.amount()).equal(0);
  const [sub4, val] = await new Promise<[StateSub<any>, SR<number>]>((a) => {
    const sub4 = state.sub((val) => {
      count += 1000;
      a([sub4, val]);
    });
    set(ok(15));
  });
  await sleep(1);
  expect(val).toEqual(ok(15));
  expect(count).equal(200001223);
  state.unsub(sub4);
  if (!made.o) {
    const [sub5, val2] = await new Promise<[StateSub<any>, SR<number>]>((a) => {
      const sub5 = state.sub((val) => {
        count += 10000;
        a([sub5, val]);
      });
      made.set(err(err_gen()));
    });
    await sleep(1);
    expect(val2).toEqual(err(err_gen()));
    expect(count).equal(200011223);
    state.unsub(sub5);
  }

  console.error = warn_backup;
}

//      _______ _    _ ______ _   _
//     |__   __| |  | |  ____| \ | |
//        | |  | |__| | |__  |  \| |
//        | |  |  __  |  __| | . ` |
//        | |  | |  | | |____| |\  |
//        |_|  |_|  |_|______|_| \_|
/**Tests different cases of using then on a state
 * Expects initial value to be number 1
 * @param wait Time to wait for async states values
 */
export async function test_state_then(
  state_maker: TestStateAll,
  wait: number,
): Promise<void> {
  it("awaiting then setting trice", async function () {
    const { state, set } = state_maker();
    let awaited = await Promise.race([state, sleep(wait)]);
    expect(awaited).instanceOf(ResultOk);
    expect(awaited).toEqual(ok(1));
    set(ok(5));
    awaited = await Promise.race([state, sleep(wait)]);
    expect(awaited).instanceOf(ResultOk);
    expect(awaited).toEqual(ok(5));
    set(ok(9999999999));
    awaited = await Promise.race([state, sleep(wait)]);
    expect(awaited).instanceOf(ResultOk);
    expect(awaited).toEqual(ok(9999999999));
  });
  it("using then", async function () {
    const { state } = state_maker();
    await Promise.race([
      new Promise((a) => {
        state.then((val) => {
          expect(val).instanceOf(ResultOk);
          expect(val).toEqual(ok(1));
          a(null);
        });
      }),
      sleep(wait),
    ]);
  });
  it("using then", async function () {
    const { state } = state_maker();
    expect(
      await new Promise((a) => {
        state
          .then((val) => {
            expect(val).instanceOf(ResultOk);
            expect(val).toEqual(ok(1));
            return 8;
          })
          .then((val) => {
            expect(val).equal(8);
            a(12);
          });
      }),
    ).equal(12);
  });
  it("using then", async function () {
    const { state } = state_maker();
    expect(
      await new Promise((a) => {
        state
          .then((val) => {
            expect(val).instanceOf(ResultOk);
            expect(val).toEqual(ok(1));
            throw new Error("8");
          })
          .then(
            () => {},
            (val) => {
              expect(val).toEqual(new Error("8"));
              a(12);
            },
          );
      }),
    ).equal(12);
  });
  it("setting then awaiting", async function () {
    const { state, set } = state_maker();
    set(ok(7));
    const awaited = await state;
    expect(awaited).toEqual(ok(7));
  });
  it("setting error then awaiting", async function () {
    const made = state_maker();
    if (made.o) return;
    made.set(err(err_gen()));
    const awaited = await made.state;
    expect(awaited).toEqual(err(err_gen()));
  });
}

//       _____ ______ _______
//      / ____|  ____|__   __|
//     | |  __| |__     | |
//     | | |_ |  __|    | |
//     | |__| | |____   | |
//      \_____|______|  |_|
/**Tests different cases of using get on a state
 * Expects initial value to be number 1
 */
export async function test_state_get(
  state_maker: TestStateSync,
): Promise<void> {
  const made = state_maker();
  expect(made.state.get()).toEqual(ok(1));
  made.set(ok(55));
  expect(made.state.get()).toEqual(ok(55));
  if (!made.o) {
    made.set(err(err_gen()));
    expect(made.state.get()).toEqual(err(err_gen()));
  }
}

//       _____ ______ _______    ____  _  __
//      / ____|  ____|__   __|  / __ \| |/ /
//     | |  __| |__     | |    | |  | | ' /
//     | | |_ |  __|    | |    | |  | |  <
//     | |__| | |____   | |    | |__| | . \
//      \_____|______|  |_|     \____/|_|\_\
/**Tests different cases of using getOk on a state
 * Expects initial value to be number 1
 */
export async function test_state_get_ok(
  state_maker: TestStateOkSync,
): Promise<void> {
  const { state } = state_maker();
  expect(state.ok()).toEqual(1);
}

//     __          _______  _____ _______ ______
//     \ \        / /  __ \|_   _|__   __|  ____|
//      \ \  /\  / /| |__) | | |    | |  | |__
//       \ \/  \/ / |  _  /  | |    | |  |  __|
//        \  /\  /  | | \ \ _| |_   | |  | |____
//         \/  \/   |_|  \_\_____|  |_|  |______|
/**Tests different cases of using write on a state
 * Expects initial value to be number 1
 */
export async function test_state_write(
  state_maker: TestStateWrite,
  sync: boolean,
): Promise<void> {
  const { state } = state_maker();
  if (sync) state.write(15).then((e) => expect(e).toEqual(ok(undefined)));
  else expect(await state.write(15)).toEqual(ok(undefined));
  const awaited = await state;
  expect(awaited).toEqual(ok(15));
}
