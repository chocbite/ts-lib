import {
  Base,
  CREATE,
  define_element,
  input_key,
  type BaseOptions,
  type InputOf,
} from "#base";
import ctm, { type ContextMenuLines } from "#context_menu";
import {
  material_close_rounded,
  material_horizontal_split_rounded,
  material_vertical_split_rounded,
} from "#icons";
import type { SVGFunc } from "#svg";
import { rem_to_px } from "#theme";
import {
  CONTENT_CLOSED,
  CONTENT_CREATE,
  CONTENT_HOST,
  content_context_lines,
  HOST_CLOSE_CONTENT,
  type ContentBase,
  type ContentHost,
} from "./content";
import "./layout.scss";
import { TITLEBAR_HEIGHT_TOUCH } from "./panel";

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

/**A tab group in the layout a layout starts with*/
export interface LayoutTabsInit {
  /**Content shown as tabs, in order*/
  tabs: ContentBase[];
  /**Index of the tab shown, the first by default*/
  active?: number;
  /**Share of the space of the split it is in, 1 by default*/
  size?: number;
}
/**A split in the layout a layout starts with*/
export interface LayoutSplitInit {
  split: LayoutDirection;
  children: LayoutInit[];
  /**Share of the space of the split it is in, 1 by default*/
  size?: number;
}
/**The tree of splits and tab groups a layout starts with*/
export type LayoutInit = LayoutTabsInit | LayoutSplitInit;

/**Where layout.open puts the content*/
export interface LayoutOpenOptions {
  /**Content already in the layout, the new content goes into or beside its group,
   * not given it goes into or beside the group the user worked in last*/
  beside?: ContentBase;
  /**Side of that group, center makes it a tab of the group, the default*/
  side?: LayoutSide;
}

/**Smallest size of a tab group in rem, without its tab bar*/
const MIN_WIDTH = 8;
const MIN_HEIGHT = 4;
/**Width of a sizer in rem, in touch mode, used for the minimum size of splits*/
const SIZER_TOUCH = 1;
/**How far the pointer moves in px before pressing a tab becomes dragging it*/
const DRAG_DISTANCE = 6;
/**Part of a tab group from its edges where a dropped tab splits the group, closer to the middle it joins it*/
const EDGE_PART = 0.25;
/**Strip in rem along the edges of a layout with splits, where a dropped tab splits the whole layout*/
const ROOT_EDGE = 1.2;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

//      _   _  ____  _____  ______
//     | \ | |/ __ \|  __ \|  ____|
//     |  \| | |  | | |  | | |__
//     | . ` | |  | | |  | |  __|
//     | |\  | |__| | |__| | |____
//     |_| \_|\____/|_____/|______|
/**What holds a node, a split or the layout itself*/
interface NodeParent {
  replace_node(old: LayoutNode, node: LayoutNode): void;
  remove_node(node: LayoutNode): void;
  update_min(): void;
}
const parent_of = (node: LayoutNode) =>
  node.parentElement as (NodeParent & HTMLElement) | null;

/**A split or a tab group*/
abstract class LayoutNode extends Base {
  static element_name() {
    return "@abstract@";
  }
  static element_name_space() {
    return "composition";
  }

  /**Smallest size in rem, from the contents inside*/
  min_width = 0;
  min_height = 0;

  /**Share of the space of the split it is in*/
  grow(): number {
    return Number(this.style.flexGrow) || 1;
  }
  set_grow(grow: number): void {
    this.style.flexGrow = String(grow);
  }

  abstract update_min(): void;

  /**Sets the smallest size, and tells the parent when it changed*/
  protected publish_min(width: number, height: number): void {
    if (width === this.min_width && height === this.min_height) return;
    this.min_width = width;
    this.min_height = height;
    this.style.minWidth = width + "rem";
    this.style.minHeight = height + "rem";
    parent_of(this)?.update_min();
  }
}

