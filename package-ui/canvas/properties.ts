import { err_nice, ok, type ResultNice } from "@chocbite/ts-lib/result";
import type { State } from "@chocbite/ts-lib/state";
import { link_errors } from "./link";
import type { WidgetBaseOptions } from "./widget";

interface PropertyBase<T> {
  /**Name shown to the user*/
  name: string;
  /**Explanation shown to the user*/
  description?: string;
  /**Name of the section the property is shown in, properties of the same section are grouped,
   * at the root of the properties editor when undefined or empty*/
  section?: string;
  /**False leaves the option without a link column chain in the properties editor, so it can not be linked, true when undefined*/
  linkable?: boolean;
  /**Value of a new widget*/
  default: T;
}

/**A number, like a size or an angle*/
export interface NumberProperty extends PropertyBase<number> {
  kind: "number";
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  unit?: string;
}

/**A text*/
export interface TextProperty extends PropertyBase<string> {
  kind: "text";
  max_length?: number;
}

/**A color, as a CSS color string*/
export interface ColorProperty extends PropertyBase<string> {
  kind: "color";
  /**True lets the user set the alpha, the color is then written like #ff880080, transparent shows as no alpha*/
  alpha?: boolean;
}

/**On or off*/
export interface BooleanProperty extends PropertyBase<boolean> {
  kind: "boolean";
}

/**One of a list of strings*/
export interface EnumProperty<
  K extends string = string,
> extends PropertyBase<K> {
  kind: "enum";
  /**The values, with the names shown to the user*/
  list: { [P in K]: { name: string; description?: string } };
}

/**A value of a widget the user changes, describing how it is edited and what a new widget starts with*/
export type WidgetProperty =
  | NumberProperty
  | TextProperty
  | ColorProperty
  | BooleanProperty
  | EnumProperty;

/**Value type of an option, without the state part*/
type OptionValue<V> = Exclude<V, State<any, any, any> | undefined>;

/**The kinds of property an option of a value type can have*/
type PropertyFor<V> = [V] extends [boolean]
  ? BooleanProperty
  : [V] extends [number]
    ? NumberProperty
    : [V] extends [string]
      ? string extends V
        ? TextProperty | ColorProperty
        : EnumProperty<V & string>
      : never;

/**Properties of a widget, by option, typed by the options of the widget
 * The id, position, size, rotation, opacity and visible are left out, canvas adds them to every widget*/
export type WidgetProperties<O> = {
  [K in Exclude<keyof O, keyof WidgetBaseOptions> & string]?: PropertyFor<
    OptionValue<O[K]>
  >;
};

/**Size of a widget made from a definition without a size*/
export const DEFAULT_WIDGET_SIZE = { width: 100, height: 100 };

/**Section of the properties every widget has*/
export const BASE_SECTION = "General";

/**Properties every widget has, in the order they are shown, in the General section*/
export function base_properties(size: {
  width: number;
  height: number;
}): [string, WidgetProperty][] {
  const properties: [string, WidgetProperty][] = [
    //Unique on the page, given by the page when empty or taken, see ids.ts
    ["id", { kind: "text", name: "ID", default: "", linkable: false }],
    ["x", { kind: "number", name: "X", default: 0, unit: "px" }],
    ["y", { kind: "number", name: "Y", default: 0, unit: "px" }],
    [
      "width",
      {
        kind: "number",
        name: "Width",
        default: size.width,
        min: 1,
        unit: "px",
      },
    ],
    [
      "height",
      {
        kind: "number",
        name: "Height",
        default: size.height,
        min: 1,
        unit: "px",
      },
    ],
    [
      "rotation",
      {
        kind: "number",
        name: "Rotation",
        default: 0,
        unit: "°",
      },
    ],
    [
      "opacity",
      {
        kind: "number",
        name: "Opacity",
        default: 1,
        min: 0,
        max: 1,
        step: 0.05,
        decimals: 2,
      },
    ],
    ["visible", { kind: "boolean", name: "Visible", default: true }],
  ];
  for (const [, property] of properties) property.section = BASE_SECTION;
  return properties;
}

/**A value as text, objects as JSON*/
export const as_text = (value: unknown): string =>
  typeof value === "object" && value !== null
    ? JSON.stringify(value)
    : String(value);

/**Converts a value to the type of a kind of property, like the value of a state linked to the option
 * Numbers with Number, so a boolean is 0 or 1, texts with String and booleans with Boolean,
 * a value that gives no number, like the text "abc", is an error*/
export function property_value(
  kind: WidgetProperty["kind"],
  value: unknown,
): ResultNice<unknown> {
  switch (kind) {
    case "number": {
      const number = Number(value);
      return Number.isNaN(number)
        ? err_nice(link_errors.CONVERT, `${as_text(value)} is not a number`)
        : ok(number);
    }
    case "text":
    case "color":
    case "enum":
      return ok(as_text(value));
    case "boolean":
      return ok(Boolean(value));
  }
}
