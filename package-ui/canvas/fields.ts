import { Base, define_element } from "#base";
import form from "#form";
import { ListField } from "#list";
import depot from "@chocbite/ts-lib/depot";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import {
  link_node_state,
  type CanvasLink,
  type OptionConvert,
  type OptionState,
} from "./link";
import { open_link_menu } from "./link_menu";
import { as_text, property_value, type WidgetProperty } from "./properties";
import "./fields.scss";

/**Form element editing the value of a property, bound to the option of the widget
 * A writable state is written, an initial value is kept by the element, a read only state is only shown, as form elements do
 * Kept in a file of its own, to be replaced by real list fields later*/
export function property_field(
  property: WidgetProperty,
  value: unknown,
): HTMLElement {
  const description = property.description;
  switch (property.kind) {
    case "number":
      return form.number_input({
        value: value as StateOrVal<number> | undefined,
        min: property.min,
        max: property.max,
        step: property.step,
        decimals: property.decimals,
        unit: property.unit,
        description,
      });
    case "text":
      return form.text_input({
        value: value as StateOrVal<string> | undefined,
        max_length: property.max_length,
        description,
      });
    case "color":
      return form.color({
        value: value as StateOrVal<string> | undefined,
        description,
      });
    case "boolean":
      return form.switch({
        value: value as StateOrVal<boolean> | undefined,
        description,
      });
    case "enum":
      return form.dropdown({
        value: value as StateOrVal<string> | undefined,
        selections: Object.entries(property.list).map(([key, entry]) => ({
          value: key,
          text: entry.name,
        })),
        description,
      });
  }
}

const LOOKUP = Symbol("lookup");
const VALUE = Symbol("value");

/**Shows the path of a link and the value it gives now, read only, the value is of a state of the app*/
class LinkedValue extends Base {
  static element_name() {
    return "linkedvalue";
  }
  static element_name_space() {
    return "canvas";
  }
  constructor(link: CanvasLink, convert: OptionConvert) {
    super();
    const path = this.appendChild(document.createElement("span"));
    path.className = "path";
    path.textContent = link.path;
    const value = this.appendChild(document.createElement("span"));
    value.className = "value";
    this.attach_state_to_symbol(LOOKUP, depot.get(link.path), (node) =>
      this.attach_state_to_symbol(
        VALUE,
        link_node_state(link, node, convert),
        (result) => {
          value.textContent = result.ok
            ? as_text(result.value)
            : result.error.nice;
          value.classList.toggle("error", !result.ok);
        },
      ),
    );
  }
}
define_element(LinkedValue);

/**Read only field of a linked option, the path and the value the link gives*/
export function linked_field(
  link: CanvasLink,
  property: WidgetProperty,
): HTMLElement {
  return new LinkedValue(link, (value) => property_value(property.kind, value));
}

/**The chain of a row of the properties editor, opens the link menu of the option, empty for an option that can not be written*/
export class LinkField extends ListField {
  static element_name() {
    return "linkfield";
  }
  static element_name_space() {
    return "canvas";
  }
  #target:
    { option: OptionState<unknown>; property: WidgetProperty } | undefined;
  constructor() {
    super();
    this.addEventListener("click", (event) => {
      if (!this.#target) return;
      event.stopPropagation();
      void open_link_menu(this.#target.option, this.#target.property);
    });
  }
  /**Shows the chain for the option, linked or not*/
  show(
    option: OptionState<unknown> | undefined,
    property: WidgetProperty,
    linked: boolean,
  ): void {
    this.#target = option?.writable ? { option, property } : undefined;
    this.classList.toggle("linked", linked);
    this.classList.toggle("none", !this.#target);
  }
}
define_element(LinkField);
