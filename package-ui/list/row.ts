import { Base, define_element } from "#base";
import ctm, { ContextMenu, type ContextMenuLines } from "#context_menu";
import { NiceError, none, some, type Option } from "@chocbite/ts-lib/result";
import { list_errors } from "./errors";
import {
  state,
  type State,
  type StateInferSub,
  type StateOrVal,
} from "@chocbite/ts-lib/state";
import state_ui from "#state_ui";
import { ListAddRow, type ListAddRowOptions } from "./add_row";
import type { ListDragField } from "./drag";
import { list_rows_error_update, ListError, type ListRowsError } from "./error";
import { list_align_apply, list_cell } from "./field";
import { ListKeyField, type ListKeyFieldOptions } from "./key_field";
import "./row.scss";
import { ListCheckField, type ListSelection } from "./selection";
import type {
  ListParentRows,
  ListRoot,
  ListRowParent,
  ListRowTransformer,
  ListType,
} from "./types";

/**Shown when the user tries to select a row that can not be selected */
/**The error of selecting a row that can not be selected*/
const not_selectable = () =>
  new NiceError(list_errors.NOT_SELECTABLE, "This row cannot be selected");

export type ListSubRows<R> = () => StateOrVal<R[]>;

export interface ListRowOptions<R, T extends {}, S extends boolean> {
  opened?: boolean;
  openable?: boolean | State<boolean>;
  key_field?: ListKeyFieldOptions;
  sub_rows?: S extends true ? ListSubRows<R> : never;
  add_row?: ListAddRowOptions;
  context_menu?: ContextMenu | (() => Option<ContextMenu>);
  /**Whether the row can be selected when the list has selection, true when undefined */
  selectable?: boolean;
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
  /**Drag handle cell, only with reorder */
  #drag?: ListDragField;
  /**Checkbox or radio button cell, only with selection */
  #check?: ListCheckField;
  #data!: R;
  /**Sub rows of a closed row given for a drop, used when it opens so the sub rows function is called once */
  #drop_rows?: ListType<R>;
  /**Key of the row in the selection, undefined when the row can not be selected */
  selection_key?: unknown;
  #field_box: HTMLDivElement;
  #child_box: HTMLSpanElement;
  #add_row?: ListAddRow<R, T, A, S>;
  #add_row_options?: ListAddRowOptions;
  /**Fields of the visible columns, the values are applied to them */
  #fields: Base[] = [];
  /**What the row shows for each field, the field itself or the cell wrapping it, see list_cell */
  #cells: HTMLElement[] = [];
  #values!: T;
  /**Shown instead of the fields while the row is invalid */
  #invalid?: ListError;
  /**Shown instead of the sub rows while their state has an error */
  #error?: ListRowsError<A>;
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
    if (this.#root.reorder) this.#drag = this.#root.reorder.handle(this);
    if (this.#root.selection) this.#selection_setup(this.#root.selection);
    //A right click on a sub row without its own menu reaches the child box before this row
    if (this.#root.sub_rows)
      this.#child_box.oncontextmenu = () => {
        this.#sub_row_menu = true;
      };
    this.#generate_fields();
    this.#show_cells(this.#cells);

    //Updates row data
    this.data = data;
  }

  #generate_fields() {
    this.#fields = this.#root.columns_visible.map((key) => {
      const column = this.#root.columns.get(key)!;
      const field = column.field_gen();
      list_align_apply(field, column.align);
      if (this.#root.observer)
        field.attach_to_intersect_observer(this.#root.observer);
      return field;
    });
    this.#cells = this.#fields.map(list_cell);
  }

