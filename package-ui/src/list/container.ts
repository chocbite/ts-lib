import { Base, define_element, type BaseIntersectObserver } from "#base";
import { px_to_rem } from "#theme";
import { state, type State, type StateInferSub } from "@chocbite/ts-lib/state";
import state_ui from "../state_ui";
import { ListAddRow, type ListAddRowOptions } from "./add_row";
import "./container.scss";
import { list_rows_error_update, type ListRowsError } from "./error";
import { list_align_apply, text_field } from "./field";
import { ListRow } from "./row";
import "./shared";
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
        const start_x = e.pageX;
        const start_width = this.#box.offsetWidth;
        this.onpointermove = (ev: PointerEvent) => {
          sizer(px_to_rem(start_width + (ev.pageX - start_x)));
        };
        this.onpointerup = () => {
          this.releasePointerCapture(e.pointerId);
          this.onpointermove = null;
          this.onpointerup = null;
        };
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
    if (this.#root.sub_rows) this.replaceChildren(text_field(), ...fields);
    else this.replaceChildren(...fields);
  }

  #root: ListRoot<R, T, A, S>;

  constructor(root: ListRoot<R, T, A, S>) {
    super();
    this.#root = root;
  }
}
define_element(HeaderRow);

interface ContainerOptions<S extends boolean = false> {
  /**Should header row be omitted */
  headless?: boolean;
  /**Can rows have sub rows */
  sub_rows?: S;
  /**Options for an add row button */
  add_row?: ListAddRowOptions;
  /**If list should use a container to give fields the option of attach/detach to states when visible */
  observer?: BaseIntersectObserver;
}

class Container<
  A extends ListType<any>,
  T extends { [key: string]: ListColumnOptions<any, any> },
  S extends boolean = false,
  R = ListTypeExtract<A>,
> extends Base {
  static element_name() {
    return "container";
  }
  static element_name_space() {
    return "list";
  }

  #root: ListRoot<R, T, A, S>;
  #parent: ListRowParent<A>;
  #box = this.appendChild(document.createElement("div"));
  #header?: HeaderRow<R, T, A, S>;
  #child_box: HTMLDivElement;
  #error?: ListRowsError<A>;
  #add_row?: ListAddRow<R, T, A, S>;
  #state_sub?: StateInferSub<State<R[]>>;

  constructor(
    columns: { [K in keyof T]: ListColumnOptions<T[K], any> },
    transform: ListRowTransformer<R, T, A, S>,
    rows: A,
    options?: ContainerOptions<S>,
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

    if (!options?.headless)
      this.#header = this.#box.appendChild(new HeaderRow(this.#root));
    this.#child_box = this.#box.appendChild(document.createElement("div"));
    if (options?.sub_rows) this.#box.classList.add("sub-rows");
    this.add_row = options?.add_row;

    this.columns = columns;
    this.rows = rows;
  }

  set columns(columns: { [K in keyof T]: ListColumnOptions<T[K], any> }) {
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

    if (this.#header)
      this.#header.fields = this.#root.columns_visible.map((key) => {
        const column = this.#root.columns.get(key)!;
        const header = new HeaderField(column.title);
        list_align_apply(header, column.align);
        header.sizable(typeof column.fixed_width === "undefined", (width) => {
          column.init_width = width;
          this.#update_column_widths();
        });
        return header;
      });
    this.#update_column_widths();

    for (let i = 0; i < this.#child_box.childElementCount; i++)
      (this.#child_box.children[i] as ListRow<R, T, A, S>).columns_changed();
  }

  #update_column_widths() {
    const widths: string[] = this.#root.columns_visible.map((key) => {
      const col = this.#root.columns.get(key)!;
      const width = col.fixed_width ?? col.init_width;
      if (width) {
        if (width === "min") return "min-content";
        else if (width === "max") return "max-content";
        return `${Math.max(width, 1)}rem`;
      }
      return "auto";
    });
    if (this.#root.sub_rows) widths.unshift("min-content");
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
    state_ui.a.apply(this.#child_box, rows, {
      create: (row) => new ListRow<R, T, A, S>(this.#root, this.#parent, row),
      update: (element, row) => (element.data = row),
    });
  }
}
define_element(Container);

export function container<
  A extends ListType<any>,
  T extends {},
  S extends boolean = false,
  R = ListTypeExtract<A>,
>(
  columns: { [K in keyof T]: ListColumnOptions<T[K], any> },
  transform: ListRowTransformer<R, NoInfer<T>, A, S>,
  rows: A,
  options?: ContainerOptions<S>,
) {
  return new Container<A, T, S, R>(columns, transform, rows, options);
}
