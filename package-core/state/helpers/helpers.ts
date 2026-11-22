import { Option, OptionNone } from "#result";
import type {
  State,
  StateHelper,
  StateHelperSync,
  StateRelated,
  StateRES,
  StateResult as SR,
} from "../types";

export type StateInit<T = any> =
  | SR<T>
  | (() => SR<T>)
  | (() => PromiseLike<SR<T>>)
  | undefined;

export type StateInitResult<T> = T extends () => PromiseLike<infer R>
  ? R
  : T extends () => infer R
    ? R
    : T extends SR<any>
      ? T
      : never;

export interface StateRelatedBase extends StateRelated {}

export interface StateHelperBaseOptions {}

export abstract class StateHelperBase<
  RRT extends SR<any>,
  WT,
  REL extends Option<StateRelatedBase>,
>
  implements StateHelper<RRT, WT, REL>, StateRelatedBase
{
  /**Called by state when value is set */
  on_change(_value: RRT): void {}

  abstract related(): REL;

  abstract limit(value: WT): PromiseLike<SR<WT>>;

  abstract check(value: WT): PromiseLike<SR<WT>>;
}

export type StateNoHelper = StateHelper<any, any, OptionNone>;

/**No helper, for states with sync writes*/
export type StateNoHelperSync = StateHelperSync<any, any, OptionNone>;

/**The current result of a limit state of a helper, for the sync checks of helpers whose limit states are sync*/
export function sync_get<T>(state: State<T> | undefined): SR<T> | undefined {
  return (state as StateRES<T> | undefined)?.get();
}
