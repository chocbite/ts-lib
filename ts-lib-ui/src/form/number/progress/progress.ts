import { define_element } from "#base";
import { none } from "@chocbite/ts-lib/result";
import type { StateNumberRelated } from "@chocbite/ts-lib/state";
import { FormValue } from "../../base";
import { type FormNumberOptions } from "../number_base";
import "./progress.scss";

export class FormProgress<ID extends string | undefined> extends FormValue<
  number,
  ID
> {
  static element_name() {
    return "progress";
  }
  static element_name_space(): string {
    return "form";
  }

  #min: number = 0;
  #max: number = 100;
  #span: number = 100;
  #decimals: number = 0;
  #bar: HTMLDivElement = this.appendChild(document.createElement("div"));
  #val: HTMLSpanElement = this.appendChild(document.createElement("span"));
  #unit: HTMLSpanElement = this.appendChild(document.createElement("span"));

  /**Set the minimum value*/
  set min(min: number) {
    this.#min = min;
    this.#span = this.#max - this.#min;
  }

  /**Set the minimum value*/
  set max(max: number) {
    this.#max = max;
    this.#span = this.#max - this.#min;
  }

  /**Sets the amount of decimals the element can have*/
  set decimals(dec: number | undefined) {
    this.#decimals = Math.max(dec ?? 0, 0);
  }

  /**Sets the unit of the element*/
  set unit(unit: string | undefined) {
    this.#unit.textContent = unit ?? "";
  }

  protected new_value(value: number): void {
    this.#bar.style.width =
      Math.min(Math.max(((value - this.#min) / this.#span) * 100, 0), 100) +
      "%";
    this.#val.textContent = value.toFixed(this.#decimals);
  }

  protected clear_value(): void {
    this.#bar.style.width = "0%";
    this.#val.textContent = "";
  }

  protected new_error(err: string): void {
    console.error(err);
  }

  protected clear_error(): void {}

  protected state_related(related: Partial<StateNumberRelated>): void {
    if (related.min)
      this.attach_state_to_prop("min", related.min, () => none());
    else this.detach_state_from_prop("min");
    if (related.max)
      this.attach_state_to_prop("max", related.max, () => none());
    else this.detach_state_from_prop("max");
    if (related.decimals)
      this.attach_state_to_prop("decimals", related.decimals, () => none());
    else this.detach_state_from_prop("decimals");
    if (related.unit)
      this.attach_state_to_prop("unit", related.unit, () => none());
    else this.detach_state_from_prop("unit");
  }
}
define_element(FormProgress);

/**Creates a progress form element */
export function form_progress<ID extends string | undefined>(
  options?: FormNumberOptions<ID>,
): FormProgress<ID> {
  const prog = new FormProgress<ID>(options?.id);
  if (options) {
    if (typeof options.min !== "undefined") prog.min = options.min;
    if (typeof options.max !== "undefined") prog.max = options.max;
    prog.decimals = options.decimals;
    prog.unit = options.unit;
    FormValue.apply_options(prog, options);
  }
  return prog;
}
