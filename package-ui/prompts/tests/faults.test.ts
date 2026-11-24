import { NiceError } from "@chocbite/ts-lib/result";
import { THEME, theme_init, Themes } from "#theme";
import { afterEach, describe, expect, it } from "vitest";
import { prompts } from "..";

theme_init();

/**The prompt open now*/
const current = () => {
  const panels = document.querySelectorAll("composition-panel");
  return panels[panels.length - 1] as HTMLElement & { close(): void };
};
/**The form button with the text in the open prompt*/
const button = (text: string) =>
  [...current().querySelectorAll<HTMLElement>("*")].find((e) => e.tagName === "FORM-BUTTON" && e.textContent === text)!;
/**Opens the stack of the first fault with an Error, with the button of its collapser like the user*/
const open_details = () => current().querySelector<HTMLElement>(".details > span")!.click();
const wait = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

/**Relative luminance of a computed css color, 0 black to 1 white*/
const luminance = (color: string): number => {
  const [r, g, b] = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map((part) => {
    const c = Number(part) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/**Contrast ratio of two computed css colors, 1 for the same to 21 for black on white*/
const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

const OFFLINE = Symbol("Connection failed");
const INVALID = Symbol("Invalid data from server");

afterEach(() => {
  for (const panel of document.querySelectorAll("composition-panel")) (panel as HTMLElement & { close(): void }).close();
});

describe("Prompt faults", () => {
  it("lists the nice text and message of every fault", () => {
    void prompts.faults([new NiceError(OFFLINE, "Failed to fetch"), new NiceError(INVALID, "Expected number")]);

    const titles = [...current().querySelectorAll(".list > .kind > .heading")].map((heading) => heading.textContent);
    expect(titles).toEqual(["Connection failed", "Invalid data from server"]);
    expect(current().textContent).toContain("Failed to fetch");
    expect(current().textContent).toContain("Expected number");
  });

  it("groups the faults by kind, the nice text once with every message of that kind under it", () => {
    const MISSING = Symbol("Value missing");
    void prompts.faults([
      new NiceError(MISSING, "Failed to read missing member speed"),
      new NiceError(OFFLINE, "Failed to fetch"),
      new NiceError(MISSING, "Failed to read missing member unit"),
      new NiceError(MISSING, "Failed to read missing member speed"),
    ]);

    const kinds = [...current().querySelectorAll(".list > .kind")];
    expect(kinds.map((kind) => kind.querySelector(":scope > .heading")!.textContent)).toEqual(["Value missing", "Connection failed"]);
    expect([...kinds[0].querySelectorAll(":scope > .message")].map((message) => message.textContent)).toEqual([
      "Failed to read missing member speed",
      "Failed to read missing member unit",
    ]);
  });

  it("shows the inner errors of an error under it, grouped by kind again", () => {
    const NO_VALUE = Symbol("No value");
    void prompts.faults([
      new NiceError(Symbol("Invalid values"), "Elements without a valid value: speed, unit, mode", [
        new NiceError(OFFLINE, "Failed to fetch"),
        new NiceError(NO_VALUE, "No value yet"),
        new NiceError(NO_VALUE, "No value yet"),
      ]),
    ]);

    const top = current().querySelector(".list > .kind")!;
    expect(top.querySelector(":scope > .heading")!.textContent).toBe("Invalid values");
    const inner = [...top.querySelectorAll(":scope > .sub_errors > .inner > .kind")];
    expect(inner.map((kind) => kind.querySelector(":scope > .heading")!.textContent)).toEqual(["Connection failed", "No value"]);
    expect(inner[1].querySelectorAll(":scope > .message").length).toBe(1);
  });

  it("folds the inner errors under Sub error details, closed until the user opens them", async () => {
    void prompts.faults([
      new NiceError(Symbol("Invalid values"), "Elements without a valid value: speed", [new NiceError(OFFLINE, "Failed to fetch")]),
    ]);
    const sub_errors = current().querySelector<HTMLElement>(".kind > .sub_errors")!;
    const inner = sub_errors.querySelector<HTMLElement>(":scope > .inner")!;

    expect(sub_errors.tagName).toBe("FORM-GROUP-COLLAPSER");
    expect(sub_errors.querySelector(":scope > span")!.textContent).toBe("Sub error details");
    expect(inner.getBoundingClientRect().height).toBe(0);
    sub_errors.querySelector<HTMLElement>(":scope > span")!.click();
    await wait(400);

    expect(inner.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(sub_errors.querySelector(":scope > span")!.textContent).toBe("Hide sub error details");
  });

  it("has no Sub error details for an error without inner errors", () => {
    void prompts.faults([new NiceError(OFFLINE, "Failed to fetch")]);

    expect(current().querySelector(".sub_errors")).toBeNull();
  });

  it("lets the text be selected, to copy it", async () => {
    void prompts.faults([new NiceError(INVALID, new Error("Failed to parse"))]);
    open_details();
    await wait();

    expect(getComputedStyle(current().querySelector(".kind > .message")!).userSelect).toBe("text");
    expect(getComputedStyle(current().querySelector(".stack")!).userSelect).toBe("text");
  });

  it("lists an error once when several inputs have the same error, like an outage", () => {
    const outage = new NiceError(OFFLINE, "Failed to fetch");

    void prompts.faults([outage, outage, new NiceError(OFFLINE, "Failed to fetch")]);

    expect(current().querySelectorAll(".kind").length).toBe(1);
    expect(current().querySelectorAll(".message").length).toBe(1);
  });

  it("formats the stack and its causes only when the details are opened", async () => {
    const created_at = new Error("made here");
    const failure = new Error("Failed to parse", { cause: created_at });
    void prompts.faults([new NiceError(INVALID, failure)]);
    const stack = current().querySelector(".details .stack")!;

    expect(stack.textContent).toBe("");
    open_details();
    await wait();

    const text = stack.textContent;
    expect(text).toContain("Failed to parse");
    expect(text).toContain("Caused by");
    expect(text).toContain("made here");
  });

  it("has no details for a fault without an Error", () => {
    void prompts.faults([new NiceError(OFFLINE, "just a message")]);

    expect(current().querySelector(".details")).toBeNull();
  });

  it("closes with its close button, a form button", async () => {
    const closed = prompts.faults([new NiceError(OFFLINE, "Failed to fetch")]);

    button("Close").click();

    await closed;
    expect(document.querySelector("composition-panel")).toBeNull();
  });

  it("is 60% of the width of the page, at least 20rem but never wider than the page", () => {
    void prompts.faults([new NiceError(OFFLINE, "Failed to fetch")]);

    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const page = window.innerWidth;
    const expected = Math.min(Math.max(page * 0.6, 20 * rem), page * 0.95);
    expect(Math.abs(current().getBoundingClientRect().width - expected)).toBeLessThan(rem);
  });

  it("scrolls its list of faults, so the close button stays in view however long the list is", () => {
    void prompts.faults(Array.from({ length: 50 }, (_, i) => new NiceError(OFFLINE, `fault ${i}`)));

    const list = current().querySelector(".prompts-faults > .list")!;
    expect(getComputedStyle(list).overflowY).toBe("auto");
    expect(list.getBoundingClientRect().height).toBeLessThan(window.innerHeight);
    const close = button("Close").getBoundingClientRect();
    expect(close.bottom).toBeLessThanOrEqual(window.innerHeight);
  });

  it("has readable text in the dark theme, all of it in the colors of the theme", async () => {
    expect((await THEME.write(Themes.Dark)).ok).toBe(true);
    try {
      void prompts.faults([
        new NiceError(INVALID, new Error("Failed to parse"), [new NiceError(OFFLINE, "Failed to fetch")]),
      ]);
      open_details();
      current().querySelector<HTMLElement>(".sub_errors > span")!.click();
      await wait(400);
      const background = getComputedStyle(current().querySelector(":scope > div:nth-child(3)")!).backgroundColor;
      expect(luminance(background)).toBeLessThan(0.2);
      const texts = [...current().querySelectorAll<HTMLElement>(".prompts-faults *")].filter((element) =>
        [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim()),
      );
      expect(texts.length).toBeGreaterThan(0);
      for (const text of texts) expect(contrast(getComputedStyle(text).color, background), text.textContent).toBeGreaterThan(4.5);
    } finally {
      await THEME.write(Themes.Light);
    }
  });
});
