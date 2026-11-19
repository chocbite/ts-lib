import { define_element, input_key, type InputOptions } from "#base";
import type { Option } from "@chocbite/ts-lib/result";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import type { SVGFunc } from "#svg";
import {
  FormColors,
  FormValueWrite,
  type FormValueCreateOptions,
  type FormValueWriteOptions,
} from "../../base";
import "./switch.scss";

/**Inputs of the switch*/
const SWITCH = {
  /**Icon at the left of the switch, undefined for none, an error shows none*/
  icon: input_key<StateOrVal<SVGFunc | undefined>>(),
  /**Color of the switch when on, None for the default, an error gives the default*/
  on_color: input_key<StateOrVal<FormColors>>(),
  /**Color of the switch when off, None for the default, an error gives the default*/
  off_color: input_key<StateOrVal<FormColors>>(),
};
export type FormSwitchOptions = FormValueWriteOptions<boolean> &
  InputOptions<typeof SWITCH>;
export type FormSwitchCreateOptions<ID extends string | undefined> =
  FormSwitchOptions & FormValueCreateOptions<ID>;

class FormSwitch<
  ID extends string | undefined = string | undefined,
> extends FormValueWrite<boolean, ID> {
  static element_name() {
    return "switch";
  }
  static element_name_space(): string {
    return "form";
  }

  #switch: HTMLDivElement = this.appendChild(document.createElement("div"));
  #icon: SVGSVGElement | undefined;
  #prevent_click: boolean = false;

  constructor() {
    super();

    this.appendChild(this.warn_input);
    this.#switch.setAttribute("tabindex", "0");
    //Space toggles, Enter is left to parents, like a form submitting
    this.#switch.onkeydown = (e) => {
      if (e.key !== " ") return;
      e.stopPropagation();
      e.preventDefault();
      this.onkeyup = (e) => {
        if (e.key !== " ") return;
        e.stopPropagation();
        e.preventDefault();
        this.onkeyup = null;
        this.set_value_check(!this.buffer);
      };
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

  /**Focuses the knob, the input for warnings is hidden and can not take the focus*/
  focus(options?: FocusOptions): void {
    this.#switch.focus(options);
  }

  set(options: FormSwitchOptions): this {
    super.set(options);
    this.set_input(SWITCH.icon, options.icon, (icon) => {
      this.#icon?.remove();
      this.#icon =
        icon.ok && icon.value
          ? this.insertBefore(icon.value(), this.#switch)
          : undefined;
    });
    for (const name of ["on_color", "off_color"] as const)
      this.set_input(SWITCH[name], options[name], (color) => {
        const attribute = name.replace("_", "-");
        if (color.ok && color.value !== FormColors.None)
          this.#switch.setAttribute(attribute, color.value);
        else this.#switch.removeAttribute(attribute);
      });
    return this;
  }

  /**Called when value is changed */
  protected new_value(value: boolean) {
    if (value) this.#switch.classList.add("on");
    else this.#switch.classList.remove("on");
  }

  protected clear_value(): void {
    this.new_value(false);
  }

  protected state_related(_related: Option<{}>): void {}
}
define_element(FormSwitch);

export type { FormSwitch };

/**Creates a switch, the value is a boolean
 * An initial value is where it starts, a writable state is written when the user switches it, a read only state is only shown*/
export function form_switch<ID extends string | undefined = undefined>(
  options: FormSwitchCreateOptions<ID> = {},
): FormSwitch<ID> {
  return FormSwitch.create(options) as FormSwitch<ID>;
}
