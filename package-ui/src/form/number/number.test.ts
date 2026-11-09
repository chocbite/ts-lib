import { ok } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { form_number_input } from "./number_input/number_input";
import { form_progress } from "./progress/progress";
import { form_slider } from "./slider/slider";
import { form_stepper } from "./stepper/stepper";

/**Icon function giving an svg marked with the given name*/
const custom_icon = (name: string) => () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.dataset.icon = name;
  return svg;
};

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**Lets pointer capture calls pass for synthetic pointer events, which have no active pointer*/
const allow_capture = (element: Element) => {
  element.setPointerCapture = () => {};
  element.releasePointerCapture = () => {};
};

interface NumberRelated {
  min?: number;
  max?: number;
  step?: number;
  start?: number;
  decimals?: number;
  unit?: string;
}

/**Writable number state with a number helper, its write checks the value*/
const number_state = (value: number, related: NumberRelated = {}) =>
  st.rosw(
    st.n.help(ok(value), {
      min: related.min === undefined ? undefined : st.ok(related.min),
      max: related.max === undefined ? undefined : st.ok(related.max),
      step: related.step === undefined ? undefined : st.ok(related.step),
      start: related.start === undefined ? undefined : st.ok(related.start),
      decimals:
        related.decimals === undefined ? undefined : st.ok(related.decimals),
      unit: related.unit === undefined ? undefined : st.ok(related.unit),
    }),
    true,
  );

const key = (target: Element, key: string) => {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
};

/**Dispatches a cancelable beforeinput event, returns true if it was prevented*/
const before_input = (target: Element, data: string) => {
  const event = new InputEvent("beforeinput", {
    data,
    inputType: "insertText",
    cancelable: true,
    bubbles: true,
  });
  target.dispatchEvent(event);
  return event.defaultPrevented;
};

describe("Number element icons", () => {
  it("stepper accepts custom decrease and increase icons", () => {
    const element = form_stepper({
      icon_decrease: custom_icon("dec"),
      icon_increase: custom_icon("inc"),
    });
    expect(element.querySelector('[data-icon="dec"]')).not.toBeNull();
    expect(element.querySelector('[data-icon="inc"]')).not.toBeNull();
  });

  it("slider accepts custom decrease and increase icons", () => {
    const element = form_slider({
      icon_decrease: custom_icon("dec"),
      icon_increase: custom_icon("inc"),
    });
    expect(element.querySelector('[data-icon="dec"]')).not.toBeNull();
    expect(element.querySelector('[data-icon="inc"]')).not.toBeNull();
  });

  it("stepper icon can be changed twice", () => {
    const element = form_stepper();
    element.icon_decrease = custom_icon("first");
    element.icon_decrease = custom_icon("second");
    expect(element.querySelector('[data-icon="first"]')).toBeNull();
    expect(element.querySelector('[data-icon="second"]')).not.toBeNull();
  });
});

describe("Number element automatic step", () => {
  it("stepper steps by the smallest decimal without a step", () => {
    const element = form_stepper({ decimals: 2 });
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    return wait(10).then(() => expect(element.buffer).toBe(0.01));
  });

  it("number input steps by the smallest decimal without a step", () => {
    const element = form_number_input({ decimals: 2 });
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    return wait(10).then(() => expect(element.buffer).toBe(0.01));
  });

  it("steps by 1 without decimals or step", () => {
    const element = form_stepper();
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    return wait(10).then(() => expect(element.buffer).toBe(1));
  });

  it("takes bigger automatic steps for big values", async () => {
    const element = form_stepper({ value: 300 });
    key(element, "ArrowRight");
    await wait();
    expect(element.buffer).toBe(302);
  });

  it("steps by a fractional step without a decimals option", async () => {
    const element = form_stepper({ step: 0.1 });
    key(element, "ArrowRight");
    await wait();
    expect(element.buffer).toBeCloseTo(0.1);
  });
});

