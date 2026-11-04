import { describe, expect, it } from "vitest";
import { array_diff, object_key_diff } from ".";

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
