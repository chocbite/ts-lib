import { err, ok, type OptionNone } from "#result";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  state as st,
  type StateOrVal,
  type StateOrValREA,
  type StateOrValRES,
  type StateOrValROA,
  type StateOrValROS,
  type StateOrValROSW,
  type StateREA,
  type StateRES,
  type StateROA,
  type StateROS,
  type StateROSW,
} from "..";

describe("as_state", () => {
  it("wraps a fixed value in a read only ok state", () => {
    const wrapped = st.as_state(5);
    expect(st.is.ros(wrapped)).toBe(true);
    expect(wrapped.writable).toBe(false);
    expect(wrapped.ok()).toBe(5);
  });

  it("returns a state unchanged", () => {
    const source = st.ok_w(5);
    expect(st.as_state(source)).toBe(source);
    const errored = st.err<number>("gone");
    expect(st.as_state(errored)).toBe(errored);
  });

  it("wraps falsy values", () => {
    expect(st.as_state(0).ok()).toBe(0);
    expect(st.as_state("").ok()).toBe("");
    expect(st.as_state(undefined).ok()).toBe(undefined);
    expect(st.as_state(null).ok()).toBe(null);
  });

  it("wraps a value that is not a state but looks like an object", () => {
    const value = { a: 1 };
    expect(st.as_state(value).ok()).toBe(value);
  });

  it("follows the given state", async () => {
    const source = st.from_w<number>(5);
    const result = st.as_state(source as StateOrValRES<number>);
    source.set_err("gone");
    expect(result.get()).toEqual(err("gone"));
    source.set_ok(6);
    expect(await result).toEqual(ok(6));
  });

  it("returns the read only type of the input", () => {
    expectTypeOf(st.as_state(5)).toEqualTypeOf<StateROS<number>>();
    expectTypeOf(
      st.as_state({} as StateOrValROS<number>),
    ).toEqualTypeOf<StateROS<number>>();
    expectTypeOf(
      st.as_state({} as StateOrValROSW<number>),
    ).toEqualTypeOf<StateROS<number>>();
    expectTypeOf(
      st.as_state({} as StateOrValRES<number>),
    ).toEqualTypeOf<StateRES<number>>();
    expectTypeOf(
      st.as_state({} as StateOrValROA<number>),
    ).toEqualTypeOf<StateROA<number>>();
    expectTypeOf(
      st.as_state({} as StateOrValREA<number>),
    ).toEqualTypeOf<StateREA<number>>();
    expectTypeOf(
      st.as_state({} as StateOrVal<number>),
    ).toEqualTypeOf<StateREA<number>>();
    //Keeps the related type of the state, a local state without helper has none
    expectTypeOf(st.as_state(st.err<number>("e"))).toEqualTypeOf<
      StateRES<number, OptionNone>
    >();
  });
});

describe("is.state_of", () => {
  it("tells states from fixed values", () => {
    expect(st.is.state_of(st.ok(1))).toBe(true);
    expect(st.is.state_of(1)).toBe(false);
    expect(st.is.state_of(0)).toBe(false);
    expect(st.is.state_of(undefined)).toBe(false);
    expect(st.is.state_of({ a: 1 })).toBe(false);
  });

  it("narrows to the exact state type and the fixed value", () => {
    const narrow = (sov: StateOrValROSW<number>) => {
      if (st.is.state_of(sov)) {
        expectTypeOf(sov).toEqualTypeOf<StateROSW<number>>();
        return sov.write(1);
      }
      expectTypeOf(sov).toEqualTypeOf<number>();
      return sov;
    };
    narrow(1);
    narrow(st.ok_w(1));
  });

  it("narrows inside generic code", () => {
    const narrow = <T>(sov: StateOrValRES<T>): T | undefined => {
      if (st.is.state_of(sov)) {
        expectTypeOf(sov).toEqualTypeOf<StateRES<T>>();
        const result = sov.get();
        return result.ok ? result.value : undefined;
      }
      //expectTypeOf can not compare a generic type, an assignment checks it instead
      const value: T = sov;
      return value;
    };
    expect(narrow(st.from(2))).toBe(2);
    expect(narrow(3)).toBe(3);
  });
});
