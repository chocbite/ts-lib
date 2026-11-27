import type { StateOrVal, StateOrValROS } from "#state";
import type { Group } from "./group";
import { Node, type DepotIcon } from "./node";

/**A leaf of the tree, holding a resource*/
class Entry<T> extends Node {
  /**The content as given, a constant or a state, use state.as_state where a state is needed*/
  readonly value: StateOrVal<T>;

  constructor(
    parent: Group<T>,
    id: string,
    name: StateOrValROS<string>,
    description: StateOrValROS<string>,
    content: StateOrVal<T>,
    icon?: DepotIcon,
  ) {
    super(parent, id, name, description, icon);
    this.value = content;
  }

  get kind(): "entry" {
    return "entry";
  }
}

//Classes are only exported as types, nodes are made through depot.type, group, add and alias
export { Entry };
export type DepotEntry<T> = Entry<T>;
