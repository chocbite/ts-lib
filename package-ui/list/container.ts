import { Base, define_element, type BaseIntersectObserver } from "#base";
import ctm from "#context-menu";
import { px_to_rem } from "#theme";
import {
  state,
  type State,
  type StateInferSub,
  type StateREAW,
  type StateSub,
} from "@chocbite/ts-lib/state";
import type { Result } from "@chocbite/ts-lib/result";
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
  ListTypeExtract,
} from "./types.ts";

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
      this.#key_header = new HeaderField();
      this.#key_header.classList.add("key");
      this.#key_header.sizable(true, key_sizer);
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

interface ContainerOptions<S extends boolean = false, R = unknown, K = R> {
  /**Should header row be omitted */
  headless?: boolean;
  /**Can rows have sub rows */
  sub_rows?: S;
  /**Options for an add row button */
  add_row?: ListAddRowOptions;
  /**If list should use a container to give fields the option of attach/detach to states when visible */
  observer?: BaseIntersectObserver;
  /**Lets the user select rows, only rows that are visible can be selected */
  selection?: ListSelectionOptions<R, K>;
  /**Lets the user move rows with a drag handle in front of the rows, rows in a writable array state can be moved */
  reorder?: ListReorderOptions<R>;
}

class Container<
  A extends ListType<any>,
  T extends { [key: string]: ListColumnOptions<any, any> },
  S extends boolean = false,
  R = ListTypeExtract<A>,
  K = R,
> extends Base {
  static element_name() {
    return "container";
  }
  static element_name_space() {
    return "list";
  }

  #root: ListRoot<R, T, A, S>;
  #selection?: ListSelection<K>;
  #selection_sub?: StateSub<Result<K[], string>>;
  #parent: ListRowParent<A>;
  #box = this.appendChild(document.createElement("div"));
  #header?: HeaderRow<R, T, A, S>;
  #child_box: HTMLDivElement;
  #error?: ListRowsError<A>;
  #add_row?: ListAddRow<R, T, A, S>;
  #state_sub?: StateInferSub<State<R[]>>;
  /**Width of the key field column in rem set by resizing, fits the key fields when undefined */
  #key_width?: number;

  constructor(
    columns: { [C in keyof T]: ListColumnOptions<T[C], any> },
    transform: ListRowTransformer<R, T, A, S>,
    rows: A,
    options?: ContainerOptions<S, R, K>,
  ) {
    super();
    this.#root = {
      sub_rows: options?.sub_rows ?? (false as S),
      columns: new Map(),
      columns_visible: [],
      transform,
      observer: options?.observer,
    };
    this.#parent = {
      depth: -1,
      open: false,
      select_adjacent() {},
      state: rows,
    };

    this.#child_box = document.createElement("div");
    //Shows why a write of the selection or a move failed
    const warn =
      options?.selection || options?.reorder ? new ListWarn(this) : undefined;
    if (options?.reorder) {
      this.#root.reorder = new ListReorder(this, options.reorder, warn!);
      this.#box.classList.add("drag");
    }
    if (options?.selection) {
      this.#selection = new ListSelection(
        options.selection,
        this.#child_box,
        Boolean(options.sub_rows),
      );
      this.#root.selection = this.#selection;
      if (this.#selection.column) this.#box.classList.add("check");
      this.#box.classList.add(this.#selection.multi ? "multi" : "single");
      this.#selection.on_error = (row, message) =>
        warn!.show(row?.anchor ?? this.#header ?? this.#box, message);
    }
    //Columns in front of the key field column, the error and add rows start after them
    const lead =
      Number(Boolean(options?.reorder)) +
      Number(Boolean(this.#selection?.column));
    if (lead) this.#box.classList.add("lead-" + lead);

    if (!options?.headless)
      this.#header = this.#box.appendChild(
        new HeaderRow(this.#root, (width) => {
          this.#key_width = width;
          this.#update_column_widths();
        }),
      );
    this.#box.appendChild(this.#child_box);
    if (options?.sub_rows) this.#box.classList.add("sub-rows");
    this.add_row = options?.add_row;

    this.columns = columns;
    this.rows = rows;
    //Selection works without a bound state, in a state of its own nobody else can reach
    if (this.#selection) this.bind({});
  }

  set columns(columns: { [C in keyof T]: ListColumnOptions<T[C], any> }) {
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

  set add_row(options: ListAddRowOptions | undefined) {
    if (!options && this.#add_row) {
      this.#add_row.remove();
      this.#box.classList.remove("addrow");
      this.#add_row = undefined;
    } else if (options) {
      if (!this.#add_row) {
        this.#box.classList.add("addrow");
        this.#add_row = this.#box.appendChild(
          new ListAddRow<R, T, A, S>(this.#root, this.#parent),
        );
      }
      this.#add_row.options = options;
    }
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

  set rows(rows: R[] | State<R[]>) {
    if (this.#state_sub) this.detach_state(this.#state_sub);
    this.#state_sub = undefined;
    this.#parent.state = rows as A;
    if (state.is.state(rows))
      this.#state_sub = this.attach_state(rows, (r) =>
        this.#update_rows(r.ok ? r.value : [], r.ok ? undefined : r.error),
      );
    else this.#update_rows(rows);
  }

  #update_rows(rows: readonly R[], error?: string) {
    this.#error = list_rows_error_update(
      this.#child_box,
      this.#error,
      error,
      this.#root.sub_rows,
      this.#parent,
    );
    list_rows_apply(this.#root, this.#parent, this.#child_box, rows);
  }

  /**Binds the selection to an array state of keys, which can be shared with other lists and elements
   * The list shows the keys that have a visible row, and only writes the state on user actions,
   * with array write instructions, so it must be a state that applies them, like a local writable state
   * Without a state the selection is kept in a state of the list that nobody else can reach
   * Needs the selection option */
  bind(opts: { selection?: StateREAW<K[], any, K[]> }): this {
    const selection = this.#selection;
    if (!selection) {
      if (opts.selection) console.error("List has no selection option", this);
      return this;
    }
    if (this.#selection_sub) this.detach_state(this.#selection_sub);
    const target = opts.selection ?? state.ok_w<K[]>([]);
    selection.target = target;
    this.#selection_sub = this.attach_state(
      target as StateREAW<K[]>,
      (value: Result<K[], string>) => selection.apply(value),
    );
    return this;
  }
}
define_element(Container);

export function container<
  A extends ListType<any>,
  T extends {},
  S extends boolean = false,
  R = ListTypeExtract<A>,
  K = R,
>(
  columns: { [C in keyof T]: ListColumnOptions<T[C], any> },
  transform: ListRowTransformer<R, NoInfer<T>, A, S>,
  rows: A,
  options?: ContainerOptions<S, R, K>,
) {
  return new Container<A, T, S, R, K>(columns, transform, rows, options);
}
