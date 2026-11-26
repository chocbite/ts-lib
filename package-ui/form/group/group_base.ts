import { AccessTypes, input_key, type InputOptions } from "#base";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import {
  FormElement,
  FormValueWrite,
  type FormValueWriteOptions,
} from "../base";
import "./group_base.scss";
import "./group.scss";

/**Different border styles for the component group*/
export const FormGroupBorderStyle = {
  None: "none",
  Inset: "inset",
  Outset: "outset",
  Line: "line",
} as const;
export type FormGroupBorderStyle =
  (typeof FormGroupBorderStyle)[keyof typeof FormGroupBorderStyle];

/**Inputs of groups*/
const GROUP_BASE = {
  /**Border around the group, none by default*/
  border: input_key<StateOrVal<FormGroupBorderStyle>>(),
  /**Removes the padding, so groups in groups do not build up padding*/
  embed: input_key<StateOrVal<boolean>>(),
  /**Highest height in rem, it scrolls beyond, 0 for no limit*/
  max_height: input_key<StateOrVal<number>>(),
  /**Columns, true is one column, a width like "10rem" repeats columns at least that wide, an array gives exactly those columns*/
  column: input_key<StateOrVal<true | string | string[]>>(),
  /**Rows, works like column, a group has either columns or rows*/
  row: input_key<StateOrVal<true | string | string[]>>(),
};
/**Options of a group with the value V, the look and layout every group has*/
export type FormGroupBaseOptions<V> = FormValueWriteOptions<V> &
  InputOptions<typeof GROUP_BASE>;

/**Base of the groups, laying out elements in columns or rows, its value is made from the values of its elements*/
export abstract class FormGroupBase<
  V,
  ID extends string | undefined,
> extends FormValueWrite<V, ID> {
  static element_name() {
    return "@abstract@";
  }
  static element_name_space(): string {
    return "form";
  }

  #elements: FormElement[] = [];

  constructor() {
    super();
    this.classList.add("flex-col");
  }

  set(options: FormGroupBaseOptions<V>): this {
    super.set(options);
    this.set_input(GROUP_BASE.border, options.border, (border) => {
      this.classList.remove(
        FormGroupBorderStyle.Inset,
        FormGroupBorderStyle.Outset,
        FormGroupBorderStyle.Line,
      );
      if (border.ok && border.value !== FormGroupBorderStyle.None)
        this.classList.add(border.value);
    });
    this.set_input(GROUP_BASE.max_height, options.max_height, (height) => {
      const max = height.ok ? height.value : 0;
      this.style.setProperty("--max_height", max ? max + "rem" : "none");
      this.classList.toggle("max_height", max > 0);
    });
    this.set_input(GROUP_BASE.embed, options.embed, (embed) => {
      this.classList.toggle("embed", embed.ok && embed.value);
    });
    this.set_input(GROUP_BASE.column, options.column, (column) => {
      if (column.ok) this.#layout("col", column.value);
    });
    this.set_input(GROUP_BASE.row, options.row, (row) => {
      if (row.ok) this.#layout("row", row.value);
    });
    return this;
  }

  #layout(direction: "col" | "row", layout: true | string | string[]) {
    this.classList.remove("grid-row", "grid-col", "flex-row", "flex-col");
    this.style.gridTemplateColumns = "";
    this.style.gridTemplateRows = "";
    if (layout === true) {
      this.classList.add("flex-" + direction);
      return;
    }
    this.classList.add("grid-" + direction);
    const template =
      typeof layout === "string"
        ? "repeat(auto-fit, minmax(" + layout + ", 1fr))"
        : layout.map((size) => "minmax(" + size + ", 1fr)").join(" ");
    if (direction === "col") this.style.gridTemplateColumns = template;
    else this.style.gridTemplateRows = template;
  }

  /**All elements of the group, also those that are not part of its value*/
  get elements(): FormElement[] {
    return [...this.#elements];
  }

  /**Shows the elements in order, elements the group has already are not moved unless their order changed,
   * as moving an element takes it out of the document and back, losing the focus of a field the user is typing in
   * @param after a child of the group the elements come after, like a bar in front of them, undefined for none*/
  protected place_elements(
    elements: readonly FormElement[],
    after?: ChildNode,
  ): void {
    const keep = new Set(elements);
    for (const element of this.#elements)
      if (!keep.has(element) && element.parentNode === this) element.remove();
    //The fault icon of the group stays after the elements
    let next: ChildNode | null = after ? after.nextSibling : this.firstChild;
    for (const element of elements)
      if (element === next) next = next.nextSibling;
      else this.insertBefore(element, next);
    this.#elements = [...elements];
  }

  protected state_related(_related: {}): void {}

  protected on_access(access: AccessTypes): void {
    switch (access) {
      case AccessTypes.Read: {
        this.tabIndex = 0;
        this.onfocus = () => document.body.focus();
        break;
      }
      case AccessTypes.Write: {
        this.removeAttribute("tabIndex");
        this.onfocus = null;
        break;
      }
    }
  }
}
