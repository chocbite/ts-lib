import form from "#form";
import { none, ok, some, type Option } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { prompts, type PromptFormValues } from "..";

/**The prompt open now*/
const current = () => {
  const panels = document.querySelectorAll("composition-panel");
  return panels[panels.length - 1] as HTMLElement & { close(): void };
};
/**The form button with the text in the open prompt*/
const button = (text: string) =>
  [...current().querySelectorAll<HTMLElement>("*")].find(
    (e) => e.tagName === "FORM-BUTTON" && e.textContent === text,
  )!;
const key = (target: Element, key: string) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

afterEach(() => {
  for (const panel of document.querySelectorAll("composition-panel"))
    (panel as HTMLElement & { close(): void }).close();
});

describe("Prompt buttons", () => {
  it("resolves with the value of the clicked button, then calls its click", async () => {
    const click = vi.fn();
    const result = prompts.buttons("Save?", [
      { text: "Yes", value: 1, click },
      { text: "No", value: 2 },
    ]);
    expect(current().textContent).toContain("Save?");
    button("Yes").click();
    expect(await result).toEqual(some(1));
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector("composition-panel")).toBeNull();
  });

  it("resolves with none when closed with Escape or by the panel", async () => {
    const escaped = prompts.buttons("A", [{ text: "Yes", value: 1 }]);
    key(document.activeElement!, "Escape");
    expect(await escaped).toEqual(none());
    const closed = prompts.buttons("B", [{ text: "Yes", value: 1 }]);
    current().close();
    expect(await closed).toEqual(none());
  });

  it("is a modal panel with a close button, focused when it opens", () => {
    void prompts.buttons("A", [{ text: "Yes", value: 1 }]);
    expect(current().classList.contains("modal")).toBe(true);
    expect(current().querySelector(".close-button")).not.toBeNull();
    expect(current().contains(document.activeElement)).toBe(true);
  });
});

/**The values of a submitted form prompt, fails the test when it was closed without submitting*/
const submitted = async <T extends object>(
  result: Promise<Option<PromptFormValues<T>>>,
) => {
  const answer = await result;
  if (!answer.some) throw new Error("Prompt was not submitted");
  return answer.value;
};

describe("Prompt form", () => {
  it("resolves with values a button gives to close, like a button setting the time to now", async () => {
    const result = prompts.form(
      "Time",
      [form.stepper({ id: "date_time" })],
      [
        { text: "Now", click: (_group, close) => (close({ date_time: 1234 }), true) },
        { text: "OK" },
      ],
    );
    button("Now").click();
    const values = await submitted(result);
    expect(values.get_value).toEqual(ok({ date_time: 1234 }));
    expect(values.value_partial).toEqual(ok({ date_time: 1234 }));
    expect(values.value_changed).toEqual(ok({ date_time: 1234 }));
  });

  it("resolves with the values of the form on submit, all, partial and changed", async () => {
    const swit = form.switch({ id: "on", value: false });
    const result = prompts.form(
      "Settings",
      [swit, form.text_input({ id: "name" })],
      { text: "OK" },
    );
    swit.click();
    await new Promise((r) => setTimeout(r, 0));
    button("OK").click();
    const values = await submitted(result);
    expect(values.value_changed).toEqual(ok({ on: true }));
    expect(values.value_partial).toEqual(ok({ on: true }));
    //The name has no value
    expect(values.get_value.err).toBe(true);
  });

  it("gives get_value when every element has a value", async () => {
    const result = prompts.form(
      "Settings",
      [
        form.switch({ id: "on", value: true }),
        form.text_input({ id: "name", value: "a" }),
      ],
      { text: "OK" },
    );
    button("OK").click();
    const values = await submitted(result);
    expect(values.get_value).toEqual(ok({ on: true, name: "a" }));
    expect(values.value_changed).toEqual(ok({}));
  });

  it("includes live elements bound to a state, their value is written to the state right away", async () => {
    const on = state.ok_w(false);
    const swit = form.switch({ id: "on" }).set({ value: on });
    const result = prompts.form("Settings", [swit], { text: "OK" });
    swit.click();
    await new Promise((r) => setTimeout(r, 0));
    //Written to the state right away, not on submit
    expect(on.ok()).toBe(true);
    button("OK").click();
    const values = await submitted(result);
    expect(values.value_changed).toEqual(ok({ on: true }));
    expect(values.value_partial).toEqual(ok({ on: true }));
    expect(values.get_value).toEqual(ok({ on: true }));
  });

  it("types the values by the ids of the elements", () => {
    const compile_only = () => {
      const result = prompts.form(
        "Settings",
        [
          form.text({ text: "Name" }),
          form.text_input({ id: "name" }),
          form.switch({ id: "on" }),
        ],
        { text: "OK" },
      );
      expectTypeOf(result).toEqualTypeOf<
        Promise<Option<PromptFormValues<{ name: string; on: boolean }>>>
      >();
    };
    expect(compile_only).toBeTypeOf("function");
  });

  it("submits with the last button when Enter is pressed", async () => {
    const last = vi.fn(() => {});
    const result = prompts.form(
      "Settings",
      [form.switch({ id: "on" })],
      [{ text: "First" }, { text: "Last", click: last }],
    );
    key(document.activeElement!, "Enter");
    expect((await result).some).toBe(true);
    expect(last).toHaveBeenCalledTimes(1);
  });

  it("stays open when the click of the button returns true, until it closes itself", async () => {
    for (const submit of [true, false]) {
      let close_with: ((submit: boolean) => void) | undefined;
      const result = prompts.form("Settings", [form.switch({ id: "on" })], {
        text: "OK",
        click: (_values, close) => {
          close_with = close;
          return true;
        },
      });
      button("OK").click();
      expect(current()).not.toBeUndefined();
      close_with!(submit);
      expect((await result).some).toBe(submit);
    }
  });

  it("submits with Enter while a switch has the focus, without toggling it", async () => {
    const result = prompts.form("Settings", [form.switch({ id: "on" })], {
      text: "OK",
    });
    key(document.activeElement!, "Enter");
    expect((await submitted(result)).value_changed).toEqual(ok({}));
  });

  it("closes with Escape while a number input has the focus", async () => {
    const result = prompts.form(
      "Settings",
      [form.number_input({ id: "count", value: 3 })],
      { text: "OK" },
    );
    key(document.activeElement!, "Escape");
    expect(await result).toEqual(none());
  });

  it("closes with Escape while a text input has the focus", async () => {
    const result = prompts.form("Settings", [form.text_input({ id: "name" })], {
      text: "OK",
    });
    key(document.activeElement!, "Escape");
    expect(await result).toEqual(none());
  });

  it("focuses the first element the user can change when it opens, after labels", () => {
    const input = form.text_input({ id: "name" });
    void prompts.form("Settings", [form.text({ text: "Name" }), input], {
      text: "OK",
    });
    expect(input.contains(document.activeElement)).toBe(true);
  });
});

