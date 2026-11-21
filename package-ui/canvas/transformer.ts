import {
  group_bounds,
  transform_group,
  wrap_angle,
  type GroupRotation,
} from "./group";
import { Base, define_element } from "#base";
import {
  material_arrow_range_rounded,
  material_open_with_rounded,
  material_rotate_right_rounded,
} from "#icons";
import type { SVGFunc } from "#svg";
import "./shared";
import "./transformer.scss";
import {
  WIDGET_CHANGE,
  WIDGET_CHANGEABLE,
  WIDGET_GEOMETRY,
  WIDGET_TRANSFORM_EVENT,
  scrolls,
  type WidgetBase,
  type WidgetGeometry,
} from "./widget";

/**Smallest width and height a widget can be resized to */
const MIN_SIZE = 1;
const GROUP = Symbol("group");

/**Grid positions and sizes snap to, unless alt is held */
const SNAP_GRID = 5;
/**Angle in degrees rotation snaps to, unless alt is held */
const SNAP_ANGLE = 15;

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
  /**Point of the level that was pressed, in its units */
  page_x: number;
  page_y: number;
  /**Angle from the center of the box to the point that was pressed, in the level, used for rotation */
  angle: number;
  /**Geometry of every widget when the drag started, for several widgets*/
  starts: WidgetGeometry[];
  /**Latest pointer event of the drag, undefined until the pointer has moved */
  last: PointerEvent | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/**Dashed outline with handles, attached to widgets to move, resize and rotate them
 * One widget is outlined by its own rotated outline, several by the box around them, see group_bounds,
 * which moves, scales and rotates them together, see transform_group
 * The box of several widgets is turned by their group rotation, which the rotate handle sets, see GroupRotation
 * Corner handles resize both axes and side handles one axis, keeping the opposite corner or side in place
 * The handle above the outline rotates around the center
 * The center handle and the outline itself move the widget, the inside of the outline is left to the widgets below
 *
 * Position and size snap to a 5px grid and rotation to 15 degrees
 * Holding alt disables snapping
 * While resizing, holding ctrl keeps the ratio of width and height, holding shift resizes around the center
 *
 * Resize and rotate cursors follow the rotation of the widget in 45 degree steps
 *
 * The transformer is drawn in viewport pixels, so it keeps its size when the page is zoomed
 *
 * Changes go through the widgets, which write them to the states of their inputs,
 * handles of parts any widget has as a read only state are hidden*/
export class Transformer extends Base {
  /**Returns the name used to define the element */
  static element_name() {
    return "transformer";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "canvas";
  }

  #widgets: WidgetBase[] = [];
  /**The box while several widgets are dragged, as the drag makes it, the bounds of the widgets otherwise*/
  #drag_box: WidgetGeometry | undefined;
  /**The rotation of the box of several widgets, shared with the other viewports and properties editors of the selection*/
  #group: GroupRotation | undefined;

