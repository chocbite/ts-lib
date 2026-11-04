import { array_from_length } from "@chocbite/ts-lib/common";
import { Base } from "../base";
import { define_element } from "../define_element";

class TestContainer extends Base {
  static element_name(): string {
    return "test-resize-container";
  }
  static element_name_space(): string {
    return "chocbite";
  }

  constructor() {
    super();
    const attach = this.appendChild(document.createElement("button"));
    attach.textContent = "Attach to Resize Observer";
    attach.onclick = () => {
      children.forEach((child) => {
        child.attach_to_resize_observer();
      });
    };
    const detach = this.appendChild(document.createElement("button"));
    detach.textContent = "Detach from Resize Observer";
    detach.onclick = () => {
      children.forEach((child) => {
        child.detach_from_resize_observer();
      });
    };

    this.style.display = "block";
    this.style.width = "400px";
    this.style.height = "200px";
    this.style.overflow = "scroll";

    const children = array_from_length(100, () => new TestElement());
    children.forEach((child) => {
      child.attach_to_intersect_observer(this.intersect_observer());
      this.appendChild(child);
    });
  }
}
define_element(TestContainer);

class TestElement extends Base {
  static element_name(): string {
    return "test-resize-element";
  }
  static element_name_space(): string {
    return "chocbite";
  }
  constructor() {
    super();
    this.style.display = "block";
    this.style.width = "380px";
    this.style.height = "20px";
    this.style.overflow = "auto";
    this.style.resize = "both"; /* Enables the resizer in both directions */
  }

  protected on_resize(rect: DOMRectReadOnly): void {
    this.textContent = `Width: ${rect.width}, Height: ${rect.height}, X: ${rect.x}, Y: ${rect.y}`;
  }
}
define_element(TestElement);

document.body.appendChild(new TestContainer());
