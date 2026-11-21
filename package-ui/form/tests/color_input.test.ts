import st from "@chocbite/ts-lib/state";
import { theme_init } from "#theme";
import { afterEach, describe, expect, it, vi } from "vitest";
import { form_color } from "../special/color/color_input";

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const make = (options: Parameters<typeof form_color>[0] = {}) => {
  const change = vi.fn();
  const element = form_color({ change, ...options });
  document.body.appendChild(element);
  const input = element.querySelector("input")!;
  const pick = async (color: string, event: "input" | "change") => {
    input.value = color;
    input.dispatchEvent(new Event(event));
    await wait();
  };
  return { element, input, change, pick };
};

describe("Color input", () => {
  afterEach(() => document.body.replaceChildren());

  it("uses a color input and is not live by default", async () => {
    const { input, change, pick } = make();
    expect(input.type).toBe("color");
    await pick("#00ff00", "input");
    expect(change).not.toHaveBeenCalled();
  });

  it("shows the initial value", () => {
    const { input, element } = make({ value: "#112233" });
    expect(input.value).toBe("#112233");
    expect(element.get_value.unwrap()).toBe("#112233");
  });

  it("commits on change but not on input when not live", async () => {
    const { element, change, pick } = make();
    await pick("#ff0000", "input");
    expect(change).not.toHaveBeenCalled();
    expect(element.buffer).toBeUndefined();
    await pick("#ff0000", "change");
    expect(change).toHaveBeenCalledWith("#ff0000");
    expect(element.buffer).toBe("#ff0000");
    expect(element.changed).toBe(true);
  });

  it("commits on input but not on change when live", async () => {
    const { change, pick } = make({ live: true });
    await pick("#00ff00", "input");
    expect(change).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledWith("#00ff00");
    await pick("#0000ff", "change");
    expect(change).toHaveBeenCalledOnce();
  });

  it("live can be changed after creation", async () => {
    const { element, change, pick } = make();
    element.set({ live: true });
    await pick("#00ff00", "input");
    expect(change).toHaveBeenCalledWith("#00ff00");
  });

  it("clear resets to black", async () => {
    const { element, input, pick } = make();
    await pick("#ff0000", "change");
    element.clear();
    expect(input.value).toBe("#000000");
    expect(element.buffer).toBeUndefined();
  });

  it("follows and writes a bound state", async () => {
    const state = st.ok_w("#123456");
    const { element, input, change, pick } = make();
    element.set({ value: state });
    expect(input.value).toBe("#123456");
    await pick("#abcdef", "change");
    expect(state.ok()).toBe("#abcdef");
    expect(change).toHaveBeenCalledWith("#abcdef");
    state.set_ok("#000001");
    await wait();
    expect(input.value).toBe("#000001");
  });
});

//Sizes of the elements come from theme variables
theme_init();

const tick = () => new Promise((resolve) => setTimeout(resolve));
const show = <E extends HTMLElement>(element: E) =>
  document.body.appendChild(element);
/**The color the swatch shows, over the checkerboard*/
const shown = (element: HTMLElement) =>
  getComputedStyle(element.querySelector(":scope > .swatch > div")!)
    .backgroundColor;
const slider = (element: HTMLElement) =>
  element.querySelector<HTMLInputElement>(":scope > input.alpha");
const native = (element: HTMLElement) =>
  element.querySelector<HTMLInputElement>('input[type="color"]')!;
/**Picks a color in the native picker*/
const pick = async (element: HTMLElement, color: string) => {
  native(element).value = color;
  native(element).dispatchEvent(new Event("change"));
  await tick();
};

describe("Color input with alpha", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows the color with its alpha over a checkerboard, and an alpha slider", () => {
    const element = show(form_color({ value: "#ff000080", alpha: true }));
    expect(shown(element)).toMatch(/^rgba\(255, 0, 0, 0\.5\d*\)$/);
    expect(
      getComputedStyle(element.querySelector(":scope > .swatch")!)
        .backgroundImage,
    ).toContain("gradient");
    expect(slider(element)!.value).toBe("50");
  });

  it("takes transparent as no alpha", () => {
    const element = show(form_color({ value: "transparent", alpha: true }));
    expect(shown(element)).toBe("rgba(0, 0, 0, 0)");
    expect(slider(element)!.value).toBe("0");
  });

  it("writes the alpha of the slider, a color picked keeps it", async () => {
    const value = st.ok_w("#ff0000");
    const element = show(form_color({ value, alpha: true }));
    const alpha = slider(element)!;
    alpha.value = "25";
    alpha.dispatchEvent(new Event("input"));
    alpha.dispatchEvent(new Event("change"));
    await tick();
    expect(value.ok()).toBe("#ff000040");
    await pick(element, "#00ff00");
    expect(value.ok()).toBe("#00ff0040");
  });

  it("without alpha shows the alpha of a value, but writes only the color, without a slider", async () => {
    const value = st.ok_w("#ff000080");
    const element = show(form_color({ value }));
    expect(slider(element)).toBeNull();
    expect(shown(element)).toMatch(/^rgba\(255, 0, 0, 0\.5\d*\)$/);
    await pick(element, "#00ff00");
    expect(value.ok()).toBe("#00ff00");
  });

  it("gives the native input the alpha for the on-screen keyboard, and takes it back from it", async () => {
    const value = st.ok_w("#ff000080");
    const element = show(form_color({ value, alpha: true }));
    expect(Number(native(element).dataset.alpha)).toBeCloseTo(0.5, 2);
    //Like the color keyboard writes it
    native(element).dataset.alpha = "0.25";
    native(element).dispatchEvent(new Event("input"));
    native(element).dispatchEvent(new Event("change"));
    await tick();
    expect(value.ok()).toBe("#ff000040");
    //Without alpha the native input has none
    expect(
      native(show(form_color({ value: "#ff0000" }))).hasAttribute("data-alpha"),
    ).toBe(false);
  });
});
