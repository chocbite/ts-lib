import depot, { type DepotEntry } from "@chocbite/ts-lib/depot";
import {
  err,
  err_nice,
  none,
  ok,
  some,
  type Option,
  type ResultNice,
} from "@chocbite/ts-lib/result";
import state, {
  type State,
  type StateOrVal,
  type StateREAW,
  type StateREA,
  type StateROS,
} from "@chocbite/ts-lib/state";
import {
  is_link_json,
  link_from_json,
  option_input,
  type OptionState,
  type WidgetOptionStates,
  type WidgetOptionsInput,
} from "./link";
import { free_id, id_taken, id_taken_error, widget_id } from "./ids";
import type { OutlineItem } from "./outline/item";
import type { OwnedProperty, PropertyOwner } from "./property/owner";
import {
  DEFAULT_WIDGET_SIZE,
  base_properties,
  property_value,
  type WidgetProperties,
  type WidgetProperty,
} from "./property/properties";
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
   * Position, size, rotation, opacity and visible are added by canvas, options without a property are left to code*/
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

/**The id the definition of a widget is registered with, the last part of its path, like "rectangle" for "/widgets/basic/rectangle"
 * Constant and needing no lookup, unlike the name, which is for showing, see widget_name
 * @param path the path of the definition, the widget of a CanvasWidget*/
