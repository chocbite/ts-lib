import { define_element } from "#base";
import type { Option } from "@chocbite/ts-lib/result";
import { FormValueWrite, FormValueWriteOptions } from "../../base";
import "./color_input.scss";

export interface FormColorOptions<
  ID extends string | undefined,
  RT = string,
> extends FormValueWriteOptions<RT, ID> {
  /**Whether the color input should update live*/
  live?: boolean;
}

export class FormColor<ID extends string | undefined> extends FormValueWrite<
  string,
  ID
> {
  static element_name() {
    return "colorinput";
  }
  static element_name_space(): string {
    return "form";
  }

  #live: boolean = false;

  constructor(id?: ID) {
    super(id);
    this.appendChild(this.warn_input);
    this.warn_input.type = "color";
    this.warn_input.oninput = () => {
      if (this.#live) this.set_value_check(this.warn_input.value);
    };
    this.warn_input.onchange = () => {
      if (!this.#live) this.set_value_check(this.warn_input.value);
    };
  }

  set live(val: boolean) {
    this.#live = val;
  }
  get live(): boolean {
    return this.#live;
  }

  protected new_value(val: string): void {
    this.warn_input.value = val;
  }

  protected clear_value(): void {
    this.warn_input.value = "#000000";
  }

  protected new_error(_val: string): void {}

  protected clear_error(): void {}

  protected state_related(_related: Option<{}>): void {}
}
define_element(FormColor);

/**Creates a color input form element */
export function form_color<ID extends string | undefined>(
  options?: FormColorOptions<ID, string>,
): FormColor<ID> {
  const input = new FormColor<ID>(options?.id);
  if (options) {
    if (options.live) input.live = options.live;
    FormValueWrite.apply_options(input, options);
  }
  return input;
}
