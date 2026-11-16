import state from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { topbar, topbar_button, topbar_label } from "./topbar";

const attach = <T extends HTMLElement>(element: T): T =>
  document.body.appendChild(element);

const icon = (name: string) => () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.dataset.icon = name;
  return svg;
};

afterEach(() => {
  document.body.replaceChildren();
});

describe("Topbar", () => {
  it("shows the left items left of the mid and right items", () => {
    const left = topbar_label({ text: "left" });
    const mid = topbar_label({ text: "mid" });
    const right = topbar_label({ text: "right" });
    attach(topbar({ left: [left], mid: [mid], right: [right] }));
    const x = (e: Element) => e.getBoundingClientRect().left;
    expect(x(left)).toBeLessThan(x(mid));
    expect(x(mid)).toBeLessThan(x(right));
  });

  it("shows nothing without items", () => {
    const bar = attach(topbar());
    expect(bar.textContent).toBe("");
    expect(bar.children.length).toBe(3);
  });

  it("follows a state of items and releases it when disconnected", () => {
    const a = topbar_label({ text: "a" });
    const b = topbar_label({ text: "b" });
    const items = state.ok_w<Element[]>([a]);
    const bar = attach(topbar({ right: items }));
    expect(bar.textContent).toBe("a");
    items.set_ok([a, b]);
    expect(bar.textContent).toBe("ab");
    bar.remove();
    expect(items.amount()).toBe(0);
  });

  it("set replaces only the sides it is given", () => {
    const items = state.ok_w<Element[]>([topbar_label({ text: "a" })]);
    const bar = attach(
      topbar({ left: items, right: [topbar_label({ text: "r" })] }),
    );
    bar.set({ left: [topbar_label({ text: "b" })] });
    expect(items.amount()).toBe(0);
    expect(bar.textContent).toBe("br");
  });

  it("empties a side whose state gives an error", () => {
    const items = state.from_w<Element[]>([topbar_label({ text: "a" })]);
    const bar = attach(topbar({ mid: items }));
    items.set_err("gone");
    expect(bar.textContent).toBe("");
  });
});

describe("Topbar button", () => {
  it("shows a fixed text and icon, the icon first", () => {
    const button = attach(topbar_button({ text: "Save", icon: icon("save") }));
    expect(button.textContent).toBe("Save");
    expect(button.firstElementChild?.getAttribute("data-icon")).toBe("save");
  });

  it("can be only an icon or only a text", () => {
    expect(attach(topbar_button({ icon: icon("a") })).textContent).toBe("");
    expect(
      attach(topbar_button({ text: "a" })).querySelector("svg"),
    ).toBeNull();
  });

  it("follows states of the text and icon", () => {
    const text = state.ok_w("a");
    const ic = state.ok_w<ReturnType<typeof icon> | undefined>(icon("a"));
    const button = attach(topbar_button({ text, icon: ic }));
    text.set_ok("b");
    ic.set_ok(icon("b"));
    expect(button.textContent).toBe("b");
    expect(button.querySelectorAll("svg").length).toBe(1);
    expect(button.querySelector("svg")?.dataset.icon).toBe("b");
    ic.set_ok(undefined);
    expect(button.querySelector("svg")).toBeNull();
  });

  it("shows text errors and drops the icon on icon errors", () => {
    const text = state.from_w("a");
    const ic = state.from_w<ReturnType<typeof icon> | undefined>(icon("a"));
    const button = attach(topbar_button({ text, icon: ic }));
    text.set_err("no text");
    ic.set_err("no icon");
    expect(button.textContent).toBe("⚠ no text");
    expect(button.querySelector("svg")).toBeNull();
  });

  it("calls the click function it has now", () => {
    const first = vi.fn();
    const second = vi.fn();
    const button = attach(topbar_button({ text: "a", on_click: first }));
    button.click();
    button.set({ on_click: second });
    button.click();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("does nothing on click without a click function", () => {
    expect(() => attach(topbar_button({ text: "a" })).click()).not.toThrow();
  });
});

describe("Topbar label", () => {
  it("shows a fixed text, a state and its errors", () => {
    expect(attach(topbar_label({ text: "a" })).textContent).toBe("a");
    const text = state.from_w("b");
    const label = attach(topbar_label({ text }));
    expect(label.textContent).toBe("b");
    text.set_err("gone");
    expect(label.textContent).toBe("⚠ gone");
  });
});
