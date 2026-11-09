import { Base, define_element } from "#base";
import { some } from "@chocbite/ts-lib/result";
import { state, type State } from "@chocbite/ts-lib/state";
import type { SVGFunc } from "#svg";
import "./add_row.scss";
import { ListKeyField } from "./key_field";
import type {
  ListParentRows,
  ListRoot,
  ListRowParent,
  ListType,
} from "./types";

export interface ListAddRowOptions {
  text: string | State<string>;
  disabled?: boolean | State<boolean>;
  icon?: SVGFunc | State<SVGFunc>;
  on_add: () => void;
}

export class ListAddRow<
  R,
  T extends {},
  A extends ListType<any>,
  S extends boolean,
>
  extends Base
  implements ListRowParent<A>
{
  static element_name() {
    return "addrow";
  }
  static element_name_space(): string {
    return "list";
  }

  #button: HTMLSpanElement;
  #text: Text;
  #icon?: SVGSVGElement;
  #parent: ListRowParent<A>;
  readonly depth: number;

  constructor(root: ListRoot<R, T, A, S>, parent: ListRowParent<A>) {
    super();
    this.#parent = parent;
    this.depth = parent.depth + 1;
    if (root.sub_rows) this.appendChild(new ListKeyField(this));
    this.#button = this.appendChild(document.createElement("span"));
    this.#button.tabIndex = 0;
    this.#text = this.#button.appendChild(document.createTextNode(""));
  }

  set options(options: ListAddRowOptions) {
    this.#button.onclick = options.on_add;

    if (state.is.state(options.text))
      this.attach_state_to_prop("text", options.text, (e) => some(e));
    else this.detach_state_from_prop("text").text = options.text;
    if (state.is.state(options.disabled))
      this.attach_state_to_prop("disabled", options.disabled, () =>
        some(false),
      );
    else this.detach_state_from_prop("disabled").disabled = Boolean(
      options.disabled,
    );
    if (state.is.state(options.icon))
      this.attach_state_to_prop("icon", options.icon, () => some(undefined));
    else this.detach_state_from_prop("icon").icon = options.icon;
  }

  set text(value: string) {
    this.#text.data = value;
  }

  set icon(value: SVGFunc | undefined) {
    this.#icon?.remove();
    this.#icon = value ? this.#button.insertBefore(value(), this.#text) : undefined;
  }

  set disabled(value: boolean) {
    if (value) this.inert = true;
    else this.inert = false;
  }

  set open(_value: boolean) {}
  get open(): boolean {
    return false;
  }

  set global_index(_value: number) {}
  get global_index(): number {
    return 0;
  }

  /**Rows the add row adds to, the state of its parent */
  set state(_value: ListParentRows<A>) {}
  get state(): ListParentRows<A> {
    return this.#parent.state;
  }

  get global_amount(): number {
    return 0;
  }

  select_adjacent(): void {}
}
define_element(ListAddRow);
