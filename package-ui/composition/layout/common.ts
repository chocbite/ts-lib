import { ok, type Result } from "@chocbite/ts-lib/result";
import state, {
  type StateCollectedREA,
  type StateOrVal,
  type StateOrValRES,
  type StateREA,
  type StateRES,
  type StateRESWS,
} from "@chocbite/ts-lib/state";

/**Smallest size of a tab group in rem, without its tab bar*/
export const MIN_WIDTH = 8;
export const MIN_HEIGHT = 4;
/**Width in rem of a tab bar at the left or right side, the styles use the same*/
export const SIDE_BAR_WIDTH = 10;
/**Width of a sizer in rem, in touch mode, used for the minimum size of splits*/
export const SIZER_TOUCH = 1;
/**Distance in rem from a pressed sizer where other sizers are moved with it, at crossings and where sizers line up*/
export const SIZER_REACH = 0.75;
/**How far the pointer moves in px before pressing a tab becomes dragging it*/
export const DRAG_DISTANCE = 6;
/**Part of a tab group from its edges where a dropped tab splits the group, closer to the middle it joins it*/
export const EDGE_PART = 0.25;
/**Strip in rem along the edges of a layout with splits, where a dropped tab splits the whole layout*/
export const ROOT_EDGE = 1.2;

/**An input of a content as a state, an initial value as a read only state, so it can be collected or proxied*/
export const as_any_state = <T>(value: StateOrVal<T>): StateREA<T> =>
  state.is.state(value) ? value : state.ok(value);

/**An input the user changes, an initial value is kept in a state of the element, so it is written like a given state*/
export const own = <T>(
  value: StateOrValRES<T> | undefined,
): StateOrValRES<T> | undefined =>
  value === undefined || state.is.state(value) ? value : state.ok_w(value);

/**The value of a result, the fallback for an error*/
export const value_or = <T>(result: Result<T, unknown>, fallback: T): T =>
  result.ok ? result.value : fallback;

/**Whether the layout can write the state, it writes synchronously and its write gate is open,
 * any other state is read only to the layout, which locks that part*/
export function writable<T>(
  target: StateRES<T> | undefined,
): target is StateRESWS<T> {
  if (!target?.wsync) return false;
  const gate = target.write_enabled;
  return !gate || value_or(gate.get(), false);
}

/**Writes the value when the layout can write the state, see writable, for a change of one state*/
export function write_if<T>(target: StateRES<T> | undefined, value: unknown) {
  if (writable(target)) target.write_sync(value);
}

/**The writes of one change of the user, made one after another, each applied before the next is worked out.
 * A refused write puts back the writes before it, so the layout is never left half changed*/
export class Change {
  #undo: (() => void)[] = [];
  #failed = false;

  /**Whether every write was made*/
  get ok(): boolean {
    return !this.#failed;
  }

  /**Writes the value, false when it or an earlier write was refused, then nothing of the change is left*/
  write<T>(target: StateRES<T> | undefined, value: unknown): boolean {
    if (this.#failed) return false;
    if (!writable(target) || !this.#write(target, value)) return this.#fail();
    return true;
  }

  /**Writes the value when the state can be written, for a part of the change that can be left out, like the shown tab*/
  maybe<T>(target: StateRES<T> | undefined, value: unknown): void {
    if (!this.#failed && writable(target)) this.#write(target, value);
  }

  #write<T>(target: StateRESWS<T>, value: unknown): boolean {
    const old = target.get();
    //Copied before writing, an array write may change the array of the state
    const was =
      old.ok && Array.isArray(old.value)
        ? [...old.value]
        : value_or(old, undefined);
    if (target.write_sync(value).err) return false;
    if (old.ok) this.#undo.push(() => target.write_sync(was));
    return true;
  }

  #fail(): false {
    this.#failed = true;
    for (const undo of this.#undo.reverse()) undo();
    this.#undo = [];
    return false;
  }
}

/**A collected state of a node element, its states are set when what the node holds changes*/
export type Collected<T> = StateCollectedREA<T, StateREA<any>[]>;
export const collect = <T>(
  transform: (values: Result<any, unknown>[]) => T,
): Collected<T> =>
  state.c.rea<T, StateREA<any>[]>((values) => ok(transform(values)));
