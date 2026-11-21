import {
  Base,
  CREATE,
  define_element,
  input_key,
  type BaseOptions,
  type InputOf,
  type InputOptions,
} from "#base";
import ctm, { type ContextMenuLines } from "#context_menu";
import {
  material_close_rounded,
  material_horizontal_split_rounded,
  material_open_in_new_rounded,
  material_vertical_split_rounded,
} from "#icons";
import type { SVGFunc } from "#svg";
import { rem_to_px } from "#theme";
import state, {
  type StateArrayRead,
  type StateOrValROS,
  type StateROS,
} from "@chocbite/ts-lib/state";
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

/**A tab group of a layout, the layout writes its states when the user changes it, a read only state locks that part*/
export interface LayoutTabs {
  /**Contents shown as tabs, in order, written with array instructions*/
  readonly tabs: StateROS<ContentBase[]>;
  /**Content of the shown tab, the first tab is shown when it is not among the tabs*/
  readonly active: StateROS<ContentBase | undefined>;
  /**Share of the space of the split it is in*/
  readonly size: StateROS<number>;
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

const is_split = (node: LayoutNode): node is LayoutSplit => "children" in node;

/**A tab group with writable states, starting with the given contents*/
export function layout_tabs(
  tabs: ContentBase[] = [],
  options: { active?: ContentBase; size?: number } = {},
): LayoutTabs {
  return {
    tabs: state.ok_w(tabs),
    active: state.ok_w<ContentBase | undefined>(options.active),
    size: state.ok_w(options.size ?? 1),
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
  /**Takes a tab group the layout popped out, already taken out of the layout, rect is where its group was on the page*/
  [OWNER_POPOUT](layout: Layout, node: LayoutTabs, rect: DOMRect): void;
  /**Whether the last tab of the layout can leave it*/
  [OWNER_CAN_EMPTY](layout: Layout): boolean;
  /**The tree of the layout became an empty tab group, like a panel whose last tab was dragged out*/
  [OWNER_EMPTY](layout: Layout): void;
}

/**Smallest size of a tab group in rem, without its tab bar*/
const MIN_WIDTH = 8;
const MIN_HEIGHT = 4;
/**Width of a sizer in rem, in touch mode, used for the minimum size of splits*/
const SIZER_TOUCH = 1;
/**Distance in rem from a pressed sizer where other sizers are moved with it, at crossings and where sizers line up*/
const SIZER_REACH = 0.75;
/**How far the pointer moves in px before pressing a tab becomes dragging it*/
const DRAG_DISTANCE = 6;
/**Part of a tab group from its edges where a dropped tab splits the group, closer to the middle it joins it*/
const EDGE_PART = 0.25;
/**Strip in rem along the edges of a layout with splits, where a dropped tab splits the whole layout*/
const ROOT_EDGE = 1.2;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/**Writes the state when it is writable, writes of local states apply at once*/
function write(target: StateROS<unknown>, value: unknown): void {
  if (target.writable)
    void (target as unknown as { write(v: unknown): unknown }).write(value);
}

//               _____ _______ _____ ____  _   _  _____
//         /\   / ____|__   __|_   _/ __ \| \ | |/ ____|
//        /  \ | |       | |    | || |  | |  \| | (___
//       / /\ \| |       | |    | || |  | | . ` |\___ \
//      / ____ \ |____   | |   _| || |__| | |\  |____) |
//     /_/    \_\_____|  |_|  |_____\____/|_| \_|_____/
//Changes are made to the data, the elements follow the states, so a layout shows what its states give back
/**The tab group holding the content, searched from the node*/
function group_of(
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
function first_group(node: LayoutNode): LayoutTabs | undefined {
  if (!is_split(node)) return node;
  for (const child of node.children.ok()) {
    const found = first_group(child);
    if (found) return found;
  }
  return undefined;
}

/**Takes the content out of the group, a group left empty leaves its split*/
function take_out(layout: Layout, group: LayoutTabs, content: ContentBase) {
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
function can_leave(layout: Layout, group: LayoutTabs): boolean {
  if (!group.tabs.writable) return false;
  if (group.tabs.ok().length > 1) return true;
  const parent = layout.parent_of(group);
  if (parent) return parent.children.writable;
  return layout.owner?.[OWNER_CAN_EMPTY](layout) ?? true;
}

/**Takes the content out of its layout and gives it to the owner of the layout in a tab group of its own*/
function popout(layout: Layout, group: TabsElement, content: ContentBase) {
  const owner = layout.owner;
  if (!owner) return;
  const rect = group.getBoundingClientRect();
  take_out(layout, group.node, content);
  owner[OWNER_POPOUT](
    layout,
    layout_tabs([content], { active: content }),
    rect,
  );
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
function insert_beside(
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
function can_split(layout: Layout, node: LayoutNode): boolean {
  const parent = layout.parent_of(node);
  return parent ? parent.children.writable : layout.root_writable();
}

/**Where a dragged tab goes, into a tab bar at an index, a side of a group, or a side of the whole layout*/
type DropTarget = { layout: Layout; rect?: DOMRect } & (
  | { group: LayoutTabs; index: number }
  | { node: LayoutNode; side: LayoutSide }
  | { root: true; side: LayoutSide }
);

/**Moves the content to the target, the group it leaves is removed when empty*/
function move_content(content: ContentBase, target: DropTarget): void {
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

//      _   _  ____  _____  ______  _____
//     | \ | |/ __ \|  __ \|  ____|/ ____|
//     |  \| | |  | | |  | | |__  | (___
//     | . ` | |  | | |  | |  __|  \___ \
//     | |\  | |__| | |__| | |____ ____) |
//     |_| \_|\____/|_____/|______|_____/
/**The element showing each node, a node is shown in one place at a time, so its element is moved with it*/
const ELEMENTS = new WeakMap<LayoutNode, NodeElement>();
function element_of(node: LayoutNode): NodeElement {
  let element = ELEMENTS.get(node);
  if (!element) {
    element = is_split(node)
      ? SplitElement.create({}, node)
      : TabsElement.create({}, node);
    ELEMENTS.set(node, element);
  }
  return element;
}

/**Element of a split or a tab group, its share of the space follows the size state of the node*/
abstract class NodeElement extends Base {
  static element_name() {
    return "@abstract@";
  }
  static element_name_space() {
    return "composition";
  }

  readonly node: LayoutNode;
  /**Smallest size in rem, from the contents inside*/
  min_width = 0;
  min_height = 0;

  constructor(node: LayoutNode) {
    super();
    this.node = node;
    this.attach_state(node.size, (size) => {
      this.style.flexGrow = String(size.value);
    });
  }

  layout(): Layout | null {
    return this.closest<Layout>("composition-layout");
  }

  abstract update_min(): void;

  /**Sets the smallest size, and tells the split it is in when it changed*/
  protected publish_min(width: number, height: number): void {
    if (width === this.min_width && height === this.min_height) return;
    this.min_width = width;
    this.min_height = height;
    this.style.minWidth = width + "rem";
    this.style.minHeight = height + "rem";
    const parent = this.parentElement;
    if (parent instanceof SplitElement) parent.update_min();
  }
}

//       _____ _____  _      _____ _______
//      / ____|  __ \| |    |_   _|__   __|
//     | (___ | |__) | |      | |    | |
//      \___ \|  ___/| |      | |    | |
//      ____) | |    | |____ _| |_   | |
//     |_____/|_|    |______|_____|  |_|
/**Children side by side or above each other, with a sizer between each two*/
class SplitElement extends NodeElement {
  static element_name() {
    return "layoutsplit";
  }

  declare readonly node: LayoutSplit;
  /**Elements of the children, in order, the DOM has a sizer between each two*/
  #children: NodeElement[] = [];

  constructor(node: LayoutSplit) {
    super(node);
    this.classList.add(node.direction);
    this.attach_state(node.children, (children) => this.#apply(children.value));
  }

  /**Applies only the changes the array write carries*/
  #apply(children: StateArrayRead<LayoutNode>): void {
    for (const change of state.a.read(children)) {
      switch (change.type) {
        case "fresh":
          this.#remove(0, this.#children.length);
          this.#insert(0, change.items);
          break;
        case "added":
          this.#insert(change.index, change.items);
          break;
        case "removed":
          this.#remove(change.index, change.items.length);
          break;
        case "changed":
          this.#remove(change.index, change.items.length);
          this.#insert(change.index, change.items);
          break;
        case "moved": {
          const moved = this.#children.slice(
            change.from_index,
            change.from_index + change.items.length,
          );
          this.#remove(change.from_index, change.items.length);
          this.#insert(
            change.to_index,
            moved.map((e) => e.node),
          );
        }
      }
    }
    this.update_min();
  }

  #insert(index: number, nodes: readonly LayoutNode[]): void {
    const elements = nodes.map(element_of);
    const ref = this.#children[index] ?? null;
    for (const element of elements) this.insertBefore(element, ref);
    this.#children.splice(index, 0, ...elements);
    this.#fix_sizers();
  }

  #remove(index: number, count: number): void {
    for (const element of this.#children.splice(index, count))
      //An element already moved elsewhere by the same change stays there
      if (element.parentElement === this) element.remove();
    this.#fix_sizers();
  }

  /**Puts one sizer between each two children and removes the others, a split has only a few children*/
  #fix_sizers(): void {
    let prev: Element | null = null;
    for (const child of [...this.children]) {
      if (child.classList.contains("sizer")) {
        if (!(prev instanceof NodeElement)) {
          child.remove();
          continue;
        }
      } else if (prev instanceof NodeElement)
        this.insertBefore(this.#sizer(), child);
      prev = child;
    }
    if (this.lastElementChild?.classList.contains("sizer"))
      this.lastElementChild.remove();
  }

  update_min(): void {
    const children = this.#children;
    const sizers = Math.max(0, children.length - 1) * SIZER_TOUCH;
    const row = this.node.direction === "row";
    const along = (e: NodeElement) => (row ? e.min_width : e.min_height);
    const across = (e: NodeElement) => (row ? e.min_height : e.min_width);
    const sum = children.reduce((s, e) => s + along(e), sizers);
    const max = children.reduce((m, e) => Math.max(m, across(e)), 0);
    if (row) this.publish_min(sum, max);
    else this.publish_min(max, sum);
  }

  #sizer(): HTMLDivElement {
    const sizer = document.createElement("div");
    sizer.className = "sizer";
    sizer.onpointerdown = (e) => sizer_press(e, sizer);
    sizer.onpointermove = (e) => sizer_hover(sizer, e);
    sizer.onpointerleave = () => sizer_hover(sizer);
    return sizer;
  }

  /**Starts moving a sizer of the split, the two children beside it share their space, never below their
   * smallest size, the sizes are written when it ends, undefined when either size is read only*/
  sizer_drag(sizer: Element): SizerDrag | undefined {
    const a = sizer.previousElementSibling;
    const b = sizer.nextElementSibling;
    if (!(a instanceof NodeElement) || !(b instanceof NodeElement)) return;
    if (!a.node.size.writable || !b.node.size.writable) return;
    const row = this.node.direction === "row";
    const length = (n: NodeElement) => {
      const rect = n.getBoundingClientRect();
      return row ? rect.width : rect.height;
    };
    const la = length(a);
    const total = la + length(b);
    const min_a = rem_to_px(row ? a.min_width : a.min_height);
    const min_b = rem_to_px(row ? b.min_width : b.min_height);
    const grow = a.node.size.ok() + b.node.size.ok();
    let grow_a = a.node.size.ok();
    return {
      row,
      move: (moved) => {
        if (min_a > total - min_b) return;
        const size = clamp(la + moved, min_a, total - min_b);
        grow_a = (grow * size) / total;
        a.style.flexGrow = String(grow_a);
        b.style.flexGrow = String(grow - grow_a);
      },
      end: () => {
        write(a.node.size, grow_a);
        write(b.node.size, grow - grow_a);
      },
    };
  }
}
define_element(SplitElement);

/**One sizer being moved, moved is in px from where the pointer was pressed, along the direction of its split*/
interface SizerDrag {
  readonly row: boolean;
  move(moved: number): void;
  end(): void;
}

/**Whether the sizer is between children side by side, so it moves sideways*/
const sizer_row = (sizer: Element) =>
  sizer.parentElement?.classList.contains("row") ?? false;

/**The sizer and every other sizer of the same layout within reach of the point, so sizers meeting at a
 * crossing, or lining up across a sizer, are moved together*/
function sizers_at(sizer: HTMLElement, x: number, y: number): HTMLElement[] {
  const layout = sizer.closest("composition-layout");
  if (!layout) return [sizer];
  const reach = rem_to_px(SIZER_REACH);
  const found = [sizer];
  for (const other of layout.querySelectorAll<HTMLElement>(".sizer")) {
    if (other === sizer || other.closest("composition-layout") !== layout)
      continue;
    const r = other.getBoundingClientRect();
    if (
      x >= r.left - reach &&
      x <= r.right + reach &&
      y >= r.top - reach &&
      y <= r.bottom + reach
    )
      found.push(other);
  }
  return found;
}

/**Sizers marked as moving together with the hovered sizer*/
let joined: HTMLElement[] = [];

/**Marks the sizers a press would move with the hovered one, a crossing gets the move cursor,
 * without an event the pointer left*/
function sizer_hover(sizer: HTMLElement, e?: PointerEvent): void {
  if (sizer.classList.contains("active")) return;
  for (const other of joined) other.classList.remove("joined");
  joined = e ? sizers_at(sizer, e.clientX, e.clientY).slice(1) : [];
  for (const other of joined) other.classList.add("joined");
  const row = sizer_row(sizer);
  sizer.classList.toggle(
    "crossing",
    joined.some((other) => sizer_row(other) !== row),
  );
}

/**Moves the pressed sizer and the sizers within reach of the pointer, each along its own direction*/
function sizer_press(e: PointerEvent, sizer: HTMLElement): void {
  if (e.button !== 0) return;
  const sizers = sizers_at(sizer, e.clientX, e.clientY);
  const drags: SizerDrag[] = [];
  const moving: HTMLElement[] = [];
  for (const s of sizers) {
    const split = s.parentElement;
    const drag =
      split instanceof SplitElement ? split.sizer_drag(s) : undefined;
    if (!drag) continue;
    drags.push(drag);
    moving.push(s);
  }
  if (!drags.length) return;
  e.preventDefault();
  sizer_hover(sizer);
  sizer.classList.toggle(
    "crossing",
    drags.some((d) => d.row) && drags.some((d) => !d.row),
  );
  for (const s of moving) s.classList.add("active");
  sizer.setPointerCapture(e.pointerId);
  sizer.onpointermove = (ev) => {
    for (const drag of drags)
      drag.move(drag.row ? ev.clientX - e.clientX : ev.clientY - e.clientY);
  };
  sizer.onpointerup = sizer.onpointercancel = () => {
    for (const s of moving) s.classList.remove("active");
    sizer.onpointermove = (ev) => sizer_hover(sizer, ev);
    sizer.onpointerup = sizer.onpointercancel = null;
    for (const drag of drags) drag.end();
  };
}

//      _______       ____   _____
//     |__   __|/\   |  _ \ / ____|
//        | |  /  \  | |_) | (___
//        | | / /\ \ |  _ < \___ \
//        | |/ ____ \| |_) |____) |
//        |_/_/    \_\____/|_____/
/**A tab bar and the content of the shown tab, the other contents are not in the document*/
class TabsElement extends NodeElement {
  static element_name() {
    return "layouttabs";
  }

  declare readonly node: LayoutTabs;
  readonly bar = this.appendChild(document.createElement("div"));
  readonly body = this.appendChild(document.createElement("div"));
  /**Tabs in order, a tab moved to another group is no longer a child of the bar*/
  #tabs: LayoutTab[] = [];

  constructor(node: LayoutTabs) {
    super(node);
    this.bar.className = "bar";
    this.body.className = "body";
    //A group with read only tabs hides the close buttons
    this.classList.toggle("locked", !node.tabs.writable);
    this.attach_state(node.tabs, (tabs) => this.#apply(tabs.value));
    this.attach_state(node.active, () => this.#show_active());
  }

  /**Applies only the changes the array write carries*/
  #apply(contents: StateArrayRead<ContentBase>): void {
    for (const change of state.a.read(contents)) {
      switch (change.type) {
        case "fresh":
          this.#remove(0, this.#tabs.length);
          this.#insert(0, change.items);
          break;
        case "added":
          this.#insert(change.index, change.items);
          break;
        case "removed":
          this.#remove(change.index, change.items.length);
          break;
        case "changed":
          this.#remove(change.index, change.items.length);
          this.#insert(change.index, change.items);
          break;
        case "moved": {
          const moved = this.#tabs.splice(
            change.from_index,
            change.items.length,
          );
          this.#tabs.splice(change.to_index, 0, ...moved);
          const ref = this.#tabs[change.to_index + moved.length] ?? null;
          for (const tab of moved) this.bar.insertBefore(tab, ref);
        }
      }
    }
    this.#show_active();
    this.update_min();
  }

  #insert(index: number, contents: readonly ContentBase[]): void {
    const tabs = contents.map(tab_of);
    const ref = this.#tabs[index] ?? null;
    for (const tab of tabs) this.bar.insertBefore(tab, ref);
    this.#tabs.splice(index, 0, ...tabs);
  }

  #remove(index: number, count: number): void {
    for (const tab of this.#tabs.splice(index, count)) {
      //A tab already moved to another group stays there
      if (tab.parentElement !== this.bar) continue;
      tab.remove();
      tab.set_selected(false);
      if (tab.content.parentElement === this.body) tab.content.remove();
    }
  }

  /**Shows the content of the active tab, the first tab when the active content is not a tab here*/
  #show_active(): void {
    const active = this.node.active.ok();
    const shown = this.#tabs.find((t) => t.content === active) ?? this.#tabs[0];
    for (const tab of this.#tabs) tab.set_selected(tab === shown);
    if (!shown) this.body.replaceChildren();
    else if (this.body.firstChild !== shown.content)
      this.body.replaceChildren(shown.content);
  }

  update_min(): void {
    const tabs = this.#tabs;
    this.publish_min(
      tabs.reduce((m, t) => Math.max(m, t.min_width), MIN_WIDTH),
      tabs.reduce((m, t) => Math.max(m, t.min_height), MIN_HEIGHT) +
        TITLEBAR_HEIGHT_TOUCH,
    );
  }
}
define_element(TabsElement);

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

/**The tab of every content shown by a layout, a content is in one place at a time, so its tab is moved with it*/
const TABS = new WeakMap<ContentBase, LayoutTab>();
function tab_of(content: ContentBase): LayoutTab {
  let tab = TABS.get(content);
  if (!tab) {
    tab = LayoutTab.create({}, content);
    TABS.set(content, tab);
  }
  return tab;
}

/**Closes content shown by a layout, it is taken out of its group*/
const LAYOUT_HOST: ContentHost = {
  [HOST_CLOSE_CONTENT](content: ContentBase): void {
    const group = TABS.get(content)?.group_element();
    const layout = group?.layout();
    if (group && layout) {
      if (!group.node.tabs.writable) return;
      take_out(layout, group.node, content);
    }
    TABS.delete(content);
    content[CONTENT_HOST] = undefined;
    content.remove();
    content[CONTENT_CLOSED]();
  },
};

/**Tab of one content, follows its title, icon, close button and smallest size*/
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
      this.group_element()?.update_min();
    });
    this.set_input(TAB_CONTENT.min_height, content.content_min_height, (h) => {
      this.min_height = h.ok ? h.value : 0;
      this.group_element()?.update_min();
    });
  }

  /**Element of the group the tab is in*/
  group_element(): TabsElement | undefined {
    const group = this.parentElement?.parentElement;
    return group instanceof TabsElement ? group : undefined;
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
    const group = this.group_element();
    const layout = group?.layout();
    if (this.#closable && group?.node.tabs.writable)
      lines.push(
        ctm.line({
          text: "Close",
          icon: material_close_rounded,
          on_click: () => this.content.content_close(),
        }),
      );
    //A tab alone in a layout is not popped out, it would leave an empty layout, a panel with one tab is moved instead
    if (
      group &&
      layout?.owner?.[OWNER_CAN_POPOUT]() &&
      can_leave(layout, group.node) &&
      !(layout.root_node() === group.node && group.node.tabs.ok().length === 1)
    )
      lines.push(
        ctm.line({
          text: "Pop out",
          icon: material_open_in_new_rounded,
          on_click: () => popout(layout, group, this.content),
        }),
      );
    if (
      group &&
      layout &&
      group.node.tabs.writable &&
      group.node.tabs.ok().length > 1 &&
      can_split(layout, group.node)
    ) {
      const split = (side: LayoutSide) => () =>
        move_content(this.content, { layout, node: group.node, side });
      lines.push(
        ctm.line({
          text: "Split right",
          icon: material_vertical_split_rounded,
          on_click: split(LayoutSide.RIGHT),
        }),
        ctm.line({
          text: "Split down",
          icon: material_horizontal_split_rounded,
          on_click: split(LayoutSide.BOTTOM),
        }),
      );
    }
    return lines;
  }

  #key(e: KeyboardEvent): void {
    const group = this.group_element();
    if (!group) return;
    const tabs = group.node.tabs.ok();
    const index = tabs.indexOf(this.content);
    let next: ContentBase | undefined;
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
    write(group.node.active, next);
    TABS.get(next)?.focus();
  }

  /**Shows the tab, a middle press closes it, and moving the pointer far enough drags it*/
  #press(e: PointerEvent): void {
    const group = this.group_element();
    if (!group) return;
    if (e.button === 1) {
      e.preventDefault();
      if (this.#closable) this.content.content_close();
      return;
    }
    if (e.button !== 0) return;
    write(group.node.active, this.content);
    //A read only tabs state locks the tabs in the group
    if (!group.node.tabs.writable) return;
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
      if (drop) move_content(this.content, drop);
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
/**The layout showing the drop indicator*/
let indicated: Layout | undefined;
function show_indicator(target: DropTarget | undefined): void {
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
function find_target(
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
  if (y < bar.bottom) {
    if (alone(group) || !group.tabs.writable) return;
    const contents = group.tabs.ok();
    let index = contents.findIndex((content) => {
      const r = TABS.get(content)?.getBoundingClientRect();
      return r && x < r.left + r.width / 2;
    });
    if (index === -1) index = contents.length;
    if (source === group) {
      const at = contents.indexOf(tab.content);
      if (index === at || index === at + 1) return;
    }
    const before = contents[index];
    const after = contents.at(-1);
    const line = before
      ? TABS.get(before)?.getBoundingClientRect().left
      : after && TABS.get(after)?.getBoundingClientRect().right;
    return {
      layout,
      group,
      index,
      rect: new DOMRect((line ?? bar.left) - 1.5, bar.top, 3, bar.height),
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

//      _           __     ______  _    _ _______
//     | |        /\\ \   / / __ \| |  | |__   __|
//     | |       /  \\ \_/ / |  | | |  | |  | |
//     | |      / /\ \\   /| |  | | |  | |  | |
//     | |____ / ____ \| | | |__| | |__| |  | |
//     |______/_/    \_\_|  \____/ \____/   |_|
/**Inputs of the layout*/
const LAYOUT = {
  /**The top node, a split or a tab group, the nodes hold states of their own, see layout_tabs and layout_split
   * Not given the layout starts with an empty tab group, an initial value is where it starts and the layout keeps the changes itself,
   * a writable state is written when the root changes, a read only state keeps the root, so the layout can not be split at its top*/
  root: input_key<StateOrValROS<LayoutNode>>(),
};
export type LayoutOptions = BaseOptions & InputOptions<typeof LAYOUT>;

/**Contents in tab groups, side by side and above each other, the user drags the tabs around*/
class Layout extends Base {
  static element_name() {
    return "layout";
  }
  static element_name_space() {
    return "composition";
  }

  /**What the layout belongs to, given at creation*/
  readonly owner?: LayoutOwner;
  /**The root when it is not a state*/
  #root?: LayoutNode;
  #root_element?: NodeElement;
  #indicator = this.appendChild(document.createElement("div"));
  /**Group the user worked in last*/
  #last?: LayoutTabs;

  /**@param owner what the layout belongs to, internal to this module*/
  constructor(owner?: LayoutOwner) {
    super();
    this.owner = owner;
    this.#indicator.className = "indicator";
    this.addEventListener("focusin", (e) => {
      const group = (e.target as Element).closest("composition-layouttabs");
      if (group instanceof TabsElement && group.layout() === this)
        this.#last = group.node;
    });
  }

  [CREATE](options: LayoutOptions): void {
    super[CREATE](options);
    if (options.root === undefined) this.#show_root(layout_tabs());
  }

  set(options: LayoutOptions): this {
    super.set(options);
    this.set_input(LAYOUT.root, options.root, (root) => {
      this.#root = state.is.state(options.root) ? undefined : root.value;
      this.#show_root(root.value);
    });
    return this;
  }

  /**The top node*/
  root_node(): LayoutNode | undefined {
    return this.input_state(LAYOUT.root)?.ok() ?? this.#root;
  }

  /**Whether the root can be replaced, it is not a read only state*/
  root_writable(): boolean {
    return this.input_state(LAYOUT.root)?.writable ?? true;
  }

  /**Replaces the root, writes the state, or keeps it for an initial value*/
  write_root(node: LayoutNode): void {
    const root = this.input_state(LAYOUT.root);
    if (root) return write(root, node);
    this.#root = node;
    this.#show_root(node);
  }

  /**The split holding the node, undefined for the root*/
  parent_of(node: LayoutNode): LayoutSplit | undefined {
    const find = (split: LayoutNode): LayoutSplit | undefined => {
      if (!is_split(split)) return undefined;
      for (const child of split.children.ok())
        if (child === node) return split;
        else {
          const found = find(child);
          if (found) return found;
        }
      return undefined;
    };
    const root = this.root_node();
    return root && find(root);
  }

  /**Opens content in the layout, content already in it is shown*/
  open(content: ContentBase, options: LayoutOpenOptions = {}): void {
    const root = this.root_node();
    if (!root) return;
    const open = group_of(root, content);
    if (open) {
      write(open.active, content);
      return;
    }
    const beside = options.beside && group_of(root, options.beside);
    const last =
      this.#last && (this.#last === root || this.parent_of(this.#last))
        ? this.#last
        : undefined;
    const group = beside || last || first_group(root);
    if (!group) return;
    const side = options.side ?? LayoutSide.CENTER;
    if (side !== LayoutSide.CENTER)
      return insert_beside(this, group, side, content);
    write(group.tabs, state.a.write.push(content));
    write(group.active, content);
  }

  /**All contents in the layout*/
  contents(): ContentBase[] {
    const collect = (node: LayoutNode): ContentBase[] =>
      is_split(node)
        ? node.children.ok().flatMap(collect)
        : [...node.tabs.ok()];
    const root = this.root_node();
    return root ? collect(root) : [];
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

  #show_root(node: LayoutNode): void {
    const element = element_of(node);
    if (this.#root_element === element) return;
    if (this.#root_element?.parentElement === this) this.#root_element.remove();
    this.#root_element = element;
    this.insertBefore(element, this.#indicator);
  }
}
define_element(Layout);

export { Layout };

/**Creates a layout of tab groups, side by side and above each other, the user drags the tabs around
 * The structure is the root input, nodes made with layout_split and layout_tabs, each holding states the layout writes*/
export function layout(options: LayoutOptions = {}): Layout {
  return Layout.create(options);
}
