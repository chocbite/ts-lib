import { CREATE, define_element, input_key, type InputOptions } from "#base";
import { ok } from "@chocbite/ts-lib/result";
import ctm from "#context_menu";
import type { SVGFunc } from "#svg";
import type { StateOrValRES, StateRES } from "@chocbite/ts-lib/state";
import { ContentBase, type ContentOptions } from "../content";
import {
  type LayoutNode,
  type LayoutOpenOptions,
  type LayoutOwner,
  LayoutSide,
  OWNER_CAN_EMPTY,
} from "./tree";
import { as_any_state, own, value_or, writable, write_if } from "./common";
import { first_group, group_of, open_in } from "./actions";
import type { NodeElement } from "./node";
import { is_split, type LayoutSplit } from "./split";
import { is_tabs, layout_tabs, type LayoutTabs } from "./tabs";
import { accept_drops } from "./drag";
import "./layout.scss";

//      _           __     ______  _    _ _______
//     | |        /\\ \   / / __ \| |  | |__   __|
//     | |       /  \\ \_/ / |  | | |  | |  | |
//     | |      / /\ \\   /| |  | | |  | |  | |
//     | |____ / ____ \| | | |__| | |__| |  | |
//     |______/_/    \_\_|  \____/ \____/   |_|
/**Inputs of the layout*/
const LAYOUT = {
  /**The top node, a split or a tab group, see layout_split and layout_tabs, the nodes have inputs of their own
   * Not given the layout starts with an empty tab group, an initial value is where it starts and the layout keeps the changes itself,
   * a state that writes synchronously is written when the root changes, any other state keeps the root,
   * so the layout can not be split at its top*/
  root: input_key<StateOrValRES<LayoutNode>>(),
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
      if (is_tabs(group) && group.layout() === this) this.#last = group;
    });
    accept_drops(this);
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
    if (options.root === undefined) this.set({ root: layout_tabs() });
  }

  /**Closes every content in it that agrees, asked one after another, without an owner it then closes like any content, like the panel it is shown in,
   * unless contents are left, that refused or can not leave their group*/
  protected async content_closing(): Promise<boolean> {
    //One after another, so the user gets one question at a time
    for (const content of this.contents()) await content.content_close();
    return !this.owner && this.contents().length === 0;
  }

  set(options: LayoutOptions): this {
    super.set(options);
    this.set_input(LAYOUT.root, own(options.root), (root) => {
      if (root.ok) this.#show_root(root.value);
    });
    return this;
  }

  /**The root state, internal to this module*/
  root_state(): StateRES<LayoutNode> {
    return this.input_state(LAYOUT.root)!;
  }

  /**The top node*/
  root_node(): LayoutNode | undefined {
    return value_or(this.root_state().get(), undefined);
  }

  /**Whether the root can be replaced, the layout can write its state*/
  root_writable(): boolean {
    return writable(this.root_state());
  }

  /**The split holding the node, undefined for the root*/
  parent_of(node: LayoutNode): LayoutSplit | undefined {
    const find = (split: LayoutNode): LayoutSplit | undefined => {
      if (!is_split(split)) return undefined;
      for (const child of split.nodes())
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

  /**Opens content in the layout, content already in it is shown, gives whether it was opened*/
  open(content: ContentBase, options: LayoutOpenOptions = {}): boolean {
    const root = this.root_node();
    if (!root) return false;
    const open = group_of(root, content);
    if (open) {
      write_if(open.active_state(), content);
      return true;
    }
    const beside = options.beside && group_of(root, options.beside);
    const last =
      this.#last && (this.#last === root || this.parent_of(this.#last))
        ? this.#last
        : undefined;
    const group = beside || last || first_group(root);
    if (!group) return false;
    return open_in(this, group, options.side ?? LayoutSide.CENTER, content);
  }

  /**All contents in the layout*/
  contents(): ContentBase[] {
    const collect = (node: LayoutNode): ContentBase[] =>
      is_split(node) ? node.nodes().flatMap(collect) : [...node.contents()];
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
    const element = node;
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
 * The structure is the root input, nodes made with layout_split and layout_tabs, whose inputs the layout writes*/
export function layout(options: LayoutOptions = {}): Layout {
  return Layout.create(options);
}
