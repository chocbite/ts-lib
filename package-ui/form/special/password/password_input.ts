import { define_element, input_key, type InputOptions } from "#base";
import type { Option } from "@chocbite/ts-lib/result";
import {
  FormValueWrite,
  type FormValueCreateOptions,
  type FormValueWriteOptions,
} from "../../base";
import "./password_input.scss";

/**Inputs of the password input*/
const PASSWORD = {
  /**Characters the user can type, others are refused with a warning*/
  filter: input_key<RegExp>(),
};
export type FormPasswordOptions = FormValueWriteOptions<string> &
  InputOptions<typeof PASSWORD>;
export type FormPasswordCreateOptions<ID extends string | undefined> =
  FormPasswordOptions & FormValueCreateOptions<ID>;

/**Password input, the text is hidden and cleared when the user starts typing*/
class FormPassword<
  ID extends string | undefined = string | undefined,
> extends FormValueWrite<string, ID> {
  static element_name() {
    return "passwordinput";
  }
  static element_name_space(): string {
    return "form";
  }

  #filter?: RegExp;

  constructor() {
    super();
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

  set(options: FormPasswordOptions): this {
    super.set(options);
    this.set_input(PASSWORD.filter, options.filter, (filter) => {
      this.#filter = filter.value;
    });
    return this;
  }

  protected new_value(val: string): void {
    this.warn_input.value = val;
  }

  protected clear_value(): void {
    this.warn_input.value = "";
  }

  protected state_related(_related: Option<{}>): void {}
}
define_element(FormPassword);

export type { FormPassword };

/**Creates a password input*/
export function form_password<ID extends string | undefined = undefined>(
  options: FormPasswordCreateOptions<ID> = {},
): FormPassword<ID> {
  return FormPassword.create(options) as FormPassword<ID>;
}
