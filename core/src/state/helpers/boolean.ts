import { sync_resolve } from "#common";
import { ok, OptionSome, some } from "#result";
import { StateResult as SR } from "../types";
import {
  StateInit as Init,
  StateHelperBase,
  StateHelperBaseOptions,
  StateRelatedBase,
} from "./helpers";

export const STATE_BOOL_RELATED_KEY = Symbol("state_bool_related");
export const STATE_BOOL_HELPER_KEY = Symbol("state_bool_helper");

export interface StateBoolRelated extends StateRelatedBase {
  readonly [STATE_BOOL_RELATED_KEY]: true;
}

export interface StateBoolHelperOptions extends StateHelperBaseOptions {}

export interface StateBoolHelper extends StateHelperBase<
  SR<boolean>,
  boolean,
  OptionSome<StateBoolRelated>
> {}

export class StateBoolHelperBase
  extends StateHelperBase<SR<boolean>, boolean, OptionSome<StateBoolRelated>>
  implements StateBoolRelated
{
  get [STATE_BOOL_RELATED_KEY](): true {
    return true;
  }
  get [STATE_BOOL_HELPER_KEY](): true {
    return true;
  }

  limit(value: boolean): PromiseLike<SR<boolean>> {
    return sync_resolve(ok(value));
  }

  check(value: boolean): PromiseLike<SR<boolean>> {
    return this.check_writable(value);
  }

  related(): OptionSome<StateBoolRelated> {
    return some(this);
  }
}

export const BOOL = {
  /**Returns true if object is a boolean related */
  is_related(r: any): r is StateBoolRelated {
    return Boolean(
      r && (r as { [STATE_BOOL_RELATED_KEY]: boolean })[STATE_BOOL_RELATED_KEY],
    );
  },
  /**Returns true if object is a boolean helper */
  is_helper(h: any): h is StateBoolHelperBase {
    return Boolean(
      h && (h as { [STATE_BOOL_HELPER_KEY]: boolean })[STATE_BOOL_HELPER_KEY],
    );
  },
  /**Boolean helper*/
  help<I extends Init<boolean>>(
    init: I,
    options?: StateBoolHelperOptions,
  ): [I, StateBoolHelper] {
    return [init, new StateBoolHelperBase(options)];
  },
};
