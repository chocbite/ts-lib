import { define_element } from "#base";
import type { Option } from "@chocbite/ts-lib/result";
import { FormValueWrite, FormValueWriteOptions } from "../../base";
import "./password_input.scss";

export interface FormPasswordOptions<
  ID extends string | undefined,
> extends FormValueWriteOptions<string, ID> {
  /**Allowed characters for the password input */
  filter?: RegExp;
}

export class FormPassword<ID extends string | undefined> extends FormValueWrite<
  string,
  ID
> {
  static element_name() {
    return "passwordinput";
  }
  static element_name_space(): string {
    return "form";
  }

  #filter?: RegExp;

  constructor(id?: ID) {
    super(id);
    this.appendChild(this.warn_input);
    this.warn_input.type = "password";
    this.warn_input.onfocus = () => {
      this.warn_input.value = "";
      this.selected = true;
    };
    this.warn_input.onblur = () => {
      this.selected = false;
      //Restores the password when nothing new was entered, or shows a state change made while focused
      if (this._buffer !== undefined && this.warn_input.value !== this._buffer)
        this.new_value(this._buffer);
    };
    this.warn_input.onchange = () => {
      this.set_value_check(this.warn_input.value);
    };
    this.warn_input.onbeforeinput = (ev) => {
      if (ev.data && this.#filter) {
        this.#filter.lastIndex = 0;
        if (!this.#filter.test(ev.data)) {
          ev.preventDefault();
          this.warn("Invalid character entered");
        }
      }
    };
  }

  set filter(val: RegExp | undefined) {
    this.#filter = val;
  }

  protected new_value(val: string): void {
    this.warn_input.value = val;
  }

  protected clear_value(): void {
    this.warn_input.value = "";
  }

  protected new_error(_val: string): void {}

  protected clear_error(): void {}

  protected state_related(_related: Option<{}>): void {}
}
define_element(FormPassword);

/**Creates a password input form element */
export function form_password<ID extends string | undefined>(
  options?: FormPasswordOptions<ID>,
): FormPassword<ID> {
  const input = new FormPassword<ID>(options?.id);
  if (options) {
    if (options.filter) input.filter = options.filter;
    FormValueWrite.apply_options(input, options);
  }
  return input;
}
