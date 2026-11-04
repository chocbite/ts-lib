import { describe, expect, it } from "vitest";
import { Keyboard_Keys } from "./keyboard_keys";
import { KeyboardSpecialKeys } from "./types";

function keyboard(): Keyboard_Keys {
  return new Keyboard_Keys({
    default: { keys: [[{ text: "a" }]] },
    layers: { shift: { keys: [[{ text: "A" }]] } },
  });
}

function appendInput(value = ""): HTMLInputElement {
  const input = document.body.appendChild(document.createElement("input"));
  input.value = value;
  return input;
}

describe("Keyboard_Keys", () => {
  it("inserts text, emits input events, and emits one change event on close", () => {
    const input = appendInput();
    const events: string[] = [];
    for (const type of ["keydown", "keypress", "beforeinput", "input", "keyup", "change"])
      input.addEventListener(type, () => events.push(type));
    const instance = keyboard();

    instance.open(input);
    instance.execute_key("a");
    instance.close();

    expect(input.value).toBe("a");
    expect(events).toEqual([
      "keydown",
      "keypress",
      "beforeinput",
      "input",
      "keyup",
      "change",
    ]);
  });

  it("honors cancelled beforeinput events", () => {
    const input = appendInput();
    input.addEventListener("beforeinput", (event) => event.preventDefault());
    const instance = keyboard();

    instance.open(input);
    instance.execute_key("a");
    instance.close();

    expect(input.value).toBe("");
  });

  it("replaces selections, handles backspace, and moves the cursor", () => {
    const input = appendInput("abcd");
    const instance = keyboard();
    instance.open(input);

    input.setSelectionRange(1, 3);
    instance.execute_key("X");
    expect(input.value).toBe("aXd");
    expect(input.selectionStart).toBe(2);

    instance.execute_key(KeyboardSpecialKeys.Backspace);
    expect(input.value).toBe("ad");
    expect(input.selectionStart).toBe(1);

    instance.execute_key(KeyboardSpecialKeys.Right);
    expect(input.selectionStart).toBe(2);
    instance.close();
  });

  it("switches between configured layers", () => {
    const input = appendInput();
    const instance = keyboard();
    instance.open(input);

    instance.execute_key("layer:shift");
    expect(instance.layer.ok()).toBe("shift");
    instance.execute_key("layer:shift");
    expect(instance.layer.ok()).toBe("default");
    instance.close();
  });
});
