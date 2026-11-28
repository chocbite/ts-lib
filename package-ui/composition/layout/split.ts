import { CREATE, define_element, input_key, type InputOptions } from "#base";
import type { Result } from "@chocbite/ts-lib/result";
import { rem_to_px } from "#theme";
import state, {
  type StateArrayRead,
  type StateOrValRES,
  type StateRES,
} from "@chocbite/ts-lib/state";
import { clamp } from "../shared";
import type { LayoutDirection, LayoutNode } from "./tree";
import {
  as_any_state,
  Change,
  collect,
  own,
  SIZER_REACH,
  SIZER_TOUCH,
  value_or,
  writable,
} from "./common";
import { type LayoutNodeOptions, NodeElement } from "./node";
import "./split.scss";

//       _____ _____  _      _____ _______
//      / ____|  __ \| |    |_   _|__   __|
//     | (___ | |__) | |      | |    | |
//      \___ \|  ___/| |      | |    | |
//      ____) | |    | |____ _| |_   | |
//     |_____/|_|    |______|_____|  |_|
/**Inputs of a split*/
const SPLIT = {
  /**Splits and tab groups in the split, in order, the user adds and removes them by dragging tabs,
   * a state that does not write synchronously is read only to the layout, the user then can not add or remove children*/
  children: input_key<StateOrValRES<LayoutNode[]>>(),
};
/**Inputs of a split given at creation*/
const SPLIT_CREATE = {
  /**Direction of the children, row when not given, never changes*/
  direction: input_key<LayoutDirection>(),
};
export type LayoutSplitOptions = LayoutNodeOptions & InputOptions<typeof SPLIT>;
export type LayoutSplitCreateOptions = LayoutSplitOptions &
  InputOptions<typeof SPLIT_CREATE>;

/**Children side by side or above each other, with a sizer between each two*/
class LayoutSplit extends NodeElement {
  static element_name() {
    return "layoutsplit";
  }

  #direction: LayoutDirection = "row";
  /**Elements of the children, in order, the DOM has a sizer between each two*/
  #children: NodeElement[] = [];
  /**Child holding the group the user worked in last, its title is shown*/
  #focused?: NodeElement;

  /**Closable when every child is*/
  readonly closable = collect(
    (children) =>
      children.length > 0 && children.every((c) => value_or(c, false)),
  );
  /**Along the direction the children and the sizers between them add up, across the biggest child*/
  readonly min_width = collect((children) =>
    this.#min(children, this.#direction === "row"),
  );
  readonly min_height = collect((children) =>
    this.#min(children, this.#direction === "column"),
  );

  constructor() {
    super();
    this.addEventListener("focusin", (e) => {
      const child = this.#children.find((c) => c.contains(e.target as Node));
      if (child && child !== this.#focused) {
        this.#focused = child;
        this.#follow();
      }
    });
  }

  [CREATE](options: LayoutSplitCreateOptions): void {
    super[CREATE](options);
    if (options.direction) this.#direction = options.direction;
    this.classList.add(this.#direction);
    if (options.children === undefined) this.set({ children: [] });
  }

  set(options: LayoutSplitOptions): this {
    super.set(options);
    this.set_input(SPLIT.children, own(options.children), (children) =>
      this.#apply(children.ok ? children.value : []),
    );
    return this;
  }

  /**Direction of the children, given at creation, internal to this module*/
  direction(): LayoutDirection {
    return this.#direction;
  }
  /**The children state, internal to this module*/
  children_state(): StateRES<LayoutNode[]> {
    return this.input_state(SPLIT.children)!;
  }
  /**The children as the state gives them, internal to this module*/
  nodes(): readonly LayoutNode[] {
    return value_or(this.children_state().get(), []);
  }

  /**Saved as its direction and the states of its inputs, see to_json and the viewer of the state module*/
  [state.v.OVERRIDE_KEY]() {
    return {
      direction: this.#direction,
      size: this.size_state(),
      children: this.children_state(),
    };
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
    this.closable.set_states(...children.map((c) => c.closable));
    this.min_width.set_states(...children.map((c) => c.min_width));
    this.min_height.set_states(...children.map((c) => c.min_height));
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
          this.#insert(change.to_index, moved);
        }
      }
    }
    this.#follow();
  }

  #insert(index: number, nodes: readonly NodeElement[]): void {
    const ref = this.#children[index] ?? null;
    for (const node of nodes) this.insertBefore(node, ref);
    this.#children.splice(index, 0, ...nodes);
    this.#fix_sizers();
  }

  #remove(index: number, count: number): void {
    for (const node of this.#children.splice(index, count))
      //A node already moved elsewhere by the same change stays there
      if (node.parentElement === this) node.remove();
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
    const a = node_of(sizer.previousElementSibling);
    const b = node_of(sizer.nextElementSibling);
    if (!a || !b) return;
    if (!writable(a.size_state()) || !writable(b.size_state())) return;
    const row = this.#direction === "row";
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
    const grow = a.size() + b.size();
    let grow_a = a.size();
    return {
      row,
      move: (moved) => {
        if (min_a > total - min_b) return;
        const size = clamp(la + moved, min_a, total - min_b);
        grow_a = (grow * size) / total;
        a.style.flexGrow = String(grow_a);
        b.style.flexGrow = String(grow - grow_a);
      },
      end: (change) => {
        change.write(a.size_state(), grow_a);
        change.write(b.size_state(), grow - grow_a);
      },
    };
  }
}
define_element(LayoutSplit);

export type { LayoutSplit };

/**Creates a split, its children side by side or above each other, the direction never changes*/
export function layout_split(
  options: LayoutSplitCreateOptions = {},
): LayoutSplit {
  return LayoutSplit.create(options);
}

/**Whether the node is a split*/
export const is_split = (node: LayoutNode): node is LayoutSplit =>
  node instanceof LayoutSplit;

/**The element when it is a node of a layout*/
const node_of = (element: Element | null): NodeElement | undefined =>
  element instanceof NodeElement ? element : undefined;

/**One sizer being moved, moved is in px from where the pointer was pressed, along the direction of its split*/
interface SizerDrag {
  readonly row: boolean;
  move(moved: number): void;
  /**Writes the sizes where it ended*/
  end(change: Change): void;
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
    const drag = split instanceof LayoutSplit ? split.sizer_drag(s) : undefined;
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
    //The sizers moved together are one change, the sizes all change or none do
    const change = new Change();
    for (const drag of drags) drag.end(change);
  };
}
