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
import {
  list_search_plain,
  type ListSearchMode,
  type ListSearchQuery,
  type ListSearchResult,
  type ListSearchValue,
} from "./search";
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

/**Key of the subscription of the opened state of a row */
const OPENED = Symbol("opened");

export interface ListRowOptions<R, T extends {}, S extends boolean> {
  /**Whether the row is open, a plain value is where the row starts, later data does not open or close it
   * A writable state is written when the user opens or closes the row, the row opens and closes when the state changes
   * A read only state is only followed, the user can not open or close the row, and it has no opener arrow
   * The row opens to the state whenever it can be opened, an error of the state closes it */
  opened?: boolean | State<boolean>;
  openable?: boolean | State<boolean>;
  key_field?: ListKeyFieldOptions;
  sub_rows?: S extends true ? ListSubRows<R> : never;
  add_row?: ListAddRowOptions;
  context_menu?: ContextMenu | (() => Option<ContextMenu>);
  /**Whether the row can be selected when the list has selection, true when undefined */
  selectable?: boolean;
  /**Answers a search of the list for the row, called when the search or the data of the row changes, see ListSearchResult
   * Without it the row matches when the text is in one of its values or its key field text, and the search never opens it
   * Rows below a row that is not open can only be found through it, as the list does not open rows to search them */
  search?: (query: ListSearchQuery) => ListSearchResult<T>;
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
  /**Opens the row once it is openable, for a plain opened true given while it is not openable yet */
  #open_pending = false;
  /**Whether the row has had valid data, a plain opened only applies to the first */
  #started = false;
  /**Opened state the row follows, written when the user opens or closes the row */
  #opened?: State<boolean>;
  /**Last value of the opened state, the row opens to it whenever it becomes openable */
  #opened_value = false;
  /**Search answer of the row options */
  #search?: (query: ListSearchQuery) => ListSearchResult<T>;
  /**Key field text of the row options, searched for rows without a search answer */
  #key_text?: string | State<string>;
  /**Whether the row options let the row be selected */
  #selectable = false;
  /**Answer of the row to the search of the list, undefined while its parent does not filter it */
  #found?: ListSearchResult<T>;
  /**Whether cells or the key field text may be highlighted as found by the search */
  #marked = false;
  /**Hidden by the search, by its own answer or as its parent is hidden */
  #hidden = false;
  /**Opened by the search, closed again when the search no longer opens it */
  #search_opened = false;
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
      this.#search_mark();
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
    //Rows the search hides are skipped, open is not enough, an open row can show an error instead of sub rows
    if (direction === "next" || direction === "p_next") {
      const first =
        direction === "next" ? this.#shown_sub_row(true) : undefined;
      if (first) first.#focus();
      else {
        const sibling = this.adjacent_shown(1);
        if (sibling) sibling.#focus();
        else this.#parent.select_adjacent("p_next", field);
      }
    } else if (direction === "previous") {
      const sibling = this.adjacent_shown(-1);
      if (sibling) {
        if (sibling.open) sibling.select_adjacent("last", field);
        else sibling.#focus();
      } else this.#parent.select_adjacent("p_previous", field);
    } else if (direction === "p_previous") this.#focus();
    else if (direction === "last") {
      const last = this.#shown_sub_row(false);
      if (last) last.select_adjacent("last", field);
      else this.#focus();
    }
  }

  /**The next or previous row of the same parent the search does not hide */
  adjacent_shown(direction: 1 | -1): ListRow<R, T, A, S> | undefined {
    const step = (element: Element) =>
      direction > 0
        ? element.nextElementSibling
        : element.previousElementSibling;
    let sibling = step(this);
    while (sibling instanceof ListRow && sibling.#hidden)
      sibling = step(sibling);
    return sibling instanceof ListRow ? sibling : undefined;
  }

  /**The first or last sub row the search does not hide */
  #shown_sub_row(first: boolean): ListRow<R, T, A, S> | undefined {
    let row = first
      ? this.#child_box.firstElementChild
      : this.#child_box.lastElementChild;
    while (row instanceof ListRow && row.#hidden)
      row = first ? row.nextElementSibling : row.previousElementSibling;
    return row instanceof ListRow ? row : undefined;
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
      //A row that can only be opened, like a folder of selectable rows, opens and closes instead
      if (this.openable) this.open = !this.open;
      else selection.on_error?.(this, not_selectable());
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
    this.#values = row_options.values;
    this.#search = row_options.search;
    this.#key_text = row_options.key_field?.text;
    this.#selectable = row_options.selectable ?? true;
    //Before the sub rows are refreshed, they are searched by how the search applies to them now
    const rows_mode = this.#rows_mode;
    this.#search_find();
    this.#selection_update();
    if (this.#key_field) this.#key_field.options = row_options.key_field;
    this.#sub_rows = row_options.sub_rows;

    this.add_row = row_options.add_row;

    this.#apply_values();

    //Setup opened and openable
    const was_open = this.open;
    const opened = row_options.opened;
    const opened_state = state.is.state(opened) ? opened : undefined;
    //Kept for the same state, a new one is attached after openable, so it opens the row by the openable of the new data
    const new_state = opened_state !== this.#opened;
    if (new_state) this.#opened_detach();
    //A plain opened is where the row starts, later data does not open or close it, the row keeps the user's opening and closing
    const start = !opened_state && !this.#started && Boolean(opened);
    this.#started = true;
    if (state.is.state(row_options.openable)) {
      //Opening waits for the first value of the state, which is immediate when connected
      this.#open_pending = start;
      this.attach_state_to_prop("openable", row_options.openable, () =>
        some(false),
      );
    } else {
      this.#open_pending = false;
      this.detach_state_from_prop("openable");
      this.openable = Boolean(row_options.openable);
      if (start) this.#show_open(true);
    }
    if (opened_state && new_state) {
      this.#opened = opened_state;
      this.attach_state_to_symbol(OPENED, opened_state, (value) => {
        this.#opened_value = value.ok && value.value;
        //A row the search opened stays open until the search ends or the user closes it
        if (this.#opened_value || !this.#search_opened)
          this.#show_open(this.#opened_value);
      });
    }
    if (this.#key_field) this.#key_field.locked = !this.#user_opens;

    //Refresh the sub rows of an open row
    let refreshed = false;
    if (was_open && this.open) {
      if (this.#sub_rows) {
        this.rows = this.#sub_rows();
        refreshed = true;
      } else if (!opened) this.#show_open(false);
    }
    this.#search_open_update();
    //Refreshed sub rows were searched when they got their data
    if (!refreshed && this.#rows_mode !== rows_mode) this.#search_sub_rows();

    //Setup context menu, the lines of the row and the list in front of its own menu
    ctm.detach(this);
    this.#sub_row_menu = false;
    //Open or close with the open all lines, select or deselect with the select all lines, then the search lines
    //Openable can be a state and rows open and close, the lines are made when the menu opens
    const root = this.#root;
    const menu =
      root.has_menu || this.selection_key !== undefined
        ? ctm.combine(
            () => [...this.#open_lines(), ...root.open_all_lines()],
            () => [...this.#selection_lines(), ...root.select_all_lines()],
            () => root.search_lines(),
            row_options.context_menu,
          )
        : row_options.context_menu;
    if (menu) {
      const own = typeof menu === "function" ? menu : () => some(menu);
      //A right click on a sub row without a menu of its own, like an invalid one, comes up through the box of the sub rows, it gets the menu of the list
      ctm.attach(this, () => {
        const from_sub_row = this.#sub_row_menu;
        this.#sub_row_menu = false;
        return from_sub_row ? root.menu() : own();
      });
    }
  }

  /**Replaces the fields with the text and removes everything else the row options gave */
  #set_invalid(text: string) {
    this.#selectable = false;
    this.#search = undefined;
    this.#key_text = undefined;
    if (this.#key_field) this.#key_field.options = undefined;
    this.#sub_rows = undefined;
    this.add_row = undefined;
    this.#open_pending = false;
    this.#opened_detach();
    this.detach_state_from_prop("openable");
    this.openable = false;
    ctm.detach(this);
    this.#sub_row_menu = false;
    if (!this.#invalid) {
      this.#invalid = new ListError();
      this.#show_invalid();
    }
    this.#invalid.text = text;
    //Invalid rows are hidden while searching
    this.#search_find();
    this.#selection_update();
    this.#search_open_update();
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
    if (!value) this.#show_open(false);
    if (this.#key_field) this.#key_field.openable = value;
    //A plain opened waits only for the first openable, an opened state is followed whenever the row is openable
    if (value && (this.#open_pending || this.#opened_value))
      this.#show_open(true);
    this.#open_pending = false;
    //A row the search found something below opens once it can be opened
    if (value && this.#found === "below" && !this.open)
      this.#root.search_queue(this);
  }
  get openable(): boolean {
    return this.#key_field?.openable ?? false;
  }

  /**Opens or closes the row as the user does, used by the opener, the keys, clicks, the row menu, open and close all and drags
   * With a writable opened state the state is written and the row follows it, a read only state can not be changed */
  set open(open: boolean) {
    if (!this.openable) return;
    //A row the user closes is no longer the search's to close
    if (!open) this.#search_opened = false;
    const opened = this.#opened;
    //What the state says already is only shown again, like opening a row whose sub rows were empty
    if (!opened || open === this.#opened_value) this.#show_open(open);
    else if (opened.writable) void opened.write?.(open);
  }
  get open(): boolean {
    return this.classList.contains("open");
  }

  /**Whether the user can open and close the row, false for a read only opened state */
  get #user_opens(): boolean {
    return !this.#opened || this.#opened.writable;
  }

  /**Shows or removes the sub rows, without writing the opened state */
  #show_open(open: boolean) {
    if (!this.openable) return;
    if (open && this.#child_box.childElementCount === 0) {
      const rows = this.#drop_rows ?? this.#sub_rows?.();
      this.#drop_rows = undefined;
      if (rows) this.rows = rows;
    } else if (!open && this.open) this.rows = [];
  }

  /**Stops following the opened state */
  #opened_detach() {
    if (!this.#opened) return;
    this.detach_state_from_symbol(OPENED);
    this.#opened = undefined;
    this.#opened_value = false;
  }

  //       _____ ______          _____   _____ _    _
  //      / ____|  ____|   /\   |  __ \ / ____| |  | |
  //     | (___ | |__     /  \  | |__) | |    | |__| |
  //      \___ \|  __|   / /\ \ |  _  /| |    |  __  |
  //      ____) | |____ / ____ \| | \ \| |____| |  | |
  //     |_____/|______/_/    \_\_|  \_\\_____|_|  |_|

  /**Whether the search hides the row, by its own answer or as its parent is hidden */
  get search_hidden(): boolean {
    return this.#hidden;
  }

  /**How the search applies to the row, decided by its parent */
  get #search_mode(): ListSearchMode {
    const parent = this.#parent;
    if (parent instanceof ListRow) return parent.#rows_mode;
    return this.#root.search ? "filter" : "all";
  }

  /**How the search applies to the sub rows */
  get #rows_mode(): ListSearchMode {
    if (this.#hidden) return "hide";
    return this.#found === "below" ? "filter" : "all";
  }

  /**Gets the answer of the row to the search and hides or shows it */
  #search_find() {
    const mode = this.#search_mode;
    const query = this.#root.search;
    this.#found =
      mode === "filter" && query ? this.#search_answer(query) : undefined;
    this.#search_mark();
    const hidden = mode === "hide" || this.#found === "none";
    if (hidden === this.#hidden) return;
    this.#hidden = hidden;
    this.classList.toggle("search-hidden", hidden);
    this.#selection_update();
  }

  /**Highlights the cells and the key field text the answer of the row found the text in */
  #search_mark() {
    const found = typeof this.#found === "object" ? this.#found : undefined;
    if (!found && !this.#marked) return;
    this.#marked = Boolean(found);
    this.#root.columns_visible.forEach((key, i) =>
      this.#cells[i]?.classList.toggle(
        "search-found",
        Boolean(found?.columns?.includes(key)),
      ),
    );
    if (this.#key_field) this.#key_field.found = Boolean(found?.key);
  }

  /**The answer of the search row option, or else the values and the key field text that have the text */
  #search_answer(query: ListSearchQuery): ListSearchResult<T> {
    if (this.#invalid) return "none";
    if (this.#search) return this.#search(query);
    const values: Partial<Record<keyof T, ListSearchValue>> = {};
    for (const key of this.#root.columns_visible) {
      const column = this.#root.columns.get(key)!;
      const raw = this.#values[key];
      const value = column.search_value
        ? column.search_value(raw)
        : list_search_plain(raw);
      //An enum value is shown by its name, which the search text matches
      values[key] =
        column.type === "enum" &&
        column.choices &&
        (typeof value === "string" || typeof value === "number")
          ? { value, text: column.choices[value]?.name ?? String(value) }
          : value;
    }
    const key = list_search_plain(this.#key_text);
    return (
      query.match(values, typeof key === "string" ? key : undefined) ?? "none"
    );
  }

  /**Opens the row through the root when the search found something below it, or closes a row the search opened once it no longer does */
  #search_open_update() {
    if (this.#found === "below") {
      if (!this.open && this.openable) this.#root.search_queue(this);
    } else if (this.#search_opened) {
      this.#search_opened = false;
      //An opened state that is true keeps it open
      if (!this.#opened_value) this.#show_open(false);
    }
  }

  /**Opens the row for the search, called by the root breadth first, returns whether it opened */
  search_open(): boolean {
    if (this.#found !== "below" || this.open || !this.openable) return false;
    this.#search_opened = true;
    this.#show_open(true);
    return true;
  }

  /**Applies a changed search of the list to the row and the rows below it */
  search_apply() {
    const before = this.#rows_mode;
    this.#search_find();
    this.#search_open_update();
    const mode = this.#rows_mode;
    //Sub rows that stay all shown or all hidden do not change, filtered sub rows are asked again
    if (mode !== before || mode === "filter") this.#search_sub_rows();
  }

  #search_sub_rows() {
    for (let row = this.first_sub_row; row; row = row.next_row)
      row.search_apply();
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
      //A row that can only be opened, like a folder of selectable rows, opens and closes instead
      //Only on the first click of a double click, so a double click opens a folder and leaves it open
      else if (this.openable) {
        if (e.detail <= 1) this.open = !this.open;
      } else selection.on_error?.(this, not_selectable());
    };
    //Shift click would select text between the rows
    this.#field_box.onmousedown = (e) => {
      if (e.shiftKey && selection.multi) e.preventDefault();
    };
  }

  /**Registers the row in the selection with the key of its data, or removes it when not selectable or hidden by the search
   * A hidden row is not visible, its key stays in the state like that of a row that is closed away */
  #selection_update() {
    const selection = this.#root.selection;
    if (!selection) return;
    const key: unknown =
      this.#selectable && !this.#hidden ? selection.key(this.#data) : undefined;
    if (key === this.selection_key) return;
    if (this.selection_key !== undefined)
      selection.unregister(this.selection_key, this);
    this.selection_key = key;
    if (key !== undefined) selection.register(key, this);
    this.classList.toggle("selectable", key !== undefined);
  }

  /**Context menu line to open or close the sub rows of an openable row, open all and close all of the list come after it
   * A row with a read only opened state has no open or close line, the user can not change it */
  #open_lines(): ContextMenuLines {
    if (!this.openable || !this.#user_opens) return [];
    return [
      this.open
        ? ctm.line({ text: "Close", on_click: () => (this.open = false) })
        : ctm.line({ text: "Open", on_click: () => (this.open = true) }),
    ];
  }

  /**Context menu line to select or deselect the row, select all and deselect all of the list come after it
   * Empty when the row can not be selected */
  #selection_lines(): ContextMenuLines {
    const selection = this.#root.selection;
    const key = this.selection_key;
    if (!selection || key === undefined) return [];
    return [
      selection.is_selected(key)
        ? ctm.line({
            text: "Deselect",
            on_click: () => selection.deselect(key),
          })
        : ctm.line({ text: "Select", on_click: () => selection.select(key) }),
    ];
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

/**Applies rows to a row box, removed rows leave the selection, which updates once after all changes
 * Rows the search opens wait until all rows are applied, so the search opens breadth first instead of deep into the first row */
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
  root.search_hold(() =>
    root.selection ? root.selection.batch(apply) : apply(),
  );
}
