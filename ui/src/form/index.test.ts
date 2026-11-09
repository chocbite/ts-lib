import { theme_init } from "#theme";
import { describe, expect, it } from "vitest";
import form, {
  FormColors,
  FormDateTimeMode,
  FormDateTimeType,
  FormElement,
  FormValue,
  FormValueWrite,
} from ".";

describe("Form module exports", () => {
  it("exports a factory for every form element", () => {
    const factories = [
      form.button,
      form.switch,
      form.lamp,
      form.group,
      form.group_collapser,
      form.color,
      form.date_time,
      form.ip,
      form.password,
      form.progress,
      form.number_input,
      form.slider,
      form.stepper,
      form.dropdown,
      form.toggle_button,
      form.spacer,
      form.text,
      form.text_input,
      form.text_multiline,
      form.list_field,
    ];
    expect(factories.every((factory) => typeof factory === "function")).toBe(
      true,
    );
  });

  it("exports the enums both on the form object and by name", () => {
    expect(form.FormColors).toBe(FormColors);
    expect(form.FormDateTimeMode).toBe(FormDateTimeMode);
    expect(form.FormDateTimeType).toBe(FormDateTimeType);
  });

  it("factories in scope create form value elements", () => {
    const elements = [
      form.text_input(),
      form.text_multiline(),
      form.password(),
      form.color(),
      form.ip({ type: 4 }),
      form.date_time({ mode: FormDateTimeMode.NUMBER }),
      form.dropdown(),
      form.toggle_button(),
    ];
    for (const element of elements) {
      expect(element).toBeInstanceOf(FormValueWrite);
      expect(element).toBeInstanceOf(FormValue);
      expect(element).toBeInstanceOf(FormElement);
    }
  });

  it("elements are defined under the form namespace", () => {
    expect(form.text_input().tagName).toBe("FORM-TEXTINPUT");
    expect(form.text_multiline().tagName).toBe("FORM-TEXTMULTILINE");
    expect(form.password().tagName).toBe("FORM-PASSWORDINPUT");
    expect(form.color().tagName).toBe("FORM-COLORINPUT");
    expect(form.ip({ type: 6 }).tagName).toBe("FORM-IPINPUT");
    expect(form.date_time({ mode: FormDateTimeMode.DATE }).tagName).toBe(
      "FORM-DATETIMEINPUT",
    );
    expect(form.dropdown().tagName).toBe("FORM-DROPDOWN");
    expect(form.toggle_button().tagName).toBe("FORM-TOGGLEBUTTON");
  });
});

describe("Form theme variables", () => {
  it("applies the form theme variables used by the styles", () => {
    theme_init();
    const style = getComputedStyle(document.documentElement);
    const variables = [
      "--form-read-filter",
      "--form-colors-text-label",
      "--form-colors-text-normal",
      "--form-colors-textBlack-normal",
      "--form-colors-icon-normal",
      "--form-colors-background-normal",
      "--form-colors-border-normal",
      "--form-colors-focus-normal",
      "--form-colors-basic-yellow",
      "--form-size-height",
      "--form-size-touchHeight",
      "--form-font-size",
      "--form-font-touch_size",
    ];
    for (const variable of variables)
      expect(style.getPropertyValue(variable), variable).not.toBe("");
    expect(style.getPropertyValue("--form-size-height").trim()).toBe("1.3rem");
    expect(style.getPropertyValue("--form-read-filter").trim()).toBe(
      "opacity(0.6)",
    );
  });

  it("gives the form elements the themed height", () => {
    const element = document.body.appendChild(form.ip({ type: 4 }));
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(element.getBoundingClientRect().height).toBeCloseTo(1.3 * rem, 0);
    element.remove();
  });
});
