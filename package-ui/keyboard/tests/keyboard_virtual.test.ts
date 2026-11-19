import { DOCUMENT_HANDLER } from "#document";
import { afterEach, describe, expect, it } from "vitest";
import { keyboard_open, KeyboardType, VIRTUAL_KEYBOARD } from "./index";
import type { KeyboardBase } from "./base";
import type { Keyboard_Keys } from "./keyboard_keys";

const STORAGE_KEY = "@chocbite/ts-lib-keyboard/virtual_keyboard";

function appendInput(type = "text", doc: Document = document): HTMLInputElement {
  const input = doc.body.appendChild(doc.createElement("input"));
  input.type = type;
  return input;
}

/**The on-screen keyboards currently open in the document*/
function open_keyboards(doc: Document = document): KeyboardBase[] {
  return [...doc.documentElement.children].filter((e) =>
    e.tagName.toLowerCase().startsWith("onscreen-keyboard"),
  ) as KeyboardBase[];
}

const open_tags = (doc: Document = document) =>
  open_keyboards(doc).map((k) => k.tagName.toLowerCase());

describe("Automatic virtual keyboard", () => {
  afterEach(async () => {
    await VIRTUAL_KEYBOARD.write(false);
    (document.activeElement as HTMLElement | null)?.blur();
    open_keyboards().forEach((k) => k.close());
    document.body.replaceChildren();
    document.body.style.transform = "";
    await new Promise((resolve) => setTimeout(resolve, 0));
    localStorage.removeItem(STORAGE_KEY);
  });

  it("is off by default and opens nothing on focus", () => {
    expect(VIRTUAL_KEYBOARD.ok()).toBe(false);
    appendInput().focus();
    expect(open_keyboards()).toEqual([]);
  });

  it("opens the keyboard of the focused input when on, and stores the setting", async () => {
    expect((await VIRTUAL_KEYBOARD.write(true)).ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
    const input = appendInput();
    input.focus();
    expect(open_tags()).toEqual(["onscreen-keyboard-keyboard-keys"]);
  });

  it("opens the color and date keyboards for those inputs", async () => {
    await VIRTUAL_KEYBOARD.write(true);
    appendInput("color").focus();
    expect(open_tags()).toEqual(["onscreen-keyboard-keyboard-color"]);
    open_keyboards().forEach((k) => k.close());
    appendInput("date").focus();
    expect(open_tags()).toEqual(["onscreen-keyboard-keyboard-datetime"]);
  });

  it("opens nothing for inputs without a keyboard", async () => {
    await VIRTUAL_KEYBOARD.write(true);
    appendInput("checkbox").focus();
    const readonly = appendInput();
    readonly.readOnly = true;
    readonly.focus();
    const manual = appendInput();
    manual.dataset.keyboardManual = "true";
    manual.focus();
    document.body.appendChild(document.createElement("button")).focus();
    expect(open_keyboards()).toEqual([]);
  });

  it("closes the open keyboard when focus moves to an input with another keyboard", async () => {
    await VIRTUAL_KEYBOARD.write(true);
    appendInput("text").focus();
    expect(open_tags()).toEqual(["onscreen-keyboard-keyboard-keys"]);
    appendInput("date").focus();
    expect(open_tags()).toEqual(["onscreen-keyboard-keyboard-datetime"]);
  });

  it("emits change for the edited input when focus moves to an input with another keyboard", async () => {
    await VIRTUAL_KEYBOARD.write(true);
    const text = appendInput("text");
    const events: string[] = [];
    text.addEventListener("change", () => events.push("change"));
    text.focus();
    const keys = open_keyboards()[0] as Keyboard_Keys;
    keys.execute_key("a");
    appendInput("date").focus();
    expect(text.value).toBe("a");
    expect(events).toEqual(["change"]);
  });

  it("stops opening keyboards when turned off", async () => {
    await VIRTUAL_KEYBOARD.write(true);
    await VIRTUAL_KEYBOARD.write(false);
    appendInput().focus();
    expect(open_keyboards()).toEqual([]);
  });

  it("opens keyboards in documents registered later", async () => {
    await VIRTUAL_KEYBOARD.write(true);
    const doc = document.implementation.createHTMLDocument("other");
    DOCUMENT_HANDLER.register_document(doc);
    try {
      const input = appendInput("text", doc);
      input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      expect(open_tags(doc)).toEqual(["onscreen-keyboard-keyboard-keys"]);
      open_keyboards(doc).forEach((k) => k.close());
    } finally {
      DOCUMENT_HANDLER.deregister_document(doc);
    }
  });
});

describe("keyboard_open", () => {
  it("returns a function that does nothing for unknown keyboard types", () => {
    const input = appendInput();
    const close = keyboard_open(input, "unknown" as KeyboardType);
    expect(open_keyboards()).toEqual([]);
    expect(() => close()).not.toThrow();
    input.remove();
  });

  it("opens a keyboard made from a configuration", () => {
    const input = appendInput();
    const close = keyboard_open(input, { default: { keys: [[{ text: "z" }]] } });
    const keyboards = open_keyboards();
    expect(keyboards.length).toBe(1);
    keyboards[0].querySelector<HTMLElement>("onscreen-keyboard-key")?.click();
    close();
    expect(open_keyboards()).toEqual([]);
    expect(input.value).toBe("z");
    input.remove();
  });
});
