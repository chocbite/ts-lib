//Internal hooks between the files of the depot, symbols keep them out of the public api

/**Marks a node removed without detaching it from its parent*/
export const MARK_REMOVED = Symbol("mark_removed");
/**Removes a child from its group, called by the child*/
export const DETACH = Symbol("detach");
/**Detaches a node without a parent, a type, from the registry of types*/
export const DETACH_ROOT = Symbol("detach_root");
/**The child or alias of a group with an id*/
export const LOOKUP = Symbol("lookup");
/**The lookups that looked up an id in a group*/
export const SLOTS = Symbol("slots");
/**Whether a group is provided by a source, which decides its children*/
export const PROVIDED = Symbol("provided");