describe("Number element pointer cancel", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("stepper stops repeating when the pointer is cancelled", async () => {
    const element = form_stepper();
    document.body.appendChild(element);
    const icon = element.querySelector("svg")!;
    allow_capture(icon);
    icon.dispatchEvent(
      new PointerEvent("pointerdown", { button: 0, pointerId: 1 }),
    );
    await wait(800);
    icon.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 }));
    const after_cancel = element.buffer;
    expect(after_cancel).toBeLessThan(0);
    await wait(600);
    expect(element.buffer).toBe(after_cancel);
    expect(icon.classList.contains("active")).toBe(false);
  });
});

//##################################################################################################
//      _   _ _    _ __  __ ____  ______ _____    _____ _   _ _____  _    _ _______
//     | \ | | |  | |  \/  |  _ \|  ____|  __ \  |_   _| \ | |  __ \| |  | |__   __|

/**Number input attached to the document, with helpers to simulate the user*/
const make_input = (options: Parameters<typeof form_number_input>[0] = {}) => {
  const change = vi.fn();
  const element = form_number_input({ change, ...options });
  document.body.appendChild(element);
  const [value_box, unit_box] = element.querySelectorAll(":scope > span");
  const legend = element.querySelector(":scope > div")!;
  const warn_input = element.querySelector("input")!;
  /**Focuses the value, types the text and presses the key*/
  const type = async (text: string, press: string = "Enter") => {
    (value_box as HTMLElement).focus();
    value_box.textContent = text;
    key(element, press);
    await wait();
  };
  return {
    element,
    change,
    value_box: value_box as HTMLElement,
    unit_box,
    max_legend: legend.children[0],
    min_legend: legend.children[1],
    warn_input,
    type,
  };
};

