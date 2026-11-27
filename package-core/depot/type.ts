import { ok } from "#result";
import state, {
  type StateLocalROS,
  type StateOrValROS,
  type StateRES,
  type StateROS,
} from "#state";
import { type_removed } from "./errors";
import { Group } from "./group";
import { DETACH_ROOT, LOOKUP, MARK_REMOVED } from "./hooks";
import { Lookups, Slots, walk } from "./lookup";
import type { DepotIcon, DepotNode } from "./node";

//Types detach from the registry of types and the registry makes types, so they share a file, split they would import each other

//      _________     _______  ______
//     |__   __\ \   / /  __ \|  ____|
//        | |   \ \_/ /| |__) | |__
//        | |    \   / |  ___/|  __|
//        | |     | |  | |    | |____
//        |_|     |_|  |_|    |______|

/**The root segment of a path, fixes the content type of every entry below it*/
class Type<T> extends Group<T> {
  #lookups = new Lookups((lookup) =>
    this.removed
      ? type_removed(this.id)
      : walk(lookup, this, 0, this.path + "/" + lookup.ids.join("/")),
  );

  get kind(): "type" {
    return "type";
  }

  /**State of the node at a path inside this type, like "/basic/rectangle".
   * Aliases are resolved, the state is an error while nothing is registered at the path,
   * and stays an error once this type is removed. The same path gives the same state*/
  get(path: string): StateRES<DepotNode<T>> {
    return this.#lookups.get(path) as StateRES<DepotNode<T>>;
  }

  remove(): void {
    if ((this as unknown) === STATES)
      throw new Error(
        "The states type is part of the depot and can not be removed",
      );
    super.remove();
  }

  [DETACH_ROOT](): void {
    TYPES.detach(this as Type<unknown>);
  }

  [MARK_REMOVED](): void {
    super[MARK_REMOVED]();
    this.#lookups.refresh();
  }
}

export type DepotType<T> = Type<T>;

//      _______     _______  ______  _____
//     |__   __\ \   / /  __ \|  ____|/ ____|
//        | |   \ \_/ /| |__) | |__  | (___
//        | |    \   / |  ___/|  __|  \___ \
//        | |     | |  | |    | |____ ____) |
//        |_|     |_|  |_|    |______|_____/

/**The registered types by id*/
class Types {
  #ids = new Map<string, Type<any>>();
  /**Lookups that looked up a type id*/
  readonly slots = new Slots();
  #list: StateLocalROS<Type<any>[]> = state.ros(ok<Type<any>[]>([]));

  get list(): StateROS<readonly DepotType<unknown>[]> {
    return this.#list.read_only;
  }

  add<T>(
    id: string,
    name: StateOrValROS<string>,
    description: StateOrValROS<string>,
    icon?: DepotIcon,
  ): DepotType<T> {
    const type = new Type<T>(undefined, id, name, description, icon);
    if (this.#ids.has(id))
      throw new Error(`Depot type "${id}" is already registered`);
    this.#ids.set(id, type);
    this.#list.array.push(type);
    this.slots.changed(id);
    return type;
  }

  /**Type with the id*/
  [LOOKUP](id: string): Type<any> | undefined {
    return this.#ids.get(id);
  }

  detach(type: Type<unknown>): void {
    this.#ids.delete(type.id);
    this.#list.array.delete(type);
    this.slots.changed(type.id);
  }
}

export const TYPES = new Types();

/**The states type, registered by the depot itself*/
export const STATES = TYPES.add<unknown>(
  "states",
  "States",
  "Values of the app, like measurements and settings",
);
