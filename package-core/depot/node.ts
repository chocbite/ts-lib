import type { StateOrValROS } from "#state";
import type { DepotEntry } from "./entry";
import type { DepotGroup, Group } from "./group";
import { DETACH, DETACH_ROOT, MARK_REMOVED, PROVIDED } from "./hooks";
import { check_id } from "./ids";
import type { DepotType } from "./type";

declare global {
  /**Extended by @chocbite/ts-lib-ui to type depot icons as SVGFunc.
   * Without ts-lib-ui no icon can be given.*/
  interface ChocbiteDepotRegister {}
}

/**Icon of a node, an SVGFunc with ts-lib-ui, never without*/
export type DepotIcon = ChocbiteDepotRegister extends { icon: infer I }
  ? I
  : never;

/**A child of a group, either a group or an entry*/
export type DepotChild<T> = DepotGroup<T> | DepotEntry<T>;

/**Any node a lookup can give*/
export type DepotNode<T = unknown> = DepotType<T> | DepotChild<T>;

/**What every type, group, entry and alias has: an id, a name and description for showing to users, a parent and a path*/
export abstract class Node {
  /**Id of the node, unique in its group, the last segment of its path*/
  readonly id: string;
  /**Name for showing to users, a constant or a state, elements take either*/
  readonly name: StateOrValROS<string>;
  /**Description for showing to users, a constant or a state, elements take either*/
  readonly description: StateOrValROS<string>;
  /**Icon for showing to users*/
  readonly icon?: DepotIcon;
  #parent: Group<any> | undefined;
  #removed = false;

  constructor(
    parent: Group<any> | undefined,
    id: string,
    name: StateOrValROS<string>,
    description: StateOrValROS<string>,
    icon?: DepotIcon,
  ) {
    check_id(id);
    this.#parent = parent;
    this.id = id;
    this.name = name;
    this.description = description;
    if (icon !== undefined) this.icon = icon;
  }

  abstract get kind(): "type" | "group" | "entry" | "alias";

  /**The group the node is in, undefined for a type*/
  get parent(): DepotGroup<unknown> | undefined {
    return this.#parent;
  }

  /**Full path of the node, like "/widgets/basic/rectangle", built by walking up the parents*/
  get path(): string {
    let path = "/" + this.id;
    for (let p = this.#parent; p; p = p.#parent) path = "/" + p.id + path;
    return path;
  }

  /**The type the node is in, the node itself for a type*/
  get type(): DepotType<unknown> {
    let parent = this.#parent;
    //Only types have no parent
    if (!parent) return this as unknown as DepotType<unknown>;
    while (parent.#parent) parent = parent.#parent;
    return parent as unknown as DepotType<unknown>;
  }

  /**True once the node or a group above it has been removed*/
  get removed(): boolean {
    return this.#removed;
  }

  /**Removes the node from its group, a group also removes everything below it*/
  remove(): void {
    if (this.#parent?.[PROVIDED])
      throw new Error(
        `Depot path "${this.path}" is provided by a source, the source removes it`,
      );
    if (this.#removed) return;
    //Marked first, so lookups made when the parent tells of the change see everything below as removed
    this[MARK_REMOVED]();
    if (this.#parent) this.#parent[DETACH](this);
    else this[DETACH_ROOT]();
  }

  /**Marks the node removed without detaching it from its parent*/
  [MARK_REMOVED](): void {
    this.#removed = true;
  }

  /**Detaches a node without a parent, only types have none and detach from the registry of types*/
  [DETACH_ROOT](): void {}
}
