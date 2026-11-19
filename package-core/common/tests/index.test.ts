import { describe, expect, it } from "vitest";
import { array_diff, object_empty, object_key_diff } from ".";

describe("Diffing", async () => {
  it("Array Diff", async () => {
    const diff = array_diff([1, 2, 3, 4], [3, 4, 5, 6]);
    expect(diff).toEqual({ added: [5, 6], removed: [1, 2] });
  });
  it("Object Key Diff", async () => {
    const diff = object_key_diff({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, e: 4 });
    expect(diff).toEqual({ added: ["e"], removed: ["c"] });
  });
});

describe("object_empty", () => {
  it("returns true when an object has no own properties", () => {
    const object = {};
    Object.setPrototypeOf(object, { inherited: true });

    expect(object_empty({})).toBe(true);
    expect(object_empty(object)).toBe(true);
  });

  it("returns false when an object has own enumerable properties", () => {
    expect(object_empty({ name: "value" })).toBe(false);
  });
});
