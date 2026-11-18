import {
  Base,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import type { CanvasPage, CanvasWidget } from "./data";
import "./page.scss";
import "./shared";
import { WIDGET_ELEMENTS_EVENT, WidgetSlot } from "./slot";
import type { WidgetBase } from "./widget";

/**Inputs of the page element, the values of a CanvasPage*/
const PAGE = {
  width: input_key<StateOrVal<number>>(),
  height: input_key<StateOrVal<number>>(),
  widgets: input_key<StateOrVal<readonly CanvasWidget[]>>(),
};
type PageElementOptions = BaseOptions & InputOptions<typeof PAGE>;

/**Element showing a page in one viewport, internal to canvas, the viewport makes it from the page data
 * Every widget gets a slot, which makes the widget element, the order of the slots is the drawing order*/
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

  constructor() {
    super();
    this.style.width = this.#width + "px";
    this.style.height = this.#height + "px";
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
    this.set_input(PAGE.widgets, options.widgets, (widgets) => {
      //An error keeps the widgets shown, the fault icon explains it
      if (widgets.ok) this.#apply(widgets.value);
    });
    return this;
  }

  /**Makes the slots follow the widgets by identity, so only slots of added, removed or moved widgets are touched
   * The array is compared as a whole every time, so changes missed while the page was not in the document do not matter*/
  #apply(widgets: readonly CanvasWidget[]): void {
    const slots = this.children as HTMLCollectionOf<WidgetSlot>;
    const old = new Map<CanvasWidget, WidgetSlot>();
    for (const slot of slots) old.set(slot.widget, slot);
    const next: WidgetSlot[] = [];
    const seen = new Set<CanvasWidget>();
    for (const widget of widgets) {
      if (seen.has(widget)) continue;
      seen.add(widget);
      next.push(old.get(widget) ?? WidgetSlot.create({}, widget));
      old.delete(widget);
    }
    for (const slot of old.values()) slot.remove();
    for (let i = 0; i < next.length; i++)
      if (slots[i] !== next[i]) this.insertBefore(next[i], slots[i] ?? null);
    this.dispatchEvent(new Event(WIDGET_ELEMENTS_EVENT, { bubbles: true }));
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
    widgets: page.widgets,
  });
}
