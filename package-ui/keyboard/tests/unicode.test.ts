import { afterEach, describe, expect, it } from "vitest";
import { Keyboard_Keys } from "../keyboard_keys";
import { keyboard_layout, keyboard_layout_config } from "../languages";
import { unicode_block_characters, UNICODE_FIRST_BLOCK } from "../unicode";
import { UNICODE_BLOCKS } from "../unicode_blocks";
import { UNICODE_EMOJI } from "../unicode_emoji";
import { KeyboardSpecialKeys } from "../types";

function appendInput(): HTMLInputElement {
  return document.body.appendChild(document.createElement("input"));
}

const keys = (keyboard: HTMLElement) =>
  [
    ...keyboard.querySelectorAll<HTMLElement>(
      ".keyboard-unicode-grid onscreen-keyboard-key",
    ),
  ].map((k) => k.textContent ?? "");

afterEach(() => document.body.replaceChildren());

describe("Unicode blocks", () => {
  it("leaves out the blocks that are not typed alone or too big to page through", () => {
    const names = UNICODE_BLOCKS.map(([name]) => name);
    expect(names).toContain("Arrows");
    expect(names).toContain("Latin-1 Supplement");
    expect(names).not.toContain("Private Use Area");
    expect(names).not.toContain("High Surrogates");
    expect(names).not.toContain("CJK Unified Ideographs");
    expect(names).not.toContain("Hangul Syllables");
  });

  it("puts symbols and scripts in their groups", () => {
    const script = (name: string) =>
      UNICODE_BLOCKS.find(([n]) => n === name)![3];
    expect(script("Arrows")).toBe(0);
    expect(script("Mathematical Operators")).toBe(0);
    expect(script("Emoticons")).toBe(0);
    expect(script("Greek and Coptic")).toBe(1);
    expect(script("Tamil Supplement")).toBe(1);
  });

  it("has the characters of a block without control characters", () => {
    const block = { name: "Latin-1 Supplement", start: 0x80, end: 0xff };
    const latin1 = unicode_block_characters(block);
    //0x80 to 0x9F are control characters, and the soft hyphen 0xAD a format character
    expect(latin1).toHaveLength(95);
    expect(latin1).not.toContain("\u00ad");
    expect(latin1[0]).toBe(" ");
    expect(latin1).toContain("¿");
    expect(unicode_block_characters(block)).toBe(latin1);
  });
});

describe("Emoji", () => {
  const all = UNICODE_EMOJI.flatMap(([, subgroups]) =>
    subgroups.flatMap(([, emoji]) => emoji.split(" ")),
  );

  it("are in the groups of Unicode, without the components", () => {
    expect(UNICODE_EMOJI.map(([group]) => group)).toEqual([
      "Smileys & Emotion",
      "People & Body",
      "Animals & Nature",
      "Food & Drink",
      "Travel & Places",
      "Activities",
      "Objects",
      "Symbols",
      "Flags",
    ]);
    const smileys = UNICODE_EMOJI[0][1];
    expect(smileys[0][0]).toBe("face-smiling");
    expect(smileys[0][1].split(" ")[0]).toBe("😀");
  });

  it("have the emoji of several code points, but not the skin tone variants", () => {
    expect(all).toContain("🇩🇰");
    expect(all).toContain("👨‍👩‍👧");
    expect(all).toContain("1️⃣");
    expect(all).toContain("👋");
    expect(all.some((e) => /[\u{1F3FB}-\u{1F3FF}]/u.test(e))).toBe(false);
  });
});

