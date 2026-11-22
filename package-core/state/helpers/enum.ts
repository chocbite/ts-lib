import { sync_resolve } from "#common";
import { err, ok, OptionSome, some, err_nice } from "#result";
import { state_errors } from "../errors";
import type { StateResult as SR, State, StateHelperSync, StateRES } from "../types";
import {
  StateInit as Init,
  sync_get,
  StateHelperBase,
  StateHelperBaseOptions,
  StateRelatedBase,
} from "./helpers";

export const STATE_ENUM_RELATED_KEY = Symbol("state_enum_related");
export const STATE_ENUM_HELPER_KEY = Symbol("state_enum_helper");

declare global {
  /**Extended by @chocbite/ts-lib-ui to type enum icons as SVGFunc.
   * Without ts-lib-ui no icon can be given.*/
  interface ChocbiteStateRegister {}
}

type StateEnumIcon = ChocbiteStateRegister extends { icon: infer I }
  ? I
  : never;

type EnumHelperEntry = {
  name: string;
  description?: string;
  icon?: StateEnumIcon;
};

/**Keys are strings only, object keys are always strings at runtime, a number key would come back as a string*/
type StateEnumHelperList<T extends string> = {
  [P in T]: EnumHelperEntry;
};

export interface StateEnumRelated<
  L extends StateEnumHelperList<string> = StateEnumHelperList<string>,
> extends StateRelatedBase {
  readonly [STATE_ENUM_RELATED_KEY]: true;
  list: State<L, any, any>;
}

export interface StateEnumHelperOptions<
  L extends StateEnumHelperList<any> = StateEnumHelperList<any>,
> extends StateHelperBaseOptions {
  list: State<L, any, any>;
}

export interface StateEnumHelper<
  L extends StateEnumHelperList<string> = StateEnumHelperList<string>,
  K extends string = keyof L & string,
  R extends StateRelatedBase = StateEnumRelated<L>,
> extends StateHelperBase<SR<K>, K, OptionSome<R>> {}

/**Options of an enum helper that checks synchronously, its list is a sync state*/
export interface StateEnumHelperSyncOptions<
  L extends StateEnumHelperList<any> = StateEnumHelperList<any>,
> extends StateEnumHelperOptions<L> {
  list: StateRES<L, any, any>;
}

/**An enum helper that also checks synchronously, what help gives when its list is a sync state*/
export interface StateEnumHelperSync<
  L extends StateEnumHelperList<string> = StateEnumHelperList<string>,
  K extends string = keyof L & string,
  R extends StateRelatedBase = StateEnumRelated<L>,
> extends StateEnumHelper<L, K, R>,
    StateHelperSync<SR<K>, K, OptionSome<R>> {}

/**The value when it is in the list, otherwise the reason it is not*/
function enum_check<K extends string>(
  value: K,
  list: SR<StateEnumHelperList<string>>,
): SR<K> {
  //The reason the list is missing is what the user needs to see
  if (list.err) return err(list.error);
  if (value in list.value) return ok(value);
  return err_nice(state_errors.NOT_IN_LIST, String(value) + " is not in list");
}

/**Creates an enum helper struct, use list method to make a list with correct typing.
 * It also checks synchronously when its list is a sync state*/
function help<
  L extends StateEnumHelperList<any>,
  I extends Init<K>,
  K extends string = keyof L & string,
  R extends StateRelatedBase = StateEnumRelated<L>,
>(init: I, options: StateEnumHelperSyncOptions<L>): [I, StateEnumHelperSync<L, K, R>];
function help<
  L extends StateEnumHelperList<any>,
  I extends Init<K>,
  K extends string = keyof L & string,
  R extends StateRelatedBase = StateEnumRelated<L>,
>(init: I, options: StateEnumHelperOptions<L>): [I, StateEnumHelper<L, K, R>];
function help(
  init: Init<string>,
  options: StateEnumHelperOptions,
): [Init<string>, StateEnumHelperSync] {
  return [init, new StateEnumHelperBase(options)];
}

export class StateEnumHelperBase<
  L extends StateEnumHelperList<string> = StateEnumHelperList<string>,
  K extends string = keyof L & string,
  R extends StateRelatedBase = StateEnumRelated<L>,
>
  extends StateHelperBase<SR<K>, K, OptionSome<R>>
  implements StateEnumRelated<L>
{
  get [STATE_ENUM_RELATED_KEY](): true {
    return true;
  }
  get [STATE_ENUM_HELPER_KEY](): true {
    return true;
  }

  readonly list: State<L, any, any>;

  constructor(options: StateEnumHelperOptions<L>) {
    super();
    this.list = options.list;
  }

  limit(value: K): PromiseLike<SR<K>> {
    return sync_resolve(ok(value));
  }

  async check(value: K): Promise<SR<K>> {
    return enum_check(value, await this.list.read());
  }
  limit_sync(value: K): SR<K> {
    return ok(value);
  }
  /**Only for a sync helper, see StateEnumHelperSync*/
  check_sync(value: K): SR<K> {
    return enum_check(value, sync_get(this.list)!);
  }

  related(): OptionSome<R> {
    return some(this as unknown as R);
  }
}

export const ENUM = {
  /**Unique key to check if object is a enum related */
  RELATED_KEY: STATE_ENUM_RELATED_KEY,
  /**Returns true if object is a enum related */
  is_related(r: any): r is StateEnumRelated {
    return Boolean(
      r && (r as { [STATE_ENUM_RELATED_KEY]: boolean })[STATE_ENUM_RELATED_KEY],
    );
  },
  /**Unique key to check if object is a enum helper */
  HELPER_KEY: STATE_ENUM_HELPER_KEY,
  /**Returns true if object is a enum helper */
  is_helper(h: any): h is StateEnumHelperBase {
    return Boolean(
      h && (h as { [STATE_ENUM_HELPER_KEY]: boolean })[STATE_ENUM_HELPER_KEY],
    );
  },
  /**Creates an enum helper struct, use list method to make a list with correct typing.
   * It also checks synchronously when its list is a sync state*/
  help,
  /**Creates an enum description list, passing the enum as a generic type to this function makes things look a bit nicer */
  list<K extends string>(list: StateEnumHelperList<K>): typeof list {
    return list;
  },
  /**Maps over an enum description list
   * @param list enum description list
   * @param func function to apply to each entry
   * @returns array of results*/
  map<K extends string, R>(
    list: StateEnumHelperList<K>,
    func: (key: K, val: EnumHelperEntry) => R,
  ): R[] {
    return Object.keys(list).map((key) => func(key as K, list[key as K]));
  },
};