//       _____ _____  _      _____ _______
//      / ____|  __ \| |    |_   _|__   __|
//     | (___ | |__) | |      | |    | |
//      \___ \|  ___/| |      | |    | |
//      ____) | |    | |____ _| |_   | |
//     |_____/|_|    |______|_____|  |_|
/**Children side by side or above each other, with sizers between them*/
class LayoutSplit extends LayoutNode implements NodeParent {
  static element_name() {
    return "layoutsplit";
  }

  readonly direction: LayoutDirection;

  constructor(direction: LayoutDirection) {
    super();
    this.direction = direction;
    this.classList.add(direction);
  }

  nodes(): LayoutNode[] {
    return [...this.children].filter((c) => c instanceof LayoutNode);
  }

  /**Puts the node at the index among the nodes, with a sizer between it and its neighbor*/
  insert_node(node: LayoutNode, index: number, grow: number): void {
    const ref = this.nodes()[index];
    node.set_grow(grow);
    if (ref) {
      this.insertBefore(node, ref);
      this.insertBefore(this.#sizer(), ref);
    } else {
      if (this.nodes().length) this.appendChild(this.#sizer());
      this.appendChild(node);
    }
    this.update_min();
  }

  /**Removes the node with a sizer next to it, a split left with one node is replaced by that node*/
  remove_node(node: LayoutNode): void {
    const next = node.nextElementSibling;
    const prev = node.previousElementSibling;
    if (next?.classList.contains("sizer")) next.remove();
    else if (prev?.classList.contains("sizer")) prev.remove();
    node.remove();
    const nodes = this.nodes();
    const only = nodes[0];
    if (nodes.length === 1 && only) parent_of(this)?.replace_node(this, only);
    else if (nodes.length === 0) parent_of(this)?.remove_node(this);
    else this.update_min();
  }

  /**Puts the node in the place of old, a split in the same direction gives its nodes to this split instead*/
  replace_node(old: LayoutNode, node: LayoutNode): void {
    const grow = old.grow();
    this.replaceChild(node, old);
    node.set_grow(grow);
    if (node instanceof LayoutSplit && node.direction === this.direction) {
      const nodes = node.nodes();
      const total = nodes.reduce((sum, n) => sum + n.grow(), 0);
      nodes.forEach((n, i) => {
        if (i) this.insertBefore(this.#sizer(), node);
        n.set_grow((grow * n.grow()) / total);
        this.insertBefore(n, node);
      });
      node.remove();
    }
    this.update_min();
  }

  update_min(): void {
    const nodes = this.nodes();
    const sizers = Math.max(0, nodes.length - 1) * SIZER_TOUCH;
    const along = (n: LayoutNode) =>
      this.direction === "row" ? n.min_width : n.min_height;
    const across = (n: LayoutNode) =>
      this.direction === "row" ? n.min_height : n.min_width;
    const sum = nodes.reduce((s, n) => s + along(n), sizers);
    const max = nodes.reduce((m, n) => Math.max(m, across(n)), 0);
    if (this.direction === "row") this.publish_min(sum, max);
    else this.publish_min(max, sum);
  }

  #sizer(): HTMLDivElement {
    const sizer = document.createElement("div");
    sizer.className = "sizer";
    sizer.onpointerdown = (e) => this.#size_start(e, sizer);
    return sizer;
  }

  /**Moves the sizer, the two nodes beside it share their space, never below their smallest size*/
  #size_start(e: PointerEvent, sizer: HTMLDivElement): void {
    if (e.button !== 0) return;
    e.preventDefault();
    const a = sizer.previousElementSibling as LayoutNode | null;
    const b = sizer.nextElementSibling as LayoutNode | null;
    if (!a || !b) return;
    const row = this.direction === "row";
    const length = (n: LayoutNode) => {
      const rect = n.getBoundingClientRect();
      return row ? rect.width : rect.height;
    };
    const la = length(a);
    const total = la + length(b);
    const min_a = rem_to_px(row ? a.min_width : a.min_height);
    const min_b = rem_to_px(row ? b.min_width : b.min_height);
    const grow = a.grow() + b.grow();
    sizer.setPointerCapture(e.pointerId);
    sizer.classList.add("active");
    sizer.onpointermove = (ev) => {
      if (min_a > total - min_b) return;
      const moved = row ? ev.clientX - e.clientX : ev.clientY - e.clientY;
      const size = clamp(la + moved, min_a, total - min_b);
      a.set_grow((grow * size) / total);
      b.set_grow((grow * (total - size)) / total);
    };
    sizer.onpointerup = sizer.onpointercancel = () => {
      sizer.releasePointerCapture(e.pointerId);
      sizer.classList.remove("active");
      sizer.onpointermove = null;
      sizer.onpointerup = null;
      sizer.onpointercancel = null;
    };
  }
}
define_element(LayoutSplit);

//      _______       ____   _____
//     |__   __|/\   |  _ \ / ____|
//        | |  /  \  | |_) | (___
//        | | / /\ \ |  _ < \___ \
//        | |/ ____ \| |_) |____) |
//        |_/_/    \_\____/|_____/
/**A tab bar and the content of the active tab, the other contents are not in the document*/
class LayoutTabs extends LayoutNode {
  static element_name() {
    return "layouttabs";
  }

