import {
  Base,
  define_element,
  input_key,
  type BaseIntersectObserver,
  type BaseOptions,
} from "#base";
import ctm, { type ContextMenuLines } from "#context_menu";
import type { SVGFunc } from "#svg";
import { px_to_rem } from "#theme";
import {
  state,
  type StateOrVal,
  type StateREA,
  type StateResult,
} from "@chocbite/ts-lib/state";
import { ListAddRow, type ListAddRowOptions } from "./add_row";
import { ListDragField, ListReorder, type ListReorderOptions } from "./drag";
import "./container.scss";
import { list_rows_error_update, type ListRowsError } from "./error";
import { list_align_apply } from "./field";
import { ListRowGroup } from "./group";
import { ListRow } from "./row";
import {
  list_filter_columns,
  list_filter_prune,
  list_is_group,
  list_search_query,
  type ListCondition,
  type ListFilterItem,
  ListSearchBar,
  ListSearchEmpty,
  type ListFilter,
} from "./search";
import { list_search_cell, type ListSearchCell } from "./search_cell";
import { list_advanced_search, type ListAdvancedColumn } from "./advanced";
import {
  ListCheckField,
  ListSelection,
  type ListSelectionOptions,
} from "./selection";
import "./shared";
import {
  LIST_SORT_KEY_FIELD,
  list_sort_icon,
  list_sortable,
  type ListSort,
  type ListSortColumn,
  type ListSortDirection,
} from "./sort";
import { ListWarn } from "./warn";
import type {
  ListColumnOptions,
  ListRoot,
  ListRowsParent,
  ListRowTransformer,
  ListType,
} from "./types.ts";

/**Most rows open all or the search opens at a time, a mistake making the sub rows recursive would otherwise never end */
const OPEN_LIMIT = 1000;
/**Milliseconds from applying the changed values of rows until the next frame above which it counts as slow, about three frames
 * Moving or hiding rows restyles every row of the list, on a list of thousands of rows that takes several frames */
const LIVE_SLOW_FRAME = 50;
/**After a slow frame the changed values are applied again once this many times its time has passed, so they take at most about a quarter of the time */
const LIVE_SLOW_WAIT = 4;

class HeaderField extends Base {
  static element_name() {
    return "headerfield";
  }
  static element_name_space(): string {
    return "list";
  }

  #box = this.appendChild(document.createElement("div"));
  #text = this.#box.appendChild(document.createElement("span"));
  #sizer?: HTMLDivElement;
  #search_cell?: Element;
  /**Icon of the direction the column sorts in, with its place among the sorted columns, while it sorts */
  #sort?: HTMLSpanElement;

  constructor(text?: string) {
    super();
    if (text) this.text = text;
  }

  /**Elements shown instead of the text */
  set nodes(nodes: Node[]) {
    this.#text.replaceChildren(...nodes);
  }

  set text(value: string) {
    this.#text.textContent = value;
  }

  /**The title with the handle resizing the column, without the cell of the column search */
  get title_box(): HTMLElement {
    return this.#box;
  }

  /**Called at a click on the title, not on the handle resizing the column, undefined for none */
  set on_title_click(handler: ((e: MouseEvent) => void) | undefined) {
    this.#box.onclick = handler
      ? (e) => {
          if (!this.#sizer?.contains(e.target as Node)) handler(e);
        }
      : null;
    //Shift click would select the text of the headers
    this.#box.onmousedown = handler
      ? (e) => {
          if (e.shiftKey) e.preventDefault();
        }
      : null;
  }

  /**Shows the icon of the direction the column sorts in, after the title, undefined while it does not sort
   * @param place the place of the column among the sorted columns, shown while several sort */
  sort_show(icon: SVGFunc | undefined, place: number | undefined) {
    if (!icon) {
      this.#sort?.remove();
      this.#sort = undefined;
      return;
    }
    if (!this.#sort) {
      this.#sort = document.createElement("span");
      this.#sort.className = "sort";
      this.#box.insertBefore(this.#sort, this.#sizer ?? null);
    }
    this.#sort.replaceChildren(icon());
    if (place !== undefined)
      this.#sort.appendChild(document.createElement("span")).textContent =
        String(place);
  }

  /**Cell of the column search under the title, undefined removes it */
  set search_cell(cell: Element | undefined) {
    this.#search_cell?.remove();
    this.#search_cell = cell;
    if (cell) this.appendChild(cell);
  }

  sizable(sizeable: boolean, sizer: (width: number | undefined) => void) {
    if (sizeable) {
      this.#sizer = this.#box.appendChild(document.createElement("div"));
      let double_timeout: number;
      this.#sizer.onpointerdown = (e) => {
        e.preventDefault();
        if (double_timeout) {
          sizer(undefined);
          return;
        }
        double_timeout = window.setTimeout(() => {
          double_timeout = 0;
        }, 300);
        this.setPointerCapture(e.pointerId);
        const handle = e.currentTarget as HTMLElement;
        handle.classList.add("active");
        const start_x = e.pageX;
        const start_width = this.#box.offsetWidth;
        this.onpointermove = (ev: PointerEvent) => {
          sizer(px_to_rem(start_width + (ev.pageX - start_x)));
        };
        //A cancel or lost capture also ends the resize, a touch the browser takes for something else cancels
        const end = () => {
          if (this.hasPointerCapture(e.pointerId))
            this.releasePointerCapture(e.pointerId);
          handle.classList.remove("active");
          this.onpointermove = null;
          this.onpointerup = null;
          this.onpointercancel = null;
          this.onlostpointercapture = null;
        };
        this.onpointerup = end;
        this.onpointercancel = end;
        this.onlostpointercapture = end;
      };
    } else if (this.#sizer) {
      this.#sizer.remove();
      this.#sizer = undefined;
    }
  }
}
define_element(HeaderField);

class HeaderRow<
  R,
  T extends {},
  A extends ListType<R>,
  S extends boolean,
