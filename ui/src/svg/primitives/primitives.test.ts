import { describe, it, expect } from "vitest";
import { circle, circle_arc } from "./circle";
import { ellipse, ellipse_arc } from "./ellipse";
import { group } from "./group";
import { line } from "./line";
import { path, path_line } from "./path";
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

/**Parses the path of an arc, M start_x start_y A radius_x radius_y rotation large_arc sweep end_x end_y*/
const parse_arc = (d: string) => {
  const parts = d.trim().split(/[\s,]+/);
  expect(parts[0]).toBe("M");
  expect(parts[3]).toBe("A");
  const n = parts.map(Number);
  return {
    start: [n[1], n[2]],
    radius: [n[4], n[5]],
    large_arc: n[7],
    sweep: n[8],
    end: [n[9], n[10]],
  };
};

/**Length of the rendered path, needs the path in a document*/
const rendered_length = (path: SVGPathElement) => {
  const canvas = document.body.appendChild(svg(100, 100).elem);
  canvas.appendChild(path);
  try {
    return path.getTotalLength();
  } finally {
    canvas.remove();
  }
};

describe("ellipse_arc details", () => {
  it("starts and ends at the given angles in degrees, y pointing down", () => {
    const arc = parse_arc(ellipse_arc(50, 50, 30, 20, 0, 90).elem.getAttribute("d")!);
    expect(arc.start[0]).toBeCloseTo(80);
    expect(arc.start[1]).toBeCloseTo(50);
    expect(arc.end[0]).toBeCloseTo(50);
    expect(arc.end[1]).toBeCloseTo(70);
    expect(arc.radius).toEqual([30, 20]);
    expect(arc.large_arc).toBe(0);
    expect(arc.sweep).toBe(1);
  });

  it("uses the large arc for sweeps over 180 degrees", () => {
    const arc = parse_arc(ellipse_arc(0, 0, 10, 10, 0, 270).elem.getAttribute("d")!);
    expect(arc.large_arc).toBe(1);
    expect(arc.sweep).toBe(1);
    expect(arc.end[0]).toBeCloseTo(0);
    expect(arc.end[1]).toBeCloseTo(-10);
  });

  it("does not depend on the start angle for the arc size", () => {
    const a = parse_arc(ellipse_arc(0, 0, 10, 10, 100, 190).elem.getAttribute("d")!);
    expect(a.large_arc).toBe(0);
    expect(a.sweep).toBe(1);
  });

  it("draws counter clockwise for a negative sweep", () => {
    const arc = parse_arc(ellipse_arc(0, 0, 10, 10, 0, -90).elem.getAttribute("d")!);
    expect(arc.sweep).toBe(0);
    expect(arc.large_arc).toBe(0);
    expect(arc.end[0]).toBeCloseTo(0);
    expect(arc.end[1]).toBeCloseTo(-10);
  });

  it("uses the large arc for negative sweeps over 180 degrees", () => {
    const arc = parse_arc(ellipse_arc(0, 0, 10, 10, 0, -270).elem.getAttribute("d")!);
    expect(arc.sweep).toBe(0);
    expect(arc.large_arc).toBe(1);
  });

  it("renders a negative 270 degree sweep as three quarters of the circle", () => {
    const length = rendered_length(ellipse_arc(50, 50, 10, 10, 0, -270).elem);
    expect(length).toBeCloseTo((2 * Math.PI * 10 * 3) / 4, 0);
  });

  it("renders a 360 degree arc as the full circle", () => {
    const length = rendered_length(circle_arc(50, 50, 10, 0, 360).elem);
    expect(length).toBeCloseTo(2 * Math.PI * 10, 0);
  });

  it("circle_arc is an ellipse arc with equal radii", () => {
    expect(circle_arc(5, 6, 7, 10, 200).elem.getAttribute("d")).toBe(
      ellipse_arc(5, 6, 7, 7, 10, 200).elem.getAttribute("d"),
    );
  });
});

