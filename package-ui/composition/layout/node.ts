import {
  Base,
  CREATE,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import type { SVGFunc } from "#svg";
import type { StateOrValRES, StateRES } from "@chocbite/ts-lib/state";
import { as_any_state, type Collected, own, value_or } from "./common";
import type { Layout } from "./layout";

//      _   _  ____  _____  ______  _____
//     | \ | |/ __ \|  __ \|  ____|/ ____|
//     |  \| | |  | | |  | | |__  | (___
//     | . ` | |  | | |  | |  __|  \___ \
//     | |\  | |__| | |__| | |____ ____) |
//     |_| \_|\____/|_____/|______|_____/
/**Inputs of every node of a layout*/
const NODE = {
  /**Share of the space of the split it is in, 1 when not given, the user changes it with the sizers*/
  size: input_key<StateOrValRES<number>>(),
};
export type LayoutNodeOptions = BaseOptions & InputOptions<typeof NODE>;

/**A split or a tab group, its share of the space follows its size
 * Whether it can be closed and its smallest size are collected from what it holds, its title and icon follow one of them,
 * the layout shows them for its root*/
export abstract class NodeElement extends Base {
  static element_name() {
    return "@abstract@";
  }
  static element_name_space() {
    return "composition";
  }

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

  /**The min states are made by the subclass constructors, so they are attached after them*/
  [CREATE](options: LayoutNodeOptions): void {
    super[CREATE](options);
    this.attach_state(this.min_width, (w) => {
      this.shown_min_width = value_or(w, 0);
      this.style.minWidth = this.shown_min_width + "rem";
    });
    this.attach_state(this.min_height, (h) => {
      this.shown_min_height = value_or(h, 0);
      this.style.minHeight = this.shown_min_height + "rem";
    });
    if (options.size === undefined) this.set({ size: 1 });
  }

  set(options: LayoutNodeOptions): this {
    super.set(options);
    this.set_input(NODE.size, own(options.size), (size) => {
      this.style.flexGrow = String(value_or(size, 1));
    });
    return this;
  }

  /**The size state, internal to this module*/
  size_state(): StateRES<number> {
    return this.input_state(NODE.size)!;
  }
  /**Share of the space, internal to this module*/
  size(): number {
    return value_or(this.size_state().get(), 1);
  }

  /**The layout the node is shown in*/
  layout(): Layout | null {
    return this.closest<Layout>("composition-layout");
  }
}
