import form from "#form";
import state from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import {
  attach_customization_panel_to_element,
  customization,
  customization_panel,
  type CustomizationPanel,
} from "./customization";
import { CompAnchor } from "./shared";

const opened: CustomizationPanel[] = [];
const open = (...args: Parameters<typeof customization_panel>) => {
  const c = customization_panel(...args);
  opened.push(c);
  return c;
};

afterEach(() => {
  for (const c of opened.splice(0)) if (c.panel.isConnected) c.panel.close();
  document.body.replaceChildren();
});

describe("Customization", () => {
  it("has the settings of the library and a title", () => {
    const c = document.body.appendChild(customization());
    expect(c.textContent).toContain("UI Scale");
    expect(c.content_title).toBe("Customization");
    expect(customization({ title: "Settings" }).content_title).toBe("Settings");
  });

  it("shows the settings of the app, and set replaces them", () => {
    const first = form.text({ text: "First" });
    const c = document.body.appendChild(customization({ main: [first] }));
    expect(c.contains(first)).toBe(true);
    const second = form.text({ text: "Second" });
    c.set({ main: [second] });
    expect(c.contains(first)).toBe(false);
    expect(c.contains(second)).toBe(true);
  });

  it("follows a state of settings, an error shows none", () => {
    const a = form.text({ text: "A" });
    const b = form.text({ text: "B" });
    const advanced = state.from_w<readonly ReturnType<typeof form.text>[]>([a]);
    const c = document.body.appendChild(customization({ advanced }));
    expect(c.contains(a)).toBe(true);
    advanced.set_ok([a, b]);
    expect(c.contains(b)).toBe(true);
    advanced.set_err("none");
    expect(c.contains(a)).toBe(false);
    expect(c.contains(b)).toBe(false);
  });

  it("set can not replace the title", () => {
    const c = customization();
    // @ts-expect-error the title is followed by the panel, so it is given at creation
    c.set({ title: "Other" });
    expect(c.content_title).toBe("Customization");
  });
});

describe("Customization panel", () => {
  it("starts hidden and modal, and hides again when the user presses outside", () => {
    const c = open();
    expect(c.panel.content).toBe(c.content);
    expect(c.panel.classList.contains("hidden")).toBe(true);
    expect(c.panel.classList.contains("modal")).toBe(true);
    void c.hidden.write(false);
    expect(c.panel.classList.contains("hidden")).toBe(false);
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    expect(c.hidden.ok()).toBe(true);
  });

  it("shows at the element when it is clicked", () => {
    const button = document.body.appendChild(document.createElement("button"));
    Object.assign(button.style, {
      position: "fixed",
      left: "160px",
      top: "80px",
      width: "32px",
      height: "32px",
    });
    const c = attach_customization_panel_to_element(
      button,
      CompAnchor.BOT_LEFT,
      CompAnchor.TOP_LEFT,
      open({}, button),
    );
    button.click();
    expect(c.hidden.ok()).toBe(false);
    expect(parseFloat(c.panel.style.left)).toBe(10);
    expect(parseFloat(c.panel.style.top)).toBe(7);
  });
});
