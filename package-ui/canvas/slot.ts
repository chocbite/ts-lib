import { Base, define_element, input_key, type InputOptions } from "#base";
import depot, { type DepotNode } from "@chocbite/ts-lib/depot";
import type { ResultNice } from "@chocbite/ts-lib/result";
import state, {
  type State,
  type StateOrVal,
  type StateROS,
} from "@chocbite/ts-lib/state";
import { WIDGETS, type CanvasWidget, type WidgetDefinition } from "./data";
import { GEOMETRY_KEYS } from "./geometry";
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

const LOOKUP = Symbol("lookup");
const DEFINITION = Symbol("definition");

const GEOMETRY = new Set<string>(GEOMETRY_KEYS);

/**Holds the element of one widget of a page, internal to canvas
 * It follows the definition of the widget in the depot and makes the element when the definition arrives, or again when it changes,
 * an error is shown in the place of the widget until then
 * The element is given the inputs of the widget, see CanvasWidget.input, which follow links, so switching an option
 * between a value and a link, or a linked state being registered, changes only that input of the element
 * Given another widget, it follows that one instead and makes its element, so a page reuses slots, see PageElement
 * It has display contents, so the widget is placed on the page as if the slot was not there*/
export class WidgetSlot extends Base {
  static element_name() {
    return "slot";
  }
  static element_name_space() {
    return "canvas";
  }

  #widget!: CanvasWidget;
  /**Symbols of the inputs followed for the widget*/
  #followed: symbol[] = [];
  /**The definition, or why there is none, undefined until looked up*/
  #definition: WidgetDefinition | string | undefined;
  /**The definition the shown element was made from, undefined while an error is shown*/
  #made: WidgetDefinition | undefined;
  /**The state the element is given for every option, as far as known*/
  #inputs = new Map<string, State<unknown, any, any>>();
  #element = state.ok_w<WidgetBase | undefined>(undefined);

  constructor(widget: CanvasWidget) {
    super();
    this.#follow(widget);
  }

  /**The widget held*/
  get widget(): CanvasWidget {
    return this.#widget;
  }
  /**Follows another widget, its element is made from its definition and options, the same widget changes nothing*/
  set widget(widget: CanvasWidget) {
    if (widget === this.#widget) return;
    this.#follow(widget);
  }

  /**The widget element shown now, an error widget when the widget can not be made*/
  get element(): WidgetBase | undefined {
    return this.#element.ok();
  }
  /**The widget element shown, changes when the slot makes a new one*/
  get element_state(): StateROS<WidgetBase | undefined> {
    return this.#element.read_only;
  }

  #follow(widget: CanvasWidget): void {
    for (const symbol of this.#followed) this.detach_state_from_symbol(symbol);
    this.#followed = [];
    this.detach_state_from_symbol(LOOKUP);
    this.detach_state_from_symbol(DEFINITION);
    this.#widget = widget;
    this.#definition = undefined;
    this.#made = undefined;
    this.#inputs.clear();
    //The element of the widget before is not shown with the options of this one
    this.#show(undefined);
    for (const key of widget.input_keys()) {
      const input = widget.input(key);
      if (!input) continue;
      const symbol = Symbol(key);
      this.#followed.push(symbol);
      this.attach_state_to_symbol(symbol, input, (given) => {
        if (given.ok) this.#give(key, given.value);
      });
    }
    this.attach_state_to_symbol(LOOKUP, depot.get(widget.widget), (node) =>
      this.#node(node),
    );
  }

  /**Gives the element the state of an option*/
  #give(key: string, given: State<unknown, any, any>): void {
    if (this.#inputs.get(key) === given) return;
    this.#inputs.set(key, given);
    //The error widget only takes the place
    if (this.#made || GEOMETRY.has(key)) this.element?.set({ [key]: given });
  }

  #node(node: ResultNice<DepotNode>): void {
    this.detach_state_from_symbol(DEFINITION);
    if (!node.ok) return this.#set_definition(node.error.nice);
    const entry = node.value;
    if (entry.kind !== "entry" || entry.type !== WIDGETS)
      return this.#set_definition(`"${this.widget.widget}" is not a widget`);
    //The entry is in the widgets type, so its content is a widget definition
    const content = state.as_state(entry.value as StateOrVal<WidgetDefinition>);
    this.attach_state_to_symbol(DEFINITION, content, (definition) =>
      this.#set_definition(
        definition.ok ? definition.value : definition.error.nice,
      ),
    );
  }

  #set_definition(definition: WidgetDefinition | string): void {
    if (definition === this.#definition) return;
    this.#definition = definition;
    if (typeof definition === "string") {
      this.#made = undefined;
      const geometry: Record<string, unknown> = {};
      for (const key of GEOMETRY) geometry[key] = this.#inputs.get(key);
      return this.#show(
        ErrorWidget.create({
          ...(geometry as WidgetBaseOptions),
          text: definition,
        }),
      );
    }
    this.#made = definition;
    this.#show(definition.create(Object.fromEntries(this.#inputs)));
  }

  #show(element: WidgetBase | undefined): void {
    if (element) this.replaceChildren(element);
    else this.replaceChildren();
    this.#element.set_ok(element);
  }
}
define_element(WidgetSlot);
