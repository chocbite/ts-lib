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
  type StateOrValROS,
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
/**Content type of an entry, the type of the content given to add for object types, like widget definitions,
 * so their specific type is kept, and the type of the depot type otherwise, so 5 gives a number and not 5*/
type ContentOf<T, C> = [T] extends [object] ? C : T;

/**Any node a lookup can give*/
export type DepotNode<T = unknown> = DepotType<T> | DepotChild<T>;

//##################################################################################################################################################
//       _____  ____  _    _ _____   _____ ______
//      / ____|/ __ \| |  | |  __ \ / ____|  ____|
//     | (___ | |  | | |  | | |__) | |    | |__
//      \___ \| |  | | |  | |  _  /| |    |  __|
//      ____) | |__| | |__| | | \ \| |____| |____
//     |_____/ \____/ \____/|_|  \_\\_____|______|

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
const is_source_group = <T>(
  source: DepotSource<T>,
): source is DepotSourceGroup<T> => "children" in source;

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
    if (this.#parent instanceof Provided)
      throw new Error(
        `Depot path "${this.path}" is provided by a source, the source removes it`,
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
  /**Made on the first child, so groups without registered children, like provided ones, cost nothing*/
  #ids: Map<string, Child<T> | Alias<T>> | undefined;
  /**Lookups that looked up an id in this group*/
  readonly [SLOTS] = new Slots();
  #children: StateLocalROS<Child<T>[]> | undefined;

  #children_state(): StateLocalROS<Child<T>[]> {
    return (this.#children ??= state.ros(ok<Child<T>[]>([])));
  }

  get kind(): "type" | "group" {
    return "group";
  }

  /**Children of the group in registration order, array metadata tells what was added or removed.
   * Aliases are not listed*/
  get children(): StateOrValROS<readonly DepotChild<T>[]> {
    return this.#children_state().read_only;
  }

  /**Adds a group below this one, throws if the id exists in this group*/
  group(
    id: string,
    name: StateOrValROS<string>,
    description: StateOrValROS<string>,
    icon?: DepotIcon,
  ): DepotGroup<T> {
    return this.#attach(new Group<T>(this, id, name, description, icon));
  }

  /**Adds an entry to this group, throws if the id exists in this group
   * @param content the content, a value that is not a state is wrapped in one and never changes, use a state for content that changes*/
  add<C extends T>(
    id: string,
    name: StateOrValROS<string>,
    description: StateOrValROS<string>,
    content: StateOrVal<C>,
    icon?: DepotIcon,
  ): DepotEntry<ContentOf<T, C>> {
    //The entry holds the content as given, its type is only narrower than T
    return this.#attach(
      new Entry<T>(this, id, name, description, content, icon),
    ) as unknown as DepotEntry<ContentOf<T, C>>;
  }

  /**Adds a second path to a group or entry of the same type, for resources that moved.
   * A lookup of the alias path gives the target, and an error once the target is removed.
   * Throws if the id exists in this group, or the target is removed or in another type*/
  alias(id: string, target: DepotChild<T>): DepotAlias<T> {
    if (target.parent instanceof Provided)
      throw new Error(
        `Depot alias target "${target.path}" is provided by a source, aliases point at registered nodes`,
      );
    if (target.removed)
      throw new Error(`Depot alias target "${target.path}" is removed`);
    if (target.type !== this.type)
      throw new Error(
        `Depot alias target "${target.path}" is not in the type of "${this.path}"`,
      );
    return this.#attach(new Alias<T>(this, id, target));
  }

  /**Mounts a source at the id, a group or an entry, its items get nodes only when looked up or listed.
   * Gives the node of the source, removing it unmounts the source. Throws if the id exists in this group
   * @param source implemented by the structure itself, so nothing is stored twice*/
  provide(id: string, source: DepotSource<T>): DepotChild<T> {
    if (this.removed) throw new Error(`Depot group "${this.path}" is removed`);
    return this.#attach(make_provided(this, id, source));
  }

  /**Child or alias with the id, aliases are not resolved*/
  [LOOKUP](id: string): Child<T> | Alias<T> | undefined {
    return this.#ids?.get(id);
  }

  #attach<C extends Child<T> | Alias<T>>(child: C): C {
    if (this instanceof Provided)
      throw new Error(
        `Depot group "${this.path}" is provided by a source, the source decides its children`,
      );
    if (this.removed) throw new Error(`Depot group "${this.path}" is removed`);
    const ids = (this.#ids ??= new Map());
    if (ids.has(child.id))
      throw new Error(`Depot path "${child.path}" is already registered`);
    ids.set(child.id, child);
    if (!(child instanceof Alias)) this.#children_state().array.push(child);
    this[SLOTS].changed(child.id);
    return child;
  }

  /**Removes a child from the group, called by the child*/
  [DETACH](child: Node): void {
    this.#ids?.delete(child.id);
    if (!(child instanceof Alias))
      this.#children?.array.delete(child as Child<T>);
    this[SLOTS].changed(child.id);
  }

  [MARK_REMOVED](): void {
    super[MARK_REMOVED]();
    const children = [...(this.#ids?.values() ?? [])];
    this.#ids?.clear();
    if (this.#children?.ok().length) this.#children.set_ok([]);
    for (const child of children) child[MARK_REMOVED]();
  }
}

//##################################################################################################################################################
//      _____  _____   ______      _______ _____  ______ _____
//     |  __ \|  __ \ / __ \ \    / /_   _|  __ \|  ____|  __ \
//     | |__) | |__) | |  | \ \  / /  | | | |  | | |__  | |  | |
//     |  ___/|  _  /| |  | |\ \/ /   | | | |  | |  __| | |  | |
//     | |    | | \ \| |__| | \  /   _| |_| |__| | |____| |__| |
//     |_|    |_|  \_\\____/   \/   |_____|_____/|______|_____/

/**Node of a source item, made for its parent and id, the source given to provide or a child of a provided group*/
function make_provided<T>(
  parent: Group<T>,
  id: string,
  source: DepotSource<T>,
): Child<T> {
  return is_source_group(source)
    ? new Provided<T>(parent, id, source)
    : new Entry<T>(
        parent,
        id,
        source.name,
        source.description,
        source.value,
        source.icon,
      );
}

/**The children of a source group now*/
function source_children<T>(
  source: DepotSourceGroup<T>,
): readonly DepotSourceChild<T>[] {
  return state.is.state(source.children)
    ? source.children.ok()
    : source.children;
}

/**The source child with the id now, undefined when there is none*/
function source_child<T>(
  source: DepotSourceGroup<T>,
  id: string,
): DepotSource<T> | undefined {
  if (source.child) return source.child(id);
  return source_children(source).find((child) => child.id === id)?.source;
}

/**A group of a source, its children come from the source, nodes for them are made when looked up or listed
 * and kept while their source object is the child of the id, a source whose children are a state is followed*/
class Provided<T> extends Group<T> {
  readonly source: DepotSourceGroup<T>;
  /**Nodes made so far by id*/
  #nodes = new Map<string, Child<T>>();
  /**The source object each node was made for*/
  #sources = new WeakMap<Child<T>, DepotSource<T>>();
  /**The children as nodes, made when first asked for, for a source whose children are a state*/
  #listed: StateLocalROS<Child<T>[]> | undefined;
  #following = false;

  constructor(parent: Group<T>, id: string, source: DepotSourceGroup<T>) {
    super(parent, id, source.name, source.description, source.icon);
    this.source = source;
  }

  /**The node of a source child, the one made before while the child is the same source object*/
  #node(id: string, source: DepotSource<T>): Child<T> {
    const made = this.#nodes.get(id);
    if (made && this.#sources.get(made) === source) return made;
    if (made) made[MARK_REMOVED]();
    const node = make_provided(this, id, source);
    this.#nodes.set(id, node);
    this.#sources.set(node, source);
    return node;
  }

  /**The children of the source now as nodes, ids that are not valid depot ids are left out*/
  #now(): Child<T>[] {
    if (this.removed) return [];
    const nodes: Child<T>[] = [];
    for (const child of source_children(this.source))
      if (ID_PATTERN.test(child.id))
        nodes.push(this.#node(child.id, child.source));
    return nodes;
  }

  get children(): StateOrValROS<readonly DepotChild<T>[]> {
    if (!state.is.state(this.source.children)) return this.#now();
    this.#follow();
    return (this.#listed ??= state.ros(ok(this.#now()))).read_only;
  }

  [LOOKUP](id: string): Child<T> | undefined {
    if (this.removed || !ID_PATTERN.test(id)) return undefined;
    this.#follow();
    const source = source_child(this.source, id);
    if (!source) return undefined;
    return this.#node(id, source);
  }

  /**Follows a source whose children are a state, from the first lookup or listing until removed*/
  #follow(): void {
    if (this.#following || !state.is.state(this.source.children)) return;
    this.#following = true;
    this.source.children.sub(this.#changed);
  }

  /**The children of the source changed, nodes of children that are gone are removed and lookups resolve again*/
  #changed = () => {
    if (this.removed) return;
    for (const [id, node] of [...this.#nodes]) {
      if (source_child(this.source, id) === this.#sources.get(node)) continue;
      this.#nodes.delete(id);
      node[MARK_REMOVED]();
    }
    if (this.#listed) this.#listed.set_ok(this.#now());
    this[SLOTS].changed_all();
  };

  [MARK_REMOVED](): void {
    super[MARK_REMOVED]();
    if (this.#following && state.is.state(this.source.children))
      this.source.children.unsub(this.#changed);
    this.#following = false;
    const nodes = [...this.#nodes.values()];
    this.#nodes.clear();
    this.#listed?.set_ok([]);
    for (const node of nodes) node[MARK_REMOVED]();
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

  /**Resolves the lookups of every id again*/
  changed_all(): void {
    for (const set of [...this.#map.values()])
      for (const lookup of [...set]) lookup.update();
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
