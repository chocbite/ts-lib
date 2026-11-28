import { px_to_rem } from "#theme";
import state from "@chocbite/ts-lib/state";
import {
  panel_container,
  panel_layer,
  type PanelContainer,
} from "../container";
import type { ContentBase } from "../content";
import type { Panel } from "../panel";
import { clamp } from "../shared";
import {
  type LayoutDirection,
  type LayoutNode,
  LayoutSide,
  OWNER_CAN_EMPTY,
  OWNER_CAN_POPOUT,
  OWNER_EMPTY,
  OWNER_POPOUT,
} from "./tree";
import { Change, writable } from "./common";
import { is_split, layout_split } from "./split";
import { layout_tabs, type LayoutTabs } from "./tabs";
import { TABS } from "./tab";
import { Layout } from "./layout";

//               _____ _______ _____ ____  _   _  _____
//         /\   / ____|__   __|_   _/ __ \| \ | |/ ____|
//        /  \ | |       | |    | || |  | |  \| | (___
//       / /\ \| |       | |    | || |  | | . ` |\___ \
//      / ____ \ |____   | |   _| || |__| | |\  |____) |
//     /_/    \_\_____|  |_|  |_____\____/|_| \_|_____/
//A change of the user is several writes to the states of the nodes, made with a Change, each applied before the next is
//worked out, a refused write puts the earlier ones back. The elements follow the states, so a layout shows what its states give back
/**The tab group holding the content, searched from the node*/
export function group_of(
  node: LayoutNode,
  content: ContentBase,
): LayoutTabs | undefined {
  if (!is_split(node))
    return node.contents().includes(content) ? node : undefined;
  for (const child of node.nodes()) {
    const found = group_of(child, content);
    if (found) return found;
  }
  return undefined;
}

/**The first tab group, searched from the node*/
export function first_group(node: LayoutNode): LayoutTabs | undefined {
  if (!is_split(node)) return node;
  for (const child of node.nodes()) {
    const found = first_group(child);
    if (found) return found;
  }
  return undefined;
}

/**Takes the content out of the group, a group left empty leaves its split, the next tab is shown*/
function take_from(
  change: Change,
  layout: Layout,
  group: LayoutTabs,
  content: ContentBase,
): void {
  const tabs = group.contents();
  const index = tabs.indexOf(content);
  if (index === -1) return;
  const next = tabs[index + 1] ?? tabs[index - 1];
  const last = tabs.length === 1;
  if (!change.write(group.content_state(), state.a.write.splice(index, 1)))
    return;
  if (group.active() === content) change.maybe(group.active_state(), next);
  if (last) remove_node(change, layout, group);
}

/**Tells the owner when the layout was left an empty tab group, after the change, so a dragged tab is put in its new place first,
 * a layout without an owner that tabs were popped out into closes its panel*/
function tell_empty(layout: Layout): void {
  const owner = layout.owner;
  const panel = POPPED.get(layout);
  if ((owner || panel) && is_empty(layout))
    queueMicrotask(() => {
      if (!is_empty(layout)) return;
      if (owner) owner[OWNER_EMPTY](layout);
      else panel?.close();
    });
}

/**Takes the content out of the group as one change, gives whether it was taken out*/
export function take_out(
  layout: Layout,
  group: LayoutTabs,
  content: ContentBase,
): boolean {
  const change = new Change();
  take_from(change, layout, group, content);
  if (change.ok) tell_empty(layout);
  return change.ok;
}

/**Whether the tree of the layout is one tab group without tabs*/
function is_empty(layout: Layout): boolean {
  const root = layout.root_node();
  return !!root && !is_split(root) && root.contents().length === 0;
}

/**Whether the content can leave its group, the tabs of a read only content state stay, the last tab of a group in a read only split
 * can not leave, the empty group could not be removed, and the owner decides for the last tab of the layout*/
export function can_leave(layout: Layout, group: LayoutTabs): boolean {
  if (!writable(group.content_state())) return false;
  if (group.contents().length > 1) return true;
  const parent = layout.parent_of(group);
  if (parent) return writable(parent.children_state());
  return layout.owner?.[OWNER_CAN_EMPTY](layout) ?? true;
}

