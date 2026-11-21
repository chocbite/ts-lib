import { err, ok, NiceError } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { AccessTypes } from "#base";
import { FormColors } from "../base";
import { form_errors } from "../errors";
import { form_lamp } from "../boolean/lamp/lamp";
import { form_switch } from "../boolean/switch/switch";
import { form_stepper } from "../number/stepper/stepper";
import { form_text_input } from "../text/input/text_input";

/**A test error whose nice text is its message, so shown texts read as before*/
const nice_err = (text: string) => new NiceError(Symbol(text), text);

/**String helper whose check is a spy, "bad" is rejected*/
const make_helper = () => {
  const [, helper] = st.s.help(ok("a"), {});
  const check = helper.check.bind(helper);
  const check_spy = vi
    .spyOn(helper, "check")
    .mockImplementation((value: string) =>
      value === "bad"
        ? Promise.resolve(err(nice_err("bad is not allowed")))
        : Promise.resolve(check(value)),
    );
  return { helper, check_spy };
};

/**Text input bound to a writable state, attached to the document*/
const make_input = ({ helper }: ReturnType<typeof make_helper>) => {
  const state = st.rosw([ok("a"), helper], true);
  const change = vi.fn();
  const element = form_text_input({ change }).set({ value: state });
  document.body.appendChild(element);
  const input = element.querySelector("input")!;
  const enter = async (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 10));
  };
  return { state, element, input, change, enter };
};

describe("Form value write", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("checks an entered value once", async () => {
    const helper = make_helper();
    const { state, enter } = make_input(helper);
    await enter("b");
    expect(state.ok()).toBe("b");
    expect(helper.check_spy).toHaveBeenCalledTimes(1);
  });

  it("rejects a value the state check fails, without calling change", async () => {
    const helper = make_helper();
    const { state, input, change, enter } = make_input(helper);
    await enter("bad");
    expect(state.ok()).toBe("a");
    expect(input.value).toBe("a");
    expect(change).not.toHaveBeenCalled();
  });

  it("calls change with an accepted value", async () => {
    const { change, enter } = make_input(make_helper());
    await enter("b");
    expect(change).toHaveBeenCalledWith("b");
  });
});

describe("Form value options and binding", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("applies both description and value, the description as a tooltip", () => {
    const element = form_text_input({ description: "Name", value: "x" });
    expect(element.title).toBe("Name");
    expect(element.querySelector("input")!.value).toBe("x");
    element.set({ description: "" });
    expect(element.hasAttribute("title")).toBe(false);
  });

  it("binding a second state releases the first", () => {
    const first = st.ok_w("a");
    const second = st.ok_w("b");
    const element = form_text_input().set({ value: first });
    document.body.appendChild(element);
    element.set({ value: second });
    expect(first.amount()).toBe(0);
    first.set_ok("c");
    expect(element.querySelector("input")!.value).toBe("b");
  });
});

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**Stepper attached to the document, ArrowRight steps it up by one*/
const make_stepper = (options: Parameters<typeof form_stepper>[0] = {}) => {
  const change = vi.fn();
  const element = form_stepper({ change, ...options });
  document.body.appendChild(element);
  const step_up = async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await wait();
  };
  const value_box = element.querySelector(":scope > span > span")!;
  const warn_input = element.querySelector("input")!;
  return { element, change, step_up, value_box, warn_input };
};

