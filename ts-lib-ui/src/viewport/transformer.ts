import { Base, define_element } from "#base";
import {
  material_arrow_range_rounded,
  material_open_with_rounded,
  material_rotate_right_rounded,
} from "#icons";
import type { SVGFunc } from "#svg";
import "./shared";
import "./transformer.scss";
import { WIDGET_TRANSFORM_EVENT, type WidgetBase } from "./widget";

/**Smallest width and height a widget can be resized to */
const MIN_SIZE = 1;
/**Grid positions and sizes snap to, and the finer grid used while alt is held */
const SNAP_GRID = 5;
const SNAP_GRID_FINE = 1;
/**Angle in degrees rotation snaps to, and the finer angle used while alt is held */
const SNAP_ANGLE = 15;
const SNAP_ANGLE_FINE = 5;

/**Rounds the value to the nearest multiple of step, a step of 0 returns the value unchanged
 * Steps below 1 divide by the inverse, so steps like 0.1 do not give floating point errors like 0.30000000000000004 */
function snap(value: number, step: number): number {
  if (step <= 0) return value;
  return step < 1
    ? Math.round(value / step) / Math.round(1 / step)
    : Math.round(value / step) * step;
}

/**Resize handles, x and y is the edge they move, -1 is the left or top edge, 1 the right or bottom edge, 0 none */
const RESIZE_HANDLES = [
  { name: "nw", x: -1, y: -1 },
  { name: "n", x: 0, y: -1 },
  { name: "ne", x: 1, y: -1 },
  { name: "e", x: 1, y: 0 },
  { name: "se", x: 1, y: 1 },
  { name: "s", x: 0, y: 1 },
  { name: "sw", x: -1, y: 1 },
  { name: "w", x: -1, y: 0 },
];

type Action =
  | { type: "move" }
  | { type: "resize"; x: number; y: number }
  | { type: "rotate" };

/**State of the widget and pointer when a drag started */
interface Drag {
  action: Action;
  pointer_id: number;
  client_x: number;
  client_y: number;
  /**Center of the widget in client coordinates, used for rotation */
  center_x: number;
  center_y: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/**Dashed outline with handles, attached to a widget to move, resize and rotate it
 * Corner handles resize both axes and side handles one axis, keeping the opposite corner or side in place
 * The handle above the outline rotates the widget around its center
 * The center handle and the outline itself move the widget, the inside of the outline is left to the widgets below
 *
 * Position and size snap to a 5px grid and rotation to 15 degrees
 * Holding alt snaps to a 1px grid and 5 degrees instead, holding shift disables snapping
 *
 * Resize and rotate cursors follow the rotation of the widget in 45 degree steps
 *
 * The transformer is drawn in viewport pixels, so it keeps its size when the page is zoomed*/
export class Transformer extends Base {
  /**Returns the name used to define the element */
  static element_name() {
    return "transformer";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "viewport";
  }

  #widget: WidgetBase | undefined;
  #offset_x: number = 0;
  #offset_y: number = 0;
  #scale: number = 1;
  #actions = new Map<Element, Action>();
  #drag: Drag | undefined;

  constructor() {
    super();
    this.hidden = true;
    for (const side of ["top", "right", "bottom", "left"])
      this.#add("side " + side, { type: "move" });
    this.#add("line", undefined);
    for (const handle of RESIZE_HANDLES)
      this.#add(
        "handle " + handle.name,
        { type: "resize", x: handle.x, y: handle.y },
        material_arrow_range_rounded,
      );
    this.#add("handle rotate", { type: "rotate" }, material_rotate_right_rounded);
    //Added last so it is drawn on top of the other handles on small widgets
    this.#add("handle move", { type: "move" }, material_open_with_rounded);
    this.addEventListener("pointerdown", this.#on_pointer_down);
  }

  protected disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stop_drag();
  }

  /**Sets the widget the transformer is attached to, undefined hides the transformer */
  set widget(widget: WidgetBase | undefined) {
    if (this.#widget === widget) return;
    this.#stop_drag();
    this.#widget?.removeEventListener(
      WIDGET_TRANSFORM_EVENT,
      this.#on_widget_transform,
    );
    this.#widget = widget;
    widget?.addEventListener(WIDGET_TRANSFORM_EVENT, this.#on_widget_transform);
    this.#update();
  }
  /**Returns the widget the transformer is attached to */
  get widget(): WidgetBase | undefined {
    return this.#widget;
  }

  /**Returns whether a handle is being dragged */
  get dragging(): boolean {
    return this.#drag !== undefined;
  }

  /**Sets how page units map to viewport pixels, viewport = offset + page * scale */
  view(offset_x: number, offset_y: number, scale: number) {
    this.#offset_x = offset_x;
    this.#offset_y = offset_y;
    this.#scale = scale;
    this.#update();
  }

  #add(class_name: string, action: Action | undefined, icon?: SVGFunc) {
    const element = this.appendChild(document.createElement("div"));
    element.className = class_name;
    if (icon) element.appendChild(icon());
    if (action) this.#actions.set(element, action);
  }

