import { define_element, input_key, type InputOptions } from "#base";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import type { SVGFunc } from "#svg";
import type { FormValueCreateOptions } from "../../base";
import type { FormSelectorOptions } from "../selector_base";
import { FormDropDownBase } from "./drop_down_base";

export type { FormDropDownSelection } from "./box";

/**Inputs of the dropdown*/
const DROPDOWN = {
  /**Text shown while nothing is selected, an error shows its nice text*/
  default: input_key<StateOrVal<string>>(),
  /**Icon shown while nothing is selected, undefined for none*/
  default_icon: input_key<StateOrVal<SVGFunc | undefined>>(),
};
export type FormDropDownOptions<RT> = FormSelectorOptions<RT> &
  InputOptions<typeof DROPDOWN>;
export type FormDropDownCreateOptions<
  RT,
  ID extends string | undefined,
> = FormDropDownOptions<RT> & FormValueCreateOptions<ID>;

/**Dropdown box for selecting between multiple choices in a small space*/
class FormDropdown<
  RT,
  ID extends string | undefined = string | undefined,
> extends FormDropDownBase<RT, ID, RT> {
  static element_name() {
    return "dropdown";
  }
  static element_name_space(): string {
    return "form";
  }

  protected readonly multi = false;
  #selected: number = -1;
  #icon?: SVGSVGElement;
  #default: Text = document.createTextNode("Select something");
  #default_icon?: SVGFunc;

  constructor() {
    super();
    this._text.append(this.#default);
  }

  set(options: FormDropDownOptions<RT>): this {
    super.set(options);
    this.set_input(DROPDOWN.default, options.default, (text) => {
      this.#default.nodeValue = text.ok ? text.value : text.error.nice;
    });
    this.set_input(DROPDOWN.default_icon, options.default_icon, (icon) => {
      this.#default_icon = icon.ok ? icon.value : undefined;
      if (this.#selected === -1) this.#set_icon = this.#default_icon;
    });
    return this;
  }

  protected key(e: KeyboardEvent): void {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      this.#select_adjacent(e.key === "ArrowDown");
    }
  }

  protected selected_lines(): number[] {
    return this.#selected === -1 ? [] : [this.#selected];
  }

  protected pick(index: number): void {
    void this.set_value_check(this._values[index]);
  }

  /**Changes the icon of the button*/
  set #set_icon(icon: SVGFunc | undefined) {
    if (icon) {
      const i = icon();
      if (this.#icon) this.replaceChild(i, this.#icon);
      else this.insertBefore(i, this._text);
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
      this._values.length - 1,
      Math.max(0, dir ? this.#selected + 1 : this.#selected - 1),
    );
    if (y !== this.#selected) void this.set_value_check(this._values[y]);
  }

  #clear() {
    this.#set_icon = this.#default_icon;
    this._text.replaceChildren(this.#default);
  }

  /**Called when Value is changed */
  protected new_value(value: RT) {
    const index = this._index.get(value);
    if (index === undefined) {
      this.#clear();
      this.#selected = -1;
      return;
    }
    const opt = this._lines[index];
    this._text.innerText = opt.text;
    this.#selected = index;
    if (opt.icon) this.#set_icon = opt.icon;
    else this.#set_icon = undefined;
  }

  protected clear_value(): void {
    this.#clear();
    this.#selected = -1;
  }
}
define_element(FormDropdown);

export type { FormDropdown };

/**Creates a dropdown, choosing one of the selections in little space*/
export function form_dropdown<RT, ID extends string | undefined = undefined>(
  options: FormDropDownCreateOptions<RT, ID> = {},
): FormDropdown<RT, ID> {
  //create can not carry the value type of a generic class, the options are checked by this function
  return FormDropdown.create(options as never) as FormDropdown<RT, ID>;
}