/**Whether new nodes can be put beside the node, its split or the root can be written*/
export function can_split(layout: Layout, node: LayoutNode): boolean {
  const parent = layout.parent_of(node);
  return parent ? writable(parent.children_state()) : layout.root_writable();
}

/**Distance in rem a popped out panel is moved from where its group was, so it is seen as new*/
const POPOUT_OFFSET = 1.5;
/**Part of the size of the group a popped out panel gets, so it does not cover where it came from*/
const POPOUT_PART = 0.6;
/**Size in rem a popped out panel gets at most and at least*/
const POPOUT_MAX = { width: 40, height: 28 };
const POPOUT_MIN = { width: 16, height: 10 };

/**Where the panel of a popped out tab goes in the container, in rem, near the group it came from, rect is that group on the page*/
export function popout_place(
  container: PanelContainer,
  rect: DOMRect,
): { x: number; y: number; width: number; height: number } {
  const origin = container.getBoundingClientRect();
  const area = container.size();
  const width = clamp(
    px_to_rem(rect.width) * POPOUT_PART,
    POPOUT_MIN.width,
    POPOUT_MAX.width,
  );
  const height = clamp(
    px_to_rem(rect.height) * POPOUT_PART,
    POPOUT_MIN.height,
    POPOUT_MAX.height,
  );
  return {
    x: clamp(
      px_to_rem(rect.left - origin.left) + POPOUT_OFFSET,
      0,
      Math.max(0, area.width - width),
    ),
    y: clamp(
      px_to_rem(rect.top - origin.top) + POPOUT_OFFSET,
      0,
      Math.max(0, area.height - height),
    ),
    width,
    height,
  };
}

/**The tab group of a popped out tab, its tabs at the bottom, as the title bar of its panel is at the top*/
export const popout_group = (content: ContentBase): LayoutTabs =>
  layout_tabs({ content: [content], active: content, side: "bottom" });

/**Layouts without an owner that tabs were popped out into, with the panel showing them*/
const POPPED = new WeakMap<Layout, Panel>();

/**Whether tabs can be popped out of the layout, its owner decides, a layout without an owner can always*/
export function can_popout(layout: Layout): boolean {
  return layout.owner?.[OWNER_CAN_POPOUT](layout) ?? true;
}

/**Takes the content out of its layout into a tab group of its own, given to the owner of the layout,
 * without an owner shown in a new panel with the layer of the panel the layout is in, following it, in a layout without an owner, so tabs move between it and the layout,
 * the panel closes when its last tab leaves*/
export function popout(
  layout: Layout,
  group: LayoutTabs,
  content: ContentBase,
) {
  if (!can_popout(layout)) return;
  const owner = layout.owner;
  const rect = group.getBoundingClientRect();
  if (!take_out(layout, group, content)) return;
  if (owner) owner[OWNER_POPOUT](layout, content, rect);
  else {
    const container = panel_container(layout);
    const popped = Layout.create({ root: popout_group(content) });
    POPPED.set(
      popped,
      container.panel(popped, {
        ...popout_place(container, rect),
        layer: panel_layer(layout),
      }),
    );
  }
  TABS.get(content)?.focus();
}

/**Removes the node from its split, a split left with one node is replaced by it, the root stays*/
function remove_node(change: Change, layout: Layout, node: LayoutNode): void {
  const parent = layout.parent_of(node);
  if (!parent) return;
  const index = parent.nodes().indexOf(node);
  if (!change.write(parent.children_state(), state.a.write.splice(index, 1)))
    return;
  const left = parent.nodes();
  if (left.length === 1) replace_node(change, layout, parent, left[0]);
  else if (left.length === 0) remove_node(change, layout, parent);
}

/**Puts the node in the place of old, a split in the same direction as its new parent gives its children to it,
 * where old can not be replaced it stays with its one node*/