describe("Form value buffer", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("get_value fails without a value and gives the value when set", () => {
    const { element } = make_stepper();
    const empty = element.get_value;
    expect(!empty.ok && empty.error.kind).toBe(form_errors.NO_VALUE);
    expect(!empty.ok && empty.error.message).toBe("No value yet");
    element.set({ value: 3 });
    expect(element.get_value.unwrap()).toBe(3);
  });

  it("get_value gives the value of the state it is bound to", () => {
    const { element } = make_stepper();
    element.set({ value: st.ok_w(2) });
    expect(element.get_value.unwrap()).toBe(2);
  });

  it("only user changes mark it changed and call change", async () => {
    const { element, change, step_up } = make_stepper();
    element.set({ value: 3 });
    expect(element.changed).toBe(false);
    expect(change).not.toHaveBeenCalled();
    await step_up();
    expect(element.changed).toBe(true);
    expect(change).toHaveBeenCalledExactlyOnceWith(4);
  });

  it("keeps the value when the change listener throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { element, step_up } = make_stepper({
      value: 1,
      change: () => {
        throw new Error("listener");
      },
    });
    await step_up();
    expect(element.buffer).toBe(2);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("clear empties the value", () => {
    const { element, value_box } = make_stepper({ value: 5 });
    element.clear();
    expect(element.buffer).toBe(undefined);
    expect(value_box.textContent).toBe("");
    element.set({ value: 5 });
    expect(value_box.textContent).toBe("5");
  });

  it("clear does nothing when bound to a state", () => {
    const { element, value_box } = make_stepper();
    element.set({ value: st.ok_w(5) });
    element.clear();
    expect(element.buffer).toBe(5);
    expect(value_box.textContent).toBe("5");
  });

  it("does not show values while the user is editing", () => {
    const state = st.ok_w(1);
    const { element, value_box } = make_stepper();
    element.set({ value: state });
    (value_box as HTMLElement).focus();
    state.set_ok(2);
    expect(value_box.textContent).toBe("1");
    expect(element.buffer).toBe(2);
  });

  it("restores the shown value and warns when the state rejects a write", async () => {
    const state = st.rosw(ok(1), async () => err(new NiceError(Symbol("Rejected"), "Not now")));
    const { element, change, step_up, value_box, warn_input } = make_stepper();
    element.set({ value: state });
    await step_up();
    expect(state.ok()).toBe(1);
    expect(value_box.textContent).toBe("1");
    //The warning has room for the nice text and the message
    expect(warn_input.validationMessage).toBe("Rejected: Not now");
    expect(change).not.toHaveBeenCalled();
  });

  it("warns that a change to an element bound to a read only state is refused, as read only", async () => {
    const { element, step_up, warn_input } = make_stepper();
    element.set({ value: st.ok_w(1).read_only });
    await step_up();
    expect(warn_input.validationMessage).toBe("Read only: The value can not be changed here");
  });

  it("keeps the error of its state as a fault, with its details, for whoever has to fix it", () => {
    const failed = new NiceError(Symbol("Sensor offline"), "No answer from sensor 3");
    const state = st.from_w(1);
    const { element } = make_stepper();
    element.set({ value: state });
    expect(element.faults).toEqual([]);
    state.set_err(failed);
    expect(element.faults).toEqual([failed]);
    state.set_ok(2);
    expect(element.faults).toEqual([]);
  });

  it("removes the tooltip when the description is emptied", () => {
    const { element } = make_stepper({ description: "Speed" });
    expect(element.title).toBe("Speed");
    element.set({ description: "" });
    expect(element.hasAttribute("title")).toBe(false);
  });
});

/**Switch attached to the document, the first element on the pattern inputs of the form base*/
const make_switch = (options: Parameters<typeof form_switch>[0] = {}) => {
  const change = vi.fn();
  const element = document.body.appendChild(form_switch({ change, ...options }));
  const knob = element.querySelector(":scope > div")!;
  const warn_input = element.querySelector("input")!;
  const toggle = async () => {
    element.click();
    await wait();
  };
  return { element, change, knob, warn_input, toggle };
};
const is_on = (knob: Element) => knob.classList.contains("on");

