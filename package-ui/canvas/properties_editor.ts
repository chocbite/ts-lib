import {
  AccessTypes,
  Base,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import list from "#list";
import depot from "@chocbite/ts-lib/depot";
import { NiceError, ok, type ResultNice } from "@chocbite/ts-lib/result";
import state, {
  type State,
  type StateOrVal,
  type StateREAW,
} from "@chocbite/ts-lib/state";
import {
  widget_properties,
  WIDGETS,
  type CanvasPage,
  type CanvasWidget,
  type WidgetDefinition,
} from "./data";
import { linked_field, LinkField, property_field } from "./fields";
import {
  group_bounds,
  GroupRotation,
  transform_group,
  wrap_angle,
} from "./group";
import { refuse_taken_ids } from "./ids";
import {
  CanvasLink,
  option_value_state,
  same_link,
  type OptionState,
} from "./link";
import { page_widgets_of, widget_element_of } from "./page";
import type { WidgetProperty } from "./properties";
import { WIDGET_ELEMENTS_EVENT } from "./slot";
import {
  WIDGET_CHANGE,
  WIDGET_CHANGEABLE,
  WIDGET_GEOMETRY,
  WIDGET_TRANSFORM_EVENT,
  type WidgetBase,
  type WidgetGeometry,
} from "./widget";
import "./properties_editor.scss";

/**Inputs of the properties editor*/
const PROPERTIES = {
  /**The selected widgets, give the selection state of the viewports to follow the selection
   * One widget shows its properties, several the properties they all have, the editor only reads it*/
  selected: input_key<StateOrVal<readonly CanvasWidget[]>>(),
  /**The page of the widgets, its properties are shown while nothing is selected, the editor writes the states of it*/
  page: input_key<StateOrVal<CanvasPage | undefined>>(),
};

/**Properties of the page, shown while nothing is selected
 * The values of a page are not resolved like the options of widgets, so they can not be linked*/
const PAGE_PROPERTIES: [string, WidgetProperty][] = [
  ["id", { kind: "text", name: "ID", default: "", linkable: false }],
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
export type CanvasPropertiesOptions = BaseOptions &
  InputOptions<typeof PROPERTIES>;

/**The parts of several widgets shown as the box around them, like the transformer shows it*/
const BOX = new Set(["x", "y", "width", "height", "rotation"]);

/**A row of the editor for a property of the shown widgets and the values of their options*/
interface PropertyRow {
  /**The widgets the property is of, one per selected widget*/
  widgets: readonly CanvasWidget[];
  key: string;
  property: WidgetProperty;
  /**The state of the option of every widget, undefined for a widget without one*/
  options: (OptionState<unknown> | undefined)[];
  /**The link the option of every widget holds, undefined while it holds a value*/
  links: (CanvasLink | undefined)[];
  /**Whether every option holds the same value, always for one widget*/
  same: boolean;
  /**For several widgets, x, y, width, height or rotation of the box around them*/
  box: boolean;
}

/**A row of the editor for a section, its properties are its sub rows*/
interface SectionRow {
  section: string;
  rows: PropertyRow[];
}

type EditorRow = PropertyRow | SectionRow;
const is_section = (row: EditorRow): row is SectionRow => "rows" in row;

/**Writes the value to every option, the first error when one refuses it*/
async function write_all(
  options: readonly (OptionState<unknown> | undefined)[],
  value: unknown,
): Promise<ResultNice<void>> {
  const results = await Promise.all(
    options.map((option) => Promise.resolve(option?.write?.(value))),
  );
  for (const result of results) if (result && !result.ok) return result;
  return ok(undefined);
}

/**A form element that only shows, the user can not change it*/
const read_only = (element: HTMLElement): HTMLElement => {
  (element as Base).set({ access: AccessTypes.Read });
  return element;
};

/**The rows of the properties, those of a section in a section row at the place of its first property, those without one at the root*/
function editor_rows(properties: PropertyRow[]): EditorRow[] {
  const rows: EditorRow[] = [];
  const sections = new Map<string, SectionRow>();
  for (const row of properties) {
    const name = row.property.section;
    if (!name) {
      rows.push(row);
      continue;
    }
    let section = sections.get(name);
    if (!section) {
      section = { section: name, rows: [] };
      sections.set(name, section);
      rows.push(section);
    }
    section.rows.push(row);
  }
  return rows;
}

/**The properties all the definitions have, with the same kind, in the order of the first,
 * without the id for several widgets, as ids are unique*/
function common_properties(
  definitions: readonly WidgetDefinition[],
): [string, WidgetProperty][] {
  const [first, ...rest] = definitions.map((definition) =>
    widget_properties(definition),
  );
  const others = rest.map((properties) => new Map(properties));
  return first.filter(
    ([key, property]) =>
      !(others.length && key === "id") &&
      others.every((other) => other.get(key)?.kind === property.kind),
  );
}

/**The value an option holds now, NONE while it has none*/
const NONE = Symbol("none");
const value_now = (option: OptionState<unknown> | undefined): unknown => {
  const value = option?.rsync ? option.get() : undefined;
  return value?.ok ? value.value : NONE;
};

/**Shows the properties of the selected widgets in a list, a row per property with a field bound to the options of the widgets,
 * so a change in the editor shows in every viewport showing the widgets, and a move in a viewport shows in the editor
 * Properties with a section are the sub rows of a row for the section, so widgets with many properties stay manageable
 *
 * Several widgets show the properties they all have, without the id
 * A value they share is shown and a change sets it on all of them, where the values differ the field is blank,
 * x, y, width, height and rotation are the box around them, like the transformer shows it, changing it moves, scales and turns
 * them like the transformer does, the rotation of the box is kept while the same widgets are selected, see GroupRotation
 * The chain links the option of all of them, a property linked in only some of them is blank and read only*/
class PropertiesEditor extends Base {
  static element_name() {
    return "properties";
  }
  static element_name_space() {
    return "canvas";
  }

  #title = this.appendChild(document.createElement("div"));
  #rows = state.ok_w<EditorRow[]>([]);
  /**Names of the open sections, kept when the rows are made again, like for another selected widget*/
  #open = new Set<string>();

  constructor() {
    super();
    this.#title.className = "title";
    this.#title.textContent = "Nothing selected";
    this.appendChild(
      list.container(
        {
          transform: (row: EditorRow) =>
            is_section(row)
              ? ok({
                  key_field: { text: row.section },
                  openable: true,
                  opened: this.#open.has(row.section),
                  sub_rows: () => row.rows,
                  values: { value: row, link: row },
                })
              : ok({
                  key_field: { text: row.property.name },
                  values: { value: row, link: row },
                }),
          headless: true,
          sub_rows: true,
        },
        {
          columns: {
            value: list.column({
              title: "Value",
              //A node field, as each property has an element of its own kind
              field_gen: () =>
                list.node_field<Node>(document.createTextNode("")),
              field_apply: (field, row: EditorRow) => {
                field.node = is_section(row)
                  ? document.createTextNode("")
                  : this.#field(row);
              },
            }),
            link: list.column({
              title: "Link",
              //As wide as the link icon needs, also when it is bigger in touch mode, so it does not take width from the values
              fixed_width: "min",
              field_gen: () => new LinkField(),
              field_apply: (field, row: EditorRow) =>
                is_section(row) || row.box
                  ? field.show(undefined)
                  : field.show(
                      row.options,
                      row.property,
                      row.links.some((link) => link !== undefined),
                    ),
            }),
          },
          rows: this.#rows,
        },
      ),
    );
  }

  set(options: CanvasPropertiesOptions): this {
    super.set(options);
    this.set_input(PROPERTIES.page, options.page, (page) => {
      this.#page = page.ok ? page.value : undefined;
      if (!this.#selected.length) this.#show(this.#selected);
    });
    this.set_input(PROPERTIES.selected, options.selected, (selected) => {
      this.#selected = selected.ok ? selected.value : [];
      this.#show(this.#selected);
    });
    return this;
  }

  #page: CanvasPage | undefined;
  #selected: readonly CanvasWidget[] = [];

  /**Shows the properties of the page, its values as they are given, a value that is not a writable state is only shown*/
  #show_page(page: CanvasPage) {
    this.#title.textContent = "Page";
    const options: Record<string, OptionState<unknown> | undefined> = {};
    for (const [key] of PAGE_PROPERTIES) {
      const value = page[key as keyof CanvasPage];
      if (value !== undefined)
        options[key] = (
          state.is.state(value) ? value : state.ok(value)
        ) as OptionState<unknown>;
    }
    //The page as a widget with its values as options, so its rows work like those of a widget
    this.#follow([{ widget: "", options }], PAGE_PROPERTIES);
  }

  protected disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#detach_box();
  }

  /**The field of a property, by how the options of the widgets hold their values*/
  #field(row: PropertyRow): Node {
    const { property, options, links } = row;
    if (row.box) return property_field(property, this.#box_state(row.key));
    const first_link = links[0];
    if (
      first_link &&
      links.every((link) => link && same_link(link, first_link))
    )
      return linked_field(first_link, property);
    //Linked in only some of them, or to different states
    if (links.some((link) => link !== undefined))
      return read_only(property_field(property, undefined));
    if (options.length === 1) {
      const option = options[0];
      //Without a state the widget shows its default, which can not be changed here
      if (!option) return property_field(property, state.ok(property.default));
      const value = option_value_state(option);
      return property_field(
        property,
        row.key === "id"
          ? refuse_taken_ids(row.widgets[0], value, () =>
              page_widgets_of(row.widgets[0]),
            )
          : value,
      );
    }
    const writable = options.every((option) => option?.writable);
    if (!row.same)
      return writable
        ? property_field(property, undefined, (value) => {
            void write_all(options, value);
          })
        : read_only(property_field(property, undefined));
    //The same value, shown from the first, written to all
    const first = option_value_state(options[0]!);
    if (!writable) return property_field(property, state.proxy.rea(first));
    return property_field(
      property,
      state.proxy.reaw(first as StateREAW<unknown>, undefined, {
        write: (value) => write_all(options, value),
      }),
    );
  }

  /**Shows the rows, keeping the sections that are open now open*/
  #set_rows(rows: EditorRow[]) {
    //Rows of the list have the data they show and whether they are open
    for (const row of this.querySelectorAll<
      Element & { data: EditorRow; open: boolean }
    >("list-row")) {
      if (!is_section(row.data)) continue;
      if (row.open) this.#open.add(row.data.section);
      else this.#open.delete(row.data.section);
    }
    this.#rows.set_ok(rows);
  }

  /**Symbols of the lookups of the definitions*/
  #lookups: symbol[] = [];

  /**Looks up the definitions of the widgets, as the slots of a viewport do, and shows their properties*/
  #show(widgets: readonly CanvasWidget[]) {
    for (const symbol of this.#lookups) this.detach_state_from_symbol(symbol);
    this.#lookups = [];
    this.#detach_options();
    this.#detach_box();
    this.#set_rows([]);
    if (widgets.length === 0) {
      if (this.#page) return this.#show_page(this.#page);
      this.#title.textContent = "Nothing selected";
      return;
    }
    const several = widgets.length > 1;
    this.#title.textContent = several
      ? `${widgets.length} widgets`
      : widgets[0].widget;
    //The definition of every widget, or why there is none, undefined until looked up
    const found: (WidgetDefinition | string | undefined)[] = widgets.map(
      () => undefined,
    );
    const names: string[] = [];
    const update = () => {
      this.#detach_options();
      this.#detach_box();
      if (found.includes(undefined)) return;
      const error = found.find((definition) => typeof definition === "string");
      if (error !== undefined) {
        this.#title.textContent = error;
        this.#set_rows([]);
        return;
      }
      const one_kind = widgets.every((w) => w.widget === widgets[0].widget);
      this.#title.textContent = !several
        ? names[0]
        : one_kind
          ? `${widgets.length} × ${names[0]}`
          : `${widgets.length} widgets`;
      this.#follow(widgets, common_properties(found as WidgetDefinition[]));
    };
    widgets.forEach((widget, i) => {
      const lookup = Symbol("lookup");
      const definition = Symbol("definition");
      this.#lookups.push(lookup, definition);
      this.attach_state_to_symbol(lookup, depot.get(widget.widget), (node) => {
        this.detach_state_from_symbol(definition);
        if (
          !node.ok ||
          node.value.kind !== "entry" ||
          node.value.type !== WIDGETS
        ) {
          found[i] = `"${widget.widget}" is not a registered widget`;
          return update();
        }
        names[i] = node.value.name;
        this.attach_state_to_symbol(definition, node.value.value, (content) => {
          //The entry is in the widgets type, so its content is a widget definition
          found[i] = content.ok
            ? (content.value as WidgetDefinition)
            : content.error.nice;
          update();
        });
      });
    });
  }

  /**Symbols of the option states followed*/
  #followed: symbol[] = [];
  #detach_options() {
    for (const symbol of this.#followed) this.detach_state_from_symbol(symbol);
    this.#followed = [];
  }

  /**Shows a row per property, made again when an option switches between a value and a link,
   * or for several widgets when their values become the same or different*/
  #follow(
    widgets: readonly CanvasWidget[],
    properties: [string, WidgetProperty][],
  ) {
    const several = widgets.length > 1;
    const all = widgets.map(
      (widget) =>
        widget.options as Record<string, OptionState<unknown> | undefined>,
    );
    const links = new Map<string, (CanvasLink | undefined)[]>();
    const same = new Map<string, boolean>();
    /**Looks at the options of the property now, true when the row has to be made again*/
    const check = (key: string): boolean => {
      const values = all.map((options) => value_now(options[key]));
      const now = values.map((value) =>
        value instanceof CanvasLink ? value : undefined,
      );
      const equal =
        !several ||
        values.every(
          (value) =>
            value !== NONE &&
            !(value instanceof CanvasLink) &&
            value === values[0],
        );
      const before = links.get(key);
      const changed =
        !before ||
        before.some((link, i) => link !== now[i]) ||
        same.get(key) !== equal;
      links.set(key, now);
      same.set(key, equal);
      return changed;
    };
    const rows = () =>
      this.#set_rows(
        editor_rows(
          properties.map(([key, property]) => ({
            widgets,
            key,
            property,
            options: all.map((options) => options[key]),
            links: links.get(key) ?? all.map(() => undefined),
            same: same.get(key) ?? true,
            box: several && BOX.has(key),
          })),
        ),
      );
    let attaching = true;
    for (const [key] of properties) {
      check(key);
      //The box follows the elements of the widgets instead
      if (several && BOX.has(key)) continue;
      for (const options of all) {
        const option = options[key];
        if (!option) continue;
        const symbol = Symbol(key);
        this.#followed.push(symbol);
        this.attach_state_to_symbol(symbol, option, () => {
          if (!attaching && check(key)) rows();
        });
      }
    }
    attaching = false;
    if (several) this.#follow_box(widgets);
    rows();
  }

  //      ____   ______   __
  //     |  _ \ / __ \ \ / /
  //     | |_) | |  | \ V /
  //     |  _ <| |  | |> <
  //     | |_) | |__| / . \
  //     |____/ \____/_/ \_\
  /**The box around the elements of the selected widgets, an error while some of them are not shown*/
  #box = state.from_w<WidgetGeometry>(group_bounds([]));
  #box_widgets: readonly CanvasWidget[] = [];
  #box_elements: WidgetBase[] = [];
  /**The rotation of the box, shared with the viewports given the same selection*/
  #group: GroupRotation | undefined;

  /**Follows the elements of the widgets on a page shown in the document, again when a page makes new elements*/
  #follow_box(widgets: readonly CanvasWidget[]) {
    this.#detach_box();
    this.#box_widgets = widgets;
    this.#group = GroupRotation.of(
      this.input_state(PROPERTIES.selected) ?? this,
    );
    this.#group.select(widgets);
    this.attach_state_to_symbol(GROUP, this.#group.rotation, () =>
      this.#update_box(),
    );
    const elements = widgets.map((widget) => widget_element_of(widget));
    this.#box_elements = elements.every((element) => element)
      ? (elements as WidgetBase[])
      : [];
    for (const element of this.#box_elements)
      element.addEventListener(WIDGET_TRANSFORM_EVENT, this.#update_box);
    document.addEventListener(WIDGET_ELEMENTS_EVENT, this.#refollow_box);
    this.#update_box();
  }

  #detach_box() {
    for (const element of this.#box_elements)
      element.removeEventListener(WIDGET_TRANSFORM_EVENT, this.#update_box);
    this.#box_elements = [];
    document.removeEventListener(WIDGET_ELEMENTS_EVENT, this.#refollow_box);
    this.detach_state_from_symbol(GROUP);
  }

  #refollow_box = () => {
    const widgets = this.#box_widgets;
    if (
      widgets.some(
        (widget, i) => widget_element_of(widget) !== this.#box_elements[i],
      )
    )
      this.#follow_box(widgets);
  };

  #update_box = () => {
    if (this.#box_elements.length)
      this.#box.set_ok(
        group_bounds(
          this.#box_elements.map((element) => element[WIDGET_GEOMETRY]),
          this.#group?.rotation.ok() ?? 0,
        ),
      );
    else
      this.#box.set_err(
        new NiceError(BOX_NOT_SHOWN, "The widgets are not shown in a viewport"),
      );
  };

  /**A part of the box, writing it moves, scales or turns the widgets like the transformer,
   * read only when a widget locks a part the change needs, moving needs x and y, sizing all four, turning x, y and rotation*/
  #box_state(key: string): State<number, any, any> {
    const part = key as keyof WidgetGeometry;
    const read = (box: ResultNice<WidgetGeometry>): ResultNice<number> =>
      box.ok ? ok(box.value[part]) : box;
    const needs: (keyof WidgetGeometry)[] =
      key === "x" || key === "y"
        ? ["x", "y"]
        : key === "rotation"
          ? ["x", "y", "rotation"]
          : ["x", "y", "width", "height"];
    const elements = this.#box_elements;
    const changeable =
      elements.length > 0 &&
      elements.every((element) =>
        needs.every((need) => element[WIDGET_CHANGEABLE](need)),
      );
    if (!changeable) return state.proxy.rea(this.#box, read);
    return state.proxy.reaw(this.#box, read, {
      write: (value: number) => {
        const geometries = elements.map((element) => ({
          ...element[WIDGET_GEOMETRY],
        }));
        const group = this.#group;
        const from = group_bounds(geometries, group?.rotation.ok() ?? 0);
        const to = { ...from, [part]: Number(value) };
        //The box keeps the rotation, set first so the box follows the widgets in it
        if (part === "rotation") group?.set(to.rotation);
        transform_group(geometries, from, to).forEach((geometry, i) => {
          geometry.rotation = wrap_angle(geometry.rotation);
          elements[i][WIDGET_CHANGE](geometry);
        });
        this.#update_box();
        return Promise.resolve(ok(undefined));
      },
    });
  }
}
define_element(PropertiesEditor);

const GROUP = Symbol("group");

/**Kind of the error of the box while the widgets are not shown in a viewport*/
const BOX_NOT_SHOWN = Symbol("Not shown in a viewport");

export type { PropertiesEditor };

/**Creates a properties editor, give it the selection state of the viewports to follow the selection*/
export function canvas_properties(
  options: CanvasPropertiesOptions = {},
): PropertiesEditor {
  return PropertiesEditor.create(options);
}
