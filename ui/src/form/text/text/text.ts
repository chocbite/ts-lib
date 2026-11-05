import { define_element } from "#base";
import { FormElement } from "../../base";
import "./text.scss";

export interface FormTextOptions {
  /**Buttons text */
  text?: string;
  /**Text size */
  size?: number;
}

/**Component for simple text */
export class FormText extends FormElement {
  static element_name() {
    return "text";
  }
  static element_name_space(): string {
    return "form";
  }

  constructor(options: FormTextOptions) {
    super();
    if (options.text) this.text = options.text;
    if (options.size) this.size = options.size;
  }

  /**Sets the current text of the element*/
  set text(text: string) {
    this.textContent = text;
  }
  get text() {
    return this.textContent;
  }

  /**Sets the current text of the element*/
  set size(size: number) {
    this.style.fontSize = size + "rem";
    this.style.lineHeight = size + "rem";
  }
}
define_element(FormText);

/**Creates a button form element */
export function form_text(options: FormTextOptions): FormText {
  return new FormText(options);
}
