import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { form_password } from "./password_input";

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const make = (options: Parameters<typeof form_password>[0] = {}) => {
  const change = vi.fn();
  const element = form_password({ change, ...options });
  document.body.appendChild(element);
  const input = element.querySelector("input")!;
  const enter = async (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event("change"));
    await wait();
  };
  const before_input = (data: string) => {
    const event = new InputEvent("beforeinput", {
      data,
      inputType: "insertText",
      cancelable: true,
      bubbles: true,
    });
    input.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { element, input, change, enter, before_input };
};

describe("Password input", () => {
  afterEach(() => document.body.replaceChildren());

  it("uses a password input", () => {
    const { input } = make();
    expect(input.type).toBe("password");
  });

  it("shows the initial value hidden in the input", () => {
    const { input, element } = make({ value: "secret" });
    expect(input.value).toBe("secret");
    expect(element.get_value.unwrap()).toBe("secret");
  });

  it("clears the input on focus so a new password can be typed", () => {
    const { input, element } = make({ value: "secret" });
    input.focus();
    expect(input.value).toBe("");
    expect(element.buffer).toBe("secret");
  });

  it("restores the password when the focus leaves without typing", () => {
    const { input, element } = make({ value: "secret" });
    input.focus();
    input.blur();
    expect(input.value).toBe("secret");
    expect(element.buffer).toBe("secret");
  });

  it("keeps an entered password after the focus leaves", async () => {
    const { input, element, change } = make({ value: "secret" });
    input.focus();
    input.value = "new";
    input.dispatchEvent(new Event("change"));
    input.blur();
    await wait();
    expect(input.value).toBe("new");
    expect(element.buffer).toBe("new");
    expect(change).toHaveBeenCalledWith("new");
  });

  it("stores an entered password and calls change", async () => {
    const { element, change, enter } = make();
    await enter("hunter2");
    expect(element.buffer).toBe("hunter2");
    expect(element.changed).toBe(true);
    expect(change).toHaveBeenCalledWith("hunter2");
  });

  it("blocks characters not matching the filter", () => {
    const { input, before_input } = make({ filter: /^[a-z]+$/ });
    expect(before_input("1")).toBe(true);
    expect(input.validationMessage).toBe("Invalid character entered");
    expect(before_input("a")).toBe(false);
  });

  it("a filter with the global flag gives the same result every time", () => {
    const { before_input } = make({ filter: /^[a-z]+$/g });
    expect(before_input("a")).toBe(false);
    expect(before_input("a")).toBe(false);
    expect(before_input("a")).toBe(false);
  });

  it("allows any character without a filter", () => {
    const { before_input } = make();
    expect(before_input("%")).toBe(false);
  });

  it("clear removes the value", async () => {
    const { element, input, enter } = make();
    await enter("abc");
    element.clear();
    expect(input.value).toBe("");
    expect(element.buffer).toBeUndefined();
  });

  it("writes an entered password to a bound state", async () => {
    const state = st.ok_w("old");
    const { element, change, enter } = make();
    element.bind({ value: state });
    await enter("new");
    expect(state.ok()).toBe("new");
    expect(change).toHaveBeenCalledWith("new");
  });

  it("does not overwrite the typed password with a state change while focused", async () => {
    const state = st.ok_w("old");
    const { element, input } = make();
    element.bind({ value: state });
    input.focus();
    input.value = "typing";
    state.set_ok("other");
    await wait();
    expect(input.value).toBe("typing");
  });
});
