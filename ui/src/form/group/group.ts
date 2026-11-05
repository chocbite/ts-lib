import { define_element } from "#base";
import { type Prettify } from "@chocbite/ts-lib/common";
import { FormElement, FormValueWrite, FormValueWriteOptions } from "../base";
import "./group.scss";
import {
  FormGroupBase,
  FormGroupBorderStyle,
  GroupExtractVals,
  GroupToKeyVal,
} from "./group_base";

export interface FormGroupOptions<
  L extends FormElement[],
  ID extends string | undefined,
  T,
> extends FormValueWriteOptions<Partial<T>, ID> {
  /**Elements to add to the group*/
  elements?: [...L];
  /**Border style for group*/
  border?: FormGroupBorderStyle;
  /**Removes padding when true allows for putting groups in groups without padding building up */
  embed?: boolean;
  /**Group max height in rem, undefined means no limit*/
  max_height?: number;
  /**Columns, true is everything in one columns, just a number will make repeating columns of minimum that rem width, an array will make exactly that many colums with specified rem widths */
  column?: true | string | string[];
  /**Rows, true is everything in one row, just a number will make repeating rows of minimum that rem height, an array will make exactly that many rows with specified rem heights */
  row?: true | string | string[];
}

/**Component group class which allows to add elements and controls the flow of the elements*/
export class FormGroup<
  RT extends object,
  ID extends string | undefined,
  Elements extends FormElement[] = FormValueWrite<any, string>[],
> extends FormGroupBase<RT, ID, Elements> {
  static element_name() {
    return "group";
  }
  static element_name_space(): string {
    return "form";
  }

  constructor(id?: ID) {
    super(id);
    this.classList.add("flex-col");
  }

  set column(column: true | string | string[]) {
    this.classList.remove("grid-row", "grid-col", "flex-row", "flex-col");
    if (column === true) {
      this.classList.add("flex-col");
    } else {
      this.classList.add("grid-col");

      if (typeof column === "string") {
        this.style.gridTemplateColumns =
          "repeat(auto-fit, minmax(" + column + ", 1fr))";
      } else {
        this.style.gridTemplateColumns = column
          .map((col) => "minmax(" + col + ", 1fr)")
          .join(" ");
      }
    }
  }

  set row(row: true | string | string[]) {
    this.classList.remove("grid-row", "grid-col", "flex-row", "flex-col");
    if (row === true) {
      this.classList.add("flex-row");
    } else {
      this.classList.add("grid-row");
      if (typeof row === "string") {
        this.style.gridTemplateRows =
          "repeat(auto-fit, minmax(" + row + ", 1fr))";
      } else {
        this.style.gridTemplateRows = row
          .map((col) => "minmax(" + col + ", 1fr)")
          .join(" ");
      }
    }
  }

  set elements(elements: FormElement[]) {
    for (let i = 0, n = elements.length; i < n; i++) {
      const comp = elements[i];
      if (comp instanceof FormValueWrite && comp.form_id) {
        if (this._value_elements.has(comp.form_id as string)) {
          console.error(
            "Form element with form id " +
              comp.form_id +
              " already exists in group",
          );
          continue;
        }
        this._value_elements.set(comp.form_id as string, comp);
      }
      this.appendChild(comp);
    }
  }

  get elements(): FormElement[] {
    return [...this._value_elements.values()];
  }
}
define_element(FormGroup);

/**Creates a form group with elements */
export function form_group<
  L extends FormElement[],
  ID extends string | undefined,
  T extends object = Prettify<GroupToKeyVal<GroupExtractVals<L>>>,
>(options?: FormGroupOptions<L, ID, T>): FormGroup<T, ID, L> {
  const group = new FormGroup<T, ID, L>(options?.id);
  if (options) {
    if (options.border) group.border = options.border;
    if (options.elements) group.elements = options.elements;
    if (options.max_height) group.max_height = options.max_height;
    if (options.embed) group.embed = options.embed;
    if (options.column) group.column = options.column;
    else if (options.row) group.row = options.row;
    FormValueWrite.apply_options(group, options);
  }
  return group;
}