  #update() {
    const widget = this.#widget;
    this.hidden = !widget;
    if (!widget) return;
    const scale = this.#scale;
    this.style.left = this.#offset_x + widget.x * scale + "px";
    this.style.top = this.#offset_y + widget.y * scale + "px";
    this.style.width = widget.width * scale + "px";
    this.style.height = widget.height * scale + "px";
    this.style.transform = `rotate(${widget.rotation}deg)`;
    //Cursors only exist in 45 degree steps repeating every 180 degrees, the stylesheet picks the cursors from the closest step
    const half_turn = ((widget.rotation % 180) + 180) % 180;
    this.setAttribute("cursor-step", String(Math.round(half_turn / 45) % 4));
  }

  #start(action: Action, e: PointerEvent) {
    const widget = this.#widget;
    if (!widget || this.#drag) return;
    e.preventDefault();
    e.stopPropagation();
    //The bounding box of the rotated outline is centered on the widget center
    const rect = this.getBoundingClientRect();
    this.#drag = {
      action,
      pointer_id: e.pointerId,
      client_x: e.clientX,
      client_y: e.clientY,
      center_x: rect.left + rect.width / 2,
      center_y: rect.top + rect.height / 2,
      x: widget.x,
      y: widget.y,
      width: widget.width,
      height: widget.height,
      rotation: widget.rotation,
    };
    window.addEventListener("pointermove", this.#on_pointer_move);
    window.addEventListener("pointerup", this.#on_pointer_up);
    window.addEventListener("pointercancel", this.#on_pointer_up);
  }

  #stop_drag() {
    if (!this.#drag) return;
    this.#drag = undefined;
    window.removeEventListener("pointermove", this.#on_pointer_move);
    window.removeEventListener("pointerup", this.#on_pointer_up);
    window.removeEventListener("pointercancel", this.#on_pointer_up);
  }

  #on_widget_transform = () => {
    this.#update();
  };

  #on_pointer_down = (e: PointerEvent) => {
    const action =
      e.target instanceof Element ? this.#actions.get(e.target) : undefined;
    //Other buttons are left to the viewport, so middle mouse still pans
    if (!action || e.button !== 0) return;
    this.#start(action, e);
  };

  #on_pointer_move = (e: PointerEvent) => {
    const drag = this.#drag;
    const widget = this.#widget;
    if (!drag || !widget || e.pointerId !== drag.pointer_id) return;
    //Pointer movement in page units
    const delta_x = (e.clientX - drag.client_x) / this.#scale;
    const delta_y = (e.clientY - drag.client_y) / this.#scale;
    const grid = e.shiftKey ? 0 : e.altKey ? SNAP_GRID_FINE : SNAP_GRID;
    const action = drag.action;
    switch (action.type) {
      case "move":
        widget.x = snap(drag.x + delta_x, grid);
        widget.y = snap(drag.y + delta_y, grid);
        break;
      case "resize": {
        const radians = (drag.rotation * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        //Pointer movement in the unrotated frame of the widget
        const local_x = delta_x * cos + delta_y * sin;
        const local_y = delta_y * cos - delta_x * sin;
        const width = action.x
          ? Math.max(MIN_SIZE, snap(drag.width + action.x * local_x, grid))
          : drag.width;
        const height = action.y
          ? Math.max(MIN_SIZE, snap(drag.height + action.y * local_y, grid))
          : drag.height;
        //Move the center by half the size change, so the opposite corner or side stays in place
        const shift_x = (action.x * (width - drag.width)) / 2;
        const shift_y = (action.y * (height - drag.height)) / 2;
        const center_x = drag.x + drag.width / 2 + shift_x * cos - shift_y * sin;
        const center_y = drag.y + drag.height / 2 + shift_x * sin + shift_y * cos;
        widget.x = center_x - width / 2;
        widget.y = center_y - height / 2;
        widget.width = width;
        widget.height = height;
        break;
      }
      case "rotate": {
        const start = Math.atan2(
          drag.client_y - drag.center_y,
          drag.client_x - drag.center_x,
        );
        const now = Math.atan2(
          e.clientY - drag.center_y,
          e.clientX - drag.center_x,
        );
        const rotation = snap(
          drag.rotation + ((now - start) * 180) / Math.PI,
          e.shiftKey ? 0 : e.altKey ? SNAP_ANGLE_FINE : SNAP_ANGLE,
        );
        widget.rotation = ((rotation % 360) + 360) % 360;
        break;
      }
    }
  };

  #on_pointer_up = (e: PointerEvent) => {
    if (e.pointerId === this.#drag?.pointer_id) this.#stop_drag();
  };
}
define_element(Transformer);
