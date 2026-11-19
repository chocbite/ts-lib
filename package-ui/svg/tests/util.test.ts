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

  it("wraps negative angles around a full circle", () => {
    expect(angle_to_anchor_point(-0.5)).toBe(SVGAnchorPoint.topRight);
    expect(angle_to_anchor_point(-Math.PI / 2)).toBe(SVGAnchorPoint.topCenter);
    for (const angle of [0.5, 1.4, 2.0, 3.0, 4.0, 4.7, 5.5])
      expect(angle_to_anchor_point(angle - 2 * Math.PI)).toBe(
        angle_to_anchor_point(angle),
      );
  });

  it("wraps angles of several turns", () => {
    for (const angle of [0.5, 1.4, 2.0, 3.0, 4.0, 4.7, 5.5]) {
      expect(angle_to_anchor_point(angle + 6 * Math.PI)).toBe(
        angle_to_anchor_point(angle),
      );
      expect(angle_to_anchor_point(angle - 6 * Math.PI)).toBe(
        angle_to_anchor_point(angle),
      );
    }
  });

  it("returns the expected anchor at the compass points", () => {
    expect(angle_to_anchor_point(Math.PI / 2)).toBe(SVGAnchorPoint.bottomCenter);
    expect(angle_to_anchor_point(Math.PI)).toBe(SVGAnchorPoint.middleLeft);
    expect(angle_to_anchor_point((3 * Math.PI) / 2)).toBe(
      SVGAnchorPoint.topCenter,
    );
    expect(angle_to_anchor_point(2 * Math.PI)).toBe(SVGAnchorPoint.middleRight);
    expect(angle_to_anchor_point(Math.PI / 4)).toBe(SVGAnchorPoint.bottomRight);
    expect(angle_to_anchor_point((3 * Math.PI) / 4)).toBe(
      SVGAnchorPoint.bottomLeft,
    );
    expect(angle_to_anchor_point((5 * Math.PI) / 4)).toBe(SVGAnchorPoint.topLeft);
    expect(angle_to_anchor_point((7 * Math.PI) / 4)).toBe(
      SVGAnchorPoint.topRight,
    );
  });

  it("is mirror symmetric around the horizontal axis", () => {
    const mirror = new Map<number, number>([
      [SVGAnchorPoint.middleRight, SVGAnchorPoint.middleRight],
      [SVGAnchorPoint.bottomRight, SVGAnchorPoint.topRight],
      [SVGAnchorPoint.bottomCenter, SVGAnchorPoint.topCenter],
      [SVGAnchorPoint.bottomLeft, SVGAnchorPoint.topLeft],
      [SVGAnchorPoint.middleLeft, SVGAnchorPoint.middleLeft],
    ]);
    for (let degrees = 1; degrees < 180; degrees += 2) {
      const angle = (degrees * Math.PI) / 180;
      expect(angle_to_anchor_point(-angle)).toBe(
        mirror.get(angle_to_anchor_point(angle)),
      );
    }
  });
});