describe("Unicode view", () => {
  it("opens from the Ω key in place of the keys on Smileys & Emotion, and types characters as they are, without dead keys", async () => {
    const input = appendInput();
    const keyboard = new Keyboard_Keys(
      keyboard_layout_config(keyboard_layout("da")!),
    );
    keyboard.open(input);
    const unicode = [
      ...keyboard.querySelectorAll<HTMLElement>("onscreen-keyboard-key"),
    ].find((k) => k.textContent === "Ω")!;
    unicode.click();
    expect(keyboard.querySelector("onscreen-keyboard-layer")).toBeNull();
    const header = () =>
      keyboard.querySelector(".keyboard-view-header")!.textContent;
    expect(header()).toContain("Smileys & Emotion");
    expect(keys(keyboard)[0]).toBe("😀");
    expect(UNICODE_FIRST_BLOCK.name).toBe("Smileys & Emotion");

    const row = (label: string) =>
      [...keyboard.querySelectorAll<HTMLElement>("list-row")].find(
        (r) => (r as HTMLElement & { label: string }).label === label,
      )! as HTMLElement & { open: boolean };
    row("Scripts").open = true;
    await Promise.resolve();
    row("Latin-1 Supplement")
      .querySelector<HTMLElement>("list-keyfield")!
      .click();
    await Promise.resolve();
    expect(header()).toContain("Latin-1 Supplement");
    //A space other than the plain one is shown as ␣
    expect(keys(keyboard)[0]).toBe("␣");
    expect(keys(keyboard)).toContain("¡");

    //´ is a dead key of Danish, from the characters it is typed at once
    const acute = [
      ...keyboard.querySelectorAll<HTMLElement>(
        ".keyboard-unicode-grid onscreen-keyboard-key",
      ),
    ].find((k) => k.textContent === "´")!;
    acute.click();
    expect(input.value).toBe("´");
    expect(keyboard.pending.ok()).toBe("");
    //The view stays open to type more
    expect(keyboard.querySelector(".keyboard-unicode")).not.toBeNull();

    keyboard.execute_key(KeyboardSpecialKeys.Unicode);
    expect(keyboard.querySelector(".keyboard-unicode")).toBeNull();
    expect(keyboard.querySelector("onscreen-keyboard-layer")).not.toBeNull();
    keyboard.close();
  });

  it("pages through a block that does not fit", () => {
    const keyboard = new Keyboard_Keys(
      keyboard_layout_config(keyboard_layout("da")!),
    );
    keyboard.open(appendInput());
    keyboard.execute_key(KeyboardSpecialKeys.Unicode);
    const header = keyboard.querySelector(".keyboard-view-header")!;
    const [previous, next] = header.querySelectorAll<HTMLElement>(
      ".keyboard-unicode-turn",
    );
    const page = header.querySelector(".keyboard-unicode-page")!;
    const pages = Number(page.textContent.split("/")[1]);
    const first = keys(keyboard);
    expect(previous.hasAttribute("disabled")).toBe(true);
    if (pages > 1) {
      next.click();
      expect(page.textContent).toBe(`2 / ${pages}`);
      expect(keys(keyboard)[0]).toBe(
        unicode_block_characters(UNICODE_FIRST_BLOCK)[first.length],
      );
    }
    expect(pages * first.length).toBeGreaterThanOrEqual(
      unicode_block_characters(UNICODE_FIRST_BLOCK).length,
    );
    keyboard.close();
  });

  it("switches between the languages and the characters, and is gone when the keyboard opens again", () => {
    const input = appendInput();
    const keyboard = new Keyboard_Keys(
      keyboard_layout_config(keyboard_layout("da")!),
    );
    keyboard.open(input);
    keyboard.execute_key(KeyboardSpecialKeys.Unicode);
    keyboard.execute_key(KeyboardSpecialKeys.Language);
    expect(keyboard.querySelector(".keyboard-unicode")).toBeNull();
    expect(keyboard.textContent).toContain("Keyboard language");
    keyboard.execute_key(KeyboardSpecialKeys.Unicode);
    keyboard.close();
    keyboard.open(input);
    expect(keyboard.querySelector(".keyboard-view")).toBeNull();
    keyboard.close();
  });

  it("has the emoji by group and subgroup, and types an emoji of several code points", async () => {
    const input = appendInput();
    const keyboard = new Keyboard_Keys(
      keyboard_layout_config(keyboard_layout("da")!),
    );
    keyboard.open(input);
    keyboard.execute_key(KeyboardSpecialKeys.Unicode);
    const row = (label: string) =>
      [...keyboard.querySelectorAll<HTMLElement>("list-row")].find(
        (r) => (r as HTMLElement & { label: string }).label === label,
      )!;
    const click = async (label: string) => {
      row(label).querySelector<HTMLElement>("list-keyfield")!.click();
      await Promise.resolve();
    };
    //Emoji first, Symbols and Scripts after, Emoji is open as it holds Smileys & Emotion, whose group Symbols comes first
    const roots = [...keyboard.querySelectorAll<HTMLElement>("list-row")]
      .map((r) => (r as HTMLElement & { label: string }).label)
      .filter((label) => ["Emoji", "Symbols", "Scripts"].includes(label));
    expect([...new Set(roots)]).toEqual(["Emoji", "Symbols", "Scripts"]);

    //A group shows the emoji of all its subgroups
    const page = () =>
      Number(
        keyboard
          .querySelector(".keyboard-unicode-page")!
          .textContent.split("/")[1],
      );
    await click("Flags");
    expect(
      keyboard.querySelector(".keyboard-view-header")!.textContent,
    ).toContain("Flags");
    const all_flags = page();
    (row("Flags") as HTMLElement & { open: boolean }).open = true;
    await click("Country flag");
    expect(page()).toBeLessThanOrEqual(all_flags);
    expect(
      keyboard.querySelector(".keyboard-view-header")!.textContent,
    ).toContain("Country flag");
    const flag = [
      ...keyboard.querySelectorAll<HTMLElement>(
        ".keyboard-unicode-grid onscreen-keyboard-key",
      ),
    ][0];
    flag.click();
    expect(input.value).toBe("🇦🇨");
    keyboard.close();
  });
});
