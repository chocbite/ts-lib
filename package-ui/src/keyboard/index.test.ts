import { describe, expect, it } from "vitest";
import { keyboard_create, keyboard_open, KeyboardType } from "./index";

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
