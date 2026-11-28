import { rem_to_px } from "#theme";
import { LayoutSide } from "./tree";
import { EDGE_PART, ROOT_EDGE, writable } from "./common";
import { can_leave, can_split, type DropTarget, move_content } from "./actions";
import { is_split } from "./split";
import type { LayoutTabs } from "./tabs";
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

/**Finds where the tab would go when dropped at the point of the document, nothing where dropping changes nothing or is not allowed*/
export function find_target(
  tab: LayoutTab,
  x: number,
  y: number,
  doc: Document = tab.ownerDocument,
): DropTarget | undefined {
  const element = doc.elementFromPoint(x, y);
  const layout = element?.closest<Layout>("composition-layout");
  if (!element || !layout) return;
  const source = tab.group_element();
  const alone = (group: LayoutTabs) =>
    source === group && group.contents().length === 1;
  const source_layout = source?.layout();
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

  const group = element.closest<LayoutTabs>("composition-layouttabs");
  if (!group || group.layout() !== layout) return;

  //Over the tab bar, the tab goes between the tabs
  const bar = group.bar.getBoundingClientRect();
  const vertical = group.vertical;
  if (x >= bar.left && x <= bar.right && y >= bar.top && y <= bar.bottom) {
    if (alone(group) || !writable(group.content_state())) return;
    const contents = group.contents();
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
  const body = group.body.getBoundingClientRect();
  const side = near_side(body, x, y, EDGE_PART) ?? LayoutSide.CENTER;
  if (side === LayoutSide.CENTER) {
    if (source === group || !writable(group.content_state())) return;
  } else if (alone(group) || !can_split(layout, group)) return;
  return { layout, node: group, side, rect: side_rect(body, side, 0.5) };
}

//      _____  _____   ____  _____
//     |  __ \|  __ \ / __ \|  __ \
//     | |  | | |__) | |  | | |__) |
//     | |  | |  _  /| |  | |  ___/
//     | |__| | | \ \| |__| | |
//     |_____/|_|  \_\\____/|_|
//The mouse drags tabs with the drag and drop of the browser, which reaches the layouts in every window of the page,
//touch drags them with pointer events, within the window of the tab
/**Type of the data of a dragged tab, so other pages and apps take nothing from it*/
const TAB_DATA = "application/x-chocbite-layout-tab";
/**The tab dragged with the drag and drop of the browser, and where it would go*/
let dragged: LayoutTab | undefined;
let drop_target: DropTarget | undefined;

/**Starts a drag of the tab, from its dragstart*/
export function drag_start(tab: LayoutTab, e: DragEvent): void {
  dragged = tab;
  drop_target = undefined;
  e.dataTransfer?.setData(TAB_DATA, "");
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  //After the browser took the picture of the tab it shows while dragging
  requestAnimationFrame(() => {
    if (dragged === tab) tab.classList.add("dragging");
  });
}

/**Ends the drag, from the dragend of the tab, and from the drop, the browser leaves out the dragend of a tab the drop moved*/
export function drag_end(): void {
  dragged?.classList.remove("dragging");
  dragged = undefined;
  drop_target = undefined;
  show_indicator(undefined);
}

/**Takes tabs dragged with the mouse, from any layout of the page in any of its windows*/
export function accept_drops(layout: Layout): void {
  //A layout inside another one takes the drags over it
  const over = (e: DragEvent) =>
    (e.target as Element).closest?.("composition-layout") === layout;
  layout.addEventListener("dragover", (e) => {
    if (!dragged || !over(e)) return;
    drop_target = find_target(
      dragged,
      e.clientX,
      e.clientY,
      layout.ownerDocument,
    );
    show_indicator(drop_target);
    if (!drop_target) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  });
  layout.addEventListener("dragleave", (e) => {
    if (drop_target?.layout !== layout) return;
    if (layout.contains(e.relatedTarget as Node | null)) return;
    drop_target = undefined;
    show_indicator(undefined);
  });
  layout.addEventListener("drop", (e) => {
    if (!dragged || !over(e)) return;
    e.preventDefault();
    const tab = dragged;
    const target = drop_target;
    drag_end();
    if (target) move_content(tab.content, target);
  });
}
