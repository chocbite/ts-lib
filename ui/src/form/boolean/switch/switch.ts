import { define_element } from "#base";
import type { Option } from "@chocbite/ts-lib/result";
import type { SVGFunc } from "#svg";
import { FormColors, FormValueWrite, FormValueWriteOptions } from "../../base";
import "./switch.scss";

export interface FormSwitchOptions<
  ID extends string | undefined,
> extends FormValueWriteOptions<boolean, ID> {
  /**Icon to use for left side*/
  icon?: SVGFunc;
  /**Color when switch is on */
  on_color?: FormColors;
  /**Color when switch is off */
  off_color?: FormColors;
}

export class FormSwitch<ID extends string | undefined> extends FormValueWrite<
  boolean,
  ID
> {
  static element_name() {
    return "switch";
  }
  static element_name_space(): string {
    return "form";
  }

  #switch: HTMLDivElement = this.appendChild(document.createElement("div"));
  #icon: SVGSVGElement | undefined;
  #prevent_click: boolean = false;

  constructor(id?: ID) {
    super(id);

    this.appendChild(this.warn_input);
    this.#switch.setAttribute("tabindex", "0");
    this.#switch.onkeydown = (e) => {
      switch (e.key) {
        case "Enter":
        case " ": {
          e.stopPropagation();
          e.preventDefault();
          this.onkeyup = (e) => {
            switch (e.key) {
              case "Enter":
              case " ": {
                e.stopPropagation();
                e.preventDefault();
                this.onkeyup = null;
                this.set_value_check(!this.buffer);
                break;
              }
            }
          };
          break;
        }
      }
    };

    this.#switch.onpointerdown = (e) => {
      if (e.button === 0) {
        e.stopPropagation();
        this.#switch.classList.add("active");
        this.#switch.setPointerCapture(e.pointerId);
        let has_moved = false;
        this.#switch.onpointermove = (ev) => {
          ev.stopPropagation();
          if (has_moved) {
            const box = this.#switch.getBoundingClientRect();
            const mid_cord = box.x + box.width / 2;
            if (ev.clientX > mid_cord) {
              if (!this.buffer) this.set_value_check(true);
            } else {
              if (this.buffer) this.set_value_check(false);
            }
          } else if (
            Math.abs(e.clientX - ev.clientX) > 10 ||
            Math.abs(e.clientY - ev.clientY) > 10
          ) {
            has_moved = true;
          }
        };
        const release = () => {
          this.#switch.classList.remove("active");
          this.#switch.releasePointerCapture(e.pointerId);
          this.#switch.onpointerup = null;
          this.#switch.onpointermove = null;
          this.#switch.onpointercancel = null;
        };
        this.#switch.onpointerup = (ev) => {
          ev.stopPropagation();
          release();
          if (!has_moved) this.set_value_check(!this.buffer);
        };
        //A cancelled press does not toggle, values set by moving are kept
        this.#switch.onpointercancel = release;
      }
    };

    this.#switch.onclick = (e) => e.stopPropagation();

    this.onclick = (e) => {
      e.stopPropagation();
      if (this.#prevent_click) return (this.#prevent_click = false);
      this.set_value_check(!this.buffer);
      return;
    };
  }

  /**Changes the icon of the switch*/
  set icon(icon: SVGFunc | undefined) {
    if (this.#icon) this.removeChild(this.#icon);
    this.#icon = icon ? this.insertBefore(icon(), this.#switch) : undefined;
  }

  set on_color(color: FormColors) {
    if (color === FormColors.None) this.#switch.removeAttribute("on-color");
    else this.#switch.setAttribute("on-color", color);
  }
  set off_color(color: FormColors) {
    if (color === FormColors.None) this.#switch.removeAttribute("off-color");
    else this.#switch.setAttribute("off-color", color);
  }
  set error_color(color: FormColors) {
    if (color === FormColors.None) this.#switch.removeAttribute("error-color");
    else this.#switch.setAttribute("error-color", color);
  }

  /**Called when value is changed */
  protected new_value(value: boolean) {
    if (value) this.#switch.classList.add("on");
    else this.#switch.classList.remove("on");
  }

  protected clear_value(): void {
    this.new_value(false);
  }

  protected new_error(_err: string): void {
    this.#switch.classList.add("error");
  }

  protected clear_error(): void {
    this.#switch.classList.remove("error");
  }

  protected state_related(_related: Option<{}>): void {}
}
define_element(FormSwitch);

/**Creates a switch form element */
export function form_switch<ID extends string | undefined>(
  options?: FormSwitchOptions<ID>,
): FormSwitch<ID> {
  const swit = new FormSwitch<ID>(options?.id);
  if (options) {
    if (options.icon) swit.icon = options.icon;
    if (options.on_color) swit.on_color = options.on_color;
    if (options.off_color) swit.off_color = options.off_color;
    FormValueWrite.apply_options(swit, options);
  }
  return swit;
}
