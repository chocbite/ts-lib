import { Base } from "#base";
import "./option.scss";
import "./shared";

export interface ContextMenuLine {}

export abstract class MenuLine extends Base implements ContextMenuLine {
  /**Returns the name used to define the element */
  static element_name() {
    return "@abstract@";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "contextmenu";
  }

  abstract do_focus(dir?: boolean): void;

  /**True for lines that can not take focus, like dividers, focus moves past them*/
  get skips_focus() {
    return false;
  }

  /**Changes focus to the next line, wrapping around and skipping lines that can not take focus
   * @param direction false is next sibling, true is previous */
  focus_next(direction?: boolean) {
    const parent = this.parentElement;
    if (!parent) return;
    let line = direction
      ? this.previousElementSibling
      : this.nextElementSibling;
    for (;;) {
      line ??= direction ? parent.lastElementChild : parent.firstElementChild;
      //Back at the start, there is no other line to focus
      if (!line || line === this) return;
      if (!(line as MenuLine).skips_focus)
        return (line as MenuLine).do_focus(direction);
      line = direction ? line.previousElementSibling : line.nextElementSibling;
    }
  }
}
