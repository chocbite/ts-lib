import { define_element, input_key, type InputOptions } from "#base";
import type { Option } from "@chocbite/ts-lib/result";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import {
  FormValueWrite,
  type FormValueCreateOptions,
  type FormValueWriteOptions,
} from "../../base";
import "./color_input.scss";

/**Inputs of the color input*/
const COLOR = {
  /**True writes the color while the user picks it, false only when the picker closes*/
  live: input_key<StateOrVal<boolean>>(),
};
export type FormColorOptions = FormValueWriteOptions<string> &
  InputOptions<typeof COLOR>;
export type FormColorCreateOptions<ID extends string | undefined> =
  FormColorOptions & FormValueCreateOptions<ID>;

/**Color input, the value is a hex color like #ff8800*/
class FormColor<
  ID extends string | undefined = string | undefined,
> extends FormValueWrite<string, ID> {
  static element_name() {
    return "colorinput";
  }
  static element_name_space(): string {
    return "form";
  }

  #live: boolean = false;

  constructor() {
    super();
    this.appendChild(this.warn_input);
    this.warn_input.type = "color";
    this.warn_input.oninput = () => {
      if (this.#live) this.set_value_check(this.warn_input.value);
    };
    this.warn_input.onchange = () => {
      if (!this.#live) this.set_value_check(this.warn_input.value);
    };
  }

  set(options: FormColorOptions): this {
    super.set(options);
    this.set_input(COLOR.live, options.live, (live) => {
      this.#live = live.ok && live.value;
    });
    return this;
  }

  protected new_value(val: string): void {
    this.warn_input.value = val;
  }

  protected clear_value(): void {
    this.warn_input.value = "#000000";
  }

  protected state_related(_related: Option<{}>): void {}
}
define_element(FormColor);

export type { FormColor };

/**Creates a color input, the value is a hex color like #ff8800*/
export function form_color<ID extends string | undefined = undefined>(
  options: FormColorCreateOptions<ID> = {},
): FormColor<ID> {
  return FormColor.create(options) as FormColor<ID>;
}
