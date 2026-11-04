import { Base } from "#base";

/**Event dispatched on a widget when its position, size or rotation changes */
export const WIDGET_TRANSFORM_EVENT = "widget_transform";

/**Shared class for widgets placed at a fixed position in a viewport
 * Position and size are in viewport units (px before any viewport scaling)
 * Rotation is in degrees clockwise around the center of the widget
 *
 * Width and height must always be set, they default to 0
 *
 * Widgets declare their original size, which is the size their content is laid out at
 * The content is then scaled from the original size to the width and height of the widget
 * Widgets that should not stretch, like text, return width and height as their original size
 *
 * WIDGET_TRANSFORM_EVENT is dispatched whenever position, size or rotation changes*/
export abstract class WidgetBase extends Base {
  /**Returns the name used to define the element, Abstract classes should return @abstract@ */
  static element_name() {
    return "@abstract@";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "viewport";
  }

  #x: number = 0;
  #y: number = 0;
  #width: number = 0;
  #height: number = 0;
  #rotation: number = 0;

  constructor() {
    super();
    this.style.position = "absolute";
    this.style.boxSizing = "border-box";
    this.style.transformOrigin = "0 0";
  }

  protected connectedCallback(): void {
    super.connectedCallback();
    this.#update();
  }

  /**Returns the width the content of the widget is laid out at, return this.width to not stretch */
  abstract get original_width(): number;
  /**Returns the height the content of the widget is laid out at, return this.height to not stretch */
  abstract get original_height(): number;

  /**Sets the x position of the left edge of the widget */
  set x(x: number) {
    this.#x = x;
    this.#update();
  }
  /**Returns the x position of the left edge of the widget */
  get x(): number {
    return this.#x;
  }

  /**Sets the y position of the top edge of the widget */
  set y(y: number) {
    this.#y = y;
    this.#update();
  }
  /**Returns the y position of the top edge of the widget */
  get y(): number {
    return this.#y;
  }

  /**Sets the width of the widget */
  set width(width: number) {
    this.#width = width;
    this.#update();
  }
  /**Returns the width of the widget */
  get width(): number {
    return this.#width;
  }

  /**Sets the height of the widget */
  set height(height: number) {
    this.#height = height;
    this.#update();
  }
  /**Returns the height of the widget */
  get height(): number {
    return this.#height;
  }

  /**Sets the rotation of the widget in degrees, rotating clockwise around the center of the widget */
  set rotation(rotation: number) {
    this.#rotation = rotation;
    this.#update();
  }
  /**Returns the rotation of the widget in degrees */
  get rotation(): number {
    return this.#rotation;
  }

  #update() {
    const width = this.#width;
    const height = this.#height;
    const layout_width = this.original_width;
    const layout_height = this.original_height;
    const scale_x = layout_width > 0 ? width / layout_width : 1;
    const scale_y = layout_height > 0 ? height / layout_height : 1;
    this.style.left = this.#x + "px";
    this.style.top = this.#y + "px";
    this.style.width = layout_width + "px";
    this.style.height = layout_height + "px";
    //Scale the layout box to the widget size, then rotate around the center of the widget size
    this.style.transform = `translate(${width / 2}px, ${height / 2}px) rotate(${this.#rotation}deg) translate(${-width / 2}px, ${-height / 2}px) scale(${scale_x}, ${scale_y})`;
    this.dispatchEvent(new Event(WIDGET_TRANSFORM_EVENT));
  }
}
