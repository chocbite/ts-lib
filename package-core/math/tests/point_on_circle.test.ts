import { describe, expect, it } from "vitest";
import { degrees_to_radians } from "../angle";
import { point_on_circle } from "./point_on_circle";

describe("Point on circle", function () {
  it("x5 y5 radius 3 angle 0", function () {
    expect(point_on_circle(5, 5, 3, degrees_to_radians(0))).toEqual({
      x: 8,
      y: 5,
    });
  });
  it("x5 y5 radius 3 angle 45", function () {
    expect(point_on_circle(5, 5, 3, degrees_to_radians(45))).toEqual({
      x: 7.121320343559643,
      y: 7.121320343559642,
    });
  });
  it("x5 y5 radius 3 angle 90", function () {
    expect(point_on_circle(5, 5, 3, degrees_to_radians(90))).toEqual({
      x: 5,
      y: 8,
    });
  });
  it("x5 y5 radius 3 angle 77", function () {
    expect(point_on_circle(5, 5, 3, degrees_to_radians(77))).toEqual({
      x: 5.674853163031595,
      y: 7.923110194355706,
    });
  });
  it("x5 y5 radius 3 angle 230", function () {
    expect(point_on_circle(5, 5, 3, degrees_to_radians(230))).toEqual({
      x: 3.071637170940382,
      y: 2.7018666706430663,
    });
  });
});
