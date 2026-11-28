import type { ContentBase } from "../content";
import type { Layout } from "./layout";
import type { LayoutSplit } from "./split";
import type { LayoutTabs } from "./tabs";

//      _____       _______
//     |  __ \   /\|__   __|/\
//     | |  | | /  \  | |  /  \
//     | |  | |/ /\ \ | | / /\ \
//     | |__| / ____ \| |/ ____ \
//     |_____/_/    \_\_/_/    \_\
/**Where content goes, relative to a tab group or the whole layout*/
export const LayoutSide = {
  /**As a tab in the group*/
  CENTER: "center",
  LEFT: "left",
  RIGHT: "right",
  TOP: "top",
  BOTTOM: "bottom",
} as const;
export type LayoutSide = (typeof LayoutSide)[keyof typeof LayoutSide];

/**Direction a split puts its children in, row is side by side, column is above each other*/
export type LayoutDirection = "row" | "column";

/**Side of a tab group its tabs are on*/
export type LayoutTabsSide = "top" | "bottom" | "left" | "right";

/**A node of a layout, a split or a tab group, made with layout_split and layout_tabs*/
export type LayoutNode = LayoutSplit | LayoutTabs;

/**Where layout.open puts the content*/
export interface LayoutOpenOptions {
  /**Content already in the layout, the new content goes into or beside its group,
   * not given it goes into or beside the group the user worked in last*/
  beside?: ContentBase;
  /**Side of that group, center makes it a tab of the group, the default*/
  side?: LayoutSide;
}

/**Called on the owner of a layout, internal to this module*/
export const OWNER_CAN_POPOUT = Symbol("owner_can_popout");
export const OWNER_POPOUT = Symbol("owner_popout");
export const OWNER_EMPTY = Symbol("owner_empty");
export const OWNER_CAN_EMPTY = Symbol("owner_can_empty");
/**What a layout belongs to, given when the layout is created and never changed, like a workspace,
 * tabs move only between layouts with the same owner, and layouts without an owner*/
export interface LayoutOwner {
  /**Whether the owner can take tabs popped out of the layout right now*/
  [OWNER_CAN_POPOUT](layout: Layout): boolean;
  /**Takes content the layout popped out, already taken out of the layout, rect is where its group was on the page*/
  [OWNER_POPOUT](layout: Layout, content: ContentBase, rect: DOMRect): void;
  /**Whether the last tab of the layout can leave it*/
  [OWNER_CAN_EMPTY](layout: Layout): boolean;
  /**The tree of the layout became an empty tab group, like a panel whose last tab was dragged out*/
  [OWNER_EMPTY](layout: Layout): void;
}
