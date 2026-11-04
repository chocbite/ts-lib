import {
  Base,
  define_element,
  type BaseIntersectObserver,
} from "#base";
import { state, type State, type StateInferSub } from "@chocbite/ts-lib/state";
import { px_to_rem } from "#theme";
import { ListAddRow, type ListAddRowOptions } from "./add_row";
import "./container.scss";
import { text_field } from "./field";
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
    this.#text.innerHTML = value;
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
      observer: options?.observer
        ? this.intersect_observer(options.observer)
        : undefined,
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
    this.#root.columns_visible = [];

    const fields: HeaderField[] = [];
    for (const key in columns) {
      this.#root.columns.set(key, columns[key as keyof T]);
      this.#root.columns_visible.push(key);
      const header = new HeaderField(columns[key].title);
      fields.push(header);
      header.sizable(
        typeof columns[key].fixed_width === "undefined",
        (width) => {
          this.#root.columns.get(key)!.init_width = width;
          this.#update_column_widths();
        },
      );
    }

    this.#update_column_widths();
    if (this.#header) this.#header.fields = fields;
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
        this.#update_rows(r.ok ? r.value : []),
      );
    else this.#update_rows(rows);
  }

  #update_rows(rows: readonly R[]) {
    if (rows.length === 0) {
      this.#child_box.replaceChildren();
      return;
    }
    const read = state.a.read(rows);
    for (let i = 0; i < read.length; i++) {
      const row = read[i];
      if (row.type === "fresh") {
        const min = Math.min(
          this.#child_box.childElementCount,
          row.items.length,
        );
        for (let i = 0; i < min; i++)
          (this.#child_box.children[i] as ListRow<R, T, A, S>).data =
            row.items[i];
        if (row.items.length > this.#child_box.childElementCount)
          this.#child_box.append(
            ...row.items
              .slice(this.#child_box.childElementCount)
              .map(
                (row) => new ListRow<R, T, A, S>(this.#root, this.#parent, row),
              ),
          );
        else if (row.items.length < this.#child_box.childElementCount) {
          for (
            let i = this.#child_box.childElementCount - 1;
            i >= row.items.length;
            i--
          )
            (this.#child_box.children[i] as ListRow<R, T, A, S>).remove();
        }
      } else if (row.type === "added") {
        const child = this.#child_box.children[row.index] as
          | ListRow<R, T, A, S>
          | undefined;
        const rows = row.items.map(
          (row) => new ListRow<R, T, A, S>(this.#root, this.#parent, row),
        );
        if (child) child.before(...rows);
        else this.#child_box.append(...rows);
      } else if (row.type === "removed")
        for (let i = 0; i < row.items.length; i++)
          this.#child_box.children[row.index].remove();
      else if (row.type === "changed")
        for (let i = 0; i < row.items.length; i++)
          (
            this.#child_box.children[row.index + i] as ListRow<R, T, A, S>
          ).data = row.items[i];
      else if (row.type === "moved") {
        const extracted = [];
        for (let i = 0; i < row.items.length; i++) {
          const child = this.#child_box.children[row.from_index + i] as ListRow<
            R,
            T,
            A,
            S
          >;
          extracted.push(child);
          child.remove();
        }
        const child = this.#child_box.children[row.to_index] as
          | ListRow<R, T, A, S>
          | undefined;
        for (let i = 0; i < extracted.length; i++) {
          if (child) child.before(extracted[i]);
          else this.#child_box.append(extracted[i]);
        }
      }
    }
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
