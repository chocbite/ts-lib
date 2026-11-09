import { describe, expect, it } from "vitest";
import { degrees_to_radians, radians_to_degrees } from "./angle";

describe("Degrees To Radians", function () {
  it("0 Degree", function () {
    expect(degrees_to_radians(0)).toStrictEqual(0);
  });
  it("66 Degree", function () {
    expect(degrees_to_radians(66)).toStrictEqual(1.1519173063162575);
  });
  it("666 Degree", function () {
    expect(degrees_to_radians(666)).toStrictEqual(11.623892818282235);
  });
  it("6666 Degree", function () {
    expect(degrees_to_radians(6666)).toStrictEqual(116.34364793794201);
  });
  it("-66 Degree", function () {
    expect(degrees_to_radians(-66)).toStrictEqual(-1.1519173063162575);
  });
});

describe("Radians To Degrees", function () {
  it("0 Radians", function () {
    expect(radians_to_degrees(0)).toStrictEqual(0);
  });
  it("66 Radians", function () {
    expect(radians_to_degrees(66)).toStrictEqual(3781.5214478634334);
  });
  it("666 Radians", function () {
    expect(radians_to_degrees(666)).toStrictEqual(38158.98915571283);
  });
  it("6666 Radians", function () {
    expect(radians_to_degrees(6666)).toStrictEqual(381933.66623420676);
  });
  it("-66 Radians", function () {
    expect(radians_to_degrees(-66)).toStrictEqual(-3781.5214478634334);
  });
});
