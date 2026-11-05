import state from "@chocbite/ts-lib/state";
import { Base } from "../base";
import { define_element } from "../define_element";

const count = state.ok(0);
const couter_for_element = state.ok(0);
setInterval(() => {
  couter_for_element.set_ok(couter_for_element.ok() + 1);
}, 1000);

class TestContainer extends Base {
  static element_name(): string {
    return "test-intersect-container";
  }
  static element_name_space(): string {
    return "chocbite";
  }

  constructor() {
    super();
    const count_box = document.createElement("div");
    count_box.style.position = "sticky";
    count_box.style.top = "0";
    count_box.style.backgroundColor = "white";
    this.appendChild(count_box);
    this.attach_state(count, (value) => {
      count_box.textContent = `Visible Count: ${value.value}`;
    });

    this.style.display = "block";
    this.style.width = "200px";
    this.style.height = "200px";
    this.style.overflow = "scroll";

    for (let i = 0; i < 100; i++) {
      this.appendChild(new TestElement()).attach_to_intersect_observer(
        this.intersect_observer(),
      );
    }
  }
}
define_element(TestContainer);

class TestElement extends Base {
  static element_name(): string {
    return "test-intersect-element";
  }
  static element_name_space(): string {
    return "chocbite";
  }
  constructor() {
    super();
    this.style.display = "block";
    this.style.width = "180px";
    this.style.height = "20px";
    this.style.backgroundColor = "red";
    this.attach_state(
      couter_for_element,
      (value) => {
        this.textContent = `Counter: ${value.value}`;
      },
      true,
    );
  }

  protected on_visible(is: boolean): void {
    this.style.backgroundColor = is ? "green" : "red";
    if (is) count.set_ok(count.ok() + 1);
    else count.set_ok(count.ok() - 1);
  }
}
define_element(TestElement);

document.body.appendChild(new TestContainer());
