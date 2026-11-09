import { describe, expect, it } from "vitest";
import { Keyboard_Keys } from "./keyboard_keys";
import {
  NUMBER_INTEGER_KEYBOARD,
  NUMBER_RATIONAL_KEYBOARD,
  PHONE_KEYBOARD,
} from "./number";
import { EMAIL_KEYBOARD, TEXT_KEYBOARD } from "./text";
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

/**Records the events of the given types on the element*/
function record(element: HTMLElement, ...types: string[]): string[] {
  const events: string[] = [];
  for (const type of types) element.addEventListener(type, () => events.push(type));
  return events;
}

describe("Keyboard_Keys key events", () => {
  it("dispatches key events without modifier keys", () => {
    const input = appendInput();
    const instance = keyboard();
    const seen: KeyboardEvent[] = [];
    input.addEventListener("keydown", (e) => seen.push(e));
    instance.open(input);
    instance.execute_key("a");
    instance.close();
    expect(seen.length).toBe(1);
    expect(seen[0].key).toBe("a");
    expect(seen[0].ctrlKey).toBe(false);
    expect(seen[0].altKey).toBe(false);
    expect(seen[0].metaKey).toBe(false);
    expect(seen[0].shiftKey).toBe(false);
  });

  it("gives letter, space and digit keys their KeyboardEvent codes", () => {
    const input = appendInput();
    const instance = keyboard();
    const codes: string[] = [];
    input.addEventListener("keydown", (e) => codes.push(e.code));
    instance.open(input);
    for (const key of ["a", " ", "1"]) instance.execute_key(key);
    instance.close();
    expect(codes).toEqual(["KeyA", "Space", "Digit1"]);
  });

  it("gives special keys their KeyboardEvent keys", () => {
    const input = appendInput("ab");
    const instance = keyboard();
    const keys: string[] = [];
    input.addEventListener("keydown", (e) => keys.push(e.key));
    instance.open(input);
    for (const key of [
      KeyboardSpecialKeys.Backspace,
      KeyboardSpecialKeys.Enter,
      KeyboardSpecialKeys.Escape,
      KeyboardSpecialKeys.Left,
      KeyboardSpecialKeys.Right,
    ])
      instance.execute_key(key);
    instance.close();
    expect(keys).toEqual(["Backspace", "Enter", "Escape", "ArrowLeft", "ArrowRight"]);
  });

  it("does not edit when keydown is cancelled", () => {
    const input = appendInput();
    input.addEventListener("keydown", (e) => e.preventDefault());
    const events = record(input, "keypress", "beforeinput", "input", "keyup", "change");
    const instance = keyboard();
    instance.open(input);
    instance.execute_key("a");
    instance.execute_key(KeyboardSpecialKeys.Backspace);
    instance.close();
    expect(input.value).toBe("");
    expect(events).toEqual(["keyup", "keyup"]);
  });

  it("keeps the cursor at the start when Left is pressed there", () => {
    const input = appendInput("ab");
    const instance = keyboard();
    instance.open(input);
    input.setSelectionRange(0, 0);
    instance.execute_key(KeyboardSpecialKeys.Left);
    instance.close();
    expect(input.selectionStart).toBe(0);
  });

  it("does nothing for backspace at the start of the input", () => {
    const input = appendInput("ab");
    const events = record(input, "input", "change");
    const instance = keyboard();
    instance.open(input);
    input.setSelectionRange(0, 0);
    instance.execute_key(KeyboardSpecialKeys.Backspace);
    instance.close();
    expect(input.value).toBe("ab");
    expect(events).toEqual([]);
  });

  it("emits no change when closed without edits", () => {
    const input = appendInput("ab");
    const events = record(input, "change");
    const instance = keyboard();
    instance.open(input);
    instance.execute_key(KeyboardSpecialKeys.Left);
    instance.close();
    expect(events).toEqual([]);
  });

  it("emits change once on Enter after edits, without inserting into an input", () => {
    const input = appendInput();
    const events = record(input, "change");
    const instance = keyboard();
    instance.open(input);
    instance.execute_key("a");
    instance.execute_key(KeyboardSpecialKeys.Enter);
    expect(events).toEqual(["change"]);
    instance.execute_key(KeyboardSpecialKeys.Enter);
    instance.close();
    expect(events).toEqual(["change"]);
    expect(input.value).toBe("a");
  });

  it("inserts a line break into a textarea on Enter", () => {
    const textarea = document.body.appendChild(document.createElement("textarea"));
    textarea.value = "ab";
    const events = record(textarea, "input", "change");
    const instance = keyboard();
    instance.open(textarea);
    textarea.setSelectionRange(1, 1);
    instance.execute_key(KeyboardSpecialKeys.Enter);
    instance.close();
    expect(textarea.value).toBe("a\nb");
    expect(events).toEqual(["input", "change"]);
  });

  it("edits contenteditable elements", () => {
    const editable = document.body.appendChild(document.createElement("div"));
    editable.contentEditable = "true";
    editable.textContent = "ab";
    editable.focus();
    const range = document.createRange();
    range.setStart(editable.firstChild!, 2);
    range.collapse(true);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    const events = record(editable, "input", "change");
    const instance = keyboard();
    instance.open(editable);
    instance.execute_key("a");
    expect(editable.textContent).toBe("aba");
    instance.execute_key(KeyboardSpecialKeys.Backspace);
    instance.execute_key(KeyboardSpecialKeys.Backspace);
    expect(editable.textContent).toBe("a");
    instance.close();
    expect(events).toEqual(["input", "input", "input", "change"]);
    editable.remove();
  });

  it("does not throw when a key is pressed while closed", () => {
    const instance = keyboard();
    expect(() => instance.execute_key("a")).not.toThrow();
    expect(instance.isConnected).toBe(false);
  });
});

