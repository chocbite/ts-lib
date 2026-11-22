import { Base, type BaseOptions, CREATE } from "#base";
import type { SVGFunc } from "#svg";
import type { LayoutNode } from "./tree";
import { as_any_state, type Collected, value_or } from "./common";
import type { Layout } from "./layout";

//      _   _  ____  _____  ______  _____
//     | \ | |/ __ \|  __ \|  ____|/ ____|
//     |  \| | |  | | |  | | |__  | (___
//     | . ` | |  | | |  | |  __|  \___ \
//     | |\  | |__| | |__| | |____ ____) |
//     |_| \_|\____/|_____/|______|_____/

/**Element of a split or a tab group, its share of the space follows the size state of the node
 * Whether it can be closed and its smallest size are collected from what it holds, its title and icon follow one of them,
 * the layout shows them for its root*/
export abstract class NodeElement extends Base {
  static element_name() {
    return "@abstract@";
  }
  static element_name_space() {
    return "composition";
  }

  readonly node: LayoutNode;
  /**Whether the user can close everything inside*/
  abstract readonly closable: Collected<boolean>;
  /**Smallest size in rem, from what is inside*/
  abstract readonly min_width: Collected<number>;
  abstract readonly min_height: Collected<number>;
  /**Title and icon of the content shown*/
  readonly shown_title = as_any_state<string>("").proxy_map((t) => t);
  readonly shown_icon = as_any_state<SVGFunc | undefined>(undefined).proxy_map(
    (i) => i,
  );
  /**Smallest size in rem applied to the element, from the min states, for the sizers*/
  shown_min_width = 0;
  shown_min_height = 0;

  constructor(node: LayoutNode) {
    super();
    this.node = node;
    this.attach_state(node.size, (size) => {
      this.style.flexGrow = String(size.value);
    });
  }

  /**The min states are made by the subclass constructors, so they are attached after them*/
  [CREATE](options: BaseOptions): void {
    super[CREATE](options);
    this.attach_state(this.min_width, (w) => {
      this.shown_min_width = value_or(w, 0);
      this.style.minWidth = this.shown_min_width + "rem";
    });
    this.attach_state(this.min_height, (h) => {
      this.shown_min_height = value_or(h, 0);
      this.style.minHeight = this.shown_min_height + "rem";
    });
  }

  layout(): Layout | null {
    return this.closest<Layout>("composition-layout");
  }
}
