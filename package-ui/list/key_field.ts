import { Base, define_element } from "#base";
import { array_from_length } from "@chocbite/ts-lib/common";
import { none, some } from "@chocbite/ts-lib/result";
import { state, type State } from "@chocbite/ts-lib/state";
import type { SVGFunc } from "#svg";
import "./key_field.scss";
import type { ListRowParent, ListType } from "./types";

export interface ListKeyFieldOptions {
  /**Icon shown after the sub row opener */
  icon?: SVGFunc | State<SVGFunc>;
  /**Text shown after the icon, an error of a state is shown as the text */
  text?: string | State<string>;
}

export class ListKeyField<A extends ListType<any>> extends Base {
  static element_name() {
    return "keyfield";
  }
  static element_name_space() {
    return "list";
  }

  #opener: HTMLDivElement;
  #text_box?: HTMLSpanElement;
  #icon?: SVGSVGElement;
  #tail?: HTMLElement;

  /**Indent of each depth above the row, its border is the tree line of that depth */
  #indents: HTMLDivElement[];

  /**@param lines whether the tree line of each depth above the row runs on past it, see line*/
  constructor(parent: ListRowParent<A>, lines: readonly boolean[] = []) {
    super();
    this.tabIndex = 0;
    //Places the line down to the sub rows of an open row
    this.style.setProperty("--list-key-depth", String(parent.depth));
    this.onkeydown = (e) => {
      if (parent.key_down?.(e)) e.preventDefault();
      else if (e.key === "Enter" || e.key === " ") parent.open = !parent.open;
      else if (e.key === "ArrowRight") parent.open = true;
      else if (e.key === "ArrowLeft") parent.open = false;
      else if (e.key === "ArrowDown") parent.select_adjacent("next", none());
      else if (e.key === "ArrowUp") parent.select_adjacent("previous", none());
      else return;
      e.preventDefault();
    };

    const opener_box = document.createElement("span");
    opener_box.className = "opener";
    this.#opener = opener_box.appendChild(document.createElement("div"));
    this.#indents = array_from_length(parent.depth, (i) => {
      const div = document.createElement("div");
      if (!lines[i]) div.className = "end";
      return div;
    });
    this.replaceChildren(...this.#indents, opener_box);

    this.#opener.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      parent.open = !parent.open;
    });
  }

  set options(options: ListKeyFieldOptions | undefined) {
    if (state.is.state(options?.icon)) {
      this.attach_state_to_prop("icon", options.icon, () => some(undefined));
    } else this.detach_state_from_prop("icon").icon = options?.icon;
    if (state.is.state(options?.text)) {
      this.attach_state_to_prop("text", options.text, (e) => some(e.nice));
    } else this.detach_state_from_prop("text").text = options?.text;
  }

  set icon(value: SVGFunc | undefined) {
    if (this.#icon) this.#icon.remove();
    this.#icon = undefined;
    this.classList.toggle("has-icon", Boolean(value));
    if (!value) return;
    this.#icon = value();
    this.insertBefore(this.#icon, this.#text_box ?? this.#tail ?? null);
  }

  /**Shows or hides the tree line of a depth above the row, it runs on past the row while the row at that depth has rows after it*/
  line(depth: number, shown: boolean) {
    this.#indents[depth]?.classList.toggle("end", !shown);
  }

  /**Element filling the rest of the key field, the button of an add row or the text of an error
   * A key field with a tail spans from the key column to the end of the row, so it works without value columns */
  set tail(value: HTMLElement | undefined) {
    if (value === this.#tail) return;
    this.#tail?.remove();
    this.#tail = value;
    this.classList.toggle("tail", Boolean(value));
    if (value) this.appendChild(value);
  }
  get tail(): HTMLElement | undefined {
    return this.#tail;
  }

  /**Puts the button or error text of an add row, error row or invalid row after the tree lines
   * Without value columns it is the tail, the key field then runs from the key column to the end of the row, so a list of only the key column works
   * Otherwise it is a cell of its own right after the key field, which stays in its column and stays put when the list scrolls sideways*/
  place_after(element: HTMLElement, value_columns: boolean) {
    if (!value_columns) {
      this.tail = element;
      return;
    }
    if (this.#tail === element) this.tail = undefined;
    this.after(element);
  }

  /**Text after the icon, an empty string removes the text element */
  set text(value: string | undefined) {
    this.classList.toggle("has-text", Boolean(value));
    if (!value) {
      this.#text_box?.remove();
      this.#text_box = undefined;
      return;
    }
    if (!this.#text_box) {
      this.#text_box = document.createElement("span");
      this.#text_box.className = "text";
      this.insertBefore(this.#text_box, this.#tail ?? null);
    }
    this.#text_box.textContent = value;
  }

  //       ____  _____  ______ _   _ _____ _   _  _____
  //      / __ \|  __ \|  ____| \ | |_   _| \ | |/ ____|
  //     | |  | | |__) | |__  |  \| | | | |  \| | |  __
  //     | |  | |  ___/|  __| | . ` | | | | . ` | | |_ |
  //     | |__| | |    | |____| |\  |_| |_| |\  | |__| |
  //      \____/|_|    |______|_| \_|_____|_| \_|\_____|

  /**Highlights the text as found by the search of the list, a class of its own, as search-found on a cell highlights the whole cell */
  set found(value: boolean) {
    this.classList.toggle("search-found-text", value);
  }

  set openable(value: boolean) {
    if (value) this.classList.add("openable");
    else this.classList.remove("openable");
  }
  get openable(): boolean {
    return this.classList.contains("openable");
  }

  /**Hides the opener arrow of a row the user can not open or close, like one following a read only opened state
   * The tree lines show in its place, and an open row keeps its line down to the sub rows */
  set locked(value: boolean) {
    this.classList.toggle("locked", value);
  }
}
define_element(ListKeyField);
