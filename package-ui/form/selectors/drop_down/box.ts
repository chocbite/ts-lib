import { Base, define_element } from "#base";
import { DOCUMENT_HANDLER } from "#document";
import { material_close_rounded } from "#icons";
import type { SVGFunc } from "#svg";
import "./box.scss";

/**A line of the popup to pick*/
export interface FormDropDownSelection {
  text: string;
  icon?: SVGFunc;
}

/**What the popup shows, and what it tells the dropdown that opened it*/
export interface DropDownMenu {
  /**Lines to pick from*/
  lines: readonly FormDropDownSelection[];
  /**Indexes of the lines shown as selected, the first one gets the focus*/
  selected: readonly number[];
  /**True shows check boxes and keeps the popup open when a line is picked, for picking several*/
  multi: boolean;
  /**The user picked the line at the index*/
  pick: (index: number) => void;
  /**The popup closed, focus is true when the dropdown takes the focus back*/
  closed: (focus: boolean) => void;
}

/**The popup of the dropdowns, one per document, showing the menu of the dropdown that opened it*/
class DropDownBox extends Base {
  static element_name() {
    return "dropdownbox";
  }
  static element_name_space(): string {
    return "form";
  }

  #closer: HTMLDivElement = document.createElement("div");
  #container: HTMLDivElement = this.appendChild(document.createElement("div"));
  #scroll: HTMLDivElement = this.#container.appendChild(
    document.createElement("div"),
  );
  #table: HTMLDivElement = this.#scroll.appendChild(
    document.createElement("div"),
  );
  #lines: HTMLDivElement[] = [];
  /**The menu shown, undefined while closed*/
  #menu?: DropDownMenu;
  #focus_out_handler = (e: FocusEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.relatedTarget || !this.contains(e.relatedTarget as Node))
      this.close_menu();
  };
  #window_resize_handler = () => this.close_menu();

  constructor() {
    super();
    this.#container.tabIndex = 0;
    this.#container.onkeydown = (e) => {
      if (e.key === "Escape") this.close_menu();
      else if (e.key === "ArrowUp" || (e.shiftKey && e.key === "Tab")) {
        const elem =
          e.target === this.#container
            ? this.#table.lastElementChild
            : (e.target as HTMLElement).previousElementSibling;
        if (elem) (elem as HTMLElement).focus();
      } else if (e.key === "ArrowDown" || e.key === "Tab") {
        const elem =
          e.target === this.#container
            ? this.#table.firstElementChild
            : (e.target as HTMLElement).nextElementSibling;
        if (elem) (elem as HTMLElement).focus();
      } else {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
    };

    this.#closer.tabIndex = 0;
    this.#closer.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.close_menu();
    };
    this.#closer.onkeydown = (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.stopPropagation();
        e.preventDefault();
        this.close_menu();
      }
    };

    this.addEventListener("focusout", this.#focus_out_handler, {
      capture: true,
    });
  }

  #pick(index: number) {
    const menu = this.#menu;
    if (!menu) return;
    menu.pick(index);
    if (!menu.multi) this.close_menu();
  }

  /**Opens the menu under or over the opener, closing the menu of another dropdown first*/
  open_menu(opener: HTMLElement, menu: DropDownMenu) {
    //Another dropdown opening closes the open one, without focusing it
    this.close_menu(false);
    const inner_height = this.ownerDocument.defaultView?.innerHeight || 0;
    this.classList.add("open");
    const bounds = opener.getBoundingClientRect();
    if (bounds.y + bounds.height / 2 < inner_height / 2) {
      const top = bounds.y + bounds.height;
      this.#container.style.top = top + "px";
      this.#container.style.bottom = "";
      this.#container.style.maxHeight = inner_height - top - 10 + "px";
      this.#container.style.flexDirection = "column";
    } else {
      const bottom = inner_height - bounds.y;
      this.#container.style.top = "";
      this.#container.style.bottom = bottom + "px";
      this.#container.style.maxHeight = inner_height - bottom - 10 + "px";
      this.#container.style.flexDirection = "column-reverse";
    }
    this.#container.style.left = bounds.x + "px";
    this.#container.style.width = bounds.width + "px";
    this.#container.classList.toggle("multi", menu.multi);
    this.#menu = menu;

    this.#lines = menu.lines.map((opt, index) => {
      const line = document.createElement("div");
      //The glyph of the check box is drawn by the stylesheet
      if (menu.multi) line.appendChild(document.createElement("div")).className = "check";
      const icon = line.appendChild(document.createElement("div"));
      if (opt.icon) icon.appendChild(opt.icon());
      const text = line.appendChild(document.createElement("div"));
      text.textContent = opt.text;
      //A press, move and release picks with a mouse, but a multi menu stays open, so its click would pick again
      if (!menu.multi)
        line.onpointerup = (e) => {
          if (e.pointerType !== "touch") this.#pick(index);
        };
      line.onclick = () => this.#pick(index);
      line.tabIndex = 0;
      line.onkeydown = (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          this.#pick(index);
        }
      };
      return line;
    });
    this.#table.replaceChildren(...this.#lines);
    this.#show_selected(menu.selected);

    //Show closer or not
    const box = this.#scroll.getBoundingClientRect();
    const box_area = box.width * box.height;
    const html = this.ownerDocument.documentElement;
    const html_area = html.clientWidth * html.clientHeight;
    if (box_area > html_area * 0.5) {
      this.#closer.replaceChildren();
      //Lines up with the lines, under their check boxes
      if (menu.multi) this.#closer.appendChild(document.createElement("div"));
      this.#closer
        .appendChild(document.createElement("div"))
        .appendChild(material_close_rounded());
      this.#closer.appendChild(document.createElement("div")).textContent =
        "Close";
      this.#table.prepend(this.#closer);
    }

    //Checked after the options are added, so their size is known
    if (this.#scroll.scrollHeight > this.#scroll.clientHeight)
      this.#scroll.classList.add("scroll");
    else this.#scroll.classList.remove("scroll");

    const focus = this.#lines[menu.selected[0]];
    if (focus) focus.focus();
    else this.#container.focus();

    this.ownerDocument.defaultView?.addEventListener(
      "resize",
      this.#window_resize_handler,
      { passive: true },
    );
  }

  /**Shows other lines as selected, when the value of the dropdown of the open menu changed*/
  show_selected(menu: DropDownMenu, selected: readonly number[]) {
    if (menu === this.#menu) this.#show_selected(selected);
  }

  #show_selected(selected: readonly number[]) {
    for (const line of this.#lines) line.classList.remove("selected");
    for (const index of selected) this.#lines[index]?.classList.add("selected");
  }

  /**Closes the menu, only the given one when given, focus true gives the focus back to its dropdown*/
  close_menu(focus: boolean = true, menu?: DropDownMenu) {
    const open = this.#menu;
    if (!open || (menu && menu !== open)) return;
    this.#menu = undefined;
    this.classList.remove("open");
    this.#table.replaceChildren();
    this.#lines = [];
    this.ownerDocument.defaultView?.removeEventListener(
      "resize",
      this.#window_resize_handler,
    );
    open.closed(focus);
  }
}
define_element(DropDownBox);

export type { DropDownBox };

/**One popup per document, so dropdowns in popout windows open in their own window*/
const boxes = new Map<Document, DropDownBox>();
const add_box = (doc: Document): DropDownBox => {
  const box = doc.documentElement.appendChild(new DropDownBox());
  boxes.set(doc, box);
  return box;
};
/**Used for dropdowns in documents not registered with the document handler*/
const main_box = add_box(DOCUMENT_HANDLER.main);
DOCUMENT_HANDLER.for_documents((doc) => {
  if (doc !== DOCUMENT_HANDLER.main) add_box(doc);
});
DOCUMENT_HANDLER.events.on("added", (e) => add_box(e.data));
DOCUMENT_HANDLER.events.on("removed", (e) => boxes.delete(e.data));

/**The popup of the document*/
export function dropdown_box(doc: Document): DropDownBox {
  return boxes.get(doc) ?? main_box;
}
