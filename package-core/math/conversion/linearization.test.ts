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
  it("x above the last point when the first y is bigger than x", function () {
    expect(linearise(50, false, 0, 10, 100, 200)).toStrictEqual(600);
    expect(linearise(50, true, 0, 10, 100, 200)).toStrictEqual(200);
    expect(linearise(25, false, 0, 10, 20, 1000, 1100, 1150)).toStrictEqual(
      1175
    );
    expect(linearise(25, true, 0, 10, 20, 1000, 1100, 1150)).toStrictEqual(
      1150
    );
  });
  it("x below the first point", function () {
    expect(linearise(-5, false, 0, 10, 20, 0, 100, 150)).toStrictEqual(-50);
    expect(linearise(-5, true, 0, 10, 20, 0, 100, 150)).toStrictEqual(0);
  });
  it("x on every point and between every pair of points", function () {
    const xy = [0, 10, 20, 30, 5, 25, 15, 45];
    expect([0, 10, 20, 30].map((x) => linearise(x, true, ...xy))).toEqual([
      5, 25, 15, 45,
    ]);
    expect([5, 15, 25].map((x) => linearise(x, true, ...xy))).toEqual([
      15, 20, 30,
    ]);
  });
});
