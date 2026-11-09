import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import { BaseSVG } from "./base_svg";
import { define_element } from "./define_element";

class TestSVG extends BaseSVG {
  static element_name() {
    return "shape";
  }
  static element_name_space() {
    return "basesvgtest";
  }
  protected default_canvas(): SVGSVGElement {
    return document.createElementNS("http://www.w3.org/2000/svg", "svg");
  }
}
define_element(TestSVG);

describe("BaseSVG", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("creates its canvas, classed with the element name, containing the element", () => {
    const element = new TestSVG();
    expect(element.canvas).toBeInstanceOf(SVGSVGElement);
    expect(element.canvas.classList.contains("basesvgtest-shape")).toBe(true);
    expect(element.parentNode).toBe(element.canvas);
  });

  it("each element has its own canvas", () => {
    expect(new TestSVG().canvas).not.toBe(new TestSVG().canvas);
  });

  it("connects when its canvas is added to the document", () => {
    const state = st.ok_w(1);
    const element = new TestSVG();
    element.attach_state(state, () => {});
    document.body.appendChild(element.canvas);
    expect(element.is_connected).toBe(true);
    expect(state.amount()).toBe(1);
    element.canvas.remove();
    expect(state.amount()).toBe(0);
  });
});