describe("Number input", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("shows the value with decimals, unit and limit legends", () => {
    const { value_box, unit_box, min_legend, max_legend } = make_input({
      value: 2.5,
      decimals: 2,
      unit: "V",
      min: 0,
      max: 10,
    });
    expect(value_box.textContent).toBe("2.50");
    expect(unit_box.textContent).toBe("V");
    expect(min_legend.textContent).toBe("Min:0.00");
    expect(max_legend.textContent).toBe("Max:10.00");
  });

  it("has no legends without limits", () => {
    const { min_legend, max_legend } = make_input({ value: 1 });
    expect(min_legend.textContent).toBe("");
    expect(max_legend.textContent).toBe("");
  });

  it("ArrowUp and ArrowDown step by the step and call change", async () => {
    const { element, change } = make_input({ value: 4, step: 2 });
    key(element, "ArrowUp");
    await wait();
    expect(element.buffer).toBe(6);
    expect(change).toHaveBeenLastCalledWith(6);
    key(element, "ArrowDown");
    await wait();
    expect(element.buffer).toBe(4);
    expect(change).toHaveBeenLastCalledWith(4);
    expect(element.changed).toBe(true);
  });

  it("rejects stepping past max with a warning, without calling change", async () => {
    const { element, change, warn_input } = make_input({
      value: 5,
      max: 5,
      step: 1,
    });
    key(element, "ArrowUp");
    await wait();
    expect(element.buffer).toBe(5);
    expect(change).not.toHaveBeenCalled();
    expect(warn_input.validationMessage).toBe("Maximum value 5");
  });

  it("rejects stepping below min with a warning", async () => {
    const { element, warn_input } = make_input({ value: 0, min: 0, step: 1 });
    key(element, "ArrowDown");
    await wait();
    expect(element.buffer).toBe(0);
    expect(warn_input.validationMessage).toBe("Minimum value 0");
  });

  it("sets a typed value on Enter", async () => {
    const { element, change, type } = make_input({ value: 1 });
    await type("7");
    expect(element.buffer).toBe(7);
    expect(change).toHaveBeenCalledWith(7);
  });

  it("accepts a comma as decimal separator", async () => {
    const { element, type } = make_input({ decimals: 2 });
    await type("1,25");
    expect(element.buffer).toBe(1.25);
  });

  it("snaps a typed value to the step", async () => {
    const { element, value_box, type } = make_input({ step: 0.5, decimals: 1 });
    await type("1.3");
    expect(element.buffer).toBe(1.5);
    expect(value_box.textContent).toBe("1.5");
  });

  it("restores the old value when a typed value is outside the limits", async () => {
    const { element, change, value_box, warn_input, type } = make_input({
      value: 3,
      max: 10,
    });
    await type("20");
    expect(element.buffer).toBe(3);
    expect(value_box.textContent).toBe("3");
    expect(change).not.toHaveBeenCalled();
    expect(warn_input.validationMessage).toBe("Maximum value 10");
  });

  it("Escape restores the shown value", async () => {
    const { element, value_box, type } = make_input({ value: 3 });
    await type("9", "Escape");
    expect(value_box.textContent).toBe("3");
    expect(element.buffer).toBe(3);
  });

  it("Escape without a value empties the text", async () => {
    const { value_box, type } = make_input();
    await type("9", "Escape");
    expect(value_box.textContent).toBe("");
  });

  it("sets the typed value when focus leaves", async () => {
    const { element, value_box } = make_input({ value: 1 });
    value_box.focus();
    value_box.textContent = "4";
    value_box.blur();
    await wait();
    expect(element.buffer).toBe(4);
  });

  it("shows the accepted value when a typed value rounds to the current value", async () => {
    const { element, value_box, type } = make_input({ value: 1, decimals: 1 });
    await type("1.04");
    expect(element.buffer).toBe(1);
    expect(value_box.textContent).toBe("1.0");
  });

  it("blocks letters, and decimal separators without decimals", () => {
    const { element } = make_input();
    expect(before_input(element, "a")).toBe(true);
    expect(before_input(element, "5")).toBe(false);
    expect(before_input(element, ".")).toBe(true);
    expect(before_input(element, ",")).toBe(true);
    element.decimals = 1;
    expect(before_input(element, ".")).toBe(false);
  });

  it("blocks a minus only when min is not negative", () => {
    const { element } = make_input();
    expect(before_input(element, "-")).toBe(false);
    element.min = 0;
    expect(before_input(element, "-")).toBe(true);
  });

  it("blocks new lines", () => {
    const { element } = make_input();
    const event = new InputEvent("beforeinput", {
      inputType: "insertParagraph",
      cancelable: true,
      bubbles: true,
    });
    element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("takes min, max, decimals and unit from the bound state", () => {
    const state = number_state(2, { min: 0, max: 10, decimals: 1, unit: "A" });
    const { element, unit_box, min_legend, max_legend } = make_input();
    element.bind({ value: state });
    expect(unit_box.textContent).toBe("A");
    expect(min_legend.textContent).toBe("Min:0.0");
    expect(max_legend.textContent).toBe("Max:10.0");
  });

  it("follows changes of a related limit state", () => {
    const min = st.ok_w(0);
    const state = st.rosw(st.n.help(ok(5), { min }), true);
    const { element, min_legend } = make_input();
    element.bind({ value: state });
    min.set_ok(2);
    expect(min_legend.textContent).toBe("Min:2");
  });

  it("writes stepped values to the bound state", async () => {
    const state = number_state(4, { step: 2 });
    const { element, change, value_box } = make_input();
    element.bind({ value: state });
    expect(value_box.textContent).toBe("4");
    key(element, "ArrowUp");
    await wait();
    expect(state.ok()).toBe(6);
    expect(value_box.textContent).toBe("6");
    expect(change).toHaveBeenCalledWith(6);
    expect(element.get_value.err).toBe(true);
  });

  it("does not write past the limit of the bound state", async () => {
    const state = number_state(10, { max: 10 });
    const { element, change } = make_input();
    element.bind({ value: state });
    key(element, "ArrowUp");
    await wait();
    expect(state.ok()).toBe(10);
    expect(change).not.toHaveBeenCalled();
  });

  it("shows the bound value with the decimals of the bound state", () => {
    const state = number_state(2.5, { decimals: 2 });
    const { element, value_box } = make_input();
    element.bind({ value: state });
    expect(value_box.textContent).toBe("2.50");
  });

  it("rebinding to a state without limits removes the old limits", async () => {
    const limited = number_state(5, { min: 0, max: 5 });
    const plain = st.ok_w(5);
    const { element, min_legend, max_legend } = make_input();
    element.bind({ value: limited });
    element.bind({ value: plain });
    expect(min_legend.textContent).toBe("");
    expect(max_legend.textContent).toBe("");
    key(element, "ArrowUp");
    await wait();
    expect(plain.ok()).toBe(6);
  });

  it("focusing and leaving without editing keeps a newer state value", async () => {
    const state = st.ok_w(5);
    const { element, value_box } = make_input();
    element.bind({ value: state });
    value_box.focus();
    state.set_ok(7);
    value_box.blur();
    await wait();
    expect(state.ok()).toBe(7);
  });
});

//##################################################################################################
//       _____ _______ ______ _____  _____  ______ _____
//      / ____|__   __|  ____|  __ \|  __ \|  ____|  __ \

/**Stepper attached to the document, with helpers to simulate the user*/
const make_stepper = (options: Parameters<typeof form_stepper>[0] = {}) => {
  const change = vi.fn();
  const element = form_stepper({ change, ...options });
  document.body.appendChild(element);
  const [dec, inc] = element.querySelectorAll(":scope > svg");
  const text = element.querySelector(":scope > span") as HTMLSpanElement;
  const [value_box, unit_box, legend] = text.children;
  allow_capture(text);
  allow_capture(dec);
  allow_capture(inc);
  /**Presses and releases a step icon*/
  const click_icon = async (icon: Element) => {
    icon.dispatchEvent(
      new PointerEvent("pointerdown", { button: 0, pointerId: 1 }),
    );
    icon.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    await wait();
  };
  /**Drags the number text horizontally through the given x positions*/
  const drag = (xs: number[]) => {
    text.dispatchEvent(
      new PointerEvent("pointerdown", {
        button: 0,
        pointerId: 1,
        clientX: xs[0],
      }),
    );
    for (const x of xs.slice(1))
      text.dispatchEvent(
        new PointerEvent("pointermove", { pointerId: 1, clientX: x }),
      );
  };
  return {
    element,
    change,
    dec,
    inc,
    text,
    value_box: value_box as HTMLElement,
    unit_box,
    max_legend: legend.children[0],
    min_legend: legend.children[1],
    warn_input: element.querySelector("input")!,
    click_icon,
    drag,
  };
};

describe("Stepper", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("shows the value with decimals, unit and limit legends", () => {
    const { value_box, unit_box, min_legend, max_legend } = make_stepper({
      value: 1.5,
      decimals: 1,
      unit: "m",
      min: -1,
      max: 2,
    });
    expect(value_box.textContent).toBe("1.5");
    expect(unit_box.textContent).toBe("m");
    expect(min_legend.textContent).toBe("Min:-1.0");
    expect(max_legend.textContent).toBe("Max:2.0");
  });

  it("ArrowRight and ArrowLeft step by the step and call change", async () => {
    const { element, change } = make_stepper({
      value: 1,
      step: 0.5,
      decimals: 1,
    });
    key(element, "ArrowRight");
    await wait();
    expect(element.buffer).toBe(1.5);
    expect(change).toHaveBeenLastCalledWith(1.5);
    key(element, "ArrowLeft");
    await wait();
    key(element, "ArrowLeft");
    await wait();
    expect(element.buffer).toBe(0.5);
  });

  it("rejects stepping past max with a warning, without calling change", async () => {
    const { element, change, warn_input } = make_stepper({
      value: 3,
      max: 3,
      unit: "V",
    });
    key(element, "ArrowRight");
    await wait();
    expect(element.buffer).toBe(3);
    expect(change).not.toHaveBeenCalled();
    expect(warn_input.validationMessage).toBe("Maximum value 3V");
  });

  it("steps once when an icon is clicked", async () => {
    const { element, dec, inc, click_icon } = make_stepper({ value: 5 });
    await click_icon(inc);
    expect(element.buffer).toBe(6);
    await click_icon(dec);
    await click_icon(dec);
    expect(element.buffer).toBe(4);
    expect(inc.classList.contains("active")).toBe(false);
  });

  it("repeats stepping while an icon is held and stops on release", async () => {
    const { element, inc } = make_stepper({ value: 0 });
    inc.dispatchEvent(
      new PointerEvent("pointerdown", { button: 0, pointerId: 1 }),
    );
    expect(inc.classList.contains("active")).toBe(true);
    await wait(1100);
    inc.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    const released = element.buffer!;
    expect(released).toBeGreaterThanOrEqual(3);
    await wait(400);
    expect(element.buffer).toBe(released);
    expect(inc.classList.contains("active")).toBe(false);
  });

  it("ignores icon presses with other buttons than the main one", async () => {
    const { element, inc } = make_stepper({ value: 0 });
    inc.dispatchEvent(
      new PointerEvent("pointerdown", { button: 2, pointerId: 1 }),
    );
    inc.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    await wait();
    expect(element.buffer).toBe(0);
  });

  it("dragging previews the value and sets it on release", async () => {
    const { element, change, text, value_box, drag } = make_stepper({
      value: 0,
    });
    drag([100, 110, 150]);
    await wait();
    expect(value_box.textContent).toBe("5");
    expect(element.buffer).toBe(0);
    expect(change).not.toHaveBeenCalled();
    text.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, clientX: 150 }),
    );
    await wait();
    expect(element.buffer).toBe(5);
    expect(change).toHaveBeenCalledWith(5);
  });

  it("dragging multiplies by the step and is limited", async () => {
    const { element, text, drag } = make_stepper({
      value: 0,
      step: 2,
      max: 6,
    });
    drag([100, 110, 300]);
    text.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, clientX: 300 }),
    );
    await wait();
    expect(element.buffer).toBe(6);
  });

  it("dragging in live mode sets the value while moving", async () => {
    const { element, change, drag } = make_stepper({ value: 0, live: true });
    drag([100, 110, 130]);
    await wait();
    expect(element.buffer).toBe(3);
    expect(change).toHaveBeenCalledWith(3);
  });

  it("a cancelled drag restores the value", async () => {
    const { element, text, value_box, drag } = make_stepper({ value: 1 });
    drag([100, 110, 200]);
    await wait();
    expect(value_box.textContent).toBe("11");
    text.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 }));
    expect(value_box.textContent).toBe("1");
    expect(element.buffer).toBe(1);
    expect(value_box.contentEditable).toBe("true");
  });

  it("releases the pointer capture of pointer id 0", () => {
    const { text } = make_stepper({ value: 1 });
    const release = vi.fn();
    text.releasePointerCapture = release;
    text.dispatchEvent(
      new PointerEvent("pointerdown", { button: 0, pointerId: 0, clientX: 10 }),
    );
    text.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 0, clientX: 10 }),
    );
    expect(release).toHaveBeenCalledWith(0);
  });

  it("Escape after a press does not release the ended pointer again", () => {
    const { element, text } = make_stepper({ value: 1 });
    const release = vi.fn();
    text.releasePointerCapture = release;
    text.dispatchEvent(
      new PointerEvent("pointerdown", { button: 0, pointerId: 3, clientX: 10 }),
    );
    text.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 3, clientX: 10 }),
    );
    HTMLElement.prototype.focus.call(element);
    key(element, "Escape");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("clicking the number area without moving starts editing", () => {
    const { text, value_box } = make_stepper({ value: 1 });
    text.dispatchEvent(
      new PointerEvent("pointerdown", { button: 0, pointerId: 1, clientX: 10 }),
    );
    text.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, clientX: 10 }),
    );
    expect(document.activeElement).toBe(value_box);
  });

  it("clicking the number area without a value does not throw", () => {
    const { text } = make_stepper();
    text.dispatchEvent(
      new PointerEvent("pointerdown", { button: 0, pointerId: 1, clientX: 10 }),
    );
    const up = text.onpointerup!;
    expect(() => {
      up.call(
        text,
        new PointerEvent("pointerup", { pointerId: 1, clientX: 10 }),
      );
    }).not.toThrow();
  });

  it("typing a digit starts editing with an empty text", () => {
    const { element, value_box } = make_stepper({ value: 12 });
    element.focus();
    HTMLElement.prototype.focus.call(element);
    key(element, "3");
    expect(document.activeElement).toBe(value_box);
    expect(value_box.textContent).toBe("");
  });

  it("sets the typed value when focus leaves", async () => {
    const { element, change, value_box } = make_stepper({ value: 1 });
    value_box.focus();
    value_box.textContent = "8";
    value_box.blur();
    await wait();
    expect(element.buffer).toBe(8);
    expect(change).toHaveBeenCalledWith(8);
  });

  it("focusing and leaving without editing shows a newer state value", async () => {
    const state = st.ok_w(5);
    const { element, value_box } = make_stepper();
    element.bind({ value: state });
    value_box.focus();
    state.set_ok(7);
    expect(value_box.textContent).toBe("5");
    value_box.blur();
    await wait();
    expect(state.ok()).toBe(7);
    expect(value_box.textContent).toBe("7");
  });

  it("retyping the shown value while a newer state value arrived writes it", async () => {
    const state = st.ok_w(5);
    const { element, value_box } = make_stepper();
    element.bind({ value: state });
    value_box.focus();
    state.set_ok(7);
    value_box.textContent = "5";
    value_box.dispatchEvent(new InputEvent("input", { bubbles: true }));
    value_box.blur();
    await wait();
    expect(state.ok()).toBe(5);
  });

  it("Escape while editing restores the value", () => {
    const { value_box } = make_stepper({ value: 1 });
    value_box.focus();
    value_box.textContent = "8";
    key(value_box, "Escape");
    expect(value_box.textContent).toBe("1");
  });

  it("allows digits after a minus sign", () => {
    const { value_box } = make_stepper({ value: -5 });
    value_box.focus();
    expect(before_input(value_box, "3")).toBe(false);
  });

  it("blocks a second minus sign and a minus with a positive min", () => {
    const { element, value_box } = make_stepper({ value: -5 });
    expect(before_input(value_box, "-")).toBe(true);
    element.value = 5;
    element.min = 0;
    expect(before_input(value_box, "-")).toBe(true);
  });

  it("writes to the bound state and takes its limits", async () => {
    const state = number_state(9, { max: 10, unit: "%" });
    const { element, unit_box, max_legend } = make_stepper();
    element.bind({ value: state });
    expect(unit_box.textContent).toBe("%");
    expect(max_legend.textContent).toBe("Max:10");
    key(element, "ArrowRight");
    await wait();
    expect(state.ok()).toBe(10);
    key(element, "ArrowRight");
    await wait();
    expect(state.ok()).toBe(10);
  });

  it("shows the bound value with the decimals of the bound state", () => {
    const state = number_state(2.5, { decimals: 2 });
    const { element, value_box } = make_stepper();
    element.bind({ value: state });
    expect(value_box.textContent).toBe("2.50");
  });

  it("shows state values set while not editing", () => {
    const state = st.ok_w(1);
    const { element, value_box } = make_stepper();
    element.bind({ value: state });
    state.set_ok(4);
    expect(value_box.textContent).toBe("4");
  });
});

