import type { State } from "@chocbite/ts-lib/state";
import type { WidgetBaseOptions } from "./widget";

interface PropertyBase<T> {
  /**Name shown to the user*/
  name: string;
  /**Explanation shown to the user*/
  description?: string;
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
 * Position, size and rotation are left out, canvas adds them to every widget*/
export type WidgetProperties<O> = {
  [K in Exclude<keyof O, keyof WidgetBaseOptions> & string]?: PropertyFor<
    OptionValue<O[K]>
  >;
};

/**Size of a widget made from a definition without a size*/
export const DEFAULT_WIDGET_SIZE = { width: 100, height: 100 };

/**Properties every widget has, in the order they are shown*/
export function geometry_properties(size: {
  width: number;
  height: number;
}): [string, WidgetProperty][] {
  return [
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
        min: 0,
        max: 360,
        unit: "°",
      },
    ],
  ];
}
