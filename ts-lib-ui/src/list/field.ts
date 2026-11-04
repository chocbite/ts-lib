import { Base, define_element } from "#base";
import "./field.scss";

export abstract class ListField extends Base {
  static element_name() {
    return "@abstract@";
  }
  static element_name_space() {
    return "list";
  }

  constructor() {
    super();
  }
}

export class ListTextField extends ListField {
  static element_name() {
    return "textfield";
  }

  set text(value: string) {
    this.innerHTML = value;
  }
}
define_element(ListTextField);

export function text_field() {
  return new ListTextField();
}

export class ListNumberField extends ListField {
  static element_name() {
    return "numberfield";
  }

  set number(value: number) {
    this.innerHTML = value.toString();
  }
}
define_element(ListNumberField);

export function number_field() {
  return new ListNumberField();
}

export class ListNodeField<T extends Node> extends ListField {
  static element_name() {
    return "nodefield";
  }

  constructor(node: T) {
    super();
    this.appendChild(node);
  }

  set node(node: T) {
    this.replaceChildren(node);
  }

  get node() {
    return this.firstChild! as unknown as T;
  }
}
define_element(ListNodeField);

export function node_field<T extends Node>(node: T) {
  return new ListNodeField<T>(node);
}
