import {
  Base,
  define_element,
  input_key,
  type BaseIntersectObserver,
  type BaseOptions,
} from "#base";
import ctm from "#context-menu";
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
import { list_rows_apply, ListRow } from "./row";
import {
  ListCheckField,
  ListSelection,
  type ListSelectionOptions,
} from "./selection";
import "./shared";
import { ListWarn } from "./warn";
import type {
  ListColumnOptions,
  ListRoot,
  ListRowParent,
  ListRowTransformer,
  ListType,
} from "./types.ts";

/**Most rows open all opens at a time, a mistake making the sub rows recursive would otherwise never end */
const OPEN_ALL_LIMIT = 1000;

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
  get key_header(): HTMLElement | undefined {
    return this.#key_header;
  }

  /**Header of the key field column, only with sub rows */
  #key_header?: HeaderField;
  /**Empty header of the drag handle column */
  #drag_header?: ListDragField;
  /**Header of the checkbox or radio button column, in multi mode it selects or deselects all rows */
  #check_header?: ListCheckField;

  constructor(
    root: ListRoot<R, T, A, S>,
    key_sizer: (width: number | undefined) => void,
  ) {
    super();
    if (root.sub_rows) {
      const key = (this.#key_header = new HeaderField());
      key.classList.add("key");
      const button = (kind: string, action: () => void) => {
        const span = document.createElement("span");
        span.className = `list-${kind}-all`;
        span.onclick = action;
        return span;
      };
      key.nodes = [
        button("close", () => root.close_all()),
        button("open", () => root.open_all()),
      ];
      ctm.attach(
        key,
        ctm.menu([
          ctm.line("Open all", () => root.open_all()),
          ctm.line("Close all", () => root.close_all()),
        ]),
      );
      key.sizable(true, key_sizer);
    }
    if (root.reorder) this.#drag_header = new ListDragField();
    const selection = root.selection;
    if (selection?.column) this.#check_header = new ListCheckField();
    if (selection?.multi) {
      const check = this.#check_header!;
      check.onclick = () => {
        if (selection.amount_selected > 0) selection.clear();
        else selection.select_all();
      };
      ctm.attach(
        check,
        ctm.menu([
          ctm.line(
            "Select all",
            () => selection.select_all(),
            undefined,
            "Ctrl+A",
          ),
          ctm.line("Deselect all", () => selection.clear(), undefined, "Esc"),
        ]),
      );
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
}

/**Inputs of the list, loosely typed as keys can not be generic */
const CONTAINER = {
  columns: input_key<ListColumns<any>>(),
  rows: input_key<StateOrVal<unknown[]>>(),
  add_row: input_key<ListAddRowOptions | null>(),
  selected: input_key<StateOrVal<unknown[]>>(),
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
  #parent: ListRowParent<A>;
  #box = this.appendChild(document.createElement("div"));
  #header?: HeaderRow<R, T, A, S>;
  #child_box: HTMLDivElement;
  #error?: ListRowsError<A>;
  #add_row?: ListAddRow<R, T, A, S>;
  /**Width of the key field column in rem set by resizing, fits the key fields when undefined */
  #key_width?: number;
  /**Shows why a write failed, or that open all stopped */
  #warn?: ListWarn;

  /**Builds the list from its configuration, the inputs come with set */
  constructor(config: ListContainerConfig<T, R, S, K>) {
    super();
    this.#root = {
      sub_rows: config.sub_rows ?? (false as S),
      columns: new Map(),
      columns_visible: [],
      transform: config.transform,
      observer: config.observer,
      open_all: () => this.open_all(),
      close_all: () => this.close_all(),
      any_open: () => this.#open_rows().length > 0,
    };
    this.#parent = {
      depth: -1,
      open: false,
      select_adjacent() {},
      state: [],
    };

    this.#child_box = document.createElement("div");
    //Shows why a write of the selection or a move failed
    const warn =
      config.selection || config.reorder || config.sub_rows
        ? new ListWarn(this)
        : undefined;
    this.#warn = warn;
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

    if (!config.headless)
      this.#header = this.#box.appendChild(
        new HeaderRow(this.#root, (width) => {
          this.#key_width = width;
          this.#update_column_widths();
        }),
      );
    this.#box.appendChild(this.#child_box);
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

    if (this.#header) {
      const headers = this.#root.columns_visible.map((key) => {
        const column = this.#root.columns.get(key)!;
        const header = new HeaderField(column.title);
        list_align_apply(header, column.align);
        header.sizable(typeof column.fixed_width === "undefined", (width) => {
          if (width !== undefined) this.#freeze_auto_widths(headers);
          column.init_width = width;
          this.#update_column_widths();
        });
        return header;
      });
      this.#header.fields = headers;
    }
    this.#update_column_widths();

    for (let i = 0; i < this.#child_box.childElementCount; i++)
      (this.#child_box.children[i] as ListRow<R, T, A, S>).columns_changed();
    this.#add_row?.columns_changed();
    this.#error?.columns_changed();
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
   * Stops with a warning after opening OPEN_ALL_LIMIT rows, against huge or recursive sub rows, opening all again continues */
  open_all() {
    let opened = 0;
    let level = this.#top_rows();
    while (level.length) {
      const next: ListRow<R, T, A, S>[] = [];
      for (const row of level) {
        if (row.openable && !row.open) {
          if (opened >= OPEN_ALL_LIMIT) {
            this.#warn?.show(
              this.#header?.key_header ?? this.#box,
              `Stopped after opening ${OPEN_ALL_LIMIT} rows, open all again for more`,
            );
            return;
          }
          row.open = true;
          opened += row.amount_rows();
        }
        for (let sub = row.first_sub_row; sub; sub = sub.next_row)
          next.push(sub);
      }
      level = next;
    }
  }

  /**Closes every open row, closing the top rows removes everything below them */
  close_all() {
    for (const row of this.#open_rows()) row.open = false;
  }

  #top_rows(): ListRow<R, T, A, S>[] {
    return [...this.#child_box.children] as ListRow<R, T, A, S>[];
  }

  #open_rows(): ListRow<R, T, A, S>[] {
    return this.#top_rows().filter((row) => row.open);
  }

  #update_column_widths() {
    const widths: string[] = this.#root.columns_visible.map((key) => {
      const col = this.#root.columns.get(key)!;
      //Without a header nothing can resize, so init_width, the start of a resize, does not apply
      const width =
        col.fixed_width ?? (this.#header ? col.init_width : undefined);
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
          [ListRoot<R, T, A, S>, ListRowParent<A>]
        >(options, this.#root, this.#parent),
      );
    this.#box.classList.toggle("addrow", Boolean(options));
  }

  //      _____   ______          _______
  //     |  __ \ / __ \ \        / / ____|
  //     | |__) | |  | \ \  /\  / / (___
  //     |  _  /| |  | |\ \/  \/ / \___ \
  //     | | \ \| |__| | \  /\  /  ____) |
  //     |_|  \_\\____/   \/  \/  |_____/

  amount_rows(rec: boolean = false): number {
    let count = this.#child_box.childElementCount;
    if (rec)
      for (let i = 0; i < this.#child_box.childElementCount; i++)
        count += (
          this.#child_box.children[i] as ListRow<R, T, A, S>
        ).amount_rows(true);
    return count;
  }

  #update_rows(rows: readonly R[], error?: string) {
    this.#error = list_rows_error_update(
      this.#child_box,
      this.#error,
      error,
      this.#root,
      this.#parent,
    );
    list_rows_apply(this.#root, this.#parent, this.#child_box, rows);
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
