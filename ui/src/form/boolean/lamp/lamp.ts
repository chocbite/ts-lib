import { define_element } from "#base";
import type { Option } from "@chocbite/ts-lib/result";
import type { SVGFunc } from "#svg";
import { FormValue, type FormColors, type FormValueOptions } from "../../base";
import "./lamp.scss";

export interface FormLampOptions<
  T extends boolean | number,
  C extends FormColors[],
  ID extends string | undefined,
> extends FormValueOptions<T, ID> {
  /**Sets the lamp colors */
  colors: C;
  /**Lamp text */
  text?: string;
  /**Icon for lamp */
  icon?: SVGFunc;
  /**Centers text and icon */
  center?: boolean;
}

export class FormLamp<
  T extends boolean | number,
  C extends FormColors[],
  ID extends string | undefined,
> extends FormValue<T, ID> {
  static element_name() {
    return "lamp";
  }
  static element_name_space(): string {
    return "form";
  }

  #text: HTMLSpanElement = this.appendChild(document.createElement("span"));
  #icon: SVGSVGElement | undefined;
  #colors: FormColors[] = [];

  /**Sets the current text of the lamp*/
  set text(label: string) {
    this.#text.textContent = label;
  }
  get text() {
    return this.#text.textContent;
  }

  /**Changes the icon of the lamp*/
  set icon(icon: SVGFunc | undefined) {
    if (this.#icon) this.removeChild(this.#icon);
    this.#icon = icon ? this.insertBefore(icon(), this.#text) : undefined;
  }

  /** Sets the background color of the lamp*/
  set colors(colors: C) {
    this.#colors = colors;
    this.new_value(this.buffer!);
  }

  /**Centers text and icon */
  set center(center: boolean) {
    if (center) this.classList.add("center");
    else this.classList.remove("center");
  }

  get center() {
    return this.classList.contains("center");
  }

  /**Called when value is changed */
  protected new_value(value: number | boolean) {
    const color = this.#colors[Number(value)];
    if (color) this.setAttribute("color", color);
    else this.removeAttribute("color");
  }

  protected clear_value(): void {
    this.removeAttribute("color");
  }

  protected new_error(err: string): void {
    console.error(err);
  }

  protected clear_error(): void {}

  protected state_related(_related: Option<{}>): void {}
}
define_element(FormLamp);

/**Creates a button form element */
function from<ID extends string | undefined>(
  options?: FormLampOptions<
    number,
    [FormColors, FormColors, FormColors, ...FormColors[]],
    ID
  >,
): FormLamp<number, [FormColors, FormColors, FormColors, ...FormColors[]], ID>;
function from<ID extends string | undefined>(
  options?: FormLampOptions<boolean, [FormColors, FormColors], ID>,
): FormLamp<boolean, [FormColors, FormColors], ID>;
function from<
  T extends boolean | number,
  C extends FormColors[],
  ID extends string | undefined,
>(options?: FormLampOptions<T, C, ID>): FormLamp<T, C, ID> {
  const lamp = new FormLamp<T, C, ID>(options?.id);
  if (options) {
    lamp.colors = options.colors;
    if (options.text) lamp.text = options.text;
    if (options.icon) lamp.icon = options.icon;
    if (options.center) lamp.center = options.center;
    FormValue.apply_options(lamp, options);
  }
  return lamp;
}

/**Creates a button form element */
export const form_lamp = from;
