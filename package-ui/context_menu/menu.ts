import { Base, define_element } from "#base";
import { material_close_rounded } from "#icons";
import { Buffer } from "./buffer";
import { Container } from "./container";
import type { ContextMenuLine } from "./line";
import "./menu.scss";
import { context_line, type ContextMenuOption } from "./option";
import "./shared";
import type { ContextMenuSub } from "./submenu";

export type ContextMenuLines = ContextMenuLine[];

/**Lines of a menu, undefined lines are skipped
 * An array, a promise of one, or a function giving either, called every time the menu opens*/
export type ContextMenuLinesInput =
  | (ContextMenuLine | undefined)[]
  | Promise<(ContextMenuLine | undefined)[]>
  | (() =>
      | (ContextMenuLine | undefined)[]
      | Promise<(ContextMenuLine | undefined)[]>);

/**Menu of lines, opened with ctm.attach or ctm.summon*/
class ContextMenu extends Base {
  /**Returns the name used to define the element */
  static element_name() {
    return "menu";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "contextmenu";
  }

  #submenu: ContextMenuSub | undefined;
  #closer: ContextMenuOption | undefined;
  #x: number | undefined;
  #y: number | undefined;
  #element: Element | undefined;
  /**Spinner shown while promised lines load, cleared when the menu closes*/
  #loading: Buffer | undefined;
  #focus_out_handler = (e: FocusEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const to = e.relatedTarget as Node | null;
    if (!to || !this.contains(to)) {
      //Focus moved to an element outside the menu stays there, focus going to no element goes back to the element from before the menu
      this.close_up(!to);
      this.close_down();
    }
  };
  #window_resize_handler = () => {
    this.set_position(this.#x, this.#y, this.#element);
  };

  #lines: ContextMenuLinesInput;

  constructor(lines: ContextMenuLinesInput) {
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
        const parent = this.parentElement as ContextMenuSub | Container;
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
    const lines = this.read_lines();
    this.#loading?.remove();
    if (lines instanceof Promise) {
      const buffer = (this.#loading = this.appendChild(new Buffer()));
      lines.then((line) => {
        //Closed or opened again before the lines arrived
        if (this.#loading !== buffer) return;
        this.#loading = undefined;
        buffer.remove();
        this.#set_lines(line);
        this.set_position(this.#x, this.#y, this.#element);
      });
    } else {
      this.#loading = undefined;
      this.#set_lines(lines);
    }
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
    //Lines arriving after the menu closed are not shown
    this.#loading?.remove();
    this.#loading = undefined;
    this.ownerDocument.defaultView?.removeEventListener(
      "resize",
      this.#window_resize_handler,
    );
  }

  /**Gives the lines the menu shows when it opens, a lines function is called
   * The lines are elements in one menu at a time, ctm.combine moves them into its menu, this menu takes them back when it opens */
  read_lines():
    (ContextMenuLine | undefined)[] | Promise<(ContextMenuLine | undefined)[]> {
    return typeof this.#lines === "function" ? this.#lines() : this.#lines;
  }

  /**Shows the lines, after the close line of a big menu*/
  #set_lines(lines: (ContextMenuLine | undefined)[]) {
    this.replaceChildren();
    if (this.#closer) this.appendChild(this.#closer);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line) this.appendChild(line);
    }
  }

  /**Changes focus to the next line
   * @param direction false is first child, true is last child */
  focus_next(direction: boolean) {
    //The direction is passed on, so a divider skips to the line after it, toward the middle
    if (direction) (this.lastChild as ContextMenuLine | null)?.do_focus(true);
    else (this.firstChild as ContextMenuLine | null)?.do_focus(false);
  }

  /**The open submenu line of this menu*/
  get submenu(): ContextMenuSub | undefined {
    return this.#submenu;
  }

  /**Called by a submenu line of this menu when it opens or closes its menu*/
  submenu_opened(submenu: ContextMenuSub | undefined) {
    this.#submenu = submenu;
  }

  /**Adds or removes the close line at the top, for menus too big to click beside*/
  #set_closer(closer: boolean) {
    if (closer && !this.#closer) {
      this.classList.add("closer");
      this.#closer = context_line({
        text: "Close",
        icon: material_close_rounded,
      });
      this.#closer.onclick = (e) => {
        e.stopPropagation();
        const parent = this.parentElement as ContextMenuSub | Container;
        if (parent instanceof Container) this.close_up();
        else parent.close_down();
      };
      this.prepend(this.#closer);
    } else if (!closer && this.#closer) {
      this.classList.remove("closer");
      this.#closer.remove();
      this.#closer = undefined;
    }
  }

  /**Closes the context menu down the tree*/
  close_down() {
    this.#submenu?.close_down();
    this.#submenu = undefined;
  }

  /**Closes the context menu up the tree to the root
   * @param refocus whether the focus goes back to the element from before the menu, false when the focus moved to another element*/
  close_up(refocus = true) {
    this.removeEventListener("focusout", this.#focus_out_handler, {
      capture: true,
    });
    (this.parentElement as Container | ContextMenuSub | null)?.close_up(
      refocus,
    );
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
    this.#set_closer(box_area > html_area * 0.5);
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
      } else left = sub_box.x + sub_box.width;

      y = sub_box.y + sub_box.height;

      //Below the element, else above it, else as low as the window allows
      if (y + box.height < window.innerHeight) top = y;
      else if (sub_box.y >= box.height) bottom = window.innerHeight - sub_box.y;
      else top = Math.max(0, window.innerHeight - box.height);
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
    this.classList.toggle("fullscreen-x", box.width === window.innerWidth);
    this.classList.toggle("fullscreen-y", box.height >= window.innerHeight);

    this.style.top = top === top ? top + "px" : "";
    this.style.bottom = bottom === bottom ? bottom + "px" : "";
    this.style.left = left === left ? left + "px" : "";
    this.style.right = right === right ? right + "px" : "";
    this.focus();
  }
}
define_element(ContextMenu);

//A value inside the module for instanceof, the index exports it only as a type
export { ContextMenu };

/**Creates a menu of the given lines, see ContextMenuLinesInput*/
export function context_menu(lines: ContextMenuLinesInput): ContextMenu {
  return ContextMenu.create({}, lines);
}
