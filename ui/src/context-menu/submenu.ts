import { define_element } from "#base";
import { material_chevron_right_rounded } from "#icons";
import { ContextMenuLine, MenuLine } from "./line";
import { ContextMenu } from "./menu";
import "./submenu.scss";

export interface ContextMenuSub extends ContextMenuLine {}

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};
export class MenuSub extends MenuLine implements ContextMenuSub {
  #menu: ContextMenu;
  #is_open?: boolean;
  #hover_time?: number;
  #block_time?: number;

  /**Returns the name used to define the element */
  static element_name() {
    return "submenu";
  }

  constructor(text: string, menu: ContextMenu, icon?: SVGSVGElement) {
    super();
    this.#menu = menu;
    this.tabIndex = 0;
    const icon_box = this.appendChild(document.createElement("div"));
    icon_box.className = "icon";
    if (icon) icon_box.appendChild(icon);
    const text_box = this.appendChild(document.createElement("div"));
    text_box.textContent = text;
    text_box.className = "text";
    const shortcut_box = this.appendChild(document.createElement("div"));
    shortcut_box.className = "shortcut";
    const chevron_box = this.appendChild(document.createElement("div"));
    chevron_box.appendChild(material_chevron_right_rounded());
    chevron_box.className = "chevron";

    this.onclick = (e) => {
      e.stopPropagation();
      if (!this.#block_time) {
        navigator.vibrate?.(25);
        if (this.#is_open) {
          this.close_down();
        } else {
          this.open();
        }
      }
    };

    this.onpointerenter = (e) => {
      if (e.pointerType !== "touch" && !this.#is_open) {
        this.#hover_time = window.setTimeout(() => {
          this.open();
          this.#block_time = window.setTimeout(() => {
            this.#block_time = 0;
          }, 500);
        }, 300);
      }
    };
    this.onpointerleave = () => {
      clearTimeout(this.#hover_time);
    };
    this.onkeydown = (e) => {
      switch (e.code) {
        case "Tab":
        case "ArrowUp":
        case "ArrowDown":
          this.focus_next(e.shiftKey || e.code === "ArrowUp");
          break;
        case "ArrowRight":
        case "Enter":
        case "Space":
          this.open();
          this.#menu.focus_next(false);
          break;
        case "ArrowLeft":
        case "Escape":
          return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
  }

  /**Opens the sub menu */
  open() {
    const sub = this.parentElement as Mutable<ContextMenu>;
    if (sub) sub.close_down();
    (this.parentElement as Mutable<ContextMenu>).submenu = this;
    this.appendChild(this.#menu);
    this.#menu.set_position(0, 0, this);
    this.#is_open = true;
  }

  do_focus(): void {
    this.focus();
  }

  /**Closes menu by calling parent*/
  close() {
    this.focus();
    (this.parentElement as Mutable<ContextMenu>).submenu = undefined;
    this.removeChild(this.#menu);
    this.#is_open = false;
  }

  /**Closes the context menu down the tree*/
  close_down() {
    this.#menu.close_down();
    this.close();
  }

  /**Closes the context menu up the tree to the root*/
  close_up() {
    this.close();
    (this.parentElement as ContextMenu).close_up();
  }
}
define_element(MenuSub);

export function context_sub(
  text: string,
  menu: ContextMenu,
  icon?: SVGSVGElement,
): ContextMenuSub {
  return new MenuSub(text, menu, icon);
}