describe("Keyboard_Keys opening and closing", () => {
  it("closes with the close key and with an empty key, emitting change after edits", () => {
    const input = appendInput();
    const events = record(input, "change");
    const instance = keyboard();
    instance.open(input);
    expect(instance.isConnected).toBe(true);
    instance.execute_key("a");
    instance.execute_key(KeyboardSpecialKeys.Close);
    expect(instance.isConnected).toBe(false);
    expect(events).toEqual(["change"]);
    instance.open(input);
    instance.execute_key("");
    expect(instance.isConnected).toBe(false);
    expect(events).toEqual(["change"]);
  });

  it("closes on a pointerdown outside, but not on the input or the keyboard", () => {
    const input = appendInput();
    const outside = document.body.appendChild(document.createElement("div"));
    const instance = keyboard();
    const pointerdown = (target: Element) =>
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    instance.open(input);
    pointerdown(input);
    expect(instance.isConnected).toBe(true);
    pointerdown(instance.querySelector("onscreen-keyboard-key")!);
    expect(instance.isConnected).toBe(true);
    pointerdown(outside);
    expect(instance.isConnected).toBe(false);
    //Closed keyboards stop listening
    instance.open(input);
    instance.close();
    outside.remove();
  });

  it("emits change for the edited input when opened for another input", () => {
    const first = appendInput();
    const second = appendInput();
    const first_events = record(first, "change");
    const instance = keyboard();
    instance.open(first);
    instance.execute_key("a");
    instance.open(second);
    instance.close();
    expect(first.value).toBe("a");
    expect(first_events).toEqual(["change"]);
  });

  it("closes when focus moves to an element that is not the input, emitting change after edits", () => {
    const input = appendInput();
    const button = document.body.appendChild(document.createElement("button"));
    const events = record(input, "change");
    const instance = keyboard();
    input.focus();
    instance.open(input);
    instance.execute_key("a");
    button.focus();
    expect(instance.isConnected).toBe(false);
    expect(events).toEqual(["change"]);
    button.remove();
  });

  it("stays open when focus moves into the keyboard or within the input", () => {
    const editable = document.body.appendChild(document.createElement("div"));
    editable.contentEditable = "true";
    const inner = editable.appendChild(document.createElement("span"));
    inner.tabIndex = 0;
    const instance = keyboard();
    instance.open(editable);
    const key = instance.querySelector<HTMLElement>("onscreen-keyboard-key")!;
    key.tabIndex = 0;
    key.focus();
    expect(instance.isConnected).toBe(true);
    inner.focus();
    expect(instance.isConnected).toBe(true);
    instance.close();
    editable.remove();
  });

  it("stops listening to the old document when opened for an input in another document", () => {
    const first = appendInput();
    const doc = document.implementation.createHTMLDocument("other");
    const second = doc.body.appendChild(doc.createElement("input"));
    const instance = keyboard();
    instance.open(first);
    instance.open(second);
    expect(instance.ownerDocument).toBe(doc);
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(instance.isConnected).toBe(true);
    instance.close();
  });

  it("opens on the default layer and shows the keys of the active layer", () => {
    const input = appendInput();
    const instance = new Keyboard_Keys({
      default: { keys: [[{ text: "a" }, { text: "⇧", key: "layer:shift" }]] },
      layers: { shift: { keys: [[{ text: "A" }, { text: "⇧", key: "layer:shift" }]] } },
    });
    const key_texts = () =>
      [...instance.querySelectorAll("onscreen-keyboard-key")].map((k) => k.textContent);
    const shift_key = () =>
      [...instance.querySelectorAll("onscreen-keyboard-key")].find((k) => k.textContent === "⇧");
    instance.open(input);
    expect(key_texts()).toEqual(["a", "⇧"]);
    expect(shift_key()?.getAttribute("active")).toBe("false");
    instance.execute_key("layer:shift");
    expect(key_texts()).toEqual(["A", "⇧"]);
    expect(shift_key()?.getAttribute("active")).toBe("true");
    instance.execute_key("A");
    expect(input.value).toBe("A");
    instance.close();
    instance.open(input);
    expect(instance.layer.ok()).toBe("default");
    expect(key_texts()).toEqual(["a", "⇧"]);
    instance.close();
  });

  it("types the key of a clicked on-screen key", () => {
    const input = appendInput();
    const instance = new Keyboard_Keys({
      default: { keys: [[{ text: "Space", key: " " }, { text: "b" }]] },
    });
    instance.open(input);
    const keys = [...instance.querySelectorAll<HTMLElement>("onscreen-keyboard-key")];
    keys[1].click();
    keys[0].click();
    keys[1].click();
    instance.close();
    expect(input.value).toBe("b b");
  });

  it("lays out keys on a grid with spans and gaps", () => {
    const instance = new Keyboard_Keys({
      default: {
        max_width: 20,
        keys: [
          [{ text: "a", cols: 2 }, 1, { text: "b" }],
          [{ text: "c", rows: 2 }],
        ],
      },
    });
    //The layer is shown once the keyboard is open
    instance.open(appendInput());
    const layer = instance.querySelector<HTMLElement>("onscreen-keyboard-layer")!;
    expect(layer.style.maxWidth).toBe("20rem");
    expect(layer.style.gridTemplateColumns).toBe("repeat(4, 1fr)");
    expect(layer.style.gridTemplateRows).toContain("repeat(3,");
    const [a, b, c] = [...layer.querySelectorAll<HTMLElement>("onscreen-keyboard-key")];
    expect([a.style.gridColumnStart, a.style.gridColumnEnd]).toEqual(["1", "3"]);
    expect([b.style.gridColumnStart, b.style.gridColumnEnd]).toEqual(["4", "5"]);
    expect([c.style.gridRowStart, c.style.gridRowEnd]).toEqual(["2", "4"]);
    instance.close();
  });
});

