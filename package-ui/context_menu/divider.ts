import { define_element } from "#base";
import "./divider.scss";
import { ContextMenuLine } from "./line";

/**Line between groups of lines*/
class ContextMenuDivider extends ContextMenuLine {
  /**Returns the name used to define the element */
  static element_name() {
    return "divider";
  }

  get skips_focus() {
    return true;
  }

  do_focus(dir?: boolean) {
    this.focus_next(dir);
  }
}
define_element(ContextMenuDivider);

export type { ContextMenuDivider };

/**Creates a line between groups of lines*/
export function context_divider(): ContextMenuDivider {
  return ContextMenuDivider.create();
}