describe("Progress", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  const parts = (element: HTMLElement) => ({
    bar: element.children[0] as HTMLDivElement,
    text: element.children[1] as HTMLSpanElement,
  });

  it("shows the value with its decimals and the bar between min and max", () => {
    const element = form_progress({ value: 30, min: 20, max: 40, decimals: 1 });
    expect(parts(element).text.textContent).toBe("30.0");
    expect(parts(element).bar.style.width).toBe("50%");
  });

  it("redraws the shown value when decimals, min or max change", () => {
    const element = form_progress({ value: 25 });
    const { bar, text } = parts(element);
    element.decimals = 2;
    expect(text.textContent).toBe("25.00");
    element.max = 50;
    expect(bar.style.width).toBe("50%");
    element.min = 20;
    expect(parseFloat(bar.style.width)).toBeCloseTo(100 / 6, 3);
  });

  it("redraws when the related states of the bound state change", async () => {
    const decimals = st.ok_w(0);
    const max = st.ok_w(100);
    const state = st.rosw(st.n.help(ok(25), { decimals, max }), true);
    const element = form_progress();
    document.body.appendChild(element);
    element.bind({ value: state });
    const { bar, text } = parts(element);
    expect(text.textContent).toBe("25");
    decimals.set_ok(1);
    max.set_ok(50);
    await wait();
    expect(text.textContent).toBe("25.0");
    expect(bar.style.width).toBe("50%");
  });
});