export function widget_kind(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**The name the definition at the path is registered with, for showing
 * Follows the lookup and the name, so a registration, a removal or a rename shows,
 * the last part of the path while the definition is not registered, see widget_kind*/
function widget_name(path: string): StateROS<string> {
  const kind = widget_kind(path);
  return depot
    .get(path)
    .proxy_ok((node) =>
      ok(
        node.ok && node.value.kind === "entry" && node.value.type === WIDGETS
          ? node.value.name
          : kind,
      ),
    )
    .nested((name) => name);
}

/**The kind of the error of a widget whose definition is not registered*/
const NOT_REGISTERED = Symbol("Not a registered widget");

/**The properties of the definition at the path, following the lookup and the definition*/
function definition_properties(
  path: string,
): StateREA<readonly [string, WidgetProperty][]> {
  return depot
    .get(path)
    .proxy((node) =>
      node.ok && node.value.kind === "entry" && node.value.type === WIDGETS
        ? //The entry is in the widgets type, so its content is a widget definition
          ok(node.value.value as StateOrVal<WidgetDefinition>)
        : err_nice(NOT_REGISTERED, path),
    )
    .nested((definition) => definition)
    .proxy_map((definition) => widget_properties(definition));
}

/**The data of a widget, the path of its definition and a state for every option, what a page holds in its widgets and saves
 * Made with canvas.widget, canvas.new_widget or from JSON, the page makes the CanvasWidget of it, see CanvasPage.widget_of*/
export interface CanvasWidgetData<
  O extends WidgetBaseOptions = WidgetBaseOptions,
> {
  /**Path of the widget definition in the depot, like "/widgets/basic/rectangle"*/
  readonly widget: string;
  /**A state for every option, the same states for every viewport, so a change in one shows in all
   * A state holds the value of the option, or a link to a state of the depot, see CanvasLink, writing the state switches between them
   * A read only state locks the option*/
  readonly options: WidgetOptionStates<O>;
}

/**A widget on a page, made by the page for an entry of its widgets, see CanvasPage.widget_of, so it always knows its page
 * Every viewport showing the page shows it, it is the owner of its options in the properties editor and an item of the outline,
 * its name and properties those of its definition*/
export class CanvasWidget<O extends WidgetBaseOptions = WidgetBaseOptions>
  implements PropertyOwner, OutlineItem
{
  /**The data the widget is made of, an entry of the widgets of its page*/
  readonly data: CanvasWidgetData<O>;
  /**The page that made the widget, the content of a group for a widget in a group*/
  readonly page: CanvasPage;
  /**The options of the data, the id through a state that refuses an id another widget of the page has,
   * and gives an empty id the id the page gives, see free_id*/
  readonly options: WidgetOptionStates<O>;

  /**Internal to canvas, a page makes its widgets, see CanvasPage.widget_of*/
  constructor(page: CanvasPage, data: CanvasWidgetData<O>) {
    this.page = page;
    this.data = data;
    const id = (data.options as Record<string, OptionState<unknown> | undefined>)
      .id;
    this.options = (
      id?.writable
        ? { ...data.options, id: this.#checked_id(id as StateREAW<unknown>) }
        : data.options
    );
  }

  /**The id state as the widget gives it, a write of an id another widget of the page has is refused, an empty id is given one*/
  #checked_id(id: StateREAW<unknown>) {
    return id.proxy_w((result) => result, {
      write: (value, source) => {
        if (typeof value !== "string") return source.write(value);
        const widgets = this.page.widgets_now();
        if (value === "") return source.write(free_id(widgets, this));
        return id_taken(widgets, this, value)
          ? Promise.resolve(id_taken_error(value))
          : source.write(value);
      },
    });
  }

  /**Path of the widget definition in the depot, like "/widgets/basic/rectangle"
   * Until the path is registered the widget shows an error in its place*/
  get widget(): string {
    return this.data.widget;
  }

  #name?: StateROS<string>;
  /**The name the definition is registered with, the last part of the path while it is not registered*/
  get name(): StateROS<string> {
    return (this.#name ??= widget_name(this.widget));
  }

  #properties?: StateREA<readonly OwnedProperty[]>;
  /**The properties of the definition with the state of the option of each, an error while the definition is not registered*/
  get properties(): StateREA<readonly OwnedProperty[]> {
    return (this.#properties ??= definition_properties(this.widget).proxy_map(
      (properties) =>
        properties.map(([key, property]) => ({
          key,
          property,
          states: [this.option(key)],
        })),
    ));
  }

  /**The state of an option, undefined when the widget has none*/
  option(key: string): OptionState<unknown> | undefined {
    return (this.options as Record<string, OptionState<unknown> | undefined>)[
      key
    ];
  }

  #inputs = new Map<string, State<State<unknown, any, any>, any, any>>();
  /**The state the element of the widget is given for an option, as the value of a state, undefined when the widget has no state for it
   * The state of the option while it holds a value, the linked state, through its transforms and converted to the kind of the property,
   * while it holds a link, see CanvasLink. Made once and shared, so every viewport gives its element the same state*/
  input(key: string): State<State<unknown, any, any>, any, any> | undefined {
    let input = this.#inputs.get(key);
    if (input) return input;
    const option = this.option(key);
    if (!option) return undefined;
    input = option_input(option, (value) => {
      const kind = property_kind(this.widget, key);
      return kind ? property_value(kind, value) : ok(value);
    });
    this.#inputs.set(key, input);
    return input;
  }

  #values = new Map<string, State<unknown, any, any>>();
  /**The value of an option as the element of the widget gets it, links followed, undefined when the widget has no state for it
   * Writing it writes the option, or the linked state while it is linked, it is writable while the state given to the element is*/
  value(key: string): State<unknown, any, any> | undefined {
    let value = this.#values.get(key);
    if (value) return value;
    const input = this.input(key);
    if (!input) return undefined;
    value = input.nested((given) => given) as State<unknown, any, any>;
    this.#values.set(key, value);
    return value;
  }

  /**The id option, an id is a text as its property is a text without a link*/
  get id(): State<string> | undefined {
    return this.option("id") as State<string> | undefined;
  }

  /**The keys of the inputs the element of the widget is given, see input, the keys of its options*/
  input_keys(): readonly string[] {
    return Object.keys(this.options);
  }

  /**The widgets inside the widget, the content of a group, undefined for other widgets*/
  get children(): StateROS<readonly CanvasWidget[]> | undefined {
    return undefined;
  }
}

/**A page of widgets, data that any number of viewports show at once, see canvas.page*/
export interface CanvasPageData {
  /**ID of the page, shown in the properties editor, empty when undefined*/
  readonly id?: StateOrVal<string>;
  /**Width of the page in page units, 1920 when undefined*/
  readonly width?: StateOrVal<number>;
  /**Height of the page in page units, 1080 when undefined*/
  readonly height?: StateOrVal<number>;
  /**Background of the page, a CSS color, the page background of the theme when undefined*/
  readonly background?: StateOrVal<string>;
  /**The data of the widgets on the page, the last is drawn on top, the page makes a widget for every entry
   * Change it with the array helpers or write instructions of the state, so the page and viewports touch only the widgets that changed*/
  readonly widgets?: StateOrVal<readonly CanvasWidgetData[]>;
}

/**Properties of a page
 * The values of a page are not resolved like the options of widgets, so they can not be linked*/
const PAGE_PROPERTIES: readonly [
  Exclude<keyof CanvasPageData, "widgets">,
  WidgetProperty,
][] = [
  [
    "id",
    { kind: "text", name: "ID", default: "", linkable: false, unique: true },
  ],
  [
    "width",
    {
      kind: "number",
      name: "Width",
      default: 1920,
      min: 1,
      unit: "px",
      linkable: false,
    },
  ],
  [
    "height",
    {
      kind: "number",
      name: "Height",
      default: 1080,
      min: 1,
      unit: "px",
      linkable: false,
    },
  ],
  [
    "background",
    {
      kind: "color",
      name: "Background",
      default: "#ffffff",
      alpha: true,
      linkable: false,
    },
  ],
];
const PAGE_NAME = state.ok("Page");

/**A page of widgets, made with canvas.page or page_from_json, its values are states, which is what it is stored as
 * The page makes the widgets of the entries of its widgets, see widget_of, so a widget is made by its page and knows it
 * It is the owner of its values in the properties editor, a value that is not a writable state is only shown,
 * and an item of the outline, its widgets the items inside it*/
export class CanvasPage implements PropertyOwner, OutlineItem {
  readonly id: State<string>;
  readonly width: State<number>;
  readonly height: State<number>;
  /**The page background of the theme when undefined*/
  readonly background: State<string> | undefined;
  /**The data of the widgets, the page makes a widget for every entry*/
  readonly widgets: State<readonly CanvasWidgetData[]>;
  readonly #group: CanvasGroup | undefined;
  /**The widget made for every entry, kept while the entry is, so an entry always gives the same widget*/
  readonly #made = new WeakMap<CanvasWidgetData, CanvasWidget>();
  /**The widgets made, following the widgets while something follows them*/
  readonly #children = state.ok_w<readonly CanvasWidget[]>([]);

  /**A value that is not a state is made a read only state, see canvas.page
   * @param group the group the page is the content of*/
  constructor(data: CanvasPageData = {}, group?: CanvasGroup) {
    const as_state = <T>(value: StateOrVal<T> | undefined, fallback: T) =>
      state.is.state(value) ? value : state.ok(value ?? fallback);
    this.id = as_state(data.id, "");
    this.width = as_state(data.width, 1920);
    this.height = as_state(data.height, 1080);
    this.background =
      data.background === undefined ? undefined : as_state(data.background, "");
    this.widgets = as_state<readonly CanvasWidgetData[]>(data.widgets, []);
    this.#group = group;
    //The children follow the widgets only while something follows the children
    const follow = (entries: ResultNice<readonly CanvasWidgetData[]>) =>
      this.#apply(entries);
    this.#children.set_onsub(() => this.widgets.sub(follow, true));
    this.#children.set_onunsub(() => this.widgets.unsub(follow));
  }

  /**The group the page is the content of, undefined for a page of its own*/
  get group(): CanvasGroup | undefined {
    return this.#group;
  }

  /**The widget the page makes for an entry of its widgets, the same widget for the same entry
   * A new widget whose id is empty, or taken by a widget before it on the page, is given one, see free_id*/
  widget_of<O extends WidgetBaseOptions>(
    data: CanvasWidgetData<O>,
  ): CanvasWidget<O> {
    let widget = this.#made.get(data) as CanvasWidget<O> | undefined;
    if (widget) return widget;
    widget =
      data.widget === GROUP
        ? (new CanvasGroup(this, data) as unknown as CanvasWidget<O>)
        : new CanvasWidget(this, data);
    this.#made.set(data, widget);
    give_id(widget, this.#entries());
    return widget;
  }

  /**The entries of the widgets now*/
  #entries(): readonly CanvasWidgetData[] {
    const entries = this.widgets.rsync ? this.widgets.get() : undefined;
    return entries?.ok ? entries.value : [];
  }

  /**The widgets of the page now, in drawing order*/
  widgets_now(): readonly CanvasWidget[] {
    return this.#entries().map((entry) => this.widget_of(entry));
  }

  /**The widgets of the page, made from its widgets, in drawing order, follow it to follow them
   * Only the widgets of the entries added, removed or moved change, like the widgets, see state.a.read*/
  get children(): StateROS<readonly CanvasWidget[]> {
    return this.#children.read_only;
  }

  /**Applies the changes of the widgets to the widgets made, an error keeps the widgets*/
  #apply(entries: ResultNice<readonly CanvasWidgetData[]>) {
    if (!entries.ok) return;
    const made = this.#children.array;
    const make = (items: readonly CanvasWidgetData[]) =>
      items.map((entry) => this.widget_of(entry));
    for (const change of state.a.read(entries.value))
      switch (change.type) {
        case "fresh":
          this.#children.set_ok(make(change.items));
          break;
        case "added":
          made.splice(change.index, 0, ...make(change.items));
          break;
        case "removed":
          made.splice(change.index, change.items.length);
          break;
        case "changed":
          made.splice(
            change.index,
            change.items.length,
            ...make(change.items),
          );
          break;
        case "moved":
          made.move(change.from_index, change.to_index, change.items.length);
          break;
      }
  }

  /**What the page is stored and followed as, its values, see state.v.OVERRIDE_KEY*/
  [state.v.OVERRIDE_KEY]() {
    return {
      id: this.id,
      width: this.width,
      height: this.height,
      background: this.background,
      widgets: this.widgets,
    };
  }

  get name(): StateROS<string> {
    return PAGE_NAME;
  }

  #properties?: StateREA<readonly OwnedProperty[]>;
  /**The id, width, height and background with their states, a read only state is only shown*/
  get properties(): StateREA<readonly OwnedProperty[]> {
    return (this.#properties ??= state.ok(
      PAGE_PROPERTIES.map(([key, property]) => ({
        key,
        property,
        states: [this[key] as OptionState<unknown> | undefined],
      })),
    ));
  }
}

