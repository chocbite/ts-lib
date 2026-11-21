import state from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import { Keyboard_Keys } from "../keyboard_keys";
import {
  KEYBOARD_LAYOUT,
  KEYBOARD_LAYOUTS,
  keyboard_layout,
  keyboard_layout_config,
  keyboard_layout_for,
} from "../languages";
import { KEYBOARD_LANGUAGE } from "../settings";
import { TEXT_KEYBOARD } from "../text";
import { KeyboardConfig, KeyboardSpecialKeys } from "../types";

function appendInput(value = ""): HTMLInputElement {
  const input = document.body.appendChild(document.createElement("input"));
  input.value = value;
  return input;
}

/**The texts of the keys of the shown layer*/
function key_texts(keyboard: HTMLElement): string[] {
  return [...keyboard.querySelectorAll("onscreen-keyboard-key")].map(
    (key) => key.textContent ?? "",
  );
}

afterEach(() => {
  KEYBOARD_LANGUAGE.write("");
  document.body.replaceChildren();
});

describe("Layouts from CLDR", () => {
  it("has the letters of the languages that phone layouts leave out", () => {
    const letters = (id: string) => keyboard_layout(id)!.default.flat();
    expect(letters("da")).toEqual(expect.arrayContaining(["æ", "ø", "å"]));
    expect(letters("nb")).toEqual(expect.arrayContaining(["æ", "ø", "å"]));
    expect(letters("de")).toEqual(expect.arrayContaining(["ü", "ö", "ä", "ß"]));
  });

  it("leaves out the languages that need an input method", () => {
    const languages = KEYBOARD_LAYOUTS.map((l) => l.id.split("-")[0]);
    expect(languages).not.toContain("ja");
    expect(languages).not.toContain("ko");
    expect(languages).not.toContain("zh");
  });

  it("puts every layout in a country", () => {
    expect(KEYBOARD_LAYOUTS.filter((l) => !l.territories.length)).toEqual([]);
    expect(keyboard_layout("da")!.territories).toContain("DK");
    expect(keyboard_layout("de")!.territories).toContain("AT");
    expect(keyboard_layout("de")!.territories).not.toContain("CH");
    expect(keyboard_layout("de-CH")!.territories).toEqual(["CH"]);
  });

  it("decodes the keys and dead keys of a layout", () => {
    const da = keyboard_layout("da")!;
    expect(da.default[1].slice(0, 3)).toEqual(["q", "w", "e"]);
    expect(da.shift![1].slice(0, 3)).toEqual(["Q", "W", "E"]);
    expect(da.altgr![1][2]).toBe("€");
    expect(da.dead_keys!["´e"]).toBe("é");
    expect(keyboard_layout("da")).toBe(da);
    expect(keyboard_layout("en")!.altgr).toBeUndefined();
  });
});

describe("keyboard_layout_for", () => {
  const id = (...languages: string[]) => keyboard_layout_for(languages).id;

  it("takes the layout of the language", () => {
    expect(id("da")).toBe("da");
    expect(id("da-DK")).toBe("da");
    expect(id("de-AT")).toBe("de");
  });

  it("takes the layout made for the region", () => {
    expect(id("de-CH")).toBe("de-CH");
    expect(id("fr-CA")).toBe("fr-CA");
    expect(id("en-GB")).toBe("en-GB");
  });

  it("takes a layout of the region for a language without one there, en-DK is typed on a Danish keyboard", () => {
    expect(id("en-DK")).toBe("da");
  });

  it("goes through the languages in order, and falls back to English (US)", () => {
    expect(id("xx", "sv")).toBe("sv");
    expect(id("xx")).toBe("en");
    expect(id()).toBe("en");
  });
});

describe("KEYBOARD_LANGUAGE", () => {
  it("chooses the layout, empty or unknown follows the browser", async () => {
    const auto = keyboard_layout_for(navigator.languages).id;
    expect(KEYBOARD_LAYOUT.ok().id).toBe(auto);
    KEYBOARD_LANGUAGE.write("de");
    await Promise.resolve();
    expect(KEYBOARD_LAYOUT.ok().id).toBe("de");
    KEYBOARD_LANGUAGE.write("nonsense");
    await Promise.resolve();
    expect(KEYBOARD_LAYOUT.ok().id).toBe(auto);
  });

  it("changes the text keyboard while it is open", async () => {
    KEYBOARD_LANGUAGE.write("en");
    const input = appendInput();
    TEXT_KEYBOARD.open(input);
    expect(key_texts(TEXT_KEYBOARD)).not.toContain("æ");
    KEYBOARD_LANGUAGE.write("da");
    await Promise.resolve();
    expect(key_texts(TEXT_KEYBOARD)).toContain("æ");
    TEXT_KEYBOARD.execute_key("æ");
    expect(input.value).toBe("æ");
    TEXT_KEYBOARD.close();
  });
});

