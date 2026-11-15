//A keyed tree of states: every node is its own state, and every node has a children state, an array state of the states of its children.
//A roots state holds the nodes at the top level. These map directly to a list: the roots are the rows, a node's children its sub rows.
//Changes are given as new node values, the tree works out what changed and writes only that to the array states,
//so a list adds, removes or moves only those rows, and refreshes only the rows of changed nodes.
//A node's state is made once and stays the same object, so it identifies the node.
//The children and roots states are writable for moves inside one parent, which the tree hands to on_move, the owner of the data.
import { err, ok, type Result } from "@chocbite/ts-lib/result";
import state, {
  STATE_ARRAY_WRITE_KEY,
  type StateLocalROS,
  type StateLocalROSW,
  type StateROS,
  type StateROSW,
} from "@chocbite/ts-lib/state";

export interface TreeNode {
  id: string;
  /**Id of the parent, empty at the top level and for nodes outside the tree*/
  parent: string;
  /**Ids of the children in order*/
  children: readonly string[];
}

/**Asks the owner of the data to move children of a parent, the tree changes when the owner gives it the new values
 * @param parent the parent, empty for the top level*/
export type TreeMove = (parent: string, from: number, to: number, count: number) => PromiseLike<Result<void, string>>;

export type TreeRows<T> = StateROSW<StateROS<T>[]>;

export class Tree<T extends TreeNode> {
  readonly #owners = new Map<string, StateLocalROS<T>>();
  readonly #children = new Map<string, StateLocalROSW<StateROS<T>[]>>();
  readonly #roots: StateLocalROSW<StateROS<T>[]>;
  readonly #on_move: TreeMove;

  constructor(on_move: TreeMove) {
    this.#on_move = on_move;
    this.#roots = this.#rows("");
  }

  /**States of the nodes at the top level, in order*/
  get roots(): TreeRows<T> {
    return this.#roots;
  }

  /**States of the children of the node, in order*/
  children(id: string): TreeRows<T> | undefined {
    return this.#children.get(id);
  }

  /**The state of the node with the id*/
  get(id: string): StateROS<T> | undefined {
    return this.#owners.get(id)?.read_only;
  }

  /**Current value of the node with the id*/
  value(id: string): T | undefined {
    return this.#owners.get(id)?.ok();
  }

  /**Current values of all nodes, also those outside the tree*/
  *values(): Iterable<T> {
    for (const owner of this.#owners.values()) yield owner.ok();
  }

  /**Ids at the top level, in order*/
  root_ids(): string[] {
    return this.#roots.ok().map((s) => s.ok().id);
  }

  /**Replaces all nodes, every node gets a new state*/
  reset(nodes: readonly T[], roots: readonly string[]) {
    this.#owners.clear();
    this.#children.clear();
    for (const node of nodes) this.#add(node);
    for (const node of nodes) this.#children.get(node.id)!.set_ok(this.#states(node.children));
    this.#roots.set_ok(this.#states(roots));
  }

  /**Sets the nodes, adding new ones, and the top level when given.
   * The children of every given node, and the top level, are brought to the given order with the fewest array writes.*/
  put(nodes: readonly T[], roots?: readonly string[]) {
    const changed: StateLocalROS<T>[] = [];
    for (const node of nodes) {
      const owner = this.#owners.get(node.id);
      if (owner) {
        owner.set_ok(node);
        changed.push(owner);
      } else this.#add(node);
    }
    const inserted = new Set<StateROS<T>>();
    for (const node of nodes) this.#sync(this.#children.get(node.id)!, node.children, inserted);
    if (roots) this.#sync(this.#roots, roots, inserted);
    //Rows of changed nodes that stayed in their parent are told their node changed
    for (const owner of changed) {
      if (inserted.has(owner.read_only)) continue;
      const parent = owner.ok().parent;
      const rows = parent ? this.#children.get(parent) : this.#roots;
      const index = rows?.ok().indexOf(owner.read_only) ?? -1;
      if (index >= 0) rows!.array.change(index, owner.read_only);
    }
  }

  #add(node: T) {
    this.#owners.set(node.id, state.ros(ok(node)));
    this.#children.set(node.id, this.#rows(node.id));
  }

  #states(ids: readonly string[]): StateROS<T>[] {
    return ids.flatMap((id) => this.#owners.get(id)?.read_only ?? []);
  }

  /**Rows state of a parent, writes to it are moves of its children*/
  #rows(parent: string): StateLocalROSW<StateROS<T>[]> {
    return state.rosw(ok<StateROS<T>[]>([]), async (value) => {
      const write = state.a.is_write(value) ? value[STATE_ARRAY_WRITE_KEY] : undefined;
      if (write?.type !== "move") return err("Only moves inside the same parent are supported");
      return this.#on_move(parent, write.from_index, write.to_index, write.count);
    });
  }

  /**Brings the rows to the order of the ids, with removals, moves and insertions of single rows
   * @param inserted collects the states inserted*/
  #sync(rows: StateLocalROSW<StateROS<T>[]>, ids: readonly string[], inserted: Set<StateROS<T>>) {
    const wanted = this.#states(ids);
    const keep = new Set(wanted);
    const current = rows.ok();
    for (let i = current.length - 1; i >= 0; i--) if (!keep.has(current[i])) rows.array.splice(i, 1);
    for (let i = 0; i < wanted.length; i++) {
      const now = rows.ok();
      if (now[i] === wanted[i]) continue;
      const from = now.indexOf(wanted[i], i + 1);
      if (from >= 0) rows.array.move(from, i);
      else {
        rows.array.splice(i, 0, wanted[i]);
        inserted.add(wanted[i]);
      }
    }
  }
}
