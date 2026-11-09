import { describe, expect, it } from "vitest";
import { any_equals_deep, object_equals_deep } from "./equals";

describe("Any Equals", async () => {
  it("Object Equals Deep", async () => {
    const test1 = {
      a: 1,
      b: 2,
      c: 3,
    };
    const test2 = {
      a: 1,
      b: 2,
      e: 4,
    };
    const test3 = {
      a: 1,
      b: 2,
      c: 3,
    };
    const test4 = {
      a: 2,
      b: 3,
      c: 4,
    };
    const test5 = {
      a: "2",
      b: "3",
      c: "4",
    };
    expect(object_equals_deep(test1, test2)).toEqual(false);
    expect(object_equals_deep(test1, test3)).toEqual(true);
    expect(object_equals_deep(test1, test4)).toEqual(false);
    expect(object_equals_deep(test1, test5)).toEqual(false);
  });

  it("compares null object properties", async () => {
    expect(
      object_equals_deep(
        { value: null, nested: { value: null } },
        { value: null, nested: { value: null } }
      )
    ).toEqual(true);
    expect(
      object_equals_deep(
        { value: null },
        { value: { nested: true } }
      )
    ).toEqual(false);
  });

  it("ignores key order", async () => {
    expect(object_equals_deep({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual(true);
  });

  it("compares dates by time", async () => {
    expect(any_equals_deep(new Date(1), new Date(2))).toEqual(false);
    expect(any_equals_deep(new Date(1), new Date(1))).toEqual(true);
    expect(any_equals_deep({ d: new Date(1) }, { d: new Date(2) })).toEqual(
      false
    );
  });

  it("does not treat an array and an object as equal", async () => {
    expect(any_equals_deep([1], { 0: 1 })).toEqual(false);
    expect(any_equals_deep({ 0: 1 }, [1])).toEqual(false);
  });

  it("compares maps and sets by content", async () => {
    expect(any_equals_deep(new Map([["a", 1]]), new Map([["a", 2]]))).toEqual(
      false
    );
    expect(any_equals_deep(new Map([["a", 1]]), new Map([["a", 1]]))).toEqual(
      true
    );
    expect(any_equals_deep(new Set([1]), new Set([2]))).toEqual(false);
    expect(any_equals_deep(new Set([1]), new Set([1]))).toEqual(true);
  });
});