/**Gives a new widget an id when its id is empty, or taken by a widget before it on its page, see free_id
 * A widget with a read only id state, or without one, keeps its id*/
function give_id(widget: CanvasWidget, entries: readonly CanvasWidgetData[]) {
  const id = (
    widget.data.options as Record<string, OptionState<unknown> | undefined>
  ).id;
  if (!id?.writable) return;
  const now = widget_id(widget.data);
  const index = entries.indexOf(widget.data);
  const before = index === -1 ? entries : entries.slice(0, index);
  if (now && !before.some((entry) => widget_id(entry) === now)) return;
  void id.write?.(free_id(entries, widget.data));
}

/**Path of the group widget, a widget whose content is a page of widgets of its own, see group_widget.ts
 * Its widgets option holds the data of the widgets of its content, which are saved, loaded and copied with it*/
export const GROUP = "/widgets/canvas/group";

/**A group, a widget whose content is a page of widgets of its own, made by a page for an entry of the path GROUP
 * The content page is made from the options of the group: its id, content_width, content_height, background, transparent
 * when the group has none, and widgets, so it is saved with the group, the content makes the widgets in it*/
export class CanvasGroup extends CanvasWidget {
  readonly #content: CanvasPage;
  /**The content of the group, a page made from its options*/
  get content(): CanvasPage {
    return this.#content;
  }
  /**Internal to canvas, a page makes its widgets, see CanvasPage.widget_of*/
  constructor(page: CanvasPage, data: CanvasWidgetData) {
    super(page, data);
    this.#content = new CanvasPage(
      {
        id: this.option("id") as State<string> | undefined,
        width: this.value("content_width") as State<number> | undefined,
        height: this.value("content_height") as State<number> | undefined,
        background:
          (this.value("background") as State<string> | undefined) ??
          "transparent",
        widgets: this.option("widgets") as
          State<readonly CanvasWidgetData[]> | undefined,
      },
      this,
    );
  }

  /**The element of a group is given its content, the page it shows, instead of the data of the widgets in it*/
  input_keys(): readonly string[] {
    return [...super.input_keys().filter((key) => key !== "widgets"), "content"];
  }

  #content_input?: State<State<unknown, any, any>, any, any>;
  /**The content is given to the element of the group as its content input*/
  input(key: string): State<State<unknown, any, any>, any, any> | undefined {
    if (key !== "content") return super.input(key);
    return (this.#content_input ??= state.ok(state.ok(this.#content)));
  }

  get children(): StateROS<readonly CanvasWidget[]> {
    return this.#content.children;
  }
}

