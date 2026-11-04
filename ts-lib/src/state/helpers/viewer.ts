import {
  State,
  STATE_VIEWER_OVERRIDE_KEY,
  StateResult,
  StateSub,
} from "../types";
import { ARRAY } from "./array";
import { IS } from "./is";
import { OBJECT } from "./object";

declare global {
  interface Object {
    [STATE_VIEWER_OVERRIDE_KEY]?: () =>
      | State<unknown, any>
      | State<unknown, any>[]
      | { [key: string]: State<unknown, any> };
  }
}

class StateViewer {
  #state?: State<unknown, any>;
  #func?: StateSub<any>;
  #dead?: boolean = false;
  #children?:
    | StateViewer
    | (StateViewer | undefined)[]
    | { [key: string]: StateViewer };
  constructor(state: State<unknown, any>, callback: () => void) {
    state.then((v) => {
      if (this.#dead) return;
      this.#sub(v, callback);
      this.#func = state.sub((v) => {
        this.#sub(v, callback);
        callback();
      });
      this.#state = state;
    });
  }

  #sub(v: StateResult<unknown>, callback: () => void) {
    if (v.err) return this.#unsub();
    const val = v.value;
    if (!(val instanceof Object)) return this.#unsub();
    const value = val[STATE_VIEWER_OVERRIDE_KEY]?.() ?? val;
    if (IS.state(value)) return this.#unsub(new StateViewer(value, callback));
    if (Array.isArray(value)) {
      ARRAY.read(value).forEach((e) => {
        if (e.type === "added")
          (this.#children as (StateViewer | undefined)[]).splice(
            e.index,
            0,
            ...e.items.map((v) => {
              if (IS.state(v)) return new StateViewer(v, callback);
              else return undefined;
            }),
          );
        else if (e.type === "removed") {
          this.#unsub_array(
            (this.#children as (StateViewer | undefined)[]).splice(
              e.index,
              e.items.length,
            ),
          );
        } else if (e.type === "changed")
          for (let i = 0; i < e.items.length; i++) {
            (this.#children as (StateViewer | undefined)[])[
              e.index + i
            ]?.unsub();
            const e_i = (e.items as unknown[])[i];
            (this.#children as (StateViewer | undefined)[])[e.index + i] =
              IS.state(e_i) ? new StateViewer(e_i, callback) : undefined;
          }
        else if (e.type === "moved") {
          const items = (this.#children as (StateViewer | undefined)[]).splice(
            e.from_index,
            e.items.length,
          );
          (this.#children as (StateViewer | undefined)[]).splice(
            e.to_index,
            0,
            ...items,
          );
        } else if (e.type === "fresh")
          this.#unsub(
            e.items.map((v) => {
              if (IS.state(v)) return new StateViewer(v, callback);
              else return undefined;
            }),
          );
      });
      return;
    }
    OBJECT.read(value as Record<PropertyKey, unknown>).forEach((e) => {
      if (e.type === "added")
        for (const key of Object.keys(e.items)) {
          const v = e.items[key];
          if (IS.state(v))
            (
              this.#children as {
                [key: string]: StateViewer;
              }
            )[key] = new StateViewer(v, callback);
        }
      else if (e.type === "removed")
        for (const key of Object.keys(e.items)) {
          (
            this.#children as {
              [key: string]: StateViewer;
            }
          )[key]?.unsub();
          delete (
            this.#children as {
              [key: string]: StateViewer;
            }
          )[key];
        }
      else if (e.type === "changed")
        for (const key of Object.keys(e.items)) {
          (
            this.#children as {
              [key: string]: StateViewer;
            }
          )[key]?.unsub();
          const v = e.items[key];
          if (IS.state(v))
            (
              this.#children as {
                [key: string]: StateViewer;
              }
            )[key] = new StateViewer(v, callback);
        }
      else if (e.type === "fresh") {
        this.#unsub({});
        for (const key of Object.keys(e.items)) {
          const v = e.items[key];
          if (IS.state(v))
            (
              this.#children as {
                [key: string]: StateViewer;
              }
            )[key] = new StateViewer(v, callback);
        }
      }
    });
  }

  #unsub_array(arr: (StateViewer | undefined)[]) {
    for (let i = 0; i < arr.length; i++) arr[i]?.unsub();
  }

  #unsub_object(obj: { [key: string]: StateViewer }) {
    for (const key in obj) obj[key]?.unsub();
  }

  #unsub(
    new_obs?:
      | StateViewer
      | (StateViewer | undefined)[]
      | {
          [key: string]: StateViewer;
        },
  ) {
    if (this.#children)
      if (this.#children instanceof StateViewer) this.#children.unsub();
      else if (Array.isArray(this.#children)) this.#unsub_array(this.#children);
      else this.#unsub_object(this.#children);
    this.#children = new_obs;
  }

  unsub() {
    this.#dead = true;
    this.#state?.unsub(this.#func);
    if (this.#children)
      if (this.#children instanceof StateViewer) this.#children.unsub();
      else if (Array.isArray(this.#children))
        this.#children.forEach((child) => child?.unsub());
      else Object.values(this.#children).forEach((child) => child?.unsub());
    this.#children = undefined;
  }
}

/**Recursively subscribes to all states in a tree of states, and optionally if a state value declares a viewer override*/
export function viewer(
  root: State<any, any>,
  callback: () => void,
): StateViewer {
  return new StateViewer(root, callback);
}

export const VIEWER = {
  viewer,
  /**Key for state value to supply a function returning substates for the viewer to subscribe to*/
  OVERRIDE_KEY: STATE_VIEWER_OVERRIDE_KEY,
};
