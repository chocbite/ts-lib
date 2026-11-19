import {
  Base,
  CREATE,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import "./widget.scss";

/**Event dispatched on a widget when its position, size or rotation changes */
export const WIDGET_TRANSFORM_EVENT = "widget_transform";

/**Inputs every widget has, its place on the page*/
const WIDGET = {
  /**ID of the widget, unique on its page, named after the widget when the page gives it, like "Box-1"
   * Used by the outline and the menus of canvas, the widget does not use it itself*/
  id: input_key<StateOrVal<string>>(),
  /**Position of the left edge in page units, changed by moving the widget*/
  x: input_key<StateOrVal<number>>(),
  /**Position of the top edge in page units, changed by moving the widget*/
  y: input_key<StateOrVal<number>>(),
  /**Width in page units, changed by resizing the widget*/
  width: input_key<StateOrVal<number>>(),
  /**Height in page units, changed by resizing the widget*/
  height: input_key<StateOrVal<number>>(),
  /**Rotation in degrees clockwise around the center, changed by rotating the widget*/
  rotation: input_key<StateOrVal<number>>(),
  /**Opacity from 0 to 1, fully opaque until given*/
  opacity: input_key<StateOrVal<number>>(),
  /**Whether the widget is shown, visible until given, an editing viewport shows a widget that is not visible faintly*/
  visible: input_key<StateOrVal<boolean>>(),
};
export type WidgetBaseOptions = BaseOptions & InputOptions<typeof WIDGET>;

/**Position, size and rotation of a widget*/
export interface WidgetGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}
type GeometryKey = keyof WidgetGeometry;
const GEOMETRY_KEYS: readonly GeometryKey[] = [
  "x",
  "y",
  "width",
  "height",
  "rotation",
];

/**Internal to canvas, the geometry the widget shows now*/
export const WIDGET_GEOMETRY = Symbol("widget_geometry");
/**Internal to canvas, whether a part of the geometry can be changed by the user*/
export const WIDGET_CHANGEABLE = Symbol("widget_changeable");
/**Internal to canvas, changes the geometry like the user does, see WidgetBase*/
export const WIDGET_CHANGE = Symbol("widget_change");

/**Shared class for widgets placed at a fixed position on a page
 * Position and size are in page units (px before any viewport scaling)
 * Rotation is in degrees clockwise around the center of the widget
 *
 * Position, size and rotation are inputs the user changes, by moving, resizing and rotating the widget in an editing viewport:
 * a writable state is written, an initial value or no value is kept by the widget, and a read only state locks that part
 * Width and height are 0 until given
 *
 * Widgets can lay out their content at an original size, which is then scaled to the width and height of the widget,
 * by overriding original_size, without it the content is laid out at the size of the widget
 *
 * Opacity and visible are inputs too, changed in the properties editor
 *
 * WIDGET_TRANSFORM_EVENT is dispatched whenever position, size or rotation changes*/
export abstract class WidgetBase extends Base {
  /**Returns the name used to define the element, Abstract classes should return @abstract@ */
  static element_name() {
    return "@abstract@";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "canvas";
  }

  #geometry: WidgetGeometry = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };

  constructor() {
    super();
    this.style.position = "absolute";
    this.style.boxSizing = "border-box";
    this.style.transformOrigin = "0 0";
  }

  /**Lays the widget out once, after every constructor has finished, so original_size can use fields of subclasses*/
  [CREATE](options: object): void {
    super[CREATE](options);
    this.#update();
  }

  /**Size the content of the widget is laid out at, before it is scaled to the size of the widget
   * Undefined lays the content out at the size of the widget, so it is not stretched, like text*/
  protected original_size(): { width: number; height: number } | undefined {
    return undefined;
  }

  /**Lays the widget out again, for widgets whose original size changes*/
  protected relayout(): void {
    this.#update();
  }

  /**Widgets that override set call super.set with the options, so position and size are applied*/
  set(options: WidgetBaseOptions): this {
    super.set(options);
    for (const key of GEOMETRY_KEYS)
      this.set_input(WIDGET[key], options[key], (value) => {
        //An error keeps the last good value, the fault icon explains it
        if (!value.ok) return;
        this.#geometry[key] = value.value;
        this.#update();
      });
    //An error shows the widget as it is without the input
    this.set_input(WIDGET.opacity, options.opacity, (opacity) => {
      this.style.opacity = opacity.ok ? String(opacity.value) : "";
    });
    this.set_input(WIDGET.visible, options.visible, (visible) => {
      this.classList.toggle("canvas-invisible", visible.ok && !visible.value);
    });
    return this;
  }

  /**The geometry the widget shows now*/
  get [WIDGET_GEOMETRY](): Readonly<WidgetGeometry> {
    return this.#geometry;
  }

  /**Whether the user can change the part, false only for a read only state*/
  [WIDGET_CHANGEABLE](key: GeometryKey): boolean {
    const given = this.input_state(WIDGET[key]);
    return given === undefined || given.writable;
  }

  /**Changes the geometry like the user does, a writable state is written, an initial value is kept by the widget,
   * parts given as read only states are left unchanged*/
  [WIDGET_CHANGE](change: Partial<WidgetGeometry>): void {
    let kept = false;
    for (const key of GEOMETRY_KEYS) {
      const value = change[key];
      if (value === undefined || value === this.#geometry[key]) continue;
      const given = this.input_state(WIDGET[key]);
      if (given === undefined) {
        this.#geometry[key] = value;
        kept = true;
      } else if (given.writable) void given.write?.(value);
    }
    if (kept) this.#update();
  }

  #update() {
    const { x, y, width, height, rotation } = this.#geometry;
    const original = this.original_size();
    const layout_width = original ? original.width : width;
    const layout_height = original ? original.height : height;
    const scale_x = layout_width > 0 ? width / layout_width : 1;
    const scale_y = layout_height > 0 ? height / layout_height : 1;
    this.style.left = x + "px";
    this.style.top = y + "px";
    this.style.width = layout_width + "px";
    this.style.height = layout_height + "px";
    //Scale the layout box to the widget size, then rotate around the center of the widget size
    this.style.transform = `translate(${width / 2}px, ${height / 2}px) rotate(${rotation}deg) translate(${-width / 2}px, ${-height / 2}px) scale(${scale_x}, ${scale_y})`;
    this.dispatchEvent(new Event(WIDGET_TRANSFORM_EVENT));
  }
}
