import { Base, define_element } from "#base";
import { array_from_length } from "@chocbite/ts-lib/common";
import { none, some } from "@chocbite/ts-lib/result";
import { state, type State } from "@chocbite/ts-lib/state";
import type { SVGFunc } from "#svg";
import "./key_field.scss";
import type { ListRowParent, ListType } from "./types";

export interface ListKeyFieldOptions {
  icon?: SVGFunc | State<SVGFunc>;
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

  constructor(parent: ListRowParent<A>) {
    super();
    this.tabIndex = 0;
    this.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") parent.open = !parent.open;
      else if (e.key === "ArrowRight") parent.open = true;
      else if (e.key === "ArrowLeft") parent.open = false;
      else if (e.key === "ArrowDown") parent.select_adjacent("next", none());
      else if (e.key === "ArrowUp") parent.select_adjacent("previous", none());
      else return;
      e.preventDefault();
    };

    const opener_box = document.createElement("span");
    this.#opener = opener_box.appendChild(document.createElement("div"));
    this.replaceChildren(
      ...array_from_length(parent.depth, (i) => {
        const div = document.createElement("div");
        div.style.borderColor = "var(--i-" + i + ")";
        return div;
      }),
      opener_box,
    );

    this.#opener.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      parent.open = !parent.open;
    });
  }

  set options(options: ListKeyFieldOptions | undefined) {
    if (state.is.state(options?.icon)) {
      this.attach_state_to_prop("icon", options.icon, () => some(undefined));
    } else this.icon = options?.icon;
  }

  set icon(value: SVGFunc | undefined) {
    if (this.#icon) this.#icon.remove();
    this.#icon = undefined;
    if (!value) return;
    this.#icon = value();
    if (this.#text_box) this.insertBefore(this.#icon, this.#text_box);
    else this.appendChild(this.#icon);
  }

  //       ____  _____  ______ _   _ _____ _   _  _____
  //      / __ \|  __ \|  ____| \ | |_   _| \ | |/ ____|
  //     | |  | | |__) | |__  |  \| | | | |  \| | |  __
  //     | |  | |  ___/|  __| | . ` | | | | . ` | | |_ |
  //     | |__| | |    | |____| |\  |_| |_| |\  | |__| |
  //      \____/|_|    |______|_| \_|_____|_| \_|\_____|

  set openable(value: boolean) {
    if (value) this.classList.add("openable");
    else this.classList.remove("openable");
  }
  get openable(): boolean {
    return this.classList.contains("openable");
  }
}
define_element(ListKeyField);
