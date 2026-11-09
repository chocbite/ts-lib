import { number_step_start_decimal } from "#math";
import { err, ok, OptionSome, ResultOk, some } from "#result";
import {
  COLLECTED,
  StateCollectedREA,
  StateCollectedRES,
  StateCollectedROA,
  StateCollectedROS,
} from "../collected";
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

//##################################################################################################################################################
//       _____ _    _ __  __
//      / ____| |  | |  \/  |
//     | (___ | |  | | \  / |
//      \___ \| |  | | |\/| |
//      ____) | |__| | |  | |
//     |_____/ \____/|_|  |_|
class NumberSumREA<S extends State<number>[]> extends COLLECTED.class<
  number,
  S,
  number,
  SR<number>
> {
  constructor(...states: S) {
    super(false, false, false, ...states);
  }
  protected getter(values: SR<number>[]): SR<number> {
    let sum = 0;
    for (const val of values) {
      if (val.err) return val;
      sum += val.value;
    }
    return ok(sum);
  }
}

//##################################################################################################################################################
class NumberSumROA<
  S extends [StateROA<number>, ...StateROA<number>[]],
> extends COLLECTED.class<number, S, number, ResultOk<number>> {
  constructor(...states: S) {
    super(true, false, false, ...states);
  }
  protected getter(values: ResultOk<number>[]): ResultOk<number> {
    return ok(values.reduce((acc, val) => acc + val.value, 0));
  }
}

//##################################################################################################################################################
class NumberSumRES<S extends StateRES<number>[]> extends COLLECTED.class<
  number,
  S,
  number,
  SR<number>
> {
  constructor(...states: S) {
    super(false, true, false, ...states);
  }
  protected getter(values: SR<number>[]): SR<number> {
    let sum = 0;
    for (const val of values) {
      if (val.err) return val;
      sum += val.value;
    }
    return ok(sum);
  }
}

//##################################################################################################################################################
class NumberSumROS<
  S extends [StateROS<number>, ...StateROS<number>[]],
> extends COLLECTED.class<number, S, number, ResultOk<number>> {
  constructor(...states: S) {
    super(true, true, false, ...states);
  }
  protected getter(values: ResultOk<number>[]): ResultOk<number> {
    return ok(values.reduce((acc, val) => acc + val.value, 0));
  }
}

//##################################################################################################################################################
//      _____  ______ _____   _____ ______ _   _ _______       _____ ______
//     |  __ \|  ____|  __ \ / ____|  ____| \ | |__   __|/\   / ____|  ____|
//     | |__) | |__  | |__) | |    | |__  |  \| |  | |  /  \ | |  __| |__
//     |  ___/|  __| |  _  /| |    |  __| | . ` |  | | / /\ \| | |_ |  __|
//     | |    | |____| | \ \| |____| |____| |\  |  | |/ ____ \ |__| | |____
//     |_|    |______|_|  \_\\_____|______|_| \_|  |_/_/    \_\_____|______|

class NumberPercentageREA<
  S extends State<number>,
  T extends State<number>,
> extends COLLECTED.class<number, [S, T], number, SR<number>> {
  constructor(st1: S, st2: T) {
    super(false, false, false, st1, st2);
  }
  protected getter(values: [SR<number>, SR<number>]): SR<number> {
    if (values[0].err) return values[0];
    if (values[1].err) return values[1];
    return ok(
      (values[1].value / (values[0].value === 0 ? 1 : values[0].value)) * 100,
    );
  }
}

//##################################################################################################################################################
class NumberPercentageROA<
  S extends StateROA<number>,
  T extends StateROA<number>,
> extends COLLECTED.class<number, [S, T], number, ResultOk<number>> {
  constructor(st1: S, st2: T) {
    super(true, false, false, st1, st2);
  }
  protected getter(
    values: [ResultOk<number>, ResultOk<number>],
  ): ResultOk<number> {
    return ok(
      (values[1].value / (values[0].value === 0 ? 1 : values[0].value)) * 100,
    );
  }
}

