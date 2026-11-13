import { define_element } from "#base";
import { ListField } from "#list";
import { FormElement } from "../base";
import "./list_field.scss";

export class ListFormField<T extends FormElement> extends ListField {
  static element_name() {
    return "listfield";
  }
  static element_name_space(): string {
    return "form";
  }

  set element(component: T) {
    this.replaceChildren(component);
  }

  get element(): T {
    return this.firstElementChild as T;
  }
}
define_element(ListFormField);

export function form_list_field<T extends FormElement>(element: T) {
  const field = new ListFormField<T>();
  field.element = element;
  return field;
}
