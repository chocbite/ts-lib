import { describe, expect, it } from "vitest";
import { linearise } from "./linearization";

describe("Linearisation", function () {
  it("Less than four values produce NaN", function () {
    expect(linearise(10, false)).toBeNaN();
    expect(linearise(10, false, 0)).toBeNaN();
    expect(linearise(10, false, 0, 100)).toBeNaN();
    expect(linearise(10, false, 0, 100, 0)).toBeNaN();
  });
  it("Simple two point linearisation", function () {
    expect(linearise(10, false, 0, 100, 0, 1000)).toStrictEqual(100);
  });
  it("Simple two point linearisation with ends off and x outside range", function () {
    expect(linearise(200, false, 0, 100, 0, 1000)).toStrictEqual(2000);
  });
  it("Simple two point linearisation with ends on and x outside range", function () {
    expect(linearise(200, true, 0, 100, 0, 1000)).toStrictEqual(1000);
  });
  it("Simple three point linearisation", function () {
    expect(linearise(125, true, 0, 100, 150, 0, 1000, 4000)).toStrictEqual(
      2500
    );
  });
  it("Simple four point linearisation", function () {
    expect(
      linearise(155, true, 0, 100, 150, 160, 0, 1000, 4000, 8000)
    ).toStrictEqual(6000);
  });
});