  readonly bar = this.appendChild(document.createElement("div"));
  readonly body = this.appendChild(document.createElement("div"));
  #active?: LayoutTab;

  constructor() {
    super();
    this.bar.className = "bar";
    this.body.className = "body";
    this.update_min();
  }

  tabs(): LayoutTab[] {
    return [...this.bar.children] as LayoutTab[];
  }

  get active_tab(): LayoutTab | undefined {
    return this.#active;
  }

  /**Adds the tab at the index, at the end when not given*/
  add_tab(tab: LayoutTab, index?: number, activate = true): void {
    this.bar.insertBefore(
      tab,
      index === undefined ? null : (this.tabs()[index] ?? null),
    );
    if (activate || !this.#active) this.activate(tab);
    this.update_min();
  }

  /**Moves a tab of this group, the index counts the tabs with the tab still at its place*/
  move_tab(tab: LayoutTab, index: number): void {
    this.bar.insertBefore(tab, this.tabs()[index] ?? null);
  }

  /**Removes the tab, a group left empty removes itself, except the last group of the layout*/
  remove_tab(tab: LayoutTab): void {
    const tabs = this.tabs();
    const index = tabs.indexOf(tab);
    tab.remove();
    if (this.#active === tab) {
      this.#active = undefined;
      tab.content.remove();
      tab.set_selected(false);
      const next = tabs[index + 1] ?? tabs[index - 1];
      if (next) this.activate(next);
    }
    const parent = parent_of(this);
    if (tabs.length === 1 && parent instanceof LayoutSplit)
      parent.remove_node(this);
    else this.update_min();
  }

  activate(tab: LayoutTab): void {
    if (this.#active === tab) return;
    this.#active?.set_selected(false);
    this.#active = tab;
    tab.set_selected(true);
    this.body.replaceChildren(tab.content);
  }

  update_min(): void {
    const tabs = this.tabs();
    this.publish_min(
      tabs.reduce((m, t) => Math.max(m, t.min_width), MIN_WIDTH),
      tabs.reduce((m, t) => Math.max(m, t.min_height), MIN_HEIGHT) +
        TITLEBAR_HEIGHT_TOUCH,
    );
  }
}
define_element(LayoutTabs);

//      _______       ____
//     |__   __|/\   |  _ \
//        | |  /  \  | |_) |
//        | | / /\ \ |  _ <
//        | |/ ____ \| |_) |
//        |_/_/    \_\____/
/**Inputs of the content the tab follows, inner inputs that are not options*/
const TAB_CONTENT = {
  title: input_key<InputOf<typeof CONTENT_CREATE.title>>(),
  icon: input_key<InputOf<typeof CONTENT_CREATE.icon>>(),
  closable: input_key<InputOf<typeof CONTENT_CREATE.closable>>(),
  min_width: input_key<InputOf<typeof CONTENT_CREATE.min_width>>(),
  min_height: input_key<InputOf<typeof CONTENT_CREATE.min_height>>(),
};

/**The tab of every content in a layout*/
const TABS = new WeakMap<ContentBase, LayoutTab>();

/**Closes content in a layout, its tab goes with it*/
const LAYOUT_HOST: ContentHost = {
  [HOST_CLOSE_CONTENT](content: ContentBase): void {
    const tab = TABS.get(content);
    if (!tab) return;
    tab.group()?.remove_tab(tab);
    TABS.delete(content);
    content[CONTENT_HOST] = undefined;
    content.remove();
    content[CONTENT_CLOSED]();
  },
};

/**Tab of one content, follows its title, icon, close button and smallest size, moves with the content*/
class LayoutTab extends Base {
  static element_name() {
    return "layouttab";
  }
  static element_name_space() {
    return "composition";
  }

  readonly content: ContentBase;
  min_width = 0;
  min_height = 0;
  #closable = false;
  #dragging = false;
  #icon = this.appendChild(document.createElement("div"));
  #title = this.appendChild(document.createElement("div"));
  #close = this.appendChild(document.createElement("div"));

  constructor(content: ContentBase) {
    super();
    this.content = content;
    content[CONTENT_HOST] = LAYOUT_HOST;
    TABS.set(content, this);
    this.tabIndex = -1;
    this.#icon.className = "icon";
    this.#title.className = "title";
    this.#close.className = "close";
    this.#close.textContent = "×";
    this.#close.hidden = true;
    this.#close.onpointerdown = (e) => {
      e.stopPropagation();
      e.preventDefault();
    };
    this.#close.onclick = (e) => {
      e.stopPropagation();
      this.content.content_close();
    };
    this.onpointerdown = (e) => this.#press(e);
    this.onkeydown = (e) => this.#key(e);
    ctm.attach(
      this,
      ctm.combine(
        () => this.#lines(),
        () => content_context_lines(this.content),
      ),
      () => this.#dragging,
    );
  }

