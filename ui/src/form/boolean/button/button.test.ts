import { ok } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormColors } from "../../base";
import { form_button } from "./button";

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**Button attached to the document, with helpers to simulate the user*/
const make = (options: Parameters<typeof form_button>[0] = {}) => {
  const change = vi.fn();
  const element = form_button({ change, ...options });
  document.body.appendChild(element);
  //Synthetic pointer events have no active pointer to capture
  element.setPointerCapture = () => {};
  element.releasePointerCapture = () => {};
  const pointer = async (
    type: "pointerdown" | "pointerup" | "pointercancel",
    pointerType: string = "mouse",
  ) => {
    element.dispatchEvent(
      new PointerEvent(type, { button: 0, pointerId: 1, pointerType }),
    );
    await wait();
  };
  const key = async (type: "keydown" | "keyup", key: string) => {
    element.dispatchEvent(
      new KeyboardEvent(type, { key, bubbles: true, cancelable: true }),
    );
    await wait();
  };
  return { element, change, pointer, key };
};

describe("Momentary button", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("is released when the pointer is cancelled", async () => {
    const element = form_button({ text: "Hold" });
    document.body.appendChild(element);
    //Synthetic pointer events have no active pointer to capture
    element.setPointerCapture = () => {};
    element.releasePointerCapture = () => {};
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        button: 0,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(element.buffer).toBe(true);
    element.dispatchEvent(
      new PointerEvent("pointercancel", { pointerId: 1, pointerType: "mouse" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(element.buffer).toBe(false);
  });

  it("is on while the pointer is pressed", async () => {
    const { element, change, pointer } = make();
    await pointer("pointerdown");
    expect(element.buffer).toBe(true);
    expect(element.classList.contains("active")).toBe(true);
    await pointer("pointerup");
    expect(element.buffer).toBe(false);
    expect(element.classList.contains("active")).toBe(false);
    expect(change.mock.calls).toEqual([[true], [false]]);
  });

  it("ignores other buttons than the main one", async () => {
    const { element } = make();
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        button: 2,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
    await wait();
    expect(element.buffer).toBe(undefined);
  });

  it("writes presses to the bound state", async () => {
    const state = st.ok_w(false);
    const { element, pointer } = make();
    element.bind({ value: state });
    await pointer("pointerdown");
    expect(state.ok()).toBe(true);
    await pointer("pointerup");
    expect(state.ok()).toBe(false);
  });

  it("shows the bound state", () => {
    const state = st.ok_w(true);
    const { element } = make();
    element.bind({ value: state });
    expect(element.classList.contains("active")).toBe(true);
    state.set_ok(false);
    expect(element.classList.contains("active")).toBe(false);
  });

  it("is on while Enter or Space is held and calls on_click on release", async () => {
    const on_click = vi.fn();
    const { element, key } = make({ on_click });
    for (const name of ["Enter", " "]) {
      await key("keydown", name);
      expect(element.buffer).toBe(true);
      expect(on_click).not.toHaveBeenCalled();
      await key("keyup", name);
      expect(element.buffer).toBe(false);
      expect(on_click).toHaveBeenCalledTimes(1);
      on_click.mockClear();
    }
  });

  it("ignores other keys", async () => {
    const { element, key } = make();
    await key("keydown", "a");
    expect(element.buffer).toBe(undefined);
  });

  it("is released when Enter is released after another key", async () => {
    const { element, key } = make();
    await key("keydown", "Enter");
    expect(element.buffer).toBe(true);
    await key("keyup", "Shift");
    await key("keyup", "Enter");
    expect(element.buffer).toBe(false);
  });

  it("ignores pointer events from touch, which use touch events", async () => {
    const { element, pointer } = make();
    await pointer("pointerdown", "touch");
    expect(element.buffer).toBe(undefined);
  });

  //Headless desktop Chromium has no touch event handler properties, so the handlers are called directly
  const touch = async (
    element: HTMLElement,
    type: "ontouchstart" | "ontouchend" | "ontouchcancel",
    init: TouchEventInit = {},
  ) => {
    element[type]!.call(element, new TouchEvent(type.slice(2), init));
    await wait();
  };

  it("is on while touched and released when the last touch ends", async () => {
    const { element } = make();
    await touch(element, "ontouchstart");
    expect(element.buffer).toBe(true);
    await touch(element, "ontouchend", { targetTouches: [] });
    expect(element.buffer).toBe(false);
    expect(element.ontouchend).toBeNull();
  });

  it("is released when the touch is cancelled", async () => {
    const { element } = make();
    await touch(element, "ontouchstart");
    await touch(element, "ontouchcancel");
    expect(element.buffer).toBe(false);
  });

  it("toggles when a touch ends", async () => {
    const { element } = make({ toggle: true });
    await touch(element, "ontouchstart");
    expect(element.buffer).toBe(undefined);
    await touch(element, "ontouchend", { targetTouches: [] });
    expect(element.buffer).toBe(true);
  });
});

describe("Toggle button", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("toggles when the pointer is released", async () => {
    const { element, change, pointer } = make({ toggle: true });
    expect(element.toggle).toBe(true);
    await pointer("pointerdown");
    expect(element.buffer).toBe(undefined);
    await pointer("pointerup");
    expect(element.buffer).toBe(true);
    await pointer("pointerdown");
    await pointer("pointerup");
    expect(element.buffer).toBe(false);
    expect(change.mock.calls).toEqual([[true], [false]]);
  });

  it("does not toggle when the pointer is cancelled", async () => {
    const { element, pointer } = make({ toggle: true, value: true });
    await pointer("pointerdown");
    await pointer("pointercancel");
    expect(element.buffer).toBe(true);
  });

  it("toggles on Enter release", async () => {
    const { element, key } = make({ toggle: true });
    await key("keydown", "Enter");
    expect(element.buffer).toBe(undefined);
    await key("keyup", "Enter");
    expect(element.buffer).toBe(true);
  });

  it("toggles the bound state", async () => {
    const state = st.rosw(st.b.help(ok(true)), true);
    const { element, pointer } = make({ toggle: true });
    element.bind({ value: state });
    await pointer("pointerdown");
    await pointer("pointerup");
    expect(state.ok()).toBe(false);
  });
});

describe("Button options", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("calls on_click when clicked", () => {
    const on_click = vi.fn();
    const { element } = make({ on_click });
    element.click();
    expect(on_click).toHaveBeenCalledTimes(1);
    element.on_click = undefined;
    element.click();
    expect(on_click).toHaveBeenCalledTimes(1);
  });

  it("sets text, color and center", () => {
    const { element } = make({
      text: "Go",
      color: FormColors.Green,
      center: true,
    });
    expect(element.text).toBe("Go");
    expect(element.getAttribute("color")).toBe("green");
    expect(element.center).toBe(true);
    element.color = FormColors.None;
    expect(element.hasAttribute("color")).toBe(false);
    element.center = false;
    expect(element.center).toBe(false);
  });

  it("is focusable", () => {
    const { element } = make();
    element.focus();
    expect(document.activeElement).toBe(element);
  });
});
