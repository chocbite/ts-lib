import { Base, define_element } from "#base";
import { DOCUMENT_HANDLER } from "#document";
import {
  material_close_rounded,
  material_keyboard_arrow_down_rounded,
  material_unfold_less_rounded,
} from "#icons";
import type { SVGFunc } from "#svg";
import {
  FormSelectorBase,
  type FormSelectorBaseOptions,
  type FormSelectorOption,
} from "../selector_base";
import "./drop_down.scss";

export interface FormDropDownSelection {
  text: string;
  icon?: SVGFunc;
}

export interface FormDropDownOptions<
  RT,
  ID extends string | undefined,
> extends FormSelectorBaseOptions<RT, ID> {
  /**Default text displayed*/
  default?: string;
  /**Default icon displayed*/
  default_icon?: SVGFunc;
}

/**Dropdown box for selecting between multiple choices in a small space*/
export class FormDropdown<
  RT,
  ID extends string | undefined,
> extends FormSelectorBase<RT, ID> {
  static element_name() {
    return "dropdown";
  }
  static element_name_space(): string {
    return "form";
  }

  #map: Map<RT, FormDropDownSelection> = new Map();
  #values: RT[] = [];
  #selected: number = -1;

  #icon?: SVGSVGElement;
  #text: HTMLDivElement = this.appendChild(document.createElement("div"));
  #open: SVGSVGElement = this.appendChild(
    material_keyboard_arrow_down_rounded(),
  );
  #default: Text = document.createTextNode("Select something");
  #default_icon?: SVGFunc;
  /**Popup of the document the dropdown was opened in*/
  #box?: DropDownBox;
  private is_open: boolean = false;

  constructor(id?: ID) {
    super(id);
    this.#text.append(this.#default);
    this.appendChild(this.warn_input);
    this.tabIndex = 0;
    this.onclick = () => (this.open = true);
    this.onpointerdown = (e) => {
      if (e.pointerType === "mouse") {
        this.open = true;
        e.preventDefault();
      }
    };
    this.onkeydown = (e) => {
      switch (e.key) {
        case " ":
        case "Enter":
          e.preventDefault();
          this.open = true;
          break;
        case "ArrowDown":
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          this.#select_adjacent(e.key === "ArrowDown");
          break;
      }
    };
  }

  focus(options?: FocusOptions): void {
    HTMLElement.prototype.focus.call(this, options);
  }

  /**Gets the default text displayed when nothing has been selected yet */
  get default() {
    return this.#default.nodeValue || "";
  }

  /**Sets the default text displayed when nothing has been selected yet */
  set default(def: string) {
    this.#default.nodeValue = def;
  }

  /**Sets the default text displayed when nothing has been selected yet */
  set default_icon(def: SVGFunc | undefined) {
    this.#default_icon = def;
    if (def && this.#selected === -1) this.#set_icon = def;
  }

  set selections(selections: FormSelectorOption<RT>[] | undefined) {
    this.open = false;
    if (this.#map.size > 0) {
      this.#map.clear();
      this.#values = [];
      this.#selected = -1;
    }
    for (let i = 0; selections && i < selections.length; i++) {
      const { value, text, icon } = selections[i];
      this.#map.set(value, { text, icon });
      this.#values.push(value);
    }
    if (this.buffer !== undefined) this.new_value(this.buffer);
  }

  set open(open: boolean) {
    if (open && !this.is_open) {
      const old = this.#open;
      this.#open = material_unfold_less_rounded();
      old.replaceWith(this.#open);
      this.#box = boxes.get(this.ownerDocument) ?? main_box;
      this.#box.open_menu(this.#map, this, this.buffer);
    } else if (!open && this.is_open) {
      const old = this.#open;
      this.#open = material_keyboard_arrow_down_rounded();
      old.replaceWith(this.#open);
      this.#box?.close_menu();
    }
    this.is_open = open;
  }

  /**Changes the icon of the button*/
  set #set_icon(icon: SVGFunc | undefined) {
    if (icon) {
      const i = icon();
      if (this.#icon) this.replaceChild(i, this.#icon);
      else this.insertBefore(i, this.#text);
      this.#icon = i;
    } else if (this.#icon) {
      this.removeChild(this.#icon);
      this.#icon = undefined;
    }
  }

  /**Selects the previous or next selection in the element
   * @param dir false is next true is previous*/
  #select_adjacent(dir: boolean) {
    const y = Math.min(
      this.#values.length - 1,
      Math.max(0, dir ? this.#selected + 1 : this.#selected - 1),
    );
    if (y !== this.#selected) this.set_value_check(this.#values[y]);
  }

  #clear() {
    this.default_icon = this.#default_icon
      ? (this.#set_icon = this.#default_icon)
      : (this.#set_icon = undefined);
    this.#text.replaceChildren(this.#default);
  }

  /**Called when Value is changed */
  protected new_value(value: RT) {
    if (!this.#map.has(value)) {
      this.#clear();
      this.#selected = -1;
      return;
    }
    const opt = this.#map.get(value)!;
    this.#text.innerText = opt.text;
    this.#selected = this.#values.indexOf(value);
    if (opt.icon) this.#set_icon = opt.icon;
    else this.#set_icon = undefined;
  }

  protected clear_value(): void {
    this.#clear();
  }

  protected new_error(_val: string): void {}

  protected clear_error(): void {}

  warn(message: string): void {
    setTimeout(() => {
      super.warn(message);
    }, 0);
  }
}
define_element(FormDropdown);

/**Creates a dropdown form element */
export function form_dropdown<RT, ID extends string | undefined>(
  options?: FormDropDownOptions<RT, ID>,
): FormDropdown<RT, ID> {
  const drop = new FormDropdown<RT, ID>(options?.id);
  if (options) {
    if (options.default) drop.default = options.default;
    if (options.default_icon) drop.default_icon = options.default_icon;
    FormSelectorBase.apply_options(drop, options);
  }
  return drop;
}

///##################################################################################################
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
  #dropdown: FormDropdown<any, any> | undefined;
  #focus_out_handler = (e: FocusEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.relatedTarget || !this.contains(e.relatedTarget as Node))
      this.close_menu();
  };
  #window_resize_handler = () => this.close_menu();
  #is_open: boolean = false;

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

    this.#closer
      .appendChild(document.createElement("div"))
      .appendChild(material_close_rounded());
    this.#closer.appendChild(document.createElement("div")).textContent =
      "Close";
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

  #set_value(value: unknown) {
    //@ts-expect-error Call private method from sister class
    if (this.#dropdown) this.#dropdown.set_value_check(value);
    this.close_menu();
  }

  open_menu(
    map: Map<any, FormDropDownSelection>,
    parent: FormDropdown<any, any>,
    value: any,
  ) {
    //Another dropdown opening closes the open one, without focusing it
    if (this.#is_open) this.close_menu(false);
    const inner_height = this.ownerDocument.defaultView?.innerHeight || 0;
    this.classList.add("open");
    const bounds = parent.getBoundingClientRect();
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
    this.#dropdown = parent;

    let focus: HTMLElement | undefined = undefined as HTMLElement | undefined;
    this.#table.replaceChildren(
      ...Array.from(map).map(([val, opt]) => {
        const line = document.createElement("div");
        const icon = line.appendChild(document.createElement("div"));
        if (opt.icon) icon.appendChild(opt.icon());
        const text = line.appendChild(document.createElement("div"));
        text.textContent = opt.text;
        line.onpointerup = (e) => {
          if (e.pointerType !== "touch") this.#set_value(val);
        };
        line.onclick = () => this.#set_value(val);
        line.tabIndex = 0;
        line.onkeydown = (e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            this.#set_value(val);
          }
        };
        if (val === value) focus = line;
        return line;
      }),
    );

    //Show closer or not
    const box = this.#scroll.getBoundingClientRect();
    const box_area = box.width * box.height;
    const html = this.ownerDocument.documentElement;
    const html_area = html.clientWidth * html.clientHeight;
    if (box_area > html_area * 0.5) {
      this.#table.prepend(this.#closer);
    }

    //Checked after the options are added, so their size is known
    if (this.#scroll.scrollHeight > this.#scroll.clientHeight)
      this.#scroll.classList.add("scroll");
    else this.#scroll.classList.remove("scroll");

    if (focus) {
      focus.focus();
      focus.classList.add("selected");
    } else this.#container.focus();

    this.ownerDocument.defaultView?.addEventListener(
      "resize",
      this.#window_resize_handler,
      { passive: true },
    );
    this.#is_open = true;
  }

  close_menu(focus: boolean = true) {
    if (!this.#is_open) return;
    this.#is_open = false;
    if (this.#dropdown) this.#dropdown.open = false;
    this.classList.remove("open");
    this.#table.replaceChildren();
    if (this.#dropdown) {
      if (focus) this.#dropdown.focus();
      //@ts-expect-error Overwrite private property from sister class
      this.#dropdown.is_open = false;
    }
    this.ownerDocument.defaultView?.removeEventListener(
      "resize",
      this.#window_resize_handler,
    );
  }
}
define_element(DropDownBox);

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
