import state_ui from "#state_ui";
import type { Option, ResultNice } from "@chocbite/ts-lib/result";
import type { StateOrValREA } from "@chocbite/ts-lib/state";
import { Base, type BaseOptions } from "./base";
import { define_element } from "./define_element";
import { CREATE, input_key } from "./input";

/**Inputs of the loop, loosely typed as the loop is generic in its values*/
const LOOP = {
  array: input_key<StateOrValREA<readonly any[], Option<{}>, any>>(),
};

/**Options of a loop with values T*/
export interface LoopOptions<T> extends BaseOptions {
  /**Values with a child node each, an array state reuses the nodes of the values its changes keep
   * An error keeps the nodes of the last values, the fault icon explains it*/
  array?: StateOrValREA<readonly T[], Option<{}>, unknown>;
}

/**Options of a loop given at creation, they never change*/
export interface LoopCreateOptions<
  T,
  N extends ChildNode,
> extends LoopOptions<T> {
  /**Updates a node to a new value, when given nodes are reused instead of replaced*/
  change?: (element: N, new_value: T) => void;
  /**Called for every node that is removed or replaced*/
  destructor?: (element: N) => void;
}

/**Element with one child node per value of an array, follows the changes of array states*/
class Loop<T = unknown, N extends ChildNode = ChildNode> extends Base {
  static element_name(): string {
    return "loop";
  }
  static element_name_space(): string {
    return "base";
  }

  #generator: (val: T) => N = () => {
    throw new Error("Loop created without a generator, use base_loop");
  };
  #destructor?: (element: N) => void;
  #change?: (element: N, new_value: T) => void;

  [CREATE](
    options: LoopCreateOptions<T, N> & { generator?: (val: T) => N },
  ): void {
    super[CREATE](options);
    if (options.generator) this.#generator = options.generator;
    this.#destructor = options.destructor;
    this.#change = options.change;
  }

  set(options: LoopOptions<T>): this {
    super.set(options);
    this.set_input(LOOP.array, options.array, (result) => {
      //The key is loosely typed, the values can be an error
      const array = result as ResultNice<readonly T[]>;
      if (array.err) return;
      state_ui.a.apply(this, array.value, {
        create: this.#generator,
        update: this.#change,
        destroy: this.#destructor,
      });
    });
    return this;
  }
}
define_element(Loop);

export type { Loop };

/**Creates an element with one child node per value, made by the generator
 * Give the values as array, an array state reuses the nodes of the values its changes keep*/
export function base_loop<T, N extends ChildNode>(
  generator: (val: T) => N,
  options: LoopCreateOptions<T, N> = {},
): Loop<T, N> {
  //create can not carry the value type of a generic class, the options are checked by this function
  return Loop.create({ ...options, generator } as never) as unknown as Loop<
    T,
    N
  >;
}
