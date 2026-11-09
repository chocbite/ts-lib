import { define_element } from "#base";
import { sync_resolve } from "@chocbite/ts-lib/common";
import { get_cursor_position, set_cursor_end, set_cursor_position, set_selection_all } from "#selection";
import { number_step_start_decimal } from "@chocbite/ts-lib/math";
import { err, type Result } from "@chocbite/ts-lib/result";
import {
  FormNumberWrite,
  number_decimals,
  type FormNumberWriteOptions,
} from "../number_base";
import "./number_input.scss";

export class FormNumberInput<
  ID extends string | undefined,
> extends FormNumberWrite<ID> {
  static element_name() {
    return "numberinput";
  }
  static element_name_space(): string {
    return "form";
  }

  #unit: string = "";
  #min: number = -Infinity;
  #max: number = Infinity;
  #step: number = 0;
  #start: number = 0;
  #decimals_set?: number;
  #decimals: number = 0;
  /**Text last drawn from a value, and whether the user typed since*/
  #shown: string = "";
  #edited: boolean = false;

  #value_box = this.appendChild(document.createElement("span"));
  #unit_box = this.appendChild(document.createElement("span"));
  #legend = this.appendChild(document.createElement("div"));
  #max_legend = this.#legend.appendChild(document.createElement("span"));
  #min_legend = this.#legend.appendChild(document.createElement("span"));

  constructor(id?: ID) {
    super(id);
    this.appendChild(this.warn_input);
    this.#value_box.contentEditable = "true";
    this.onpointerdown = (e) => {
      this.selected = true;
      if (e.target !== this.#value_box) {
        e.preventDefault();
        set_cursor_end(this.#value_box);
      } else this.#value_box.focus();
    };
    this.#value_box.addEventListener("focusin", (e) => {
      e.preventDefault();
      if (this.selected) return;
      set_selection_all(this.#value_box);
      this.selected = true;
    });
    this.#value_box.onblur = () => {
      this.selected = false;
      setTimeout(() => {
        this.#set(false);
      }, 0);
    };
    this.#value_box.oninput = () => (this.#edited = true);
    this.onkeydown = (e) => {
      if (e.key === "Enter") this.#set(true);
      else if (e.key === "Escape") {
        if (this.buffer !== undefined) this.new_value(this.buffer);
        else this.clear_value();
      } else if (e.key === "ArrowUp") this.#step_value(true);
      else if (e.key === "ArrowDown") this.#step_value(false);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    this.onbeforeinput = (e) => {
      if (e.inputType === "insertParagraph") e.preventDefault();
      else if (e.data) {
        if (!/[\d,.-]/g.test(e.data)) e.preventDefault();
        else if (/[,.]/g.test(e.data) && this.#decimals === 0)
          e.preventDefault();
        else if (this.#min >= 0 && /-/g.test(e.data)) e.preventDefault();
      }
    };
  }

  async #set(cur: boolean) {
    const text = this.#value_box.textContent || "";
    //Not edited, a value that arrived while focused is shown instead of writing the old text back
    if (!this.#edited && text === this.#shown) {
      const shown = this.buffer?.toFixed(this.#decimals);
      if (shown !== undefined && shown !== text) this.new_value(this.buffer!);
      return;
    }
    const sel = get_cursor_position(this.#value_box);
    const buff = this.buffer;
    (await this.set_value_check(parseFloat(text.replace(",", ".")) || 0))
      .map_err(() => {
        this.new_value(buff || Math.max(Math.min(0, this.#max), this.#min));
        set_cursor_end(this.#value_box);
      })
      .map(() => {
        if (!cur) return;
        set_cursor_position(this.#value_box, sel);
      });
  }

  focus(options?: FocusOptions): void {
    this.#value_box.focus(options);
  }

  set unit(unit: string | undefined) {
    this.#unit = unit || "";
    this.#unit_box.textContent = this.#unit;
  }

  set decimals(dec: number | undefined) {
    this.#decimals_set = dec;
    this.#update_decimals();
  }

  /**Updates the decimals from the set decimals, step and start, and redraws with them*/
  #update_decimals() {
    const dec = number_decimals(this.#decimals_set, this.#step, this.#start);
    if (dec === this.#decimals) return;
    this.#decimals = dec;
    this.#update_min_legend();
    this.#update_max_lengend();
    if (this.buffer !== undefined && !this.selected)
      this.new_value(this.buffer);
  }

  set min(min: number | undefined) {
    this.#min = min ?? -Infinity;
    this.#update_min_legend();
  }
  #update_min_legend() {
    this.#min_legend.textContent =
      this.#min === -Infinity ? "" : "Min:" + this.#min.toFixed(this.#decimals);
  }

  set max(max: number | undefined) {
    this.#max = max ?? Infinity;
    this.#update_max_lengend();
  }
  #update_max_lengend() {
    this.#max_legend.textContent =
      this.#max === Infinity ? "" : "Max:" + this.#max.toFixed(this.#decimals);
  }

  set step(step: number | undefined) {
    this.#step = step || 0;
    this.#update_decimals();
  }

  set start(step: number | undefined) {
    this.#start = step || 0;
    this.#update_decimals();
  }

  protected new_value(val: number): void {
    this.#value_box.textContent = this.#shown = val.toFixed(this.#decimals);
    this.#edited = false;
  }

  protected clear_value(): void {
    this.#value_box.textContent = this.#shown = "";
    this.#edited = false;
  }

  protected new_error(_val: string): void {}

  protected clear_error(): void {}

  protected limit_value(val: number): PromiseLike<Result<number, string>> {
    let lim = number_step_start_decimal(
      Math.min(Math.max(val, this.#min), this.#max),
      this.#step,
      this.#start,
      this.#decimals,
    );
    if (lim < this.#min) lim += this.#step;
    if (lim > this.#max) lim -= this.#step;
    return super.limit_value(lim);
  }

  protected check_value(val: number): PromiseLike<Result<number, string>> {
    if (val < this.#min)
      return sync_resolve(
        err("Minimum value " + this.#min.toFixed(this.#decimals) + this.#unit),
      );
    if (val > this.#max)
      return sync_resolve(
        err("Maximum value " + this.#max.toFixed(this.#decimals) + this.#unit),
      );
    let lim = number_step_start_decimal(
      val,
      this.#step,
      this.#start,
      this.#decimals,
    );
    if (lim < this.#min) lim += this.#step;
    if (lim > this.#max) lim -= this.#step;
    return super.check_value(lim);
  }

  #step_value(dir: boolean) {
    const step =
      this.#step ||
      Math.max(
        this.#decimals ? 10 ** -this.#decimals : 1,
        Math.floor(Math.abs(this.buffer || 0) / 150),
      );
    return this.set_value_check((this.buffer || 0) + (dir ? step : -step));
  }
}
define_element(FormNumberInput);

/**Creates a number input form element */
export function form_number_input<ID extends string | undefined>(
  options?: FormNumberWriteOptions<ID>,
): FormNumberInput<ID> {
  const input = new FormNumberInput<ID>(options?.id);
  if (options) {
    FormNumberWrite.apply_options(input, options);
  }
  return input;
}
