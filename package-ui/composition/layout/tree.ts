import state, { type StateROS } from "@chocbite/ts-lib/state";
import { ContentBase } from "../content";
import type { Layout } from "./layout";

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

/**A tab group of a layout, the layout writes its states when the user changes it, a read only state locks that part*/
export interface LayoutTabs {
  /**Contents shown as tabs, in order, written with array instructions*/
  readonly tabs: StateROS<ContentBase[]>;
  /**Content of the shown tab, the first tab is shown when it is not among the tabs*/
  readonly active: StateROS<ContentBase | undefined>;
  /**Share of the space of the split it is in*/
  readonly size: StateROS<number>;
  /**Side the tabs are on, top when not given, the user changes it from the menu of a tab when it is writable*/
  readonly side?: StateROS<LayoutTabsSide>;
  /**Whether the tabs show only their icon, false when not given, the user changes it from the menu of a tab when it is writable*/
  readonly compact?: StateROS<boolean>;
}
/**A split of a layout, its children side by side or above each other*/
export interface LayoutSplit {
  /**Direction of the children, never changes*/
  readonly direction: LayoutDirection;
  /**Splits and tab groups in the split, written with array instructions*/
  readonly children: StateROS<LayoutNode[]>;
  /**Share of the space of the split it is in*/
  readonly size: StateROS<number>;
}
/**A node of a layout, a split or a tab group*/
export type LayoutNode = LayoutTabs | LayoutSplit;

export const is_split = (node: LayoutNode): node is LayoutSplit =>
  "children" in node;

/**A tab group with writable states, starting with the given contents*/
export function layout_tabs(
  tabs: ContentBase[] = [],
  options: {
    active?: ContentBase;
    size?: number;
    side?: LayoutTabsSide;
    compact?: boolean;
  } = {},
): LayoutTabs {
  return {
    tabs: state.ok_w(tabs),
    active: state.ok_w<ContentBase | undefined>(options.active),
    size: state.ok_w(options.size ?? 1),
    side: state.ok_w<LayoutTabsSide>(options.side ?? "top"),
    compact: state.ok_w(options.compact ?? false),
  };
}

/**A split with writable states, starting with the given children*/
export function layout_split(
  direction: LayoutDirection,
  children: LayoutNode[],
  size = 1,
): LayoutSplit {
  return {
    direction,
    children: state.ok_w(children),
    size: state.ok_w(size),
  };
}

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
  /**Whether the owner can take popped out tabs right now*/
  [OWNER_CAN_POPOUT](): boolean;
  /**Takes content the layout popped out, already taken out of the layout, rect is where its group was on the page*/
  [OWNER_POPOUT](layout: Layout, content: ContentBase, rect: DOMRect): void;
  /**Whether the last tab of the layout can leave it*/
  [OWNER_CAN_EMPTY](layout: Layout): boolean;
  /**The tree of the layout became an empty tab group, like a panel whose last tab was dragged out*/
  [OWNER_EMPTY](layout: Layout): void;
}