  [CREATE](options: BaseOptions): void {
    super[CREATE](options);
    const content = this.content;
    this.set_input(TAB_CONTENT.icon, content.content_icon, (icon) =>
      this.#set_icon(icon.ok ? icon.value : undefined),
    );
    this.set_input(TAB_CONTENT.title, content.content_title, (title) => {
      this.#title.textContent = title.ok
        ? title.value
        : "⚠ " + title.error.nice;
    });
    this.set_input(TAB_CONTENT.closable, content.content_closable, (c) => {
      this.#closable = c.ok && c.value;
      this.#close.hidden = !this.#closable;
    });
    this.set_input(TAB_CONTENT.min_width, content.content_min_width, (w) => {
      this.min_width = w.ok ? w.value : 0;
      this.group()?.update_min();
    });
    this.set_input(TAB_CONTENT.min_height, content.content_min_height, (h) => {
      this.min_height = h.ok ? h.value : 0;
      this.group()?.update_min();
    });
  }

  /**Group the tab is in*/
  group(): LayoutTabs | undefined {
    const group = this.parentElement?.parentElement;
    return group instanceof LayoutTabs ? group : undefined;
  }

  set_selected(selected: boolean): void {
    this.classList.toggle("selected", selected);
    this.tabIndex = selected ? 0 : -1;
  }

  #set_icon(icon?: SVGFunc): void {
    this.#icon.replaceChildren();
    if (icon) this.#icon.appendChild(icon());
    this.#icon.hidden = !icon;
  }

