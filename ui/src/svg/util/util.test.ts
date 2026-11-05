import { describe, it, expect } from "vitest";
import { SVGAnchorPoint } from "./anchorPoint";
import { angle_to_anchor_point } from "./angleToAnchorPoint";

describe("SVGAnchorPoint", () => {
  it("has all expected anchor point values", () => {
    expect(SVGAnchorPoint.bottomLeft).toBe(0);
    expect(SVGAnchorPoint.middleLeft).toBe(1);
    expect(SVGAnchorPoint.topLeft).toBe(2);
    expect(SVGAnchorPoint.topCenter).toBe(3);
    expect(SVGAnchorPoint.topRight).toBe(4);
    expect(SVGAnchorPoint.middleRight).toBe(5);
    expect(SVGAnchorPoint.bottomRight).toBe(6);
    expect(SVGAnchorPoint.bottomCenter).toBe(7);
    expect(SVGAnchorPoint.middleCenter).toBe(8);
  });
});

describe("angle_to_anchor_point", () => {
  it("returns middleRight for angle 0", () => {
    expect(angle_to_anchor_point(0)).toBe(SVGAnchorPoint.middleRight);
  });

  it("returns bottomRight for small positive angle", () => {
    expect(angle_to_anchor_point(0.5)).toBe(SVGAnchorPoint.bottomRight);
  });

  it("returns bottomCenter for angle near PI/2", () => {
    expect(angle_to_anchor_point(1.4)).toBe(SVGAnchorPoint.bottomCenter);
  });

  it("returns bottomLeft for angle near PI", () => {
    expect(angle_to_anchor_point(2.0)).toBe(SVGAnchorPoint.bottomLeft);
  });

  it("returns middleLeft for angle near PI", () => {
    expect(angle_to_anchor_point(3.0)).toBe(SVGAnchorPoint.middleLeft);
  });

  it("returns topLeft for angle near 3PI/2", () => {
    expect(angle_to_anchor_point(4.0)).toBe(SVGAnchorPoint.topLeft);
  });

  it("returns topCenter for angle near 3PI/2", () => {
    expect(angle_to_anchor_point(4.7)).toBe(SVGAnchorPoint.topCenter);
  });

  it("returns topRight for angle near 2PI", () => {
    expect(angle_to_anchor_point(5.5)).toBe(SVGAnchorPoint.topRight);
  });

  it("returns middleRight for angle near 2PI", () => {
    expect(angle_to_anchor_point(6.0)).toBe(SVGAnchorPoint.middleRight);
  });

  it("handles negative angles", () => {
    const result = angle_to_anchor_point(-0.5);
    expect(Object.values(SVGAnchorPoint)).toContain(result);
  });
});
