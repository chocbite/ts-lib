import {
  Base,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import ctm from "#context_menu";
import { state_ui } from "#state_ui";
import state, { type StateOrVal } from "@chocbite/ts-lib/state";
import type { CanvasPage, CanvasWidget } from "./data";
import { GroupRotation } from "./group";
import { widget_id, widget_name } from "./ids";
import { clipboard_events, edit_lines, paste_line } from "./clipboard";
import { delete_line, order_lines, remove_widgets } from "./order";
import { page_element, type PageElement } from "./page";
import { WIDGET_ELEMENTS_EVENT, WidgetSlot } from "./slot";
import "./shared";
import { Transformer } from "./transformer";
import "./viewport.scss";
import type { WidgetBase } from "./widget";

/**Inputs of the viewport*/
const VIEWPORT = {
  /**Page shown, data that any number of viewports can show at once, undefined shows nothing*/
  page: input_key<StateOrVal<CanvasPage | undefined>>(),
  /**Enables zooming, panning and changing widgets, leaving it resets the view and clears the selection*/
  edit: input_key<StateOrVal<boolean>>(),
  /**Selected widgets of the page, the transformer is shown on them in edit mode
   * Pressing a widget selects only it, ctrl or shift toggles it, pressing the page clears the selection and dragging on it selects
   * the widgets inside the rectangle: a writable state is written, with array instructions, so viewports, outlines and a properties editor
   * can share the selection, an initial value or no value is kept by the viewport, a read only state can not be changed by the user
   * The viewport only changes the selection when the user presses, never on its own*/
  selected: input_key<StateOrVal<readonly CanvasWidget[]>>(),
};
export type CanvasViewportOptions = BaseOptions & InputOptions<typeof VIEWPORT>;

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
/**Pixels a right press can move and still open the menu instead of panning */
const MENU_SLOP = 4;

/**Viewport showing a page of widgets
 * The viewport makes its own elements for the page and its widgets, so a page can be shown in several viewports at once
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
 * Pressing outside any widget clears the selection, see the selected input
 *
 * A right click without moving, or a long press on touch, selects the widget in front at the point and opens its menu,
 * to order it on the page, or select another widget covering the point, where there is no widget the menu of the viewport opens
 *
 * In edit mode widgets outside the page are shown, pressing the viewport gives it focus, then ctrl+a selects all widgets,
 * delete or backspace removes the selected widgets from the page, and ctrl+x, ctrl+c and ctrl+v cut, copy and paste them,
 * through the clipboard of the system, so they can be copied between browsers*/
class Viewport extends Base {
  /**Returns the name used to define the element */
  static element_name() {
    return "viewport";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "canvas";
  }

  #background: HTMLDivElement = this.appendChild(document.createElement("div"));
  #container: HTMLDivElement = this.appendChild(document.createElement("div"));
  #transformer: Transformer = this.appendChild(new Transformer());
  #page: PageElement | undefined;
  /**The page data shown*/
  #page_data: CanvasPage | undefined;
  /**Where a right press started, it opens the menu when released without moving */
  #menu_press: { id: number; x: number; y: number } | undefined;
  #selected: readonly CanvasWidget[] = [];
  /**The selection rectangle being dragged, from where it started in client pixels, ctrl or shift adds to the selection*/
  #marquee:
    | {
        id: number;
        x: number;
        y: number;
        add: boolean;
        element?: HTMLDivElement;
      }
    | undefined;
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
    //The transformer moves to the element the slot of the selected widget shows now
    this.#container.addEventListener(WIDGET_ELEMENTS_EVENT, () =>
      this.#attach(),
    );
    //Ctrl+x, ctrl+c and ctrl+v of the focused viewport in edit mode, with the clipboard of the system
    clipboard_events(
      this,
      () => (this.#edit ? this.#page_data : undefined),
      () => this.#selected,
      (removed) => this.#deselect(removed),
      (pasted) => this.#select(pasted),
      () => this.#shown_area(),
    );
    //Refits when the viewport changes size, a function can only be attached once per element, so one per state
    this.attach_state(this.#size.width, () => this.#update_view());
    this.attach_state(this.#size.height, () => this.#update_view());
  }

  readonly #size = state_ui.size(this);

  /**Size of the viewport in px, from the observed size, measured when not observed yet*/
  #measure(): { width: number; height: number } {
    const width = this.#size.width.ok();
    const height = this.#size.height.ok();
    if (width === 0 || height === 0) return this.getBoundingClientRect();
    return { width, height };
  }

  set(options: CanvasViewportOptions): this {
    super.set(options);
    this.set_input(VIEWPORT.page, options.page, (page) => {
      //An error shows no page, the fault icon explains it
      this.#show(page.ok ? page.value : undefined);
    });
    this.set_input(VIEWPORT.edit, options.edit, (edit) => {
      this.#set_edit(edit.ok && edit.value);
    });
    this.set_input(VIEWPORT.selected, options.selected, (selected) => {
      this.#selected = selected.ok ? selected.value : [];
      //Shared by everything given the same selection state, kept while the same widgets are selected
      const group = GroupRotation.of(
        this.input_state(VIEWPORT.selected) ?? this,
      );
      group.select(this.#selected);
      this.#transformer.group = group;
      this.#attach();
    });
    return this;
  }

  /**Shows the page data, making a page element for it*/
  #show(page: CanvasPage | undefined) {
    this.#page_data = page;
    if (this.#page) {
      this.#page_observer.unobserve(this.#page);
      this.#page.remove();
      this.#page = undefined;
    }
    if (page) {
      this.#page = this.#container.appendChild(page_element(page));
      this.#page_observer.observe(this.#page);
    }
    this.#attach();
    this.#update_view();
  }

  /**Selects like the user does, a writable state is written, an initial value or no value is kept, a read only state is left
   * @param next the selection after the change
   * @param write what is written to a state, an array instruction for a small change, next when undefined*/
  #select(next: readonly CanvasWidget[], write?: CanvasWidget[]) {
    const given = this.input_state(VIEWPORT.selected);
    if (given === undefined) {
      this.#selected = next;
      this.#attach();
    } else if (given.writable) void given.write?.(write ?? [...next]);
  }

  /**Selects only the widget, none clears the selection*/
  #select_only(widget: CanvasWidget | undefined) {
    const next = widget ? [widget] : [];
    if (
      next.length === this.#selected.length &&
      next.every((w, i) => w === this.#selected[i])
    )
      return;
    this.#select(next);
  }

  /**Adds the widget to the selection, or takes it out when it is selected*/
  #toggle(widget: CanvasWidget) {
    if (this.#selected.includes(widget))
      this.#select(
        this.#selected.filter((w) => w !== widget),
        state.a.write.delete(widget),
      );
    else this.#select([...this.#selected, widget], state.a.write.push(widget));
  }

  /**Puts the transformer on the elements of the selected widgets on the page, hidden outside edit mode*/
  #attach() {
    const page = this.#page;
    const elements: WidgetBase[] = [];
    if (this.#edit && page)
      for (const widget of this.#selected) {
        const element = page.slot_of(widget)?.element;
        if (element) elements.push(element);
      }
    this.#transformer.widgets = elements;
  }

  /**Enables zooming, panning and changing widgets, leaving it resets the view to fit the page */
  #set_edit(edit: boolean) {
    if (this.#edit === edit) return;
    this.#edit = edit;
    this.toggleAttribute("edit", edit);
    this.#attach();
    this.#listen_keys(edit && this.isConnected);
    if (edit) {
      this.tabIndex = 0;
      this.addEventListener("keydown", this.#on_view_key);
      this.addEventListener("wheel", this.#on_wheel, { passive: false });
      this.addEventListener("pointerdown", this.#on_pointer_down);
      this.addEventListener("pointermove", this.#on_pointer_move);
      this.addEventListener("pointerup", this.#on_pointer_up);
      this.addEventListener("pointercancel", this.#on_pointer_up);
      this.addEventListener("mousedown", this.#on_mouse_down);
      this.addEventListener("contextmenu", this.#on_context_menu);
    } else {
      this.removeAttribute("tabindex");
      this.removeEventListener("keydown", this.#on_view_key);
      this.removeEventListener("wheel", this.#on_wheel);
      this.removeEventListener("pointerdown", this.#on_pointer_down);
      this.removeEventListener("pointermove", this.#on_pointer_move);
      this.removeEventListener("pointerup", this.#on_pointer_up);
      this.removeEventListener("pointercancel", this.#on_pointer_up);
      this.removeEventListener("mousedown", this.#on_mouse_down);
      this.removeEventListener("contextmenu", this.#on_context_menu);
      this.#touches.clear();
      this.#pan_pointer_id = undefined;
      this.#zoom = 1;
      this.#pan_x = 0;
      this.#pan_y = 0;
      this.#update_view();
    }
  }

  /**Returns the current scale from page units to screen pixels */
  get scale(): number {
    return this.#scale;
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
    const width = this.#page.page_width;
    const height = this.#page.page_height;
    if (width <= 0 || height <= 0) return;
    const rect = this.#measure();
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
  #local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = this.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /**Selects the widget under the pointer, ctrl or shift toggles it,
   * on the empty page it clears the selection, unless ctrl or shift is held, and starts a selection rectangle*/
  #select_at(e: PointerEvent) {
    const page = this.#page;
    //Widgets sit in a slot of the page, a slot has display contents so it is never the target itself
    let element = e.target instanceof Element ? e.target : null;
    while (element && element.parentElement !== page)
      element = element.parentElement;
    const add = e.ctrlKey || e.shiftKey;
    if (page && element instanceof WidgetSlot) {
      if (add) this.#toggle(element.widget);
      else this.#select_only(element.widget);
      return;
    }
    if (!add) this.#select_only(undefined);
    this.#marquee = { id: e.pointerId, x: e.clientX, y: e.clientY, add };
    this.setPointerCapture(e.pointerId);
  }

  /**Draws the selection rectangle to the pointer*/
  #draw_marquee(e: PointerEvent) {
    const marquee = this.#marquee!;
    if (!marquee.element) {
      marquee.element = this.appendChild(document.createElement("div"));
      marquee.element.className = "marquee";
    }
    const start = this.#local({ clientX: marquee.x, clientY: marquee.y });
    const now = this.#local(e);
    Object.assign(marquee.element.style, {
      left: Math.min(start.x, now.x) + "px",
      top: Math.min(start.y, now.y) + "px",
      width: Math.abs(now.x - start.x) + "px",
      height: Math.abs(now.y - start.y) + "px",
    });
  }

  /**Selects the widgets fully inside the selection rectangle, added to the selection with ctrl or shift*/
  #end_marquee(e: PointerEvent) {
    const marquee = this.#marquee!;
    this.#marquee = undefined;
    if (!marquee.element) return;
    marquee.element.remove();
    const page = this.#page;
    if (!page || this.#scale <= 0) return;
    const to_page = (client_x: number, client_y: number) => {
      const local = this.#local({ clientX: client_x, clientY: client_y });
      return {
        x: (local.x - this.#fit_x - this.#pan_x) / this.#scale,
        y: (local.y - this.#fit_y - this.#pan_y) / this.#scale,
      };
    };
    const a = to_page(marquee.x, marquee.y);
    const b = to_page(e.clientX, e.clientY);
    const inside = page.widgets_inside(
      Math.min(a.x, b.x),
      Math.min(a.y, b.y),
      Math.max(a.x, b.x),
      Math.max(a.y, b.y),
    );
    if (!marquee.add) return this.#select(inside);
    const added = inside.filter((widget) => !this.#selected.includes(widget));
    if (added.length)
      this.#select([...this.#selected, ...added], state.a.write.push(...added));
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
          ? this.#measure().height
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
    //For ctrl+a, a press does not focus an element on its own
    this.focus({ preventScroll: true });
    if (e.pointerType === "touch") {
      //Only the first touch selects, so a second finger can pinch without changing the selection
      if (this.#touches.size === 0 && !this.#transformer.dragging)
        this.#select_at(e);
      //A second finger pinches instead
      else if (this.#marquee) {
        this.#marquee.element?.remove();
        this.#marquee = undefined;
      }
      this.#touches.set(e.pointerId, this.#local(e));
      this.setPointerCapture(e.pointerId);
    } else if (e.button === 0) {
      this.#select_at(e);
    } else if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      this.#menu_press =
        e.button === 2
          ? { id: e.pointerId, x: e.clientX, y: e.clientY }
          : undefined;
      this.#pan_pointer_id = e.pointerId;
      this.#pan_pointer_last = this.#local(e);
      this.setPointerCapture(e.pointerId);
    }
  };

  #on_pointer_move = (e: PointerEvent) => {
    this.#ctrl_held = e.ctrlKey;
    if (e.pointerId === this.#marquee?.id) {
      this.#draw_marquee(e);
      return;
    }
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
    if (e.pointerId === this.#marquee?.id) this.#end_marquee(e);
    const press = this.#menu_press;
    if (press?.id === e.pointerId) {
      this.#menu_press = undefined;
      if (
        Math.hypot(e.clientX - press.x, e.clientY - press.y) <= MENU_SLOP &&
        e.type === "pointerup"
      )
        this.#open_menu(e.clientX, e.clientY);
    }
    this.#touches.delete(e.pointerId);
    if (e.pointerId === this.#pan_pointer_id) this.#pan_pointer_id = undefined;
  };

  /**Prevents the browser autoscroll on middle mouse button */
  #on_mouse_down = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault();
  };

  /**Prevents the context menu of the browser, as the right mouse button pans in edit mode, the viewport opens its own menu
   * when a right press is released without moving, a long press on touch gives this event, which opens it too*/
  #on_context_menu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if ((e as PointerEvent).pointerType === "touch" && this.#touches.size <= 1)
      this.#open_menu(e.clientX, e.clientY);
  };

  /**The part of the page the viewport shows, in page units, pasted widgets are kept in it*/
  #shown_area():
    { x: number; y: number; width: number; height: number } | undefined {
    if (this.#scale <= 0) return undefined;
    const { width, height } = this.#measure();
    return {
      x: -(this.#fit_x + this.#pan_x) / this.#scale,
      y: -(this.#fit_y + this.#pan_y) / this.#scale,
      width: width / this.#scale,
      height: height / this.#scale,
    };
  }

  /**Resets zoom and pan, so the page fits the viewport again, like when the viewport is made*/
  #center_view() {
    this.#zoom = 1;
    this.#pan_x = 0;
    this.#pan_y = 0;
    this.#update_view();
  }

  /**Selects every widget of the page, in drawing order*/
  #select_all() {
    const page = this.#page;
    if (page) this.#select([...page.widgets]);
  }

  /**Keys of the focused viewport, ctrl+a selects all widgets, delete and backspace remove the selected ones*/
  #on_view_key = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      this.#select_all();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      void this.#remove(this.#selected);
    }
  };

  /**Removes the widgets from the page, and takes them out of the selection*/
  async #remove(widgets: readonly CanvasWidget[]) {
    const data = this.#page_data;
    if (!data || !widgets.length) return;
    if (await remove_widgets(data, widgets)) this.#deselect(widgets);
  }

  /**Takes removed widgets out of the selection*/
  #deselect(widgets: readonly CanvasWidget[]) {
    const left = this.#selected.filter((widget) => !widgets.includes(widget));
    if (left.length !== this.#selected.length) this.#select(left);
  }

  /**Opens the menu of the widget in front at the client point, the menu of the viewport when no widget is there
   * A widget that is not selected is selected first, the menu acts on all selected widgets*/
  #open_menu(client_x: number, client_y: number) {
    const page = this.#page;
    const data = this.#page_data;
    if (!page || !data) return;
    const local = this.#local({ clientX: client_x, clientY: client_y });
    const x = (local.x - this.#fit_x - this.#pan_x) / this.#scale;
    const y = (local.y - this.#fit_y - this.#pan_y) / this.#scale;
    const [widget] = page.widgets_at(x, y);
    const pasted = (widgets: CanvasWidget[]) => this.#select(widgets);
    const shown = this.#shown_area();
    if (!widget)
      return ctm.summon(
        ctm.menu([
          paste_line(data, pasted, { x, y }, shown),
          ctm.divider(),
          ctm.line({
            text: "Select all",
            shortcut: "Ctrl+A",
            on_click: () => this.#select_all(),
          }),
          ctm.line({
            text: "Center view",
            on_click: () => this.#center_view(),
          }),
        ]),
        { element: this, x: client_x, y: client_y },
      );
    const targets = this.#selected.includes(widget) ? this.#selected : [widget];
    if (targets !== this.#selected) this.#select_only(widget);
    ctm.summon(
      ctm.menu([
        ...edit_lines(
          data,
          targets,
          () => this.#deselect(targets),
          pasted,
          { x, y },
          shown,
        ),
        delete_line(data, targets, () => this.#deselect(targets)),
        ctm.divider(),
        ...order_lines(data, targets),
        ctm.divider(),
        ctm.sub({
          text: "Select covered",
          //The widgets at the point when the submenu opens, as they can have moved since
          menu: ctm.menu(() =>
            Promise.resolve(
              page.widgets_at(x, y).map((covered) =>
                ctm.line({
                  text: widget_id(covered) || widget_name(covered),
                  checked: this.#selected.includes(covered),
                  on_click: () => this.#select_only(covered),
                }),
              ),
            ),
          ),
        }),
      ]),
      { element: this, x: client_x, y: client_y },
    );
  }

  #on_key = (e: KeyboardEvent) => {
    this.#ctrl_held = e.ctrlKey;
  };

  #on_blur = () => {
    this.#ctrl_held = false;
  };
}
define_element(Viewport);

export type { Viewport };

/**Creates a viewport showing a page of widgets */
export function canvas_viewport(options: CanvasViewportOptions = {}): Viewport {
  return Viewport.create(options);
}
