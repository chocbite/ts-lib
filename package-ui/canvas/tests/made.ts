import state from "@chocbite/ts-lib/state";
import { canvas, type CanvasWidget, type CanvasWidgetData } from "..";
import type { WidgetBaseOptions } from "../widget";

/**The widgets a new page of the data makes, in the order of the data, for tests needing widgets
 * A widget is always made by its page, this page is the page of them*/
export function made<O extends WidgetBaseOptions>(
  ...data: CanvasWidgetData<O>[]
): CanvasWidget<O>[] {
  const page = canvas.page({
    widgets: state.ok_w<readonly CanvasWidgetData[]>(data),
  });
  return data.map((entry) => page.widget_of(entry));
}

/**The widget a new page of the data makes*/
export const made_one = <O extends WidgetBaseOptions>(
  data: CanvasWidgetData<O>,
): CanvasWidget<O> => made(data)[0];
