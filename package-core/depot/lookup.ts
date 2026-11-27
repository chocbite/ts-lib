import { ok } from "#result";
import state, {
  type StateLocalRES,
  type StateRES,
  type StateResult,
} from "#state";
import { invalid_path, not_registered } from "./errors";
import type { Group } from "./group";
import { LOOKUP, SLOTS } from "./hooks";
import { split } from "./ids";
import type { DepotChild, DepotNode } from "./node";

/**Walks the ids of the lookup from a group, resolving aliases, the path is only for error messages.
 * Every group and id looked at is recorded on the lookup, so it is only resolved again when one of them changes*/
export function walk(
  lookup: Lookup,
  from: Group<any>,
  start: number,
  path: string,
): StateResult<DepotNode> {
  let node: DepotNode<any> = from;
  for (const id of lookup.ids.slice(start)) {
    if (node.kind === "entry") return not_registered(path);
    lookup.depend(node[SLOTS], id);
    const found = node[LOOKUP](id);
    let next: DepotChild<any> | undefined;
    if (found?.kind === "alias") {
      //The target is somewhere else in the type, removing it or a group above it changes the result
      for (
        let n: DepotNode<any> = found.target, p = n.parent;
        p;
        n = p, p = p.parent
      )
        lookup.depend(p[SLOTS], n.id);
      next = found.target;
    } else next = found;
    if (!next || next.removed) return not_registered(path);
    node = next;
  }
  return ok(node as DepotNode);
}

/**Lookups by the id they looked up in a group, or of a type id*/
export class Slots {
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
export class Lookup {
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
export class Lookups {
  #map = new Map<string, Lookup>();
  #resolve: (lookup: Lookup) => StateResult<DepotNode>;

  constructor(resolve: (lookup: Lookup) => StateResult<DepotNode>) {
    this.#resolve = resolve;
  }

  get(path: string): StateRES<DepotNode> {
    const existing = this.#map.get(path);
    if (existing) return existing.state.read_only;
    const ids = split(path);
    if (!ids) return state.err<DepotNode>(invalid_path(path)).read_only;
    const lookup = new Lookup(ids, this.#resolve);
    this.#map.set(path, lookup);
    return lookup.state.read_only;
  }

  /**Resolves every path again*/
  refresh(): void {
    for (const lookup of this.#map.values()) lookup.update();
  }
}
