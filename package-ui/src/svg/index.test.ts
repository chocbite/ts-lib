import { describe, expect, it, vi } from "vitest";

//The module is imported dynamically, so the import itself can be observed
type SVGModule = typeof import("./index");

describe("svg module", () => {
  it("logs nothing when imported", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await import("./index");
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("exposes every primitive and utility", async () => {
    const { svg } = await import("./index");
    expect(svg.svg(10, 10).elem.tagName).toBe("svg");
    expect(svg.circle(0, 0, 1).elem.tagName).toBe("circle");
    expect(svg.circle_arc(0, 0, 1, 0, 90).elem.tagName).toBe("path");
    expect(svg.ellipse(0, 0, 1, 2).elem.tagName).toBe("ellipse");
    expect(svg.ellipse_arc(0, 0, 1, 2, 0, 90).elem.tagName).toBe("path");
    expect(svg.group().elem.tagName).toBe("g");
    expect(svg.line(0, 0, 1, 1).elem.tagName).toBe("line");
    expect(svg.path("M 0 0").elem.tagName).toBe("path");
    expect(svg.rectangle_from_center(0, 0, 1, 1, 0).elem.tagName).toBe("rect");
    expect(svg.rectangle_from_corner(0, 0, 1, 1, 0).elem.tagName).toBe("rect");
    expect(svg.text(0, 0, "a", 1, 0).elem.tagName).toBe("text");
    expect(svg.multi_line_text(0, 0, 1, 1, "a", 1, 0).elem.tagName).toBe(
      "foreignObject",
    );
    expect(svg.isosceles_triangle(0, 0, 1, 1).elem.tagName).toBe("path");
    expect(svg.angle_to_anchor_point(0)).toBe(5);
  });

  it("create makes elements in the svg namespace", async () => {
    const { svg } = await import("./index");
    const elem = svg.create("g").elem;
    expect(elem.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(elem).toBeInstanceOf(SVGGElement);
  });

  it("create makes elements not in the primitive list, like defs", async () => {
    const { svg } = await import("./index");
    //Cast, the tag name list of create is checked in the type test below
    const elem = svg.create("defs" as "g").elem;
    expect(elem).toBeInstanceOf(SVGDefsElement);
  });

  it("attr wraps an existing element, keeping it", async () => {
    const { svg } = await import("./index");
    const existing = svg.create("rect").elem;
    const wrapped = svg.attr(existing).fill("red").translate(1, 2);
    expect(wrapped.elem).toBe(existing);
    expect(existing.getAttribute("fill")).toBe("red");
    expect(existing.getAttribute("transform")).toBe("translate(1 2)");
  });
});

/**Type tests, only type checked, never called
 * The README documents svg.create("defs") and svg.create("clipPath")*/
function type_tests(svg: SVGModule["svg"]) {
  svg.create("defs");
  svg.create("clipPath");
}
void type_tests;
