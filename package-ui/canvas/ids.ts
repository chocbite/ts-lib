import { err_nice, type ResultNice } from "@chocbite/ts-lib/result";
import { widget_kind } from "./data";
import { value_now } from "./now";

/**Errors of widget ids*/
export const id_errors = {
  /**The id is used by another widget of the page*/
  TAKEN: Symbol("ID TAKEN"),
} as const;

/**A widget or the data of one, anything with the path of a definition and options*/
interface WithId {
  readonly widget: string;
  readonly options: object;
}

/**The id of a widget now, an empty text when it has none yet, or it is not a text*/
export function widget_id(widget: WithId): string {
  const id = value_now((widget.options as { id?: unknown }).id);
  return typeof id === "string" ? id : "";
}

/**Whether another widget of the widgets has the id*/
export function id_taken(
  widgets: readonly WithId[],
  widget: WithId,
  id: string,
): boolean {
  return widgets.some((other) => other !== widget && widget_id(other) === id);
}

/**The id the page gives the widget, the id its definition is registered with and the first number no other widget of the page has,
 * like "rectangle-1" for "/widgets/basic/rectangle", see widget_kind*/
export function free_id(widgets: readonly WithId[], widget: WithId): string {
  const name = widget_kind(widget.widget);
  let number = 1;
  while (id_taken(widgets, widget, `${name}-${number}`)) number++;
  return `${name}-${number}`;
}

/**The error for an id that is taken*/
export const id_taken_error = (id: string): ResultNice<never> =>
  err_nice(id_errors.TAKEN, `The ID ${id} is used by another widget`);
