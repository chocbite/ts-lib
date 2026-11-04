import { Base, define_element } from "#base";
import type { Page } from "./page";
import "./shared";
import { Transformer } from "./transformer";
import "./viewport.scss";
import type { WidgetBase } from "./widget";

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 20;
/**Zoom factor per wheel pixel */
const WHEEL_ZOOM_SPEED = 0.002;
/**Zoom factor per wheel pixel for touchpad pinch, which reports much smaller deltas than a mouse wheel */
const PINCH_ZOOM_SPEED = 0.01;
/**Screen pixels panned per wheel pixel */
const WHEEL_PAN_SPEED = 0.5;
/**Pixels per line, for wheel events reported in lines */
const WHEEL_LINE_HEIGHT = 16;
/**Speed multiplier for wheel zoom and pan while alt is held */
const WHEEL_SLOW = 0.1;

/**Viewport showing a page of widgets
 * The page is scaled to fit inside the viewport element while keeping its aspect ratio, and centered
 *
 * When edit is true the page can be zoomed and panned, and a checkerboard is shown behind it
 * Wheel and touchpad two finger swipe pans, ctrl + wheel or swipe zooms toward the cursor
 * Shift + vertical wheel pans horizontally
 * Touchpad pinch zooms toward the cursor
 * Holding alt makes wheel zoom and pan 10 times slower
 * Two finger touch pinch zooms and pans, middle or right mouse drag pans
 *
 * Pressing a widget in edit mode selects it and attaches a transformer to move, resize and rotate it
 * Pressing outside any widget clears the selection*/
export class Viewport extends Base {
  /**Returns the name used to define the element */
  static element_name() {
    return "viewport";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "viewport";
  }