describe("Text keyboard of a layout", () => {
  it("has a number row, three letter rows, and the special keys", () => {
    const keyboard = new Keyboard_Keys(
      keyboard_layout_config(keyboard_layout("da")!),
    );
    keyboard.open(appendInput());
    const texts = key_texts(keyboard);
    for (const text of [
      "½",
      "1",
      "0",
      "q",
      "å",
      "æ",
      "ø",
      "<",
      "-",
      "⌫",
      "Esc",
      "⏎",
      "🌐",
      "⇧",
      "Sym",
      "Space",
    ])
      expect(texts).toContain(text);
    expect(texts).not.toContain("AltGr");
    keyboard.close();
  });

  it("types the AltGr character and the letters of the dead keys by holding a key", () => {
    const da = keyboard_layout_config(keyboard_layout("da")!);
    const hold = (text: string) =>
      da.default.keys
        .flat()
        .find((k) => typeof k === "object" && k.text === text) as {
        hold?: readonly string[];
      };
    expect(hold("2").hold).toEqual(["@"]);
    //The AltGr character first, then the accents in the same order on every layout
    expect(hold("e").hold).toEqual(["€", "é", "è", "ê", "ë"]);
    expect(hold("a").hold!.slice(0, 5)).toEqual(["á", "à", "â", "ä", "ã"]);
    expect(da.layers?.altgr).toBeUndefined();
  });

  it("shows a combining mark on a dotted circle and types the mark alone", () => {
    const hindi = keyboard_layout_config(keyboard_layout("hi")!);
    const keys = hindi.default.keys.flat().filter((k) => typeof k === "object");
    const mark = keys.find((k) => k.text.startsWith("◌"))!;
    expect(mark.key).toBe(mark.text.slice(1));
  });

  it("has two pages of symbols, the same for every layout, typed without dead keys", () => {
    const input = appendInput();
    const keyboard = new Keyboard_Keys(
      keyboard_layout_config(keyboard_layout("de")!),
    );
    keyboard.open(input);
    keyboard.execute_key("layer:sym");
    expect(key_texts(keyboard)).toEqual(
      expect.arrayContaining(["@", "#", "{", "\\", "€", "1/2"]),
    );
    //^ is a dead key of German, the symbols type it at once
    keyboard.execute_key("^");
    expect(input.value).toBe("^");
    expect(keyboard.pending.ok()).toBe("");
    keyboard.execute_key("layer:sym2");
    expect(key_texts(keyboard)).toEqual(
      expect.arrayContaining(["½", "×", "“", "→", "2/2"]),
    );
    keyboard.execute_key("layer:sym2");
    expect(keyboard.layer.ok()).toBe("default");
    keyboard.close();
  });
});

describe("Holding a key", () => {
  const config: KeyboardConfig = {
    default: { keys: [[{ text: "e", hold: ["é", "è"] }, { text: "x" }]] },
  };
  const press = (key: Element, type: string, x = 0) =>
    key.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        button: 0,
        clientX: x,
      }),
    );

  it("shows the first key it types when held in its corner", () => {
    const keyboard = new Keyboard_Keys(config);
    keyboard.open(appendInput());
    const key = keyboard.querySelector("onscreen-keyboard-key")!;
    expect(key.getAttribute("hint")).toBe("é");
    expect(key.textContent).toBe("e");
    keyboard.close();
  });

  it("types the key on a tap, and the chosen key after holding it", async () => {
    const input = appendInput();
    const keyboard = new Keyboard_Keys(config);
    keyboard.open(input);
    const key = keyboard.querySelector<HTMLElement>("onscreen-keyboard-key")!;
    press(key, "pointerdown");
    press(key, "pointerup");
    key.click();
    expect(input.value).toBe("e");

    const rect = key.getBoundingClientRect();
    const hold = async () => {
      press(key, "pointerdown", rect.left + 1);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return keyboard.querySelector("onscreen-keyboard-hold")!;
    };

    //Letting go without sliding types the first, the one in the corner, which is right above the key
    let popup = await hold();
    expect(popup.textContent).toBe("éè");
    expect(popup.children[0].getAttribute("active")).toBe("true");
    const first = popup.children[0].getBoundingClientRect();
    expect(Math.abs(first.left - rect.left)).toBeLessThan(1);
    press(key, "pointermove", rect.left + 4);
    press(key, "pointerup");
    key.click();
    expect(input.value).toBe("eé");
    expect(popup.isConnected).toBe(false);

    popup = await hold();
    const second = popup.children[1].getBoundingClientRect();
    press(key, "pointermove", second.left + 1);
    expect(popup.children[1].getAttribute("active")).toBe("true");
    press(key, "pointerup");
    key.click();
    expect(input.value).toBe("eéè");
    keyboard.close();
  });
});

