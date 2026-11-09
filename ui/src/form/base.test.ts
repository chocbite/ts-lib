import { err, ok } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { form_stepper } from "./number/stepper/stepper";
import { form_text_input } from "./text/input/text_input";

/**String helper whose check is a spy, "bad" is rejected*/
const make_helper = () => {
  const [, helper] = st.s.help(ok("a"), {});
  const check = helper.check.bind(helper);
  const check_spy = vi
    .spyOn(helper, "check")
    .mockImplementation((value: string) =>
      value === "bad"
        ? Promise.resolve(err("bad is not allowed"))
        : Promise.resolve(check(value)),
    );
  return { helper, check_spy };
};

/**Text input bound to a writable state, attached to the document*/
const make_input = ({ helper }: ReturnType<typeof make_helper>) => {
  const state = st.rosw([ok("a"), helper], true);
  const change = vi.fn();
  const element = form_text_input({ change }).bind({ value: state });
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
    expect(element.description).toBe("Name");
    expect(element.title).toBe("Name");
    expect(element.querySelector("input")!.value).toBe("x");
    element.description = "";
    expect(element.hasAttribute("title")).toBe(false);
  });

  it("binding a second state releases the first", () => {
    const first = st.ok_w("a");
    const second = st.ok_w("b");
    const element = form_text_input().bind({ value: first });
    document.body.appendChild(element);
    element.bind({ value: second });
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
    expect(empty.err && empty.error).toBe("No value yet");
    element.value = 3;
    expect(element.get_value.unwrap()).toBe(3);
  });

  it("get_value fails when bound to a state", () => {
    const { element } = make_stepper();
    element.bind({ value: st.ok_w(2) });
    const value = element.get_value;
    expect(value.err && value.error).toBe("State based component");
    expect(element.buffer).toBe(2);
  });

  it("only user changes mark it changed and call change", async () => {
    const { element, change, step_up } = make_stepper();
    element.value = 3;
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
    element.value = 5;
    expect(value_box.textContent).toBe("5");
  });

  it("clear does nothing when bound to a state", () => {
    const { element, value_box } = make_stepper();
    element.bind({ value: st.ok_w(5) });
    element.clear();
    expect(element.buffer).toBe(5);
    expect(value_box.textContent).toBe("5");
  });

  it("does not show values while the user is editing", () => {
    const state = st.ok_w(1);
    const { element, value_box } = make_stepper();
    element.bind({ value: state });
    (value_box as HTMLElement).focus();
    state.set_ok(2);
    expect(value_box.textContent).toBe("1");
    expect(element.buffer).toBe(2);
  });

  it("restores the shown value and warns when the state rejects a write", async () => {
    const state = st.rosw(ok(1), async () => err("Not now"));
    const { element, change, step_up, value_box, warn_input } = make_stepper();
    element.bind({ value: state });
    await step_up();
    expect(state.ok()).toBe(1);
    expect(value_box.textContent).toBe("1");
    expect(warn_input.validationMessage).toBe("Not now");
    expect(change).not.toHaveBeenCalled();
  });

  it("removes the tooltip when the description is emptied", () => {
    const { element } = make_stepper({ description: "Speed" });
    expect(element.title).toBe("Speed");
    element.description = "";
    expect(element.description).toBe("");
    expect(element.hasAttribute("title")).toBe(false);
  });
});
