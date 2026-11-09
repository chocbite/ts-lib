import state from "@chocbite/ts-lib/state";

/**How the nodes for the values of an array are made, updated and removed*/
export interface StateUIArrayApplyHandlers<T, N extends ChildNode> {
  /**Gives the node for a value*/
  create: (value: T) => N;
  /**Updates a node to a new value, when given nodes are reused, otherwise nodes of changed values are replaced*/
  update?: (node: N, value: T) => void;
  /**Called for every node that is removed or replaced*/
  destroy?: (node: N) => void;
}

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
  const remove = (node: N) => {
    destroy?.(node);
    node.remove();
  };
  for (const change of state.a.read(array)) {
    switch (change.type) {
      case "fresh": {
        if (update) {
          const reused = Math.min(nodes.length, change.items.length);
          for (let i = 0; i < reused; i++) update(nodes[i], change.items[i]);
          while (nodes.length > change.items.length)
            remove(nodes[nodes.length - 1]);
          parent.append(...change.items.slice(reused).map((v) => create(v)));
        } else {
          if (destroy) for (const node of [...nodes]) destroy(node);
          parent.replaceChildren(...change.items.map((v) => create(v)));
        }
        break;
      }
      case "added": {
        const created = change.items.map((v) => create(v));
        const next = nodes[change.index];
        if (next) next.before(...created);
        else parent.append(...created);
        break;
      }
      case "removed":
        for (let i = 0; i < change.items.length; i++) {
          const node = nodes[change.index];
          if (node) remove(node);
        }
        break;
      case "changed":
        for (let i = 0; i < change.items.length; i++) {
          const node = nodes[change.index + i];
          if (!node) continue;
          if (update) update(node, change.items[i]);
          else {
            destroy?.(node);
            node.replaceWith(create(change.items[i]));
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
        break;
      }
    }
  }
}

/**Array states shown in the document*/
export const ARRAY_UI = {
  /**Applies an array to the child nodes of a parent, one node per value.
   * Arrays from array states carry what changed, so only the changed nodes are touched,
   * a plain array is applied as a whole, reusing existing nodes when update is given.
   * @param parent node holding the nodes for the array, it must contain nothing else
   * @param array new value of the array
   * @param handlers make, update and remove the nodes*/
  apply,
};
