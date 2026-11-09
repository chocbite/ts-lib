import state_ui from "#state";
import { Base } from "./base";
import { define_element } from "./define_element";

interface LoopOptions<T, N extends ChildNode> {
  /**Updates a node to a new value, when given nodes are reused instead of replaced*/
  change?: (element: N, new_value: T) => void;
  /**Called for every node that is removed or replaced*/
  destructor?: (element: N) => void;
}

/**Element with one child node per value of an array, follows the changes of array states*/
export class Loop<T, N extends ChildNode> extends Base {
  static element_name(): string {
    return "loop";
  }
  static element_name_space(): string {
    return "base";
  }

  #generator: (val: T) => N;
  #destructor?: (element: N) => void;
  #change?: (element: N, new_value: T) => void;

  constructor(generator: (val: T) => N, options?: LoopOptions<T, N>) {
    super();
    this.#generator = generator;
    this.#destructor = options?.destructor;
    this.#change = options?.change;
  }

  set array(array: readonly T[]) {
    state_ui.a.apply(this, array, {
      create: this.#generator,
      update: this.#change,
      destroy: this.#destructor,
    });
  }

  set error(err: Node) {
    this.replaceChildren(err);
  }
}
define_element(Loop);

export function base_loop<T, N extends ChildNode>(
  generator: (val: T) => N,
  options?: LoopOptions<T, N>,
) {
  return new Loop<T, N>(generator, options);
}