  #background: HTMLDivElement = this.appendChild(
    document.createElement("div"),
  );
  #container: HTMLDivElement = this.appendChild(document.createElement("div"));
  #transformer: Transformer = this.appendChild(new Transformer());
  #page: Page | undefined;
  #page_observer = new ResizeObserver(() => {
    this.#update_view();
  });
  #scale: number = 1;
  #fit_x: number = 0;
  #fit_y: number = 0;
  #edit: boolean = false;
  #zoom: number = 1;
  #pan_x: number = 0;
  #pan_y: number = 0;
  #touches = new Map<number, { x: number; y: number }>();
  #pan_pointer_id: number | undefined;
  #pan_pointer_last = { x: 0, y: 0 };
  /**Whether the ctrl key is physically held, to tell touchpad pinch from ctrl + wheel */
  #ctrl_held: boolean = false;

  constructor() {
    super();
    this.#background.className = "checkerboard";
    this.#container.className = "container";
    this.attach_to_resize_observer();
  }

  /**Sets the page shown in the viewport */
  set page(page: Page | undefined) {
    if (this.#page === page) return;
    this.selected = undefined;
    if (this.#page) {
      this.#page_observer.unobserve(this.#page);
      if (this.#page.parentElement === this.#container) this.#page.remove();
    }
    this.#page = page;
    if (page) {
      this.#container.appendChild(page);
      this.#page_observer.observe(page);
    }
    this.#update_view();
  }
  /**Returns the page shown in the viewport */
  get page(): Page | undefined {
    return this.#page;
  }

  /**Sets edit mode, which enables zooming and panning and shows a checkerboard background
   * Leaving edit mode resets the view to fit the page */
  set edit(edit: boolean) {
    if (this.#edit === edit) return;
    this.#edit = edit;
    this.toggleAttribute("edit", edit);
    this.#listen_keys(edit && this.isConnected);
    if (edit) {
      this.addEventListener("wheel", this.#on_wheel, { passive: false });
      this.addEventListener("pointerdown", this.#on_pointer_down);
      this.addEventListener("pointermove", this.#on_pointer_move);
      this.addEventListener("pointerup", this.#on_pointer_up);
      this.addEventListener("pointercancel", this.#on_pointer_up);
      this.addEventListener("mousedown", this.#on_mouse_down);
      this.addEventListener("contextmenu", this.#on_context_menu);
    } else {
      this.removeEventListener("wheel", this.#on_wheel);
      this.removeEventListener("pointerdown", this.#on_pointer_down);
      this.removeEventListener("pointermove", this.#on_pointer_move);
      this.removeEventListener("pointerup", this.#on_pointer_up);
      this.removeEventListener("pointercancel", this.#on_pointer_up);
      this.removeEventListener("mousedown", this.#on_mouse_down);
      this.removeEventListener("contextmenu", this.#on_context_menu);
      this.#touches.clear();
      this.#pan_pointer_id = undefined;
      this.selected = undefined;
      this.#zoom = 1;
      this.#pan_x = 0;
      this.#pan_y = 0;
      this.#update_view();
    }
  }
  /**Returns whether edit mode is enabled */
  get edit(): boolean {
    return this.#edit;
  }

  /**Sets the selected widget, which the transformer is attached to, selection is cleared when leaving edit mode */
  set selected(widget: WidgetBase | undefined) {
    this.#transformer.widget = widget;
  }
  /**Returns the selected widget */
  get selected(): WidgetBase | undefined {
    return this.#transformer.widget;
  }

  /**Returns the current scale from page units to screen pixels */
  get scale(): number {
    return this.#scale;
  }

  protected on_resize(): void {
    this.#update_view();
  }

  protected connectedCallback(): void {
    super.connectedCallback();
    if (this.#edit) this.#listen_keys(true);
  }

  protected disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#listen_keys(false);
  }

  /**Adds or removes the window listeners tracking the ctrl key */
  #listen_keys(listen: boolean) {
    if (listen) {
      window.addEventListener("keydown", this.#on_key);
      window.addEventListener("keyup", this.#on_key);
      window.addEventListener("blur", this.#on_blur);
    } else {
      window.removeEventListener("keydown", this.#on_key);
      window.removeEventListener("keyup", this.#on_key);
      window.removeEventListener("blur", this.#on_blur);
      this.#ctrl_held = false;
    }
  }

  #update_view() {
    if (!this.#page) return;
    const width = this.#page.width;
    const height = this.#page.height;
    if (width <= 0 || height <= 0) return;
    const rect = this.actual_size;
    const fit = Math.min(rect.width / width, rect.height / height);
    this.#fit_x = (rect.width - width * fit) / 2;
    this.#fit_y = (rect.height - height * fit) / 2;
    this.#scale = fit * this.#zoom;
    this.#container.style.transform = `translate(${this.#fit_x + this.#pan_x}px, ${this.#fit_y + this.#pan_y}px) scale(${this.#scale})`;
    this.#transformer.view(
      this.#fit_x + this.#pan_x,
      this.#fit_y + this.#pan_y,
      this.#scale,
    );
  }

  /**Zooms by the factor, keeping the given point in viewport coordinates in place */
  #zoom_at(x: number, y: number, factor: number) {
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.#zoom * factor));
    const ratio = zoom / this.#zoom;
    this.#pan_x += (x - this.#fit_x - this.#pan_x) * (1 - ratio);
    this.#pan_y += (y - this.#fit_y - this.#pan_y) * (1 - ratio);
    this.#zoom = zoom;
  }

  /**Returns the position of the event in viewport coordinates */
  #local(e: MouseEvent): { x: number; y: number } {
    const rect = this.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /**Selects the widget under the pointer, or clears the selection if there is none */
  #select_at(e: PointerEvent) {
    const page = this.#page;
    let element = e.target instanceof Element ? e.target : null;
    while (element && element.parentElement !== page)
      element = element.parentElement;
    this.selected = page?.widgets.find((widget) => widget === element);
  }

  /**Returns center and distance of the first two touches */
  #pinch(): { x: number; y: number; distance: number } | undefined {
    if (this.#touches.size < 2) return undefined;
    const [a, b] = this.#touches.values();
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.hypot(a.x - b.x, a.y - b.y),
    };
  }

  #on_wheel = (e: WheelEvent) => {
    e.preventDefault();
    const unit =
      e.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? WHEEL_LINE_HEIGHT
        : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? this.actual_size.height
          : 1;
    const delta_x = e.deltaX * unit;
    const delta_y = e.deltaY * unit;
    const speed = e.altKey ? WHEEL_SLOW : 1;
    if (e.ctrlKey) {
      //Browsers report touchpad pinch as ctrl + wheel, without the ctrl key being held
      const zoom_speed = this.#ctrl_held ? WHEEL_ZOOM_SPEED : PINCH_ZOOM_SPEED;
      const point = this.#local(e);
      this.#zoom_at(point.x, point.y, Math.exp(-delta_y * zoom_speed * speed));
    } else {
      //Shift makes the vertical wheel pan horizontally, some browsers already swap the deltas themselves
      const swap = e.shiftKey && delta_x === 0;
      this.#pan_x -= (swap ? delta_y : delta_x) * speed * WHEEL_PAN_SPEED;
      this.#pan_y -= (swap ? 0 : delta_y) * speed * WHEEL_PAN_SPEED;
    }
    this.#update_view();
  };

  #on_pointer_down = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      //Only the first touch selects, so a second finger can pinch without changing the selection
      if (this.#touches.size === 0 && !this.#transformer.dragging)
        this.#select_at(e);
      this.#touches.set(e.pointerId, this.#local(e));
      this.setPointerCapture(e.pointerId);
    } else if (e.button === 0) {
      this.#select_at(e);
    } else if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      this.#pan_pointer_id = e.pointerId;
      this.#pan_pointer_last = this.#local(e);
      this.setPointerCapture(e.pointerId);
    }
  };

  #on_pointer_move = (e: PointerEvent) => {
    this.#ctrl_held = e.ctrlKey;
    if (this.#touches.has(e.pointerId)) {
      const before = this.#pinch();
      this.#touches.set(e.pointerId, this.#local(e));
      const after = this.#pinch();
      if (!before || !after || before.distance <= 0) return;
      this.#pan_x += after.x - before.x;
      this.#pan_y += after.y - before.y;
      this.#zoom_at(after.x, after.y, after.distance / before.distance);
      this.#update_view();
    } else if (e.pointerId === this.#pan_pointer_id) {
      const point = this.#local(e);
      this.#pan_x += point.x - this.#pan_pointer_last.x;
      this.#pan_y += point.y - this.#pan_pointer_last.y;
      this.#pan_pointer_last = point;
      this.#update_view();
    }
  };

  #on_pointer_up = (e: PointerEvent) => {
    this.#touches.delete(e.pointerId);
    if (e.pointerId === this.#pan_pointer_id) this.#pan_pointer_id = undefined;
  };

  /**Prevents the browser autoscroll on middle mouse button */
  #on_mouse_down = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault();
  };

  /**Prevents the context menu, as the right mouse button pans in edit mode */
  #on_context_menu = (e: MouseEvent) => {
    e.preventDefault();
  };

  #on_key = (e: KeyboardEvent) => {
    this.#ctrl_held = e.ctrlKey;
  };

  #on_blur = () => {
    this.#ctrl_held = false;
  };
}
define_element(Viewport);
