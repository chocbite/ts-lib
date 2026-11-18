import { define_element, input_key, type InputOptions } from "#base";
import { material_chevron_right_rounded } from "#icons";
import { LabelLine, type ContextMenuLabelOptions } from "./line";
import type { ContextMenu } from "./menu";
import "./submenu.scss";

/**Inputs of a submenu*/
const SUB = {
  /**Menu opened by the line, without a menu the line does nothing*/
  menu: input_key<ContextMenu | undefined>(),
};
export type ContextMenuSubOptions = ContextMenuLabelOptions &
  InputOptions<typeof SUB>;

/**Line of a menu that opens another menu beside it*/
class ContextMenuSub extends LabelLine {
  /**Returns the name used to define the element */
  static element_name() {
    return "submenu";
  }

  #menu?: ContextMenu;
  #is_open = false;
  #hover_time?: number;
  #block_time?: number;

  constructor() {
    super();
    this.appendChild(document.createElement("div")).className = "shortcut";
    const chevron = this.appendChild(document.createElement("div"));
    chevron.appendChild(material_chevron_right_rounded());
    chevron.className = "chevron";

    this.onclick = (e) => {
      e.stopPropagation();
      if (!this.#block_time) {
        navigator.vibrate?.(25);
        if (this.#is_open) this.close_down();
        else this.open();
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
          if (this.#is_open) this.#menu?.focus_next(false);
          break;
        case "ArrowLeft":
        case "Escape":
          return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
  }

  set(options: ContextMenuSubOptions): this {
    super.set(options);
    this.set_input(SUB.menu, options.menu, (menu) => {
      //An open menu that is replaced is closed first
      if (this.#is_open) this.close_down();
      this.#menu = menu.value;
    });
    return this;
  }

  /**Opens the sub menu */
  open() {
    const menu = this.#menu;
    const parent = this.parentElement as ContextMenu | null;
    if (!menu || !parent) return;
    parent.close_down();
    parent.submenu_opened(this);
    this.appendChild(menu);
    menu.set_position(0, 0, this);
    this.#is_open = true;
  }

  /**Closes menu by calling parent*/
  close() {
    if (!this.#is_open) return;
    this.focus();
    (this.parentElement as ContextMenu | null)?.submenu_opened(undefined);
    this.#menu?.remove();
    this.#is_open = false;
  }

  /**Closes the context menu down the tree*/
  close_down() {
    this.#menu?.close_down();
    this.close();
  }

  /**Closes the context menu up the tree to the root*/
  close_up() {
    this.close();
    (this.parentElement as ContextMenu | null)?.close_up();
  }
}
define_element(ContextMenuSub);

export type { ContextMenuSub };

/**Creates a line of a menu that opens the given menu beside it*/
export function context_sub(
  options: ContextMenuSubOptions = {},
): ContextMenuSub {
  return ContextMenuSub.create(options);
}
