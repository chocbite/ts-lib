import { ok } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { theme_init } from "#theme";
import { afterEach, describe, expect, it, vi } from "vitest";
import { form_slider } from "./slider";

theme_init();

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**Lets pointer capture calls pass for synthetic pointer events, which have no active pointer*/
const allow_capture = (element: Element) => {
  element.setPointerCapture = () => {};
  element.releasePointerCapture = () => {};
};

const key = (target: Element, key: string) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );

/**Slider attached to the document, with helpers to simulate the user*/
const make = (options: Parameters<typeof form_slider>[0] = {}) => {
  const change = vi.fn();
  const element = form_slider({ change, ...options });
  element.style.width = "400px";
  document.body.appendChild(element);
  const [dec, inc] = element.querySelectorAll(":scope > svg");
  const slide = element.querySelector(":scope > div")!;
  const slider = slide.children[0] as HTMLElement;
  const [value_box, unit_box] = slider.children;
  const legend = element.querySelector(":scope > span")!;
  allow_capture(slider);
  allow_capture(dec);
  allow_capture(inc);
  /**Client x coordinate that the slider maps to the given percentage, when pressed outside the thumb*/
  const track_x = (perc: number) => {
    const box = slide.getBoundingClientRect();
    return (
      box.x +
      (box.width * perc) / 100 +
      slider.getBoundingClientRect().width / 2
    );
  };
  const down = (perc: number, pointerType: string = "mouse") =>
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        button: 0,
        pointerId: 1,
        pointerType,
        clientX: track_x(perc),
        bubbles: true,
      }),
    );
  const move = (perc: number) =>
    slider.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 1,
        clientX: track_x(perc),
      }),
    );
  const up = (perc: number) =>
    slider.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, clientX: track_x(perc) }),
    );
  return {
    element,
    change,
    dec,
    inc,
    slide,
    slider,
    value_box,
    unit_box,
    left_legend: legend.children[0],
    right_legend: legend.children[1],
    warn_input: element.querySelector("input")!,
    down,
    move,
    up,
  };
};

