import depot, { type DepotEntry } from "@chocbite/ts-lib/depot";
import {
  err,
  none,
  ok,
  some,
  type Option,
  type ResultNice,
} from "@chocbite/ts-lib/result";
import state, { type StateOrVal } from "@chocbite/ts-lib/state";
import {
  is_link_json,
  link_from_json,
  type WidgetOptionStates,
  type WidgetOptionsInput,
} from "./link";
import {
  DEFAULT_WIDGET_SIZE,
  geometry_properties,
  type WidgetProperties,
  type WidgetProperty,
} from "./properties";
import type { WidgetBase, WidgetBaseOptions } from "./widget";

/**How a widget is made, the content of an entry of the widgets type of the depot*/
export interface WidgetDefinition<
  O extends WidgetBaseOptions = WidgetBaseOptions,
> {
  /**Creates the element of a widget for one viewport, every viewport showing the widget gets the same options*/
  create(options: O): WidgetBase;
  /**Size of a new widget, 100 by 100 when undefined*/
  size?: { width: number; height: number };
  /**The options the user changes, in the order they are shown, with what a new widget starts with
   * Typed by the options, so a property must match the type of its option, number options get number properties and so on
   * Position, size and rotation are added by canvas, options without a property are left to code*/
  properties?: WidgetProperties<O>;
}

/**Gives the definition as it is, typed by its options, which are taken from the parameter of create
 * Register definitions through it, so the properties are checked against the options:
 * group.add("box", "Box", "", canvas.definition({ create: (options: BoxOptions) => ..., properties: { ... } }))*/
export function widget_definition<O extends WidgetBaseOptions>(
  definition: WidgetDefinition<O>,
): WidgetDefinition<O> {
  return definition;
}

/**Widget definitions, register groups and definitions in it, like
 * canvas.widgets.group("basic", "Basic", "").add("rectangle", "Rectangle", "", canvas.definition({ create: rectangle }))*/
export const WIDGETS = depot.type<WidgetDefinition>(
  "widgets",
  "Widgets",
  "Elements placed on canvas pages",
);

/**A widget on a page, data shared by every viewport showing the page*/
export interface CanvasWidget<O extends WidgetBaseOptions = WidgetBaseOptions> {
  /**Path of the widget definition in the depot, like "/widgets/basic/rectangle"
   * Until the path is registered the widget shows an error in its place*/
  readonly widget: string;
  /**Options of the widget, a state for every option, the same states for every viewport, so a change in one shows in all
   * A state holds the value of the option, or a link to a state of the depot, see CanvasLink, writing the state switches between them
   * A read only state locks the option*/
  readonly options: WidgetOptionStates<O>;
}

/**A page of widgets, data that any number of viewports show at once*/
export interface CanvasPage {
  /**Width of the page in page units, 1920 when undefined*/
  readonly width?: StateOrVal<number>;
  /**Height of the page in page units, 1080 when undefined*/
  readonly height?: StateOrVal<number>;
  /**Widgets on the page, the last is drawn on top
   * A widget object is shown once per page, the same widget twice in the array is shown once*/
  readonly widgets?: StateOrVal<readonly CanvasWidget[]>;
}

/**A widget for a page, the options are checked against the definition
 * A fixed value or link is made a writable state, so every viewport shares it and it can be changed, a state is used as it is*/
export function canvas_widget<O extends WidgetBaseOptions>(
  definition: DepotEntry<WidgetDefinition<O>>,
  options: NoInfer<WidgetOptionsInput<O>>,
): CanvasWidget<O> {
  const states: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options))
    if (value !== undefined)
      states[key] = state.is.state(value) ? value : state.ok_w<unknown>(value);
  //Every option is made a state of its own value type
  return { widget: definition.path, options: states as WidgetOptionStates<O> };
}

const is_record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**Builds a page from its JSON, like the JSON a settings group stores for a page state, with a writable state for every value,
 * so the page can be changed and stored again, and a link for every saved link. Gives none when the JSON is not a page
 * Made to be the check of get of a settings group:
 * group.get("page", empty_page, canvas.page_from_json)*/
export function page_from_json(json: unknown): Option<CanvasPage> {
  if (!is_record(json)) return none();
  const { width, height, widgets } = json;
  if (width !== undefined && typeof width !== "number") return none();
  if (height !== undefined && typeof height !== "number") return none();
  if (widgets !== undefined && !Array.isArray(widgets)) return none();
  const list: CanvasWidget[] = [];
  for (const widget of (widgets ?? []) as unknown[]) {
    if (!is_record(widget) || typeof widget.widget !== "string") return none();
    if (widget.options !== undefined && !is_record(widget.options))
      return none();
    const options: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(widget.options ?? {})) {
      if (value === undefined) continue;
      if (!is_link_json(value)) {
        options[key] = state.ok_w<unknown>(value);
        continue;
      }
      const link = link_from_json(value);
      if (!link.some) return none();
      options[key] = state.ok_w<unknown>(link.value);
    }
    list.push({ widget: widget.widget, options });
  }
  return some({
    width: state.ok_w(width ?? 1920),
    height: state.ok_w(height ?? 1080),
    widgets: state.ok_w(list),
  });
}

/**Every property of a widget made from the definition, position, size and rotation first, then those of the definition*/
export function widget_properties(
  definition: WidgetDefinition,
): [string, WidgetProperty][] {
  return [
    ...geometry_properties(definition.size ?? DEFAULT_WIDGET_SIZE),
    ...Object.entries<WidgetProperty>(definition.properties ?? {}),
  ];
}

/**A new widget from a definition, every property a writable state starting at its default, so it can be changed and stored
 * Gives the error of the definition when it has none, like a definition registered as a state in error
 * @param at position of the new widget, 0,0 when undefined*/
export async function new_widget<O extends WidgetBaseOptions>(
  definition: DepotEntry<WidgetDefinition<O>>,
  at: { x: number; y: number } = { x: 0, y: 0 },
): Promise<ResultNice<CanvasWidget<O>>> {
  const content = await definition.value;
  if (!content.ok) return err(content.error);
  const options: Record<string, unknown> = {};
  for (const [key, property] of widget_properties(content.value))
    options[key] = state.ok_w<unknown>(property.default);
  (options.x as ReturnType<typeof state.ok_w<number>>).set_ok(at.x);
  (options.y as ReturnType<typeof state.ok_w<number>>).set_ok(at.y);
  //The options are made from the properties, which are typed by the options
  return ok({
    widget: definition.path,
    options: options as WidgetOptionStates<O>,
  });
}
