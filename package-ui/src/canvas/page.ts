import { Base, define_element } from "#base";
import "./page.scss";
import "./shared";
import type { WidgetBase } from "./widget";

/**Page of widgets with a fixed size
 * Width and height are the size of the page in page units (px before any viewport scaling)*/
export class Page extends Base {
  /**Returns the name used to define the element */
  static element_name() {
    return "page";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "canvas";
  }

  #width: number = 1920;
  #height: number = 1080;
  #widgets: readonly WidgetBase[] = [];

  constructor() {
    super();
    this.style.width = this.#width + "px";
    this.style.height = this.#height + "px";
  }

  /**Sets the width of the page */
  set width(width: number) {
    this.#width = width;
    this.style.width = width + "px";
  }
  /**Returns the width of the page */
  get width(): number {
    return this.#width;
  }

  /**Sets the height of the page */
  set height(height: number) {
    this.#height = height;
    this.style.height = height + "px";
  }
  /**Returns the height of the page */
  get height(): number {
    return this.#height;
  }

  /**Sets the widgets on the page, the array order is the drawing order with the last widget on top
   * Widgets already on the page are kept in place, so they are only reconnected if their order changes */
  set widgets(widgets: readonly WidgetBase[]) {
    const keep = new Set(widgets);
    for (const widget of this.#widgets)
      if (!keep.has(widget) && widget.parentElement === this) widget.remove();
    for (let i = 0; i < widgets.length; i++) {
      const current = this.children[i];
      if (current !== widgets[i])
        this.insertBefore(widgets[i], current ?? null);
    }
    this.#widgets = widgets;
  }
  /**Returns the widgets on the page */
  get widgets(): readonly WidgetBase[] {
    return this.#widgets;
  }
}
define_element(Page);

export interface CanvasPageOptions {
  /**Width of the page in page units, defaults to 1920 */
  width?: number;
  /**Height of the page in page units, defaults to 1080 */
  height?: number;
  /**Widgets on the page, the last widget is drawn on top */
  widgets?: readonly WidgetBase[];
}

/**Creates a page of widgets with a fixed size */
export const canvas_page = (options?: CanvasPageOptions): Page =>
  options ? new Page().opts(options) : new Page();
