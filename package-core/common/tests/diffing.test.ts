import { describe, expect, it } from "vitest";
import { array_diff, array_diff_by, array_diff_deep, object_key_diff } from "..";

describe("Diffing", async () => {
  it("Array Diff", async () => {
    const diff = array_diff([1, 2, 3, 4], [3, 4, 5, 6]);
    expect(diff).toEqual({ added: [5, 6], removed: [1, 2] });
  });
  it("Object Key Diff", async () => {
    const diff = object_key_diff({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, e: 4 });
    expect(diff).toEqual({ added: ["e"], removed: ["c"] });
  });
  it("Array Diff on large arrays matches the small array result", async () => {
    const main = Array.from({ length: 1000 }, (_, i) => i);
    const second = Array.from({ length: 1000 }, (_, i) => i + 500);
    const diff = array_diff(main, second);
    expect(diff.added).toEqual(second.slice(500));
    expect(diff.removed).toEqual(main.slice(0, 500));
  });
  it("Array Diff matches NaN and objects by identity on both paths", async () => {
    const a = { id: 1 };
    for (const pad of [0, 50]) {
      const filler = Array.from({ length: pad }, (_, i) => -1 - i);
      const diff = array_diff([...filler, NaN, a], [...filler, NaN, { id: 1 }]);
      expect(diff.added).toEqual([{ id: 1 }]);
      expect(diff.removed).toEqual([a]);
    }
  });
  it("Array Diff By matches items by key", async () => {
    const main = [{ id: 1, v: "a" }, { id: 2, v: "b" }];
    const second = [{ id: 2, v: "changed" }, { id: 3, v: "c" }];
    const diff = array_diff_by(main, second, (x) => x.id);
    expect(diff.added).toEqual([{ id: 3, v: "c" }]);
    expect(diff.removed).toEqual([{ id: 1, v: "a" }]);
    expect(diff.added[0]).toBe(second[1]); // the original items are returned
  });
  it("Array Diff By on large arrays", async () => {
    const main = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const second = Array.from({ length: 1000 }, (_, i) => ({ id: i + 500 }));
    const diff = array_diff_by(main, second, (x) => x.id);
    expect(diff.added).toEqual(second.slice(500));
    expect(diff.removed).toEqual(main.slice(0, 500));
  });
  it("Array Diff By calls the key function once per item", async () => {
    let calls = 0;
    array_diff_by([1, 2, 3], [2, 3, 4, 5], (x) => (calls++, x));
    expect(calls).toBe(7);
  });
  it("Array Diff Deep matches objects by content", async () => {
    const diff = array_diff_deep(
      [{ id: 1, tags: ["a"] }, { id: 2, tags: ["b"] }, NaN],
      [{ id: 2, tags: ["b"] }, { id: 1, tags: ["a", "x"] }, NaN],
    );
    expect(diff.added).toEqual([{ id: 1, tags: ["a", "x"] }]);
    expect(diff.removed).toEqual([{ id: 1, tags: ["a"] }]);
  });
});