  #lines(): ContextMenuLines {
    const lines: ContextMenuLines = [];
    const group = this.group();
    if (this.#closable)
      lines.push(
        ctm.line({
          text: "Close",
          icon: material_close_rounded,
          on_click: () => this.content.content_close(),
        }),
      );
    if (group && group.tabs().length > 1)
      lines.push(
        ctm.line({
          text: "Split right",
          icon: material_vertical_split_rounded,
          on_click: () =>
            move_tab(this, { node: group, side: LayoutSide.RIGHT }),
        }),
        ctm.line({
          text: "Split down",
          icon: material_horizontal_split_rounded,
          on_click: () =>
            move_tab(this, { node: group, side: LayoutSide.BOTTOM }),
        }),
      );
    return lines;
  }

  #key(e: KeyboardEvent): void {
    const group = this.group();
    if (!group) return;
    const tabs = group.tabs();
    const index = tabs.indexOf(this);
    let next: LayoutTab | undefined;
    if (e.key === "ArrowLeft") next = tabs[index - 1] ?? tabs.at(-1);
    else if (e.key === "ArrowRight") next = tabs[index + 1] ?? tabs[0];
    else if (e.key === "Home") next = tabs[0];
    else if (e.key === "End") next = tabs.at(-1);
    else if (e.key === "Enter") {
      e.preventDefault();
      this.content.focus();
      return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
    if (!next) return;
    group.activate(next);
    next.focus();
  }

