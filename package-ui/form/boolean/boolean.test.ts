import { ok } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { theme_init } from "#theme";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { FormColors } from "../base";
import { form_button } from "./button/button";
import { form_lamp } from "./lamp/lamp";
import { form_switch } from "./switch/switch";

//Sizes of the switch come from theme variables
theme_init();

/**Icon function giving an svg marked with the given name*/
const custom_icon = (name: string) => () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.dataset.icon = name;
  return svg;
};

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("Boolean element icons", () => {
  const makers = {
    button: () => form_button(),
    switch: () => form_switch(),
    lamp: () => form_lamp(),
  };
  for (const [name, make] of Object.entries(makers))
    it(`${name} replaces its icon when set again`, () => {
      const element = make();
      element.icon = custom_icon("first");
      element.icon = custom_icon("second");
      expect(element.querySelector('[data-icon="first"]')).toBeNull();
      expect(element.querySelectorAll('[data-icon="second"]').length).toBe(1);
      element.icon = undefined;
      expect(element.querySelector('[data-icon="second"]')).toBeNull();
    });
});

//##################################################################################################
//       _______          _______ _______ _____ _    _
//      / ____\ \        / /_   _|__   __/ ____| |  | |

/**Switch attached to the document, with helpers to simulate the user*/
const make_switch = (options: Parameters<typeof form_switch>[0] = {}) => {
  const change = vi.fn();
  const element = form_switch({ change, ...options });
  document.body.appendChild(element);
  const knob = element.querySelector(":scope > div") as HTMLDivElement;
  knob.setPointerCapture = () => {};
  knob.releasePointerCapture = () => {};
  const box = () => knob.getBoundingClientRect();
  const pointer = (
    type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
    x: number,
  ) =>
    knob.dispatchEvent(
      new PointerEvent(type, {
        button: 0,
        pointerId: 1,
        clientX: x,
        clientY: box().y + box().height / 2,
        bubbles: true,
      }),
    );
  const key = (type: "keydown" | "keyup", key: string) =>
    knob.dispatchEvent(
      new KeyboardEvent(type, { key, bubbles: true, cancelable: true }),
    );
  return { element, change, knob, box, pointer, key };
};

describe("Switch", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("toggles when the element is clicked", async () => {
    const { element, change, knob } = make_switch();
    element.click();
    await wait();
    expect(element.buffer).toBe(true);
    expect(knob.classList.contains("on")).toBe(true);
    element.click();
    await wait();
    expect(element.buffer).toBe(false);
    expect(knob.classList.contains("on")).toBe(false);
    expect(change.mock.calls).toEqual([[true], [false]]);
  });

  it("toggles once on a press of the switch, the following click is ignored", async () => {
    const { element, knob, box, pointer } = make_switch();
    const x = box().x + 2;
    pointer("pointerdown", x);
    expect(knob.classList.contains("active")).toBe(true);
    pointer("pointerup", x);
    knob.click();
    await wait();
    expect(element.buffer).toBe(true);
    expect(knob.classList.contains("active")).toBe(false);
  });

  it("follows a drag across its middle without toggling on release", async () => {
    const { element, box, pointer } = make_switch();
    const left = box().x + 1;
    const right = box().x + box().width - 1;
    pointer("pointerdown", left);
    pointer("pointermove", left + 11);
    pointer("pointermove", right);
    await wait();
    expect(element.buffer).toBe(true);
    pointer("pointermove", left);
    await wait();
    expect(element.buffer).toBe(false);
    pointer("pointerup", left);
    await wait();
    expect(element.buffer).toBe(false);
  });

  it("toggles when Enter or Space is released", async () => {
    const { element, key } = make_switch();
    key("keydown", "Enter");
    expect(element.buffer).toBe(undefined);
    key("keyup", "Enter");
    await wait();
    expect(element.buffer).toBe(true);
    key("keydown", " ");
    key("keyup", " ");
    await wait();
    expect(element.buffer).toBe(false);
  });

  it("toggles when Enter is released after another key", async () => {
    const { element, key } = make_switch();
    key("keydown", "Enter");
    key("keyup", "Shift");
    key("keyup", "Enter");
    await wait();
    expect(element.buffer).toBe(true);
  });

  it("is no longer active after a cancelled press", () => {
    const { knob, box, pointer } = make_switch();
    pointer("pointerdown", box().x + 2);
    pointer("pointercancel", box().x + 2);
    expect(knob.classList.contains("active")).toBe(false);
    expect(knob.onpointermove).toBeNull();
  });

  it("writes to and shows the bound state", async () => {
    const state = st.rosw(st.b.help(ok(false)), true);
    const { element, knob } = make_switch();
    element.bind({ value: state });
    element.click();
    await wait();
    expect(state.ok()).toBe(true);
    state.set_ok(false);
    expect(knob.classList.contains("on")).toBe(false);
  });

  it("shows an error of the bound state until it is ok again", () => {
    const state = st.err_w<boolean>("broken");
    const { element, knob } = make_switch();
    element.bind({ value: state });
    expect(knob.classList.contains("error")).toBe(true);
    state.set_ok(true);
    expect(knob.classList.contains("error")).toBe(false);
    expect(knob.classList.contains("on")).toBe(true);
  });

  it("sets on and off colors, None removes them", () => {
    const { element, knob } = make_switch({
      on_color: FormColors.Green,
      off_color: FormColors.Red,
    });
    expect(knob.getAttribute("on-color")).toBe("green");
    expect(knob.getAttribute("off-color")).toBe("red");
    element.on_color = FormColors.None;
    element.off_color = FormColors.None;
    expect(knob.hasAttribute("on-color")).toBe(false);
    expect(knob.hasAttribute("off-color")).toBe(false);
  });

  it("is cleared to off", () => {
    const { element, knob } = make_switch({ value: true });
    element.clear();
    expect(knob.classList.contains("on")).toBe(false);
    expect(element.get_value.err).toBe(true);
  });
});

