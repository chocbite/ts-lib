import { ok, err_nice, NiceError } from "#result";
import { describe, expect, expectTypeOf, it } from "vitest";
import { state as st, type State, type StateResult } from "..";
import { TEST_ERROR } from "./tests_shared";

/**A write on a state that can not be written is a bug, its error has an Error whose stack shows the caller, this test file*/
const expect_not_writable = (result: StateResult<unknown>) => {
  expect(!result.ok && result.error.kind).toBe(st.errors.NOT_WRITABLE);
  const cause = !result.ok ? result.error.cause : undefined;
  expect(cause).toBeInstanceOf(Error);
  expect(cause?.stack).toContain("write_enabled.test");
};

describe("Write gate", function () {
  it("Local write and check fail while the gate is false", async function () {
    const gate = st.ok_w(false);
    const state = st.ok_w(1);
    state.set_write_enabled(gate);
    expect(state.write_enabled).toBe(gate);
    expect(await state.check(2)).toEqual(err_nice(st.errors.WRITE_DISABLED, "writing is disabled"));
    expect(await state.write(2)).toEqual(err_nice(st.errors.WRITE_DISABLED, "writing is disabled"));
    expect(state.ok()).toBe(1);
    gate.set_ok(true);
    expect(await state.check(2)).toEqual(ok(2));
    expect(await state.write(2)).toEqual(ok(undefined));
    expect(state.ok()).toBe(2);
  });
  it("Local gate applies to custom setters and helpers", async function () {
    let called = false;
    const state = st.rosw(st.n.help(ok(5), { min: st.ok(0) }), () => {
      called = true;
      return Promise.resolve(ok(undefined));
    });
    state.set_write_enabled(st.ok(false));
    expect(await state.check(6)).toEqual(err_nice(st.errors.WRITE_DISABLED, "writing is disabled"));
    expect(await state.write(6)).toEqual(err_nice(st.errors.WRITE_DISABLED, "writing is disabled"));
    expect(called).toBe(false);
  });
  it("Gate in error blocks writing", async function () {
    const state = st.ok_w(1);
    state.set_write_enabled(st.err<boolean>(new NiceError(TEST_ERROR, "offline")));
    expect(await state.write(2)).toEqual(err_nice(st.errors.WRITE_DISABLED, "writing is disabled"));
  });
  it("Removing the gate allows writing again", async function () {
    const state = st.ok_w(1);
    state.set_write_enabled(st.ok(false));
    state.set_write_enabled(undefined);
    expect(state.write_enabled).toBeUndefined();
    expect(await state.write(2)).toEqual(ok(undefined));
  });
  it("Async gate is awaited", async function () {
    const state = st.ok_w(1);
    state.set_write_enabled(st.roa(async () => ok(false)));
    expect(await state.write(2)).toEqual(err_nice(st.errors.WRITE_DISABLED, "writing is disabled"));
  });
  it("Remote write and check fail while the gate is false", async function () {
    let written: number | undefined;
    const state = st.r.roaw.from<number>(
      () => {},
      () => {},
      () => {},
      async (value) => {
        written = value;
        return ok(undefined);
      },
    );
    state.set_write_enabled(st.ok(false));
    expect(await state.check(2)).toEqual(err_nice(st.errors.WRITE_DISABLED, "writing is disabled"));
    expect(await state.write(2)).toEqual(err_nice(st.errors.WRITE_DISABLED, "writing is disabled"));
    expect(written).toBeUndefined();
  });
  it("Writable proxy uses the gate of its source", async function () {
    const gate = st.ok(false);
    const source = st.ok_w(1);
    source.set_write_enabled(gate);
    const proxy = st.p.rosw(source);
    expect(proxy.write_enabled).toBe(gate);
    expect(await proxy.write(2)).toEqual(err_nice(st.errors.WRITE_DISABLED, "writing is disabled"));
    expect(source.ok()).toBe(1);
  });
  it("Read only proxy has a gate that is always false", async function () {
    const proxy = st.p.ros(st.ok_w(1));
    expect(await proxy.write_enabled).toEqual(ok(false));
  });
});

describe("Read only view", function () {
  it("Has nothing to write with", async function () {
    const state = st.ok_w(1);
    const view = state.read_only;
    expect(view).not.toBe(state);
    expect(view.writable).toBe(false);
    expect("write" in view).toBe(false);
    expect("set" in view).toBe(false);
    expect("setter" in view).toBe(false);
    expect_not_writable(await view.check!(2));
    expect_not_writable(await view.limit!(2));
    expect(await view.write_enabled).toEqual(ok(false));
    expect(st.is.reaw(view)).toBe(false);
  });
  it("Narrowing on writable does not give write access", function () {
    const view: State<number> = st.ok_w(1).read_only;
    if (view.writable) expect.unreachable();
  });
  it("Is the same view every time", function () {
    const state = st.ok_w(1);
    expect(state.read_only).toBe(state.read_only);
  });
  it("Reads the value of the state", async function () {
    const state = st.ok_w(1);
    const view = state.read_only;
    expect(st.is.state(view)).toBe(true);
    expect(st.is.ros(view)).toBe(true);
    expect(view.get()).toEqual(ok(1));
    expect(view.ok()).toBe(1);
    expect(await view).toEqual(ok(1));
    expect(await view.to_json()).toBe("1");
    state.set_ok(2);
    expect(view.ok()).toBe(2);
  });
  it("Subscribes on the state", function () {
    const state = st.ok_w(1);
    const view = state.read_only;
    const values: number[] = [];
    const sub = view.sub((value) => values.push(value.value));
    expect(state.amount()).toBe(1);
    expect(view.in_use()).toBe(view);
    expect(view.has(sub)).toBe(view);
    state.set_ok(2);
    view.unsub(sub);
    expect(state.in_use()).toBeUndefined();
    expect(view.in_use()).toBeUndefined();
    expect(values).toEqual([2]);
  });
  it("Passes related through", function () {
    const state = st.rosw(st.n.help(ok(5), { min: st.ok(0) }), true);
    expect(state.read_only.related().unwrap()).toBe(state.related().unwrap());
  });
  it("Async state view stays async", async function () {
    const state = st.reaw<number>(async () => ok(3), true);
    const view = state.read_only;
    expect(view.rsync).toBe(false);
    expect(await view).toEqual(ok(3));
  });
  it("Remote, proxy and collected states give a view", function () {
    const remote = st.r.roaw.from<number>(
      () => {},
      () => {},
      () => {},
      async () => ok(undefined),
    );
    const proxy = st.p.rosw(st.ok_w(1));
    const collected = st.c.ros(false, st.ok(1));
    for (const s of [remote, proxy, collected]) {
      expect(s.read_only).not.toBe(s);
      expect(s.read_only.writable).toBe(false);
      expect("write" in s.read_only).toBe(false);
    }
  });
  it("Types have no owner methods", function () {
    expectTypeOf(st.ok_w(1).read_only).not.toHaveProperty("set");
  });
});
