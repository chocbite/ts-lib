import state from "@chocbite/ts-lib/state";
import { BaseSVG } from "../base_svg";
import { define_element } from "../define_element";

class TestSVGElement extends BaseSVG {
  static element_name(): string {
    return "test-element-svg";
  }
  static element_name_space(): string {
    return "chocbite";
  }

  default_canvas(): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "200");
    svg.setAttribute("height", "200");
    svg.setAttribute("viewBox", "0 0 200 200");
    return svg;
  }

  #text_element = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text",
  );

  constructor() {
    super();
    this.#text_element.setAttribute("x", "10");
    this.#text_element.setAttribute("y", "20");
    this.canvas.appendChild(this.#text_element);
  }

  set text(text: string) {
    this.#text_element.textContent = text;
  }

  set text2(text: () => string | undefined) {
    this.#text_element.textContent = text() ?? "";
  }
}
define_element(TestSVGElement);

const SYMBOL = Symbol("test");
const element = new TestSVGElement();
document.body.appendChild(element.canvas);
const number = state.ok(13);
element.attach_state_to_symbol(SYMBOL, number, (value) => {
  element.text = `The value is ${value.value}`;
});
await new Promise((a) => setTimeout(a, 2000));
number.set_ok(14);
element.detach_state_from_symbol(SYMBOL);
await new Promise((a) => setTimeout(a, 2000));
number.set_ok(15);
console.warn(number.ok());
