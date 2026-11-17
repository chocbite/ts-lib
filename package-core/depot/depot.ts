import { err_nice, NiceError, ok } from "#result";

/**The kinds of the NiceErrors of the depot, their descriptions are the nice texts, given as depot.errors*/
const depot_errors = Object.freeze({
  /**The type of a path was removed, not supposed to happen, the cause is an Error*/
  TYPE_REMOVED: Symbol("Data type removed"),
  /**Nothing is registered at a path, normal use, a path can be held before it is registered*/
  NOT_REGISTERED: Symbol("Data not available"),
  /**A path that is not a valid depot path, like one with an empty segment, a bug, the cause is an Error whose stack shows the caller*/
  INVALID_PATH: Symbol("Invalid data path"),
});
import state, {
  type StateLocalRES,
  type StateLocalROS,
  type StateOrVal,
  type StateREA,
  type StateRES,
  type StateResult,
  type StateROS,
} from "#state";

/**Allowed characters in an id*/
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**Throws if the id is not a valid depot id*/
function check_id(id: string): void {
  if (!ID_PATTERN.test(id))
    throw new Error(
      `Depot id "${id}" is invalid, use letters, digits, "_" and "-"`,
    );
}

/**Splits a path like "/a/b" into its ids, undefined if the path is invalid*/
function split(path: string): string[] | undefined {
  if (path[0] !== "/") return undefined;
  const ids = path.slice(1).split("/");
  for (const id of ids) if (!ID_PATTERN.test(id)) return undefined;
  return ids;
}

/**Internal hooks, symbols keep them out of the public api*/
const MARK_REMOVED = Symbol("mark_removed");
const DETACH = Symbol("detach");
const LOOKUP = Symbol("lookup");
const SLOTS = Symbol("slots");

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

//##################################################################################################################################################
//      _   _  ____  _____  ______
//     | \ | |/ __ \|  __ \|  ____|
//     |  \| | |  | | |  | | |__
//     | . ` | |  | | |  | |  __|
//     | |\  | |__| | |__| | |____
//     |_| \_|\____/|_____/|______|

abstract class Node {
  /**Id of the node, unique in its group, the last segment of its path*/
  readonly id: string;
  /**Name for showing to users*/
  readonly name: string;
  /**Description for showing to users*/
  readonly description: string;
  /**Icon for showing to users*/
  readonly icon?: DepotIcon;
  #parent: Group<any> | undefined;
  #removed = false;

  constructor(
    parent: Group<any> | undefined,
    id: string,
    name: string,
    description: string,
    icon?: DepotIcon,
  ) {
    check_id(id);
    this.#parent = parent;
    this.id = id;
    this.name = name;
    this.description = description;
    if (icon !== undefined) this.icon = icon;
  }

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
    if (!parent) return this as unknown as Type<unknown>;
    while (parent.#parent) parent = parent.#parent;
    return parent as Type<unknown>;
  }

  /**True once the node or a group above it has been removed*/
  get removed(): boolean {
    return this.#removed;
  }

