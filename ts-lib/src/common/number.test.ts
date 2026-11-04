import { describe, expect, it } from "vitest";
import { number_limit_decimals } from "./number";

describe("number_limit_decimals", () => {
  it("rounds to the requested number of decimal places", () => {
    expect(number_limit_decimals(1.4687, 3)).toBe("1.469");
  });

  it("does not pad trailing decimal zeroes", () => {
    expect(number_limit_decimals(1.2, 3)).toBe("1.2");
  });

  it("rounds negative values", () => {
    expect(number_limit_decimals(-1.4687, 3)).toBe("-1.469");
  });

  it("rounds to a whole number when decimal count is zero", () => {
    expect(number_limit_decimals(1.5, 0)).toBe("2");
  });
});
