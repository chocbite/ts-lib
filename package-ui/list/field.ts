import { Base, define_element } from "#base";
import "./field.scss";
import type { ListColumnAlign } from "./types";

/**Adds the class for the alignment, center is the default and adds nothing
 * Only the styling of an element decides if the class does anything, so complex fields just do not follow it */
export function list_align_apply(
  element: HTMLElement,
  align: ListColumnAlign | undefined,
) {
  if (align === "left" || align === "right")
    element.classList.add("align-" + align);
}

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

/**The cell showing a field in a row, a list field is its own cell, any other element, like a form element, is wrapped in a list-cell
 * The row background, borders and padding go on the cell, so a wrapped element keeps its own look */
export function list_cell(field: Base): HTMLElement {
  if (field instanceof ListField) return field;
  const cell = document.createElement("list-cell");
  cell.appendChild(field);
  return cell;
}

export class ListTextField extends ListField {
  static element_name() {
    return "textfield";
  }

  set text(value: string) {
    this.textContent = value;
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
    this.textContent = value.toString();
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