  /**Sets the rotation of the box of several widgets, the transformer follows it and sets it when the box is turned*/
  set group(group: GroupRotation | undefined) {
    if (this.#group === group) return;
    this.#group = group;
    if (group)
      this.attach_state_to_symbol(GROUP, group.rotation, () => this.#update());
    else this.detach_state_from_symbol(GROUP);
  }
  /**Maps the level the widgets are on to viewport pixels*/
  #matrix = new DOMMatrix();
  /**The scale of the matrix, which scales evenly*/
  get #scale(): number {
    return Math.hypot(this.#matrix.a, this.#matrix.b);
  }
  /**The rotation of the matrix in degrees*/
  get #turn(): number {
    return (Math.atan2(this.#matrix.b, this.#matrix.a) * 180) / Math.PI;
  }
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
        "handle resize " + handle.name,
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

  /**Sets the widgets the transformer is attached to, none hides the transformer */
  set widgets(widgets: readonly WidgetBase[]) {
    if (
      widgets.length === this.#widgets.length &&
      widgets.every((widget, i) => widget === this.#widgets[i])
    )
      return;
    this.#stop_drag();
    for (const widget of this.#widgets)
      widget.removeEventListener(
        WIDGET_TRANSFORM_EVENT,
        this.#on_widget_transform,
      );
    this.#widgets = [...widgets];
    for (const widget of this.#widgets)
      widget.addEventListener(
        WIDGET_TRANSFORM_EVENT,
        this.#on_widget_transform,
      );
    this.#update();
  }
  /**Returns the widgets the transformer is attached to */
  get widgets(): readonly WidgetBase[] {
    return this.#widgets;
  }

  /**The outline, the geometry of one widget, or the box around several*/
  #frame(): WidgetGeometry | undefined {
    const widgets = this.#widgets;
    if (widgets.length === 0) return undefined;
    if (widgets.length === 1) return widgets[0][WIDGET_GEOMETRY];
    return (
      this.#drag_box ??
      group_bounds(
        widgets.map((widget) => widget[WIDGET_GEOMETRY]),
        this.#group?.rotation.ok() ?? 0,
      )
    );
  }

  /**Whether every widget can change all the parts*/
  #changeable(...keys: Parameters<WidgetBase[typeof WIDGET_CHANGEABLE]>[0][]) {
    return this.#widgets.every((widget) =>
      keys.every((key) => widget[WIDGET_CHANGEABLE](key)),
    );
  }

  /**Returns whether a handle is being dragged */
  get dragging(): boolean {
    return this.#drag !== undefined;
  }

  /**Sets how the level the widgets are on maps to viewport pixels, a matrix that moves, turns and scales evenly,
   * like the view of a viewport, and for the content of groups the groups it is in
   * During a drag the widget is moved so the grabbed point stays under the pointer */
  view(matrix: DOMMatrix) {
    this.#matrix = matrix;
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
    const frame = this.#frame();
    this.hidden = !frame;
    if (!frame) return;
    const scale = this.#scale;
    const { x, y, width, height } = frame;
    //Turned with the level too, around its center
    const rotation = frame.rotation + this.#turn;
    const center = this.#matrix.transformPoint(
      new DOMPoint(x + width / 2, y + height / 2),
    );
    this.style.left = center.x - (width * scale) / 2 + "px";
    this.style.top = center.y - (height * scale) / 2 + "px";
    this.style.width = width * scale + "px";
    this.style.height = height * scale + "px";
    this.style.transform = `rotate(${rotation}deg)`;
    const changeable = (
      ...keys: Parameters<WidgetBase[typeof WIDGET_CHANGEABLE]>[0][]
    ) => this.#changeable(...keys);
    this.classList.toggle("no-move", !changeable("x", "y"));
    this.classList.toggle(
      "no-resize",
      !changeable("x", "y", "width", "height"),
    );
    //Several widgets turn around the center of the box, which moves them
    this.classList.toggle(
      "no-rotate",
      this.#widgets.length > 1
        ? !changeable("x", "y", "rotation")
        : !changeable("rotation"),
    );
    //The edges of a widget that scrolls let presses through to its scrollbars, the center handle still moves it
    const single = this.#widgets.length === 1 ? this.#widgets[0] : undefined;
    this.toggleAttribute("scrolls", single !== undefined && scrolls(single));
    //Cursors only exist in 45 degree steps repeating every 180 degrees, the stylesheet picks the cursors from the closest step
    const half_turn = ((rotation % 180) + 180) % 180;
    this.setAttribute("cursor-step", String(Math.round(half_turn / 45) % 4));
  }

  #start(action: Action, e: PointerEvent) {
    const frame = this.#frame();
    if (!frame || this.#drag) return;
    e.preventDefault();
    e.stopPropagation();
    const { x, y, width, height, rotation } = frame;
    const pressed = this.#to_level(e);
    this.#drag = {
      action,
      pointer_id: e.pointerId,
      page_x: pressed.x,
      page_y: pressed.y,
      angle: Math.atan2(
        pressed.y - (y + height / 2),
        pressed.x - (x + width / 2),
      ),
      last: undefined,
      starts: this.#widgets.map((widget) => ({ ...widget[WIDGET_GEOMETRY] })),
      x,
      y,
      width,
      height,
      rotation,
    };
    window.addEventListener("pointermove", this.#on_pointer_move);
    window.addEventListener("pointerup", this.#on_pointer_up);
    window.addEventListener("pointercancel", this.#on_pointer_up);
  }

  #stop_drag() {
    if (!this.#drag) return;
    this.#drag = undefined;
    //Several widgets are bounded again, in the rotation of the box
    if (this.#drag_box) {
      this.#drag_box = undefined;
      this.#update();
    }
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

  /**Changes the frame like the drag, one widget directly, several through their box*/
  #change(drag: Drag, change: Partial<WidgetGeometry>) {
    const widgets = this.#widgets;
    if (widgets.length === 1) {
      if (change.rotation !== undefined)
        change.rotation = wrap_angle(change.rotation);
      widgets[0][WIDGET_CHANGE](change);
      return;
    }
    const from: WidgetGeometry = {
      x: drag.x,
      y: drag.y,
      width: drag.width,
      height: drag.height,
      rotation: drag.rotation,
    };
    const to = { ...from, ...change };
    //Set first, the widgets tell the transformer about every change
    this.#drag_box = to;
    //The box keeps the rotation after the drag, the properties editor shows it while turning
    this.#group?.set(to.rotation);
    const geometries = transform_group(drag.starts, from, to);
    widgets.forEach((widget, i) => {
      const geometry = geometries[i];
      geometry.rotation = wrap_angle(geometry.rotation);
      widget[WIDGET_CHANGE](geometry);
    });
    this.#update();
  }

  /**The point of the level under the pointer, through the matrix of the view*/
  #to_level(e: { clientX: number; clientY: number }): DOMPoint {
    const parent = this.parentElement?.getBoundingClientRect();
    return this.#matrix
      .inverse()
      .transformPoint(
        new DOMPoint(
          e.clientX - (parent?.left ?? 0),
          e.clientY - (parent?.top ?? 0),
        ),
      );
  }

  /**Updates the widgets from the pointer event and the current view */
  #apply_drag(drag: Drag, e: PointerEvent) {
    //A viewport without a size has a scale of 0, which has no page position
    if (!this.#widgets.length || this.#scale <= 0) return;
    //Pointer movement in units of the level
    const now = this.#to_level(e);
    const delta_x = now.x - drag.page_x;
    const delta_y = now.y - drag.page_y;
    const grid = e.altKey ? 0 : SNAP_GRID;
    const action = drag.action;
    switch (action.type) {
      case "move":
        this.#change(drag, {
          x: snap(drag.x + delta_x, grid),
          y: snap(drag.y + delta_y, grid),
        });
        break;
      case "resize": {
        const radians = (drag.rotation * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        //Pointer movement in the unrotated frame of the widget
        const local_x = delta_x * cos + delta_y * sin;
        const local_y = delta_y * cos - delta_x * sin;
        //Around the center both opposite edges move, so the size changes twice the pointer movement
        const around_center = e.shiftKey;
        const growth = around_center ? 2 : 1;
        let width = action.x
          ? Math.max(
              MIN_SIZE,
              snap(drag.width + action.x * local_x * growth, grid),
            )
          : drag.width;
        let height = action.y
          ? Math.max(
              MIN_SIZE,
              snap(drag.height + action.y * local_y * growth, grid),
            )
          : drag.height;
        if (e.ctrlKey && drag.width > 0 && drag.height > 0) {
          //Keeps the ratio by the axis that changed most, only that axis is on the grid
          const scale_x = width / drag.width;
          const scale_y = height / drag.height;
          const by_x = action.x
            ? !action.y || Math.abs(scale_x - 1) >= Math.abs(scale_y - 1)
            : false;
          const scale = Math.max(
            by_x ? scale_x : scale_y,
            MIN_SIZE / Math.min(drag.width, drag.height),
          );
          width = drag.width * scale;
          height = drag.height * scale;
        }
        //Move the center by half the size change, so the opposite corner or side stays in place,
        //an axis without a handle grows around its middle
        const shift_x = around_center
          ? 0
          : (action.x * (width - drag.width)) / 2;
        const shift_y = around_center
          ? 0
          : (action.y * (height - drag.height)) / 2;
        const center_x =
          drag.x + drag.width / 2 + shift_x * cos - shift_y * sin;
        const center_y =
          drag.y + drag.height / 2 + shift_x * sin + shift_y * cos;
        this.#change(drag, {
          x: center_x - width / 2,
          y: center_y - height / 2,
          width,
          height,
        });
        break;
      }
      case "rotate": {
        const angle = Math.atan2(
          now.y - (drag.y + drag.height / 2),
          now.x - (drag.x + drag.width / 2),
        );
        const rotation = snap(
          drag.rotation + ((angle - drag.angle) * 180) / Math.PI,
          e.altKey ? 0 : SNAP_ANGLE,
        );
        this.#change(drag, { rotation });
        break;
      }
    }
  }
}
define_element(Transformer);
