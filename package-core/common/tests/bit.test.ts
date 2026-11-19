import { describe, expect, it } from "vitest";
import { get_bit, get_bits, set_bit, set_bits, toggle_bit } from "./bit";

describe("get_bit", () => {
  it("returns true for a set bit", () => {
    expect(get_bit(0b1010, 1)).toBe(true);
    expect(get_bit(0b1010, 3)).toBe(true);
  });
  it("returns false for an unset bit", () => {
    expect(get_bit(0b1010, 0)).toBe(false);
    expect(get_bit(0b1010, 2)).toBe(false);
  });
});

describe("set_bit", () => {
  it("sets a bit when passed true", () => {
    expect(set_bit(0b1010, 0, true)).toBe(0b1011);
  });
  it("clears a bit when passed false", () => {
    expect(set_bit(0b1010, 1, false)).toBe(0b1000);
  });
  it("toggles when state is omitted", () => {
    expect(set_bit(0b1010, 0)).toBe(0b1011);
    expect(set_bit(0b1010, 1)).toBe(0b1000);
  });
});

describe("toggle_bit", () => {
  it("sets an unset bit", () => {
    expect(toggle_bit(0b1010, 0)).toBe(0b1011);
  });
  it("clears a set bit", () => {
    expect(toggle_bit(0b1010, 1)).toBe(0b1000);
  });
});

describe("get_bits", () => {
  it("reads a multi-bit field", () => {
    // bits 3-5 of 0b1_110_101 (117) = 0b110
    expect(get_bits(0b1110101, 3, 3)).toBe(0b110);
  });
  it("reads from offset 0", () => {
    expect(get_bits(0b1011, 0, 2)).toBe(0b11);
  });
});

describe("set_bits", () => {
  it("writes a multi-bit field", () => {
    // write 0b110 into bits 3-5 of 0b1_000_101 -> 0b1_110_101
    expect(set_bits(0b1000101, 3, 3, 0b110)).toBe(0b1110101);
  });
  it("does not affect bits outside the field", () => {
    // clear bits 2-4 of 0b11111111 -> 0b11100011
    expect(set_bits(0b11111111, 2, 3, 0b000)).toBe(0b11100011);
  });
});
