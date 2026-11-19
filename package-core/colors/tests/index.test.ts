import { describe, expect, expectTypeOf, it } from "vitest";
import { BLUE, GREY, type ColorStruct } from ".";

describe("colors", () => {
  it("exports the type of a palette, so apps can take one as a parameter", () => {
    const shade = (palette: ColorStruct) => palette["500"];

    expect(shade(BLUE)).toBe("#2196F3");
    expectTypeOf(GREY).toEqualTypeOf<ColorStruct>();
  });

  it("freezes the palettes, so they can not be changed by accident", () => {
    expect(Object.isFrozen(BLUE)).toBe(true);
  });
});
