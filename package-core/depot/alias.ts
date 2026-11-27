import type { Group } from "./group";
import { Node, type DepotChild } from "./node";

/**A second path to a group or entry of the same type, for resources that moved, not listed among the children*/
class Alias<T> extends Node {
  /**The group or entry the alias points at*/
  readonly target: DepotChild<T>;

  constructor(parent: Group<T>, id: string, target: DepotChild<T>) {
    super(parent, id, target.name, target.description, target.icon);
    this.target = target;
  }

  get kind(): "alias" {
    return "alias";
  }
}

export { Alias };
export type DepotAlias<T> = Alias<T>;
