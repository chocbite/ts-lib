import {
  Base,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import form from "#form";
import list from "#list";
import depot from "@chocbite/ts-lib/depot";
import { ok } from "@chocbite/ts-lib/result";
import state, { type StateOrVal } from "@chocbite/ts-lib/state";
import {
  widget_properties,
  WIDGETS,
  type CanvasWidget,
  type WidgetDefinition,
} from "./data";
import { LinkField, linked_field, property_field } from "./fields";
import { CanvasLink, option_value_state, type OptionState } from "./link";
import type { WidgetProperty } from "./properties";
import "./properties_editor.scss";

/**Inputs of the properties editor*/
const PROPERTIES = {
  /**The widget whose properties are shown, give the selection state of the viewports to follow the selection
   * The editor only reads it*/
  selected: input_key<StateOrVal<CanvasWidget | undefined>>(),
};
export type CanvasPropertiesOptions = BaseOptions &
  InputOptions<typeof PROPERTIES>;

/**A row of the editor, a property of the shown widget and the value of its option*/
interface PropertyRow {
  key: string;
  property: WidgetProperty;
  /**The state of the option, undefined when the widget has none*/
  option: OptionState<unknown> | undefined;
  /**The link the option holds, undefined while it holds a value*/
  link: CanvasLink | undefined;
}

const LOOKUP = Symbol("lookup");
const DEFINITION = Symbol("definition");

/**Shows the properties of a widget in a list, a row per property with a field bound to the option of the widget,
 * so a change in the editor shows in every viewport showing the widget, and a move in a viewport shows in the editor*/
class PropertiesEditor extends Base {
  static element_name() {
    return "properties";
  }
  static element_name_space() {
    return "canvas";
  }

  #title = this.appendChild(document.createElement("div"));
  #rows = state.ok_w<PropertyRow[]>([]);

  constructor() {
    super();
    this.#title.className = "title";
    this.#title.textContent = "Nothing selected";
    this.appendChild(
      list.container(
        {
          transform: (row) =>
            ok({
              values: { name: row.property.name, value: row, link: row },
            }),
          headless: true,
        },
        {
          columns: {
            name: list.column_string("Property", { align: "left" }),
            value: list.column({
              title: "Value",
              //A node field, as each property has an element of its own kind
              field_gen: () =>
                list.node_field<Element>(form.text({ text: "" })),
              field_apply: (field, row: PropertyRow) => {
                field.node = row.link
                  ? linked_field(row.link, row.property)
                  : property_field(
                      row.property,
                      row.option && option_value_state(row.option),
                    );
              },
            }),
            link: list.column({
              title: "Link",
              field_gen: () => new LinkField(),
              field_apply: (field, row: PropertyRow) =>
                field.show(row.option, row.property, row.link !== undefined),
            }),
          },
          rows: this.#rows,
        },
      ),
    );
  }

  set(options: CanvasPropertiesOptions): this {
    super.set(options);
    this.set_input(PROPERTIES.selected, options.selected, (selected) =>
      this.#show(selected.ok ? selected.value : undefined),
    );
    return this;
  }

  /**Looks up the definition of the widget, as the slots of a viewport do, and shows its properties*/
  #show(widget: CanvasWidget | undefined) {
    this.detach_state_from_symbol(LOOKUP);
    this.detach_state_from_symbol(DEFINITION);
    this.#detach_options();
    this.#rows.set_ok([]);
    if (!widget) {
      this.#title.textContent = "Nothing selected";
      return;
    }
    this.#title.textContent = widget.widget;
    this.attach_state_to_symbol(LOOKUP, depot.get(widget.widget), (node) => {
      this.detach_state_from_symbol(DEFINITION);
      if (
        !node.ok ||
        node.value.kind !== "entry" ||
        node.value.type !== WIDGETS
      ) {
        this.#title.textContent = `"${widget.widget}" is not a registered widget`;
        this.#rows.set_ok([]);
        return;
      }
      const entry = node.value;
      this.#title.textContent = entry.name;
      this.attach_state_to_symbol(DEFINITION, entry.value, (definition) => {
        this.#detach_options();
        if (!definition.ok) {
          this.#title.textContent = definition.error.nice;
          this.#rows.set_ok([]);
          return;
        }
        //The entry is in the widgets type, so its content is a widget definition
        this.#follow(
          widget,
          widget_properties(definition.value as WidgetDefinition),
        );
      });
    });
  }

  /**Symbols of the option states followed*/
  #followed: symbol[] = [];
  #detach_options() {
    for (const symbol of this.#followed) this.detach_state_from_symbol(symbol);
    this.#followed = [];
  }

  /**Shows a row per property, made again when an option switches between a value and a link*/
  #follow(widget: CanvasWidget, properties: [string, WidgetProperty][]) {
    const options = widget.options as Record<
      string,
      OptionState<unknown> | undefined
    >;
    const links = new Map<string, CanvasLink | undefined>();
    const rows = () =>
      this.#rows.set_ok(
        properties.map(([key, property]) => ({
          key,
          property,
          option: options[key],
          link: links.get(key),
        })),
      );
    for (const [key] of properties) {
      const option = options[key];
      if (!option) continue;
      const symbol = Symbol(key);
      this.#followed.push(symbol);
      this.attach_state_to_symbol(symbol, option, (value) => {
        const link =
          value.ok && value.value instanceof CanvasLink
            ? value.value
            : undefined;
        if (links.has(key) && links.get(key) === link) return;
        links.set(key, link);
        rows();
      });
    }
    rows();
  }
}
define_element(PropertiesEditor);

export type { PropertiesEditor };

/**Creates a properties editor, give it the selection state of the viewports to follow the selection*/
export function canvas_properties(
  options: CanvasPropertiesOptions = {},
): PropertiesEditor {
  return PropertiesEditor.create(options);
}
