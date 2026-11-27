import { ok } from "#result";
import state, {
  type StateLocalROS,
  type StateOrVal,
  type StateOrValROS,
} from "#state";
import { Alias, type DepotAlias } from "./alias";
import { Entry, type DepotEntry } from "./entry";
import { DETACH, LOOKUP, MARK_REMOVED, PROVIDED, SLOTS } from "./hooks";
import { ID_PATTERN } from "./ids";
import { Slots } from "./lookup";
import { Node, type DepotChild, type DepotIcon } from "./node";
import {
  is_source_group,
  source_child,
  source_children,
  type DepotSource,
  type DepotSourceGroup,
} from "./source";

//Provided extends Group and Group makes Provided nodes, so they share a file, split they would import each other

/**Content type of an entry, the type of the content given to add for object types, like widget definitions,
 * so their specific type is kept, and the type of the depot type otherwise, so 5 gives a number and not 5*/
type ContentOf<T, C> = [T] extends [object] ? C : T;

type Child<T> = Group<T> | Entry<T>;

//       _____ _____   ____  _    _ _____
//      / ____|  __ \ / __ \| |  | |  __ \
//     | |  __| |__) | |  | | |  | | |__) |
//     | | |_ |  _  /| |  | | |  | |  ___/
//     | |__| | | \ \| |__| | |__| | |
//      \_____|_|  \_\\____/ \____/|_|

/**A level in the tree, holding groups, entries and aliases*/
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

  /**Whether a source decides the children of the group*/
  get [PROVIDED](): boolean {
    return false;
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
    if (target.parent?.[PROVIDED])
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
    if (this[PROVIDED])
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

  get [PROVIDED](): boolean {
    return true;
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

//Classes are only exported as types, nodes are made through depot.type, group, add and alias
export { Group };
export type DepotGroup<T> = Group<T>;
