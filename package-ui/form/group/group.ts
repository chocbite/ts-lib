import { CREATE, define_element, input_key, type InputOptions } from "#base";
import { type Prettify } from "@chocbite/ts-lib/common";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import {
  FormElement,
  FormValueWrite,
  type FormValueCreateOptions,
} from "../base";
import "./group.scss";
import {
  FormGroupBase,
  type FormGroupBaseOptions,
  GroupExtractVals,
  GroupToKeyVal,
} from "./group_base";

/**Inputs of the group*/
const GROUP = {
  /**Columns, true is one column, a width like "10rem" repeats columns at least that wide, an array gives exactly those columns*/
  column: input_key<StateOrVal<true | string | string[]>>(),
  /**Rows, works like column, a group has either columns or rows*/
  row: input_key<StateOrVal<true | string | string[]>>(),
};
export type FormGroupOptions<T extends object> = FormGroupBaseOptions<T> &
  InputOptions<typeof GROUP>;
export type FormGroupCreateOptions<
  L extends FormElement[],
  ID extends string | undefined,
  T extends object,
> = FormGroupOptions<T> &
  FormValueCreateOptions<ID> & {
    /**Elements of the group, given at creation as their ids decide the value of the group*/
    elements?: [...L];
  };

/**Group of form elements, laying them out in columns or rows, its value is the values of the elements by id*/
class FormGroup<
  RT extends object = object,
  ID extends string | undefined = string | undefined,
  Elements extends FormElement[] = FormValueWrite<any, string>[],
> extends FormGroupBase<RT, ID, Elements> {
  static element_name() {
    return "group";
  }
  static element_name_space(): string {
    return "form";
  }

  #elements: FormElement[] = [];

  constructor() {
    super();
    this.classList.add("flex-col");
  }

  [CREATE](options: { elements?: FormElement[] } & FormValueCreateOptions<ID>) {
    super[CREATE](options);
    for (const element of options.elements ?? []) {
      const id: unknown =
        element instanceof FormValueWrite ? element.form_id : undefined;
      if (typeof id === "string") {
        if (this._value_elements.has(id)) {
          console.error(
            "Form element with form id " + id + " already exists in group",
          );
          continue;
        }
        this._value_elements.set(id, element as FormValueWrite<any, any>);
      }
      this.#elements.push(this.appendChild(element));
    }
  }

  set(options: FormGroupOptions<RT>): this {
    super.set(options);
    this.set_input(GROUP.column, options.column, (column) => {
      if (column.ok) this.#layout("col", column.value);
    });
    this.set_input(GROUP.row, options.row, (row) => {
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

  /**All elements of the group, also those without a form id*/
  get elements(): FormElement[] {
    return [...this.#elements];
  }
}
define_element(FormGroup);

export type { FormGroup };

/**Creates a group of form elements, its value is typed by the ids of the elements*/
export function form_group<
  L extends FormElement[],
  ID extends string | undefined = undefined,
  T extends object = Prettify<GroupToKeyVal<GroupExtractVals<L>>>,
>(options: FormGroupCreateOptions<L, ID, T> = {}): FormGroup<T, ID, L> {
  return FormGroup.create(options) as FormGroup<T, ID, L>;
}
