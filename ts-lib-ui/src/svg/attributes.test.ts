import { describe, it, expect } from "vitest";
import { SVGAttributes } from "./attributes";
import { NAME_SPACE } from "./shared";

function createSVGElement(): SVGAttributes<SVGRectElement> {
  const elem = document.createElementNS(NAME_SPACE, "rect") as SVGRectElement;
  return new SVGAttributes(elem);
}

describe("SVGAttributes", () => {
  describe("stroke / s", () => {
    it("sets stroke attribute", () => {
      const attrs = createSVGElement();
      attrs.stroke("red");
      expect(attrs.elem.getAttribute("stroke")).toBe("red");
    });

    it("sets stroke via shorthand s()", () => {
      const attrs = createSVGElement();
      attrs.s("blue");
      expect(attrs.elem.getAttribute("stroke")).toBe("blue");
    });
  });

  describe("fill / f", () => {
    it("sets fill attribute", () => {
      const attrs = createSVGElement();
      attrs.fill("green");
      expect(attrs.elem.getAttribute("fill")).toBe("green");
    });

    it("sets fill via shorthand f()", () => {
      const attrs = createSVGElement();
      attrs.f("yellow");
      expect(attrs.elem.getAttribute("fill")).toBe("yellow");
    });
  });

  describe("stroke_width / sw", () => {
    it("sets stroke-width attribute", () => {
      const attrs = createSVGElement();
      attrs.stroke_width(3);
      expect(attrs.elem.getAttribute("stroke-width")).toBe("3");
    });

    it("sets stroke-width via shorthand sw()", () => {
      const attrs = createSVGElement();
      attrs.sw(5);
      expect(attrs.elem.getAttribute("stroke-width")).toBe("5");
    });
  });

  describe("class_list / cl", () => {
    it("adds class names to the element", () => {
      const attrs = createSVGElement();
      attrs.class_list("foo", "bar");
      expect(attrs.elem.classList.contains("foo")).toBe(true);
      expect(attrs.elem.classList.contains("bar")).toBe(true);
    });

    it("adds class names via shorthand cl()", () => {
      const attrs = createSVGElement();
      attrs.cl("baz");
      expect(attrs.elem.classList.contains("baz")).toBe(true);
    });
  });

  describe("attribute / a", () => {
    it("sets an arbitrary attribute", () => {
      const attrs = createSVGElement();
      attrs.attribute("data-id", "123");
      expect(attrs.elem.getAttribute("data-id")).toBe("123");
    });

    it("sets an arbitrary attribute via shorthand a()", () => {
      const attrs = createSVGElement();
      attrs.a("data-name", "test");
      expect(attrs.elem.getAttribute("data-name")).toBe("test");
    });
  });

  describe("transforms", () => {
    it("applies translate transform", () => {
      const attrs = createSVGElement();
      attrs.translate(10, 20);
      expect(attrs.elem.getAttribute("transform")).toBe("translate(10 20)");
    });

    it("applies rotate transform without center", () => {
      const attrs = createSVGElement();
      attrs.rotate(45);
      expect(attrs.elem.getAttribute("transform")).toBe("rotate(45)");
    });

    it("applies rotate transform with center", () => {
      const attrs = createSVGElement();
      attrs.rotate(45, 50, 50);
      expect(attrs.elem.getAttribute("transform")).toBe("rotate(45 50 50)");
    });

    it("applies scale transform with one value", () => {
      const attrs = createSVGElement();
      attrs.scale(2);
      expect(attrs.elem.getAttribute("transform")).toBe("scale(2)");
    });

    it("applies scale transform with two values", () => {
      const attrs = createSVGElement();
      attrs.scale(2, 3);
      expect(attrs.elem.getAttribute("transform")).toBe("scale(2 3)");
    });

    it("applies skewX transform", () => {
      const attrs = createSVGElement();
      attrs.skewX(30);
      expect(attrs.elem.getAttribute("transform")).toBe("skewX(30)");
    });

    it("applies skewY transform", () => {
      const attrs = createSVGElement();
      attrs.skewY(15);
      expect(attrs.elem.getAttribute("transform")).toBe("skewY(15)");
    });

    it("applies custom transform", () => {
      const attrs = createSVGElement();
      attrs.transform("matrix(1 0 0 1 0 0)");
      expect(attrs.elem.getAttribute("transform")).toBe("matrix(1 0 0 1 0 0)");
    });

    it("chains multiple transforms", () => {
      const attrs = createSVGElement();
      attrs.translate(10, 20).rotate(45).scale(2);
      expect(attrs.elem.getAttribute("transform")).toBe(
        "translate(10 20) rotate(45) scale(2)",
      );
    });
  });

  describe("method chaining", () => {
    it("supports chaining all methods", () => {
      const attrs = createSVGElement();
      const result = attrs
        .stroke("red")
        .fill("blue")
        .stroke_width(2)
        .class_list("my-class")
        .attribute("data-id", "1")
        .translate(5, 10);
      expect(result.elem.getAttribute("stroke")).toBe("red");
      expect(result.elem.getAttribute("fill")).toBe("blue");
      expect(result.elem.getAttribute("stroke-width")).toBe("2");
      expect(result.elem.classList.contains("my-class")).toBe(true);
      expect(result.elem.getAttribute("data-id")).toBe("1");
      expect(result.elem.getAttribute("transform")).toBe("translate(5 10)");
    });
  });
});
