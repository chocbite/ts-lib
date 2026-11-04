export function node_clone<T extends Node>(node: T): T {
  return node.cloneNode(true) as T;
}