> extends Base {
  static element_name() {
    return "headerrow";
  }
  static element_name_space(): string {
    return "list";
  }

  set fields(fields: HeaderField[]) {
    const lead: HTMLElement[] = [];
    if (this.#drag_header) lead.push(this.#drag_header);
    if (this.#check_header) lead.push(this.#check_header);
    if (this.#key_header) lead.push(this.#key_header);
    this.replaceChildren(...lead, ...fields);
  }

  /**Header of the key field column, only with sub rows */
  get key_header(): HeaderField | undefined {
    return this.#key_header;
  }

  /**Header of the key field column, only with sub rows */
  #key_header?: HeaderField;
  /**Empty header of the drag handle column */
  #drag_header?: ListDragField;
  /**Header of the checkbox or radio button column, in multi mode it selects or deselects all rows */
  #check_header?: ListCheckField;

  /**@param titles false for a row of only the column search, in a headless list */
  constructor(
    root: ListRoot<R, T, A, S>,
    key_sizer: (width: number | undefined) => void,
    titles: boolean,
  ) {
    super();
    this.classList.toggle("titleless", !titles);
    if (root.sub_rows) {
      const key = (this.#key_header = new HeaderField());
      key.classList.add("key");
      const button = (kind: string, action: () => void) => {
        const span = document.createElement("span");
        span.className = `list-${kind}-all`;
        //Not a click on the key header, which sorts
        span.onclick = (e) => {
          e.stopPropagation();
          action();
        };
        return span;
      };
      key.nodes = [
        button("close", () => root.close_all()),
        button("open", () => root.open_all()),
      ];
      key.sizable(true, key_sizer);
    }
    if (root.reorder) this.#drag_header = new ListDragField();
    const selection = root.selection;
    if (selection?.column) this.#check_header = new ListCheckField();
    //The headers have the menu of the list, from the container
    if (selection?.multi) {
      const check = this.#check_header!;
      check.onclick = () => {
        if (selection.amount_selected > 0) selection.clear();
        else selection.select_all();
      };
      selection.on_change = () => {
        const selected = selection.amount_selected;
        check.classList.toggle("some", selected > 0);
        check.classList.toggle(
          "all",
          selected > 0 && selected === selection.amount_selectable,
        );
      };
    }
  }
}
define_element(HeaderRow);

/**Columns of a list by column key, each giving its fields values of the type of its key*/
export type ListColumns<T extends {}> = {
  [C in keyof T]: ListColumnOptions<T[C], any>;
};

/**Configuration of a list, fixed for its life, as the header, the lead columns and the rows are built from it*/
export interface ListContainerConfig<T extends {}, R, S extends boolean, K> {
  /**Turns the data of a row into its options, with a value per column key */
  transform: ListRowTransformer<R, NoInfer<T>, ListType<R>, S>;
  /**Leaves out the header row */
  headless?: boolean;
  /**Lets rows have sub rows */
  sub_rows?: S;
  /**Observer given to every field, so the states of a field are only subscribed while it is in view */
  observer?: BaseIntersectObserver;
  /**Lets the user select rows, only rows that are visible can be selected, the selected keys are the selected input */
  selection?: ListSelectionOptions<R, K>;
  /**Lets the user move rows with a drag handle in front of the rows, rows in a writable array state can be moved */
  reorder?: ListReorderOptions<R>;
  /**Milliseconds the search waits after its text changes, so typing searches once the user pauses instead of at every key, 200 by default, 0 searches right away
   * The first text of the search input, and enter, the clear button and escape in the search bar search without waiting */
  search_delay?: number;
  /**Adds lines to the menus of the list, of the rows, the headers and the list itself, to show or hide the column search and to clear the search */
  search_menu?: boolean;
}

/**Inputs of a list, written by hand as the list is generic in its rows and columns*/
export interface ListContainerOptions<T extends {}, R, K> extends BaseOptions {
  /**Columns by column key, a plain value, with the keys and value types the list was created with, as the transform gives values for them */
  columns?: ListColumns<T>;
  /**Rows of the list, an array or an array state, an error of the state shows as the error row */
  rows?: StateOrVal<R[]>;
  /**Button below the rows, null removes it, options left out of a later set stay as they are */
  add_row?: ListAddRowOptions | null;
  /**Keys of the selected rows, needs the selection configuration
   * A fixed value is kept by the list and changed by the user, without it the list starts with none selected
   * A writable state is written with array write instructions when the user changes the selection, so it must apply them, like a local writable state
   * A read only state is only shown, a change by the user is refused with a warning */
  selected?: K[] | StateREA<K[], any, any>;
  /**Text the rows are searched for, an input the user changes like selected
   * A fixed value is where the search starts and the search bar changes it, a writable state is written by the search bar, a read only state locks the bar
   * Each row answers with its search row option, or matches when the text is in one of its values or its key field text, an empty or blank text shows all rows */
  search?: StateOrVal<string>;
  /**Shows a search bar above the list, which changes the search input, without it the search still applies */
  search_bar?: StateOrVal<boolean>;
  /**Conditions on the values of the columns, a row matches when it meets all of them and has the search text, an input the user changes like selected
   * The cells of the column search write it, conditions of columns the list does not have are left out, plain JSON so the app can store it */
  filter?: StateOrVal<ListFilter>;
  /**Shows the cells of the column search under the titles of the columns, an input the user changes, the lines of search_menu write it
   * Without it the filter still applies, in a headless list the cells show without titles */
  column_search?: StateOrVal<boolean>;
  /**Columns the rows are sorted by, an input the user changes like selected, the titles of the columns and their menus write it
   * Columns the list does not have or can not sort by are left out, plain JSON so the app can store it, an empty array shows the rows in the order of the data */
  sort?: StateOrVal<ListSort>;
}

/**Inputs of the list, loosely typed as keys can not be generic */
const CONTAINER = {
  columns: input_key<ListColumns<any>>(),
  rows: input_key<StateOrVal<unknown[]>>(),
  add_row: input_key<ListAddRowOptions | null>(),
  selected: input_key<StateOrVal<unknown[]>>(),
  search: input_key<StateOrVal<string>>(),
  search_bar: input_key<StateOrVal<boolean>>(),
  filter: input_key<StateOrVal<ListFilter>>(),
  column_search: input_key<StateOrVal<boolean>>(),
  sort: input_key<StateOrVal<ListSort>>(),
};

class Container<
  T extends {},
  R,
  S extends boolean = false,
  K = R,
  A extends ListType<R> = ListType<R>,
> extends Base {
  static element_name() {
    return "container";
  }
  static element_name_space() {
    return "list";
  }

  #root: ListRoot<R, T, A, S>;
  #selection?: ListSelection<K>;
  #parent: ListRowsParent<A>;
  #box = this.appendChild(document.createElement("div"));
  #header?: HeaderRow<R, T, A, S>;
  /**The row box, every row of the list in the order shown, sub rows after their row, see ListRowGroup */
  #child_box: HTMLDivElement;
  /**The top rows */
  #group: ListRowGroup<R, T, A, S>;
  #error?: ListRowsError<A>;
  #add_row?: ListAddRow<R, T, A, S>;
  /**Width of the key field column in rem set by resizing, fits the key fields when undefined */
  #key_width?: number;
  /**Shows why a write failed, or that open all stopped */
  #warn?: ListWarn;
  #search_bar?: ListSearchBar;
  /**Text of the search input */
  #search_text = "";
  /**Shown while the search hides every row */
  #search_empty?: ListSearchEmpty;
  /**Rows the search opens once the holds end, breadth first, see search_queue of the root */
  #search_queued: ListRow<R, T, A, S>[] = [];
  #search_holds = 0;
  /**See search_delay of the configuration */
  readonly #search_delay: number;
  /**Timer of a text waiting for the delay, 0 for none */
  #search_timer = 0;
  /**The next value of the search input is its first, searched without waiting */
  #search_first = false;
  /**Conditions of the filter input */
  #search_filter: ListFilter = { conditions: [] };
  /**The next value of the filter input is its first, searched without waiting */
  #filter_first = false;
  /**Text and conditions of the search the rows have, to skip searching the same again */
  #search_done = "";
  readonly #search_menu: boolean;
  readonly #headless: boolean;
  #column_search = false;
  /**Header fields of the visible columns */
  #header_fields: HeaderField[] = [];
  /**Cells of the column search by column key, while it is shown */
  #search_cells = new Map<string, ListSearchCell>();
  /**Columns of the sort input, also those the list leaves out */
  #sort: ListSort = [];
  /**The row with the focus and the rows it is below, see focus_rows of the root */
  readonly #live_focus = new Set<ListRow<R, T, A, S>>();
  /**Whether a pointer is pressed on the list, no row moves or disappears for changed values until it is let go */
  #live_pressed = false;
  /**Rows with values they are not sorted or searched by yet, applied at a frame unless held, see live_changed of the root */
  readonly #live_dirty = new Set<ListRow<R, T, A, S>>();
  /**The frame applying the changed values waits for, 0 for none */
  #live_frame = 0;
  /**The timeout applying the changed values waits for after a slow frame, 0 for none */
  #live_wait = 0;
  /**Time before which changed values are not applied again, after a slow frame */
  #live_next_at = 0;

  /**Builds the list from its configuration, the inputs come with set */
  constructor(config: ListContainerConfig<T, R, S, K>) {
    super();
    this.#root = {
      sub_rows: config.sub_rows ?? (false as S),
      columns: new Map(),
      columns_visible: [],
      transform: config.transform,
      observer: config.observer,
      search_hold: (func) => this.#search_hold(func),
      search_queue: (row) => this.#search_queue(row),
      has_menu: false,
      open_all_lines: () => this.#open_all_lines(),
      select_all_lines: () => this.#select_all_lines(),
      search_lines: () => this.#search_lines(),
      menu: () => this.#menu(),
      open_all: () => this.open_all(),
      close_all: () => this.close_all(),
      focus_rows: this.#live_focus,
      held: (row) =>
        row.isConnected && (this.#live_pressed || this.#live_focus.has(row)),
      live_changed: (row) => {
        this.#live_dirty.add(row);
        this.#live_schedule();
      },
    };
    this.#child_box = document.createElement("div");
    const parent: ListRowsParent<A> = {
      depth: -1,
      open: false,
      select_adjacent() {},
      state: [],
      lines: [],
      get group() {
        return group;
      },
    };
    const group = new ListRowGroup<R, T, A, S>(
      this.#root,
      (data) => new ListRow<R, T, A, S>(this.#root, parent, data),
      { start: this.#child_box },
    );
    this.#parent = parent;
    this.#group = group;
    //Shows why a write of the selection or a move failed
    const warn =
      config.selection || config.reorder || config.sub_rows
        ? new ListWarn(this)
        : undefined;
    this.#warn = warn;
    this.#search_delay = config.search_delay ?? 200;
    this.#search_menu = Boolean(config.search_menu);
    this.#headless = Boolean(config.headless);
    if (config.reorder) {
      this.#root.reorder = new ListReorder(this, config.reorder, warn!);
      this.#box.classList.add("drag");
    }
    if (config.selection) {
      this.#selection = new ListSelection(
        config.selection,
        this.#child_box,
        Boolean(config.sub_rows),
      );
      this.#root.selection = this.#selection;
      if (this.#selection.column) this.#box.classList.add("check");
      this.#box.classList.add(this.#selection.multi ? "multi" : "single");
      this.#selection.on_error = (row, error) =>
        warn!.show(row?.anchor ?? this.#header ?? this.#box, error.nice);
    }
    //Columns in front of the key field column, the error and add rows start after them
    const lead =
      Number(Boolean(config.reorder)) +
      Number(Boolean(this.#selection?.column));
    if (lead) this.#box.classList.add("lead-" + lead);

    this.#box.appendChild(this.#child_box);
    if (!config.headless) this.#make_header(true);
    //Every right click on the list that nothing in it has a menu for, on the headers, the search bar and its cells and outside the rows, gets the menu of the list
    //Rows put their own lines in front of it, a list without lines still takes the right click, so the browser menu never opens on a list
    this.#root.has_menu =
      Boolean(config.sub_rows) ||
      Boolean(this.#selection?.multi) ||
      this.#search_menu;
    ctm.attach(this, this.#menu);
    //Rows keep how they are sorted and searched while the user works with them, see held of the root
    this.addEventListener("focusin", (e) => this.#live_focus_update(e.target));
    this.addEventListener("focusout", () => this.#live_focus_update(null));
    this.addEventListener("pointerdown", () => this.#live_press(), true);
    if (config.sub_rows) this.#box.classList.add("sub-rows");
    //Without a selected input the selection is kept in a state of the list, under the key of the input so one given later replaces it
    const selection = this.#selection;
    if (selection) {
      const own = state.ok_w<K[]>([]);
      selection.target = own;
      this.attach_state_to_symbol(CONTAINER.selected, own, (value) =>
        selection.apply(value),
      );
    }
  }

  set(options: ListContainerOptions<T, R, K>): this {
    super.set(options);
    //Columns first, the rows are built with them
    this.set_input(CONTAINER.columns, options.columns, (columns) =>
      this.#set_columns(columns.value as ListColumns<T>),
    );
    if (options.rows !== undefined) this.#parent.state = options.rows as A;
    this.set_input(CONTAINER.rows, options.rows, (rows) =>
      rows.ok
        ? this.#update_rows(rows.value as R[])
        : this.#update_rows([], rows.error.nice),
    );
    this.set_input(CONTAINER.add_row, options.add_row, (add_row) =>
      this.#set_add_row(add_row.value),
    );
    if (options.selected !== undefined) this.#set_selected(options.selected);
    if (options.search !== undefined) this.#search_first = true;
    this.set_input(CONTAINER.search, options.search, (text) => {
      const first = this.#search_first;
      this.#search_first = false;
      this.#search_input(text.ok ? text.value : "", first);
    });
    if (options.search !== undefined) this.#search_lock();
    this.set_input(CONTAINER.search_bar, options.search_bar, (bar) =>
      this.#show_search_bar(bar.ok && bar.value),
    );
    if (options.filter !== undefined) this.#filter_first = true;
    this.set_input(CONTAINER.filter, options.filter, (filter) => {
      const first = this.#filter_first;
      this.#filter_first = false;
      this.#filter_input(filter.ok ? filter.value : { conditions: [] }, first);
    });
    if (options.filter !== undefined) this.#search_cells_update();
    this.set_input(CONTAINER.column_search, options.column_search, (show) =>
      this.#show_column_search(show.ok && show.value),
    );
    this.set_input(CONTAINER.sort, options.sort, (sort) =>
      this.#sort_input(sort.ok ? sort.value : []),
    );
    //A read only state locks the titles
    if (options.sort !== undefined) this.#sort_headers();
    return this;
  }

  #set_columns(columns: ListColumns<T>) {
    this.#root.columns.clear();
    const order = new Map<keyof T, number>();
    let index = 0;
    for (const key in columns) {
      //Copied, so resizing does not write into the callers options
      this.#root.columns.set(key, { ...columns[key as keyof T] });
      order.set(key, columns[key].order ?? index);
      index++;
    }
    this.#root.columns_visible = [...order.keys()].sort(
      (a, b) => order.get(a)! - order.get(b)!,
    );

    this.#header_fields_build();
    this.#update_column_widths();

    for (const row of this.#group.rows) row.columns_changed();
    this.#add_row?.columns_changed();
    this.#error?.columns_changed();
    //Conditions of columns the list no longer has, or now has, change the search
    this.#search();
    //The same for the sort, and the values the rows sort by can change with the columns
    this.#sort_apply();
  }

  /**Makes the header row, with titles, or in a headless list with only the column search */
  #make_header(titles: boolean) {
    this.#header = this.#box.insertBefore(
      new HeaderRow(
        this.#root,
        (width) => {
          this.#key_width = width;
          this.#update_column_widths();
        },
        titles,
      ),
      this.#box.firstChild,
    );
    //The key field has no column, it sorts by its text
    const key = this.#header.key_header;
    if (key) {
      key.on_title_click = (e) =>
        this.#sort_click(LIST_SORT_KEY_FIELD, e.shiftKey);
      ctm.attach(
        key.title_box,
        ctm.combine(() => this.#sort_lines(LIST_SORT_KEY_FIELD), this.#menu),
      );
    }
    this.#header_fields_build();
  }

  /**Makes the header fields of the visible columns and their cells of the column search */
  #header_fields_build() {
    const header_row = this.#header;
    if (!header_row) return;
    const headers = (this.#header_fields = this.#root.columns_visible.map(
      (key) => {
        const column = this.#root.columns.get(key)!;
        const header = new HeaderField(column.title);
        list_align_apply(header, column.align);
        header.sizable(typeof column.fixed_width === "undefined", (width) => {
          if (width !== undefined) this.#freeze_auto_widths(headers);
          column.init_width = width;
          this.#update_column_widths();
        });
        if (list_sortable(column))
          header.on_title_click = (e) =>
            this.#sort_click(String(key), e.shiftKey);
        //The lines to sort by the column, in front of the menu of the list, a column that can not be sorted has the line clearing the sort
        //Only on the title, the cell of the column search has the menu of the list
        ctm.attach(
          header.title_box,
          ctm.combine(() => this.#sort_lines(String(key)), this.#menu),
        );
        return header;
      },
    ));
    header_row.fields = headers;
    this.#search_cells_build();
    this.#sort_headers();
  }

  /**Gives the auto width columns their current width, so resizing one column does not resize the others
   * Only measures while there are auto width columns, so after the first resize a move does no layout here*/
  #freeze_auto_widths(headers: HeaderField[]) {
    const auto = this.#root.columns_visible.flatMap((key, i) => {
      const col = this.#root.columns.get(key)!;
      return col.fixed_width === undefined && !col.init_width ? [i] : [];
    });
    //Measured before any is set, setting one would change the layout of the rest
    const widths = auto.map((i) => px_to_rem(headers[i].offsetWidth));
    auto.forEach((i, j) => {
      this.#root.columns.get(this.#root.columns_visible[i])!.init_width =
        widths[j];
    });
  }

  /**Opens every openable row, level by level so the upper levels are open first
   * Stops with a warning after opening OPEN_LIMIT rows, against huge or recursive sub rows, opening all again continues */
  open_all() {
    let opened = 0;
    let level: readonly ListRow<R, T, A, S>[] = this.#top_rows();
    while (level.length) {
      const next: ListRow<R, T, A, S>[] = [];
      for (const row of level) {
        //Open all opens what can be seen
        if (row.search_hidden) continue;
        if (row.openable && !row.open) {
          if (opened >= OPEN_LIMIT) {
            this.#warn?.show(
              this.#header?.key_header ?? this.#box,
              `Stopped after opening ${OPEN_LIMIT} rows, open all again for more`,
            );
            return;
          }
          row.open = true;
          opened += row.amount_rows();
        }
        for (const sub of row.sub_rows_list) next.push(sub);
      }
      level = next;
    }
  }

  /**Closes every open row, sub rows before their parents, so every open row writes its opened state
   * Closing only the top rows would remove the rows below them with their states still open, which would open them again with their parents*/
  close_all() {
    const open: ListRow<R, T, A, S>[] = [];
    const collect = (row: ListRow<R, T, A, S>) => {
      if (!row.open) return;
      open.push(row);
      for (const sub of row.sub_rows_list) collect(sub);
    };
    for (const row of this.#top_rows()) collect(row);
    for (let i = open.length - 1; i >= 0; i--) open[i].open = false;
  }

  /**The top rows in the order shown */
  #top_rows(): readonly ListRow<R, T, A, S>[] {
    return this.#group.shown;
  }

  #open_rows(): ListRow<R, T, A, S>[] {
    return this.#top_rows().filter((row) => row.open);
  }

  #update_column_widths() {
    const widths: string[] = this.#root.columns_visible.map((key) => {
      const col = this.#root.columns.get(key)!;
      //Without a header nothing can resize, so init_width, the start of a resize, does not apply
      const width =
        col.fixed_width ?? (this.#headless ? undefined : col.init_width);
      if (width) {
        if (width === "min") return "min-content";
        else if (width === "max") return "max-content";
        return `${Math.max(width, 1)}rem`;
      }
      return "auto";
    });
    //The key fields get the width instead of the column, so it never gets smaller than its widest key field minimum
    //Without value columns it fills the list unless resized
    if (this.#root.sub_rows)
      widths.unshift(widths.length || this.#key_width ? "max-content" : "auto");
    this.#box.classList.toggle("key-sized", Boolean(this.#key_width));
    if (this.#key_width)
      this.#box.style.setProperty(
        "--list-key-width",
        `${Math.max(this.#key_width, 1)}rem`,
      );
    else this.#box.style.removeProperty("--list-key-width");
    if (this.#selection?.column) widths.unshift("var(--list-check-width)");
    if (this.#root.reorder) widths.unshift("var(--list-drag-width)");
    this.#box.style.gridTemplateColumns = widths.join(" ");
  }

  /**null removes the add row, options are passed on to it unchanged */
  #set_add_row(options: ListAddRowOptions | null) {
    if (!options) {
      this.#add_row?.remove();
      this.#add_row = undefined;
    } else if (this.#add_row) this.#add_row.set(options);
    else
      this.#add_row = this.#box.appendChild(
        ListAddRow.create<
          ListAddRow<R, T, A, S>,
          [ListRoot<R, T, A, S>, ListRowsParent<A>]
        >(options, this.#root, this.#parent),
      );
    this.#box.classList.toggle("addrow", Boolean(options));
    //With an add row below them none of the top rows is the last
    this.#group.tail = Boolean(options);
    this.#error?.classList.toggle("last", !options);
  }

  //      _____   ______          _______
  //     |  __ \ / __ \ \        / / ____|
  //     | |__) | |  | \ \  /\  / / (___
  //     |  _  /| |  | |\ \/  \/ / \___ \
  //     | | \ \| |__| | \  /\  /  ____) |
  //     |_|  \_\\____/   \/  \/  |_____/

  amount_rows(rec: boolean = false): number {
    let count = this.#group.rows.length;
    if (rec) for (const row of this.#group.rows) count += row.amount_rows(true);
    return count;
  }

  #update_rows(rows: readonly R[], error?: string) {
    this.#error = list_rows_error_update(
      //Not in the row box, which has only the rows and what follows each
      (element) => this.#child_box.after(element),
      this.#error,
      error,
      this.#root,
      this.#parent,
    );
    this.#error?.classList.toggle("last", !this.#add_row);
    this.#group.apply(rows);
    this.#search_empty_update();
  }

  //       _____ ______          _____   _____ _    _
  //      / ____|  ____|   /\   |  __ \ / ____| |  | |
  //     | (___ | |__     /  \  | |__) | |    | |__| |
  //      \___ \|  __|   / /\ \ |  _  /| |    |  __  |
  //      ____) | |____ / ____ \| | \ \| |____| |  | |
  //     |_____/|______/_/    \_\_|  \_\\_____|_|  |_|

  /**Shows a new text of the search input and searches for it after the delay, or right away */
  #search_input(text: string, now: boolean) {
    this.#search_text = text;
    if (this.#search_bar) this.#search_bar.value = text;
    this.#search_later(now);
  }

  /**Shows new conditions of the filter input and searches for them after the delay, or right away */
  #filter_input(filter: ListFilter, now: boolean) {
    this.#search_filter = filter;
    this.#search_cells_update();
    this.#search_later(now);
  }

  /**Searches after the delay, so a burst of changes searches once, or right away */
  #search_later(now: boolean) {
    window.clearTimeout(this.#search_timer);
    this.#search_timer = 0;
    if (now || this.#search_delay <= 0) this.#search();
    else
      this.#search_timer = window.setTimeout(() => {
        this.#search_timer = 0;
        this.#search();
      }, this.#search_delay);
  }

  /**Searches right away for a change waiting for the delay */
  #search_now() {
    if (this.#search_timer) this.#search_later(true);
  }

  /**Searches the rows for the text and the conditions, the top rows answer and pass the search on to their sub rows */
  #search() {
    //Conditions of columns the list does not have are left out, like after an update of the app
    const filter = list_filter_prune(this.#search_filter, (condition) =>
      this.#root.columns.has(condition.column as keyof T),
    );
    const query = list_search_query(this.#search_text, filter);
    //The same search again, like after enter, finds the same
    const done = query ? query.text + "\n" + JSON.stringify(query.filter) : "";
    if (done === this.#search_done) return;
    this.#search_done = done;
    this.#root.search = query;
    //Without text only the columns of the conditions are read, so only their states are followed
    this.#root.search_reads =
      query && !query.text ? list_filter_columns(query.filter) : undefined;
    const apply = () => {
      for (const row of this.#top_rows()) row.search_apply();
      this.#group.last_update();
    };
    this.#search_hold(() =>
      this.#selection ? this.#selection.batch(apply) : apply(),
    );
    this.#search_empty_update();
  }

  /**Locks the search bar while the search input is a read only state */
  #search_lock() {
    if (!this.#search_bar) return;
    const target = this.input_state(CONTAINER.search);
    this.#search_bar.read_only = target !== undefined && !target.writable;
  }

  #show_search_bar(show: boolean) {
    this.classList.toggle("search-bar", show);
    if (!show) {
      this.#search_bar?.remove();
      this.#search_bar = undefined;
      return;
    }
    if (this.#search_bar) return;
    const bar = (this.#search_bar = new ListSearchBar());
    bar.value = this.#search_text;
    bar.on_input = (text, now) => this.#write_text(text, now);
    this.insertBefore(bar, this.#box);
    this.#search_lock();
  }

  //Like any input the user changes, a writable state is written and the list follows it, without a state the list keeps the value
  //A state that writes right away gave the value back already, waiting for the delay, now searches without it
  #write_text(text: string, now: boolean) {
    const target = this.input_state(CONTAINER.search);
    if (!target) this.#search_input(text, now);
    else if (target.writable) {
      void target.write?.(text);
      if (now) this.#search_now();
    }
  }

  #write_filter(filter: ListFilter, now: boolean) {
    const target = this.input_state(CONTAINER.filter);
    if (!target) this.#filter_input(filter, now);
    else if (target.writable) {
      void target.write?.(filter);
      if (now) this.#search_now();
    }
  }

  #write_column_search(show: boolean) {
    const target = this.input_state(CONTAINER.column_search);
    if (!target) this.#show_column_search(show);
    else if (target.writable) void target.write?.(show);
  }

  /**Whether the user can change an input with the state, not for a read only state, undefined for a value the list keeps */
  #changeable(target: { readonly writable: boolean } | undefined): boolean {
    return target === undefined || target.writable;
  }

  /**The menu of the list, open all, select all and the search, a group each */
  #menu = ctm.combine(
    () => this.#open_all_lines(),
    () => this.#select_all_lines(),
    () => this.#search_lines(),
  );

  /**Lines of the menus of the list to open all rows, and close them while one is open, with sub rows */
  #open_all_lines(): ContextMenuLines {
    if (!this.#root.sub_rows) return [];
    const lines: ContextMenuLines = [
      ctm.line({ text: "Open all", on_click: () => this.open_all() }),
    ];
    if (this.#open_rows().length > 0)
      lines.push(
        ctm.line({ text: "Close all", on_click: () => this.close_all() }),
      );
    return lines;
  }

  /**Lines of the menus of the list to select and deselect all rows, in multi mode */
  #select_all_lines(): ContextMenuLines {
    const selection = this.#selection;
    if (!selection?.multi) return [];
    return [
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
    ];
  }

  /**Lines of the menus of the list to show or hide the column search and to clear the search */
  #search_lines(): ContextMenuLines {
    if (!this.#search_menu) return [];
    const lines: ContextMenuLines = [];
    const typed = this.#root.columns_visible.some(
      (key) => this.#root.columns.get(key)!.type !== undefined,
    );
    if (this.#changeable(this.input_state(CONTAINER.column_search)))
      if (this.#column_search)
        lines.push(
          ctm.line({
            text: "Hide column search",
            //A filter that can not be seen is not left filtering
            on_click: () => {
              this.#write_column_search(false);
              this.#write_filter({ conditions: [] }, true);
            },
          }),
        );
      else if (typed)
        lines.push(
          ctm.line({
            text: "Search columns",
            on_click: () => this.#write_column_search(true),
          }),
        );
    if (typed && this.#changeable(this.input_state(CONTAINER.filter)))
      lines.push(
        ctm.line({
          text: "Advanced search…",
          on_click: () => this.advanced_search(),
        }),
      );
    const text = this.#search_text.trim() !== "";
    const filtered = this.#search_filter.conditions.length > 0;
    if (
      (text && this.#changeable(this.input_state(CONTAINER.search))) ||
      (filtered && this.#changeable(this.input_state(CONTAINER.filter)))
    )
      lines.push(
        ctm.line({
          text: "Clear search",
          on_click: () => {
            this.#write_text("", true);
            this.#write_filter({ conditions: [] }, true);
          },
        }),
      );
    return lines;
  }

  /**Opens the advanced search, a dialog editing the filter as a tree of groups, the filter changes when it is applied
   * Does nothing for a read only filter state, conditions of columns without a type or not in the list are shown as they are and kept
   * @param column starts a new condition of the column*/
  advanced_search(column?: keyof T) {
    if (!this.#changeable(this.input_state(CONTAINER.filter))) return;
    const columns: ListAdvancedColumn[] = this.#root.columns_visible.map(
      (key) => {
        const options = this.#root.columns.get(key)!;
        return {
          key: String(key),
          title: options.title,
          type: options.type,
          choices: options.choices,
        };
      },
    );
    if (!columns.some((one) => one.type)) return;
    list_advanced_search(
      this,
      columns,
      this.#search_filter,
      column === undefined ? undefined : String(column),
      (filter) => this.#write_filter(filter, true),
    );
  }

  #show_column_search(show: boolean) {
    if (show === this.#column_search) return;
    this.#column_search = show;
    if (this.#headless)
      if (show) this.#make_header(false);
      else {
        this.#header?.remove();
        this.#header = undefined;
        this.#header_fields = [];
        this.#search_cells.clear();
        return;
      }
    this.#search_cells_build();
  }

  /**Gives every header field a cell of the column search, the key column and columns without a type an empty one, or removes them */
  #search_cells_build() {
    this.#search_cells.clear();
    const show = this.#column_search;
    this.#header?.classList.toggle("column-search", show);
    this.#root.columns_visible.forEach((key, i) => {
      const header = this.#header_fields[i];
      if (!header) return;
      if (!show) {
        header.search_cell = undefined;
        return;
      }
      const column = String(key);
      const options = this.#root.columns.get(key)!;
      const cell = list_search_cell(options.type, column, options.choices);
      cell.on_change = (condition, now) =>
        this.#write_filter(this.#cell_filter(column, condition), now);
      if (options.type)
        cell.on_advanced = (start) =>
          this.advanced_search(start ? key : undefined);
      header.search_cell = cell;
      this.#search_cells.set(column, cell);
    });
    const key_header = this.#header?.key_header;
    if (key_header)
      key_header.search_cell = show
        ? list_search_cell(undefined, "")
        : undefined;
    this.#search_cells_update();
  }

  /**The filter with the condition a cell gives its column, in the place of every condition the column had, groups left empty go
   * A cell means and its condition, so the condition is added to a root of all, and a root of any or none goes into a group under all with it */
  #cell_filter(
    column: string,
    condition: ListCondition | undefined,
  ): ListFilter {
    const rest = list_filter_prune(
      this.#search_filter,
      (one) => one.column !== column,
    );
    if (!condition) return rest;
    const mode = rest.mode ?? "all";
    if (mode === "all")
      return { ...rest, conditions: [...rest.conditions, condition] };
    if (rest.conditions.length === 0)
      return { ...rest, mode: "all", conditions: [condition] };
    return {
      mode: "all",
      conditions: [
        { type: "group", mode, conditions: rest.conditions },
        condition,
      ],
    };
  }

  /**Shows the conditions of the filter in the cells, locked for a read only filter state
   * A cell edits the conditions of its column on the root while the root is all, conditions in groups or on a root of any or none are only a summary */
  #search_cells_update() {
    const read_only = !this.#changeable(this.input_state(CONTAINER.filter));
    const filter = this.#search_filter;
    const all = (filter.mode ?? "all") === "all";
    const grouped = new Set<string>();
    const collect = (items: readonly ListFilterItem[], nested: boolean) => {
      for (const item of items)
        if (list_is_group(item)) collect(item.conditions, true);
        else if (nested) grouped.add(item.column);
    };
    collect(filter.conditions, false);
    for (const [column, cell] of this.#search_cells) {
      const own = filter.conditions.filter(
        (item): item is ListCondition =>
          !list_is_group(item) && item.column === column,
      );
      cell.show_conditions(
        own,
        grouped.has(column) || (!all && own.length > 0),
      );
      cell.read_only = read_only;
    }
  }

  /**Runs the function with the rows the search opens waiting, the outermost hold opens them after it */
  #search_hold<F>(func: () => F): F {
    this.#search_holds++;
    try {
      return func();
    } finally {
      if (--this.#search_holds === 0) this.#search_open();
    }
  }

  #search_queue(row: ListRow<R, T, A, S>) {
    this.#search_queued.push(row);
    if (this.#search_holds === 0) this.#search_open();
  }

  /**Opens the queued rows in order, the sub rows they show queue after them, so the search opens level by level
   * Stops with a warning after opening OPEN_LIMIT rows, a search that keeps finding something below would otherwise never end */
  #search_open() {
    if (this.#search_queued.length === 0) return;
    this.#search_holds++;
    let opened = 0;
    try {
      for (let i = 0; i < this.#search_queued.length; i++) {
        if (opened >= OPEN_LIMIT) {
          this.#warn?.show(
            this.#search_bar ?? this.#header?.key_header ?? this.#box,
            `Stopped after opening ${OPEN_LIMIT} rows for the search`,
          );
          break;
        }
        const row = this.#search_queued[i];
        if (row.search_open()) opened += row.amount_rows();
      }
    } finally {
      this.#search_queued = [];
      this.#search_holds--;
    }
  }

  /**Shows a line while the search hides every row */
  #search_empty_update() {
    const empty =
      this.#root.search !== undefined &&
      !this.#top_rows().some((row) => !row.search_hidden);
    if (!empty) {
      this.#search_empty?.remove();
      this.#search_empty = undefined;
    } else if (!this.#search_empty) {
      this.#search_empty = new ListSearchEmpty();
      this.#child_box.after(this.#search_empty);
    }
  }

  //      _      _______      ________
  //     | |    |_   _\ \    / /  ____|
  //     | |      | |  \ \  / /| |__
  //     | |      | |   \ \/ / |  __|
  //     | |____ _| |_   \  /  | |____
  //     |______|_____|   \/   |______|

  /**Keeps the row with the focus and the rows it is below in place, see focus_rows of the root, the rows held before are applied at the next frame */
  #live_focus_update(target: EventTarget | null) {
    this.#live_focus.clear();
    //The row of the list, not of a list in a cell of it
    let row = target instanceof Element ? target.closest("list-row") : null;
    while (row && row.parentElement !== this.#child_box)
      row = row.parentElement?.closest("list-row") ?? null;
    for (
      let held = row as ListRow<R, T, A, S> | null | undefined;
      held;
      held = held.parent_row
    )
      this.#live_focus.add(held);
    if (this.#live_dirty.size) this.#live_schedule();
  }

  /**Holds the rows until the pointer pressed on the list is let go anywhere */
  #live_press() {
    if (this.#live_pressed) return;
    this.#live_pressed = true;
    const release = () => {
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      this.#live_pressed = false;
      if (this.#live_dirty.size) this.#live_schedule();
    };
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
  }

  /**Applies the changed values of the rows at the next frame, or once the wait after a slow frame has passed */
  #live_schedule() {
    if (this.#live_frame || this.#live_wait || this.#live_pressed) return;
    const wait = this.#live_next_at - performance.now();
    if (wait > 0)
      this.#live_wait = window.setTimeout(() => {
        this.#live_wait = 0;
        this.#live_schedule();
      }, wait);
    else
      this.#live_frame = requestAnimationFrame(() => {
        this.#live_frame = 0;
        this.#live_flush();
      });
  }

  /**Places the rows with values they are not sorted by yet and has the rows whose states the search read answer again, a held row waits until it is let go
   * When that is slow, the next time waits LIVE_SLOW_WAIT times as long, so a big list on slow hardware still reacts to the user */
  #live_flush() {
    if (this.#live_pressed) return;
    const start = performance.now();
    const sorted = new Set<ListRowGroup<R, T, A, S>>();
    const searched = new Set<ListRowGroup<R, T, A, S>>();
    const settle = () => {
      for (const row of this.#live_dirty) {
        if (this.#root.held(row)) continue;
        this.#live_dirty.delete(row);
        if (row.sort_settle()) sorted.add(row.parent_group);
        if (row.search_settle()) searched.add(row.parent_group);
      }
    };
    this.#search_hold(() =>
      this.#selection ? this.#selection.batch(settle) : settle(),
    );
    for (const group of sorted) group.sort_order();
    for (const group of searched) if (!sorted.has(group)) group.last_update();
    if (searched.size) this.#search_empty_update();
    if (!sorted.size && !searched.size) return;
    //The next frame starts once this one is drawn, so the time until then is what the changes cost
    requestAnimationFrame(() => {
      const took = performance.now() - start;
      this.#live_next_at =
        took > LIVE_SLOW_FRAME ? start + took * LIVE_SLOW_WAIT : 0;
    });
  }

  //       _____  ____  _____ _______
  //      / ____|/ __ \|  __ \__   __|
  //     | (___ | |  | | |__) | | |
  //      \___ \| |  | |  _  /  | |
  //      ____) | |__| | | \ \  | |
  //     |_____/ \____/|_|  \_\ |_|

  /**Sorts the rows by a new value of the sort input */
  #sort_input(sort: ListSort) {
    this.#sort = sort;
    this.#sort_apply();
  }

  /**The column of the sort by its name, the key field for #key in a list with sub rows, undefined for a column the list does not have or can not sort by */
  #sort_column(
    name: string,
    desc: boolean,
  ): ListSortColumn<keyof T> | undefined {
    if (name === LIST_SORT_KEY_FIELD && this.#root.sub_rows)
      return { key: LIST_SORT_KEY_FIELD, desc };
    const key = name as keyof T;
    const column = this.#root.columns.get(key);
    return column && list_sortable(column) ? { key, column, desc } : undefined;
  }

  /**Sorts the rows by the columns of the sort input the list has and can sort by, a column given again counts once */
  #sort_apply() {
    const columns: ListSortColumn<keyof T>[] = [];
    for (const one of this.#sort) {
      const column = this.#sort_column(one.column, one.direction === "desc");
      if (!column || columns.some((sorted) => sorted.key === column.key))
        continue;
      columns.push(column);
    }
    const before = this.#root.sort;
    this.#root.sort = columns.length ? columns : undefined;
    this.#box.classList.toggle("sorted", columns.length > 0);
    //A list that did not sort and still does not has nothing to do, every row reads its values for the new sort
    if (before || columns.length) this.#group.sort_update();
    this.#sort_headers();
  }

  /**Shows in the titles which columns sort, and lets the user sort by a column that can be sorted, unless the sort is a read only state */
  #sort_headers() {
    const sort = this.#root.sort ?? [];
    const changeable = this.#changeable(this.input_state(CONTAINER.sort));
    this.#root.columns_visible.forEach((key, i) => {
      const header = this.#header_fields[i];
      if (!header) return;
      const column = this.#root.columns.get(key)!;
      const place = sort.findIndex((sorted) => sorted.key === key);
      header.sort_show(
        place < 0
          ? undefined
          : list_sort_icon(sort[place].desc, column.type === "number"),
        place >= 0 && sort.length > 1 ? place + 1 : undefined,
      );
      header.classList.toggle("sortable", changeable && list_sortable(column));
    });
    const key = this.#header?.key_header;
    if (!key) return;
    const place = sort.findIndex(
      (sorted) => sorted.key === LIST_SORT_KEY_FIELD,
    );
    key.sort_show(
      place < 0 ? undefined : list_sort_icon(sort[place].desc, false),
      place >= 0 && sort.length > 1 ? place + 1 : undefined,
    );
    key.classList.toggle("sortable", changeable);
  }

  /**Like any input the user changes, a writable state is written and the list follows it, without a state the list keeps the value */
  #write_sort(sort: ListSort) {
    const target = this.input_state(CONTAINER.sort);
    if (!target) this.#sort_input(sort);
    else if (target.writable) void target.write?.(sort);
  }

  /**A click on a title sorts by the column alone, A to Z, a click on the column the list sorts by alone turns it to Z to A, and then to no sort
   * With shift the column is added after the sorted columns, or turned if it sorts, and left out after Z to A */
  #sort_click(column: string, add: boolean) {
    if (!this.#changeable(this.input_state(CONTAINER.sort))) return;
    const turn = (direction: ListSortDirection) =>
      direction === "asc" ? "desc" : undefined;
    if (!add) {
      const sort = this.#root.sort ?? [];
      const alone = sort.length === 1 && String(sort[0].key) === column;
      const next = alone ? turn(sort[0].desc ? "desc" : "asc") : "asc";
      this.#write_sort(next ? [{ column, direction: next }] : []);
      return;
    }
    const sort = this.#sort;
    const at = sort.findIndex((one) => one.column === column);
    if (at < 0) {
      this.#write_sort([...sort, { column, direction: "asc" }]);
      return;
    }
    const next = turn(sort[at].direction);
    this.#write_sort(
      next
        ? sort.map((one, i) => (i === at ? { column, direction: next } : one))
        : sort.filter((_, i) => i !== at),
    );
  }

  /**Lines of the menu of the title of a column, or of the key field, to sort by the column, to sort by it after the other sorted columns, and to clear the sort
   * None for a read only sort state, a column that can not be sorted has only the line clearing the sort */
  #sort_lines(name: string): ContextMenuLines {
    if (!this.#changeable(this.input_state(CONTAINER.sort))) return [];
    const lines: ContextMenuLines = [];
    const sort = this.#root.sort ?? [];
    const target = this.#sort_column(name, false);
    if (target) {
      const numeric = target.column?.type === "number";
      const line = (text: string, desc: boolean, sort: () => ListSort) =>
        ctm.line({
          text:
            text +
            (numeric
              ? desc
                ? "9 to 1"
                : "1 to 9"
              : desc
                ? "Z to A"
                : "A to Z"),
          icon: list_sort_icon(desc, numeric),
          on_click: () => this.#write_sort(sort()),
        });
      const direction = (desc: boolean): ListSortDirection =>
        desc ? "desc" : "asc";
      for (const desc of [false, true])
        lines.push(
          line("Sort ", desc, () => [
            { column: name, direction: direction(desc) },
          ]),
        );
      if (sort.some((sorted) => sorted.key !== target.key))
        for (const desc of [false, true])
          lines.push(
            line("Then sort ", desc, () => [
              ...this.#sort.filter((one) => one.column !== name),
              { column: name, direction: direction(desc) },
            ]),
          );
    }
    if (sort.length)
      lines.push(
        ctm.line({ text: "Clear sort", on_click: () => this.#write_sort([]) }),
      );
    return lines;
  }

  /**A fixed value becomes a state of the list the user changes, a state is followed and written when writable */
  #set_selected(selected: K[] | StateREA<K[], any, any>) {
    const selection = this.#selection;
    if (!selection) {
      console.error("List has no selection configuration", this);
      return;
    }
    const target = state.is.state_of(selected)
      ? selected
      : state.ok_w<K[]>([...selected]);
    selection.target = target;
    this.set_input(
      CONTAINER.selected,
      target as StateOrVal<unknown[]>,
      (value) => selection.apply(value as StateResult<K[]>),
    );
  }
}
define_element(Container);

export type { Container as ListContainer };

/**Makes a list, the configuration is fixed for its life, the options are its inputs, which set changes later
 * The columns are needed at creation, they decide the column keys and value types the transform gives values for */
export function container<T extends {}, R, S extends boolean = false, K = R>(
  config: ListContainerConfig<T, R, S, K>,
  options: ListContainerOptions<T, R, K> & { columns: ListColumns<T> },
): Container<T, R, S, K> {
  return Container.create<
    Container<T, R, S, K>,
    [ListContainerConfig<T, R, S, K>]
  >(options, config);
}
