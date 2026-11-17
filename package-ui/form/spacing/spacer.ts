import {
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import { FormElement } from "../base";
import "../shared";
import "./spacer.scss";

/**Inputs of the spacer*/
const SPACER = {
  /**Height of the space in rem, an error gives no height*/
  space: input_key<StateOrVal<number>>(),
};
export type FormSpacerOptions = BaseOptions & InputOptions<typeof SPACER>;

/**Empty space between form elements*/
class FormSpacer extends FormElement {
  static element_name() {
    return "spacer";
  }
  static element_name_space(): string {
    return "form";
  }

  set(options: FormSpacerOptions): this {
    super.set(options);
    this.set_input(SPACER.space, options.space, (space) => {
      this.style.height = space.ok ? `${space.value}rem` : "";
    });
    return this;
  }
}
define_element(FormSpacer);

export type { FormSpacer };

/**Creates empty space between form elements*/
export function form_spacer(options: FormSpacerOptions = {}): FormSpacer {
  return FormSpacer.create(options);
}
