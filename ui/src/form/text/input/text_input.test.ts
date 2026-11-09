import { ok } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { form_text_input } from "./text_input";

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**Text input attached to the document, with helpers to simulate the user*/
const make = (options: Parameters<typeof form_text_input>[0] = {}) => {
  const change = vi.fn();
  const element = form_text_input({ change, ...options });
  document.body.appendChild(element);
  const input = element.querySelector("input")!;
  /**Types the text and commits it like the browser does on blur or enter*/
  const enter = async (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event("change"));
    await wait();
  };
  /**Dispatches a cancelable beforeinput event, returns true if it was prevented*/
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
  const key = (key: string) =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  return { element, input, change, enter, before_input, key };
};

describe("Text input max length", () => {
  it("can be removed again", () => {
    const element = form_text_input({ max_length: 5 });
    expect(() => (element.max_length = undefined)).not.toThrow();
    expect(element.max_length).toBeUndefined();
    expect(element.querySelector("input")!.hasAttribute("maxlength")).toBe(
      false,
    );
  });
});

describe("Text input options", () => {
  afterEach(() => document.body.replaceChildren());

  it("creates a text input without options", () => {
    const element = form_text_input();
    const input = element.querySelector("input")!;
    expect(input.type).toBe("text");
    expect(input.value).toBe("");
    expect(element.get_value.err).toBe(true);
  });

  it("applies placeholder, max length, max bytes and filter", () => {
    const filter = /^[a-z]+$/;
    const element = form_text_input({
      placeholder: "Name",
      max_length: 4,
      max_bytes: 8,
      filter,
    });
    const input = element.querySelector("input")!;
    expect(element.placeholder).toBe("Name");
    expect(input.placeholder).toBe("Name");
    expect(element.max_length).toBe(4);
    expect(input.maxLength).toBe(4);
    expect(element.max_bytes).toBe(8);
    expect(element.filter).toBe(filter);
  });

  it("shows the initial value and returns it", () => {
    const element = form_text_input({ value: "hello" });
    expect(element.querySelector("input")!.value).toBe("hello");
    expect(element.buffer).toBe("hello");
    expect(element.get_value.unwrap()).toBe("hello");
  });

  it("keeps the form id", () => {
    expect(form_text_input({ id: "name" }).form_id).toBe("name");
  });
});

