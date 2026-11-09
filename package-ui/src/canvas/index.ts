import { canvas_page, Page, type CanvasPageOptions } from "./page";
import {
  canvas_viewport,
  Viewport,
  type CanvasViewportOptions,
} from "./viewport";
import { WIDGET_TRANSFORM_EVENT } from "./widget";

/**Displaying and editing graphics with a fixed position and size */
export const canvas = {
  page: canvas_page,
  viewport: canvas_viewport,
  WIDGET_TRANSFORM_EVENT,
};
export default canvas;

export type { CanvasPageOptions, CanvasViewportOptions, Page, Viewport };

export { WIDGET_TRANSFORM_EVENT, WidgetBase } from "./widget";
