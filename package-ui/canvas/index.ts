import {
  canvas_widget,
  new_widget,
  page_from_json,
  widget_definition,
  widget_properties,
  WIDGETS,
} from "./data";
import { canvas_link, linear_transform } from "./link";
import { copy_widgets, cut_widgets, paste_widgets } from "./clipboard";
import { group_widgets, ungroup_widgets } from "./group_widget";
import { remove_widgets, reorder_widget } from "./order";
import { canvas_outline } from "./outline";
import { canvas_properties } from "./properties_editor";
import { select_widget } from "./select";
import { canvas_viewport } from "./viewport";
import { WIDGET_TRANSFORM_EVENT } from "./widget";

/**Displaying and editing pages of graphics with a fixed position and size
 * Pages and widgets are data, so a page can be shown in several viewports at once*/
export const canvas = {
  /**Creates a viewport showing a page*/
  viewport: canvas_viewport,
  /**Gives a widget definition as it is, typed by the parameter of create, register definitions through it so their properties are checked*/
  definition: widget_definition,
  /**A widget for a page, from a widget definition in the depot and the options of the widget*/
  widget: canvas_widget,
  /**A link from an option of a widget to a state of the depot, like canvas.link("/states/machine/speed"), write it to the state of an option*/
  link: canvas_link,
  /**A linear transform for a link, maps a range of the linked state to a range of the widget, canvas.linear([50, 100], [150, 200])*/
  linear: linear_transform,
  /**A new widget from a definition, every property a writable state starting at its default*/
  new_widget,
  /**Every property of a widget made from a definition, the id, position, size, rotation, opacity and visible first*/
  widget_properties,
  /**Opens a selector of the widget definitions, gives a new widget for every picked definition*/
  select_widget,
  /**Creates a properties editor, a list of the properties of the selected widget bound to its options*/
  properties: canvas_properties,
  /**Creates an outline, a list of the widgets of a page sharing the selection with the viewports*/
  outline: canvas_outline,
  /**Moves widgets in the drawing order of a page, to the front or back, or one step forward or backward, keeping their order*/
  reorder: reorder_widget,
  /**Removes widgets from a page, writing delete instructions to its widgets state*/
  remove: remove_widgets,
  /**Copies widgets to the clipboard of the app, shared by every page, gives the JSON text for the clipboard of the system*/
  copy: copy_widgets,
  /**Copies widgets and removes them from a page*/
  cut: cut_widgets,
  /**Adds copies of the copied widgets to a page, in front, or of the widgets in a text from the clipboard of the system,
   * placed at a point or kept inside an area if given, gives the copies*/
  paste: paste_widgets,
  /**Groups widgets of a page into a new group in their place, gives the group*/
  group: group_widgets,
  /**Puts the widgets of groups back on a page in their place, gives them*/
  ungroup: ungroup_widgets,
  /**The widgets type of the depot, where widget definitions are registered*/
  widgets: WIDGETS,
  /**Builds a page from its JSON with writable states, the check of get of a settings group storing a page*/
  page_from_json,
  WIDGET_TRANSFORM_EVENT,
};
export default canvas;

export type { CanvasPage, CanvasWidget, WidgetDefinition } from "./data";
export type {
  CanvasLink,
  CanvasLinkOptions,
  LinearTransform,
  LinkTransform,
  OptionState,
  WidgetOptionStates,
  WidgetOptionsInput,
} from "./link";
export type {
  BooleanProperty,
  ColorProperty,
  EnumProperty,
  NumberProperty,
  TextProperty,
  WidgetProperties,
  WidgetProperty,
} from "./properties";
export type {
  CanvasPropertiesOptions,
  PropertiesEditor,
} from "./properties_editor";
export type { GroupDisplay, GroupWidgetOptions } from "./group_widget";
export type { WidgetOrder } from "./order";
export type { CanvasOutlineOptions, Outline } from "./outline";
export type { CanvasSelectWidgetOptions } from "./select";
export type { CanvasViewportOptions, Viewport } from "./viewport";
export { WIDGET_TRANSFORM_EVENT, WidgetBase } from "./widget";
export type { WidgetBaseOptions } from "./widget";
