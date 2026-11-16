import form from "#form";
import { none, some } from "@chocbite/ts-lib/result";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prompts } from ".";

/**The prompt open now*/
const current = () => {
  const panels = document.querySelectorAll("composition-panel");
  return panels[panels.length - 1] as HTMLElement & { close(): void };
};
/**The form button with the text in the open prompt*/
const button = (text: string) =>
  [...current().querySelectorAll<HTMLElement>("*")].find(
    (e) => "on_click" in e && e.textContent === text,
  )!;
const key = (target: Element, key: string) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

afterEach(() => {
  for (const panel of document.querySelectorAll("composition-panel"))
    (panel as HTMLElement & { close(): void }).close();
});

describe("Prompt buttons", () => {
  it("resolves with the value of the clicked button, then calls its click", async () => {
    const click = vi.fn();
    const result = prompts.buttons("Save?", [
      { text: "Yes", value: 1, click },
      { text: "No", value: 2 },
    ]);
    expect(current().textContent).toContain("Save?");
    button("Yes").click();
    expect(await result).toEqual(some(1));
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector("composition-panel")).toBeNull();
  });

  it("resolves with none when closed with Escape or by the panel", async () => {
    const escaped = prompts.buttons("A", [{ text: "Yes", value: 1 }]);
    key(document.activeElement!, "Escape");
    expect(await escaped).toEqual(none());
    const closed = prompts.buttons("B", [{ text: "Yes", value: 1 }]);
    current().close();
    expect(await closed).toEqual(none());
  });

  it("is a modal panel with a close button, focused when it opens", () => {
    void prompts.buttons("A", [{ text: "Yes", value: 1 }]);
    expect(current().classList.contains("modal")).toBe(true);
    expect(current().querySelector(".close-button")).not.toBeNull();
    expect(current().contains(document.activeElement)).toBe(true);
  });
});

describe("Prompt form", () => {
  it("resolves with the changed values on submit", async () => {
    const swit = form.switch({ id: "on" });
    const result = prompts.form("Settings", [swit], { text: "OK" });
    swit.click();
    await new Promise((r) => setTimeout(r, 0));
    button("OK").click();
    expect(await result).toEqual(some({ on: true }));
  });

  it("submits with the last button when Enter is pressed", async () => {
    const last = vi.fn(() => {});
    const result = prompts.form(
      "Settings",
      [form.switch({ id: "on" })],
      [{ text: "First" }, { text: "Last", click: last }],
    );
    key(
      current().querySelector("prompts-prompt") ?? document.activeElement!,
      "Enter",
    );
    expect(await result).toEqual(some({}));
    expect(last).toHaveBeenCalledTimes(1);
  });

  it("stays open when the click of the button returns true, until it closes itself", async () => {
    let close_with: ((v: ReturnType<typeof none>) => void) | undefined;
    const result = prompts.form("Settings", [form.switch({ id: "on" })], {
      text: "OK",
      click: (_group, close) => {
        close_with = close;
        return true;
      },
    });
    button("OK").click();
    expect(current()).not.toBeNull();
    close_with!(none());
    expect(await result).toEqual(none());
  });

  it("submits with Enter while a switch has the focus, without toggling it", async () => {
    const result = prompts.form("Settings", [form.switch({ id: "on" })], {
      text: "OK",
    });
    key(document.activeElement!, "Enter");
    expect(await result).toEqual(some({}));
  });

  it("closes with Escape while a number input has the focus", async () => {
    const result = prompts.form(
      "Settings",
      [form.number_input({ id: "count", value: 3 })],
      { text: "OK" },
    );
    key(document.activeElement!, "Escape");
    expect(await result).toEqual(none());
  });

  it("closes with Escape while a text input has the focus", async () => {
    const result = prompts.form("Settings", [form.text_input({ id: "name" })], {
      text: "OK",
    });
    key(document.activeElement!, "Escape");
    expect(await result).toEqual(none());
  });

  it("focuses the first element the user can change when it opens, after labels", () => {
    const input = form.text_input({ id: "name" });
    void prompts.form("Settings", [form.text({ text: "Name" }), input], {
      text: "OK",
    });
    expect(input.contains(document.activeElement)).toBe(true);
  });
});
