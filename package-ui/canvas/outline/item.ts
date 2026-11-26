import type { StateOrVal, StateROS } from "@chocbite/ts-lib/state";

/**Something the outline lists, pages and widgets implement it, so a selection of them is given as it is*/
export interface OutlineItem {
  /**Shown in the key column, empty when undefined*/
  readonly id?: StateOrVal<string>;
  /**Shown next to the id, like the name the definition of a widget is registered with*/
  readonly name: StateROS<string>;
  /**The items inside it, a row that opens to them, like the widgets of a page or of a group, undefined for an item without*/
  readonly children?: StateOrVal<readonly OutlineItem[]>;
}
