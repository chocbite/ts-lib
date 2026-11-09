import { describe, expect, it } from "vitest";
import { number_step_start_decimal } from ".";

describe("number_step_start_decimal", function () {
  it("Snaps to the nearest step", function () {
    expect(number_step_start_decimal(11, 0.5)).toBe(11);
    expect(number_step_start_decimal(11.3, 0.5)).toBe(11.5);
  });
  it("Snaps to the nearest step from a start", function () {
    expect(number_step_start_decimal(11, 2, 1)).toBe(11);
    expect(number_step_start_decimal(10.2, 2, 1)).toBe(11);
  });
  it("Rounds to decimals after snapping", function () {
    expect(number_step_start_decimal(11, 0.13, 0, 1)).toBe(11.1);
  });
  it("Rounds to decimals when there is no step", function () {
    expect(number_step_start_decimal(5.126, undefined, undefined, 2)).toBe(5.13);
    expect(number_step_start_decimal(5.126, 0, 0, 0)).toBe(5);
  });
  it("Returns the value unchanged without step or decimals", function () {
    expect(number_step_start_decimal(5.126)).toBe(5.126);
  });
});
