import { define_element } from "#base";
import { sleep, sync_resolve } from "@chocbite/ts-lib/common";
import {
  material_add_rounded,
  material_remove_rounded,
} from "#icons";
import { number_step_start_decimal } from "@chocbite/ts-lib/math";
import { err, type Result } from "@chocbite/ts-lib/result";
import type { SVGFunc } from "#svg";
import { FormNumberWrite, type FormStepperBaseOptions } from "../number_base";
import "./stepper.scss";

/**Slide Selector, displays all options in a slider*/
export class FormStepper<ID extends string | undefined> extends FormNumberWrite<
  ID,
  number
> {
  static element_name() {
    return "stepper";
  }
  static element_name_space(): string {
    return "form";
  }

  #unit: string = "";
  #decimals: number = 0;
  #min: number = -Infinity;
  #max: number = Infinity;
  #step: number = 0;
  #start: number = 0;
  #live: boolean = false;
  #icon_dec = this.#stepper_func(
    this.appendChild(material_remove_rounded()),
    false,
  );
  #text = this.appendChild(document.createElement("span"));
  #icon_inc = this.#stepper_func(
    this.appendChild(material_add_rounded()),
    true,
  );
  #value_box = this.#text.appendChild(document.createElement("span"));
  #unit_box = this.#text.appendChild(document.createElement("span"));
  #legend = this.#text.appendChild(document.createElement("span"));
  #max_legend = this.#legend.appendChild(document.createElement("span"));
  #min_legend = this.#legend.appendChild(document.createElement("span"));

  constructor(id?: ID) {
    super(id);
    this.setAttribute("tabindex", "0");
    this.appendChild(this.warn_input);

    this.#value_box.setAttribute("tabindex", "-1");
    this.#value_box.contentEditable = "true";
    this.#value_box.onfocus = async () => {
      this.selected = true;
    };
    this.#value_box.onblur = async () => {
      this.selected = false;
      await sleep(0);
      this.set_value_check(
        parseFloat(this.#value_box.textContent?.replace(",", ".") || "") || 0,
      );
    };
    this.#value_box.onpointerdown = () => {
      this.selected = true;
    };
    let pointer_id: number | undefined;
    const reset = () => {
      this.selected = false;
      this.#value_box.contentEditable = "true";
      if (pointer_id) this.#text.releasePointerCapture(pointer_id);
      this.#text.onpointermove = null;
      this.#text.onpointerup = null;
    };
    this.#text.onpointerdown = (e) => {
      if (e.button === 0 && !this.selected) {
        e.stopPropagation();
        this.selected = true;
        const initial_val = this.buffer || 0;
        let moving = false;
        this.#text.setPointerCapture(e.pointerId);
        pointer_id = e.pointerId;
        this.#text.onpointermove = (ev) => {
          ev.stopPropagation();
          if (moving) {
            this.#move_diff(
              initial_val + ((ev.clientX - e.clientX) / 10) * (this.#step || 1),
            );
          } else if (Math.abs(e.clientX - ev.clientX) > 5) {
            this.#value_box.contentEditable = "false";
            moving = true;
          }
        };
        this.#text.onpointerup = (ev) => {
          ev.stopPropagation();
          reset();
          if (!moving && e.target !== this.#value_box) {
            this.#value_box.focus();
            const range = document.createRange();
            range.setStartAfter(this.#value_box.firstChild!);
            const selection = this.ownerDocument?.defaultView?.getSelection();
            if (selection) {
              selection.removeAllRanges();
              selection.addRange(range);
            }
          } else if (moving) {
            this.#move_diff(
              initial_val + ((ev.clientX - e.clientX) / 10) * (this.#step || 1),
              true,
            );
            moving = false;
          }
        };
      }
    };

    this.onkeydown = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        this.#step_value(e.key === "ArrowRight");
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (reset) reset();
        if (this.buffer !== undefined) this.new_value(this.buffer);
        else this.clear_value();
      } else {
        if (
          this.ownerDocument.activeElement !== this.#value_box &&
          /[\d,.-]/g.test(e.key)
        ) {
          this.#value_box.textContent = "";
          this.#value_box.focus();
        }
      }
    };
    this.#value_box.onkeydown = (e) => {
      if (e.key === "Enter") {
        HTMLElement.prototype.focus.call(this);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (this.buffer !== undefined) this.new_value(this.buffer);
        else this.clear_value();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft")
        e.stopPropagation();
    };
    this.#value_box.onbeforeinput = (e) => {
      if (e.inputType === "insertParagraph") e.preventDefault();
      if (e.data) {
        if (!/[\d,.-]/g.test(e.data)) e.preventDefault();
        else if (/[,.]/g.test(e.data) && this.#decimals === 0)
          e.preventDefault();
        else if (
          (this.#min >= 0 && /-/g.test(e.data)) ||
          this.#value_box.textContent?.includes("-")
        )
          e.preventDefault();
      }
    };
  }

  focus(options?: FocusOptions): void {
    this.#value_box.focus(options);
  }

  set unit(unit: string | undefined) {
    this.#unit = unit || "";
    this.#unit_box.textContent = this.#unit;
  }

  set decimals(dec: number | undefined) {
    this.#decimals = dec || 0;
    this.#update_min_legend();
    this.#update_max_lengend();
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
  }

  set start(step: number | undefined) {
    this.#start = step || 0;
  }

  /**Set wether the slider is in live mode*/
  set live(live: boolean | undefined) {
    this.#live = live || false;
  }

  set icon_decrease(icon: SVGFunc | undefined) {
    this.replaceChild(
      this.#icon_dec,
      this.#stepper_func(icon ? icon() : material_remove_rounded(), false),
    );
  }

  set icon_increase(icon: SVGFunc | undefined) {
    this.replaceChild(
      this.#icon_inc,
      this.#stepper_func(icon ? icon() : material_add_rounded(), true),
    );
  }

  protected new_value(value: number) {
    this.#move_value(value);
  }

  protected clear_value(): void {
    this.#value_box.textContent = "";
  }

  protected new_error(err: string): void {
    console.error(err);
  }

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

  /**Moves the value to a position by the mouse x coordinates*/
  async #move_diff(value: number, last: boolean = false) {
    if (this.#live) this.set_value_limit(value);
    else {
      if (last) this.set_value_limit(value);
      else {
        const lim = await this.limit_value(value);
        if (lim.ok) this.#move_value(lim.value);
      }
    }
  }

  /**Moves the slider to the given percent position*/
  #move_value(value: number) {
    this.#value_box.textContent = value.toFixed(this.#decimals);
  }

  /**Attaches click action to over time increase speed of stepping when holding step buttons */
  #stepper_func(icon: SVGSVGElement, dir: boolean) {
    icon.onpointerdown = (e) => {
      if (e.button === 0) {
        e.stopPropagation();
        let interval = 0;
        let scaler_interval = 0;
        let scaler = 250;
        const release = () => {
          clearInterval(interval);
          clearInterval(scaler_interval);
          clearTimeout(timeout);
          icon.onpointerup = null;
          icon.releasePointerCapture(e.pointerId);
          icon.classList.remove("active");
        };
        icon.setPointerCapture(e.pointerId);
        icon.classList.add("active");
        const timeout = setTimeout(() => {
          this.#step_value(dir);
          interval = setInterval(() => this.#step_value(dir), scaler);
          scaler_interval = setInterval(() => {
            if (scaler > 20) scaler /= 1.1;
            clearInterval(interval);
            interval = setInterval(() => this.#step_value(dir), scaler);
          }, 1000);
        }, 500);
        icon.onpointerup = () => {
          if (interval === 0) this.#step_value(dir);
          release();
        };
      }
    };
    return icon;
  }

  #step_value(dir: boolean) {
    const step =
      this.#step ||
      Math.max(
        this.#decimals ? 1 / this.#decimals : 1,
        Math.floor(Math.abs(this.buffer || 0) / 150),
      );
    return this.set_value_check((this.buffer || 0) + (dir ? step : -step));
  }
}
define_element(FormStepper);

/**Creates a dropdown form element */
export function form_stepper<ID extends string | undefined>(
  options?: FormStepperBaseOptions<ID>,
): FormStepper<ID> {
  const slide = new FormStepper<ID>(options?.id);
  if (options) {
    if (options.live) slide.live = options.live;
    if (options.icon_decrease) slide.icon_decrease = options.icon_decrease;
    if (options.icon_increase) slide.icon_increase = options.icon_increase;
    FormNumberWrite.apply_options(slide, options);
  }
  return slide;
}