/**Whether the widget is a group*/
export const is_group = (widget: CanvasWidget): widget is CanvasGroup =>
  widget instanceof CanvasGroup;

/**The groups from the page down to the widget, the group it is in last, empty for a widget of the page,
 * undefined when the widget is not of the page or a group in it, found through the pages of the widgets*/
export function path_of(
  page: CanvasPage,
  widget: CanvasWidget,
): CanvasGroup[] | undefined {
  const path: CanvasGroup[] = [];
  for (let level: CanvasPage | undefined = widget.page; level; ) {
    if (level === page) return path.reverse();
    const group: CanvasGroup | undefined = level.group;
    if (!group) return undefined;
    path.push(group);
    level = group.page;
  }
  return undefined;
}

/**A page from its values, a value that is not a state is made a read only state*/
export function canvas_page(data: CanvasPageData = {}): CanvasPage {
  return new CanvasPage(data);
}

/**The data of a widget for the widgets of a page, the options are checked against the definition, the page makes the widget of it
 * An initial value or link is made a writable state, so every viewport shares it and it can be changed, a state is used as it is*/
export function canvas_widget<O extends WidgetBaseOptions>(
  definition: DepotEntry<WidgetDefinition<O>>,
  options: NoInfer<WidgetOptionsInput<O>>,
): CanvasWidgetData<O> {
  const states: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options))
    if (value !== undefined)
      states[key] = state.is.state(value) ? value : state.ok_w<unknown>(value);
  with_base_options(states, definition_size(definition));
  //Every option is made a state of its own value type
  return {
    widget: definition.path,
    options: states as WidgetOptionStates<O>,
  };
}