describe("Form value inputs", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("starts at an initial value, the user changes it and the element keeps the change", async () => {
    const { element, change, knob, toggle } = make_switch({ value: true });
    expect(is_on(knob)).toBe(true);
    expect(element.changed).toBe(false);
    await toggle();
    expect(is_on(knob)).toBe(false);
    expect(element.get_value.unwrap()).toBe(false);
    expect(element.changed).toBe(true);
    expect(change).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("set again with an initial value starts over from it", async () => {
    const { element, knob, toggle } = make_switch({ value: true });
    await toggle();
    element.set({ value: true });
    expect(is_on(knob)).toBe(true);
    expect(element.get_value.unwrap()).toBe(true);
  });

  it("keeps the value itself without value or initial, starting without a value", async () => {
    const { element, toggle } = make_switch();
    const empty = element.get_value;
    expect(!empty.ok && empty.error.kind).toBe(form_errors.NO_VALUE);
    await toggle();
    expect(element.get_value.unwrap()).toBe(true);
  });

  it("writes a writable state, and counts as changed by the user", async () => {
    const value = st.ok_w(false);
    const { element, change, knob, toggle } = make_switch({ value });
    expect(is_on(knob)).toBe(false);
    await toggle();
    expect(value.ok()).toBe(true);
    expect(element.get_value.unwrap()).toBe(true);
    expect(element.changed).toBe(true);
    expect(change).toHaveBeenCalledExactlyOnceWith(true);
    value.set_ok(false);
    expect(is_on(knob)).toBe(false);
  });

  it("shows a read only state, a change is refused with a warning", async () => {
    const value = st.ok_w(true);
    const { warn_input, toggle } = make_switch({ value: value.read_only });
    await toggle();
    expect(value.ok()).toBe(true);
    expect(warn_input.validationMessage).toBe("Read only: The value can not be changed here");
  });

  it("set again replaces the value, releasing the state", async () => {
    const first = st.ok_w(true);
    const { element, knob, toggle } = make_switch({ value: first });
    const second = st.ok_w(false);
    element.set({ value: second });
    expect(first.amount()).toBe(0);
    expect(is_on(knob)).toBe(false);
    await toggle();
    expect(second.ok()).toBe(true);
    expect(first.ok()).toBe(true);
    //An initial value after a state is the element's own again, nothing is written
    element.set({ value: false });
    expect(second.amount()).toBe(0);
    await toggle();
    expect(is_on(knob)).toBe(true);
    expect(second.ok()).toBe(true);
  });

  it("shows an error of its state, as a fault, and get_value fails while it lasts", () => {
    const failed = nice_err("Sensor offline");
    const value = st.from_w(true);
    const { element } = make_switch({ value });
    value.set_err(failed);
    expect(element.faults).toEqual([failed]);
    const during = element.get_value;
    //The whole error, with its kind and details, not just its text
    expect(during.err && during.error).toBe(failed);
    value.set_ok(false);
    expect(element.faults).toEqual([]);
    expect(element.get_value.unwrap()).toBe(false);
  });

  it("shows the description as a tooltip, initial or from a state", () => {
    const description = st.ok_w("Turns the radio on");
    const { element } = make_switch({ description: "Radio" });
    expect(element.title).toBe("Radio");
    element.set({ description });
    expect(element.title).toBe("Turns the radio on");
    description.set_ok("");
    expect(element.hasAttribute("title")).toBe(false);
  });

  it("set replaces the change listener", async () => {
    const { element, change, toggle } = make_switch();
    const second = vi.fn();
    element.set({ change: second });
    await toggle();
    expect(change).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("takes the inputs every element has", () => {
    const { element } = make_switch({ access: AccessTypes.Read });
    expect(element.inert).toBe(true);
  });

  it("takes every kind of state as value, read only ones too", () => {
    const compile_only = () => {
      form_switch({ value: st.ok(false) });
      form_switch({ value: st.from(false) });
      form_switch({ value: st.ok_w(false) });
      form_switch({ value: st.ok_w(false).read_only });
      form_stepper({ value: st.ok(1) });
      form_lamp({ value: st.ok(false), colors: [FormColors.Red, FormColors.Green] });
      // @ts-expect-error the value type must match
      form_switch({ value: st.ok(1) });
    };
    expect(compile_only).toBeTypeOf("function");
  });

  it("gets its id at creation, typed for the group", () => {
    const element = form_switch({ id: "power" });
    expect(element.form_id).toBe("power");
    expectTypeOf(element.form_id).toEqualTypeOf<"power">();
    // @ts-expect-error the id is given at creation, the group knows the element by it
    element.set({ id: "other" });
    expect(element.form_id).toBe("power");
  });
});
