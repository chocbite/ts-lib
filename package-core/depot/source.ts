import state, { type StateOrVal, type StateOrValROS } from "#state";
import type { DepotIcon } from "./node";

/**Name, description and icon of a source, a constant costs no state, a state is followed*/
export interface DepotSourceBase {
  readonly name: StateOrValROS<string>;
  readonly description: StateOrValROS<string>;
  readonly icon?: DepotIcon;
}

/**A group of a source, implemented by the structure itself, its children are listed and looked up through it*/
export interface DepotSourceGroup<T> extends DepotSourceBase {
  /**The children, a constant list, or a state of one for a group that changes*/
  readonly children: StateOrValROS<readonly DepotSourceChild<T>[]>;
  /**Optional fast lookup of one child by id, for big groups, otherwise the children are searched*/
  child?(id: string): DepotSource<T> | undefined;
}

/**An entry of a source, its content a constant or a state*/
export interface DepotSourceEntry<T> extends DepotSourceBase {
  readonly value: StateOrVal<T>;
}

/**Something mounted in the depot with provide, a group or an entry, implemented by a structure on its own objects so nothing is stored twice*/
export type DepotSource<T> = DepotSourceGroup<T> | DepotSourceEntry<T>;

/**A child of a source group, the id is its path segment, use stable ids, not names, so a rename keeps the path*/
export interface DepotSourceChild<T> {
  readonly id: string;
  readonly source: DepotSource<T>;
}

/**True for a source group*/
export const is_source_group = <T>(
  source: DepotSource<T>,
): source is DepotSourceGroup<T> => "children" in source;

/**The children of a source group now*/
export function source_children<T>(
  source: DepotSourceGroup<T>,
): readonly DepotSourceChild<T>[] {
  return state.is.state(source.children)
    ? source.children.ok()
    : source.children;
}

/**The source child with the id now, undefined when there is none*/
export function source_child<T>(
  source: DepotSourceGroup<T>,
  id: string,
): DepotSource<T> | undefined {
  if (source.child) return source.child(id);
  return source_children(source).find((child) => child.id === id)?.source;
}
