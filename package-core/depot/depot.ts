import type { StateOrValROS, StateRES, StateROS } from "#state";
import { depot_errors, not_registered } from "./errors";
import { LOOKUP } from "./hooks";
import { Lookups, walk } from "./lookup";
import type { DepotIcon, DepotNode } from "./node";
import { STATES, TYPES, type DepotType } from "./type";

/**Lookups of full paths, the first id is the type*/
const GLOBAL = new Lookups((lookup) => {
  const path = "/" + lookup.ids.join("/");
  const type_id = lookup.ids[0] ?? "";
  lookup.depend(TYPES.slots, type_id);
  const type = TYPES[LOOKUP](type_id);
  if (!type) return not_registered(path);
  return walk(lookup, type, 1, path);
});

export const depot = {
  /**The kinds of the NiceErrors of the depot, like depot.errors.NOT_REGISTERED*/
  errors: depot_errors,
  /**Registers a type, the root segment of a path, throws if the id exists
   * @template T the content type of every entry below the type*/
  type<T>(
    id: string,
    name: StateOrValROS<string>,
    description: StateOrValROS<string>,
    icon?: DepotIcon,
  ): DepotType<T> {
    return TYPES.add<T>(id, name, description, icon);
  },
  /**The states type, registered by the depot and never removed.
   * The content of an entry is the registered state itself, entry.value is the state given to add*/
  states: STATES,
  /**All registered types in registration order*/
  get types(): StateROS<readonly DepotType<unknown>[]> {
    return TYPES.list;
  },
  /**State of the node at a full path, like "/widgets/basic/rectangle".
   * Aliases are resolved, the state is an error while nothing is registered at the path,
   * so a path can be held before its resource is registered and after it is removed.
   * The same path gives the same state*/
  get(path: string): StateRES<DepotNode> {
    return GLOBAL.get(path);
  },
};
