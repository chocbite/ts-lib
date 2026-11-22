import { number_step_start_decimal } from "#math";
import { ok, OptionSome, ResultOk, some, err_nice } from "#result";
import { state_errors } from "../errors";
import { COLLECTED } from "../collected";
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

//##################################################################################################################################################
//       _____ ____  _      _      ______ _____ _______ ______ _____
//      / ____/ __ \| |    | |    |  ____/ ____|__   __|  ____|  __ \
//     | |   | |  | | |    | |    | |__ | |       | |  | |__  | |  | |
//     | |   | |  | | |    | |    |  __|| |       | |  |  __| | |  | |
//     | |___| |__| | |____| |____| |___| |____   | |  | |____| |__| |
//      \_____\____/|______|______|______\_____|  |_|  |______|_____/

/**The sum of the values*/
const sum = (values: readonly number[]): number => {
  let total = 0;
  for (const value of values) total += value;
  return total;
};
/**The sum of ok results*/
const sum_ok = (values: readonly ResultOk<number>[]): ResultOk<number> => {
  let total = 0;
  for (const value of values) total += value.value;
  return ok(total);
};
/**How many percent part is of total, a total of 0 is taken as 1*/
const percentage = (total: number, part: number): number =>
  (part / (total === 0 ? 1 : total)) * 100;

export const COLLECTS_NUMBER = {
  //Calculates the sum of all the states
  sum: {
    rea<S extends State<number>[]>(...states: S) {
      return COLLECTED.rea_map<number, S>((values) => sum(values), ...states);
    },
    roa<S extends [StateROA<number>, ...StateROA<number>[]]>(...states: S) {
      return COLLECTED.roa<number, S>(
        (values) => sum_ok(values),
        ...states,
      );
    },
    res<S extends StateRES<number>[]>(...states: S) {
      return COLLECTED.res_map<number, S>((values) => sum(values), ...states);
    },
    ros<S extends [StateROS<number>, ...StateROS<number>[]]>(...states: S) {
      return COLLECTED.ros<number, S>(
        (values) => sum_ok(values),
        ...states,
      );
    },
  },
  //Calculates how many percent the second state is of the first state
  percentage: {
    rea<S extends State<number>, T extends State<number>>(st1: S, st2: T) {
      return COLLECTED.rea_map<number, [S, T]>(
        ([total, part]) => percentage(total, part),
        st1,
        st2,
      );
    },
    roa<S extends StateROA<number>, T extends StateROA<number>>(st1: S, st2: T) {
      return COLLECTED.roa<number, [S, T]>(
        ([total, part]) => ok(percentage(total.value, part.value)),
        st1,
        st2,
      );
    },
    res<S extends StateRES<number>, T extends StateRES<number>>(st1: S, st2: T) {
      return COLLECTED.res_map<number, [S, T]>(
        ([total, part]) => percentage(total, part),
        st1,
        st2,
      );
    },
    ros<S extends StateROS<number>, T extends StateROS<number>>(st1: S, st2: T) {
      return COLLECTED.ros<number, [S, T]>(
        ([total, part]) => ok(percentage(total.value, part.value)),
        st1,
        st2,
      );
    },
  },
};

//##################################################################################################################################################
//      _    _ ______ _      _____  ______ _____
//     | |  | |  ____| |    |  __ \|  ____|  __ \
//     | |__| | |__  | |    | |__) | |__  | |__) |
//     |  __  |  __| | |    |  ___/|  __| |  _  /
//     | |  | | |____| |____| |    | |____| | \ \
//     |_|  |_|______|______|_|    |______|_|  \_\

export const STATE_NUMBER_RELATED_KEY = Symbol("state_number_related");
export const STATE_NUMBER_HELPER_KEY = Symbol("state_number_helper");

export interface StateNumberRelated extends StateRelatedBase {
  readonly [STATE_NUMBER_RELATED_KEY]: true;
  min?: State<number>;
  max?: State<number>;
  unit?: State<string>;
  decimals?: State<number>;
  step?: State<number>;
  start?: State<number>;
}

export interface StateNumberHelperOptions extends StateHelperBaseOptions {
  /** min minimum allowed number */
  min?: State<number>;
  /** max maximum allowed number */
  max?: State<number>;
  /** unit unit for number */
  unit?: State<string>;
  /** decimals number of suggested decimals to show */
  decimals?: State<number>;
  /** step allowed step size for number 0.1 allows 0,0.1,0.2,0.3... */
  step?: State<number>;
  /** start start offset for step, 0.5 and step 2 allows 0.5,2.5,4.5,6.5 */
  start?: State<number>;
}

export interface StateNumberHelper extends StateHelperBase<
  SR<number>,
  number,
  OptionSome<StateNumberRelated>
> {}