  /**Shows the cells after the key field, which stays so an invalid row keeps its indent and arrow key navigation */
  #show_cells(cells: readonly HTMLElement[]) {
    const lead: HTMLElement[] = [];
    if (this.#drag) lead.push(this.#drag);
    if (this.#check) lead.push(this.#check);
    if (this.#key_field) lead.push(this.#key_field);
    this.#field_box.replaceChildren(...lead, ...cells);
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
    this.#generate_fields();
    //An invalid row has no values, the new fields are shown when it becomes valid
    if (this.#invalid) this.#show_invalid();
    else {
      this.#show_cells(this.#cells);
      this.#apply_values();
    }
    this.#add_row?.columns_changed();
    this.#error?.columns_changed();
    for (let i = 0; i < this.#child_box.childElementCount; i++)
      (this.#child_box.children[i] as ListRow<R, T, A, S>).columns_changed();
  }

  /**The error text of an invalid row after the tree lines, in the key field only without value columns, see place_after of the key field*/
  #show_invalid() {
    const invalid = this.#invalid!;
    if (this.#key_field && this.#root.columns_visible.length === 0) {
      this.#show_cells([]);
      this.#key_field.tail = invalid;
    } else {
      if (this.#key_field) this.#key_field.tail = undefined;
      this.#show_cells([invalid]);
    }
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
    if (!this.#key_field && !this.#check) return;
    //Open is not enough, an open row can show an error instead of sub rows
    const has_rows = this.#child_box.childElementCount > 0;
    if (direction === "next" || direction === "p_next") {
      if (direction === "next" && has_rows)
        (this.#child_box.firstElementChild! as ListRow<R, T, A, S>).#focus();
      else {
        const sibling = this.nextElementSibling;
        if (sibling instanceof ListRow) sibling.#focus();
        else this.#parent.select_adjacent("p_next", field);
      }
    } else if (direction === "previous") {
      const sibling = this.previousElementSibling;
      if (sibling instanceof ListRow) {
        if (sibling.open) sibling.select_adjacent("last", field);
        else sibling.#focus();
      } else this.#parent.select_adjacent("p_previous", field);
    } else if (direction === "p_previous") this.#focus();
    else if (direction === "last") {
      if (has_rows) {
        (
          this.#child_box.lastElementChild as ListRow<R, T, A, S>
        ).select_adjacent("last", field);
      } else this.#focus();
    }
  }

  /**Focuses the cell used for keyboard navigation, the key field or else the checkbox */
  #focus(options?: FocusOptions) {
    (this.#key_field ?? this.#check)?.focus(options);
  }

  /**Focuses the cell used for keyboard navigation */
  focus_cell() {
    this.#focus({ preventScroll: true });
  }

  /**Moves the focus to the keyboard cell after a click, so the selection keys work right away
   * Unless the click focused something in the row itself, like an input of a field */
  #focus_after_click() {
    const active = document.activeElement;
    if (active && active !== document.body && this.#field_box.contains(active))
      return;
    const cell = this.#key_field ?? this.#check;
    if (!cell) return;
    //Without scrolling, the sticky cell would scroll the list sideways
    cell.focus({ preventScroll: true });
    //Focus from script shows the focus ring, which a click should not, removed again by a key or blur
    cell.classList.add("click-focus");
  }

  key_down(e: KeyboardEvent): boolean {
    const selection = this.#root.selection;
    if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      if (!this.#root.reorder) return false;
      void this.#root.reorder.key_move(this, e.key === "ArrowDown" ? 1 : -1);
      return true;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      this.select_adjacent(e.key === "ArrowDown" ? "next" : "previous", none());
      const focused = document.activeElement?.closest("list-row");
      if (
        selection &&
        focused !== this &&
        focused instanceof ListRow &&
        focused.selection_key !== undefined
      )
        selection.focus_moved(focused.selection_key, e);
      return true;
    }
    if (!selection) return false;
    if (e.key === " " && this.selection_key === undefined) {
      selection.on_error?.(this, not_selectable());
      return true;
    }
    return selection.key_down(this.selection_key, e);
  }

  //      _____       _______
  //     |  __ \   /\|__   __|/\
  //     | |  | | /  \  | |  /  \
  //     | |  | |/ /\ \ | | / /\ \
  //     | |__| / ____ \| |/ ____ \
  //     |_____/_/    \_\_/_/    \_\

  set data(data: R) {
    this.#data = data;
    this.#drop_rows = undefined;
    this.classList.toggle(
      "movable",
      Boolean(this.#drag) &&
        state.is.state(this.#parent.state) &&
        this.#parent.state.writable,
    );
    const result = this.#root.transform(
      data,
      this,
      //Only the container gives top level rows, rows are only parents of sub rows
      this.#parent.state as Parameters<ListRowTransformer<R, T, A, S>>[2],
    );
    if (!result.ok) {
      this.#set_invalid(result.error);
      return;
    }
    const row_options = result.value;
    if (this.#invalid) {
      this.#invalid = undefined;
      if (this.#key_field) this.#key_field.tail = undefined;
      this.#show_cells(this.#cells);
    }
    this.#selection_update(row_options.selectable ?? true, data);
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
    //With sub rows a row gets open, close and close all lines and a selectable row select lines, in front of its own menu
    //Openable can be a state and rows open and close, the lines are made when the menu opens
    const menu =
      this.#root.sub_rows || this.selection_key !== undefined
        ? ctm.combine(
            () => this.#open_lines(),
            () => this.#selection_lines(),
            row_options.context_menu,
          )
        : row_options.context_menu;
    if (menu)
      ctm.attach(this, menu, () => {
        const from_sub_row = this.#sub_row_menu;
        this.#sub_row_menu = false;
        return from_sub_row;
      });
  }

  /**Replaces the fields with the text and removes everything else the row options gave */
  #set_invalid(text: string) {
    this.#selection_update(false);
    if (this.#key_field) this.#key_field.options = undefined;
    this.#sub_rows = undefined;
    this.add_row = undefined;
    this.#open_pending = false;
    this.detach_state_from_prop("openable");
    this.openable = false;
    ctm.detach(this);
    this.#sub_row_menu = false;
    if (!this.#invalid) {
      this.#invalid = new ListError();
      this.#show_invalid();
    }
    this.#invalid.text = text;
  }

  /**Makes a new add row for new options, so options a transform leaves out are gone, as they would stay with set*/
  set add_row(options: ListAddRowOptions | undefined) {
    if (options === this.#add_row_options) return;
    this.#add_row_options = options;
    this.#add_row?.remove();
    this.#add_row = options
      ? this.appendChild(
          ListAddRow.create<
            ListAddRow<R, T, A, S>,
            [ListRoot<R, T, A, S>, ListRowParent<A>]
          >(options, this.#root, this),
        )
      : undefined;
    this.classList.toggle("addrow", Boolean(options));
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
      const rows = this.#drop_rows ?? this.#sub_rows?.();
      this.#drop_rows = undefined;
      if (rows) this.rows = rows;
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

  set rows(rows: ListType<R>) {
    if (this.#state_sub) this.detach_state(this.#state_sub);
    this.#state_sub = undefined;
    //R is the item type of A
    this.state = rows as ListParentRows<A>;
    if (state.is.state(rows))
      this.#state_sub = this.attach_state(rows, (r) =>
        this.#update_rows(r.ok ? r.value : [], r.ok ? undefined : r.error.nice),
      );
    else this.#update_rows(rows);
  }

  #update_rows(rows: readonly R[], error?: string) {
    this.#error = list_rows_error_update(
      this.#child_box,
      this.#error,
      error,
      this.#root,
      this,
    );
    this.classList.toggle("open", rows.length > 0 || error !== undefined);
    list_rows_apply(this.#root, this, this.#child_box, rows);
  }

  //       _____ ______ _      ______ _____ _______ _____ ____  _   _
  //      / ____|  ____| |    |  ____/ ____|__   __|_   _/ __ \| \ | |
  //     | (___ | |__  | |    | |__ | |       | |    | || |  | |  \| |
  //      \___ \|  __| | |    |  __|| |       | |    | || |  | | . ` |
  //      ____) | |____| |____| |___| |____   | |   _| || |__| | |\  |
  //     |_____/|______|______|______\_____|  |_|  |_____\____/|_| \_|

  #selection_setup(selection: ListSelection<unknown>) {
    const clear_click_focus = (e: Event) =>
      (e.currentTarget as HTMLElement).classList.remove("click-focus");
    if (selection.column) {
      this.#check = new ListCheckField();
      //The key field is the keyboard cell when there is one
      if (!this.#key_field) this.#check.tabIndex = 0;
      this.#check.onkeydown = (e) => {
        if (this.key_down(e)) e.preventDefault();
      };
      this.#check.onclick = (e) => {
        e.stopPropagation();
        //Focus first, moving the focus after the warning would close it
        this.#focus_after_click();
        if (this.selection_key !== undefined)
          selection.check_click(this.selection_key);
        else selection.on_error?.(this, not_selectable());
      };
    }
    for (const cell of [this.#check, this.#key_field])
      if (cell) {
        cell.addEventListener("keydown", clear_click_focus);
        cell.addEventListener("blur", clear_click_focus);
      }
    this.#field_box.onclick = (e) => {
      //Focus first, moving the focus after the warning would close it
      this.#focus_after_click();
      if (this.selection_key !== undefined)
        selection.click(this.selection_key, e);
      else selection.on_error?.(this, not_selectable());
    };
    //Shift click would select text between the rows
    this.#field_box.onmousedown = (e) => {
      if (e.shiftKey && selection.multi) e.preventDefault();
    };
  }

  /**Registers the row in the selection with the key of its data, or removes it when not selectable */
  #selection_update(selectable: boolean, data?: R) {
    const selection = this.#root.selection;
    if (!selection) return;
    const key: unknown = selectable ? selection.key(data) : undefined;
    if (key === this.selection_key) return;
    if (this.selection_key !== undefined)
      selection.unregister(this.selection_key, this);
    this.selection_key = key;
    if (key !== undefined) selection.register(key, this);
    this.classList.toggle("selectable", key !== undefined);
  }

  /**Context menu lines to open or close the sub rows of an openable row, and to close all rows while one is open
   * Close all is on every row, so a list without header can close all */
  #open_lines(): ContextMenuLines {
    const lines: ContextMenuLines = [];
    if (this.openable)
      lines.push(
        this.open
          ? ctm.line({ text: "Close", on_click: () => (this.open = false) })
          : ctm.line({ text: "Open", on_click: () => (this.open = true) }),
      );
    if (this.#root.any_open())
      lines.push(
        ctm.line({ text: "Close all", on_click: () => this.#root.close_all() }),
      );
    return lines;
  }

  /**Context menu lines to select or deselect the row, and in multi mode all rows
   * Empty when the row can not be selected */
  #selection_lines(): ContextMenuLines {
    const selection = this.#root.selection;
    const key = this.selection_key;
    if (!selection || key === undefined) return [];
    const lines: ContextMenuLines = [
      selection.is_selected(key)
        ? ctm.line({
            text: "Deselect",
            on_click: () => selection.deselect(key),
          })
        : ctm.line({ text: "Select", on_click: () => selection.select(key) }),
    ];
    if (selection.multi)
      lines.push(
        ctm.line({
          text: "Select all",
          on_click: () => selection.select_all(),
          shortcut: "Ctrl+A",
        }),
        ctm.line({
          text: "Deselect all",
          on_click: () => selection.clear(),
          shortcut: "Esc",
        }),
      );
    return lines;
  }

  //      __  __  ______      _______ _   _  _____
  //     |  \/  |/ __ \ \    / /_   _| \ | |/ ____|
  //     | \  / | |  | \ \  / /  | | |  \| | |  __
  //     | |\/| | |  | |\ \/ /   | | | . ` | | |_ |
  //     | |  | | |__| | \  /   _| |_| |\  | |__| |
  //     |_|  |_|\____/   \/   |_____|_| \_|\_____|

  get data(): R {
    return this.#data;
  }

  /**Moving of the list the row is in, undefined when its rows can not be moved */
  get reorder() {
    return this.#root.reorder;
  }

  /**Rows of the parent the row is in */
  get parent_rows(): ListParentRows<A> {
    return this.#parent.state;
  }

  /**Row the row is a sub row of, undefined for top level rows */
  get parent_row(): ListRow<R, T, A, S> | undefined {
    return this.#parent instanceof ListRow ? this.#parent : undefined;
  }

  get next_row(): ListRow<R, T, A, S> | undefined {
    const next = this.nextElementSibling;
    return next instanceof ListRow ? next : undefined;
  }

  get first_sub_row(): ListRow<R, T, A, S> | undefined {
    const first = this.#child_box.firstElementChild;
    return first instanceof ListRow ? first : undefined;
  }

  /**Whether the row has a handle and its parent rows can be written */
  get movable(): boolean {
    return this.classList.contains("movable");
  }

  /**Whether rows can be dropped into the row, it must be openable with sub rows in a writable state */
  get droppable(): boolean {
    if (!this.openable) return false;
    const rows = this.drop_rows();
    return state.is.state(rows) && rows.writable;
  }

  /**The sub rows rows are dropped into, also of a closed row */
  drop_rows(): ListType<R> | undefined {
    if (this.open) return this.state;
    return (this.#drop_rows ??= this.#sub_rows?.());
  }

  /**Whether the row is selected in a list with multi selection, a drag of it moves all selected rows */
  get multi_selected(): boolean {
    return this.selected && Boolean(this.#root.selection?.multi);
  }

  /**Text naming the row while it is dragged, the key field text or the text of the first cell */
  get label(): string {
    const text =
      this.#key_field?.querySelector(".text")?.textContent ||
      this.#fields[0]?.textContent ||
      "";
    return text.trim();
  }

  /**First visible cell of the row, the row itself is display contents and has no box */
  get anchor(): Element | undefined {
    return this.#field_box.firstElementChild ?? undefined;
  }

  set selected(value: boolean) {
    this.classList.toggle("selected", value);
  }
  get selected(): boolean {
    return this.classList.contains("selected");
  }

  /**Removes the row and its sub rows from the selection, when the row is removed */
  selection_leave() {
    const selection = this.#root.selection;
    if (!selection) return;
    if (this.selection_key !== undefined)
      selection.unregister(this.selection_key, this);
    this.selection_key = undefined;
    for (let i = 0; i < this.#child_box.childElementCount; i++)
      (this.#child_box.children[i] as ListRow<R, T, A, S>).selection_leave();
  }
}
define_element(ListRow);

/**Applies rows to a row box, removed rows leave the selection, which updates once after all changes */
export function list_rows_apply<
  R,
  T extends {},
  A extends ListType<R>,
  S extends boolean,
>(
  root: ListRoot<R, T, A, S>,
  parent: ListRowParent<A>,
  box: HTMLElement,
  rows: readonly R[],
) {
  const apply = () =>
    state_ui.a.apply(box, rows, {
      create: (row) => new ListRow<R, T, A, S>(root, parent, row),
      update: (element, row) => (element.data = row),
      destroy: (element) => element.selection_leave(),
    });
  if (root.selection) root.selection.batch(apply);
  else apply();
}
