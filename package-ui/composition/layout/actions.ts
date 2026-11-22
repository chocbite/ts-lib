import state from "@chocbite/ts-lib/state";
import { ContentBase } from "../content";
import { write } from "../shared";
import {
  is_split,
  layout_split,
  layout_tabs,
  type LayoutDirection,
  type LayoutNode,
  LayoutSide,
  type LayoutTabs,
  OWNER_CAN_EMPTY,
  OWNER_EMPTY,
  OWNER_POPOUT,
} from "./tree";
import type { TabsElement } from "./tabs";
import { TABS } from "./tab";
import type { Layout } from "./layout";

//               _____ _______ _____ ____  _   _  _____
//         /\   / ____|__   __|_   _/ __ \| \ | |/ ____|
//        /  \ | |       | |    | || |  | |  \| | (___
//       / /\ \| |       | |    | || |  | | . ` |\___ \
//      / ____ \ |____   | |   _| || |__| | |\  |____) |
//     /_/    \_\_____|  |_|  |_____\____/|_| \_|_____/
//Changes are made to the data, the elements follow the states, so a layout shows what its states give back
/**The tab group holding the content, searched from the node*/
export function group_of(
  node: LayoutNode,
  content: ContentBase,
): LayoutTabs | undefined {
  if (!is_split(node))
    return node.tabs.ok().includes(content) ? node : undefined;
  for (const child of node.children.ok()) {
    const found = group_of(child, content);
    if (found) return found;
  }
  return undefined;
}

/**The first tab group, searched from the node*/
export function first_group(node: LayoutNode): LayoutTabs | undefined {
  if (!is_split(node)) return node;
  for (const child of node.children.ok()) {
    const found = first_group(child);
    if (found) return found;
  }
  return undefined;
}

/**Takes the content out of the group, a group left empty leaves its split*/
export function take_out(
  layout: Layout,
  group: LayoutTabs,
  content: ContentBase,
) {
  const tabs = group.tabs.ok();
  const index = tabs.indexOf(content);
  if (index === -1) return;
  const next = tabs[index + 1] ?? tabs[index - 1];
  const last = tabs.length === 1;
  write(group.tabs, state.a.write.splice(index, 1));
  if (group.active.ok() === content) write(group.active, next);
  if (last) remove_node(layout, group);
  //Told after the change that took the tab out, a dragged tab is put in its new place first
  const owner = layout.owner;
  if (owner && is_empty(layout))
    queueMicrotask(() => {
      if (is_empty(layout)) owner[OWNER_EMPTY](layout);
    });
}

/**Whether the tree of the layout is one tab group without tabs*/
function is_empty(layout: Layout): boolean {
  const root = layout.root_node();
  return !!root && !is_split(root) && root.tabs.ok().length === 0;
}

/**Whether the content can leave its group, the last tab of a group in a read only split can not,
 * the empty group could not be removed, and the owner decides for the last tab of the layout*/
export function can_leave(layout: Layout, group: LayoutTabs): boolean {
  if (!group.tabs.writable) return false;
  if (group.tabs.ok().length > 1) return true;
  const parent = layout.parent_of(group);
  if (parent) return parent.children.writable;
  return layout.owner?.[OWNER_CAN_EMPTY](layout) ?? true;
}

/**Takes the content out of its layout and gives it to the owner of the layout in a tab group of its own*/
export function popout(
  layout: Layout,
  group: TabsElement,
  content: ContentBase,
) {
  const owner = layout.owner;
  if (!owner) return;
  const rect = group.getBoundingClientRect();
  take_out(layout, group.node, content);
  owner[OWNER_POPOUT](layout, content, rect);
  TABS.get(content)?.focus();
}

