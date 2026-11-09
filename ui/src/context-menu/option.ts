import { define_element } from "#base";
import { ContextMenuLine, MenuLine } from "./line";
import { ContextMenu } from "./menu";
import "./option.scss";

export interface ContextMenuOption extends ContextMenuLine {}

export class MenuOption extends MenuLine implements ContextMenuOption {
  readonly func: () => void;

  /**Returns the name used to define the element */
  static element_name() {
    return "option";
  }

  constructor(
    text: string,
    func: () => void,
    icon?: SVGSVGElement,
    shortcut?: string,
    checkmark?: boolean,
  ) {
    super();
    this.func = func;
    this.tabIndex = 0;
    const icon_box = this.appendChild(document.createElement("div"));
    icon_box.className = "icon";
    if (icon) icon_box.appendChild(icon);
    const text_box = this.appendChild(document.createElement("div"));
    text_box.textContent = text;
    text_box.className = "text";
    const shortcut_box = this.appendChild(document.createElement("div"));
    if (shortcut) shortcut_box.textContent = shortcut;
    shortcut_box.className = "shortcut";
    const check_mark_box = this.appendChild(document.createElement("div"));
    if (checkmark) check_mark_box.textContent = "✓";
    check_mark_box.className = "checkmark";

    this.onclick = (e) => {
      e.stopPropagation();
      this.func();
      navigator.vibrate?.(25);
      (this.parentElement as ContextMenu).close_up();
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
          this.func();
          (this.parentElement as ContextMenu).close_up();
          break;
        case "ArrowLeft":
        case "Escape":
          return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
  }

  do_focus(): void {
    this.focus();
  }
}
define_element(MenuOption);

export function context_line(
  text: string,
  func: () => void,
  icon?: SVGSVGElement,
  shortcut?: string,
  checkmark?: boolean,
): ContextMenuOption {
  return new MenuOption(text, func, icon, shortcut, checkmark);
}
