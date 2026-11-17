import { input_key, type InputOptions } from "#base";
import type { StateNumberRelated, StateOrVal } from "@chocbite/ts-lib/state";
import type { SVGFunc } from "#svg";
import {
  FormSetting,
  FormValueWrite,
  type FormValueCreateOptions,
  type FormValueWriteOptions,
} from "../base";
import "./number_base.scss";

/**Inputs of number elements, not given the related value of the value state is used*/
const NUMBER = {
  /**Lowest value*/
  min: input_key<StateOrVal<number>>(),
  /**Highest value*/
  max: input_key<StateOrVal<number>>(),
  /**Size of a step, 0 for an automatic step*/
  step: input_key<StateOrVal<number>>(),
  /**Value the steps start from, 0 for automatic*/
  start: input_key<StateOrVal<number>>(),
  /**Decimals shown, not given enough for the step and start*/
  decimals: input_key<StateOrVal<number>>(),
  /**Unit shown after the value*/
  unit: input_key<StateOrVal<string>>(),
};
/**Related values of the value state, followed while the inputs are not given*/
const NUMBER_RELATED = {
  min: input_key<StateOrVal<number | null>>(),
  max: input_key<StateOrVal<number | null>>(),
  step: input_key<StateOrVal<number | null>>(),
  start: input_key<StateOrVal<number | null>>(),
  decimals: input_key<StateOrVal<number | null>>(),
  unit: input_key<StateOrVal<string | null>>(),
};
export type FormNumberOptions = FormValueWriteOptions<number> &
  InputOptions<typeof NUMBER>;
export type FormNumberCreateOptions<ID extends string | undefined> =
  FormNumberOptions & FormValueCreateOptions<ID>;

/**Inputs of the stepper and slider*/
export const STEPPER = {
  /**True writes the value while the user moves it, false only when the user lets go*/
  live: input_key<StateOrVal<boolean>>(),
  /**Icon of the decrease button, not given the default minus*/
  icon_decrease: input_key<StateOrVal<SVGFunc | undefined>>(),
  /**Icon of the increase button, not given the default plus*/
  icon_increase: input_key<StateOrVal<SVGFunc | undefined>>(),
};
export type FormStepperOptions = FormNumberOptions &
  InputOptions<typeof STEPPER>;
export type FormStepperCreateOptions<ID extends string | undefined> =
  FormStepperOptions & FormValueCreateOptions<ID>;

/**Base of number elements the user changes, the settings come from the inputs, or else from the related values of the value state*/
export abstract class FormNumberWrite<
  ID extends string | undefined = string | undefined,
> extends FormValueWrite<number, ID> {
  #min = new FormSetting<number>((v) => this.apply_min(v));
  #max = new FormSetting<number>((v) => this.apply_max(v));
  #step = new FormSetting<number>((v) => this.apply_step(v));
  #start = new FormSetting<number>((v) => this.apply_start(v));
  #decimals = new FormSetting<number>((v) => this.apply_decimals(v));
  #unit = new FormSetting<string>((v) => this.apply_unit(v));

  set(options: FormNumberOptions): this {
    super.set(options);
    const ok_or = <T>(r: { ok: boolean; value?: T }) =>
      r.ok ? r.value : undefined;
    this.set_input(NUMBER.min, options.min, (r) => this.#min.input(ok_or(r)));
    this.set_input(NUMBER.max, options.max, (r) => this.#max.input(ok_or(r)));
    this.set_input(NUMBER.step, options.step, (r) =>
      this.#step.input(ok_or(r)),
    );
    this.set_input(NUMBER.start, options.start, (r) =>
      this.#start.input(ok_or(r)),
    );
    this.set_input(NUMBER.decimals, options.decimals, (r) =>
      this.#decimals.input(ok_or(r)),
    );
    this.set_input(NUMBER.unit, options.unit, (r) =>
      this.#unit.input(ok_or(r)),
    );
    return this;
  }

  protected state_related(related: Partial<StateNumberRelated>): void {
    this.follow_related(NUMBER_RELATED.min, related.min, (v) =>
      this.#min.related(v),
    );
    this.follow_related(NUMBER_RELATED.max, related.max, (v) =>
      this.#max.related(v),
    );
    this.follow_related(NUMBER_RELATED.step, related.step, (v) =>
      this.#step.related(v),
    );
    this.follow_related(NUMBER_RELATED.start, related.start, (v) =>
      this.#start.related(v),
    );
    this.follow_related(NUMBER_RELATED.decimals, related.decimals, (v) =>
      this.#decimals.related(v),
    );
    this.follow_related(NUMBER_RELATED.unit, related.unit, (v) =>
      this.#unit.related(v),
    );
  }

  /**Applies the lowest value that counts now, undefined for none*/
  protected abstract apply_min(min: number | undefined): void;
  /**Applies the highest value that counts now, undefined for none*/
  protected abstract apply_max(max: number | undefined): void;
  /**Applies the step that counts now, undefined for automatic*/
  protected abstract apply_step(step: number | undefined): void;
  /**Applies the start that counts now, undefined for automatic*/
  protected abstract apply_start(start: number | undefined): void;
  /**Applies the decimals that count now, undefined for automatic*/
  protected abstract apply_decimals(decimals: number | undefined): void;
  /**Applies the unit that counts now, undefined for none*/
  protected abstract apply_unit(unit: string | undefined): void;
}

/**Decimals to show and round to, the given decimals, or without them enough for the step and start*/
export function number_decimals(
  decimals: number | undefined,
  step: number,
  start: number,
): number {
  return decimals ?? Math.max(fraction_digits(step), fraction_digits(start));
}

/**Amount of decimals needed to show a number, at most 10*/
function fraction_digits(val: number): number {
  let dec = 0;
  for (let scaled = val; dec < 10; dec++, scaled = val * 10 ** dec)
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) break;
  return dec;
}
