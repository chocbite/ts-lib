import depot_ui from "#depot_ui";
import type { DepotEntry } from "@chocbite/ts-lib/depot";
import {
  new_widget,
  WIDGETS,
  type CanvasWidgetData,
  type WidgetDefinition,
} from "./data";

export interface CanvasSelectWidgetOptions {
  /**Single picks one widget, multi any number, single when undefined*/
  mode?: "single" | "multi";
  /**Position of the new widget, later widgets are placed 20 units further down and right, 0,0 when undefined*/
  at?: { x: number; y: number };
  /**Only definitions passing the filter can be picked*/
  filter?: (entry: DepotEntry<WidgetDefinition>) => boolean;
  /**Title of the selector, "Add widget" when undefined*/
  title?: string;
}

/**Opens a selector of the registered widget definitions, the promise gives a new widget for every picked definition,
 * none when cancelled. The new widgets have a writable state for every property, starting at its default,
 * add them to the widgets of a page to show them*/
export async function select_widget(
  options: CanvasSelectWidgetOptions = {},
): Promise<CanvasWidgetData[]> {
  const entries = await depot_ui.select(WIDGETS, {
    mode: options.mode,
    filter: options.filter,
    title: options.title ?? "Add widget",
  });
  const at = options.at ?? { x: 0, y: 0 };
  const made: CanvasWidgetData[] = [];
  for (const [i, entry] of entries.entries()) {
    //A definition in error has no properties to make the widget from, it is left out
    const widget = await new_widget(entry, {
      x: at.x + i * 20,
      y: at.y + i * 20,
    });
    if (widget.ok) made.push(widget.value);
  }
  return made;
}
