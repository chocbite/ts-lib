import { err_nice, ok, type ResultNice } from "@chocbite/ts-lib/result";
import state, {
  type State,
  type StateREA,
  type StateRES,
  type StateROS,
} from "@chocbite/ts-lib/state";
import { CanvasPage, CanvasWidget } from "./data";
import {
  change_geometry,
  changeable,
  geometry_now,
  geometry_states,
  GEOMETRY_KEYS,
  type GeometryKey,
} from "./geometry";
import { group_bounds, transform_group, wrap_angle } from "./group";
import type { OptionState } from "./link";
import { value_now } from "./now";
import { combine_owners } from "./property/combine";
import type { OwnedProperty, PropertyOwner } from "./property/owner";
import type { WidgetGeometry } from "./widget";

/**Kind of the error of the box while a widget has no geometry*/
const BOX_UNKNOWN = Symbol("Geometry unknown");
const box_unknown = () =>
  err_nice(BOX_UNKNOWN, "A widget has no position or size now");

/**The parts of the geometry a change of a part of the box needs, moving needs x and y, sizing all four, turning x, y and rotation*/
const NEEDS: Record<GeometryKey, GeometryKey[]> = {
  x: ["x", "y"],
  y: ["x", "y"],
  width: ["x", "y", "width", "height"],
  height: ["x", "y", "width", "height"],
  rotation: ["x", "y", "rotation"],
};

/**Several widgets of one level selected together, edited as the box around them, like the transformer shows it
 * The box has a rotation of its own, starting at the rotation the widgets share, 0 when theirs differ,
 * kept by this selection, so every viewport and properties editor given it shows the same box
 * It is the owner of their properties in the properties editor: the properties they have in common, see combine_owners,
 * with x, y, width, height and rotation those of the box, a change of them moves, scales or turns the widgets like the transformer
 * Make it with canvas.selection_of, a new selection of other widgets is a new CanvasTransformer*/
export class CanvasTransformer implements PropertyOwner {
  /**The widgets, in the order they were selected*/
  readonly widgets: readonly CanvasWidget[];
  readonly #rotation: ReturnType<typeof state.ok_w<number>>;

