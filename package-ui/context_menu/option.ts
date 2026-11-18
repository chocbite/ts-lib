import { define_element, input_key, type InputOptions } from "#base";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import { LabelLine, type ContextMenuLabelOptions } from "./line";
import type { ContextMenu } from "./menu";
import "./option.scss";

/**Inputs of an option*/
const OPTION = {
  /**Called when the line is clicked, or chosen with enter or space, the menu then closes*/
  on_click: input_key<() => void>(),
  /**Text at the right end, like the keyboard shortcut doing the same, an error shows none*/
  shortcut: input_key<StateOrVal<string>>(),
  /**Shows a checkmark, only shown, a click does not change it, an error shows none*/
  checked: input_key<StateOrVal<boolean>>(),
};
export type ContextMenuOptionOptions = ContextMenuLabelOptions &
  InputOptions<typeof OPTION>;

/**Line of a menu that does something when chosen*/
class ContextMenuOption extends LabelLine {
  /**Returns the name used to define the element */
  static element_name() {
    return "option";
  }

  #shortcut = this.appendChild(document.createElement("div"));
  #checkmark = this.appendChild(document.createElement("div"));
  #on_click?: () => void;

  constructor() {
    super();
    this.#shortcut.className = "shortcut";
    this.#checkmark.className = "checkmark";

    this.onclick = (e) => {
      e.stopPropagation();
      navigator.vibrate?.(25);
      this.#choose();
    };

    this.onkeydown = (e) => {
      switch (e.code) {
        case "Tab":
        case "ArrowUp":
        case "ArrowDown":
          this.focus_next(e.shiftKey || e.code === "ArrowUp");
          break;
        case "Enter":
        case "Space":
          this.#choose();
          break;
        case "ArrowLeft":
        case "Escape":
          return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
  }

  set(options: ContextMenuOptionOptions): this {
    super.set(options);
    this.set_input(OPTION.on_click, options.on_click, (on_click) => {
      this.#on_click = on_click.value;
    });
    this.set_input(OPTION.shortcut, options.shortcut, (shortcut) => {
      this.#shortcut.textContent = shortcut.ok ? shortcut.value : "";
    });
    this.set_input(OPTION.checked, options.checked, (checked) => {
      this.#checkmark.textContent = checked.ok && checked.value ? "✓" : "";
    });
    return this;
  }

  /**Runs the option and closes the menu*/
  #choose() {
    this.#on_click?.();
    (this.parentElement as ContextMenu | null)?.close_up();
  }
}
define_element(ContextMenuOption);

export type { ContextMenuOption };

/**Creates a line of a menu that calls on_click when chosen, the menu then closes*/
export function context_line(
  options: ContextMenuOptionOptions = {},
): ContextMenuOption {
  return ContextMenuOption.create(options);
}