  /**Shows the tab, a middle press closes it, and moving the pointer far enough drags it*/
  #press(e: PointerEvent): void {
    const group = this.group();
    if (!group) return;
    if (e.button === 1) {
      e.preventDefault();
      if (this.#closable) this.content.content_close();
      return;
    }
    if (e.button !== 0) return;
    group.activate(this);
    const doc = this.ownerDocument;
    let target: DropTarget | undefined;
    this.setPointerCapture(e.pointerId);
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      target = undefined;
      end();
    };
    const end = () => {
      if (this.hasPointerCapture(e.pointerId))
        this.releasePointerCapture(e.pointerId);
      this.onpointermove = this.onpointerup = this.onpointercancel = null;
      doc.removeEventListener("keydown", key, true);
      this.classList.remove("dragging");
      show_indicator(undefined);
      //The context menu of the long press on touch comes after, it is blocked until then
      setTimeout(() => (this.#dragging = false));
    };
    this.onpointermove = (ev) => {
      if (!this.#dragging) {
        const moved = Math.hypot(
          ev.clientX - e.clientX,
          ev.clientY - e.clientY,
        );
        if (moved < DRAG_DISTANCE) return;
        this.#dragging = true;
        this.classList.add("dragging");
        doc.addEventListener("keydown", key, true);
      }
      target = find_target(this, ev.clientX, ev.clientY);
      show_indicator(target);
    };
    this.onpointerup = () => {
      const drop = this.#dragging ? target : undefined;
      end();
      if (drop) move_tab(this, drop);
    };
    this.onpointercancel = () => {
      target = undefined;
      end();
    };
  }
}
define_element(LayoutTab);

//      _____  _____            _____
//     |  __ \|  __ \     /\   / ____|
//     | |  | | |__) |   /  \ | |  __
//     | |  | |  _  /   / /\ \| | |_ |
//     | |__| | | \ \  / ____ \ |__| |
//     |_____/|_|  \_\/_/    \_\_____|
/**Where a dragged tab goes, into a tab bar at an index, or a side of a node, or a side of the whole layout*/
type DropTarget =
  | { group: LayoutTabs; index: number; rect?: DOMRect }
  | { node: LayoutNode; side: LayoutSide; rect?: DOMRect }
  | { layout: Layout; side: LayoutSide; rect?: DOMRect };

/**The layout showing the drop indicator*/
let indicated: Layout | undefined;
function show_indicator(target: DropTarget | undefined): void {
  const layout =
    target &&
    ("layout" in target
      ? target.layout
      : ("group" in target ? target.group : target.node).closest<Layout>(
          "composition-layout",
        ));
  if (indicated && indicated !== layout) indicated.indicate(undefined);
  indicated = layout ?? undefined;
  indicated?.indicate(target?.rect);
}

/**Part of the rect at the side, half of it, or a quarter for a whole layout*/
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

/**Finds where the tab would go when dropped at the point, nothing where dropping changes nothing*/
function find_target(
  tab: LayoutTab,
  x: number,
  y: number,
): DropTarget | undefined {
  const element = tab.ownerDocument.elementFromPoint(x, y);
  const layout = element?.closest<Layout>("composition-layout");
  if (!element || !layout) return;
  const source = tab.group();
  const alone = (group: LayoutTabs) =>
    source === group && group.tabs().length === 1;

  //Along the edges of a layout with splits, the whole layout is split
  const root = layout.root;
  if (root instanceof LayoutSplit) {
    const rect = layout.getBoundingClientRect();
    const edge = rem_to_px(ROOT_EDGE);
    const side = near_side(
      rect,
      x,
      y,
      Math.min(edge / rect.width, edge / rect.height),
    );
    if (side) return { layout, side, rect: side_rect(rect, side, 0.25) };
  }

  const group = element.closest<LayoutTabs>("composition-layouttabs");
  if (!group || group.closest("composition-layout") !== layout) return;

  //Over the tab bar, the tab goes between the tabs
  const bar = group.bar.getBoundingClientRect();
  if (y < bar.bottom) {
    if (alone(group)) return;
    const tabs = group.tabs();
    let index = tabs.findIndex((t) => {
      const r = t.getBoundingClientRect();
      return x < r.left + r.width / 2;
    });
    if (index === -1) index = tabs.length;
    if (source === group) {
      const at = tabs.indexOf(tab);
      if (index === at || index === at + 1) return;
    }
    const before = tabs[index]?.getBoundingClientRect();
    const after = tabs.at(-1)?.getBoundingClientRect();
    const line = before ? before.left : (after?.right ?? bar.left);
    return {
      group,
      index,
      rect: new DOMRect(line - 1.5, bar.top, 3, bar.height),
    };
  }

  //Over the content, near an edge splits the group, in the middle joins it
  const body = group.body.getBoundingClientRect();
  const side = near_side(body, x, y, EDGE_PART) ?? LayoutSide.CENTER;
  if (side === LayoutSide.CENTER ? source === group : alone(group)) return;
  return { node: group, side, rect: side_rect(body, side, 0.5) };
}

/**Puts a new group with the tab at the side of the node*/
function insert_beside(node: LayoutNode, side: LayoutSide, tab: LayoutTab) {
  const group = LayoutTabs.create();
  group.add_tab(tab);
  const direction: LayoutDirection =
    side === LayoutSide.LEFT || side === LayoutSide.RIGHT ? "row" : "column";
  const after = side === LayoutSide.RIGHT || side === LayoutSide.BOTTOM;
  const parent = parent_of(node);
  if (!parent) return;
  if (parent instanceof LayoutSplit && parent.direction === direction) {
    //Takes half the space of the node, in the split the node is in
    const grow = node.grow() / 2;
    node.set_grow(grow);
    const index = parent.nodes().indexOf(node);
    parent.insert_node(group, after ? index + 1 : index, grow);
    return;
  }
  const split = LayoutSplit.create({}, direction);
  parent.replace_node(node, split);
  split.insert_node(node, 0, 1);
  split.insert_node(group, after ? 1 : 0, 1);
}

/**Moves the tab with its content to the target, the group it leaves removes itself when empty*/
function move_tab(tab: LayoutTab, target: DropTarget): void {
  const source = tab.group();
  if ("group" in target) {
    if (source === target.group) target.group.move_tab(tab, target.index);
    else {
      source?.remove_tab(tab);
      target.group.add_tab(tab, target.index);
    }
  } else if ("node" in target && target.side === LayoutSide.CENTER) {
    source?.remove_tab(tab);
    (target.node as LayoutTabs).add_tab(tab);
  } else {
    source?.remove_tab(tab);
    //The root is found after the tab left, leaving can change it
    const node = "layout" in target ? target.layout.root : target.node;
    insert_beside(node, target.side, tab);
  }
  tab.focus();
}

//      _           __     ______  _    _ _______
//     | |        /\\ \   / / __ \| |  | |__   __|
//     | |       /  \\ \_/ / |  | | |  | |  | |
//     | |      / /\ \\   /| |  | | |  | |  | |
//     | |____ / ____ \| | | |__| | |__| |  | |
//     |______/_/    \_\_|  \____/ \____/   |_|
/**Builds the node of the description, with tabs for its contents*/
function build(init: LayoutInit): LayoutNode {
  if ("tabs" in init) {
    const group = LayoutTabs.create();
    for (const content of init.tabs)
      group.add_tab(LayoutTab.create({}, content), undefined, false);
    const active = group.tabs()[init.active ?? 0];
    if (active) group.activate(active);
    return group;
  }
  const split = LayoutSplit.create({}, init.split);
  for (const child of init.children)
    split.insert_node(build(child), Infinity, child.size ?? 1);
  return split;
}

/**Contents in tab groups, side by side and above each other, the user drags the tabs around*/
class Layout extends Base implements NodeParent {
  static element_name() {
    return "layout";
  }
  static element_name_space() {
    return "composition";
  }

