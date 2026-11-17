import {
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import { FormElement } from "../../base";
import "./text.scss";

/**Inputs of the text*/
const TEXT = {
  /**Text shown, an error shows its nice text*/
  text: input_key<StateOrVal<string>>(),
  /**Font size in rem, not given the size of form text, an error gives that size*/
  size: input_key<StateOrVal<number>>(),
};
export type FormTextOptions = BaseOptions & InputOptions<typeof TEXT>;

/**Simple text, like a label in front of a form element*/
class FormText extends FormElement {
  static element_name() {
    return "text";
  }
  static element_name_space(): string {
    return "form";
  }

  set(options: FormTextOptions): this {
    super.set(options);
    this.set_input(TEXT.text, options.text, (text) => {
      this.textContent = text.ok ? text.value : text.error.nice;
    });
    this.set_input(TEXT.size, options.size, (size) => {
      const rem = size.ok ? size.value + "rem" : "";
      this.style.fontSize = rem;
      this.style.lineHeight = rem;
    });
    return this;
  }
}
define_element(FormText);

export type { FormText };

/**Creates a text, like a label in front of a form element*/
export function form_text(options: FormTextOptions = {}): FormText {
  return FormText.create(options);
}
