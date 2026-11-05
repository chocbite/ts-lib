import { describe, it, expect } from "vitest";
import { circle, circle_arc } from "./circle";
import { ellipse, ellipse_arc } from "./ellipse";
import { group } from "./group";
import { line } from "./line";
import { path } from "./path";
import {
  rectangle_from_center,
  rectangle_from_corner,
} from "./rectangle";
import { svg } from "./svg";
import { text, multi_line_text } from "./text";
import { isosceles_triangle } from "./triangle";
import { SVGAnchorPoint } from "../util/anchorPoint";

describe("circle", () => {
  it("creates a circle element with correct attributes", () => {
    const c = circle(10, 20, 5);
    const elem = c.elem;
    expect(elem.tagName).toBe("circle");
    expect(elem.getAttribute("cx")).toBe("10");
    expect(elem.getAttribute("cy")).toBe("20");
    expect(elem.getAttribute("r")).toBe("5");
  });
});

describe("circle_arc", () => {
  it("creates a path element for a circle arc", () => {
    const arc = circle_arc(50, 50, 30, 0, 90);
    const elem = arc.elem;
    expect(elem.tagName).toBe("path");
    expect(elem.getAttribute("d")).toBeTruthy();
  });
});

describe("ellipse", () => {
  it("creates an ellipse element with correct attributes", () => {
    const e = ellipse(10, 20, 30, 40);
    const elem = e.elem;
    expect(elem.tagName).toBe("ellipse");
    expect(elem.getAttribute("cx")).toBe("10");
    expect(elem.getAttribute("cy")).toBe("20");
    expect(elem.getAttribute("rx")).toBe("30");
    expect(elem.getAttribute("ry")).toBe("40");
  });
});

describe("ellipse_arc", () => {
  it("creates a path element for an ellipse arc", () => {
    const arc = ellipse_arc(50, 50, 30, 20, 0, 180);
    const elem = arc.elem;
    expect(elem.tagName).toBe("path");
    const d = elem.getAttribute("d")!;
    expect(d).toContain("M");
    expect(d).toContain("A");
  });
});

describe("group", () => {
  it("creates a g element", () => {
    const g = group();
    expect(g.elem.tagName).toBe("g");
  });
});

describe("line", () => {
  it("creates a line element with correct coordinates", () => {
    const l = line(0, 0, 100, 200);
    const elem = l.elem;
    expect(elem.tagName).toBe("line");
    expect(elem.getAttribute("x1")).toBe("0");
    expect(elem.getAttribute("y1")).toBe("0");
    expect(elem.getAttribute("x2")).toBe("100");
    expect(elem.getAttribute("y2")).toBe("200");
  });
});

describe("path", () => {
  it("creates a path element with the given d attribute", () => {
    const p = path("M 0 0 L 10 10");
    const elem = p.elem;
    expect(elem.tagName).toBe("path");
    expect(elem.getAttribute("d")).toBe("M 0 0 L 10 10");
  });
});

describe("rectangle_from_center", () => {
  it("creates a rect element centered at the given point", () => {
    const r = rectangle_from_center(50, 50, 20, 10, 3);
    const elem = r.elem;
    expect(elem.tagName).toBe("rect");
    expect(elem.getAttribute("x")).toBe("40");
    expect(elem.getAttribute("y")).toBe("45");
    expect(elem.getAttribute("width")).toBe("20");
    expect(elem.getAttribute("height")).toBe("10");
    expect(elem.getAttribute("rx")).toBe("3");
  });
});

describe("rectangle_from_corner", () => {
  it("creates a rect element from the given corner point", () => {
    const r = rectangle_from_corner(10, 20, 100, 50, 5);
    const elem = r.elem;
    expect(elem.tagName).toBe("rect");
    expect(elem.getAttribute("x")).toBe("10");
    expect(elem.getAttribute("y")).toBe("20");
    expect(elem.getAttribute("width")).toBe("100");
    expect(elem.getAttribute("height")).toBe("50");
    expect(elem.getAttribute("rx")).toBe("5");
  });
});

describe("svg", () => {
  it("creates an svg element with width, height, and default viewBox", () => {
    const s = svg(200, 100);
    const elem = s.elem;
    expect(elem.tagName).toBe("svg");
    expect(elem.getAttribute("width")).toBe("200");
    expect(elem.getAttribute("height")).toBe("100");
    expect(elem.getAttribute("viewBox")).toBe("0 0 200 100");
  });

  it("creates an svg element with a custom viewBox", () => {
    const s = svg(200, 100, "10 10 190 90");
    const elem = s.elem;
    expect(elem.getAttribute("viewBox")).toBe("10 10 190 90");
  });
});

describe("text", () => {
  it("creates a text element with correct attributes for topLeft anchor", () => {
    const t = text(10, 20, "Hello", 16, SVGAnchorPoint.topLeft);
    const elem = t.elem;
    expect(elem.tagName).toBe("text");
    expect(elem.getAttribute("x")).toBe("10");
    expect(elem.getAttribute("y")).toBe("20");
    expect(elem.getAttribute("font-size")).toBe("16");
    expect(elem.innerHTML).toBe("Hello");
    expect(elem.getAttribute("text-anchor")).toBe("start");
    expect(elem.getAttribute("dominant-baseline")).toBe("hanging");
  });

  it("sets middle anchor for middleCenter", () => {
    const t = text(0, 0, "Test", 12, SVGAnchorPoint.middleCenter);
    const elem = t.elem;
    expect(elem.getAttribute("text-anchor")).toBe("middle");
    expect(elem.getAttribute("dominant-baseline")).toBe("central");
  });

  it("sets end anchor for bottomRight", () => {
    const t = text(0, 0, "Test", 12, SVGAnchorPoint.bottomRight);
    const elem = t.elem;
    expect(elem.getAttribute("text-anchor")).toBe("end");
    expect(elem.getAttribute("dominant-baseline")).toBe("auto");
  });
});

describe("multi_line_text", () => {
  it("creates a foreignObject element with correct attributes", () => {
    const mt = multi_line_text(10, 20, 100, 50, "Hello World", 14, SVGAnchorPoint.topLeft);
    const elem = mt.elem;
    expect(elem.tagName).toBe("foreignObject");
    expect(elem.getAttribute("x")).toBe("10");
    expect(elem.getAttribute("y")).toBe("20");
    expect(elem.getAttribute("width")).toBe("100");
    expect(elem.getAttribute("height")).toBe("50");
  });
});

describe("isosceles_triangle", () => {
  it("creates a path element for a triangle", () => {
    const t = isosceles_triangle(50, 50, 20, 30);
    const elem = t.elem;
    expect(elem.tagName).toBe("path");
    const d = elem.getAttribute("d")!;
    expect(d).toContain("40,65");
    expect(d).toContain("60,65");
    expect(d).toContain("50,35");
    expect(d).toContain("Z");
  });
});
