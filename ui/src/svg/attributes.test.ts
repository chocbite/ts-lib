import { describe, it, expect } from "vitest";
import { SVGAttributes } from "./attributes";
import { NAME_SPACE } from "./shared";

function createSVGElement(): SVGAttributes<SVGRectElement> {
  const elem = document.createElementNS(NAME_SPACE, "rect");
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

    it("every method returns the same wrapper", () => {
      const attrs = createSVGElement();
      for (const result of [
        attrs.s("a"),
        attrs.f("a"),
        attrs.sw(1),
        attrs.cl("a"),
        attrs.a("x", "1"),
        attrs.rotate(1),
        attrs.scale(1),
        attrs.skewX(1),
        attrs.skewY(1),
        attrs.transform("a"),
      ])
        expect(result).toBe(attrs);
    });
  });

  describe("elem", () => {
    it("returns the same element every time", () => {
      const attrs = createSVGElement();
      expect(attrs.elem).toBe(attrs.elem);
    });

    it("adds no transform attribute without transforms", () => {
      const attrs = createSVGElement();
      expect(attrs.elem.hasAttribute("transform")).toBe(false);
    });

    it("reading elem twice does not repeat the transforms", () => {
      const attrs = createSVGElement().translate(1, 2);
      void attrs.elem;
      expect(attrs.elem.getAttribute("transform")).toBe("translate(1 2)");
    });

    it("transforms added after reading elem are written on the next read", () => {
      const attrs = createSVGElement().translate(1, 2);
      const elem = attrs.elem;
      attrs.rotate(90);
      expect(elem.getAttribute("transform")).toBe("translate(1 2)");
      expect(attrs.elem.getAttribute("transform")).toBe(
        "translate(1 2) rotate(90)",
      );
    });

    it("other attributes are written immediately", () => {
      const elem = document.createElementNS(NAME_SPACE, "rect");
      new SVGAttributes(elem).fill("red");
      expect(elem.getAttribute("fill")).toBe("red");
    });
  });

  describe("edge cases", () => {
    it("rotate ignores a center with only one coordinate", () => {
      const attrs = createSVGElement().rotate(30, 5);
      expect(attrs.elem.getAttribute("transform")).toBe("rotate(30)");
    });

    it("rotate keeps a center at zero", () => {
      const attrs = createSVGElement().rotate(30, 0, 0);
      expect(attrs.elem.getAttribute("transform")).toBe("rotate(30 0 0)");
    });

    it("scale keeps a zero y scale", () => {
      const attrs = createSVGElement().scale(2, 0);
      expect(attrs.elem.getAttribute("transform")).toBe("scale(2 0)");
    });

    it("later attribute calls overwrite earlier ones", () => {
      const attrs = createSVGElement().fill("red").f("blue");
      expect(attrs.elem.getAttribute("fill")).toBe("blue");
    });

    it("class names accumulate over calls", () => {
      const attrs = createSVGElement().cl("a").class_list("b", "c");
      expect([...attrs.elem.classList]).toEqual(["a", "b", "c"]);
    });
  });
});
