import { ok, OptionSome, some, err_nice, type ResultOk } from "#result";
import { COLLECTED } from "../collected";
import { state_errors } from "../errors";
import {
  StateResult as SR,
  State,
  StateRES,
  StateROA,
  StateROS,
} from "../types";
import {
  StateInit as Init,
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

  async limit(value: string): Promise<SR<string>> {
    const [max_length, max_length_bytes] = await Promise.all([
      this.max_length?.read(),
      this.max_length_bytes?.read(),
    ]);
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
  async check(value: string): Promise<SR<string>> {
    const [max_length, max_length_bytes] = await Promise.all([
      this.max_length?.read(),
      this.max_length_bytes?.read(),
    ]);
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
  /**String helper*/
  help<I extends Init<string>>(
    init: I,
    options: StateStringHelperOptions,
  ): [I, StateStringHelper] {
    return [init, new StateStringHelperBase(options)];
  },
};
