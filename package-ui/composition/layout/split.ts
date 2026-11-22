import { define_element } from "#base";
import type { Result } from "@chocbite/ts-lib/result";
import { rem_to_px } from "#theme";
import state, { type StateArrayRead } from "@chocbite/ts-lib/state";
import { clamp, write } from "../shared";
import type { LayoutNode, LayoutSplit } from "./tree";
import {
  as_any_state,
  collect,
  type Collected,
  SIZER_REACH,
  SIZER_TOUCH,
  value_or,
} from "./common";
import { NodeElement } from "./node";
import { element_of } from "./layout";
import "./split.scss";

//       _____ _____  _      _____ _______
//      / ____|  __ \| |    |_   _|__   __|
//     | (___ | |__) | |      | |    | |
//      \___ \|  ___/| |      | |    | |
//      ____) | |    | |____ _| |_   | |
//     |_____/|_|    |______|_____|  |_|
/**Children side by side or above each other, with a sizer between each two*/
export class SplitElement extends NodeElement {
  static element_name() {
    return "layoutsplit";
  }

  declare readonly node: LayoutSplit;
  /**Elements of the children, in order, the DOM has a sizer between each two*/
  #children: NodeElement[] = [];
  /**Child holding the group the user worked in last, its title is shown*/
  #focused?: NodeElement;

  /**Closable when every child is*/
  readonly closable: Collected<boolean>;
  /**Along the direction the children and the sizers between them add up, across the biggest child*/
  readonly min_width: Collected<number>;
  readonly min_height: Collected<number>;

  constructor(node: LayoutSplit) {
    super(node);
    this.closable = collect(
      ([, ...children]) =>
        children.length > 0 && children.every((c) => value_or(c, false)),
      node.children,
    );
    this.min_width = collect(
      ([, ...children]) => this.#min(children, node.direction === "row"),
      node.children,
    );
    this.min_height = collect(
      ([, ...children]) => this.#min(children, node.direction === "column"),
      node.children,
    );
    this.classList.add(node.direction);
    this.attach_state(node.children, (children) => this.#apply(children.value));
    this.addEventListener("focusin", (e) => {
      const child = this.#children.find((c) => c.contains(e.target as Node));
      if (child && child !== this.#focused) {
        this.#focused = child;
        this.#follow();
      }
    });
  }

  #min(children: Result<any, unknown>[], along: boolean): number {
    const mins = children.map((c) => value_or<number>(c, 0));
    if (along)
      return (
        mins.reduce((sum, m) => sum + m, 0) +
        Math.max(0, mins.length - 1) * SIZER_TOUCH
      );
    return Math.max(0, ...mins);
  }

  /**Collects from the children again, and shows the title of the focused child, or of the first*/
  #follow(): void {
    const children = this.#children;
    const items = this.node.children;
    this.closable.set_states(items, ...children.map((c) => c.closable));
    this.min_width.set_states(items, ...children.map((c) => c.min_width));
    this.min_height.set_states(items, ...children.map((c) => c.min_height));
    if (this.#focused && !children.includes(this.#focused))
      this.#focused = undefined;
    const shown = this.#focused ?? children[0];
    this.shown_title.set_state(shown?.shown_title ?? as_any_state(""));
    this.shown_icon.set_state(shown?.shown_icon ?? as_any_state(undefined));
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
    this.#follow();
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
    const min = (n: NodeElement) =>
      rem_to_px(row ? n.shown_min_width : n.shown_min_height);
    const min_a = min(a);
    const min_b = min(b);
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

/**A sizer with where it is on the page*/
type PlacedSizer = [HTMLElement, DOMRect];

/**The other sizers of the same layout as the sizer, with where they are*/
function other_sizers(sizer: HTMLElement): PlacedSizer[] {
  const layout = sizer.closest("composition-layout");
  if (!layout) return [];
  const others: PlacedSizer[] = [];
  for (const other of layout.querySelectorAll<HTMLElement>(".sizer"))
    if (other !== sizer && other.closest("composition-layout") === layout)
      others.push([other, other.getBoundingClientRect()]);
  return others;
}

/**The sizer and every other sizer within reach of the point, so sizers meeting at a
 * crossing, or lining up across a sizer, are moved together*/
function sizers_at(
  sizer: HTMLElement,
  others: PlacedSizer[],
  x: number,
  y: number,
): HTMLElement[] {
  const reach = rem_to_px(SIZER_REACH);
  const found = [sizer];
  for (const [other, r] of others)
    if (
      x >= r.left - reach &&
      x <= r.right + reach &&
      y >= r.top - reach &&
      y <= r.bottom + reach
    )
      found.push(other);
  return found;
}

/**Sizers marked as moving together with the hovered sizer*/
let joined: HTMLElement[] = [];
/**The hovered sizer and the other sizers of its layout, measured once when hovering starts, as they do not move while hovered*/
let hovered: { sizer: HTMLElement; others: PlacedSizer[] } | undefined;

/**Marks the sizers a press would move with the hovered one, a crossing gets the move cursor,
 * without an event the pointer left or pressed*/
function sizer_hover(sizer: HTMLElement, e?: PointerEvent): void {
  if (sizer.classList.contains("active")) return;
  for (const other of joined) other.classList.remove("joined");
  if (e) {
    if (hovered?.sizer !== sizer)
      hovered = { sizer, others: other_sizers(sizer) };
    joined = sizers_at(sizer, hovered.others, e.clientX, e.clientY).slice(1);
  } else {
    hovered = undefined;
    joined = [];
  }
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
  const sizers = sizers_at(sizer, other_sizers(sizer), e.clientX, e.clientY);
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
