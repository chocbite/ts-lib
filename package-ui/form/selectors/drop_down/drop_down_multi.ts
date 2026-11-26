import { define_element, input_key, type InputOptions } from "#base";
import { sync_resolve } from "@chocbite/ts-lib/common";
import { err_nice, type ResultNice } from "@chocbite/ts-lib/result";
import { state, type StateOrVal } from "@chocbite/ts-lib/state";
import { FormSetting, type FormValueCreateOptions } from "../../base";
import type { FormSelectorOptions } from "../selector_base";
import { FormDropDownBase } from "./drop_down_base";

/**Inputs of the multi dropdown*/
const DROPDOWN_MULTI = {
  /**Text shown while nothing is selected, an error shows its nice text*/
  default: input_key<StateOrVal<string>>(),
  /**Fewest selections the user can leave selected, 0 for no limit*/
  min: input_key<StateOrVal<number>>(),
  /**Most selections the user can select, 0 for no limit*/
  max: input_key<StateOrVal<number>>(),
};
export type FormDropDownMultiOptions<RT> = FormSelectorOptions<RT, RT[]> &
  InputOptions<typeof DROPDOWN_MULTI>;
export type FormDropDownMultiCreateOptions<
  RT,
  ID extends string | undefined,
> = FormDropDownMultiOptions<RT> & FormValueCreateOptions<ID>;

/**Dropdown for selecting several of the selections in a small space, the value is the selected ones in the order of the selections*/
class FormDropdownMulti<
  RT,
  ID extends string | undefined = string | undefined,
> extends FormDropDownBase<RT, ID, RT[]> {
  static element_name() {
    return "dropdownmulti";
  }
  static element_name_space(): string {
    return "form";
  }

  protected readonly multi = true;
  /**Indexes of the selected selections, in their order*/
  #selected: number[] = [];
  #default: Text = document.createTextNode("Select something");
  #min = new FormSetting<number>(() => {});
  #max = new FormSetting<number>(() => {});

  constructor() {
    super();
    this._text.append(this.#default);
  }

  set(options: FormDropDownMultiOptions<RT>): this {
    super.set(options);
    this.set_input(DROPDOWN_MULTI.default, options.default, (text) => {
      this.#default.nodeValue = text.ok ? text.value : text.error.nice;
    });
    this.set_input(DROPDOWN_MULTI.min, options.min, (min) =>
      this.#min.input(min.ok ? min.value : undefined),
    );
    this.set_input(DROPDOWN_MULTI.max, options.max, (max) =>
      this.#max.input(max.ok ? max.value : undefined),
    );
    return this;
  }

  /**Selections, min and max come from the options*/
  protected state_related(_related: {}): void {}

  protected selected_lines(): number[] {
    return this.#selected;
  }

  /**Selects or unselects the selection, the value is what the popup shows,
   * in the order of the selections, values not in the selections are left out*/
  protected pick(index: number): void {
    const value = this._values[index];
    const now = new Set(this._buffer);
    const on = !now.has(value);
    void this.set_value_check(
      this._values.filter((val) => (val === value ? on : now.has(val))),
    );
  }

  protected check_value(val: RT[]): PromiseLike<ResultNice<RT[]>> {
    const max = this.#max.value;
    if (max && val.length > max)
      return sync_resolve(
        err_nice(
          state.errors.TOO_MANY_VALUES,
          `At most ${max} can be selected`,
        ),
      );
    const min = this.#min.value;
    if (min && val.length < min)
      return sync_resolve(
        err_nice(
          state.errors.TOO_FEW_VALUES,
          `At least ${min} must be selected`,
        ),
      );
    return super.check_value(val);
  }

  protected new_value(value: RT[]): void {
    //A state can give the values in another order, or one twice
    const selected = new Set<number>();
    for (const val of value) {
      const index = this._index.get(val);
      if (index !== undefined) selected.add(index);
    }
    this.#selected = [...selected].sort((a, b) => a - b);
    if (this.#selected.length === 0) this._text.replaceChildren(this.#default);
    else
      this._text.textContent = this.#selected
        .map((index) => this._lines[index].text)
        .join(", ");
    this.update_menu();
  }

  protected clear_value(): void {
    this.#selected = [];
    this._text.replaceChildren(this.#default);
    this.update_menu();
  }
}
define_element(FormDropdownMulti);

export type { FormDropdownMulti };

/**Creates a multi dropdown, selecting several of the selections in little space
 * The value is the selected ones, in the order of the selections*/
export function form_dropdown_multi<
  RT,
  ID extends string | undefined = undefined,
>(
  options: FormDropDownMultiCreateOptions<RT, ID> = {},
): FormDropdownMulti<RT, ID> {
  //create can not carry the value type of a generic class, the options are checked by this function
  return FormDropdownMulti.create(options as never) as FormDropdownMulti<
    RT,
    ID
  >;
}
