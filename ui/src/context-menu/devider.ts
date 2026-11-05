import { define_element } from "#base";
import "./devider.scss";
import { ContextMenuLine, MenuLine } from "./line";

export interface ContextMenuDevider extends ContextMenuLine {}

export class Devider extends MenuLine implements ContextMenuDevider {
  /**Returns the name used to define the element */
  static element_name() {
    return "devider";
  }

  do_focus(dir?: boolean) {
    this.focus_next(dir);
  }
}
define_element(Devider);

export function context_devider(): ContextMenuDevider {
  return new Devider();
}
