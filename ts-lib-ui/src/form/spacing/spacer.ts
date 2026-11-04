import { define_element } from "#base";
import { FormElement } from "../base";
import "../shared";
import "./spacer.scss";

export interface FormSpacerOptions {
  /**Spacing amount  */
  space?: number;
}

export class FormSpacer extends FormElement {
  static element_name() {
    return "spacer";
  }
  static element_name_space(): string {
    return "form";
  }

  constructor() {
    super();
  }

  /**Sets the amount of space, in rem */
  set space(space: number) {
    this.style.height = `${space}rem`;
  }
  get space() {
    return parseFloat(this.style.height);
  }
}
define_element(FormSpacer);

/**Creates a spacer form element */
export function form_spacer(options?: FormSpacerOptions): FormSpacer {
  const spacer = new FormSpacer();
  if (options) {
    if (options.space) spacer.space = options.space;
  }
  return spacer;
}