//##################################################################################################################################################
class NumberPercentageRES<
  S extends StateRES<number>,
  T extends StateRES<number>,
> extends COLLECTED.class<number, [S, T], number, SR<number>> {
  constructor(st1: S, st2: T) {
    super(false, true, false, st1, st2);
  }
  protected getter(values: [SR<number>, SR<number>]): SR<number> {
    if (values[0].err) return values[0];
    if (values[1].err) return values[1];
    return ok(
      (values[1].value / (values[0].value === 0 ? 1 : values[0].value)) * 100,
    );
  }
}

//##################################################################################################################################################
class NumberPercentageROS<
  S extends StateROS<number>,
  T extends StateROS<number>,
> extends COLLECTED.class<number, [S, T], number, ResultOk<number>> {
  constructor(st1: S, st2: T) {
    super(true, true, false, st1, st2);
  }
  protected getter(
    values: [ResultOk<number>, ResultOk<number>],
  ): ResultOk<number> {
    return ok(
      (values[1].value / (values[0].value === 0 ? 1 : values[0].value)) * 100,
    );
  }
}

export const COLLECTS_NUMBER = {
  //Calculates the sum of all the states
  sum: {
    rea<S extends State<number>[]>(...states: S) {
      return new NumberSumREA(...states) as StateCollectedREA<number, S>;
    },
    roa<S extends [StateROA<number>, ...StateROA<number>[]]>(...states: S) {
      return new NumberSumROA(...states) as StateCollectedROA<number, S>;
    },
    res<S extends StateRES<number>[]>(...states: S) {
      return new NumberSumRES(...states) as StateCollectedRES<number, S>;
    },
    ros<S extends [StateROS<number>, ...StateROS<number>[]]>(...states: S) {
      return new NumberSumROS(...states) as StateCollectedROS<number, S>;
    },
  },
  //Calculates how many percent the second state is of the first state
  percentage: {
    rea<S extends State<number>, T extends State<number>>(st1: S, st2: T) {
      return new NumberPercentageREA(st1, st2) as StateCollectedREA<
        number,
        [S, T]
      >;
    },
    roa<S extends StateROA<number>, T extends StateROA<number>>(
      st1: S,
      st2: T,
    ) {
      return new NumberPercentageROA(st1, st2) as StateCollectedROA<
        number,
        [S, T]
      >;
    },
    res<S extends StateRES<number>, T extends StateRES<number>>(
      st1: S,
      st2: T,
    ) {
      return new NumberPercentageRES(st1, st2) as StateCollectedRES<
        number,
        [S, T]
      >;
    },
    ros<S extends StateROS<number>, T extends StateROS<number>>(
      st1: S,
      st2: T,
    ) {
      return new NumberPercentageROS(st1, st2) as StateCollectedROS<
        number,
        [S, T]
      >;
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
    super(options);
    if (options.min) this.min = options.min;
    if (options.max) this.max = options.max;
    if (options.unit) this.unit = options.unit;
    if (options.step) this.step = options.step;
    if (options.start) this.start = options.start;
    if (options.decimals) this.decimals = options.decimals;
  }

  async limit(value: number): Promise<SR<number>> {
    const [min, max, step, start, decimals] = await Promise.all([
      this.min,
      this.max,
      this.step,
      this.start,
      this.decimals,
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
    const writable = await this.check_writable(value);
    if (writable.err) return writable;
    const [min, max, step, start, decimals] = await Promise.all([
      this.min,
      this.max,
      this.step,
      this.start,
      this.decimals,
    ]);
    if (max?.ok && value > max.value)
      return err(value + " is bigger than the limit of " + max.value);
    if (min?.ok && value < min.value)
      return err(value + " is smaller than the limit of " + min.value);
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
        return err(
          value +
            " is not on a step of " +
            step_val +
            (start_val ? " starting from " + start_val : ""),
        );
      return err(value + " has more than " + decimals_val + " decimals");
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
