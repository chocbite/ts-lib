import { Base, define_element } from "#base";
import { some } from "@chocbite/ts-lib/result";
import { state, type State } from "@chocbite/ts-lib/state";
import type { SVGFunc } from "#svg";
import "./add_row.scss";
import { ListKeyField } from "./key_field";
import type { ListRoot, ListRowParent, ListType } from "./types";

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
  readonly depth: number;

  constructor(root: ListRoot<R, T, A, S>, parent: ListRowParent<A>) {
    super();
    this.depth = parent.depth + 1;
    if (root.sub_rows) this.appendChild(new ListKeyField(this));
    this.#button = this.appendChild(document.createElement("span"));
    this.#button.tabIndex = 0;
  }

  set options(options: ListAddRowOptions) {
    this.#button.onclick = options.on_add;

    if (state.is.state(options.text))
      this.attach_state_to_prop("text", options.text, (e) => some(e));
    else this.text = options.text;
    if (state.is.state(options.disabled))
      this.attach_state_to_prop("disabled", options.disabled, () =>
        some(false),
      );
    else if (options.disabled) this.disabled = options.disabled;
  }

  set text(value: string) {
    this.#button.innerHTML = value;
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

  set state(_value: A) {}
  get state(): A {
    throw new Error("Method not implemented.");
  }

  get global_amount(): number {
    return 0;
  }

  select_adjacent(): void {}
}
define_element(ListAddRow);
