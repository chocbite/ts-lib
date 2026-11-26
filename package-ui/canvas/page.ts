import {
  Base,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import { state_ui } from "#state_ui";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import type { CanvasPage, CanvasWidget } from "./data";
import "./page.scss";
import "./shared";
import { geometry_now } from "./geometry";
import { WidgetSlot } from "./slot";
import type { WidgetBase } from "./widget";

/**Inputs of the page element, the values of a CanvasPage*/
const PAGE = {
  width: input_key<StateOrVal<number>>(),
  height: input_key<StateOrVal<number>>(),
  background: input_key<StateOrVal<string>>(),
  widgets: input_key<StateOrVal<readonly CanvasWidget[]>>(),
};
type PageElementOptions = BaseOptions & InputOptions<typeof PAGE>;

/**Element showing a page in one viewport, internal to canvas, the viewport makes it from the page data
 * Every widget gets a slot, which makes the widget element, the order of the slots is the drawing order
 * It only shows the page, the page keeps the ids of its widgets unique itself, see CanvasPage*/
export class PageElement extends Base {
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

  #widgets: readonly CanvasWidget[] = [];

  constructor() {
    super();
    this.style.width = this.#width + "px";
    this.style.height = this.#height + "px";
  }

  /**The widgets shown, in drawing order*/
  get widgets(): readonly CanvasWidget[] {
    return this.#widgets;
  }

  /**Width of the page in page units*/
  get page_width(): number {
    return this.#width;
  }
  /**Height of the page in page units*/
  get page_height(): number {
    return this.#height;
  }

  /**The widget elements in drawing order*/
  get widget_elements(): WidgetBase[] {
    const elements: WidgetBase[] = [];
    for (const slot of this.children as HTMLCollectionOf<WidgetSlot>) {
      const element = slot.element;
      if (element) elements.push(element);
    }
    return elements;
  }

  set(options: PageElementOptions): this {
    super.set(options);
    this.set_input(PAGE.width, options.width, (width) => {
      if (!width.ok) return;
      this.#width = width.value;
      this.style.width = width.value + "px";
    });
    this.set_input(PAGE.height, options.height, (height) => {
      if (!height.ok) return;
      this.#height = height.value;
      this.style.height = height.value + "px";
    });
    this.set_input(PAGE.background, options.background, (background) => {
      //An error shows the background of the theme
      this.style.background = background.ok ? background.value : "";
    });
    this.set_input(PAGE.widgets, options.widgets, (widgets) => {
      //An error keeps the widgets shown, the fault icon explains it
      if (widgets.ok) this.#apply(widgets.value);
    });
    return this;
  }

  /**Makes the slots follow the widgets, a slot per widget in drawing order
   * The changes an array state gives, like a move, touch only their slots, a whole array, like after the page was out
   * of the document, reuses the slots by place, a slot given another widget makes its element again*/
  #apply(widgets: readonly CanvasWidget[]): void {
    state_ui.a.apply(this, widgets, {
      create: (widget) => WidgetSlot.create({}, widget),
      update: (slot, widget) => (slot.widget = widget),
    });
    this.#widgets = widgets;
  }

  /**The widgets whose outline covers the point on the page, in front first, invisible ones included
   * A rotated widget is found by its rotated outline, a widget whose geometry has no value now is not found*/
  widgets_at(x: number, y: number): CanvasWidget[] {
    const found: CanvasWidget[] = [];
    for (let i = this.#widgets.length - 1; i >= 0; i--) {
      const widget = this.#widgets[i];
      const geometry = geometry_now(widget);
      if (!geometry) continue;
      const { x: left, y: top, width, height, rotation } = geometry;
      //The point turned back around the center of the widget, into the frame of the widget
      const cx = left + width / 2;
      const cy = top + height / 2;
      const radians = (-rotation * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const dx = (x - cx) * cos - (y - cy) * sin;
      const dy = (x - cx) * sin + (y - cy) * cos;
      if (Math.abs(dx) <= width / 2 && Math.abs(dy) <= height / 2)
        found.push(widget);
    }
    return found;
  }

  /**The slot of a widget, undefined when the widget is not on the page*/
  slot_of(widget: CanvasWidget): WidgetSlot | undefined {
    for (const slot of this.children as HTMLCollectionOf<WidgetSlot>)
      if (slot.widget === widget) return slot;
    return undefined;
  }
}
define_element(PageElement);

/**Makes the element showing the page in one viewport*/
export function page_element(page: CanvasPage): PageElement {
  return PageElement.create({
    width: page.width,
    height: page.height,
    background: page.background,
    widgets: page.children,
  });
}
