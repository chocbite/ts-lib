import depot, {
  type DepotEntry,
  type DepotGroup,
} from "@chocbite/ts-lib/depot";
import state from "@chocbite/ts-lib/state";
import { type DepotStateKind, state_kind } from "./kind";
import { depot_select_values } from "./selector";

export interface DepotStateSelectOptions {
  /**Group of the states type to select from, all states when undefined*/
  from?: DepotGroup<unknown>;
  /**Single selects one state, multi any number, single when undefined*/
  mode?: "single" | "multi";
  /**Only writable states can be selected*/
  writable?: boolean;
  /**Only states of these kinds can be selected, states of unknown kind are hidden then*/
  kind?: DepotStateKind | readonly DepotStateKind[];
  /**Further filter on the entries, after writable and kind*/
  filter?: (entry: DepotEntry<unknown>) => boolean;
  /**States selected when the selector opens*/
  selected?: readonly DepotEntry<unknown>[];
  /**Title of the selector, the name of the group when undefined*/
  title?: string;
}

/**Opens a selector for the states of the depot with their live values, the promise gives the selected entries, none when cancelled.
 * The state of an entry is its value, entry.value*/
export function depot_select_state(
  options: DepotStateSelectOptions = {},
): Promise<DepotEntry<unknown>[]> {
  const from = options.from ?? depot.states;
  if (from.type !== depot.states)
    throw new Error(`Depot group "${from.path}" is not in the states type`);
  const kinds =
    options.kind === undefined
      ? undefined
      : typeof options.kind === "string"
        ? [options.kind]
        : options.kind;
  const { writable, filter } = options;
  return depot_select_values(from, {
    mode: options.mode,
    selected: options.selected,
    title: options.title,
    filter: (entry) => {
      //An entry of the states type holds the state, or a constant that is never writable
      const value = entry.value;
      if (writable && !(state.is.state(value) && value.writable)) return false;
      if (kinds) {
        const kind = state_kind(state.as_state(value));
        if (!kind || !kinds.includes(kind)) return false;
      }
      return !filter || filter(entry);
    },
  });
}