  #root: LayoutNode;
  #indicator = document.createElement("div");
  #last?: LayoutTabs;

  /**@param init the tree of splits and tab groups the layout starts with*/
  constructor(init: LayoutInit) {
    super();
    this.#root = this.appendChild(build(init));
    this.#indicator.className = "indicator";
    this.appendChild(this.#indicator);
    this.addEventListener("focusin", (e) => {
      const group = (e.target as Element).closest("composition-layouttabs");
      if (group instanceof LayoutTabs) this.#last = group;
    });
  }

  /**The top node, a split or a group*/
  get root(): LayoutNode {
    return this.#root;
  }

  /**All contents in the layout*/
  get contents(): ContentBase[] {
    return [...this.querySelectorAll("composition-layouttab")]
      .filter((tab) => tab.closest("composition-layout") === this)
      .map((tab) => (tab as LayoutTab).content);
  }

  /**Opens content in the layout, content already in it is shown*/
  open(content: ContentBase, options: LayoutOpenOptions = {}): void {
    const open = TABS.get(content);
    if (open) {
      open.group()?.activate(open);
      return;
    }
    const tab = LayoutTab.create({}, content);
    const beside = options.beside && TABS.get(options.beside)?.group();
    const last = this.#last?.closest("composition-layout") === this;
    const group =
      beside ??
      (last ? this.#last : undefined) ??
      (this.querySelector("composition-layouttabs") as LayoutTabs);
    const side = options.side ?? LayoutSide.CENTER;
    if (side === LayoutSide.CENTER) group.add_tab(tab);
    else insert_beside(group, side, tab);
  }

  /**Shows where a dragged tab goes, the rect is in the coordinates of the page*/
  indicate(rect: DOMRect | undefined): void {
    this.#indicator.classList.toggle("shown", !!rect);
    if (!rect) return;
    const own = this.getBoundingClientRect();
    Object.assign(this.#indicator.style, {
      left: rect.left - own.left + "px",
      top: rect.top - own.top + "px",
      width: rect.width + "px",
      height: rect.height + "px",
    });
  }

  replace_node(old: LayoutNode, node: LayoutNode): void {
    if (old !== this.#root) return;
    this.replaceChild(node, old);
    node.set_grow(1);
    this.#root = node;
  }

  /**Only reached when the root split ends up empty, the layout then gets an empty group*/
  remove_node(node: LayoutNode): void {
    if (node === this.#root) this.replace_node(node, LayoutTabs.create());
  }

  update_min(): void {}
}
define_element(Layout);

export type { Layout };

/**Creates a layout of tab groups, side by side and above each other, the user drags the tabs around
 * @param init the tree of splits and tab groups it starts with*/
export function layout(
  init: LayoutInit = { tabs: [] },
  options: BaseOptions = {},
): Layout {
  return Layout.create(options, init);
}
