import { define_element } from "#base";
import { sync_resolve } from "@chocbite/ts-lib/common";
import {
  material_add_rounded,
  material_remove_rounded,
} from "#icons";
import { number_step_start_decimal } from "@chocbite/ts-lib/math";
import { err, type Result } from "@chocbite/ts-lib/result";
import type { SVGFunc } from "#svg";
import { FormNumberWrite, type FormStepperBaseOptions } from "../number_base";
import "./slider.scss";

/**Slide Selector, displays all options in a slider*/
export class FormSlider<ID extends string | undefined> extends FormNumberWrite<
  ID,
  number
> {
  static element_name() {
    return "slider";
  }
  static element_name_space(): string {
    return "form";
  }

  #unit: string = "";
  #decimals: number = 0;
  #min: number = -Infinity;
  #max: number = Infinity;
  #span: number = Infinity;
  #step: number = 0;
  #start: number = 0;
  #live: boolean = false;
  #icon_dec = this.#stepper_func(
    this.appendChild(material_remove_rounded()),
    false,
  );
  #slide = this.appendChild(document.createElement("div"));
  #legend = this.appendChild(document.createElement("span"));
  #left_legend = this.#legend.appendChild(document.createElement("span"));
  #right_legend = this.#legend.appendChild(document.createElement("span"));
  #icon_inc = this.#stepper_func(
    this.appendChild(material_add_rounded()),
    true,
  );
  #slider = this.#slide.appendChild(document.createElement("div"));
  #value_box = this.#slider.appendChild(document.createElement("span"));
  #unit_box = this.#slider.appendChild(document.createElement("span"));

  constructor(id?: ID) {
    super(id);
    this.#slider.setAttribute("tabindex", "0");
    this.appendChild(this.warn_input);

    this.onpointerdown = (e) => {
      if (e.button !== 0) return;
      if (e.pointerType !== "mouse" && !this.#slider.contains(e.target as Node))
        return;
      e.stopPropagation();
      this.#slider.classList.add("active");
      this.selected = true;
      const box = this.#slider.getBoundingClientRect();
      const offset = this.#slider.contains(e.target as Node)
        ? e.clientX >= box.x
          ? e.clientX <= box.x + box.width
            ? box.x - e.clientX
            : -box.width
          : 0
        : -box.width / 2;
      if (this.#min === -Infinity || this.#max === Infinity) {
        let value = this.buffer || 0;
        const interval = setInterval(async () => {
          const val = (value += diff / 50);
          if (this.#live)
            (await this.set_value_limit(val)).map((v) => (value = v));
          else {
            (await this.limit_value(val)).map((v) => {
              this.#move_value(v);
              value = v;
            });
          }
        }, 100);
        let diff = this.#x_to_perc(e.clientX + offset) - 50;
        this.#move_slide(this.#x_to_perc(e.clientX + offset));
        this.#slider.setPointerCapture(e.pointerId);
        this.#slider.onpointermove = (ev) => {
          ev.stopPropagation();
          const perc = this.#x_to_perc(ev.clientX + offset);
          diff = (this.#step || 1) * ((perc - 50) * 2);
          this.#move_slide(perc);
        };
        const reset = () => {
          this.#slider.classList.remove("active");
          this.selected = false;
          this.#slider.releasePointerCapture(e.pointerId);
          this.#slider.onpointermove = null;
          this.#slider.onpointerup = null;
          this.#move_slide(50);
          clearInterval(interval);
        };
        this.#slider.onpointerup = (ev) => {
          ev.stopPropagation();
          reset();
          if (!this.#live) this.set_value_limit(value);
        };
        this.#slider.onkeydown = (e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            reset();
            if (this.buffer !== undefined) this.new_value(this.buffer);
            else this.clear_value();
          }
        };
      } else {
        const value = this.buffer || 0;
        this.#move_absolute(e.clientX + offset);
        this.#slider.setPointerCapture(e.pointerId);
        this.#slider.onpointermove = (ev) => {
          ev.stopPropagation();
          this.#move_absolute(ev.clientX + offset);
        };
        const reset = () => {
          this.#slider.classList.remove("active");
          this.selected = false;
          this.#slider.releasePointerCapture(e.pointerId);
          this.#slider.onpointermove = null;
          this.#slider.onpointerup = null;
        };
        this.#slider.onpointerup = (ev) => {
          ev.stopPropagation();
          reset();
          this.#move_absolute(ev.clientX + offset, value);
        };
        this.#slider.onkeydown = (e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            reset();
            if (this.buffer !== undefined) this.new_value(this.buffer);
            else this.clear_value();
          }
        };
      }
    };
    this.#slide.onkeydown = (e) => {
      if (e.key === "ArrowRight") this.#step_value(true);
      else if (e.key === "ArrowLeft") this.#step_value(false);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
  }

  focus(options?: FocusOptions): void {
    this.#slider.focus(options);
  }

  set unit(unit: string | undefined) {
    this.#unit = unit || "";
    this.#unit_box.textContent = this.#unit;
  }

  set min(min: number | undefined) {
    this.#min = min ?? -Infinity;
    this.#update_min_max();
    this.#update_min_legend();
  }
  #update_min_legend() {
    this.#left_legend.textContent =
      this.#min === -Infinity ? "" : "Min:" + this.#min.toFixed(this.#decimals);
  }

  set max(max: number | undefined) {
    this.#max = max ?? Infinity;
    this.#update_min_max();
    this.#update_max_legend();
  }

  #update_max_legend() {
    this.#right_legend.textContent =
      this.#max === Infinity ? "" : this.#max.toFixed(this.#decimals) + ":Max";
  }

  #update_min_max() {
    this.#span = this.#max - this.#min;
    if (this.#span === Infinity) this.#move_slide(50);
    else if (this.buffer !== undefined) this.new_value(this.buffer);
  }

  set decimals(dec: number | undefined) {
    this.#decimals = dec || 0;
    this.#update_min_legend();
    this.#update_max_legend();
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

  protected new_value(value: number): void {
    this.#move_value(value);
    this.#move_slide(
      Math.min(Math.max(((-this.#min + value) / this.#span) * 100, 0), 100),
    );
  }

  protected clear_value(): void {
    this.#value_box.textContent = "";
    this.#move_slide(50);
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

  async #move_absolute(x: number, last?: number) {
    const perc = this.#x_to_perc(x);
    if (this.#live) this.set_value_limit(this.#perc_to_value(perc));
    else {
      if (last === undefined) {
        const value = await this.limit_value(this.#perc_to_value(perc));
        if (value.ok) {
          this.#move_slide(((-this.#min + value.value) / this.#span) * 100);
          this.#move_value(value.value);
        }
      } else {
        this.set_value_limit(this.#perc_to_value(perc));
      }
    }
  }

  #x_to_perc(x: number) {
    const box = this.#slide.getBoundingClientRect();
    return Math.min(100, Math.max(0, ((x - box.x) / box.width) * 100));
  }

  #perc_to_value(perc: number) {
    return (perc / 100) * this.#span + this.#min;
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

  #move_slide(perc: number) {
    this.#slider.style.left = perc + "%";
  }
  #move_value(value: number) {
    this.#value_box.textContent = value.toFixed(this.#decimals);
  }
}
define_element(FormSlider);

/**Creates a dropdown form element */
export function form_slider<ID extends string | undefined>(
  options?: FormStepperBaseOptions<ID>,
): FormSlider<ID> {
  const slide = new FormSlider<ID>(options?.id);
  if (options) {
    if (options.live) slide.live = options.live;
    if (options.icon_decrease) slide.icon_decrease = options.icon_decrease;
    if (options.icon_increase) slide.icon_increase = options.icon_increase;
    FormNumberWrite.apply_options(slide, options);
  }
  return slide;
}