/**The answer of the prompt, or "open" when it is still open a while later*/
const answer_or_open = <T>(result: Promise<T>) =>
  Promise.race([
    result,
    new Promise<"open">((r) => setTimeout(() => r("open"), 500)),
  ]);

//Real input through the browser, a click moves the focus out of the field before it clicks,
//as a user does, and comes right after the press, before a timer of the page can run
describe("Prompt form, typed numbers", () => {
  const typed = [
    ["number input", () => form.number_input({ id: "count", value: 3 })],
    ["stepper", () => form.stepper({ id: "count", value: 3 })],
  ] as const;

  /**Opens a prompt with the element and types 7 over its value,
   * the answer of the prompt is in an object, returning the promise itself would wait for the answer*/
  const type_seven = async (element: (typeof typed)[number][1]) => {
    const result = prompts.form("Count", [element()], { text: "OK" });
    await userEvent.click(
      current().querySelector<HTMLElement>("span[contenteditable]")!,
    );
    await userEvent.keyboard("{Control>}a{/Control}7");
    return { result };
  };

  for (const [name, element] of typed) {
    it(`submits the number typed in a ${name} when the button is clicked`, async () => {
      const { result } = await type_seven(element);
      //No timer runs before the click, like a tap, which clicks right after the field loses the focus,
      //and a mouse click on slow hardware
      vi.useFakeTimers({ toFake: ["setTimeout"] });
      try {
        await userEvent.click(button("OK"));
      } finally {
        vi.useRealTimers();
      }
      expect(await answer_or_open(result)).not.toBe("open");
      expect((await submitted(result)).value_changed).toEqual(ok({ count: 7 }));
    });

    it(`submits the number typed in a ${name} with Enter`, async () => {
      const { result } = await type_seven(element);
      await userEvent.keyboard("{Enter}");
      expect(await answer_or_open(result)).not.toBe("open");
      expect((await submitted(result)).value_changed).toEqual(ok({ count: 7 }));
    });
  }
});

describe("Prompt focus", () => {
  /**A focused button on the page, where the prompt is opened from*/
  const opener = () => {
    const element = document.body.appendChild(document.createElement("button"));
    element.focus();
    return element;
  };
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("goes back to the element that had it, when closed by a button, Escape or the cross", async () => {
    const element = opener();
    const by_button = prompts.buttons("A", [{ text: "Yes", value: 1 }]);
    expect(document.activeElement).not.toBe(element);
    button("Yes").click();
    await by_button;
    expect(document.activeElement).toBe(element);

    const by_escape = prompts.buttons("B", [{ text: "Yes", value: 1 }]);
    key(document.activeElement!, "Escape");
    await by_escape;
    expect(document.activeElement).toBe(element);

    const by_cross = prompts.buttons("C", [{ text: "Yes", value: 1 }]);
    current().close();
    await by_cross;
    expect(document.activeElement).toBe(element);
  });

  it("goes back after a form prompt submits", async () => {
    const element = opener();
    const result = prompts.form("Settings", [form.text_input({ id: "name" })], {
      text: "OK",
    });
    button("OK").click();
    await result;
    expect(document.activeElement).toBe(element);
  });

  it("is kept where the click of the button moved it", async () => {
    opener();
    const other = document.body.appendChild(document.createElement("input"));
    const result = prompts.buttons("A", [
      { text: "Yes", value: 1, click: () => other.focus() },
    ]);
    button("Yes").click();
    await result;
    expect(document.activeElement).toBe(other);
  });

  it("goes back to the first element when a second prompt opens from a button", async () => {
    const element = opener();
    let second: Promise<unknown> | undefined;
    const first = prompts.buttons("A", [
      {
        text: "Next",
        value: 1,
        click: () => {
          second = prompts.buttons("B", [{ text: "Done", value: 2 }]);
        },
      },
    ]);
    button("Next").click();
    await first;
    expect(current()).not.toBeUndefined();
    button("Done").click();
    await second;
    expect(document.activeElement).toBe(element);
  });

  it("is not given to an element removed while the prompt was open", async () => {
    const element = opener();
    const result = prompts.buttons("A", [{ text: "Yes", value: 1 }]);
    element.remove();
    button("Yes").click();
    await result;
    expect(document.activeElement).toBe(document.body);
  });
});
