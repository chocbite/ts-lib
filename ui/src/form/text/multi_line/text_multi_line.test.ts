import { theme_init } from "#theme";
import { ok } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { form_text_multiline } from "./text_multi_line";

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**Multi line input attached to the document, with helpers to simulate the user*/
const make = (options: Parameters<typeof form_text_multiline>[0] = {}) => {
  const change = vi.fn();
  const element = form_text_multiline({ change, ...options });
  document.body.appendChild(element);
  const area = element.querySelector("textarea")!;
  const warn = element.querySelector("input")!;
  const enter = async (text: string) => {
    area.value = text;
    area.dispatchEvent(new Event("change"));
    await wait();
  };
  const before_input = (data: string) => {
    const event = new InputEvent("beforeinput", {
      data,
      inputType: "insertText",
      cancelable: true,
      bubbles: true,
    });
    area.dispatchEvent(event);
    return event.defaultPrevented;
  };
  const key = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    area.dispatchEvent(event);
    return event;
  };
  return { element, area, warn, change, enter, before_input, key };
};

describe("Text multiline options", () => {
  afterEach(() => document.body.replaceChildren());

  it("creates a textarea, a resizer and a warning input", () => {
    const { element, area, warn } = make();
    expect(area).not.toBeNull();
    expect(warn).not.toBeNull();
    expect(element.querySelector("div > svg")).not.toBeNull();
  });

  it("applies placeholder, max length and max bytes", () => {
    const { element, area } = make({
      placeholder: "Notes",
      max_length: 10,
      max_bytes: 20,
    });
    expect(element.placeholder).toBe("Notes");
    expect(area.placeholder).toBe("Notes");
    expect(element.max_length).toBe(10);
    expect(area.maxLength).toBe(10);
    expect(element.max_bytes).toBe(20);
  });

  it("applies the filter option", () => {
    const filter = /^[0-9]+$/;
    const element = form_text_multiline({ filter });
    expect(element.filter).toBe(filter);
  });

  it("max length can be removed again", () => {
    const element = form_text_multiline({ max_length: 5 });
    expect(() => (element.max_length = undefined)).not.toThrow();
    expect(element.max_length).toBeUndefined();
    expect(element.querySelector("textarea")!.hasAttribute("maxlength")).toBe(
      false,
    );
  });

  it("shows the initial value", () => {
    const { area, element } = make({ value: "line 1\nline 2" });
    expect(area.value).toBe("line 1\nline 2");
    expect(element.get_value.unwrap()).toBe("line 1\nline 2");
  });

  it("focus focuses the textarea", () => {
    const { element, area } = make();
    element.focus();
    expect(document.activeElement).toBe(area);
  });

  it("sizes the textarea from the themed form height", () => {
    theme_init();
    const { area } = make();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    //$size_height - 0.2rem in the styles, 1.3rem - 0.2rem with the default theme
    expect(parseFloat(getComputedStyle(area).minHeight)).toBeCloseTo(
      1.1 * rem,
      0,
    );
  });
});