function replace_node(
  change: Change,
  layout: Layout,
  old: LayoutNode,
  node: LayoutNode,
) {
  const size = old.size();
  const parent = layout.parent_of(old);
  if (!parent) {
    if (!layout.root_writable()) return;
    change.maybe(node.size_state(), 1);
    change.write(layout.root_state(), node);
    return;
  }
  if (!writable(parent.children_state())) return;
  const index = parent.nodes().indexOf(old);
  if (is_split(node) && node.direction() === parent.direction()) {
    const children = [...node.nodes()];
    const total = children.reduce((sum, c) => sum + c.size(), 0);
    for (const child of children)
      change.maybe(child.size_state(), (size * child.size()) / total);
    change.write(
      parent.children_state(),
      state.a.write.splice(index, 1, ...children),
    );
    return;
  }
  change.maybe(node.size_state(), size);
  change.write(parent.children_state(), state.a.write.change(index, node));
}

/**Puts a new group with the content at the side of the node, in the split of the node when it has the same direction*/
function insert_beside(
  change: Change,
  layout: Layout,
  node: LayoutNode,
  side: LayoutSide,
  content: ContentBase,
): void {
  const direction: LayoutDirection =
    side === LayoutSide.LEFT || side === LayoutSide.RIGHT ? "row" : "column";
  const after = side === LayoutSide.RIGHT || side === LayoutSide.BOTTOM;
  const parent = layout.parent_of(node);
  if (parent && parent.direction() === direction) {
    const half = node.size() / 2;
    const index = parent.nodes().indexOf(node);
    const group = layout_tabs({
      content: [content],
      active: content,
      size: half,
    });
    if (
      change.write(
        parent.children_state(),
        state.a.write.splice(after ? index + 1 : index, 0, group),
      )
    )
      change.maybe(node.size_state(), half);
    return;
  }
  const group = layout_tabs({ content: [content], active: content });
  const split = layout_split({
    direction,
    children: after ? [node, group] : [group, node],
    size: node.size(),
  });
  const written = parent
    ? change.write(
        parent.children_state(),
        state.a.write.change(parent.nodes().indexOf(node), split),
      )
    : change.write(layout.root_state(), split);
  if (written) change.maybe(node.size_state(), 1);
}

/**Opens the content in the layout as one change, in or beside the group, gives whether it was written*/
export function open_in(
  layout: Layout,
  group: LayoutTabs,
  side: LayoutSide,
  content: ContentBase,
): boolean {
  const change = new Change();
  if (side !== LayoutSide.CENTER)
    insert_beside(change, layout, group, side, content);
  else if (change.write(group.content_state(), state.a.write.push(content)))
    change.maybe(group.active_state(), content);
  return change.ok;
}

/**Where a dragged tab goes, into a tab bar at an index, a side of a group, or a side of the whole layout*/
export type DropTarget = { layout: Layout; rect?: DOMRect } & (
  | { group: LayoutTabs; index: number }
  | { node: LayoutNode; side: LayoutSide }
  | { root: true; side: LayoutSide }
);

/**Moves the content to the target as one change, the group it leaves is removed when empty,
 * when any write is refused nothing is moved*/
export function move_content(content: ContentBase, target: DropTarget): void {
  const from = TABS.get(content)?.group_element();
  const source_layout = from?.layout();
  if (!from || !source_layout) return;
  const change = new Change();
  if ("group" in target) {
    const { group, index } = target;
    if (from === group) {
      const at = group.contents().indexOf(content);
      change.write(
        group.content_state(),
        state.a.write.move(at, index > at ? index - 1 : index, 1),
      );
    } else {
      take_from(change, source_layout, from, content);
      change.write(
        group.content_state(),
        state.a.write.splice(index, 0, content),
      );
    }
    change.maybe(group.active_state(), content);
  } else if ("node" in target && target.side === LayoutSide.CENTER) {
    take_from(change, source_layout, from, content);
    const group = target.node as LayoutTabs;
    if (change.write(group.content_state(), state.a.write.push(content)))
      change.maybe(group.active_state(), content);
  } else {
    take_from(change, source_layout, from, content);
    //The root is read after the content left, leaving can change it
    const node = "root" in target ? target.layout.root_node() : target.node;
    if (node) insert_beside(change, target.layout, node, target.side, content);
  }
  if (change.ok) tell_empty(source_layout);
  TABS.get(content)?.focus();
}
