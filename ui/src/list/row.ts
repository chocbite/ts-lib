import { Base, define_element } from "#base";
import ctm, { ContextMenu } from "#context-menu";
import { some, type Option } from "@chocbite/ts-lib/result";
import { state, type State, type StateInferSub } from "@chocbite/ts-lib/state";
import state_ui from "#state";
import { ListAddRow, type ListAddRowOptions } from "./add_row";
import type { ListField } from "./field";
import { ListKeyField, type ListKeyFieldOptions } from "./key_field";
import "./row.scss";
import type {
  ListParentRows,
  ListRoot,
  ListRowParent,
  ListRowTransformer,
  ListType,
} from "./types";

export type ListSubRows<R> = () => R[] | State<R[]>;

export interface ListRowOptions<R, T extends {}, S extends boolean> {
  opened?: boolean;
  openable?: boolean | State<boolean>;
  key_field?: ListKeyFieldOptions;
  sub_rows?: S extends true ? ListSubRows<R> : never;
  add_row?: ListAddRowOptions;
  context_menu?: ContextMenu | (() => Option<ContextMenu>);
  values: T;
}

export class ListRow<R, T extends {}, A extends ListType<R>, S extends boolean>
  extends Base
  implements ListRowParent<A>
{
  static element_name() {
    return "row";
  }
  static element_name_space(): string {
    return "list";
  }
  #root: ListRoot<R, T, A, S>;
  #parent: ListRowParent<A>;
  #sub_rows?: ListSubRows<R>;
  readonly depth: number;
  #key_field?: ListKeyField<A>;
  #field_box: HTMLDivElement;
  #child_box: HTMLSpanElement;
  #add_row?: ListAddRow<R, T, A, S>;
  #fields: ListField[];
  #values!: T;
  #open_pending = false;
  #sub_row_menu = false;
  #state_sub?: StateInferSub<State<R[]>>;
  state!: ListParentRows<A>;

  constructor(root: ListRoot<R, T, A, S>, parent: ListRowParent<A>, data: R) {
    super();
    this.#root = root;
    this.#parent = parent;
    this.depth = parent.depth + 1;
    this.style.setProperty("--i-" + this.depth, "var(--c)");
    if (this.#root.sub_rows) {
      this.#key_field = new ListKeyField(this);
      if (this.#root.observer)
        this.#key_field.attach_to_intersect_observer(this.#root.observer);
    }
    this.#field_box = this.appendChild(document.createElement("div"));
    this.#child_box = this.appendChild(document.createElement("span"));
    //A right click on a sub row without its own menu reaches the child box before this row
    if (this.#root.sub_rows)
      this.#child_box.oncontextmenu = () => {
        this.#sub_row_menu = true;
      };
    this.#fields = this.#generate_fields();

    //Updates row data
    this.data = data;
  }

  #generate_fields(): ListField[] {
    const fields = this.#root.columns_visible.map((key) => {
      const field = this.#root.columns.get(key)!.field_gen();
      if (this.#root.observer)
        field.attach_to_intersect_observer(this.#root.observer);
      return field;
    });
    if (this.#key_field)
      this.#field_box.replaceChildren(this.#key_field, ...fields);
    else this.#field_box.replaceChildren(...fields);
    return fields;
  }

  #apply_values() {
    this.#root.columns_visible.forEach((key, index) => {
      this.#root.columns
        .get(key)!
        .field_apply(this.#fields[index], this.#values[key]);
    });
  }

  /**Regenerates the fields of the row and its sub rows after the columns changed */
  columns_changed() {
    this.#fields = this.#generate_fields();
    this.#apply_values();
    for (let i = 0; i < this.#child_box.childElementCount; i++)
      (this.#child_box.children[i] as ListRow<R, T, A, S>).columns_changed();
  }

  //      _____        _____  ______ _   _ _______
  //     |  __ \ /\   |  __ \|  ____| \ | |__   __|
  //     | |__) /  \  | |__) | |__  |  \| |  | |
  //     |  ___/ /\ \ |  _  /|  __| | . ` |  | |
  //     | |  / ____ \| | \ \| |____| |\  |  | |
  //     |_| /_/    \_\_|  \_\______|_| \_|  |_|

  select_adjacent(
    direction: "next" | "previous" | "p_next" | "p_previous" | "last",
    field: Option<number>,
  ) {
    if (!this.#key_field) return;
    if (direction === "next" || direction === "p_next") {
      if (direction === "next" && this.open)
        (
          this.#child_box.firstElementChild! as ListRow<R, T, A, false>
        ).#key_field!.focus();
      else {
        const sibling = this.nextElementSibling;
        if (sibling instanceof ListRow) sibling.#key_field!.focus();
        else this.#parent.select_adjacent("p_next", field);
      }
    } else if (direction === "previous") {
      const sibling = this.previousElementSibling;
      if (sibling instanceof ListRow) {
        if (sibling.open) sibling.select_adjacent("last", field);
        else sibling.#key_field!.focus();
      } else this.#parent.select_adjacent("p_previous", field);
    } else if (direction === "p_previous") this.#key_field.focus();
    else if (direction === "last") {
      if (this.open) {
        (
          this.#child_box.lastElementChild as ListRow<R, T, A, S>
        ).select_adjacent("last", field);
      } else this.#key_field.focus();
    }
  }

  //      _____       _______
  //     |  __ \   /\|__   __|/\
  //     | |  | | /  \  | |  /  \
  //     | |  | |/ /\ \ | | / /\ \
  //     | |__| / ____ \| |/ ____ \
  //     |_____/_/    \_\_/_/    \_\

  set data(data: R) {
    const row_options = this.#root.transform(
      data,
      this,
      //Only the container gives top level rows, rows are only parents of sub rows
      this.#parent.state as Parameters<ListRowTransformer<R, T, A, S>>[2],
    );
    if (this.#key_field) this.#key_field.options = row_options.key_field;
    this.#sub_rows = row_options.sub_rows;

    this.add_row = row_options.add_row;

    this.#values = row_options.values;
    this.#apply_values();

    //Setup openable
    const was_open = this.open;
    if (state.is.state(row_options.openable)) {
      //Opening waits for the first value of the state, which is immediate when connected
      this.#open_pending = !was_open && Boolean(row_options.opened);
      this.attach_state_to_prop("openable", row_options.openable, () =>
        some(false),
      );
    } else {
      this.#open_pending = false;
      this.detach_state_from_prop("openable");
      this.openable = Boolean(row_options.openable);
      if (!was_open && row_options.opened) this.open = true;
    }

    //Refresh the sub rows of an open row
    if (was_open && this.open) {
      if (this.#sub_rows) this.rows = this.#sub_rows();
      else if (!row_options.opened) this.open = false;
    }

    //Setup context menu, blocked for right clicks bubbling up from sub rows
    ctm.detach(this);
    this.#sub_row_menu = false;
    if (row_options.context_menu)
      ctm.attach(this, row_options.context_menu, () => {
        const from_sub_row = this.#sub_row_menu;
        this.#sub_row_menu = false;
        return from_sub_row;
      });
  }

  set add_row(options: ListAddRowOptions | undefined) {
    if (!options && this.#add_row) {
      this.#add_row.remove();
      this.classList.remove("addrow");
      this.#add_row = undefined;
    } else if (options) {
      if (!this.#add_row) {
        this.classList.add("addrow");
        this.#add_row = this.appendChild(
          new ListAddRow<R, T, A, S>(this.#root, this),
        );
      }
      this.#add_row.options = options;
    }
  }

  //       ____  _____  ______ _   _ _____ _   _  _____
  //      / __ \|  __ \|  ____| \ | |_   _| \ | |/ ____|
  //     | |  | | |__) | |__  |  \| | | | |  \| | |  __
  //     | |  | |  ___/|  __| | . ` | | | | . ` | | |_ |
  //     | |__| | |    | |____| |\  |_| |_| |\  | |__| |
  //      \____/|_|    |______|_| \_|_____|_| \_|\_____|

  set openable(value: boolean) {
    if (!value) this.open = false;
    if (this.#key_field) this.#key_field.openable = value;
    if (this.#open_pending) {
      this.#open_pending = false;
      if (value) this.open = true;
    }
  }
  get openable(): boolean {
    return this.#key_field?.openable ?? false;
  }

  set open(open: boolean) {
    if (!this.openable) return;
    if (open && this.#child_box.childElementCount === 0) {
      if (this.#sub_rows) this.rows = this.#sub_rows?.();
    } else if (!open && this.open) this.rows = [];
  }
  get open(): boolean {
    return this.classList.contains("open");
  }

  //      _____   ______          _______
  //     |  __ \ / __ \ \        / / ____|
  //     | |__) | |  | \ \  /\  / / (___
  //     |  _  /| |  | |\ \/  \/ / \___ \
  //     | | \ \| |__| | \  /\  /  ____) |
  //     |_|  \_\\____/   \/  \/  |_____/

  get index(): number {
    return Array.prototype.indexOf.call(this.parentElement!.children, this);
  }

  amount_rows(rec: boolean = false): number {
    let count = this.#child_box.childElementCount;
    if (rec)
      for (let i = 0; i < this.#child_box.childElementCount; i++)
        count += (
          this.#child_box.children[i] as ListRow<R, T, A, S>
        ).amount_rows(true);
    return count;
  }

  set rows(rows: R[] | State<R[]>) {
    if (this.#state_sub) this.detach_state(this.#state_sub);
    this.#state_sub = undefined;
    //R is the item type of A
    this.state = rows as ListParentRows<A>;
    if (state.is.state(rows))
      this.#state_sub = this.attach_state(rows, (r) =>
        this.#update_rows(r.ok ? r.value : []),
      );
    else this.#update_rows(rows);
  }

  #update_rows(rows: readonly R[]) {
    this.classList.toggle("open", rows.length > 0);
    state_ui.a.apply(this.#child_box, rows, {
      create: (row) => new ListRow<R, T, A, S>(this.#root, this, row),
      update: (element, row) => (element.data = row),
    });
  }
}
define_element(ListRow);