describe("Dead keys", () => {
  const config: KeyboardConfig = {
    default: { keys: [[{ text: "´" }, { text: "e" }, { text: "x" }]] },
    dead_keys: { "´e": "é", "´ ": "´" },
  };

  it("types what the dead key and the next key make together", () => {
    const input = appendInput();
    const keyboard = new Keyboard_Keys(config);
    keyboard.open(input);
    keyboard.execute_key("´");
    expect(input.value).toBe("");
    expect(keyboard.pending.ok()).toBe("´");
    keyboard.execute_key("e");
    expect(input.value).toBe("é");
    expect(keyboard.pending.ok()).toBe("");
    keyboard.execute_key("´");
    keyboard.execute_key(" ");
    expect(input.value).toBe("é´");
    keyboard.close();
  });

  it("types both keys when they make nothing together", () => {
    const input = appendInput();
    const keyboard = new Keyboard_Keys(config);
    keyboard.open(input);
    keyboard.execute_key("´");
    keyboard.execute_key("x");
    expect(input.value).toBe("´x");
    keyboard.close();
  });

  it("is cancelled by backspace, which deletes nothing", () => {
    const input = appendInput("a");
    const keyboard = new Keyboard_Keys(config);
    keyboard.open(input);
    keyboard.execute_key("´");
    keyboard.execute_key(KeyboardSpecialKeys.Backspace);
    expect(input.value).toBe("a");
    expect(keyboard.pending.ok()).toBe("");
    keyboard.close();
  });

  it("marks the dead key while it waits", () => {
    const keyboard = new Keyboard_Keys(config);
    keyboard.open(appendInput());
    const dead = [...keyboard.querySelectorAll("onscreen-keyboard-key")].find(
      (k) => k.textContent === "´",
    )!;
    expect(dead.hasAttribute("dead")).toBe(true);
    keyboard.execute_key("´");
    expect(dead.getAttribute("active")).toBe("true");
    keyboard.execute_key("e");
    expect(dead.getAttribute("active")).toBe("false");
    keyboard.close();
  });
});

describe("Keyboard from a state", () => {
  it("rebuilds when the state changes, and types keys of more than one character", async () => {
    const config = state.ok_w<KeyboardConfig>({
      default: { keys: [[{ text: "a" }]] },
    });
    const input = appendInput();
    const keyboard = new Keyboard_Keys(config);
    keyboard.open(input);
    expect(key_texts(keyboard)).toEqual(["a"]);
    config.write({ default: { keys: [[{ text: "ij" }]] } });
    await Promise.resolve();
    expect(key_texts(keyboard)).toEqual(["ij"]);
    keyboard.execute_key("ij");
    expect(input.value).toBe("ij");
    keyboard.close();
  });
});

describe("Language list", () => {
  const row_of = (keyboard: HTMLElement, label: string) =>
    [...keyboard.querySelectorAll<HTMLElement>("list-row")].find(
      (r) => (r as HTMLElement & { label: string }).label === label,
    )!;

  it("replaces the keys with the language key, at their height, and choosing a layout writes KEYBOARD_LANGUAGE and brings the keys back", async () => {
    KEYBOARD_LANGUAGE.write("de");
    const input = appendInput();
    input.focus();
    TEXT_KEYBOARD.open(input);
    const height = TEXT_KEYBOARD.getBoundingClientRect().height;
    TEXT_KEYBOARD.execute_key(KeyboardSpecialKeys.Language);
    expect(TEXT_KEYBOARD.querySelector("onscreen-keyboard-layer")).toBeNull();
    expect(TEXT_KEYBOARD.textContent).toContain("Keyboard language");
    expect(document.querySelector("composition-panel")).toBeNull();
    expect(
      Math.abs(TEXT_KEYBOARD.getBoundingClientRect().height - height),
    ).toBeLessThan(1);

    const auto = "Automatic, " + keyboard_layout_for(navigator.languages).name;
    row_of(TEXT_KEYBOARD, auto)
      .querySelector<HTMLElement>("list-keyfield")!
      .click();
    await Promise.resolve();
    expect(KEYBOARD_LANGUAGE.ok()).toBe("");
    expect(TEXT_KEYBOARD.querySelector("list-container")).toBeNull();
    expect(
      TEXT_KEYBOARD.querySelector("onscreen-keyboard-layer"),
    ).not.toBeNull();
    expect(TEXT_KEYBOARD.isConnected).toBe(true);
    expect(document.activeElement).toBe(input);
    TEXT_KEYBOARD.close();
  });

  it("goes back to the keys with the back key, and is gone when the keyboard opens again", () => {
    const input = appendInput();
    TEXT_KEYBOARD.open(input);
    TEXT_KEYBOARD.execute_key(KeyboardSpecialKeys.Language);
    const back = [
      ...TEXT_KEYBOARD.querySelectorAll<HTMLElement>("onscreen-keyboard-key"),
    ].find((k) => k.textContent === "Back")!;
    back.click();
    expect(TEXT_KEYBOARD.querySelector("list-container")).toBeNull();

    TEXT_KEYBOARD.execute_key(KeyboardSpecialKeys.Language);
    TEXT_KEYBOARD.close();
    TEXT_KEYBOARD.open(input);
    expect(TEXT_KEYBOARD.querySelector("list-container")).toBeNull();
    expect(
      TEXT_KEYBOARD.querySelector("onscreen-keyboard-layer"),
    ).not.toBeNull();
    TEXT_KEYBOARD.close();
  });
});
