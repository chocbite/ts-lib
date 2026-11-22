import { ok, OptionSome, some, err_nice, type ResultOk } from "#result";
import { COLLECTED } from "../collected";
import { state_errors } from "../errors";
import {
  StateResult as SR,
  State,
  type StateHelperSync,
  StateRES,
  StateROA,
  StateROS,
} from "../types";
import {
  StateInit as Init,
  sync_get,
  StateHelperBase,
  StateHelperBaseOptions,
  StateRelatedBase,
} from "./helpers";

export const STATE_STRING_RELATED_KEY = Symbol("state_string_related");
export const STATE_STRING_HELPER_KEY = Symbol("state_string_helper");

export interface StateStringRelated extends StateRelatedBase {
  readonly [STATE_STRING_RELATED_KEY]: true;
  max_length?: State<number>;
  max_length_bytes?: State<number>;
}

export interface StateStringHelperOptions extends StateHelperBaseOptions {
  /**max length for string */
  max_length?: State<number>;
  /**max byte length for string */
  max_length_bytes?: State<number>;
}

export interface StateStringHelper extends StateHelperBase<
  SR<string>,
  string,
  OptionSome<StateStringRelated>
> {}

/**Options of a string helper that checks synchronously, every state it checks with is sync*/
export interface StateStringHelperSyncOptions extends StateStringHelperOptions {
  max_length?: StateRES<number>;
  max_length_bytes?: StateRES<number>;
}

/**A string helper that also checks synchronously, what help gives when every state it checks with is sync*/
export interface StateStringHelperSync
  extends StateStringHelper,
    StateHelperSync<SR<string>, string, OptionSome<StateStringRelated>> {}

/**The results of max_length and max_length_bytes, undefined for those not given*/
type StringLimits = [SR<number> | undefined, SR<number> | undefined];

/**The text shortened to the limits*/
function string_limit(
  value: string,
  [max_length, max_length_bytes]: StringLimits,
): SR<string> {
  if (max_length?.ok && value.length > max_length.value)
    value = value.slice(0, max_length.value);
  if (max_length_bytes?.ok) {
    value = new TextDecoder().decode(
      new TextEncoder().encode(value).slice(0, max_length_bytes.value),
    );
    if (value.at(-1)?.charCodeAt(0) === 65533) value = value.slice(0, -1);
  }
  return ok(value);
}

/**The text when it is within the limits, otherwise the reason it is not*/
function string_check(
  value: string,
  [max_length, max_length_bytes]: StringLimits,
): SR<string> {
  if (max_length?.ok && value.length > max_length.value)
    return err_nice(
      state_errors.TEXT_TOO_LONG,
      "the text is longer than the limit of " +
        max_length.value +
        " characters",
    );
  if (
    max_length_bytes?.ok &&
    new TextEncoder().encode(value).length > max_length_bytes.value
  )
    return err_nice(
      state_errors.TEXT_TOO_LONG,
      "the text is longer than the limit of " +
        max_length_bytes.value +
        " bytes",
    );
  return ok(value);
}

export class StateStringHelperBase
  extends StateHelperBase<SR<string>, string, OptionSome<StateStringRelated>>
  implements StateStringRelated
{
  get [STATE_STRING_RELATED_KEY](): true {
    return true;
  }
  get [STATE_STRING_HELPER_KEY](): true {
    return true;
  }

  max_length?: State<number>;
  max_length_bytes?: State<number>;
  constructor(options: StateStringHelperOptions) {
    super();
    if (options.max_length) this.max_length = options.max_length;
    if (options.max_length_bytes)
      this.max_length_bytes = options.max_length_bytes;
  }

  /**The current results of the limit states, the async methods wait for them*/
  #read(): Promise<StringLimits> {
    return Promise.all([this.max_length?.read(), this.max_length_bytes?.read()]);
  }
  /**The current results of the limit states, only for a sync helper, whose limit states are sync*/
  #get(): StringLimits {
    return [sync_get(this.max_length), sync_get(this.max_length_bytes)];
  }

  async limit(value: string): Promise<SR<string>> {
    return string_limit(value, await this.#read());
  }
  async check(value: string): Promise<SR<string>> {
    return string_check(value, await this.#read());
  }
  /**Only for a sync helper, see StateStringHelperSync*/
  limit_sync(value: string): SR<string> {
    return string_limit(value, this.#get());
  }
  /**Only for a sync helper, see StateStringHelperSync*/
  check_sync(value: string): SR<string> {
    return string_check(value, this.#get());
  }
  related(): OptionSome<StateStringRelated> {
    return some(this);
  }
}

//##################################################################################################################################################
//       _____ ____  _      _      ______ _____ _______ ______ _____
//      / ____/ __ \| |    | |    |  ____/ ____|__   __|  ____|  __ \
//     | |   | |  | | |    | |    | |__ | |       | |  | |__  | |  | |
//     | |   | |  | | |    | |    |  __|| |       | |  |  __| | |  | |
//     | |___| |__| | |____| |____| |___| |____   | |  | |____| |__| |
//      \_____\____/|______|______|______\_____|  |_|  |______|_____/

/**The values joined*/
const concat = (values: readonly string[]): string => values.join("");
/**The values of ok results joined*/
const concat_ok = (values: readonly ResultOk<string>[]): ResultOk<string> => {
  let text = "";
  for (const value of values) text += value.value;
  return ok(text);
};

export const COLLECTS_STRING = {
  //Joins the strings of all the states, without a separator
  concat: {
    rea<S extends State<string>[]>(...states: S) {
      return COLLECTED.rea_map<string, S>(
        (values) => concat(values),
        ...states,
      );
    },
    roa<S extends [StateROA<string>, ...StateROA<string>[]]>(...states: S) {
      return COLLECTED.roa<string, S>((values) => concat_ok(values), ...states);
    },
    res<S extends StateRES<string>[]>(...states: S) {
      return COLLECTED.res_map<string, S>(
        (values) => concat(values),
        ...states,
      );
    },
    ros<S extends [StateROS<string>, ...StateROS<string>[]]>(...states: S) {
      return COLLECTED.ros<string, S>((values) => concat_ok(values), ...states);
    },
  },
};

export const STRING = {
  /**String related state collectors */
  collects: COLLECTS_STRING,
  /**String related state collectors */
  c: COLLECTS_STRING,
  /**Unique key to check if object is a string related */
  RELATED_KEY: STATE_STRING_RELATED_KEY,
  /**Returns true if object is a string related */
  is_related(r: any): r is StateStringRelated {
    return Boolean(
      r &&
      (r as { [STATE_STRING_RELATED_KEY]: boolean })[STATE_STRING_RELATED_KEY],
    );
  },
  /**Unique key to check if object is a string helper */
  HELPER_KEY: STATE_STRING_HELPER_KEY,
  /**Returns true if object is a string helper */
  is_helper(h: any): h is StateStringHelperBase {
    return Boolean(
      h &&
      (h as { [STATE_STRING_HELPER_KEY]: boolean })[STATE_STRING_HELPER_KEY],
    );
  },
  /**String helper, it also checks synchronously when max_length and max_length_bytes are sync states*/
  help<I extends Init<string>, O extends StateStringHelperOptions>(
    init: I,
    options: O,
  ): [
    I,
    O extends StateStringHelperSyncOptions ? StateStringHelperSync : StateStringHelper,
  ] {
    return [init, new StateStringHelperBase(options)];
  },
};
