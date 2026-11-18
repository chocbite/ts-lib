import {
  Base,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import type { SVGFunc } from "#svg";
import "./add_row.scss";
import { ListKeyField } from "./key_field";
import type {
  ListParentRows,
  ListRoot,
  ListRowParent,
  ListType,
} from "./types";

/**Inputs of the add row*/
const ADD_ROW = {
  /**Text of the button, shows the error on errors*/
  text: input_key<StateOrVal<string>>(),
  /**Icon in front of the text, null for none, none on errors*/
  icon: input_key<StateOrVal<SVGFunc | null>>(),
  /**Called when the user clicks the button*/
  on_add: input_key<() => void>(),
};
/**Options of an add row, access locks it like every element*/
export type ListAddRowOptions = BaseOptions & InputOptions<typeof ADD_ROW>;

/**Button below the rows of a parent, adding a row is up to the app*/
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

  #button = document.createElement("span");
  #text = this.#button.appendChild(document.createTextNode(""));
  #icon?: SVGSVGElement;
  readonly #parent: ListRowParent<A>;
  readonly #root: ListRoot<R, T, A, S>;
  #key_field?: ListKeyField<A>;
  readonly depth: number;

  constructor(root: ListRoot<R, T, A, S>, parent: ListRowParent<A>) {
    super();
    this.#parent = parent;
    this.#root = root;
    this.depth = parent.depth + 1;
    this.#button.className = "add";
    this.#button.tabIndex = 0;
    if (root.sub_rows) {
      this.#key_field = this.appendChild(new ListKeyField(this));
      this.columns_changed();
    } else this.appendChild(this.#button);
  }

  /**With sub rows the button goes after the tree lines, in the key field only without value columns*/
  columns_changed() {
    this.#key_field?.place_after(
      this.#button,
      this.#root.columns_visible.length > 0,
    );
  }

  /**The fault icon goes on the button, the add row itself has no box*/
  protected fault_anchor(): Element {
    return this.#button;
  }

  set(options: ListAddRowOptions): this {
    super.set(options);
    this.set_input(ADD_ROW.text, options.text, (text) => {
      this.#text.data = text.ok ? text.value : text.error.nice;
    });
    this.set_input(ADD_ROW.icon, options.icon, (icon) => {
      this.#icon?.remove();
      const make = icon.ok ? icon.value : undefined;
      this.#icon = make
        ? this.#button.insertBefore(make(), this.#text)
        : undefined;
    });
    this.set_input(ADD_ROW.on_add, options.on_add, (on_add) => {
      this.#button.onclick = on_add.value;
    });
    return this;
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