describe("primitives details", () => {
  it("rectangle_from_center handles odd sizes", () => {
    const elem = rectangle_from_center(0, 0, 5, 3, 0).elem;
    expect(elem.getAttribute("x")).toBe("-2.5");
    expect(elem.getAttribute("y")).toBe("-1.5");
  });

  it("isosceles_triangle path is exact", () => {
    expect(isosceles_triangle(0, 0, 4, 2).elem.getAttribute("d")).toBe(
      "M-2,1 2,1 0,-1Z",
    );
  });

  it("every primitive creates elements in the svg namespace", () => {
    for (const elem of [
      circle(0, 0, 1).elem,
      ellipse(0, 0, 1, 1).elem,
      group().elem,
      line(0, 0, 1, 1).elem,
      path("").elem,
      rectangle_from_corner(0, 0, 1, 1, 0).elem,
      svg(1, 1).elem,
      text(0, 0, "", 1, SVGAnchorPoint.topLeft).elem,
      multi_line_text(0, 0, 1, 1, "", 1, SVGAnchorPoint.topLeft).elem,
    ])
      expect(elem.namespaceURI).toBe("http://www.w3.org/2000/svg");
  });

  it("path_line draws a straight line", () => {
    expect(path_line(1, 2, 3, 4).elem.getAttribute("d")).toBe("M 1 2 L 3 4");
  });
});

describe("text anchors", () => {
  const cases: [SVGAnchorPoint, string, string][] = [
    [SVGAnchorPoint.bottomLeft, "start", "auto"],
    [SVGAnchorPoint.middleLeft, "start", "central"],
    [SVGAnchorPoint.topLeft, "start", "hanging"],
    [SVGAnchorPoint.topCenter, "middle", "hanging"],
    [SVGAnchorPoint.topRight, "end", "hanging"],
    [SVGAnchorPoint.middleRight, "end", "central"],
    [SVGAnchorPoint.bottomRight, "end", "auto"],
    [SVGAnchorPoint.bottomCenter, "middle", "auto"],
    [SVGAnchorPoint.middleCenter, "middle", "central"],
  ];
  it.each(cases)("text anchor %i", (anchor, text_anchor, baseline) => {
    const elem = text(0, 0, "a", 10, anchor).elem;
    expect(elem.getAttribute("text-anchor")).toBe(text_anchor);
    expect(elem.getAttribute("dominant-baseline")).toBe(baseline);
  });

  const multi_cases: [SVGAnchorPoint, string, string, string][] = [
    [SVGAnchorPoint.bottomLeft, "start", "flex-start", "flex-end"],
    [SVGAnchorPoint.middleLeft, "start", "flex-start", "center"],
    [SVGAnchorPoint.topLeft, "start", "flex-start", "flex-start"],
    [SVGAnchorPoint.topCenter, "center", "center", "flex-start"],
    [SVGAnchorPoint.topRight, "end", "flex-end", "flex-start"],
    [SVGAnchorPoint.middleRight, "end", "flex-end", "center"],
    [SVGAnchorPoint.bottomRight, "end", "flex-end", "flex-end"],
    [SVGAnchorPoint.bottomCenter, "center", "center", "flex-end"],
    [SVGAnchorPoint.middleCenter, "center", "center", "center"],
  ];
  it.each(multi_cases)(
    "multi line text anchor %i",
    (anchor, text_align, justify, align) => {
      const elem = multi_line_text(0, 0, 10, 10, "a", 12, anchor).elem;
      const div = elem.firstElementChild as HTMLDivElement;
      expect(div.style.textAlign).toBe(text_align);
      expect(div.style.justifyContent).toBe(justify);
      expect(div.style.alignItems).toBe(align);
      expect(div.style.fontSize).toBe("12px");
      expect(div.textContent).toBe("a");
    },
  );
});
