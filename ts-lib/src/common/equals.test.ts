import { describe, expect, it } from "vitest";
import { object_equals_deep } from "./equals";

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
});
