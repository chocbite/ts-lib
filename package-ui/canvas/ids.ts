import depot from "@chocbite/ts-lib/depot";
import { err_nice, type ResultNice } from "@chocbite/ts-lib/result";
import type { State, StateREAW } from "@chocbite/ts-lib/state";
import { WIDGETS, type CanvasWidget } from "./data";

/**Errors of widget ids*/
export const id_errors = {
  /**The id is used by another widget of the page*/
  TAKEN: Symbol("ID TAKEN"),
} as const;

/**The id state of a widget, undefined when it has none*/
const id_state = (widget: CanvasWidget) =>
  (widget.options as Record<string, State<unknown, any, any> | undefined>).id;

/**The id of a widget now, an empty text when it has none yet, or it is not a text*/
export function widget_id(widget: CanvasWidget): string {
  const option = id_state(widget);
  const value = option?.rsync ? option.get() : undefined;
  return value?.ok && typeof value.value === "string" ? value.value : "";
}

/**The name of the definition of a widget, the last part of its path when the definition is not registered*/
export function widget_name(widget: CanvasWidget): string {
  const node = depot.get(widget.widget);
  const found = node.rsync ? node.get() : undefined;
  if (found?.ok && found.value.kind === "entry" && found.value.type === WIDGETS)
    return found.value.name;
  return widget.widget.split("/").at(-1) ?? widget.widget;
}

/**Gives every widget whose id is empty or taken by a widget before it the name of its widget and the first free number,
 * like "Box-1", writing its id state, so the ids are unique on the page and stored with it
 * A widget with a read only id state, or without one, keeps its id*/
export function fill_ids(widgets: readonly CanvasWidget[]): void {
  const used = new Set<string>();
  const without: CanvasWidget[] = [];
  //A widget given twice is the same widget, its id is not taken by itself
  const seen = new Set<CanvasWidget>();
  for (const widget of widgets) {
    if (seen.has(widget)) continue;
    seen.add(widget);
    const id = widget_id(widget);
    if (id && !used.has(id)) used.add(id);
    else if (id_state(widget)?.writable) without.push(widget);
  }
  //The number to try next per name, so many new widgets of one kind do not each count from 1
  const next = new Map<string, number>();
  for (const widget of without) {
    const name = widget_name(widget);
    let number = next.get(name) ?? 1;
    while (used.has(`${name}-${number}`)) number++;
    next.set(name, number + 1);
    const id = `${name}-${number}`;
    used.add(id);
    void id_state(widget)!.write?.(id);
  }
}

/**Whether another widget of the widgets has the id*/
export function id_taken(
  widgets: readonly CanvasWidget[],
  widget: CanvasWidget,
  id: string,
): boolean {
  return widgets.some((other) => other !== widget && widget_id(other) === id);
}

/**The error for an id that is taken*/
export const id_taken_error = (id: string): ResultNice<never> =>
  err_nice(id_errors.TAKEN, `The ID ${id} is used by another widget`);

/**The id state of the widget, refusing an id another widget of its level has, so the page does not give it a new one
 * @param widgets the widgets of the level of the widget now, undefined when they are not known, which refuses nothing*/
export function refuse_taken_ids(
  widget: CanvasWidget,
  value: State<unknown, any, any>,
  widgets: () => readonly CanvasWidget[] | undefined,
): State<unknown, any, any> {
  if (!value.writable) return value;
  return (value as StateREAW<unknown>).proxy_w((result) => result, {
    write: (id, source) => {
      const level = widgets();
      return typeof id === "string" && level && id_taken(level, widget, id)
        ? Promise.resolve(id_taken_error(id))
        : source.write(id);
    },
  });
}
