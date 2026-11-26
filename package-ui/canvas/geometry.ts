import type { State } from "@chocbite/ts-lib/state";
import type { CanvasWidget } from "./data";
import { value_now } from "./now";
import type { WidgetGeometry } from "./widget";

/**The parts of the geometry of a widget*/
export type GeometryKey = keyof WidgetGeometry;
export const GEOMETRY_KEYS: readonly GeometryKey[] = [
  "x",
  "y",
  "width",
  "height",
  "rotation",
];

/**The geometry of a widget as its elements show it, read from its states with links followed, see CanvasWidget.value
 * A part the widget has no state for is 0, as an element shows it,
 * undefined while a part has no number, like a link to a state that is not registered*/
export function geometry_now(widget: CanvasWidget): WidgetGeometry | undefined {
  const geometry: WidgetGeometry = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
  };
  for (const key of GEOMETRY_KEYS) {
    const value = widget.value(key);
    if (!value) continue;
    const now = value_now(value);
    if (typeof now !== "number") return undefined;
    geometry[key] = now;
  }
  return geometry;
}

/**The states of the geometry of a widget, to follow it, the values and the inputs giving them, see CanvasWidget.input,
 * as a part can become writable or read only without its value changing, like an option switching from a link to a value*/
export function geometry_states(
  widget: CanvasWidget,
): State<unknown, any, any>[] {
  const states: State<unknown, any, any>[] = [];
  for (const key of GEOMETRY_KEYS) {
    const input = widget.input(key);
    if (input) states.push(input, widget.value(key)!);
  }
  return states;
}

/**Whether the user can change a part of the geometry, only when the state given to the elements is writable*/
export const changeable = (widget: CanvasWidget, key: GeometryKey): boolean =>
  widget.value(key)?.writable ?? false;

/**Changes the geometry like the user does, writing the parts that change to their states, linked ones through their links
 * A part that can not be written is left as it is*/
export function change_geometry(
  widget: CanvasWidget,
  change: Partial<WidgetGeometry>,
): void {
  for (const key of GEOMETRY_KEYS) {
    const to = change[key];
    const value = widget.value(key);
    if (to === undefined || !value?.writable || value_now(value) === to)
      continue;
    void value.write?.(to);
  }
}
