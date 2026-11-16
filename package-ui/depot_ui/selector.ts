import { Base, define_element } from "#base";
import form from "#form";
import list from "#list";
import type {
  DepotChild,
  DepotEntry,
  DepotGroup,
} from "@chocbite/ts-lib/depot";
import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import "./selector.scss";
import "./shared";
import { DepotTree } from "./tree";
import { DepotValueField } from "./value";

export interface DepotSelectOptions<T> {
  /**Single selects one entry, multi any number, single when undefined*/
  mode?: "single" | "multi";
  /**Only entries passing the filter are shown and can be selected, like only writable states.
   * Groups with no shown entries below them are hidden*/
  filter?: (entry: DepotEntry<T>) => boolean;
  /**Entries selected when the selector opens*/
  selected?: readonly DepotEntry<T>[];
  /**Title of the selector, the name of the group when undefined*/
  title?: string;
}

interface SelectorValues<T> {
  description: string;
  value?: DepotChild<T>;
}
type ListColumnOf<V> = ReturnType<typeof list.column<V, any>>;

class DepotSelector<T> extends Base {
  static element_name() {
    return "selector";
  }
  static element_name_space(): string {
    return "depot";
  }

  #panel = this.appendChild(document.createElement("div"));
  #title = this.#panel.appendChild(document.createElement("h2"));
  #tree?: DepotTree<T>;
  #selection = state.ok_w<DepotChild<T>[]>([]);
  #resolve?: (entries: DepotEntry<T>[]) => void;

  /**Opens the selector, the promise gives the selected entries, none when cancelled
   * @param values show a column with the live value of the content of entries*/
  open(
    from: DepotGroup<T>,
    options: DepotSelectOptions<T>,
    values = false,
  ): Promise<DepotEntry<T>[]> {
    const mode = options.mode ?? "single";
    const tree = (this.#tree = new DepotTree(from, options.filter));
    this.#title.textContent = options.title ?? from.name;
    this.#selection.set_ok([...(options.selected ?? [])]);
    //Filters while typing, the input itself only gives its value on change
    const search = this.#panel.appendChild(
      form.text_input({ placeholder: "Search" }),
    );
    search.oninput = (e) => {
      if (e.target instanceof HTMLInputElement) tree.search = e.target.value;
    };
    const columns: {
      [K in keyof SelectorValues<T>]: ListColumnOf<
        NonNullable<SelectorValues<T>[K]>
      >;
    } = { description: list.column_string("Description") };
    if (values)
      columns.value = list.column({
        title: "Value",
        field_gen: () => new DepotValueField(),
        field_apply: (field, child: DepotChild<T>) =>
          (field.child = child as DepotChild<unknown>),
      });
    const rows = this.#panel.appendChild(
      list
        .container(
          columns,
          (child) =>
            ok({
              key_field: { icon: child.icon, text: child.name },
              values: { description: child.description, value: child },
              openable: child.kind !== "entry",
              opened: tree.searching,
              sub_rows:
                child.kind === "entry" ? undefined : () => tree.rows(child),
              selectable: child.kind === "entry",
            }),
          tree.rows(),
          { sub_rows: true, selection: { mode } },
        )
        .bind({ selection: this.#selection }),
    );
    //A double click on an entry in single mode picks it right away
    if (mode === "single")
      rows.ondblclick = () => {
        if (this.#selection.ok().length) this.#close(true);
      };

    const buttons = this.#panel.appendChild(document.createElement("div"));
    buttons.appendChild(
      form.button({ text: "Cancel", on_click: () => this.#close(false) }),
    );
    buttons.appendChild(
      form.button({ text: "Select", on_click: () => this.#close(true) }),
    );
    //A click on the backdrop cancels, clicks in the panel stay there
    this.onpointerdown = (e) => {
      if (e.target === this) this.#close(false);
    };

    document.body.appendChild(this);
    return new Promise((resolve) => (this.#resolve = resolve));
  }

  #close(picked: boolean): void {
    const resolve = this.#resolve;
    if (!resolve) return;
    this.#resolve = undefined;
    const entries = picked
      ? this.#selection
          .ok()
          .filter((child): child is DepotEntry<T> => child.kind === "entry")
      : [];
    this.#tree?.dispose();
    this.remove();
    resolve(entries);
  }
}
define_element(DepotSelector);

/**Opens a selector for the entries of a type or group, the promise gives the selected entries, none when cancelled.
 * The selector follows the depot while it is open*/
export function depot_select<T>(
  from: DepotGroup<T>,
  options: DepotSelectOptions<T> = {},
): Promise<DepotEntry<T>[]> {
  return new DepotSelector<T>().open(from, options);
}

/**Opens the selector with a column of the live values, for the states type*/
export function depot_select_values<T>(
  from: DepotGroup<T>,
  options: DepotSelectOptions<T>,
): Promise<DepotEntry<T>[]> {
  return new DepotSelector<T>().open(from, options, true);
}
