import { describe, expect, it } from "vitest";
import {
  keyboard_create,
  keyboard_open,
  KeyboardSpecialKeys,
  KeyboardType,
  type KeyboardConfig,
  type KeyboardKeyConfig,
  type KeyboardLayerConfig,
  type KeyboardLayers,
} from "../index";

function appendInput(type = "text"): HTMLInputElement {
  const input = document.body.appendChild(document.createElement("input"));
  input.type = type;
  return input;
}

describe("public API", () => {
  it("opens and closes built-in keyboards", () => {
    const input = appendInput();
    const close = keyboard_open(input, KeyboardType.Text);

    expect(document.querySelector("onscreen-keyboard-keyboard-keys")).not.toBeNull();
    close();
    expect(document.querySelector("onscreen-keyboard-keyboard-keys")).toBeNull();
  });

  it("creates custom keyboards that edit the supplied input", () => {
    const input = appendInput();
    const keyboard = keyboard_create({ default: { keys: [[{ text: "x" }]] } });
    const close = keyboard_open(input, keyboard);

    keyboard.execute_key("x");
    close();

    expect(input.value).toBe("x");
  });

  it("uses the color keyboard for color inputs", () => {
    const input = appendInput("color");
    const close = keyboard_open(input, KeyboardType.Color);

    expect(document.querySelector("onscreen-keyboard-keyboard-color")).not.toBeNull();
    close();
  });
});

describe("public types", () => {
  it("exports the types of layouts and the special keys, so apps can name them", () => {
    const pin: KeyboardConfig = {
      default: {
        keys: [[{ text: "⌫", key: KeyboardSpecialKeys.Backspace }, { text: "0" }]],
      },
    };
    const layer: KeyboardLayerConfig = pin.default;
    const key: KeyboardKeyConfig = { text: "1" };
    const layers: KeyboardLayers = { shift: layer };
    expect(KeyboardSpecialKeys.Enter).toBe("enter");
    expect(keyboard_create({ ...pin, layers })).toBeDefined();
    expect(key.text).toBe("1");
  });
});

describe("date and time keyboards", () => {
  const TYPES = [
    [KeyboardType.Date, "date"],
    [KeyboardType.DateTimeLocal, "datetime-local"],
    [KeyboardType.Month, "month"],
    [KeyboardType.Time, "time"],
    [KeyboardType.Week, "week"],
  ] as const;

  it("open only for an input of their own type", () => {
    for (const [type, input_type] of TYPES)
      for (const [, other] of TYPES) {
        const close = keyboard_open(appendInput(other), type);
        expect(
          document.querySelector("onscreen-keyboard-keyboard-datetime") !== null,
          `${type} on ${other}`,
        ).toBe(other === input_type);
        close();
      }
  });

  it("are a keyboard per type", () => {
    const shown = TYPES.map(([type, input_type]) => {
      const close = keyboard_open(appendInput(input_type), type);
      const keyboard = document.querySelector(
        "onscreen-keyboard-keyboard-datetime",
      );
      close();
      return keyboard;
    });
    expect(new Set(shown).size).toBe(TYPES.length);
  });
});
