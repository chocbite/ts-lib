import { rem_to_px } from "#theme";
import { is_split, LayoutSide, type LayoutTabs } from "./tree";
import { EDGE_PART, ROOT_EDGE } from "./common";
import { can_leave, can_split, type DropTarget } from "./actions";
import type { TabsElement } from "./tabs";
import { type LayoutTab, TABS } from "./tab";
import type { Layout } from "./layout";

//      _____  _____            _____
//     |  __ \|  __ \     /\   / ____|
//     | |  | | |__) |   /  \ | |  __
//     | |  | |  _  /   / /\ \| | |_ |
//     | |__| | | \ \  / ____ \ |__| |
//     |_____/|_|  \_\/_/    \_\_____|
/**The layout showing the drop indicator*/
let indicated: Layout | undefined;
export function show_indicator(target: DropTarget | undefined): void {
  if (indicated && indicated !== target?.layout) indicated.indicate(undefined);
  indicated = target?.layout;
  indicated?.indicate(target?.rect);
}

/**Part of the rect at the side*/
function side_rect(rect: DOMRect, side: LayoutSide, part: number): DOMRect {
  const { x, y, width: w, height: h } = rect;
  switch (side) {
    case LayoutSide.LEFT:
      return new DOMRect(x, y, w * part, h);
    case LayoutSide.RIGHT:
      return new DOMRect(x + w * (1 - part), y, w * part, h);
    case LayoutSide.TOP:
      return new DOMRect(x, y, w, h * part);
    case LayoutSide.BOTTOM:
      return new DOMRect(x, y + h * (1 - part), w, h * part);
    default:
      return rect;
  }
}

/**Nearest side of the rect when the point is within the part of it from the edge*/
function near_side(
  rect: DOMRect,
  x: number,
  y: number,
  part: number,
): LayoutSide | undefined {
  const distances: [LayoutSide, number][] = [
    [LayoutSide.LEFT, (x - rect.left) / rect.width],
    [LayoutSide.RIGHT, (rect.right - x) / rect.width],
    [LayoutSide.TOP, (y - rect.top) / rect.height],
    [LayoutSide.BOTTOM, (rect.bottom - y) / rect.height],
  ];
  const [side, distance] = distances.reduce((a, b) => (b[1] < a[1] ? b : a));
  return distance < part ? side : undefined;
}

/**Finds where the tab would go when dropped at the point, nothing where dropping changes nothing or is not allowed*/
export function find_target(
  tab: LayoutTab,
  x: number,
  y: number,
): DropTarget | undefined {
  const element = tab.ownerDocument.elementFromPoint(x, y);
  const layout = element?.closest<Layout>("composition-layout");
  if (!element || !layout) return;
  const from = tab.group_element();
  const source = from?.node;
  const alone = (group: LayoutTabs) =>
    source === group && group.tabs.ok().length === 1;
  const source_layout = from?.layout();
  if (!source || !source_layout || !can_leave(source_layout, source)) return;
  //Tabs stay among the layouts of their owner
  if (source_layout.owner !== layout.owner) return;

  //Along the edges of a layout with splits, the whole layout is split
  const root = layout.root_node();
  if (root && is_split(root) && layout.root_writable()) {
    const rect = layout.getBoundingClientRect();
    const edge = rem_to_px(ROOT_EDGE);
    const side = near_side(
      rect,
      x,
      y,
      Math.min(edge / rect.width, edge / rect.height),
    );
    if (side)
      return { layout, root: true, side, rect: side_rect(rect, side, 0.25) };
  }

  const group_element = element.closest<TabsElement>("composition-layouttabs");
  if (!group_element || group_element.layout() !== layout) return;
  const group = group_element.node;

  //Over the tab bar, the tab goes between the tabs
  const bar = group_element.bar.getBoundingClientRect();
  const vertical = group_element.vertical;
  if (x >= bar.left && x <= bar.right && y >= bar.top && y <= bar.bottom) {
    if (alone(group) || !group.tabs.writable) return;
    const contents = group.tabs.ok();
    let index = contents.findIndex((content) => {
      const r = TABS.get(content)?.getBoundingClientRect();
      return (
        r && (vertical ? y < r.top + r.height / 2 : x < r.left + r.width / 2)
      );
    });
    if (index === -1) index = contents.length;
    if (source === group) {
      const at = contents.indexOf(tab.content);
      if (index === at || index === at + 1) return;
    }
    const before = contents[index] && TABS.get(contents[index]);
    const last = contents.at(-1);
    const after = last && TABS.get(last);
    const r = (before ?? after)?.getBoundingClientRect();
    if (vertical) {
      const line = r ? (before ? r.top : r.bottom) : bar.top;
      return {
        layout,
        group,
        index,
        rect: new DOMRect(bar.left, line - 1.5, bar.width, 3),
      };
    }
    const line = r ? (before ? r.left : r.right) : bar.left;
    return {
      layout,
      group,
      index,
      rect: new DOMRect(line - 1.5, bar.top, 3, bar.height),
    };
  }

  //Over the content, near an edge splits the group, in the middle joins it
  const body = group_element.body.getBoundingClientRect();
  const side = near_side(body, x, y, EDGE_PART) ?? LayoutSide.CENTER;
  if (side === LayoutSide.CENTER) {
    if (source === group || !group.tabs.writable) return;
  } else if (alone(group) || !can_split(layout, group)) return;
  return { layout, node: group, side, rect: side_rect(body, side, 0.5) };
}
