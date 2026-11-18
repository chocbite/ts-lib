import { Base, define_element, input_key, type InputOptions } from "#base";
import depot, { type DepotNode } from "@chocbite/ts-lib/depot";
import { ok, type ResultNice } from "@chocbite/ts-lib/result";
import type { State, StateOrVal } from "@chocbite/ts-lib/state";
import {
  widget_properties,
  WIDGETS,
  type CanvasWidget,
  type WidgetDefinition,
} from "./data";
import {
  CanvasLink,
  link_node_state,
  option_value_state,
  type OptionState,
} from "./link";
import { property_value, type WidgetProperty } from "./properties";
import { WidgetBase, type WidgetBaseOptions } from "./widget";

/**Inputs of the error widget*/
const ERROR_WIDGET = {
  /**Text explaining why the widget can not be shown*/
  text: input_key<StateOrVal<string>>(),
};
type ErrorWidgetOptions = WidgetBaseOptions & InputOptions<typeof ERROR_WIDGET>;

/**Shown in the place of a widget that can not be made, like one whose definition is not registered*/
class ErrorWidget extends WidgetBase {
  static element_name() {
    return "errorwidget";
  }
  set(options: ErrorWidgetOptions): this {
    super.set(options);
    this.set_input(ERROR_WIDGET.text, options.text, (text) => {
      this.textContent = text.ok ? text.value : text.error.nice;
    });
    return this;
  }
}
define_element(ErrorWidget);

/**Internal to canvas, dispatched bubbling when the widget elements of a page change,
 * by a slot making a new element and by a page adding, removing or moving slots*/
export const WIDGET_ELEMENTS_EVENT = "canvas_widget_elements";

const LOOKUP = Symbol("lookup");
const DEFINITION = Symbol("definition");

const GEOMETRY = new Set(["x", "y", "width", "height", "rotation"]);

/**How an option is given to the widget now*/
interface Resolved {
  /**The link the option holds, undefined while it holds a value*/
  link: CanvasLink | undefined;
  /**The state the widget gets*/
  state: State<unknown, any, any>;
}

/**Holds the element of one widget of a page, internal to canvas
 * It follows the definition of the widget in the depot and makes the element when the definition arrives, or again when it changes,
 * an error is shown in the place of the widget until then
 * It follows every option too, a link is looked up in the depot and the widget is given the linked state, so switching an option
 * between a value and a link, or a linked state being registered, changes only that input of the widget
 * It has display contents, so the widget is placed on the page as if the slot was not there*/
export class WidgetSlot extends Base {
  static element_name() {
    return "slot";
  }
  static element_name_space() {
    return "canvas";
  }

  readonly widget: CanvasWidget;
  /**The definition, or why there is none, undefined until looked up*/
  #definition: WidgetDefinition | string | undefined;
  /**The definition the shown element was made from, undefined while an error is shown*/
  #made: WidgetDefinition | undefined;
  /**The kind of the property of every option, linked values are converted to it, position, size and rotation are numbers*/
  #kinds = new Map<string, WidgetProperty["kind"]>(
    [...GEOMETRY].map((key) => [key, "number"]),
  );
  /**The state the widget gets for every option*/
  #options = new Map<string, Resolved>();

  constructor(widget: CanvasWidget) {
    super();
    this.widget = widget;
    for (const [key, option] of Object.entries(
      widget.options as Record<string, OptionState<unknown> | undefined>,
    ))
      if (option) {
        const lookup = Symbol(key);
        this.attach_state_to_symbol(Symbol(key), option, (value) =>
          this.#option(key, option, lookup, value),
        );
      }
    this.attach_state_to_symbol(LOOKUP, depot.get(widget.widget), (node) =>
      this.#node(node),
    );
  }

  /**The widget element shown now, an error widget when the widget can not be made*/
  get element(): WidgetBase | undefined {
    return (this.firstElementChild as WidgetBase | null) ?? undefined;
  }

  #option(
    key: string,
    option: OptionState<unknown>,
    lookup: symbol,
    value: ResultNice<unknown>,
  ): void {
    const link =
      value.ok && value.value instanceof CanvasLink ? value.value : undefined;
    const current = this.#options.get(key);
    if (current && current.link === link) return;
    this.detach_state_from_symbol(lookup);
    if (!link) return this.#give(key, undefined, option_value_state(option));
    //Until the lookup gives the linked state, the option holds the link, shown as an error
    this.#give(key, link, option_value_state(option));
    //Converted by the kind of the property of the option, looked up at every value, as the definition can arrive later
    const convert = (value: unknown) => {
      const kind = this.#kinds.get(key);
      return kind ? property_value(kind, value) : ok(value);
    };
    this.attach_state_to_symbol(lookup, depot.get(link.path), (node) =>
      this.#give(key, link, link_node_state(link, node, convert)),
    );
  }

  /**Gives the widget the state of an option*/
  #give(
    key: string,
    link: CanvasLink | undefined,
    given: State<unknown, any, any>,
  ): void {
    this.#options.set(key, { link, state: given });
    //The error widget only takes the place
    if (this.#made || GEOMETRY.has(key)) this.element?.set({ [key]: given });
  }

  /**The state of every option, for making the element*/
  #states(): Record<string, State<unknown, any, any>> {
    const states: Record<string, State<unknown, any, any>> = {};
    for (const [key, resolved] of this.#options) states[key] = resolved.state;
    return states;
  }

  #node(node: ResultNice<DepotNode>): void {
    this.detach_state_from_symbol(DEFINITION);
    if (!node.ok) return this.#set_definition(node.error.nice);
    const entry = node.value;
    if (entry.kind !== "entry" || entry.type !== WIDGETS)
      return this.#set_definition(`"${this.widget.widget}" is not a widget`);
    this.attach_state_to_symbol(DEFINITION, entry.value, (definition) =>
      this.#set_definition(
        definition.ok
          ? (definition.value as WidgetDefinition)
          : definition.error.nice,
      ),
    );
  }

  #set_definition(definition: WidgetDefinition | string): void {
    if (definition === this.#definition) return;
    this.#definition = definition;
    if (typeof definition === "string") {
      this.#made = undefined;
      const states = this.#states();
      const geometry: Record<string, unknown> = {};
      for (const key of GEOMETRY) geometry[key] = states[key];
      return this.#show(
        ErrorWidget.create({
          ...(geometry as WidgetBaseOptions),
          text: definition,
        }),
      );
    }
    this.#made = definition;
    for (const [key, property] of widget_properties(definition))
      this.#kinds.set(key, property.kind);
    this.#show(definition.create(this.#states()));
  }

  #show(element: WidgetBase): void {
    this.replaceChildren(element);
    this.dispatchEvent(new Event(WIDGET_ELEMENTS_EVENT, { bubbles: true }));
  }
}
define_element(WidgetSlot);
