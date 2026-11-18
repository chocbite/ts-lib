import { ARRAY_UI } from "./array";
import { state_ui_size } from "./size";

/**Shows states of @chocbite/ts-lib/state in the document*/
export const state_ui = {
  //The "as typeof" casts make the declaration output reference the helper objects instead of inlining
  //their types, inlining would drop the doc comments on their members
  /* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
  /**Array states, applies arrays to child nodes*/
  a: ARRAY_UI as typeof ARRAY_UI,
  /**Array states, applies arrays to child nodes*/
  array: ARRAY_UI as typeof ARRAY_UI,
  /* eslint-enable @typescript-eslint/no-unnecessary-type-assertion */
  /**Width and height of an element as read only states in px, observed only while subscribed*/
  size: state_ui_size,
};
export default state_ui;

export type { StateUIArrayApplyHandlers } from "./array";
export type { StateUISize } from "./size";
