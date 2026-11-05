import state from "@chocbite/ts-lib/state";
import { Base } from "../base";
import { define_element } from "../define_element";

class TestElement extends Base {
  static element_name(): string {
    return "test-element";
  }
  static element_name_space(): string {
    return "chocbite";
  }

  set text(text: string) {
    this.textContent = text;
  }

  set text2(text: () => string | undefined) {
    this.textContent = text() ?? "";
  }
}
define_element(TestElement);

const SYMBOL = Symbol("test");
const element = document.body.appendChild(new TestElement());
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
