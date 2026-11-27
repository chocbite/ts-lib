import { depot_select } from "./selector";
import { depot_select_state } from "./state/selector";

export const depot_ui = {
  /**Opens a selector for the entries of a type or group, the promise gives the selected entries, none when cancelled*/
  select: depot_select,
  /**Opens a selector for the states of the depot with their live values, the promise gives the selected entries, none when cancelled*/
  select_state: depot_select_state,
};
export default depot_ui;

export type { DepotSelectOptions } from "./selector";
export type { DepotStateKind } from "./state/kind";
export type { DepotStateSelectOptions } from "./state/selector";
export { DepotTree, type DepotSearchResult } from "./tree";
