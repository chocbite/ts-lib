import { describe, expect, it } from "vitest";
import { input_keyboard_type, keyboard_type } from "./helpers";
import { KeyboardType } from "./types";

function input(type: string): HTMLInputElement {
  const element = document.createElement("input");
  element.type = type;
  return element;
}

describe("input_keyboard_type", () => {
  it("maps supported input types to their keyboard types", () => {
    expect(input_keyboard_type(input("email"))).toBe(KeyboardType.Email);
    expect(input_keyboard_type(input("tel"))).toBe(KeyboardType.Phone);
    expect(input_keyboard_type(input("color"))).toBe(KeyboardType.Color);
    expect(input_keyboard_type(input("date"))).toBe(KeyboardType.Date);
    expect(input_keyboard_type(input("datetime-local"))).toBe(
      KeyboardType.DateTimeLocal,
    );
    expect(input_keyboard_type(input("month"))).toBe(KeyboardType.Month);
    expect(input_keyboard_type(input("time"))).toBe(KeyboardType.Time);
    expect(input_keyboard_type(input("week"))).toBe(KeyboardType.Week);
    expect(input_keyboard_type(input("password"))).toBe(KeyboardType.Text);
  });

  it("selects number layouts from min and step", () => {
    const whole = input("number");
    whole.min = "0";
    whole.step = "1";
    expect(input_keyboard_type(whole)).toBe(KeyboardType.NumberWhole);

    const integer = input("number");
    expect(input_keyboard_type(integer)).toBe(KeyboardType.NumberInteger);

    const positiveRational = input("number");
    positiveRational.min = "0";
    positiveRational.step = "0.1";
    expect(input_keyboard_type(positiveRational)).toBe(
      KeyboardType.NumberRationalPositive,
    );

    const rational = input("number");
    rational.step = "any";
    expect(input_keyboard_type(rational)).toBe(KeyboardType.NumberRational);
  });
});

describe("keyboard_type", () => {
  it("returns text for textareas and contenteditable elements", () => {
    expect(keyboard_type(document.createElement("textarea"))).toBe(
      KeyboardType.Text,
    );

    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect(keyboard_type(editable)).toBe(KeyboardType.Text);
  });

  it("excludes non-editable and manually managed inputs", () => {
    for (const type of ["button", "checkbox", "file", "range", "submit"]) {
      expect(keyboard_type(input(type))).toBeUndefined();
    }

    const disabled = input("text");
    disabled.disabled = true;
    expect(keyboard_type(disabled)).toBeUndefined();

    const readonly = input("text");
    readonly.readOnly = true;
    expect(keyboard_type(readonly)).toBeUndefined();

    const manual = input("text");
    manual.dataset.keyboardManual = "true";
    expect(keyboard_type(manual)).toBeUndefined();
  });
});
