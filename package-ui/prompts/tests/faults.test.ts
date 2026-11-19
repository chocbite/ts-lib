import { NiceError } from "@chocbite/ts-lib/result";
import { afterEach, describe, expect, it } from "vitest";
import { prompts } from "..";

/**The prompt open now*/
const current = () => {
  const panels = document.querySelectorAll("composition-panel");
  return panels[panels.length - 1] as HTMLElement & { close(): void };
};
/**The form button with the text in the open prompt*/
const button = (text: string) =>
  [...current().querySelectorAll<HTMLElement>("*")].find((e) => e.tagName === "FORM-BUTTON" && e.textContent === text)!;
const wait = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

const OFFLINE = Symbol("Connection failed");
const INVALID = Symbol("Invalid data from server");

afterEach(() => {
  for (const panel of document.querySelectorAll("composition-panel")) (panel as HTMLElement & { close(): void }).close();
});

describe("Prompt faults", () => {
  it("lists the nice text and message of every fault", () => {
    void prompts.faults([new NiceError(OFFLINE, "Failed to fetch"), new NiceError(INVALID, "Expected number")]);

    const titles = [...current().querySelectorAll("section > h3")].map((h3) => h3.textContent);
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

    const sections = [...current().querySelectorAll("section")];
    expect(sections.map((section) => section.querySelector("h3")!.textContent)).toEqual(["Value missing", "Connection failed"]);
    expect([...sections[0].querySelectorAll("p")].map((p) => p.textContent)).toEqual([
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

    const top = current().querySelector(".list > section")!;
    expect(top.querySelector(":scope > h3")!.textContent).toBe("Invalid values");
    const inner = [...top.querySelectorAll(":scope > .inner > section")];
    expect(inner.map((section) => section.querySelector(":scope > h4")!.textContent)).toEqual(["Connection failed", "No value"]);
    expect(inner[1].querySelectorAll(":scope > p").length).toBe(1);
  });

  it("lets the text be selected, to copy it", async () => {
    void prompts.faults([new NiceError(INVALID, new Error("Failed to parse"))]);
    const details = current().querySelector("details")!;
    details.open = true;
    await wait();

    expect(getComputedStyle(current().querySelector("section > p")!).userSelect).toBe("text");
    expect(getComputedStyle(details.querySelector("pre")!).userSelect).toBe("text");
  });

  it("lists an error once when several inputs have the same error, like an outage", () => {
    const outage = new NiceError(OFFLINE, "Failed to fetch");

    void prompts.faults([outage, outage, new NiceError(OFFLINE, "Failed to fetch")]);

    expect(current().querySelectorAll("section").length).toBe(1);
  });

  it("formats the stack and its causes only when the details are opened", async () => {
    const created_at = new Error("made here");
    const failure = new Error("Failed to parse", { cause: created_at });
    void prompts.faults([new NiceError(INVALID, failure)]);
    const details = current().querySelector("details")!;

    expect(details.querySelector("pre")!.textContent).toBe("");
    details.open = true;
    await wait();

    const text = details.querySelector("pre")!.textContent;
    expect(text).toContain("Failed to parse");
    expect(text).toContain("Caused by");
    expect(text).toContain("made here");
  });

  it("has no details for a fault without an Error", () => {
    void prompts.faults([new NiceError(OFFLINE, "just a message")]);

    expect(current().querySelector("details")).toBeNull();
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
});