describe("Text input user input", () => {
  afterEach(() => document.body.replaceChildren());

  it("stores an entered value and calls change", async () => {
    const { element, change, enter } = make();
    expect(element.changed).toBe(false);
    await enter("abc");
    expect(element.buffer).toBe("abc");
    expect(element.changed).toBe(true);
    expect(element.get_value.unwrap()).toBe("abc");
    expect(change).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledWith("abc");
  });

  it("does not call change when the same value is entered again", async () => {
    const { change, enter } = make({ value: "abc" });
    await enter("abc");
    expect(change).not.toHaveBeenCalled();
  });

  it("rejects a committed value longer than max length and reverts it", async () => {
    const { element, input, change, enter } = make({
      value: "ab",
      max_length: 3,
    });
    await enter("abcdef");
    expect(change).not.toHaveBeenCalled();
    expect(element.buffer).toBe("ab");
    expect(input.value).toBe("ab");
    expect(input.validationMessage).toBe(
      "A maximum of 3 characters is allowed",
    );
  });

  it("rejects a committed value with more bytes than max bytes", async () => {
    const { element, input, change, enter } = make({ max_bytes: 4 });
    await enter("æææ");
    expect(change).not.toHaveBeenCalled();
    expect(element.buffer).toBeUndefined();
    expect(input.value).toBe("");
    expect(input.validationMessage).toBe("A maximum of 4 bytes is allowed");
    await enter("ææ");
    expect(change).toHaveBeenCalledWith("ææ");
  });

  it("blocks characters not matching the filter", () => {
    const { input, before_input } = make({ filter: /^[0-9]+$/ });
    expect(before_input("a")).toBe(true);
    expect(input.validationMessage).toBe("Invalid character entered");
    expect(before_input("5")).toBe(false);
  });

  it("a filter with the global flag gives the same result every time", () => {
    const { before_input } = make({ filter: /^[0-9]+$/g });
    expect(before_input("5")).toBe(false);
    expect(before_input("5")).toBe(false);
    expect(before_input("5")).toBe(false);
  });

  it("blocks typing beyond max length", () => {
    const { input, before_input } = make({ max_length: 3, value: "abc" });
    expect(before_input("d")).toBe(true);
    expect(input.validationMessage).toBe(
      "A maximum of 3 characters is allowed",
    );
  });

  it("blocks typing beyond max bytes", () => {
    const { input, before_input } = make({ max_bytes: 3, value: "ab" });
    expect(before_input("æ")).toBe(true);
    expect(input.validationMessage).toBe("A maximum of 3 bytes is allowed");
    expect(before_input("c")).toBe(false);
  });

  it("allows replacing selected text when at max length", () => {
    const { input, before_input } = make({ max_length: 3, value: "abc" });
    input.focus();
    input.setSelectionRange(0, 3);
    expect(before_input("x")).toBe(false);
  });

  it("allows replacing selected text when at max bytes", () => {
    const { input, before_input } = make({ max_bytes: 3, value: "abc" });
    input.focus();
    input.setSelectionRange(0, 3);
    expect(before_input("x")).toBe(false);
  });

  it("escape reverts the typed text to the value", () => {
    const { input, key } = make({ value: "abc" });
    input.value = "typed";
    key("Escape");
    expect(input.value).toBe("abc");
  });

  it("escape clears the typed text when there is no value", () => {
    const { input, key } = make();
    input.value = "typed";
    key("Escape");
    expect(input.value).toBe("");
  });

  it("escape does not reach parent elements", () => {
    const { element, input } = make();
    const parent = vi.fn();
    document.body.addEventListener("keydown", parent);
    try {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      expect(parent).not.toHaveBeenCalled();
      expect(element.isConnected).toBe(true);
    } finally {
      document.body.removeEventListener("keydown", parent);
    }
  });

  it("clear removes the value", async () => {
    const { element, input, enter } = make();
    await enter("abc");
    element.clear();
    expect(input.value).toBe("");
    expect(element.buffer).toBeUndefined();
    expect(element.get_value.err).toBe(true);
  });

  it("focus focuses the inner input", () => {
    const { element, input } = make();
    element.focus();
    expect(document.activeElement).toBe(input);
  });

  it("a throwing change listener does not stop the value from being set", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { element, enter } = make({
        change: () => {
          throw new Error("listener");
        },
      });
      await enter("abc");
      expect(element.buffer).toBe("abc");
      expect(error).toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});

describe("Text input state", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows the state value and follows changes", async () => {
    const state = st.ok_w("first");
    const { input, element } = make();
    element.bind({ value: state });
    expect(input.value).toBe("first");
    state.set_ok("second");
    await wait();
    expect(input.value).toBe("second");
  });

  it("writes an entered value to the state", async () => {
    const state = st.ok_w("first");
    const { element, change, enter } = make();
    element.bind({ value: state });
    await enter("typed");
    expect(state.ok()).toBe("typed");
    expect(change).toHaveBeenCalledWith("typed");
    expect(element.get_value.err).toBe(true);
    expect(element.changed).toBe(false);
  });

  it("clear does nothing when bound to a state", () => {
    const state = st.ok_w("first");
    const { element, input } = make();
    element.bind({ value: state });
    element.clear();
    expect(input.value).toBe("first");
    expect(element.buffer).toBe("first");
  });

  it("takes max length and max bytes from the state helper", async () => {
    const max_length = st.ok_w(5);
    const max_length_bytes = st.ok_w(10);
    const state = st.rosw(
      st.s.help(ok("a"), { max_length, max_length_bytes }),
      true,
    );
    const { element, input } = make();
    element.bind({ value: state });
    expect(element.max_length).toBe(5);
    expect(input.maxLength).toBe(5);
    expect(element.max_bytes).toBe(10);
    max_length.set_ok(7);
    await wait();
    expect(element.max_length).toBe(7);
  });

  it("does not keep the max length of a previously bound state", () => {
    const state = st.rosw(st.s.help(ok("a"), { max_length: st.ok(2) }), true);
    const { element } = make();
    element.bind({ value: state });
    expect(element.max_length).toBe(2);
    element.bind({ value: st.ok_w("b") });
    expect(element.max_length).toBeUndefined();
  });

  it("shows a state change made while focused once the focus leaves", async () => {
    const state = st.ok_w("first");
    const { element, input } = make();
    element.bind({ value: state });
    input.focus();
    state.set_ok("second");
    await wait();
    expect(input.value).toBe("first");
    input.blur();
    await wait();
    expect(input.value).toBe("second");
  });
});
