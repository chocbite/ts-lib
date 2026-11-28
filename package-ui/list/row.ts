import { Base, define_element } from "#base";
import ctm, { ContextMenu, type ContextMenuLines } from "#context_menu";
import { NiceError, none, some, type Option } from "@chocbite/ts-lib/result";
import { list_errors } from "./errors";
import {
  state,
  type State,
  type StateInferSub,
  type StateOrVal,
  type StateResult,
  type StateSub,
} from "@chocbite/ts-lib/state";
import { ListAddRow, type ListAddRowOptions } from "./add_row";
import type { ListDragField } from "./drag";
import { list_rows_error_update, ListError, type ListRowsError } from "./error";
import { list_align_apply, list_cell } from "./field";
import { ListKeyField, type ListKeyFieldOptions } from "./key_field";
import "./row.scss";
import {
  list_search_plain_value,
  list_search_read,
  type ListSearchMode,
  type ListSearchQuery,
  type ListSearchResult,
  type ListSearchValue,
} from "./search";
import { ListCheckField, type ListSelection } from "./selection";
import { list_rows_shown, ListRowGroup } from "./group";
import { list_sort_source, list_sort_value, type ListSortValue } from "./sort";
import type {
  ListColumnOptions,
  ListParentRows,
  ListRoot,
  ListRowsParent,
  ListRowTransformer,
  ListType,
} from "./types";

/**Shown when the user tries to select a row that can not be selected */
/**The error of selecting a row that can not be selected*/
const not_selectable = () =>
  new NiceError(list_errors.NOT_SELECTABLE, "This row cannot be selected");

export type ListSubRows<R> = () => StateOrVal<R[]>;

/**The sub rows of a row without a group, shared so rows without sub rows make nothing */
const NO_ROWS: readonly never[] = Object.freeze([]);
/**Whether two lists of sort values are the same */
const list_sort_same = (
  a: readonly ListSortValue[],
  b: readonly ListSortValue[],
) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

