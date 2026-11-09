import { none } from "@chocbite/ts-lib/result";
import type { StateNumberRelated } from "@chocbite/ts-lib/state";
import type { SVGFunc } from "#svg";
import {
  FormValueWrite,
  FormValueWriteOptions,
  type FormValueOptions,
} from "../base";
import "./number_base.scss";

export interface FormNumberOptions<
  ID extends string | undefined,
  RT = number,
> extends FormValueOptions<RT, ID> {
  /**Lower limit for slider value*/
  min?: number;
  /**Upper limit for slider value*/
  max?: number;
  /**Amount of decimals to show*/
  decimals?: number;
  /**Unit to use for slider*/
  unit?: string;
}

export interface FormNumberWriteOptions<
  ID extends string | undefined,
  RT = number,
>
  extends FormNumberOptions<ID, RT>, FormValueWriteOptions<RT, ID> {
  /**Step size, use 0 for automatic step size*/
  step?: number;
  /**Start for step, use 0 for automatic */
  start?: number;
}

export interface FormStepperBaseOptions<
  ID extends string | undefined,
  RT = number,
> extends FormNumberWriteOptions<ID, RT> {
  /**wether the events are live as the slider is moved or only when moving stops */
  live?: boolean;
  /**Icon to use for decreasing value*/
  icon_decrease?: SVGFunc;
  /**Icon to use for increasing value*/
  icon_increase?: SVGFunc;
}

export abstract class FormNumberWrite<
  ID extends string | undefined,
  RT = number,
> extends FormValueWrite<RT, ID> {
  static apply_options<RT, ID extends string | undefined>(
    element: FormNumberWrite<ID, RT>,
    options: FormNumberWriteOptions<ID, RT>,
  ) {
    if (options.unit) element.unit = options.unit;
    if (options.decimals) element.decimals = options.decimals;
    if (options.min !== undefined) element.min = options.min;
    if (options.max !== undefined) element.max = options.max;
    if (options.step) element.step = options.step;
    if (options.start) element.start = options.start;
    super.apply_options(element, options);
  }

  /**Set the minimum value*/
  abstract set min(min: number | undefined);

  /**Set the minimum value*/
  abstract set max(max: number | undefined);

  /**Sets the size of number change steps*/
  abstract set step(step: number | undefined);

  /**Sets the start offset for number steps*/
  abstract set start(step: number | undefined);

  /**Sets the amount of decimals the element can have*/
  abstract set decimals(dec: number | undefined);

  /**Sets the unit of the element*/
  abstract set unit(unit: string | undefined);

  /**Related states of the last bound state, a prop is only reset when it followed one of them*/
  #related: Partial<StateNumberRelated> = {};

  protected state_related(related: Partial<StateNumberRelated>): void {
    const old = this.#related;
    this.#related = related;
    if (related.min)
      this.attach_state_to_prop("min", related.min, () => none());
    else if (old.min) this.detach_state_from_prop("min").min = undefined;
    if (related.max)
      this.attach_state_to_prop("max", related.max, () => none());
    else if (old.max) this.detach_state_from_prop("max").max = undefined;
    if (related.step)
      this.attach_state_to_prop("step", related.step, () => none());
    else if (old.step) this.detach_state_from_prop("step").step = undefined;
    if (related.start)
      this.attach_state_to_prop("start", related.start, () => none());
    else if (old.start) this.detach_state_from_prop("start").start = undefined;
    if (related.decimals)
      this.attach_state_to_prop("decimals", related.decimals, () => none());
    else if (old.decimals)
      this.detach_state_from_prop("decimals").decimals = undefined;
    if (related.unit)
      this.attach_state_to_prop("unit", related.unit, () => none());
    else if (old.unit) this.detach_state_from_prop("unit").unit = undefined;
  }
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