describe("Text multiline user input", () => {
  afterEach(() => document.body.replaceChildren());

  it("stores an entered value and calls change", async () => {
    const { element, change, enter } = make();
    await enter("a\nb");
    expect(element.buffer).toBe("a\nb");
    expect(element.changed).toBe(true);
    expect(change).toHaveBeenCalledWith("a\nb");
  });

  it("ctrl enter commits the value", async () => {
    const { element, area, change, key } = make();
    area.value = "typed";
    const event = key({ key: "Enter", ctrlKey: true });
    await wait();
    expect(event.defaultPrevented).toBe(true);
    expect(element.buffer).toBe("typed");
    expect(change).toHaveBeenCalledWith("typed");
  });

  it("enter for a new line does not reach parent elements", () => {
    const { key } = make();
    const parent = vi.fn();
    document.body.addEventListener("keydown", parent);
    try {
      key({ key: "Enter" });
      expect(parent).not.toHaveBeenCalled();
    } finally {
      document.body.removeEventListener("keydown", parent);
    }
  });

  it("escape reverts the typed text", () => {
    const { area, key } = make({ value: "abc" });
    area.value = "typed";
    const event = key({ key: "Escape" });
    expect(event.defaultPrevented).toBe(true);
    expect(area.value).toBe("abc");
  });

  it("escape clears the typed text when there is no value", () => {
    const { area, key } = make();
    area.value = "typed";
    key({ key: "Escape" });
    expect(area.value).toBe("");
  });

  it("rejects a committed value longer than max length", async () => {
    const { element, area, warn, change, enter } = make({
      value: "ab",
      max_length: 3,
    });
    await enter("abcdef");
    expect(change).not.toHaveBeenCalled();
    expect(element.buffer).toBe("ab");
    expect(area.value).toBe("ab");
    expect(warn.validationMessage).toBe("A maximum of 3 characters is allowed");
  });

  it("rejects a committed value with more bytes than max bytes", async () => {
    const { change, warn, enter } = make({ max_bytes: 4 });
    await enter("æææ");
    expect(change).not.toHaveBeenCalled();
    expect(warn.validationMessage).toBe("A maximum of 4 bytes is allowed");
  });

  it("blocks characters not matching the filter", () => {
    const { element, warn, before_input } = make();
    element.filter = /^[0-9]+$/;
    expect(before_input("a")).toBe(true);
    expect(warn.validationMessage).toBe("Invalid character entered");
    expect(before_input("1")).toBe(false);
  });

  it("a filter with the global flag gives the same result every time", () => {
    const { before_input } = make({ filter: /^[0-9]+$/g });
    expect(before_input("1")).toBe(false);
    expect(before_input("1")).toBe(false);
    expect(before_input("1")).toBe(false);
  });

  it("blocks typing beyond max length and max bytes", () => {
    const { before_input, element } = make({ max_length: 3, value: "abc" });
    expect(before_input("d")).toBe(true);
    element.max_length = 10;
    element.max_bytes = 4;
    expect(before_input("æ")).toBe(true);
    expect(before_input("d")).toBe(false);
  });

  it("allows replacing selected text when at max length", () => {
    const { area, before_input } = make({ max_length: 3, value: "abc" });
    area.focus();
    area.setSelectionRange(0, 3);
    expect(before_input("x")).toBe(false);
  });

  it("dragging the resizer changes the height of the textarea", () => {
    const { element, area } = make();
    const resizer = element.querySelector("textarea + div") as HTMLDivElement;
    resizer.setPointerCapture = () => {};
    resizer.releasePointerCapture = () => {};
    const start = area.getBoundingClientRect().height;
    resizer.dispatchEvent(
      new PointerEvent("pointerdown", { clientY: 100, cancelable: true }),
    );
    resizer.dispatchEvent(new PointerEvent("pointermove", { clientY: 150 }));
    //The browser rounds fractional pixels when serializing the style
    expect(parseFloat(area.style.height)).toBeCloseTo(start + 50, 3);
    resizer.dispatchEvent(new PointerEvent("pointerup", { clientY: 150 }));
    resizer.dispatchEvent(new PointerEvent("pointermove", { clientY: 300 }));
    expect(parseFloat(area.style.height)).toBeCloseTo(start + 50, 3);
  });
});

describe("Text multiline state", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows the state value and writes entered values", async () => {
    const state = st.ok_w("first");
    const { element, area, change, enter } = make();
    element.bind({ value: state });
    expect(area.value).toBe("first");
    await enter("second");
    expect(state.ok()).toBe("second");
    expect(change).toHaveBeenCalledWith("second");
    state.set_ok("third");
    await wait();
    expect(area.value).toBe("third");
  });

  it("takes max length and max bytes from the state helper", () => {
    const state = st.rosw(
      st.s.help(ok("a"), {
        max_length: st.ok(5),
        max_length_bytes: st.ok(9),
      }),
      true,
    );
    const { element, area } = make();
    element.bind({ value: state });
    expect(element.max_length).toBe(5);
    expect(area.maxLength).toBe(5);
    expect(element.max_bytes).toBe(9);
  });

  it("shows a state change made while focused once the focus leaves", async () => {
    const state = st.ok_w("first");
    const { element, area } = make();
    element.bind({ value: state });
    area.focus();
    state.set_ok("second");
    await wait();
    expect(area.value).toBe("first");
    area.blur();
    await wait();
    expect(area.value).toBe("second");
  });
});
