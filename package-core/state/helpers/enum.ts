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

/**Only the keys of the list itself, a key every object has, like toString, is not in the list*/
const in_list = (key: string, list: StateEnumHelperList<string>): boolean =>
  Object.hasOwn(list, key);

/**The value when it is in the list, otherwise the reason it is not*/
function enum_check<K extends string>(
  value: K,
  list: SR<StateEnumHelperList<string>>,
): SR<K> {
  //The reason the list is missing is what the user needs to see
  if (list.err) return err(list.error);
  if (in_list(value, list.value)) return ok(value);
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

//##################################################################################################################################################
//      __  __ _    _ _   _______ _____
//     |  \/  | |  | | | |__   __|_   _|
//     | \  / | |  | | |    | |    | |
//     | |\/| | |  | | |    | |    | |
//     | |  | | |__| | |____| |   _| |_
//     |_|  |_|\____/|______|_|  |_____|

export const STATE_ENUM_MULTI_RELATED_KEY = Symbol("state_enum_multi_related");
export const STATE_ENUM_MULTI_HELPER_KEY = Symbol("state_enum_multi_helper");

/**Related states of a state holding several values of an enum list, like the choices of a multi select*/
export interface StateEnumMultiRelated<
  L extends StateEnumHelperList<string> = StateEnumHelperList<string>,
> extends StateRelatedBase {
  readonly [STATE_ENUM_MULTI_RELATED_KEY]: true;
  /**The values that can be in the value*/
  list: State<L, any, any>;
  /**Fewest values the value can have*/
  min?: State<number>;
  /**Most values the value can have*/
  max?: State<number>;
}

export interface StateEnumMultiHelperOptions<
  L extends StateEnumHelperList<any> = StateEnumHelperList<any>,
> extends StateHelperBaseOptions {
  /**The values that can be in the value*/
  list: State<L, any, any>;
  /**Fewest values the value can have, not given none*/
  min?: State<number>;
  /**Most values the value can have, not given any number*/
  max?: State<number>;
}

/**Options of an enum multi helper that checks synchronously, its list, min and max are sync states*/
export interface StateEnumMultiHelperSyncOptions<
  L extends StateEnumHelperList<any> = StateEnumHelperList<any>,
> extends StateEnumMultiHelperOptions<L> {
  list: StateRES<L, any, any>;
  min?: StateRES<number>;
  max?: StateRES<number>;
}

export interface StateEnumMultiHelper<
  L extends StateEnumHelperList<string> = StateEnumHelperList<string>,
  K extends string = keyof L & string,
> extends StateHelperBase<SR<K[]>, K[], OptionSome<StateEnumMultiRelated<L>>> {}

/**An enum multi helper that also checks synchronously, what help_multi gives when its list, min and max are sync states*/
export interface StateEnumMultiHelperSync<
  L extends StateEnumHelperList<string> = StateEnumHelperList<string>,
  K extends string = keyof L & string,
> extends StateEnumMultiHelper<L, K>,
    StateHelperSync<SR<K[]>, K[], OptionSome<StateEnumMultiRelated<L>>> {}

/**The results of the list, min and max, undefined for min and max not given*/
type EnumMultiLimits = [
  SR<StateEnumHelperList<string>>,
  SR<number> | undefined,
  SR<number> | undefined,
];

/**How many values there are, as the start of a sentence*/
const values_are = (count: number): string =>
  count === 1 ? "1 value is" : count + " values are";

/**The value when every value in it is in the list once and the count is within min and max, otherwise the reason it is not*/
function enum_multi_check<K extends string>(
  value: K[],
  [list, min, max]: EnumMultiLimits,
): SR<K[]> {
  //The reason the list is missing is what the user needs to see
  if (list.err) return err(list.error);
  const seen = new Set<string>();
  for (const key of value) {
    if (!in_list(key, list.value))
      return err_nice(state_errors.NOT_IN_LIST, String(key) + " is not in list");
    if (seen.has(key))
      return err_nice(state_errors.DUPLICATE_VALUE, String(key) + " is given twice");
    seen.add(key);
  }
  if (max?.ok && value.length > max.value)
    return err_nice(
      state_errors.TOO_MANY_VALUES,
      values_are(value.length) + " more than the limit of " + max.value,
    );
  if (min?.ok && value.length < min.value)
    return err_nice(
      state_errors.TOO_FEW_VALUES,
      values_are(value.length) + " fewer than the limit of " + min.value,
    );
  return ok(value);
}

/**The value without values not in the list or given twice, and only the first ones up to max
 * Too few values stay too few, nothing can be added. The same array when nothing is dropped*/
function enum_multi_limit<K extends string>(
  value: K[],
  [list, , max]: EnumMultiLimits,
): SR<K[]> {
  const most = max?.ok ? max.value : Infinity;
  const seen = new Set<string>();
  const limited: K[] = [];
  for (const key of value) {
    if (limited.length >= most) break;
    //While the list is in error every value is kept, check gives the error
    if (seen.has(key) || (list.ok && !in_list(key, list.value))) continue;
    seen.add(key);
    limited.push(key);
  }
  return ok(limited.length === value.length ? value : limited);
}

/**Creates an enum multi helper, for a state holding several values of an enum list, use list method to make a list with correct typing.
 * It also checks synchronously when its list, min and max are sync states*/
function help_multi<
  L extends StateEnumHelperList<any>,
  I extends Init<K[]>,
  K extends string = keyof L & string,
>(
  init: I,
  options: StateEnumMultiHelperSyncOptions<L>,
): [I, StateEnumMultiHelperSync<L, K>];
function help_multi<
  L extends StateEnumHelperList<any>,
  I extends Init<K[]>,
  K extends string = keyof L & string,
>(
  init: I,
  options: StateEnumMultiHelperOptions<L>,
): [I, StateEnumMultiHelper<L, K>];
function help_multi(
  init: Init<string[]>,
  options: StateEnumMultiHelperOptions,
): [Init<string[]>, StateEnumMultiHelperSync] {
  return [init, new StateEnumMultiHelperBase(options)];
}

export class StateEnumMultiHelperBase<
  L extends StateEnumHelperList<string> = StateEnumHelperList<string>,
  K extends string = keyof L & string,
>
  extends StateHelperBase<SR<K[]>, K[], OptionSome<StateEnumMultiRelated<L>>>
  implements StateEnumMultiRelated<L>
{
  get [STATE_ENUM_MULTI_RELATED_KEY](): true {
    return true;
  }
  get [STATE_ENUM_MULTI_HELPER_KEY](): true {
    return true;
  }

  readonly list: State<L, any, any>;
  readonly min?: State<number>;
  readonly max?: State<number>;

  constructor(options: StateEnumMultiHelperOptions<L>) {
    super();
    this.list = options.list;
    if (options.min) this.min = options.min;
    if (options.max) this.max = options.max;
  }

  /**The current results of the list, min and max, the async methods wait for them*/
  #read(): Promise<EnumMultiLimits> {
    return Promise.all([this.list.read(), this.min?.read(), this.max?.read()]);
  }
  /**The current results of the list, min and max, only for a sync helper, whose states are sync*/
  #get(): EnumMultiLimits {
    return [sync_get(this.list)!, sync_get(this.min), sync_get(this.max)];
  }

  async limit(value: K[]): Promise<SR<K[]>> {
    return enum_multi_limit(value, await this.#read());
  }
  async check(value: K[]): Promise<SR<K[]>> {
    return enum_multi_check(value, await this.#read());
  }
  /**Only for a sync helper, see StateEnumMultiHelperSync*/
  limit_sync(value: K[]): SR<K[]> {
    return enum_multi_limit(value, this.#get());
  }
  /**Only for a sync helper, see StateEnumMultiHelperSync*/
  check_sync(value: K[]): SR<K[]> {
    return enum_multi_check(value, this.#get());
  }

  related(): OptionSome<StateEnumMultiRelated<L>> {
    return some(this);
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
  /**Unique key to check if object is a enum multi related */
  MULTI_RELATED_KEY: STATE_ENUM_MULTI_RELATED_KEY,
  /**Returns true if object is a enum multi related, the related of a state holding several values of a list*/
  is_multi_related(r: any): r is StateEnumMultiRelated {
    return Boolean(
      r &&
      (r as { [STATE_ENUM_MULTI_RELATED_KEY]: boolean })[
        STATE_ENUM_MULTI_RELATED_KEY
      ],
    );
  },
  /**Unique key to check if object is a enum multi helper */
  MULTI_HELPER_KEY: STATE_ENUM_MULTI_HELPER_KEY,
  /**Returns true if object is a enum multi helper */
  is_multi_helper(h: any): h is StateEnumMultiHelperBase {
    return Boolean(
      h &&
      (h as { [STATE_ENUM_MULTI_HELPER_KEY]: boolean })[
        STATE_ENUM_MULTI_HELPER_KEY
      ],
    );
  },
  /**Creates an enum multi helper, for a state holding several values of an enum list, like the choices of a multi select.
   * Every value must be in the list once, and the count within min and max.
   * It also checks synchronously when its list, min and max are sync states*/
  help_multi,
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