  /**Removes the node from its group, a group also removes everything below it*/
  remove(): void {
    if ((this as unknown) === STATES)
      throw new Error(
        "The states type is part of the depot and can not be removed",
      );
    if (this.#removed) return;
    //Marked first, so lookups made when the parent tells of the change see everything below as removed
    this[MARK_REMOVED]();
    if (this.#parent) this.#parent[DETACH](this);
    else TYPES.detach(this as unknown as Type<unknown>);
  }

  /**Marks the node removed without detaching it from its parent*/
  [MARK_REMOVED](): void {
    this.#removed = true;
  }
}

//##################################################################################################################################################
//       _____ _____   ____  _    _ _____
//      / ____|  __ \ / __ \| |  | |  __ \
//     | |  __| |__) | |  | | |  | | |__) |
//     | | |_ |  _  /| |  | | |  | |  ___/
//     | |__| | | \ \| |__| | |__| | |
//      \_____|_|  \_\\____/ \____/|_|

class Group<T> extends Node {
  #ids = new Map<string, Child<T> | Alias<T>>();
  /**Lookups that looked up an id in this group*/
  readonly [SLOTS] = new Slots();
  #children: StateLocalROS<Child<T>[]> = state.ros(ok<Child<T>[]>([]));

  get kind(): "type" | "group" {
    return "group";
  }

  /**Children of the group in registration order, array metadata tells what was added or removed.
   * Aliases are not listed*/
  get children(): StateROS<readonly DepotChild<T>[]> {
    return this.#children.read_only;
  }

  /**Adds a group below this one, throws if the id exists in this group*/
  group(
    id: string,
    name: string,
    description: string,
    icon?: DepotIcon,
  ): DepotGroup<T> {
    return this.#attach(new Group<T>(this, id, name, description, icon));
  }

  /**Adds an entry to this group, throws if the id exists in this group
   * @param content the content, a fixed value never changes, use a state for content that changes*/
  add(
    id: string,
    name: string,
    description: string,
    content: StateOrVal<T>,
    icon?: DepotIcon,
  ): DepotEntry<T> {
    return this.#attach(
      new Entry<T>(this, id, name, description, content, icon),
    );
  }

  /**Adds a second path to a group or entry of the same type, for resources that moved.
   * A lookup of the alias path gives the target, and an error once the target is removed.
   * Throws if the id exists in this group, or the target is removed or in another type*/
  alias(id: string, target: DepotChild<T>): DepotAlias<T> {
    if (target.removed)
      throw new Error(`Depot alias target "${target.path}" is removed`);
    if (target.type !== this.type)
      throw new Error(
        `Depot alias target "${target.path}" is not in the type of "${this.path}"`,
      );
    return this.#attach(new Alias<T>(this, id, target));
  }

  /**Child or alias with the id, aliases are not resolved*/
  [LOOKUP](id: string): Child<T> | Alias<T> | undefined {
    return this.#ids.get(id);
  }

  #attach<C extends Child<T> | Alias<T>>(child: C): C {
    if (this.removed) throw new Error(`Depot group "${this.path}" is removed`);
    if (this.#ids.has(child.id))
      throw new Error(`Depot path "${child.path}" is already registered`);
    this.#ids.set(child.id, child);
    if (!(child instanceof Alias)) this.#children.array.push(child);
    this[SLOTS].changed(child.id);
    return child;
  }

  /**Removes a child from the group, called by the child*/
  [DETACH](child: Node): void {
    this.#ids.delete(child.id);
    if (!(child instanceof Alias))
      this.#children.array.delete(child as Child<T>);
    this[SLOTS].changed(child.id);
  }

  [MARK_REMOVED](): void {
    super[MARK_REMOVED]();
    const children = [...this.#ids.values()];
    this.#ids.clear();
    if (this.#children.ok().length) this.#children.set_ok([]);
    for (const child of children) child[MARK_REMOVED]();
  }
}

//##################################################################################################################################################
//      _________     _______  ______
//     |__   __\ \   / /  __ \|  ____|
//        | |   \ \_/ /| |__) | |__
//        | |    \   / |  ___/|  __|
//        | |     | |  | |    | |____
//        |_|     |_|  |_|    |______|

class Type<T> extends Group<T> {
  #lookups = new Lookups((lookup) =>
    this.removed
      ? err_nice(depot_errors.TYPE_REMOVED, new Error(`Depot type "${this.id}" is removed`))
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

  [MARK_REMOVED](): void {
    super[MARK_REMOVED]();
    this.#lookups.refresh();
  }
}

//##################################################################################################################################################
//      ______ _   _ _______ _______     __
//     |  ____| \ | |__   __|  __ \ \   / /
//     | |__  |  \| |  | |  | |__) \ \_/ /
//     |  __| | . ` |  | |  |  _  / \   /
//     | |____| |\  |  | |  | | \ \  | |
//     |______|_| \_|  |_|  |_|  \_\ |_|

class Entry<T> extends Node {
  /**State of the content, the state given to add, or a state of the fixed value*/
  readonly value: StateREA<T>;

  constructor(
    parent: Group<T>,
    id: string,
    name: string,
    description: string,
    content: StateOrVal<T>,
    icon?: DepotIcon,
  ) {
    super(parent, id, name, description, icon);
    this.value = state.as_state(content);
  }

  get kind(): "entry" {
    return "entry";
  }
}

//##################################################################################################################################################
//               _      _____           _____
//         /\   | |    |_   _|   /\    / ____|
//        /  \  | |      | |    /  \  | (___
//       / /\ \ | |      | |   / /\ \  \___ \
//      / ____ \| |____ _| |_ / ____ \ ____) |
//     /_/    \_\______|_____/_/    \_\_____/

class Alias<T> extends Node {
  /**The group or entry the alias points at*/
  readonly target: DepotChild<T>;

  constructor(parent: Group<T>, id: string, target: Child<T>) {
    super(parent, id, target.name, target.description, target.icon);
    this.target = target;
  }

  get kind(): "alias" {
    return "alias";
  }
}

type Child<T> = Group<T> | Entry<T>;

//Classes are only exported as types, nodes are made through depot.type, group, add and alias
export type DepotType<T> = Type<T>;
export type DepotGroup<T> = Group<T>;
export type DepotEntry<T> = Entry<T>;
export type DepotAlias<T> = Alias<T>;

//##################################################################################################################################################
//      _      ____   ____  _  ___    _ _____
//     | |    / __ \ / __ \| |/ / |  | |  __ \
//     | |   | |  | | |  | | ' /| |  | | |__) |
//     | |   | |  | | |  | |  < | |  | |  ___/
//     | |___| |__| | |__| | . \| |__| | |
//     |______\____/ \____/|_|\_\\____/|_|

/**Walks the ids of the lookup from a group, resolving aliases, the path is only for error messages.
 * Every group and id looked at is recorded on the lookup, so it is only resolved again when one of them changes*/
function walk(
  lookup: Lookup,
  from: Group<any>,
  start: number,
  path: string,
): StateResult<DepotNode> {
  let node: Node = from;
  for (const id of lookup.ids.slice(start)) {
    if (!(node instanceof Group))
      return err_nice(depot_errors.NOT_REGISTERED, `Depot path "${path}" is not registered`);
    lookup.depend(node[SLOTS], id);
    let next = node[LOOKUP](id);
    if (next instanceof Alias) {
      //The target is somewhere else in the type, removing it or a group above it changes the result
      for (let n: Node = next.target, p = n.parent; p; n = p, p = p.parent)
        lookup.depend(p[SLOTS], n.id);
      next = next.target;
    }
    if (!next || next.removed)
      return err_nice(depot_errors.NOT_REGISTERED, `Depot path "${path}" is not registered`);
    node = next;
  }
  return ok(node as DepotNode);
}

/**Lookups by the id they looked up in a group, or of a type id*/
class Slots {
  #map = new Map<string, Set<Lookup>>();

  add(lookup: Lookup, id: string): void {
    const set = this.#map.get(id);
    if (set) set.add(lookup);
    else this.#map.set(id, new Set([lookup]));
  }

  delete(lookup: Lookup, id: string): void {
    const set = this.#map.get(id);
    if (!set) return;
    set.delete(lookup);
    if (!set.size) this.#map.delete(id);
  }

  /**Resolves the lookups of the id again*/
  changed(id: string): void {
    const set = this.#map.get(id);
    if (set) for (const lookup of [...set]) lookup.update();
  }
}

/**The state of one path*/
class Lookup {
  readonly ids: string[];
  readonly state: StateLocalRES<DepotNode>;
  #resolve: (lookup: Lookup) => StateResult<DepotNode>;
  #slots: [Slots, string][] = [];
  /**The last result, so the state is only set on a change, compare treats equal NiceErrors as the same*/
  #last: StateResult<DepotNode>;

  constructor(
    ids: string[],
    resolve: (lookup: Lookup) => StateResult<DepotNode>,
  ) {
    this.ids = ids;
    this.#resolve = resolve;
    const result = resolve(this);
    this.#last = result;
    this.state = state.res(result);
  }

  /**Records that the result depends on the id in the slots*/
  depend(slots: Slots, id: string): void {
    slots.add(this, id);
    this.#slots.push([slots, id]);
  }

  /**Resolves the path again*/
  update(): void {
    for (const [slots, id] of this.#slots) slots.delete(this, id);
    this.#slots = [];
    const result = this.#resolve(this);
    if (this.#last.compare(result)) return;
    this.#last = result;
    this.state.set(result);
  }
}

/**Lookup states by path*/
class Lookups {
  #map = new Map<string, Lookup>();
  #resolve: (lookup: Lookup) => StateResult<DepotNode>;

  constructor(resolve: (lookup: Lookup) => StateResult<DepotNode>) {
    this.#resolve = resolve;
  }

  get(path: string): StateRES<DepotNode> {
    const existing = this.#map.get(path);
    if (existing) return existing.state.read_only;
    const ids = split(path);
    if (!ids)
      return state.err<DepotNode>(
        new NiceError(depot_errors.INVALID_PATH, new Error(`Depot path "${path}" is invalid`)),
      ).read_only;
    const lookup = new Lookup(ids, this.#resolve);
    this.#map.set(path, lookup);
    return lookup.state.read_only;
  }

  /**Resolves every path again*/
  refresh(): void {
    for (const lookup of this.#map.values()) lookup.update();
  }
}

//##################################################################################################################################################
//      _____  ______ _____   ____ _______
//     |  __ \|  ____|  __ \ / __ \__   __|
//     | |  | | |__  | |__) | |  | | | |
//     | |  | |  __| |  ___/| |  | | | |
//     | |__| | |____| |    | |__| | | |
//     |_____/|______|_|     \____/  |_|

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
    name: string,
    description: string,
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

const TYPES = new Types();

/**Lookups of full paths, the first id is the type*/
const GLOBAL = new Lookups((lookup) => {
  const path = "/" + lookup.ids.join("/");
  const type_id = lookup.ids[0] ?? "";
  lookup.depend(TYPES.slots, type_id);
  const type = TYPES[LOOKUP](type_id);
  if (!type) return err_nice(depot_errors.NOT_REGISTERED, `Depot path "${path}" is not registered`);
  return walk(lookup, type, 1, path);
});

/**The states type, registered by the depot itself*/
const STATES = TYPES.add<unknown>(
  "states",
  "States",
  "Values of the app, like measurements and settings",
);

export const depot = {
  /**The kinds of the NiceErrors of the depot, like depot.errors.NOT_REGISTERED*/
  errors: depot_errors,
  /**Registers a type, the root segment of a path, throws if the id exists
   * @template T the content type of every entry below the type*/
  type<T>(
    id: string,
    name: string,
    description: string,
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
