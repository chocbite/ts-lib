import { sleep } from "#common";
import { err_nice, NiceError, ok } from "#result";
import { describe, expect, it } from "vitest";
import { state as st, type StateResult } from "..";
import { TEST_ERROR } from "./tests_shared";

/**The error of a result, failing the test when it is ok*/
const error_of = (result: StateResult<unknown>): NiceError => {
  if (result.ok) throw new Error("Expected an error result");
  return result.error;
};

describe("state.errors", () => {
  it("is frozen and its kinds have their nice texts as description", () => {
    expect(Object.isFrozen(st.errors)).toBe(true);
    expect(st.errors.NOT_WRITABLE.description).toBe("Not writable");
  });

  it("gives a remote read without value within its timeout as timed out", async () => {
    const state = st.r.rea.from<number>(
      () => {},
      () => {},
      () => {},
      { timeout: 30 },
    );

    const error = error_of(await state);

    expect(error.kind).toBe(st.errors.TIMED_OUT);
    expect(error.message).toBe("No response within 30ms");
    //Not supposed to happen, so a full Error
    expect(error.cause).toBeInstanceOf(Error);
  });

  it("gives a throwing remote write action as write failed, with what it threw as cause", async () => {
    const thrown = new Error("Connection lost");
    const state = st.r.reaw.from<number>(
      () => {},
      () => {},
      () => {},
      async () => {
        throw thrown;
      },
    );

    const error = error_of(await state.write(5));

    expect(error.kind).toBe(st.errors.WRITE_FAILED);
    expect(error.cause).toBe(thrown);
  });

  it("gives a throwing init function as init failed, with what it threw as cause", async () => {
    const thrown = new Error("Init failed");
    const state = st.rea<number>(async () => {
      throw thrown;
    });

    const read = await Promise.race([state.then((value) => value), sleep(100, "pending" as const)]);
    if (read === "pending") throw new Error("The read did not settle");

    expect(error_of(read).kind).toBe(st.errors.INIT_FAILED);
    expect(error_of(read).cause).toBe(thrown);
  });

  it("gives an enum value not in the list as not in list", async () => {
    const list = st.e.list<"a" | "b">({ a: { name: "A" }, b: { name: "B" } });
    const state = st.rosw(st.e.help(ok<"a" | "b">("a"), { list: st.ok(list) }), true);

    const error = error_of(await state.write("zzz" as "a"));

    expect(error.kind).toBe(st.errors.NOT_IN_LIST);
    expect(error.message).toBe("zzz is not in list");
  });

  it("gives the error of the list of an enum, so the reason the list is missing reaches the user", async () => {
    const list = st.res<ReturnType<typeof st.e.list<"a" | "b">>>(err_nice(TEST_ERROR, "no list"));
    const state = st.rosw(st.e.help(ok<"a" | "b">("a"), { list }), true);

    expect(error_of(await state.write("b"))).toEqual(new NiceError(TEST_ERROR, "no list"));
  });

  it("gives a write to a state without setter as not writable, with an Error whose stack shows the caller", async () => {
    //A read only state has no setter, untyped code can still call write on it
    const state = st.ros(ok(1)) as unknown as { write(value: number): PromiseLike<StateResult<void>> };

    const error = error_of(await state.write(2));

    expect(error.kind).toBe(st.errors.NOT_WRITABLE);
    expect(error.cause?.stack).toContain("errors.test");
  });

  it("gives a write on a closed write gate as write disabled, a normal case with only a message", async () => {
    const state = st.ok_w(1);
    state.set_write_enabled(st.ok(false));

    const error = error_of(await state.write(2));

    expect(error).toEqual(new NiceError(st.errors.WRITE_DISABLED, "writing is disabled"));
  });

  it("gives a collected state without states as no states", async () => {
    const state = st.c.res((values: StateResult<number>[]) => values[0]!);
    const results: StateResult<number>[] = [];

    state.sub((value) => results.push(value), true);

    expect(error_of(state.get()).kind).toBe(st.errors.NO_STATES);
  });
});
