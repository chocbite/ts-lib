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
import "../../shared";
import "./button.scss";

/**Inputs of the button*/
const BUTTON = {
  /**Text of the button, an error shows its nice text*/
  text: input_key<StateOrVal<string>>(),
  /**Icon in front of the text, undefined for none, an error shows none*/
  icon: input_key<StateOrVal<SVGFunc | undefined>>(),
  /**Called when the button is clicked*/
  on_click: input_key<() => void>(),
  /**True makes the button toggle its value on every click, false makes it momentary, true while pressed*/
  toggle: input_key<StateOrVal<boolean>>(),
  /**Color of the button, None for the default, an error gives the default*/
  color: input_key<StateOrVal<FormColors>>(),
  /**Centers the text and icon*/
  center: input_key<StateOrVal<boolean>>(),
};
export type FormButtonOptions = FormValueWriteOptions<boolean> &
  InputOptions<typeof BUTTON>;
export type FormButtonCreateOptions<ID extends string | undefined> =
  FormButtonOptions & FormValueCreateOptions<ID>;

class FormButton<
  ID extends string | undefined = string | undefined,
> extends FormValueWrite<boolean, ID> {
  static element_name() {
    return "button";
  }
  static element_name_space(): string {
    return "form";
  }

  #text: HTMLSpanElement = this.appendChild(document.createElement("span"));
  #on_click?: () => void;
  #toggle?: boolean;
  #icon?: SVGSVGElement;

  constructor() {
    super();

    this.appendChild(this.warn_input);
    this.setAttribute("tabindex", "0");
    this.onclick = () => {
      if (this.#on_click) this.#on_click();
    };
    this.onpointerdown = (e) => {
      if (e.pointerType !== "touch" && e.button === 0) {
        e.stopPropagation();
        this.setPointerCapture(e.pointerId);
        if (!this.#toggle) this.set_value_check(true);
        this.onpointerup = (ev) => {
          ev.stopPropagation();
          this.releasePointerCapture(ev.pointerId);
          if (this.#toggle) this.set_value_check(!this.buffer);
          else this.set_value_check(false);
          this.onpointerup = null;
          this.onpointercancel = null;
        };
        //A cancelled press releases a momentary button and does not toggle a toggle button
        this.onpointercancel = (ev) => {
          this.releasePointerCapture(ev.pointerId);
          if (!this.#toggle) this.set_value_check(false);
          this.onpointerup = null;
          this.onpointercancel = null;
        };
      }
    };
    this.ontouchstart = (e) => {
      e.stopPropagation();
      if (!this.#toggle) this.set_value_check(true);
      this.ontouchend = (ev) => {
        ev.stopPropagation();
        if (ev.targetTouches.length === 0) {
          if (this.#toggle) this.set_value_check(!this.buffer);
          else this.set_value_check(false);
          this.ontouchend = null;
          this.ontouchcancel = null;
        }
      };
      this.ontouchcancel = () => {
        if (!this.#toggle) this.set_value_check(false);
        this.ontouchend = null;
        this.ontouchcancel = null;
      };
    };
    this.onkeydown = (e) => {
      switch (e.key) {
        case " ":
        case "Enter": {
          e.stopPropagation();
          e.preventDefault();
          if (!this.#toggle) this.set_value_check(true);
          this.onkeyup = (e) => {
            switch (e.key) {
              case "Enter":
              case " ": {
                e.stopPropagation();
                e.preventDefault();
                this.onkeyup = null;
                if (this.#toggle) this.set_value_check(!this.buffer);
                else this.set_value_check(false);
                if (this.#on_click) this.#on_click();
                break;
              }
            }
          };
          break;
        }
      }
    };
  }

  focus(options?: FocusOptions): void {
    HTMLElement.prototype.focus.call(this, options);
  }

  set(options: FormButtonOptions): this {
    super.set(options);
    this.set_input(BUTTON.text, options.text, (text) => {
      this.#text.textContent = text.ok ? text.value : text.error.nice;
    });
    this.set_input(BUTTON.icon, options.icon, (icon) => {
      this.#icon?.remove();
      this.#icon =
        icon.ok && icon.value
          ? this.insertBefore(icon.value(), this.#text)
          : undefined;
    });
    this.set_input(BUTTON.on_click, options.on_click, (on_click) => {
      this.#on_click = on_click.value;
    });
    this.set_input(BUTTON.toggle, options.toggle, (toggle) => {
      this.#toggle = toggle.ok && toggle.value;
    });
    this.set_input(BUTTON.color, options.color, (color) => {
      if (color.ok && color.value !== FormColors.None)
        this.setAttribute("color", color.value);
      else this.removeAttribute("color");
    });
    this.set_input(BUTTON.center, options.center, (center) => {
      this.classList.toggle("center", center.ok && center.value);
    });
    return this;
  }

  /**Called when value is changed */
  protected new_value(value: boolean) {
    if (value) this.classList.add("active");
    else this.classList.remove("active");
  }

  protected clear_value(): void {
    this.new_value(false);
  }

  protected state_related(_related: Option<{}>): void {}
}
define_element(FormButton);

export type { FormButton };

/**Creates a button, its value is true while pressed, or toggles on every click with toggle*/
export function form_button<ID extends string | undefined = undefined>(
  options: FormButtonCreateOptions<ID> = {},
): FormButton<ID> {
  return FormButton.create(options) as FormButton<ID>;
}