describe("Slider", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("shows the value, unit and limit legends", () => {
    const { value_box, unit_box, left_legend, right_legend } = make({
      value: 2,
      min: 0,
      max: 10,
      decimals: 1,
      unit: "s",
    });
    expect(value_box.textContent).toBe("2.0");
    expect(unit_box.textContent).toBe("s");
    expect(left_legend.textContent).toBe("Min:0.0");
    expect(right_legend.textContent).toBe("10.0:Max");
  });

  it("places the handle by the value within the limits", () => {
    const { element, slider } = make({ min: 0, max: 10, value: 5 });
    expect(slider.style.left).toBe("50%");
    element.value = 0;
    expect(slider.style.left).toBe("0%");
    element.value = 10;
    expect(slider.style.left).toBe("100%");
    element.value = 20;
    expect(slider.style.left).toBe("100%");
  });

  it("moves the handle when the limits change after the value", () => {
    const { element, slider } = make({ value: 5 });
    element.min = 0;
    element.max = 20;
    expect(slider.style.left).toBe("25%");
  });

  it("keeps the handle centered without a max", () => {
    const { element, slider } = make({ min: 0, value: 5 });
    expect(slider.style.left).toBe("50%");
    element.value = 7;
    expect(slider.style.left).toBe("50%");
  });

  it("keeps the handle centered without a min", () => {
    const { slider } = make({ max: 100, value: 5 });
    expect(slider.style.left).toBe("50%");
  });

  it("ArrowRight and ArrowLeft step the value", async () => {
    const { element, slider, change } = make({
      min: 0,
      max: 10,
      step: 2,
      value: 4,
    });
    key(slider, "ArrowRight");
    await wait();
    expect(element.buffer).toBe(6);
    expect(change).toHaveBeenLastCalledWith(6);
    key(slider, "ArrowLeft");
    await wait();
    expect(element.buffer).toBe(4);
  });

  it("rejects stepping past max with a warning", async () => {
    const { element, slider, change, warn_input } = make({
      min: 0,
      max: 10,
      value: 10,
    });
    key(slider, "ArrowRight");
    await wait();
    expect(element.buffer).toBe(10);
    expect(change).not.toHaveBeenCalled();
    expect(warn_input.validationMessage).toBe("Maximum value 10");
  });

  it("steps once when an icon is clicked", async () => {
    const { element, inc, dec } = make({ min: 0, max: 10, value: 5 });
    for (const icon of [inc, inc, dec]) {
      icon.dispatchEvent(
        new PointerEvent("pointerdown", { button: 0, pointerId: 1 }),
      );
      icon.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
      await wait();
    }
    expect(element.buffer).toBe(6);
  });

  it("previews a pressed position and sets it on release", async () => {
    const { element, change, slider, value_box, down, move, up } = make({
      min: 0,
      max: 10,
      value: 1,
    });
    down(80);
    await wait();
    expect(slider.classList.contains("active")).toBe(true);
    expect(value_box.textContent).toBe("8");
    expect(element.buffer).toBe(1);
    move(30);
    await wait();
    expect(value_box.textContent).toBe("3");
    expect(change).not.toHaveBeenCalled();
    up(30);
    await wait();
    expect(element.buffer).toBe(3);
    expect(change).toHaveBeenCalledWith(3);
    expect(slider.classList.contains("active")).toBe(false);
  });

  it("sets the value while moving in live mode", async () => {
    const { element, change, down, move } = make({
      min: 0,
      max: 10,
      value: 1,
      live: true,
    });
    down(50);
    await wait();
    expect(element.buffer).toBe(5);
    move(70);
    await wait();
    expect(element.buffer).toBe(7);
    expect(change).toHaveBeenCalledTimes(2);
  });

  it("a cancelled drag restores the value", async () => {
    const { element, slider, value_box, down } = make({
      min: 0,
      max: 10,
      value: 1,
    });
    down(80);
    await wait();
    slider.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 }));
    expect(value_box.textContent).toBe("1");
    expect(slider.style.left).toBe("10%");
    expect(element.buffer).toBe(1);
    expect(slider.classList.contains("active")).toBe(false);
  });

  it("Escape during a drag restores the value", async () => {
    const { element, slider, value_box, down, up } = make({
      min: 0,
      max: 10,
      value: 1,
    });
    down(80);
    await wait();
    key(slider, "Escape");
    expect(value_box.textContent).toBe("1");
    up(80);
    await wait();
    expect(element.buffer).toBe(1);
  });

  it("Escape after a drag is left to other handlers", async () => {
    const { slider, down, up } = make({ min: 0, max: 10, value: 1 });
    down(80);
    up(80);
    await wait();
    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    slider.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);
  });

  it("Escape after a drag without limits is left to other handlers", async () => {
    const { slider, down, up } = make({ value: 1 });
    down(50);
    up(50);
    await wait();
    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    slider.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);
  });

  it("ignores a touch outside the handle", async () => {
    const { element, value_box, down } = make({ min: 0, max: 10, value: 1 });
    down(80, "touch");
    await wait();
    expect(value_box.textContent).toBe("1");
    expect(element.buffer).toBe(1);
  });

  it("limits a drag to the step of the bound state", async () => {
    const state = st.rosw(
      st.n.help(ok(0), { min: st.ok(0), max: st.ok(10), step: st.ok(5) }),
      true,
    );
    const { element, left_legend, down, up } = make();
    element.bind({ value: state });
    expect(left_legend.textContent).toBe("Min:0");
    down(80);
    up(80);
    await wait();
    expect(state.ok()).toBe(10);
  });

  it("shows the bound value with the decimals of the bound state", () => {
    const state = st.rosw(
      st.n.help(ok(2.5), { min: st.ok(0), max: st.ok(10), decimals: st.ok(2) }),
      true,
    );
    const { element, value_box } = make();
    element.bind({ value: state });
    expect(value_box.textContent).toBe("2.50");
  });

  it("holding right of the center without limits increases the value over time", async () => {
    const { element, slider, change } = make({ value: 0 });
    const box = slider.getBoundingClientRect();
    const slide_width = slider.parentElement!.getBoundingClientRect().width;
    const x = box.x + 1;
    slider.dispatchEvent(
      new PointerEvent("pointerdown", {
        button: 0,
        pointerId: 1,
        pointerType: "mouse",
        clientX: x,
        bubbles: true,
      }),
    );
    slider.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 1,
        clientX: x + slide_width / 4,
      }),
    );
    await wait(550);
    expect(element.buffer).toBe(0);
    expect(Number(slider.children[0].textContent)).toBeGreaterThan(0);
    slider.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, clientX: x }),
    );
    await wait();
    expect(element.buffer).toBeGreaterThan(0);
    expect(change).toHaveBeenCalledTimes(1);
    expect(slider.style.left).toBe("50%");
  });
});
