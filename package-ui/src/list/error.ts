import { Base, define_element } from "#base";
import "./error.scss";
import { ListKeyField } from "./key_field";
import type { ListParentRows, ListRowParent, ListType } from "./types";

/**Error text shown instead of the fields of an invalid row */
export class ListError extends Base {
  static element_name() {
    return "error";
  }
  static element_name_space() {
    return "list";
  }

  set text(value: string) {
    this.textContent = value;
  }
}
define_element(ListError);

/**Error text shown instead of the rows of a parent, has a key field to continue the tree lines like an add row */
export class ListRowsError<A extends ListType<any>>
  extends Base
  implements ListRowParent<A>
{
  static element_name() {
    return "rowserror";
  }
  static element_name_space() {
    return "list";
  }

  #text = new ListError();
  #parent: ListRowParent<A>;
  readonly depth: number;

  constructor(sub_rows: boolean, parent: ListRowParent<A>) {
    super();
    this.#parent = parent;
    this.depth = parent.depth + 1;
    if (sub_rows) this.appendChild(new ListKeyField(this));
    this.appendChild(this.#text);
  }

  set text(value: string) {
    this.#text.text = value;
  }

  set open(_value: boolean) {}
  get open(): boolean {
    return false;
  }

  /**Rows the error is shown for, the state of its parent */
  set state(_value: ListParentRows<A>) {}
  get state(): ListParentRows<A> {
    return this.#parent.state;
  }

  select_adjacent(): void {}
}
define_element(ListRowsError);

/**Shows the text in an error element directly after the row box, removes the element when there is no text
 * @returns the element to give next time, undefined when there is no text*/
export function list_rows_error_update<A extends ListType<any>>(
  row_box: Element,
  current: ListRowsError<A> | undefined,
  text: string | undefined,
  sub_rows: boolean,
  parent: ListRowParent<A>,
): ListRowsError<A> | undefined {
  if (text === undefined) {
    current?.remove();
    return undefined;
  }
  if (!current) {
    current = new ListRowsError(sub_rows, parent);
    //Not in the row box, everything in there is a row
    row_box.after(current);
  }
  current.text = text;
  return current;
}
