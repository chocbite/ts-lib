import { define_element, input_key, type InputOptions } from "#base";
import type { Option } from "@chocbite/ts-lib/result";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import type { SVGFunc } from "#svg";
import {
  FormValue,
  type FormColors,
  type FormValueCreateOptions,
  type FormValueOptions,
} from "../../base";
import "./lamp.scss";

/**Inputs of the lamp, the colors are typed by the lamp, so the key is loose*/
const LAMP = {
  colors: input_key<StateOrVal<FormColors[]>>(),
  /**Text of the lamp, an error shows its nice text*/
  text: input_key<StateOrVal<string>>(),
  /**Icon in front of the text, undefined for none, an error shows none*/
  icon: input_key<StateOrVal<SVGFunc | undefined>>(),
  /**Centers the text and icon*/
  center: input_key<StateOrVal<boolean>>(),
};

/**Options of a lamp with value T, colors C decide the value, two colors a boolean, more a number*/
export type FormLampOptions<
  T extends boolean | number,
  C extends FormColors[],
> = FormValueOptions<T> &
  Omit<InputOptions<typeof LAMP>, "colors"> & {
    /**Color for each value, the first for false or 0, an error shows no color*/
    colors?: StateOrVal<C>;
  };
/**Options of a lamp given at creation, the colors are needed, as they decide the value*/
export type FormLampCreateOptions<
  T extends boolean | number,
  C extends FormColors[],
  ID extends string | undefined,
> = FormLampOptions<T, C> &
  FormValueCreateOptions<ID> & {
    colors: StateOrVal<C>;
  };

/**Shows a value as a color, only shows, the user can not change it*/
class FormLamp<
  T extends boolean | number = boolean | number,
  C extends FormColors[] = FormColors[],
  ID extends string | undefined = string | undefined,
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

  set(options: FormLampOptions<T, C>): this {
    super.set(options);
    this.set_input(LAMP.colors, options.colors, (colors) => {
      this.#colors = colors.ok ? colors.value : [];
      if (this.buffer === undefined) this.clear_value();
      else this.new_value(this.buffer);
    });
    this.set_input(LAMP.text, options.text, (text) => {
      this.#text.textContent = text.ok ? text.value : text.error.nice;
    });
    this.set_input(LAMP.icon, options.icon, (icon) => {
      this.#icon?.remove();
      this.#icon =
        icon.ok && icon.value
          ? this.insertBefore(icon.value(), this.#text)
          : undefined;
    });
    this.set_input(LAMP.center, options.center, (center) => {
      this.classList.toggle("center", center.ok && center.value);
    });
    return this;
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

  protected state_related(_related: Option<{}>): void {}
}
define_element(FormLamp);

export type { FormLamp };

/**Creates a lamp showing a value as a color, two colors give a boolean value, more a number*/
function form_lamp<ID extends string | undefined = undefined>(
  options: FormLampCreateOptions<
    number,
    [FormColors, FormColors, FormColors, ...FormColors[]],
    ID
  >,
): FormLamp<number, [FormColors, FormColors, FormColors, ...FormColors[]], ID>;
function form_lamp<ID extends string | undefined = undefined>(
  options: FormLampCreateOptions<boolean, [FormColors, FormColors], ID>,
): FormLamp<boolean, [FormColors, FormColors], ID>;
function form_lamp(
  options: FormLampCreateOptions<boolean | number, FormColors[], undefined>,
): FormLamp {
  return FormLamp.create(options);
}
export { form_lamp };