describe("Built-in keyboards on matching inputs", () => {
  it("types into email inputs", () => {
    const input = appendInput();
    input.type = "email";
    EMAIL_KEYBOARD.open(input);
    try {
      EMAIL_KEYBOARD.execute_key("a");
      EMAIL_KEYBOARD.execute_key("@");
      EMAIL_KEYBOARD.execute_key("b");
      expect(input.value).toBe("a@b");
    } finally {
      EMAIL_KEYBOARD.close();
    }
  });

  it("types into number inputs", () => {
    const input = appendInput();
    input.type = "number";
    NUMBER_INTEGER_KEYBOARD.open(input);
    try {
      NUMBER_INTEGER_KEYBOARD.execute_key("1");
      NUMBER_INTEGER_KEYBOARD.execute_key("2");
      expect(input.value).toBe("12");
    } finally {
      NUMBER_INTEGER_KEYBOARD.close();
    }
  });

  it("types partial numbers like - and 1. into number inputs and edits them", () => {
    const input = appendInput();
    input.type = "number";
    const events = record(input, "input", "change");
    NUMBER_RATIONAL_KEYBOARD.open(input);
    try {
      for (const key of ["-", "1", ".", "5"]) NUMBER_RATIONAL_KEYBOARD.execute_key(key);
      expect(input.value).toBe("-1.5");
      NUMBER_RATIONAL_KEYBOARD.execute_key(KeyboardSpecialKeys.Left);
      NUMBER_RATIONAL_KEYBOARD.execute_key(KeyboardSpecialKeys.Backspace);
      expect(input.value).toBe("-15");
      NUMBER_RATIONAL_KEYBOARD.execute_key(KeyboardSpecialKeys.Right);
      NUMBER_RATIONAL_KEYBOARD.execute_key("2");
      expect(input.value).toBe("-152");
    } finally {
      NUMBER_RATIONAL_KEYBOARD.close();
    }
    expect(events).toEqual(["input", "input", "input", "input", "input", "input", "change"]);
  });

  it("emits no change for backspace in an empty number input", () => {
    const input = appendInput();
    input.type = "number";
    const events = record(input, "input", "change");
    NUMBER_RATIONAL_KEYBOARD.open(input);
    NUMBER_RATIONAL_KEYBOARD.execute_key(KeyboardSpecialKeys.Backspace);
    NUMBER_RATIONAL_KEYBOARD.close();
    expect(events).toEqual([]);
  });

  it("types into tel inputs", () => {
    const input = appendInput();
    input.type = "tel";
    PHONE_KEYBOARD.open(input);
    try {
      PHONE_KEYBOARD.execute_key("+");
      PHONE_KEYBOARD.execute_key("4");
      expect(input.value).toBe("+4");
    } finally {
      PHONE_KEYBOARD.close();
    }
  });

  it("types shifted letters into text inputs", () => {
    const input = appendInput();
    TEXT_KEYBOARD.open(input);
    try {
      TEXT_KEYBOARD.execute_key("layer:shift");
      const key = [...TEXT_KEYBOARD.querySelectorAll<HTMLElement>("onscreen-keyboard-key")].find(
        (k) => k.textContent === "Q",
      );
      key?.click();
      expect(input.value).toBe("Q");
    } finally {
      TEXT_KEYBOARD.close();
    }
  });
});
