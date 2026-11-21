import { define_element, input_key, type InputOptions } from "#base";
import type { Option } from "@chocbite/ts-lib/result";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import {
  FormValueWrite,
  type FormValueCreateOptions,
  type FormValueWriteOptions,
} from "../../base";
import "./color_input.scss";

/**Inputs of the color input*/
const COLOR = {
  /**True writes the color while the user picks it, false only when the picker closes*/
  live: input_key<StateOrVal<boolean>>(),
  /**True adds an alpha slider and writes colors with alpha, like #ff880080, false writes colors like #ff8800
   * A value with alpha is shown with it either way*/
  alpha: input_key<StateOrVal<boolean>>(),
};
export type FormColorOptions = FormValueWriteOptions<string> &
  InputOptions<typeof COLOR>;
export type FormColorCreateOptions<ID extends string | undefined> =
  FormColorOptions & FormValueCreateOptions<ID>;

/**A color as the native color input takes it, and its alpha from 0 to 1*/
interface Parsed {
  hex: string;
  alpha: number;
}

/**Reads #rgb, #rrggbb, #rrggbbaa and transparent, other colors are shown as they are, with black for the native picker*/
function parse(color: string): Parsed {
  const text = color.trim().toLowerCase();
  if (text === "transparent") return { hex: "#000000", alpha: 0 };
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
  if (short)
    return {
      hex: `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`,
      alpha: 1,
    };
  const long = /^(#[0-9a-f]{6})([0-9a-f]{2})?$/.exec(text);
  if (long)
    return {
      hex: long[1],
      alpha: long[2] === undefined ? 1 : Number.parseInt(long[2], 16) / 255,
    };
  return { hex: "#000000", alpha: 1 };
}

/**The color with its alpha as #rrggbbaa*/
const with_alpha = (hex: string, alpha: number) =>
  hex +
  Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");

/**Color input, the value is a hex color like #ff8800, or with alpha like #ff880080 when alpha is on
 * The swatch shows the color over a checkerboard, so alpha shows, a click opens the color picker of the browser,
 * the alpha slider beside it sets the alpha, the native input has the alpha as data-alpha for the on-screen keyboard*/
class FormColor<
  ID extends string | undefined = string | undefined,
> extends FormValueWrite<string, ID> {
  static element_name() {
    return "colorinput";
  }
  static element_name_space(): string {
    return "form";
  }

  #live: boolean = false;
  #with_alpha: boolean = false;
  /**The alpha shown, from 0 to 1*/
  #alpha: number = 1;
  #swatch = this.appendChild(document.createElement("div"));
  #fill = this.#swatch.appendChild(document.createElement("div"));
  #slider: HTMLInputElement | undefined;

  constructor() {
    super();
    this.#swatch.className = "swatch";
    this.#swatch.appendChild(this.warn_input);
    this.warn_input.type = "color";
    this.warn_input.oninput = () => {
      this.#show_picked();
      if (this.#live) void this.set_value_check(this.#picked());
    };
    this.warn_input.onchange = () => {
      this.#show_picked();
      if (!this.#live) void this.set_value_check(this.#picked());
    };
  }

  set(options: FormColorOptions): this {
    super.set(options);
    this.set_input(COLOR.live, options.live, (live) => {
      this.#live = live.ok && live.value;
    });
    this.set_input(COLOR.alpha, options.alpha, (alpha) => {
      this.#set_alpha_option(alpha.ok && alpha.value);
    });
    return this;
  }

  #set_alpha_option(on: boolean) {
    this.#with_alpha = on;
    if (on && !this.#slider) {
      const slider = this.appendChild(document.createElement("input"));
      slider.type = "range";
      slider.className = "alpha";
      slider.min = "0";
      slider.max = "100";
      slider.title = "Alpha";
      slider.oninput = () => {
        this.#set_alpha(Number(slider.value) / 100);
        if (this.#live) void this.set_value_check(this.#picked());
      };
      slider.onchange = () => {
        this.#set_alpha(Number(slider.value) / 100);
        if (!this.#live) void this.set_value_check(this.#picked());
      };
      this.#slider = slider;
    } else if (!on && this.#slider) {
      this.#slider.remove();
      this.#slider = undefined;
    }
    this.#show_alpha();
  }

  /**The value picked now, the color of the native input, with the alpha when alpha is on,
   * the on-screen keyboard can have written the alpha to the native input*/
  #picked(): string {
    if (!this.#with_alpha) return this.warn_input.value;
    const written = Number(this.warn_input.dataset.alpha);
    if (!Number.isNaN(written)) this.#alpha = written;
    return with_alpha(this.warn_input.value, this.#alpha);
  }

  /**Shows what is picked, before it is written*/
  #show_picked() {
    if (this.#with_alpha) {
      const written = Number(this.warn_input.dataset.alpha);
      if (!Number.isNaN(written)) this.#alpha = written;
    }
    this.#fill.style.backgroundColor = this.#with_alpha
      ? with_alpha(this.warn_input.value, this.#alpha)
      : this.warn_input.value;
    this.#show_alpha();
  }

  #set_alpha(alpha: number) {
    this.#alpha = alpha;
    //First, the native input holds the alpha the picked value is read with
    this.#show_alpha();
    this.#show_picked();
  }

  /**Shows the alpha on the slider, and gives it to the native input for the on-screen keyboard*/
  #show_alpha() {
    if (this.#slider)
      this.#slider.value = String(Math.round(this.#alpha * 100));
    if (this.#with_alpha) this.warn_input.dataset.alpha = String(this.#alpha);
    else delete this.warn_input.dataset.alpha;
  }

  protected new_value(val: string): void {
    const parsed = parse(val);
    this.warn_input.value = parsed.hex;
    this.#alpha = parsed.alpha;
    //Shown as given, so colors the native input does not take show too
    this.#fill.style.backgroundColor = val;
    this.#show_alpha();
  }

  protected clear_value(): void {
    this.warn_input.value = "#000000";
    this.#alpha = 1;
    this.#fill.style.backgroundColor = "";
    this.#show_alpha();
  }

  protected state_related(_related: Option<{}>): void {}
}
define_element(FormColor);

export type { FormColor };

/**Creates a color input, the value is a hex color like #ff8800, with alpha like #ff880080 when alpha is on*/
export function form_color<ID extends string | undefined = undefined>(
  options: FormColorCreateOptions<ID> = {},
): FormColor<ID> {
  return FormColor.create(options) as FormColor<ID>;
}