/**The size of the definition when it is there already, as it is for a definition registered as a value*/
function definition_size(
  definition: DepotEntry<WidgetDefinition<any>>,
): { width: number; height: number } | undefined {
  const value = definition.value;
  if (!state.is.state(value)) return value.size;
  const content = value.rsync ? value.get() : undefined;
  return content?.ok ? content.value.size : undefined;
}

/**The definition at the path, when it is registered and there already*/
function definition_at(path: string): WidgetDefinition | undefined {
  const node = depot.get(path);
  const found = node.rsync ? node.get() : undefined;
  if (!found?.ok) return undefined;
  const entry = found.value;
  if (entry.kind !== "entry" || entry.type !== WIDGETS) return undefined;
  //The entry is in the widgets type, so its content is a widget definition
  const value = entry.value as StateOrVal<WidgetDefinition>;
  if (!state.is.state(value)) return value;
  const content = value.rsync ? value.get() : undefined;
  return content?.ok ? content.value : undefined;
}

/**The size of the definition at the path, when it is registered and there already*/
const size_at = (path: string) => definition_at(path)?.size;

/**The kind of every property of a definition, made once per definition*/
const KINDS = new WeakMap<
  WidgetDefinition,
  Map<string, WidgetProperty["kind"]>
>();
/**The kind of every base property, for a widget whose definition is not there yet*/
const BASE_KINDS = new Map<string, WidgetProperty["kind"]>(
  base_properties(DEFAULT_WIDGET_SIZE).map(([key, property]) => [
    key,
    property.kind,
  ]),
);

/**The kind of the property of an option, linked values are converted to it, undefined for an option without a property
 * The base properties are known before the definition is there*/
function property_kind(
  path: string,
  key: string,
): WidgetProperty["kind"] | undefined {
  const definition = definition_at(path);
  if (!definition) return BASE_KINDS.get(key);
  let kinds = KINDS.get(definition);
  if (!kinds) {
    kinds = new Map(
      widget_properties(definition).map(([key, property]) => [
        key,
        property.kind,
      ]),
    );
    KINDS.set(definition, kinds);
  }
  return kinds.get(key);
}

/**Gives the options a writable state at the default for every base property they have none for,
 * so the id, position, size, rotation, opacity and visible can always be changed and linked
 * @param size of the definition, width and height default to it*/
function with_base_options(
  options: Record<string, unknown>,
  size = DEFAULT_WIDGET_SIZE,
): void {
  for (const [key, property] of base_properties(size))
    options[key] ??= state.ok_w<unknown>(property.default);
}

