import { Option, OptionNone } from "#result";
import {
  StateResult as SR,
  StateHelper,
  StateRelated,
  type State,
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

export interface StateRelatedBase extends StateRelated {
  writable?: State<boolean>;
}

export interface StateHelperBaseOptions {
  writable?: State<boolean>;
}

export abstract class StateHelperBase<
  RRT extends SR<any>,
  WT,
  REL extends Option<StateRelatedBase>,
>
  implements StateHelper<RRT, WT, REL>, StateRelatedBase
{
  readonly writable?: State<boolean>;

  constructor(options?: StateHelperBaseOptions) {
    if (options?.writable) this.writable = options.writable;
  }

  /**Called by state when value is set */
  on_change(_value: RRT): void {}

  abstract related(): REL;

  abstract limit(value: WT): PromiseLike<SR<WT>>;

  abstract check(value: WT): PromiseLike<SR<WT>>;
}

export type StateNoHelper = StateHelper<any, any, OptionNone>;