  constructor(widgets: readonly CanvasWidget[]) {
    this.widgets = widgets;
    const rotations = widgets.map((widget) => {
      const value = value_now(widget.value("rotation"));
      return typeof value === "number" ? wrap_angle(value) : NaN;
    });
    const shared = rotations.every((rotation) => rotation === rotations[0])
      ? rotations[0]
      : 0;
    this.#rotation = state.ok_w(
      shared === undefined || Number.isNaN(shared) ? 0 : shared,
    );
  }

  /**The rotation of the box, from 0 up to 360, it turns with the widgets when the box is turned*/
  get rotation(): StateROS<number> {
    return this.#rotation.read_only;
  }

  /**The geometry of every widget now, undefined while one of them has none*/
  geometries(): WidgetGeometry[] | undefined {
    const geometries: WidgetGeometry[] = [];
    for (const widget of this.widgets) {
      const geometry = geometry_now(widget);
      if (!geometry) return undefined;
      geometries.push(geometry);
    }
    return geometries;
  }

  /**The box around the widgets now, in the rotation of the box, undefined while a widget has no geometry*/
  box(): WidgetGeometry | undefined {
    const geometries = this.geometries();
    return geometries && group_bounds(geometries, this.#rotation.ok());
  }

  /**Moves, scales and turns the widgets with their box, from a box to another, the box keeps the rotation of the box it is changed to
   * @param starts the geometry of every widget when the box was the from box, see geometries*/
  change(
    starts: readonly WidgetGeometry[],
    from: WidgetGeometry,
    to: WidgetGeometry,
  ): void {
    //Set first, so the box is bounded in its new rotation when the widgets tell their change
    const rotation = wrap_angle(to.rotation);
    if (this.#rotation.ok() !== rotation) this.#rotation.set_ok(rotation);
    transform_group(starts, from, to).forEach((geometry, i) => {
      geometry.rotation = wrap_angle(geometry.rotation);
      change_geometry(this.widgets[i], geometry);
    });
  }

  /**Whether every widget can change all the parts*/
  changeable(...keys: GeometryKey[]): boolean {
    return this.widgets.every((widget) =>
      keys.every((key) => changeable(widget, key)),
    );
  }

  /**The states the box follows, the geometry of every widget and the rotation of the box*/
  get states(): State<unknown, any, any>[] {
    return [this.#rotation, ...this.widgets.flatMap(geometry_states)];
  }

  #name?: StateROS<string>;
  /**How many, like 3 × Box when they are of one widget, or 3 widgets*/
  get name(): StateROS<string> {
    if (this.#name) return this.#name;
    const count = this.widgets.length;
    const kind = this.widgets[0]?.widget;
    return (this.#name = this.widgets.every((widget) => widget.widget === kind)
      ? (this.widgets[0].name.proxy((name) =>
          ok(`${count} × ${name.ok ? name.value : ""}`),
        ) as StateROS<string>)
      : state.ok(`${count} widgets`));
  }

  #properties?: StateREA<readonly OwnedProperty[]>;
  /**The properties the widgets have in common, x, y, width, height and rotation those of the box*/
  get properties(): StateREA<readonly OwnedProperty[]> {
    if (this.#properties) return this.#properties;
    const parts = this.#box_parts();
    return (this.#properties = combine_owners(
      this.widgets,
      this.name,
    ).properties.proxy_map((properties) =>
      properties.map((owned): OwnedProperty => {
        const part = parts.get(owned.key);
        return part
          ? {
              ...owned,
              property: { ...owned.property, linkable: false },
              states: [part as OptionState<unknown>],
            }
          : owned;
      }),
    ));
  }

  /**A state for every part of the box, writing one changes the widgets like the transformer,
   * read only when a widget locks a part the change needs*/
  #box_parts(): Map<string, State<number, any, any>> {
    const states = this.states;
    //Sync when every state is, so the box is there at once
    const sync = states.every((followed) => followed.rsync);
    const sync_states = states as StateRES<unknown>[];
    const parts = new Map<string, State<number, any, any>>();
    for (const key of GEOMETRY_KEYS) {
      const read = (): ResultNice<number> => {
        const box = this.box();
        return box ? ok(box[key]) : box_unknown();
      };
      const write = {
        write: (value: number) => {
          const starts = this.geometries();
          if (!starts) return Promise.resolve(box_unknown());
          const from = group_bounds(starts, this.#rotation.ok());
          this.change(starts, from, { ...from, [key]: Number(value) });
          return Promise.resolve(ok(undefined));
        },
      };
      const writable = this.changeable(...NEEDS[key]);
      parts.set(
        key,
        sync
          ? writable
            ? state.c.resw(read, write, ...sync_states)
            : state.c.res(read, ...sync_states)
          : writable
            ? state.c.reaw(read, write, ...states)
            : state.c.rea(read, ...states),
      );
    }
    return parts;
  }
}

/**What is selected, shared by viewports, outlines and properties editors, like state.ok_w<CanvasSelection>(undefined)
 * The page, a widget, several widgets of one level as a CanvasTransformer, or nothing
 * Every item is a PropertyOwner, so the selection state is given to the properties editor as its owner*/
export type CanvasSelection =
  CanvasPage | CanvasWidget | CanvasTransformer | undefined;

/**The selection of the widgets, nothing for none, the widget for one, a CanvasTransformer of them for several*/
export function selection_of(
  widgets: readonly CanvasWidget[],
): CanvasSelection {
  if (widgets.length === 0) return undefined;
  if (widgets.length === 1) return widgets[0];
  return new CanvasTransformer(widgets);
}

/**The widgets of a selection, none for the page or nothing*/
export function selected_widgets(
  selection: CanvasSelection,
): readonly CanvasWidget[] {
  if (selection instanceof CanvasWidget) return [selection];
  if (selection instanceof CanvasTransformer) return selection.widgets;
  return [];
}

/**Whether the selection is the page*/
export const is_page = (selection: unknown): selection is CanvasPage =>
  selection instanceof CanvasPage;

/**The rotation a group made of the selected widgets is turned by, the rotation of the box of several, of the widget for one*/
export function selection_rotation(selection: CanvasSelection): number {
  if (selection instanceof CanvasTransformer) return selection.rotation.ok();
  if (selection instanceof CanvasWidget) {
    const rotation = value_now(selection.value("rotation"));
    return typeof rotation === "number" ? wrap_angle(rotation) : 0;
  }
  return 0;
}