export class StateNumberHelperBase
  extends StateHelperBase<SR<number>, number, OptionSome<StateNumberRelated>>
  implements StateNumberRelated
{
  get [STATE_NUMBER_RELATED_KEY](): true {
    return true;
  }
  get [STATE_NUMBER_HELPER_KEY](): true {
    return true;
  }

  readonly min?: State<number>;
  readonly max?: State<number>;
  readonly unit?: State<string>;
  readonly decimals?: State<number>;
  readonly step?: State<number>;
  readonly start?: State<number>;

  constructor(options: StateNumberHelperOptions) {
    super();
    if (options.min) this.min = options.min;
    if (options.max) this.max = options.max;
    if (options.unit) this.unit = options.unit;
    if (options.step) this.step = options.step;
    if (options.start) this.start = options.start;
    if (options.decimals) this.decimals = options.decimals;
  }

  async limit(value: number): Promise<SR<number>> {
    const [min, max, step, start, decimals] = await Promise.all([
      this.min?.read(),
      this.max?.read(),
      this.step?.read(),
      this.start?.read(),
      this.decimals?.read(),
    ]);
    return ok(
      Math.min(
        max?.unwrap_or(Infinity) ?? Infinity,
        Math.max(
          min?.unwrap_or(-Infinity) ?? -Infinity,
          number_step_start_decimal(
            value,
            step?.unwrap_or(undefined),
            start?.unwrap_or(undefined),
            decimals?.unwrap_or(undefined),
          ),
        ),
      ),
    );
  }

  async check(value: number): Promise<SR<number>> {
    const [min, max, step, start, decimals] = await Promise.all([
      this.min?.read(),
      this.max?.read(),
      this.step?.read(),
      this.start?.read(),
      this.decimals?.read(),
    ]);
    if (max?.ok && value > max.value)
      return err_nice(state_errors.ABOVE_MAX, value + " is bigger than the limit of " + max.value);
    if (min?.ok && value < min.value)
      return err_nice(state_errors.BELOW_MIN, value + " is smaller than the limit of " + min.value);
    //limit clamps to min and max after snapping to step, so those are valid even when not on a step
    if (value === max?.unwrap_or(undefined) || value === min?.unwrap_or(undefined))
      return ok(value);
    const step_val = step?.unwrap_or(undefined);
    const start_val = start?.unwrap_or(undefined);
    const decimals_val = decimals?.unwrap_or(undefined);
    const snapped = number_step_start_decimal(
      value,
      step_val,
      start_val,
      decimals_val,
    );
    //Tiny differences are floating point noise, like 0.1 + 0.2, so they are accepted
    if (Math.abs(snapped - value) > 1e-9 * Math.max(1, Math.abs(value))) {
      if (step_val)
        return err_nice(
          state_errors.OFF_STEP,
          value +
            " is not on a step of " +
            step_val +
            (start_val ? " starting from " + start_val : ""),
        );
      return err_nice(state_errors.TOO_MANY_DECIMALS, value + " has more than " + decimals_val + " decimals");
    }
    return ok(snapped);
  }

  related(): OptionSome<StateNumberRelated> {
    return some(this);
  }
}

//##################################################################################################################################################
//      ________   _______   ____  _____ _______ _____
//     |  ____\ \ / /  __ \ / __ \|  __ \__   __/ ____|
//     | |__   \ V /| |__) | |  | | |__) | | | | (___
//     |  __|   > < |  ___/| |  | |  _  /  | |  \___ \
//     | |____ / . \| |    | |__| | | \ \  | |  ____) |
//     |______/_/ \_\_|     \____/|_|  \_\ |_| |_____/

export const NUMBER = {
  /**Number related state collectors */
  collects: COLLECTS_NUMBER,
  /**Number related state collectors */
  c: COLLECTS_NUMBER,
  /**Unique key to check if object is a number related */
  RELATED_KEY: STATE_NUMBER_RELATED_KEY,
  /**Returns true if object is a number related */
  is_related(r: any): r is StateNumberRelated {
    return Boolean(
      r &&
      (r as { [STATE_NUMBER_RELATED_KEY]: boolean })[STATE_NUMBER_RELATED_KEY],
    );
  },
  /**Unique key to check if object is a number helper */
  HELPER_KEY: STATE_NUMBER_HELPER_KEY,
  /**Returns true if object is a number helper */
  is_helper(h: any): h is StateNumberHelperBase {
    return Boolean(
      h &&
      (h as { [STATE_NUMBER_HELPER_KEY]: boolean })[STATE_NUMBER_HELPER_KEY],
    );
  },
  /**Number helper*/
  help<I extends Init<number>>(
    init: I,
    options: StateNumberHelperOptions,
  ): [I, StateNumberHelper] {
    return [init, new StateNumberHelperBase(options)];
  },
};