const is_record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**The data of widgets from their JSON, a writable state for every value and a link for every saved link, the widgets of groups too,
 * undefined when the JSON is not widgets*/
export function widgets_from_json(
  json: unknown[],
): CanvasWidgetData[] | undefined {
  const list: CanvasWidgetData[] = [];
  for (const widget of json) {
    if (!is_record(widget) || typeof widget.widget !== "string")
      return undefined;
    if (widget.options !== undefined && !is_record(widget.options))
      return undefined;
    const options: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(widget.options ?? {})) {
      if (value === undefined) continue;
      if (widget.widget === GROUP && key === "widgets") {
        if (!Array.isArray(value)) return undefined;
        const inside = widgets_from_json(value as unknown[]);
        if (!inside) return undefined;
        options[key] = state.ok_w<CanvasWidgetData[]>(inside);
        continue;
      }
      if (!is_link_json(value)) {
        options[key] = state.ok_w<unknown>(value);
        continue;
      }
      const link = link_from_json(value);
      if (!link.some) return undefined;
      options[key] = state.ok_w<unknown>(link.value);
    }
    //Pages stored before a base property was added get it too
    with_base_options(options, size_at(widget.widget));
    list.push({
      widget: widget.widget,
      options: options,
    });
  }
  return list;
}

/**The JSON of the data of a widget as its options are now, the way a page saves it, the widgets of a group too,
 * links as their $link objects, an option whose state has no value now is left out*/
export function widget_to_json(widget: CanvasWidgetData): {
  widget: string;
  options: Record<string, unknown>;
} {
  const options: Record<string, unknown> = {};
  for (const [key, option] of Object.entries(
    widget.options as Record<string, StateROS<unknown> | undefined>,
  )) {
    const now = option?.rsync ? option.get() : undefined;
    if (!now?.ok || now.value === undefined) continue;
    options[key] =
      widget.widget === GROUP && key === "widgets"
        ? (now.value as CanvasWidgetData[]).map(widget_to_json)
        : (JSON.parse(JSON.stringify(now.value)) as unknown);
  }
  return { widget: widget.widget, options };
}

/**Builds a page from its JSON, like the JSON a settings group stores for a page state, with a writable state for every value,
 * so the page can be changed and stored again, and a link for every saved link. Gives none when the JSON is not a page
 * Made to be the check of get of a settings group:
 * group.get("page", empty_page, canvas.page_from_json)*/
export function page_from_json(json: unknown): Option<CanvasPage> {
  if (!is_record(json)) return none();
  const { id, width, height, background, widgets } = json;
  if (id !== undefined && typeof id !== "string") return none();
  if (background !== undefined && typeof background !== "string") return none();
  if (width !== undefined && typeof width !== "number") return none();
  if (height !== undefined && typeof height !== "number") return none();
  if (widgets !== undefined && !Array.isArray(widgets)) return none();
  const list = widgets_from_json((widgets ?? []) as unknown[]);
  if (!list) return none();
  //Every value a writable state, so the properties editor can change it, white for pages saved without a background
  return some(
    new CanvasPage({
      id: state.ok_w(id ?? ""),
      width: state.ok_w(width ?? 1920),
      height: state.ok_w(height ?? 1080),
      background: state.ok_w(background ?? "#ffffff"),
      widgets: state.ok_w(list),
    }),
  );
}

/**Every property of a widget made from the definition, position, size, rotation, opacity and visible first, then those of the definition*/
export function widget_properties(
  definition: WidgetDefinition,
): [string, WidgetProperty][] {
  return [
    ...base_properties(definition.size ?? DEFAULT_WIDGET_SIZE),
    ...Object.entries<WidgetProperty>(definition.properties ?? {}),
  ];
}

/**The data of a new widget from a definition, every property a writable state starting at its default, so it can be changed and stored
 * Gives the error of the definition when it has none, like a definition registered as a state in error
 * @param at position of the new widget, 0,0 when undefined*/
export async function new_widget<O extends WidgetBaseOptions>(
  definition: DepotEntry<WidgetDefinition<O>>,
  at: { x: number; y: number } = { x: 0, y: 0 },
): Promise<ResultNice<CanvasWidgetData<O>>> {
  const content = await state.as_state(definition.value).read();
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