/**The sort values of a row while the list does not sort */
const NO_VALUES: readonly never[] = Object.freeze([]);

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
  implements ListRowsParent<A>
{
  static element_name() {
    return "row";
  }
  static element_name_space(): string {
    return "list";
  }
  #root: ListRoot<R, T, A, S>;
  #parent: ListRowsParent<A>;
  #sub_rows?: ListSubRows<R>;
  readonly depth: number;
  /**The sub rows, in the row box after the row, made once the row first has sub rows, see group */
  #group?: ListRowGroup<R, T, A, S>;
  /**Whether the row is the last its parent shows, its tree line ends in it */
  #last = false;
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
  /**Subscribers to the states the answer of the row read, while the search reads them */
  #search_subs?: StateSub<any>[];
  /**Whether a state the answer of the row read changed, or its data while it was held, it answers again at a frame, see search_settle */
  #search_stale = false;
  /**Opened by the search, closed again when the search no longer opens it */
  #search_opened = false;
  #state_sub?: StateInferSub<State<R[]>>;
  state!: ListParentRows<A>;
  /**Values of the row by the columns of the sort of the list, the values it is placed with, empty while the list does not sort
   * Read when the data or the sort changes and when a state the row follows for them changes, see sort_settle */
  sort_values: readonly ListSortValue[] = NO_VALUES;
  /**Values the row is not placed with yet, from a state it follows or held while it changed, the list places it with them at a frame, see sort_settle */
  #sort_next?: readonly ListSortValue[];
  /**Subscribers to the states the values of the row are read from, while the list sorts by them */
  #sort_subs?: StateSub<any>[];

  /**The row holds only its cells, its sub rows, error and add row follow it in the row box of the list, see ListRowGroup */
  constructor(root: ListRoot<R, T, A, S>, parent: ListRowsParent<A>, data: R) {
    super();
    this.#root = root;
    this.#parent = parent;
    this.depth = parent.depth + 1;
    if (this.#root.sub_rows) {
      this.#key_field = new ListKeyField(this, parent.lines);
      if (this.#root.observer)
        this.#key_field.attach_to_intersect_observer(this.#root.observer);
    }
    this.#field_box = this.appendChild(document.createElement("div"));
    if (this.#root.reorder) this.#drag = this.#root.reorder.handle(this);
    if (this.#root.selection) this.#selection_setup(this.#root.selection);
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
    for (const row of this.#children) row.columns_changed();
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

  /**The next or previous row of the same parent in the order shown that the search does not hide */
  adjacent_shown(direction: 1 | -1): ListRow<R, T, A, S> | undefined {
    const rows = this.#parent.group.shown;
    return list_rows_shown(rows, rows.indexOf(this) + direction, direction);
  }

  /**The first or last sub row in the order shown that the search does not hide */
  #shown_sub_row(first: boolean): ListRow<R, T, A, S> | undefined {
    const rows = this.#group?.shown ?? NO_ROWS;
    return first
      ? list_rows_shown(rows, 0, 1)
      : list_rows_shown(rows, rows.length - 1, -1);
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
    this.#sort_values_update(false);
    this.#selectable = row_options.selectable ?? true;
    //Before the sub rows are refreshed, they are searched by how the search applies to them now
    const rows_mode = this.#rows_mode;
    //A held row keeps its answer until it is let go, so it does not disappear under the user
    if (this.#root.search && this.#root.held(this)) this.#search_changed();
    else this.#search_find();
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
    //Its sub rows, add row and error are not in the row, a right click on one without a menu of its own reaches the list
    ctm.detach(this);
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
    if (menu) ctm.attach(this, menu);
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
    if (!this.#invalid) {
      this.#invalid = new ListError();
      this.#show_invalid();
    }
    this.#invalid.text = text;
    this.#sort_values_update(false);
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
      ? ListAddRow.create<
          ListAddRow<R, T, A, S>,
          [ListRoot<R, T, A, S>, ListRowsParent<A>]
        >(options, this.#root, this)
      : undefined;
    //Last in the block of the row, after the sub rows and the error
    if (this.#add_row && this.parentElement)
      (this.#error ?? this.#group?.end() ?? this).after(this.#add_row);
    this.classList.toggle("addrow", Boolean(options));
    //With an add row below them none of the sub rows is the last
    if (this.#group) this.#group.tail = Boolean(options);
    this.#tail_update();
  }

  /**Shows the add row while the row is open, the error and add row are not in the row, so they are hidden with it while the search hides it
   * An error without an add row after it is the last, its tree line ends in it*/
  #tail_update() {
    if (this.#add_row) {
      this.#add_row.classList.toggle("closed", !this.open);
      this.#add_row.classList.toggle("search-hidden", this.#hidden);
    }
    if (this.#error) {
      this.#error.classList.toggle("search-hidden", this.#hidden);
      this.#error.classList.toggle("last", !this.#add_row);
    }
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
    if (open && this.#children.length === 0) {
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
    this.#search_stale = false;
    if (this.#search_subs) {
      for (const sub of this.#search_subs) this.detach_state(sub);
      this.#search_subs = undefined;
    }
    const mode = this.#search_mode;
    const query = this.#root.search;
    this.#found =
      mode === "filter" && query ? this.#search_answer(query) : undefined;
    this.#search_mark();
    const hidden = mode === "hide" || this.#found === "none";
    if (hidden === this.#hidden) return;
    this.#hidden = hidden;
    this.classList.toggle("search-hidden", hidden);
    this.#tail_update();
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

  /**The answer of the search row option, or else the values and the key field text that have the text
   * Without an answer of its own the row follows the states it read, while the search reads them, and answers again when one changes */
  #search_answer(query: ListSearchQuery): ListSearchResult<T> {
    if (this.#invalid) return "none";
    if (this.#search) return this.#search(query);
    const reads = this.#root.search_reads;
    const values: Partial<Record<keyof T, ListSearchValue>> = {};
    for (const key of this.#root.columns_visible) {
      if (reads && !reads.has(key)) continue;
      const column = this.#root.columns.get(key)!;
      //Inline for plain values, as every cell of every row is read at every search
      const raw = this.#values[key];
      const source = column.search_value ? column.search_value(raw) : raw;
      const value = state.is.state(source)
        ? this.#search_follow(column, source)
        : column.search_value
          ? (source as ListSearchValue)
          : list_search_plain_value(source);
      //An enum value is shown by its name, which the search text matches
      values[key] =
        column.type === "enum" &&
        column.choices &&
        (typeof value === "string" || typeof value === "number")
          ? { value, text: column.choices[value]?.name ?? String(value) }
          : value;
    }
    const text = this.#key_text;
    const key =
      reads || text === undefined
        ? undefined
        : state.is.state(text)
          ? this.#search_follow(undefined, text)
          : text;
    return (
      query.match(values, typeof key === "string" ? key : undefined) ?? "none"
    );
  }

  /**The value of a state the search reads of a column, or of the key field without a column, the row follows the state and answers again when its value changes */
  #search_follow(
    column: ListColumnOptions<any, Base> | undefined,
    source: State<unknown>,
  ): ListSearchValue {
    const read = (result: StateResult<unknown> | undefined) =>
      result?.ok ? list_search_read(column, result.value) : undefined;
    let seen = read(source.rsync ? source.get?.() : undefined);
    //A state gives its value right away when the row is in the row box, so only a value other than the one read is a change
    (this.#search_subs ??= []).push(
      this.attach_state(source, (result) => {
        const value = read(result);
        if (Object.is(value, seen)) return;
        seen = value;
        this.#search_changed();
      }),
    );
    return seen;
  }

  /**A state the answer of the row read changed, or its data while it was held, the list has it answer again at a frame */
  #search_changed() {
    if (this.#search_stale) return;
    this.#search_stale = true;
    this.#root.live_changed(this);
  }

  /**Answers the search again after a state the answer read changed, true when that showed or hid the row */
  search_settle(): boolean {
    if (!this.#search_stale) return false;
    const hidden = this.#hidden;
    this.search_apply();
    return hidden !== this.#hidden;
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
    //In the order shown, so the rows the search opens open from the top
    for (const row of this.#group?.shown ?? NO_ROWS) row.search_apply();
    this.#group?.last_update();
  }

  //       _____  ____  _____ _______
  //      / ____|/ __ \|  __ \__   __|
  //     | (___ | |  | | |__) | | |
  //      \___ \| |  | |  _  /  | |
  //      ____) | |__| | | \ \  | |
  //     |_____/ \____/|_|  \_\ |_|

  /**Reads the values of the row for a changed sort of the list, and sorts its sub rows by it */
  sort_update() {
    this.#sort_values_update(true);
    this.#group?.sort_update();
  }

  /**The rows the row is among, the group of its parent */
  get parent_group(): ListRowGroup<R, T, A, S> {
    return this.#parent.group as ListRowGroup<R, T, A, S>;
  }

  /**Takes the values the row is not placed with yet as the values it is placed with, the list then places it, true when they sort differently */
  sort_settle(): boolean {
    const next = this.#sort_next;
    if (!next) return false;
    this.#sort_next = undefined;
    const changed = !list_sort_same(next, this.sort_values);
    this.sort_values = next;
    return changed;
  }

  /**Reads the values of the row by the columns of the sort, the text of the key field for the key field, an invalid row has none, so it sorts as a row without values
   * The row follows the states it reads values from while the list sorts by them, a held row keeps the values it is placed with until it is let go
   * @param sort_changed whether the sort of the list changed, the values the row is placed with are then for other columns, so it is never held */
  #sort_values_update(sort_changed: boolean) {
    if (this.#sort_subs) {
      for (const sub of this.#sort_subs) this.detach_state(sub);
      this.#sort_subs = undefined;
    }
    const sort = this.#root.sort;
    let values: readonly ListSortValue[] = NO_VALUES;
    let follow: [number, State<unknown>][] | undefined;
    if (sort && this.#invalid) values = sort.map(() => undefined);
    else if (sort)
      values = sort.map((sorted, i) => {
        const source = list_sort_source(
          sorted.column,
          sorted.column ? this.#values[sorted.key] : this.#key_text,
        );
        if (!state.is.state(source))
          return list_sort_value(sorted.column, source);
        (follow ??= []).push([i, source]);
        const now = source.rsync ? source.get?.() : undefined;
        return now?.ok ? list_sort_value(sorted.column, now.value) : undefined;
      });
    if (!sort_changed && sort && this.#root.held(this)) {
      this.#sort_next = list_sort_same(values, this.sort_values)
        ? undefined
        : values;
      if (this.#sort_next) this.#root.live_changed(this);
    } else {
      this.sort_values = values;
      this.#sort_next = undefined;
    }
    //Subscribed after the values are set, a state gives its value right away when the row is in the row box
    if (follow)
      this.#sort_subs = follow.map(([index, source]) =>
        this.attach_state(source, (result) =>
          this.#sort_live(index, sort![index].column, result),
        ),
      );
  }

  /**A state the row reads a value of the sort from changed, the list places the row with it at a frame */
  #sort_live(
    index: number,
    column: ListColumnOptions<any, Base> | undefined,
    result: StateResult<unknown>,
  ) {
    const value = result.ok ? list_sort_value(column, result.value) : undefined;
    const latest = this.#sort_next ?? this.sort_values;
    if (Object.is(latest[index], value)) return;
    const next = [...latest];
    next[index] = value;
    this.#sort_next = next;
    this.#root.live_changed(this);
  }

  //      _____   ______          _______
  //     |  __ \ / __ \ \        / / ____|
  //     | |__) | |  | \ \  /\  / / (___
  //     |  _  /| |  | |\ \/  \/ / \___ \
  //     | | \ \| |__| | \  /\  /  ____) |
  //     |_|  \_\\____/   \/  \/  |_____/

  /**Index of the row in the rows of its parent */
  get index(): number {
    return this.#siblings.indexOf(this);
  }

  /**The rows of the parent of the row, it included */
  get #siblings(): readonly ListRow<R, T, A, S>[] {
    return this.#parent.group.rows;
  }

  /**The sub rows, in the order of the data */
  get #children(): readonly ListRow<R, T, A, S>[] {
    return this.#group?.rows ?? NO_ROWS;
  }

  /**The sub rows, made the first time, so a row that never has sub rows has none, which is most rows of most lists */
  get group(): ListRowGroup<R, T, A, S> {
    if (!this.#group) {
      this.#group = new ListRowGroup<R, T, A, S>(
        this.#root,
        (data) => new ListRow<R, T, A, S>(this.#root, this, data),
        { after: this },
      );
      this.#group.tail = Boolean(this.#add_row);
    }
    return this.#group;
  }

  amount_rows(rec: boolean = false): number {
    let count = this.#children.length;
    if (rec) for (const row of this.#children) count += row.amount_rows(true);
    return count;
  }

  /**Whether the row is the last its parent shows, set by the rows of the parent, its tree line ends in it and the lines below it no longer run on */
  set last(last: boolean) {
    if (last === this.#last) return;
    this.#last = last;
    this.classList.toggle("last", last);
    if (this.#root.sub_rows) this.#lines_below(this.depth, !last);
  }

  /**The lines above the row and its own, which runs on past its sub rows unless it is the last */
  get lines(): readonly boolean[] {
    return [...this.#parent.lines, !this.#last];
  }

  /**Shows or hides the tree line of a depth in everything below the row, it does not inherit, as the sub rows are not in the row */
  #lines_below(depth: number, shown: boolean) {
    for (const row of this.#children) {
      row.#key_field?.line(depth, shown);
      row.#lines_below(depth, shown);
    }
    this.#error?.line(depth, shown);
    this.#add_row?.line(depth, shown);
  }

  /**Puts the row with what follows it, its sub rows, error and add row, into the node in the order they are shown, which takes them out of the row box */
  block_nodes(into: DocumentFragment) {
    into.append(this);
    this.#group?.nodes(into);
    if (this.#error) into.append(this.#error);
    if (this.#add_row) into.append(this.#add_row);
  }

  /**The last node of the row and what follows it */
  block_end(): ChildNode {
    return this.#add_row ?? this.#error ?? this.#group?.end() ?? this;
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
      //After the sub rows and before the add row, a row that is not in the row box yet brings it along
      (element) => {
        if (this.parentElement) (this.#group?.end() ?? this).after(element);
      },
      this.#error,
      error,
      this.#root,
      this,
    );
    this.classList.toggle("open", rows.length > 0 || error !== undefined);
    //A row that never had sub rows has nothing to remove
    if (rows.length || this.#group) this.group.apply(rows);
    this.#tail_update();
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
    const rows = this.#siblings;
    return rows[rows.indexOf(this) + 1];
  }

  get first_sub_row(): ListRow<R, T, A, S> | undefined {
    return this.#children[0];
  }

  /**The sub rows in the order shown */
  get sub_rows_list(): readonly ListRow<R, T, A, S>[] {
    return this.#group?.shown ?? NO_ROWS;
  }

  /**The rows of the parent the row is in, the rows of the parent row or the top rows of the list */
  get sibling_rows(): readonly ListRow<R, T, A, S>[] {
    return this.#siblings;
  }

  /**Whether the row has a handle and its parent rows can be written, never while the list sorts, as the sort decides the order */
  get movable(): boolean {
    return this.classList.contains("movable") && !this.#root.sort;
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
    for (const row of this.#children) row.selection_leave();
  }
}
define_element(ListRow);