//##################################################################################################
//      _               __  __ _____
//     | |        /\   |  \/  |  __ \

describe("Lamp", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("shows the color of a boolean value", () => {
    const lamp = form_lamp({
      colors: [FormColors.Red, FormColors.Green],
      value: true,
    });
    expect(lamp.getAttribute("color")).toBe("green");
    lamp.value = false;
    expect(lamp.getAttribute("color")).toBe("red");
  });

  it("shows the color of a number value, without a color past the list", () => {
    const lamp = form_lamp({
      colors: [FormColors.Black, FormColors.Yellow, FormColors.Blue],
      value: 2,
    });
    expect(lamp.getAttribute("color")).toBe("blue");
    lamp.value = 5;
    expect(lamp.hasAttribute("color")).toBe(false);
  });

  it("has no color without a value", () => {
    const lamp = form_lamp({ colors: [FormColors.Red, FormColors.Green] });
    expect(lamp.hasAttribute("color")).toBe(false);
  });

  it("applies new colors to the current value", () => {
    const lamp = form_lamp({
      colors: [FormColors.Red, FormColors.Green],
      value: true,
    });
    lamp.colors = [FormColors.Red, FormColors.Blue];
    expect(lamp.getAttribute("color")).toBe("blue");
  });

  it("shows the bound state", () => {
    const state = st.ok_w(false);
    const lamp = form_lamp({ colors: [FormColors.Red, FormColors.Green] });
    document.body.appendChild(lamp);
    lamp.bind({ value: state });
    expect(lamp.getAttribute("color")).toBe("red");
    state.set_ok(true);
    expect(lamp.getAttribute("color")).toBe("green");
  });

  it("removes the color when cleared", () => {
    const lamp = form_lamp({
      colors: [FormColors.Red, FormColors.Green],
      value: true,
    });
    lamp.clear();
    expect(lamp.hasAttribute("color")).toBe(false);
    expect(lamp.get_value.err).toBe(true);
  });

  it("sets text and center", () => {
    const lamp = form_lamp({
      colors: [FormColors.Red, FormColors.Green],
      text: "Power",
      center: true,
    });
    expect(lamp.text).toBe("Power");
    expect(lamp.center).toBe(true);
    lamp.center = false;
    expect(lamp.center).toBe(false);
  });
});

/**Only type checked, never called*/
export function lamp_types() {
  const two = form_lamp({ colors: [FormColors.Red, FormColors.Green] });
  expectTypeOf(two.buffer).toEqualTypeOf<boolean | undefined>();
  const three = form_lamp({
    colors: [FormColors.Red, FormColors.Green, FormColors.Blue],
  });
  expectTypeOf(three.buffer).toEqualTypeOf<number | undefined>();
  // @ts-expect-error A two color lamp has a boolean value
  form_lamp({ colors: [FormColors.Red, FormColors.Green], value: 1 });
  // @ts-expect-error A two color lamp can not show a number state
  two.bind({ value: st.ok_w(1) });
  form_switch({
    change: (value) => expectTypeOf(value).toEqualTypeOf<boolean>(),
  });
  expectTypeOf(form_switch({ id: "power" }).form_id).toEqualTypeOf<"power">();
}
