import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { form_color } from "./color_input";

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

  it("uses a color input and is not live by default", () => {
    const { input, element } = make();
    expect(input.type).toBe("color");
    expect(element.live).toBe(false);
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
    element.live = true;
    expect(element.live).toBe(true);
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
    element.bind({ value: state });
    expect(input.value).toBe("#123456");
    await pick("#abcdef", "change");
    expect(state.ok()).toBe("#abcdef");
    expect(change).toHaveBeenCalledWith("#abcdef");
    state.set_ok("#000001");
    await wait();
    expect(input.value).toBe("#000001");
  });
});
