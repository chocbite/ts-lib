import { define_element } from "#base";
import { comp, ContentBase } from "#composition";
import form from "#form";
import list from "#list";
import type {
  DepotChild,
  DepotEntry,
  DepotGroup,
} from "@chocbite/ts-lib/depot";
import { ok, some } from "@chocbite/ts-lib/result";
import state, { type StateOrValROS } from "@chocbite/ts-lib/state";
import "./selector.scss";
import { DepotTree } from "./tree";

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

type ListColumnOf<V> = ReturnType<typeof list.column<V, any>>;

/**A column a selector shows after the description, given the child of each row, like the live value of a state*/
export type DepotSelectorColumn = ListColumnOf<DepotChild<unknown>>;

/**Configuration of a selector, given once when it opens, outside the element pattern as it never changes*/
interface SelectorConfig {
  from: DepotGroup<unknown>;
  options: DepotSelectOptions<unknown>;
  value?: DepotSelectorColumn;
}

interface SelectorValues {
  description: StateOrValROS<string>;
  value?: DepotChild<unknown>;
}

/**Content of the modal panel of a selector, built by depot_select*/
class DepotSelector extends ContentBase {
  static element_name() {
    return "selector";
  }
  static element_name_space() {
    return "depot";
  }

  #buttons = this.appendChild(document.createElement("div"));
  #tree?: DepotTree<unknown>;
  #selection = state.ok_w<DepotChild<unknown>[]>([]);
  #resolve?: (entries: DepotEntry<unknown>[]) => void;

  constructor() {
    super();
    this.#buttons.className = "buttons";
    this.#buttons.append(
      form.button({ text: "Cancel", on_click: () => this.#finish(false) }),
      form.button({ text: "Select", on_click: () => this.#finish(true) }),
    );
    this.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.#finish(false);
    });
    //Closing the panel cancels
    void this.content_on_close().then(() => this.#finish(false));
  }

  /**Builds the rows for the configuration, the promise gives the selected entries, none when cancelled*/
  build(config: SelectorConfig): Promise<DepotEntry<unknown>[]> {
    const { options } = config;
    const mode = options.mode ?? "single";
    const tree = (this.#tree = new DepotTree(config.from, options.filter));
    this.#selection.set_ok([...(options.selected ?? [])]);

    const columns: {
      [K in keyof SelectorValues]: ListColumnOf<NonNullable<SelectorValues[K]>>;
    } = {
      //A description can be a state, like one of a provided node that changes
      description: list.column({
        title: "Description",
        field_gen: () => list.text_field(),
        field_apply: (field, description: StateOrValROS<string>) => {
          if (state.is.state(description))
            field.attach_state_to_prop("text", description, (e) =>
              some(e.nice),
            );
          else field.detach_state_from_prop("text").text = description;
        },
      }),
    };
    if (config.value) columns.value = config.value;
    const rows = list.container(
      {
        transform: (child) =>
          ok({
            key_field: { icon: child.icon, text: child.name },
            values: { description: child.description, value: child },
            openable: child.kind !== "entry",
            sub_rows:
              child.kind === "entry" ? undefined : () => tree.rows(child),
            selectable: child.kind === "entry",
            search: (query) => tree.search(child, query),
          }),
        sub_rows: true,
        selection: { mode },
      },
      {
        columns,
        rows: tree.rows(),
        selected: this.#selection,
        //Escape in the bar clears the text, and with nothing to clear closes the selector
        search_bar: true,
      },
    );
    //A double click on an entry in single mode picks it right away
    if (mode === "single")
      rows.ondblclick = () => {
        if (this.#selection.ok().length) this.#finish(true);
      };
    this.insertBefore(rows, this.#buttons);
    return new Promise((resolve) => (this.#resolve = resolve));
  }

  #finish(picked: boolean): void {
    const resolve = this.#resolve;
    if (!resolve) return;
    this.#resolve = undefined;
    const entries = picked
      ? this.#selection
          .ok()
          .filter(
            (child): child is DepotEntry<unknown> => child.kind === "entry",
          )
      : [];
    this.#tree?.dispose();
    resolve(entries);
    this.content_close();
  }
}
define_element(DepotSelector);

/**Opens a selector in a modal panel, the promise gives the selected entries, none when cancelled
 * For the selectors of depot_ui, value is a column after the description, like the live values of states*/
export function depot_selector_open<T>(
  from: DepotGroup<T>,
  options: DepotSelectOptions<T>,
  value?: DepotSelectorColumn,
): Promise<DepotEntry<T>[]> {
  const selector = DepotSelector.create({
    title: options.title ?? from.name,
    icon: from.icon,
    closable: true,
    min_width: 20,
    min_height: 15,
  });
  //The selector works on unknown content, the entries it gives are the ones of from, so of T
  const result = selector.build({
    from: from as DepotGroup<unknown>,
    options: options as DepotSelectOptions<unknown>,
    value,
  }) as Promise<DepotEntry<T>[]>;
  comp.panel(selector, { modal: true, width: 40, height: 32 });
  return result;
}

/**Opens a selector for the entries of a type or group, the promise gives the selected entries, none when cancelled.
 * The selector follows the depot while it is open*/
export function depot_select<T>(
  from: DepotGroup<T>,
  options: DepotSelectOptions<T> = {},
): Promise<DepotEntry<T>[]> {
  return depot_selector_open(from, options);
}
