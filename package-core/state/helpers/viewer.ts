import {
  State,
  STATE_VIEWER_OVERRIDE_KEY,
  StateResult,
  StateSub,
} from "../types";
import { IS } from "./is";

declare global {
  interface Object {
    [STATE_VIEWER_OVERRIDE_KEY]?: () => unknown;
  }
}

/**Adds the states found in a value to found, going into arrays and objects at any depth, but not into the values of the states,
 * the same tree to_json of a state writes
 * A value can give what is walked instead of itself with the override key*/
function collect(
  value: unknown,
  found: Set<State<unknown, any>>,
  seen: Set<object>,
): void {
  if (typeof value !== "object" || value === null) return;
  const walked = value[STATE_VIEWER_OVERRIDE_KEY]?.() ?? value;
  if (IS.state(walked)) {
    found.add(walked);
    return;
  }
  if (typeof walked !== "object" || walked === null || seen.has(walked)) return;
  seen.add(walked);
  if (Array.isArray(walked)) {
    for (const item of walked) collect(item, found, seen);
    return;
  }
  //Objects converting themselves to JSON are values, like dates, to_json does not go into them either
  if (typeof (walked as { toJSON?: unknown }).toJSON === "function") return;
  for (const item of Object.values(walked)) collect(item, found, seen);
}

/**Follows one state and every state found in its value, by identity
 * When the value changes the value is walked again, states still found keep their subscription,
 * new states are subscribed and states no longer found are unsubscribed*/
class StateViewer {
  #state?: State<unknown, any>;
  #func?: StateSub<any>;
  #dead = false;
  #children = new Map<State<unknown, any>, StateViewer>();

  constructor(state: State<unknown, any>, callback: () => void) {
    //Waits for the first value, so nothing is called on setup and async states are subscribed once they have a value
    state.then((v) => {
      if (this.#dead) return;
      this.#walk(v, callback);
      this.#func = state.sub((v) => {
        this.#walk(v, callback);
        callback();
      });
      this.#state = state;
    });
  }

  #walk(v: StateResult<unknown>, callback: () => void) {
    const found = new Set<State<unknown, any>>();
    if (v.ok) collect(v.value, found, new Set());
    for (const [state, child] of this.#children)
      if (!found.has(state)) {
        child.unsub();
        this.#children.delete(state);
      }
    for (const state of found)
      if (!this.#children.has(state))
        this.#children.set(state, new StateViewer(state, callback));
  }

  /**Stops following the state and every state below it*/
  unsub() {
    this.#dead = true;
    if (this.#func) this.#state?.unsub(this.#func);
    for (const child of this.#children.values()) child.unsub();
    this.#children.clear();
  }
}

/**Calls the callback when the root or any state in its value changes, at any depth: states in states,
 * and states in arrays and objects, the same tree to_json of a state writes
 * A value can give what is followed instead of itself with OVERRIDE_KEY, like a class instance holding states
 * The callback is not called for the first values, unsub stops following*/
export function viewer(
  root: State<any, any>,
  callback: () => void,
): StateViewer {
  return new StateViewer(root, callback);
}

export const VIEWER = {
  /**Calls the callback when the root or any state in its value changes, at any depth, see viewer*/
  viewer,
  /**Key for a value to give what the viewer and to_json walk instead of the value itself*/
  OVERRIDE_KEY: STATE_VIEWER_OVERRIDE_KEY,
};
