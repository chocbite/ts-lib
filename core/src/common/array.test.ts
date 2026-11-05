import { describe, expect, it, vi } from "vitest";
import {
  array_from_length,
  array_from_range,
  array_from_range_inclusive,
} from "./array";

describe("array_from_range", () => {
  it("should create an array of a specific length with the correct values", () => {
    const result = array_from_range(0, 5, (i) => i * 2);

    expect(result).toHaveLength(5);
    expect(result).toEqual([0, 2, 4, 6, 8]);
  });

  it("should handle ranges that do not start at zero", () => {
    const result = array_from_range(5, 8, (i) => `item-${i}`);

    expect(result).toHaveLength(3);
    expect(result).toEqual(["item-5", "item-6", "item-7"]);
  });

  it("should return an empty array if end is less than start", () => {
    const result = array_from_range(10, 5, (i) => i);

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it("should return an empty array if start and end are equal", () => {
    const result = array_from_range(5, 5, (i) => i);

    expect(result).toEqual([]);
  });

  it("should correctly pass the index to the init function", () => {
    const init_spy = vi.fn(<T>(i: T) => {
      return i;
    });

    array_from_range(10, 13, init_spy);

    expect(init_spy).toHaveBeenCalledTimes(3);
    expect(init_spy).toHaveBeenNthCalledWith(1, 10);
    expect(init_spy).toHaveBeenNthCalledWith(2, 11);
    expect(init_spy).toHaveBeenNthCalledWith(3, 12);
  });

  it("should work with negative ranges", () => {
    const result = array_from_range(-3, 0, (i) => i);

    expect(result).toEqual([-3, -2, -1]);
    expect(result).toHaveLength(3);
  });

  it("should handle a range that crosses zero", () => {
    // Range from -2 to 2 (exclusive of end), so: -2, -1, 0, 1
    const result = array_from_range(-2, 2, (i) => i);

    expect(result).toHaveLength(4);
    expect(result).toEqual([-2, -1, 0, 1]);
    expect(result[2]).toBe(0); // Explicitly check that 0 is included correctly
  });
});

describe("array_from_range_inclusive", () => {
  it("should include both start and end values", () => {
    const result = array_from_range_inclusive(1, 3, (i) => i);
    // Length is (3 - 1) + 1 = 3
    expect(result).toEqual([1, 2, 3]);
    expect(result).toHaveLength(3);
  });

  it("should return a single-item array when start and end are equal", () => {
    const result = array_from_range_inclusive(5, 5, (i) => i);
    expect(result).toEqual([5]);
  });

  it("should correctly pass the index to the init function", () => {
    const init_spy = vi.fn(<T>(i: T) => {
      return i;
    });

    array_from_range_inclusive(10, 13, init_spy);

    expect(init_spy).toHaveBeenCalledTimes(4);
    expect(init_spy).toHaveBeenNthCalledWith(1, 10);
    expect(init_spy).toHaveBeenNthCalledWith(2, 11);
    expect(init_spy).toHaveBeenNthCalledWith(3, 12);
    expect(init_spy).toHaveBeenNthCalledWith(4, 13);
  });

  it("should handle crossing zero", () => {
    const result = array_from_range_inclusive(-1, 1, (i) => i);
    // -1, 0, 1
    expect(result).toEqual([-1, 0, 1]);
    expect(result).toHaveLength(3);
  });

  it("should return empty array if end is less than start", () => {
    const result = array_from_range_inclusive(5, 4, (i) => i);
    expect(result).toEqual([]);
  });
});

describe("array_from_length", () => {
  it("should create an array of the specified length", () => {
    const result = array_from_length(4, (i) => i * 10);
    expect(result).toEqual([0, 10, 20, 30]);
    expect(result).toHaveLength(4);
  });

  it("should return an empty array if length is 0", () => {
    const result = array_from_length(0, (i) => i);
    expect(result).toEqual([]);
  });

  it("should return an empty array if length is negative", () => {
    const result = array_from_length(-5, (i) => i);
    expect(result).toEqual([]);
  });

  it("should correctly pass the index to the init function", () => {
    const init_spy = vi.fn(<T>(i: T) => {
      return i;
    });

    array_from_length(4, init_spy);

    expect(init_spy).toHaveBeenCalledTimes(4);
    expect(init_spy).toHaveBeenNthCalledWith(1, 0);
    expect(init_spy).toHaveBeenNthCalledWith(2, 1);
    expect(init_spy).toHaveBeenNthCalledWith(3, 2);
    expect(init_spy).toHaveBeenNthCalledWith(4, 3);
  });

  it("should work with different types (Generics)", () => {
    const result = array_from_length(2, (i) => ({ id: i }));
    expect(result).toEqual([{ id: 0 }, { id: 1 }]);
  });
});
