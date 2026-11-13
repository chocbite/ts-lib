import { describe, expect, it } from "vitest";
import { bounding_width_and_height_of_rotated_rectangle } from "./boundingWidthAndHeightOfRotatedRectangle";

describe("Bounding Width And Hight Of Rotated Rectangle", function () {
  it("Width 100 Height 100 turned 45 Degree", function () {
    expect(
      bounding_width_and_height_of_rotated_rectangle(100, 100, 45)
    ).toEqual({
      width: 137.62255133518482,
      height: 137.62255133518482,
    });
  });
  it("Width 100 Height 200 turned 45 Degree", function () {
    expect(
      bounding_width_and_height_of_rotated_rectangle(100, 200, 45)
    ).toEqual({
      width: 222.71290378859663,
      height: 190.15475021695778,
    });
  });
  it("Width 200 Height 100 turned 45 Degree", function () {
    expect(
      bounding_width_and_height_of_rotated_rectangle(200, 100, 45)
    ).toEqual({
      width: 190.15475021695778,
      height: 222.71290378859663,
    });
  });
  it("Width 100 Height 100 turned 80 Degree", function () {
    expect(
      bounding_width_and_height_of_rotated_rectangle(100, 100, 80)
    ).toEqual({
      width: 110.42758977624229,
      height: 110.42758977624229,
    });
  });
  it("Width 100 Height 200 turned 80 Degree", function () {
    expect(
      bounding_width_and_height_of_rotated_rectangle(100, 200, 80)
    ).toEqual({
      width: 209.8164551685798,
      height: 121.46631416014704,
    });
  });
  it("Width 200 Height 100 turned 80 Degree", function () {
    expect(
      bounding_width_and_height_of_rotated_rectangle(200, 100, 80)
    ).toEqual({
      width: 121.46631416014704,
      height: 209.8164551685798,
    });
  });
});
