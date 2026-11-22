import { CREATE, define_element, input_key, type InputOptions } from "#base";
import { ok } from "@chocbite/ts-lib/result";
import ctm from "#context_menu";
import type { SVGFunc } from "#svg";
import state, { type StateOrValROS } from "@chocbite/ts-lib/state";
import { ContentBase, type ContentOptions } from "../content";
import { write } from "../shared";
import {
  is_split,
  layout_tabs,
  type LayoutNode,
  type LayoutOpenOptions,
  type LayoutOwner,
  LayoutSide,
  type LayoutSplit,
  type LayoutTabs,
  OWNER_CAN_EMPTY,
} from "./tree";
import { as_any_state, value_or } from "./common";
import { first_group, group_of, insert_beside } from "./actions";
import type { NodeElement } from "./node";
import { SplitElement } from "./split";
import { TabsElement } from "./tabs";
import "./layout.scss";

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
export type LayoutOptions = ContentOptions & InputOptions<typeof LAYOUT>;

/**Contents in tab groups, side by side and above each other, the user drags the tabs around
 * A content itself, so it can be shown in a panel, its title, icon, whether it can be closed and its smallest size
 * follow the root, it can be closed when every content in it can, and its owner lets it be emptied*/
class Layout extends ContentBase {
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
  readonly #title = as_any_state<string>("").proxy_map((t) => t);
  readonly #icon = as_any_state<SVGFunc | undefined>(undefined).proxy_map(
    (i) => i,
  );
  readonly #closable = as_any_state(false).proxy_ok((closable) =>
    ok(
      value_or(closable, false) &&
        (this.owner?.[OWNER_CAN_EMPTY](this) ?? true),
    ),
  );
  readonly #min_width = as_any_state(0).proxy_map((w) => w);
  readonly #min_height = as_any_state(0).proxy_map((h) => h);

  /**@param owner what the layout belongs to, internal to this module*/
  constructor(owner?: LayoutOwner) {
    super();
    this.owner = owner;
    //The contents in it have menus of their own, the layout menu shows where it is shown, like on a panel title bar
    ctm.detach(this);
    this.#indicator.className = "indicator";
    this.addEventListener("focusin", (e) => {
      const group = (e.target as Element).closest("composition-layouttabs");
      if (group instanceof TabsElement && group.layout() === this)
        this.#last = group.node;
    });
  }

  [CREATE](options: LayoutOptions): void {
    super[CREATE]({
      ...options,
      title: this.#title,
      icon: this.#icon,
      closable: this.#closable,
      min_width: this.#min_width,
      min_height: this.#min_height,
    });
    if (options.root === undefined) this.#show_root(layout_tabs());
  }

  /**Closes every content in it, without an owner it then closes like any content, like the panel it is shown in,
   * unless contents are left that can not leave their group*/
  content_close(): void {
    for (const content of this.contents()) content.content_close();
    if (!this.owner && this.contents().length === 0) super.content_close();
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
    //Placed in the scrolled area of the layout, so the scroll position is added
    const own = this.getBoundingClientRect();
    Object.assign(this.#indicator.style, {
      left: rect.left - own.left + this.scrollLeft + "px",
      top: rect.top - own.top + this.scrollTop + "px",
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
    this.#title.set_state(element.shown_title);
    this.#icon.set_state(element.shown_icon);
    this.#closable.set_state(element.closable);
    this.#min_width.set_state(element.min_width);
    this.#min_height.set_state(element.min_height);
  }
}
define_element(Layout);

export { Layout };

/**Creates a layout of tab groups, side by side and above each other, the user drags the tabs around
 * The structure is the root input, nodes made with layout_split and layout_tabs, each holding states the layout writes*/
export function layout(options: LayoutOptions = {}): Layout {
  return Layout.create(options);
}

/**The element showing each node, a node is shown in one place at a time, so its element is moved with it*/
const ELEMENTS = new WeakMap<LayoutNode, NodeElement>();
export function element_of(node: LayoutNode): NodeElement {
  let element = ELEMENTS.get(node);
  if (!element) {
    element = is_split(node)
      ? SplitElement.create({}, node)
      : TabsElement.create({}, node);
    ELEMENTS.set(node, element);
  }
  return element;
}
