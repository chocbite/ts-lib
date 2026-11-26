import state, { type StateROS } from "@chocbite/ts-lib/state";

/**Gives the index of a node in its array as a read only state that follows the changes of the array.
 * The state is made by the first call, later calls give the same state*/
export type StateUIArrayIndex = () => StateROS<number>;

/**How the nodes for the values of an array are made, updated and removed*/
export interface StateUIArrayApplyHandlers<T, N extends ChildNode> {
  /**Gives the node for a value
   * @param index gives the index of the node as a state that follows the changes of the array,
   * only nodes that call it are followed, so nodes that do not need their index cost nothing*/
  create: (value: T, index: StateUIArrayIndex) => N;
  /**Updates a node to a new value, when given nodes are reused, otherwise nodes of changed values are replaced*/
  update?: (node: N, value: T) => void;
  /**Called for every node that is removed or replaced*/
  destroy?: (node: N) => void;
}

const index_state = (index: number) => state.ok(index);
type IndexState = ReturnType<typeof index_state>;

/**The index states of the nodes of each parent that asked for one, nodes that never asked are not in it*/
const INDEXES = new WeakMap<ParentNode, Map<ChildNode, IndexState>>();

/**Applies an array to the child nodes of a parent, one node per value.
 * Arrays from array states carry what changed, so only the changed nodes are touched,
 * a plain array is applied as a whole, reusing existing nodes when update is given.
 * @param parent node holding the nodes for the array, it must contain nothing else
 * @param array new value of the array
 * @param handlers make, update and remove the nodes*/
function apply<T, N extends ChildNode>(
  parent: ParentNode,
  array: readonly T[],
  handlers: StateUIArrayApplyHandlers<T, N>,
): void {
  const { create, update, destroy } = handlers;
  //Live list, it follows every change made below
  const nodes = parent.childNodes as NodeListOf<N>;
  /**Stops following the index of a node that leaves the parent*/
  const forget = (node: N) => INDEXES.get(parent)?.delete(node);
  const remove = (node: N) => {
    destroy?.(node);
    forget(node);
    node.remove();
  };
  /**Makes the node for a value that is placed at index, its index state is only made when asked for*/
  const make = (value: T, index: number): N => {
    let owner: IndexState | undefined;
    //node can only be read once create has returned it
    let made = false;
    const node_index = () => {
      if (!owner) {
        //Asked after the node was placed, later changes may have moved it since
        const placed = made && node.parentNode === parent;
        owner = index_state(placed ? Array.prototype.indexOf.call(nodes, node) : index);
        //Asked while it is made, it is followed once made, a node that already left is not followed
        if (placed) follow(node, owner);
      }
      return owner.read_only;
    };
    const node = create(value, node_index);
    made = true;
    if (owner) follow(node, owner);
    return node;
  };
  const follow = (node: N, owner: IndexState) => {
    let indexes = INDEXES.get(parent);
    if (!indexes) INDEXES.set(parent, (indexes = new Map<ChildNode, IndexState>()));
    indexes.set(node, owner);
  };
  //The positions whose node can have changed, nodes keep their index outside of them
  let low = Infinity;
  let high = -Infinity;
  for (const change of state.a.read(array)) {
    switch (change.type) {
      case "fresh": {
        //Kept nodes keep their index, made ones are given theirs
        if (update) {
          const reused = Math.min(nodes.length, change.items.length);
          for (let i = 0; i < reused; i++) update(nodes[i], change.items[i]);
          while (nodes.length > change.items.length)
            remove(nodes[nodes.length - 1]);
          parent.append(...change.items.slice(reused).map((v, i) => make(v, reused + i)));
        } else {
          if (destroy) for (const node of [...nodes]) destroy(node);
          //Every node is replaced
          INDEXES.get(parent)?.clear();
          parent.replaceChildren(...change.items.map((v, i) => make(v, i)));
        }
        break;
      }
      case "added": {
        const created = change.items.map((v, i) => make(v, change.index + i));
        const next = nodes[change.index];
        if (next) next.before(...created);
        else parent.append(...created);
        low = Math.min(low, change.index);
        high = Infinity;
        break;
      }
      case "removed":
        for (let i = 0; i < change.items.length; i++) {
          const node = nodes[change.index];
          if (node) remove(node);
        }
        low = Math.min(low, change.index);
        high = Infinity;
        break;
      case "changed":
        for (let i = 0; i < change.items.length; i++) {
          const node = nodes[change.index + i];
          if (!node) continue;
          if (update) update(node, change.items[i]);
          else {
            destroy?.(node);
            forget(node);
            node.replaceWith(make(change.items[i], change.index + i));
          }
        }
        break;
      case "moved": {
        const moved: N[] = [];
        //Every removal moves the next node to from_index
        for (let i = 0; i < change.items.length; i++) {
          const node = nodes[change.from_index];
          if (!node) break;
          moved.push(node);
          node.remove();
        }
        const next = nodes[change.to_index];
        if (next) next.before(...moved);
        else parent.append(...moved);
        low = Math.min(low, change.from_index, change.to_index);
        high = Math.max(high, Math.max(change.from_index, change.to_index) + moved.length);
        break;
      }
    }
  }
  //Only when a node asked for its index, a number set again tells no one, so only nodes that moved tell
  const indexes = INDEXES.get(parent);
  if (!indexes?.size) return;
  const end = Math.min(high, nodes.length);
  for (let i = low; i < end; i++) indexes.get(nodes[i])?.set_ok(i);
}

/**Array states shown in the document*/
export const ARRAY_UI = {
  /**Applies an array to the child nodes of a parent, one node per value.
   * Arrays from array states carry what changed, so only the changed nodes are touched,
   * a plain array is applied as a whole, reusing existing nodes when update is given.
   * create gets the index of the node as a state when it asks for it, see StateUIArrayApplyHandlers.
   * @param parent node holding the nodes for the array, it must contain nothing else
   * @param array new value of the array
   * @param handlers make, update and remove the nodes*/
  apply,
};
