import { Base, define_element } from "#base";
import { material_close_rounded } from "#icons";
import { Buffer } from "./buffer";
import { Container } from "./container";
import { ContextMenuLine, MenuLine } from "./line";
import "./menu.scss";
import { MenuOption } from "./option";
import "./shared";
import { MenuSub } from "./submenu";

export type ContextMenuLines = ContextMenuLine[];

export class ContextMenu extends Base {
  /**Returns the name used to define the element */
  static element_name() {
    return "menu";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "contextmenu";
  }

  container: Container | undefined;
  readonly submenu: MenuSub | undefined;
  #closer: MenuOption | undefined;
  #x: number | undefined;
  #y: number | undefined;
  #element: Element | undefined;
  #focus_out_handler = (e: FocusEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.relatedTarget || !this.contains(e.relatedTarget as Node)) {
      this.close_up();
      this.close_down();
    }
  };
  #window_resize_handler = () => {
    this.set_position(this.#x, this.#y, this.#element);
  };

  #lines:
    | (
        | (ContextMenuLine | undefined)[]
        | Promise<(ContextMenuLine | undefined)[]>
      )
    | (() =>
        | (ContextMenuLine | undefined)[]
        | Promise<(ContextMenuLine | undefined)[]>);

  constructor(
    lines:
      | (
          | (ContextMenuLine | undefined)[]
          | Promise<(ContextMenuLine | undefined)[]>
        )
      | (() =>
          | (ContextMenuLine | undefined)[]
          | Promise<(ContextMenuLine | undefined)[]>),
  ) {
    super();
    this.#lines = lines;
    this.tabIndex = 0;
    this.onscroll = () => {
      this.close_down();
    };
    this.onkeydown = (e) => {
      if (e.code === "Tab" || e.code === "ArrowUp" || e.code === "ArrowDown")
        this.focus_next(e.shiftKey || e.code === "ArrowUp");
      else if (e.code === "ArrowLeft") {
        const parent = this.parentElement as MenuSub | Container;
        if (!(parent instanceof Container)) {
          parent.focus();
          parent.close_down();
        }
      } else if (e.code === "Escape") this.close_up();
      e.preventDefault();
      e.stopPropagation();
    };
  }

  protected connectedCallback(): void {
    super.connectedCallback();
    const lines =
      typeof this.#lines === "function" ? this.#lines() : this.#lines;
    if (lines instanceof Promise) {
      const buffer = this.appendChild(new Buffer());
      lines.then((line) => {
        buffer.remove();
        this.lines = line;
        this.set_position(this.#x, this.#y, this.#element);
      });
    } else this.lines = lines;
    this.addEventListener("focusout", this.#focus_out_handler, {
      capture: true,
    });
    this.ownerDocument.defaultView?.addEventListener(
      "resize",
      this.#window_resize_handler,
      { passive: true },
    );
  }

  protected disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ownerDocument.defaultView?.removeEventListener(
      "resize",
      this.#window_resize_handler,
    );
  }

  /**Sets the lines of the context menu */
  set lines(lines: (ContextMenuLine | undefined)[]) {
    this.replaceChildren();
    if (this.#closer) this.appendChild(this.#closer);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line) this.appendChild(line as MenuLine);
    }
  }

  /**Changes focus to the next line
   * @param direction false is first child, true is last child */
  focus_next(direction: boolean) {
    if (direction) (this.lastChild as MenuLine)?.do_focus();
    else (this.firstChild as MenuLine)?.do_focus(true);
  }

  set closer(closer: boolean) {
    if (closer && !this.#closer) {
      this.classList.add("closer");
      this.#closer = new MenuOption(
        "Close",
        () => {},
        material_close_rounded(),
      );
      this.#closer.onclick = (e) => {
        e.stopPropagation();
        if (this.parentElement instanceof MenuSub) {
          this.parentElement.close_down();
        } else {
          this.close_up();
        }
      };
      this.prepend(this.#closer);
    } else if (!closer && this.#closer) {
      this.classList.remove("closer");
      this.#closer.remove();
      this.#closer = undefined;
    }
  }

  /**Sets the context menu to fullscreen mode in x directino */
  set fullscreenx(full: boolean) {
    if (full) this.classList.add("fullscreen-x");
    else this.classList.remove("fullscreen-x");
  }

  /**Sets the context menu to fullscreen mode in y direction */
  set fullscreeny(full: boolean) {
    if (full) this.classList.add("fullscreen-y");
    else this.classList.remove("fullscreen-y");
  }

  /**Closes the context menu down the tree*/
  close_down() {
    if (this.submenu) this.submenu.close_down();
    //@ts-expect-error Writing to readonly property, from inside class itself
    this.submenu = undefined;
  }

  /**Closes the context menu up the tree to the root*/
  close_up() {
    this.removeEventListener("focusout", this.#focus_out_handler, {
      capture: true,
    });
    (this.parentElement as Container)?.close_up();
    this.remove();
  }

  /**Updates the position of the menu
   * @param x x coordinate for menu, this will be ignored if needed for contextmenu to fit
   * @param y y coordinate for menu, this will be ignored if needed for contextmenu to fit
   * @param element element to use instead of coordinates, the contextemenu will avoid covering the element if possible*/
  set_position(x: number = 0, y: number = 0, element?: Element) {
    this.#x = x;
    this.#y = y;
    this.#element = element;
    const box = this.getBoundingClientRect();
    const box_area = box.width * box.height;
    const window = this.ownerDocument.defaultView!;
    const html_area = window.innerWidth * window.innerHeight;
    this.closer = box_area > html_area * 0.5;
    let top = NaN;
    let bottom = NaN;
    let left = NaN;
    let right = NaN;
    if (element) {
      const sub_box = element.getBoundingClientRect();

      if (sub_box.x + sub_box.width + box.width > window.innerWidth) {
        x = sub_box.x;
        if (box.width < x) right = window.innerWidth - x;
        else right = window.innerWidth - (sub_box.x + sub_box.width);
      } else x = sub_box.x + sub_box.width;

      y = sub_box.y + sub_box.height;

      if (y + box.height >= window.innerHeight) {
        if (y >= box.height) bottom = window.innerHeight - sub_box.y;
        else top = window.innerHeight - box.height;
      } else top = y;
    } else {
      if (y + box.height >= window.innerHeight) {
        if (y >= box.height) bottom = window.innerHeight - y;
        else top = window.innerHeight - box.height;
      } else top = y;

      if (box.width >= window.innerWidth) {
        right = 0;
      } else if (x + box.width >= window.innerWidth) {
        if (x >= box.width) right = window.innerWidth - x;
        else left = window.innerWidth - box.width;
      } else left = x;
    }
    this.fullscreenx = box.width === window.innerWidth;
    this.fullscreeny = box.height >= window.innerHeight;

    this.style.top = top === top ? top + "px" : "";
    this.style.bottom = bottom === bottom ? bottom + "px" : "";
    this.style.left = left === left ? left + "px" : "";
    this.style.right = right === right ? right + "px" : "";
    this.focus();
  }
}
define_element(ContextMenu);

export function context_menu(
  lines:
    | (
        | (ContextMenuLine | undefined)[]
        | Promise<(ContextMenuLine | undefined)[]>
      )
    | (() => (ContextMenuLine | undefined)[])
    | (() => Promise<(ContextMenuLine | undefined)[]>),
): ContextMenu {
  return new ContextMenu(lines);
}