/**Removes the node from its split, a split left with one node is replaced by it, the root stays*/
function remove_node(layout: Layout, node: LayoutNode): void {
  const parent = layout.parent_of(node);
  if (!parent?.children.writable) return;
  const index = parent.children.ok().indexOf(node);
  write(parent.children, state.a.write.splice(index, 1));
  const left = parent.children.ok();
  if (left.length === 1) replace_node(layout, parent, left[0]);
  else if (left.length === 0) remove_node(layout, parent);
}

/**Puts the node in the place of old, a split in the same direction as its new parent gives its children to it*/
function replace_node(layout: Layout, old: LayoutNode, node: LayoutNode) {
  const size = old.size.ok();
  const parent = layout.parent_of(old);
  if (!parent) {
    write(node.size, 1);
    return layout.write_root(node);
  }
  const index = parent.children.ok().indexOf(old);
  if (is_split(node) && node.direction === parent.direction) {
    const children = [...node.children.ok()];
    const total = children.reduce((sum, c) => sum + c.size.ok(), 0);
    for (const child of children)
      write(child.size, (size * child.size.ok()) / total);
    write(parent.children, state.a.write.splice(index, 1, ...children));
    return;
  }
  write(node.size, size);
  write(parent.children, state.a.write.change(index, node));
}

/**Puts a new group with the content at the side of the node, in the split of the node when it has the same direction*/
export function insert_beside(
  layout: Layout,
  node: LayoutNode,
  side: LayoutSide,
  content: ContentBase,
): void {
  const direction: LayoutDirection =
    side === LayoutSide.LEFT || side === LayoutSide.RIGHT ? "row" : "column";
  const after = side === LayoutSide.RIGHT || side === LayoutSide.BOTTOM;
  const parent = layout.parent_of(node);
  if (parent && parent.direction === direction) {
    const half = node.size.ok() / 2;
    const index = parent.children.ok().indexOf(node);
    write(node.size, half);
    write(
      parent.children,
      state.a.write.splice(
        after ? index + 1 : index,
        0,
        layout_tabs([content], { active: content, size: half }),
      ),
    );
    return;
  }
  const group = layout_tabs([content], { active: content });
  const split = layout_split(
    direction,
    after ? [node, group] : [group, node],
    node.size.ok(),
  );
  if (parent)
    write(
      parent.children,
      state.a.write.change(parent.children.ok().indexOf(node), split),
    );
  else layout.write_root(split);
  write(node.size, 1);
}

/**Whether new nodes can be put beside the node, its split or the root can be written*/
export function can_split(layout: Layout, node: LayoutNode): boolean {
  const parent = layout.parent_of(node);
  return parent ? parent.children.writable : layout.root_writable();
}

/**Where a dragged tab goes, into a tab bar at an index, a side of a group, or a side of the whole layout*/
export type DropTarget = { layout: Layout; rect?: DOMRect } & (
  | { group: LayoutTabs; index: number }
  | { node: LayoutNode; side: LayoutSide }
  | { root: true; side: LayoutSide }
);

/**Moves the content to the target, the group it leaves is removed when empty*/
export function move_content(content: ContentBase, target: DropTarget): void {
  const from = TABS.get(content)?.group_element();
  const source = from?.node;
  const source_layout = from?.layout();
  const take = () => {
    if (source && source_layout) take_out(source_layout, source, content);
  };
  if ("group" in target) {
    const { group, index } = target;
    if (source === group) {
      const at = group.tabs.ok().indexOf(content);
      write(
        group.tabs,
        state.a.write.move(at, index > at ? index - 1 : index, 1),
      );
    } else {
      take();
      write(group.tabs, state.a.write.splice(index, 0, content));
    }
    write(group.active, content);
  } else if ("node" in target && target.side === LayoutSide.CENTER) {
    take();
    const group = target.node as LayoutTabs;
    write(group.tabs, state.a.write.push(content));
    write(group.active, content);
  } else {
    take();
    //The root is read after the content left, leaving can change it
    const node = "root" in target ? target.layout.root_node() : target.node;
    if (node) insert_beside(target.layout, node, target.side, content);
  }
  TABS.get(content)?.focus();
}
