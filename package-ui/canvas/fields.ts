import form from "#form";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import type { WidgetProperty } from "./properties";

/**Form element editing the value of a property, bound to the option of the widget
 * A writable state is written, a fixed value is kept by the element, a read only state is only shown, as form elements do
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
