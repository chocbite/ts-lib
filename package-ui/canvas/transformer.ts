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

/**Rounds the value to the nearest multiple of step, a step of 0 returns the value unchanged */
function snap(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
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
  /**Client position of the origin of the view, which is what offset is relative to */
  origin_x: number;
  origin_y: number;
  /**Point on the page that was pressed */
  page_x: number;
  page_y: number;
  /**Angle from the center of the widget to the point that was pressed, used for rotation */
  angle: number;
  /**Latest pointer event of the drag, undefined until the pointer has moved */
  last: PointerEvent | undefined;
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
    return "canvas";
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
    this.#add(
      "handle rotate",
      { type: "rotate" },
      material_rotate_right_rounded,
    );
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

  /**Sets how page units map to viewport pixels, viewport = offset + page * scale
   * During a drag the widget is moved so the grabbed point stays under the pointer */
  view(offset_x: number, offset_y: number, scale: number) {
    this.#offset_x = offset_x;
    this.#offset_y = offset_y;
    this.#scale = scale;
    this.#update();
    if (this.#drag?.last) this.#apply_drag(this.#drag, this.#drag.last);
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
    const center_x = rect.left + rect.width / 2;
    const center_y = rect.top + rect.height / 2;
    const scale = this.#scale;
    const origin_x =
      center_x - this.#offset_x - (widget.x + widget.width / 2) * scale;
    const origin_y =
      center_y - this.#offset_y - (widget.y + widget.height / 2) * scale;
    this.#drag = {
      action,
      pointer_id: e.pointerId,
      origin_x,
      origin_y,
      page_x: (e.clientX - origin_x - this.#offset_x) / scale,
      page_y: (e.clientY - origin_y - this.#offset_y) / scale,
      angle: Math.atan2(e.clientY - center_y, e.clientX - center_x),
      last: undefined,
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
    if (!drag || e.pointerId !== drag.pointer_id) return;
    drag.last = e;
    this.#apply_drag(drag, e);
  };

  #on_pointer_up = (e: PointerEvent) => {
    if (e.pointerId === this.#drag?.pointer_id) this.#stop_drag();
  };

  /**Updates the widget from the pointer event and the current view */
  #apply_drag(drag: Drag, e: PointerEvent) {
    const widget = this.#widget;
    const scale = this.#scale;
    //A viewport without a size has a scale of 0, which has no page position
    if (!widget || scale <= 0) return;
    const view_x = drag.origin_x + this.#offset_x;
    const view_y = drag.origin_y + this.#offset_y;
    //Pointer movement in page units
    const delta_x = (e.clientX - view_x) / scale - drag.page_x;
    const delta_y = (e.clientY - view_y) / scale - drag.page_y;
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
        const center_x =
          drag.x + drag.width / 2 + shift_x * cos - shift_y * sin;
        const center_y =
          drag.y + drag.height / 2 + shift_x * sin + shift_y * cos;
        widget.x = center_x - width / 2;
        widget.y = center_y - height / 2;
        widget.width = width;
        widget.height = height;
        break;
      }
      case "rotate": {
        const now = Math.atan2(
          e.clientY - (view_y + (drag.y + drag.height / 2) * scale),
          e.clientX - (view_x + (drag.x + drag.width / 2) * scale),
        );
        const rotation = snap(
          drag.rotation + ((now - drag.angle) * 180) / Math.PI,
          e.shiftKey ? 0 : e.altKey ? SNAP_ANGLE_FINE : SNAP_ANGLE,
        );
        widget.rotation = ((rotation % 360) + 360) % 360;
        break;
      }
    }
  }
}
define_element(Transformer);
