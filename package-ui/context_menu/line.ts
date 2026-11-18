import { Base, input_key, type BaseOptions, type InputOptions } from "#base";
import type { SVGFunc } from "#svg";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import "./option.scss";
import "./shared";

/**Any line of a menu, an option, a submenu, a divider*/
export abstract class ContextMenuLine extends Base {
  /**Returns the name used to define the element */
  static element_name() {
    return "@abstract@";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "contextmenu";
  }

  abstract do_focus(dir?: boolean): void;

  /**True for lines that can not take focus, like dividers and lines without write access, focus moves past them*/
  get skips_focus() {
    return this.inert;
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
      if (!(line as ContextMenuLine).skips_focus)
        return (line as ContextMenuLine).do_focus(direction);
      line = direction ? line.previousElementSibling : line.nextElementSibling;
    }
  }
}

/**Inputs of lines with a label, options and submenus*/
const LABEL = {
  /**Text of the line, an error shows its nice text*/
  text: input_key<StateOrVal<string>>(),
  /**Icon in front of the text, undefined for none, an error shows none*/
  icon: input_key<StateOrVal<SVGFunc | undefined>>(),
};
export type ContextMenuLabelOptions = BaseOptions & InputOptions<typeof LABEL>;

/**Line with an icon and a text, the base of options and submenus*/
export abstract class LabelLine extends ContextMenuLine {
  #icon = this.appendChild(document.createElement("div"));
  #text = this.appendChild(document.createElement("div"));

  constructor() {
    super();
    this.tabIndex = 0;
    this.#icon.className = "icon";
    this.#text.className = "text";
  }

  set(options: ContextMenuLabelOptions): this {
    super.set(options);
    this.set_input(LABEL.text, options.text, (text) => {
      this.#text.textContent = text.ok ? text.value : text.error.nice;
    });
    this.set_input(LABEL.icon, options.icon, (icon) => {
      this.#icon.replaceChildren();
      if (icon.ok && icon.value) this.#icon.appendChild(icon.value());
    });
    return this;
  }

  do_focus(): void {
    this.focus();
  }
}
