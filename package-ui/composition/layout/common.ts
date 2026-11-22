import { ok, type Result } from "@chocbite/ts-lib/result";
import state, {
  type StateCollectedREA,
  type StateOrVal,
  type StateREA,
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

/**The value of a result, the fallback for an error*/
export const value_or = <T>(result: Result<T, unknown>, fallback: T): T =>
  result.ok ? result.value : fallback;

/**A collected state of a node element, its states are set again when the children of the node change*/
export type Collected<T> = StateCollectedREA<T, StateREA<any>[]>;
export const collect = <T>(
  transform: (values: Result<any, unknown>[]) => T,
  first: StateREA<any>,
): Collected<T> =>
  state.c.rea<T, StateREA<any>[]>((values) => ok(transform(values)), first);
