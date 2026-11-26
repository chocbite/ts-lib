import { DOCUMENT_HANDLER } from "#document";
import { material_close_rounded, material_home_rounded } from "#icons";
import { theme_init } from "#theme";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { form_dropdown } from "../selectors/drop_down/drop_down";
import { form_dropdown_multi } from "../selectors/drop_down/drop_down_multi";

//The field sizes and fonts come from the theme
theme_init();

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const SELECTIONS = [
  { value: 1, text: "One" },
  { value: 2, text: "Two", icon: material_close_rounded },
  { value: 3, text: "Three" },
];

const box = () => document.querySelector("form-dropdownbox")!;
/**Option lines of the open popup*/
const lines = () =>
  Array.from(
    box().firstElementChild!.firstElementChild!.firstElementChild!.children,
  ) as HTMLDivElement[];

const make = (
  options: Parameters<typeof form_dropdown<number, undefined>>[0] = {},
) => {
  const change = vi.fn();
  const element = form_dropdown<number, undefined>({
    selections: SELECTIONS,
    change,
    ...options,
  });
  document.body.appendChild(element);
  const text = () =>
    element.firstElementChild!.matches("svg")
      ? element.children[1].textContent
      : element.children[0].textContent;
  const key = (target: HTMLElement, key: string) => {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  };
  return { element, change, text, key };
};

describe("Dropdown", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("marks the list as scrolling when the options do not fit", () => {
    const element = form_dropdown({
      selections: Array.from({ length: 200 }, (_value, index) => ({
        value: index,
        text: "Option " + index,
      })),
    });
    document.body.appendChild(element);
    element.open = true;
    const box = document.querySelector("form-dropdownbox")!;
    expect(box.querySelector(".scroll")).not.toBeNull();
    element.open = false;
  });

  it("opens in the document the dropdown is in", () => {
    const frame = document.body.appendChild(document.createElement("iframe"));
    const frame_document = frame.contentDocument!;
    DOCUMENT_HANDLER.register_document(frame_document);
    try {
      const element = form_dropdown({
        selections: [{ value: 1, text: "One" }],
      });
      frame_document.body.appendChild(element);
      element.open = true;
      const frame_box = frame_document.querySelector("form-dropdownbox");
      expect(frame_box?.classList.contains("open")).toBe(true);
      const main_box = document.querySelector("form-dropdownbox")!;
      expect(main_box.classList.contains("open")).toBe(false);
      element.open = false;
      expect(frame_box?.classList.contains("open")).toBe(false);
    } finally {
      DOCUMENT_HANDLER.deregister_document(frame_document);
    }
  });
});

describe("Dropdown display", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows the default text until something is selected", () => {
    const { text, element } = make();
    expect(text()).toBe("Select something");
    expect(element.tabIndex).toBe(0);
  });

  it("uses the default text option", () => {
    const { text, element } = make({ default: "Pick one" });
    expect(text()).toBe("Pick one");
    element.set({ default: "Other" });
    expect(text()).toBe("Other");
  });

  it("shows the default icon while nothing is selected", () => {
    const { element } = make({ default_icon: material_home_rounded });
    expect(element.firstElementChild!.getAttribute("icon")).toBe(
      "material_home_rounded",
    );
  });

  it("shows the text and icon of the selected value", () => {
    const { element, text } = make({ value: 2 });
    expect(text()).toBe("Two");
    expect(element.firstElementChild!.getAttribute("icon")).toBe(
      "material_close_rounded",
    );
    element.set({ value: 1 });
    expect(text()).toBe("One");
    expect(element.firstElementChild!.matches("svg[icon]")).toBe(false);
  });

  it("returns to the default icon when the value is not in the selections", () => {
    const { element, text } = make({
      value: 2,
      default_icon: material_home_rounded,
    });
    element.set({ value: 99 });
    expect(text()).toBe("Select something");
    expect(element.firstElementChild!.getAttribute("icon")).toBe(
      "material_home_rounded",
    );
  });

  it("shows the default when the value is not in the selections", () => {
    const { element, text } = make({ value: 1 });
    element.set({ value: 99 });
    expect(text()).toBe("Select something");
    expect(element.firstElementChild!.matches("svg[icon]")).toBe(false);
  });

  it("updates the text when the selections are replaced", () => {
    const { element, text } = make({ value: 1 });
    element.set({ selections: [{ value: 1, text: "Uno" }] });
    expect(text()).toBe("Uno");
    element.set({ selections: [{ value: 2, text: "Dos" }] });
    expect(text()).toBe("Select something");
  });

  it("clear shows the default", () => {
    const { element, text } = make({ value: 1 });
    element.clear();
    expect(text()).toBe("Select something");
    expect(element.buffer).toBeUndefined();
  });

  it("is as high as a field, the single and the multi dropdown", () => {
    const { element } = make({ value: 1 });
    const multi = document.body.appendChild(
      form_dropdown_multi<number, undefined>({
        selections: SELECTIONS,
        value: [1],
      }),
    );
    expect(element.getBoundingClientRect().height).toBe(24);
    expect(multi.getBoundingClientRect().height).toBe(24);
    multi.remove();
  });

  it("breaks a word wider than the field, keeping the chevron inside", () => {
    const { element } = make({
      selections: [{ value: 1, text: "Pneumonoultramicroscopic" }],
      value: 1,
    });
    element.style.width = "6rem";
    const field = element.getBoundingClientRect();
    const text = element.querySelector(":scope > div")!.getBoundingClientRect();
    const chevron = element
      .querySelector(":scope > svg:nth-last-child(2)")!
      .getBoundingClientRect();
    expect(text.right).toBeLessThanOrEqual(chevron.left);
    expect(chevron.right).toBeLessThanOrEqual(field.right);
  });
});

describe("Dropdown popup", () => {
  afterEach(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.replaceChildren();
  });

  it("lists the options and marks and focuses the selected one", () => {
    const { element } = make({ value: 3 });
    element.open = true;
    expect(box().classList.contains("open")).toBe(true);
    expect(lines().map((line) => line.textContent)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
    expect(lines()[1].querySelector("svg")).not.toBeNull();
    expect(lines()[2].classList.contains("selected")).toBe(true);
    expect(document.activeElement).toBe(lines()[2]);
    element.open = false;
    expect(box().classList.contains("open")).toBe(false);
  });

  it("swaps the arrow icon while open", () => {
    const { element } = make();
    expect(element.querySelector("svg")!.getAttribute("icon")).toBe(
      "material_keyboard_arrow_down_rounded",
    );
    element.open = true;
    expect(element.querySelector("svg")!.getAttribute("icon")).toBe(
      "material_unfold_less_rounded",
    );
    element.open = false;
    expect(element.querySelector("svg")!.getAttribute("icon")).toBe(
      "material_keyboard_arrow_down_rounded",
    );
  });

  it("clicking an option selects it, closes the popup and focuses the dropdown", async () => {
    const { element, change, text } = make();
    element.open = true;
    lines()[1].click();
    await wait();
    expect(change).toHaveBeenCalledWith(2);
    expect(element.buffer).toBe(2);
    expect(text()).toBe("Two");
    expect(box().classList.contains("open")).toBe(false);
    expect(document.activeElement).toBe(element);
  });

  it("enter on an option selects it", async () => {
    const { element, change, key } = make();
    element.open = true;
    key(lines()[2], "Enter");
    await wait();
    expect(change).toHaveBeenCalledWith(3);
  });

  it("escape closes the popup without selecting", async () => {
    const { element, change, key } = make();
    element.open = true;
    key(lines()[0], "Escape");
    await wait();
    expect(box().classList.contains("open")).toBe(false);
    expect(change).not.toHaveBeenCalled();
    element.open = true;
    expect(box().classList.contains("open")).toBe(true);
  });

  it("arrow keys move the focus between options", () => {
    const { element, key } = make({ value: 1 });
    element.open = true;
    key(lines()[0], "ArrowDown");
    expect(document.activeElement).toBe(lines()[1]);
    key(lines()[1], "ArrowUp");
    expect(document.activeElement).toBe(lines()[0]);
  });

  it("enter, space and click open the popup", () => {
    const { element, key } = make();
    expect(key(element, "Enter").defaultPrevented).toBe(true);
    expect(box().classList.contains("open")).toBe(true);
    element.open = false;
    key(element, " ");
    expect(box().classList.contains("open")).toBe(true);
    element.open = false;
    element.click();
    expect(box().classList.contains("open")).toBe(true);
    element.open = false;
  });

  it("closes when the focus leaves the popup", () => {
    const { element } = make();
    const other = document.body.appendChild(document.createElement("button"));
    element.open = true;
    other.focus();
    expect(box().classList.contains("open")).toBe(false);
  });

  it("replacing the selections closes the popup", () => {
    const { element } = make();
    element.open = true;
    element.set({ selections: [{ value: 5, text: "Five" }] });
    expect(box().classList.contains("open")).toBe(false);
  });

  it("opening another dropdown closes the first", () => {
    const first = make();
    const second = make({ selections: [{ value: 9, text: "Nine" }] });
    first.element.open = true;
    second.element.open = true;
    expect(box().classList.contains("open")).toBe(true);
    expect(lines().map((line) => line.textContent)).toEqual(["Nine"]);
    expect(first.element.querySelector("svg")!.getAttribute("icon")).toBe(
      "material_keyboard_arrow_down_rounded",
    );
    second.element.open = false;
    first.element.open = true;
    expect(lines().map((line) => line.textContent)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
    first.element.open = false;
  });
});

describe("Dropdown keyboard selection", () => {
  afterEach(() => document.body.replaceChildren());

  it("arrow down and up select the adjacent option and stop at the ends", async () => {
    const { element, key, change } = make();
    key(element, "ArrowDown");
    await wait();
    expect(change).toHaveBeenLastCalledWith(1);
    key(element, "ArrowDown");
    await wait();
    key(element, "ArrowDown");
    await wait();
    key(element, "ArrowDown");
    await wait();
    expect(element.buffer).toBe(3);
    key(element, "ArrowUp");
    await wait();
    expect(element.buffer).toBe(2);
    expect(change).toHaveBeenCalledTimes(4);
  });

  it("arrow keys do nothing without selections", async () => {
    const { element, key, change } = make({ selections: [] });
    key(element, "ArrowDown");
    await wait();
    expect(change).not.toHaveBeenCalled();
  });
});

describe("Dropdown state", () => {
  afterEach(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.replaceChildren();
  });

  it("follows and writes a bound state", async () => {
    const state = st.ok_w(1);
    const { element, text } = make();
    element.set({ value: state });
    expect(text()).toBe("One");
    element.open = true;
    lines()[2].click();
    await wait();
    expect(state.ok()).toBe(3);
    state.set_ok(2);
    await wait();
    expect(text()).toBe("Two");
  });

  it("shows the warning of a refused option after the popup closed and focused the dropdown", async () => {
    const { element, text } = make({ value: st.ok_w(1).read_only });
    const warn_input = element.querySelector("input")!;
    //The order of focus changes and warnings shown, the last one is what the user sees
    const events: string[] = [];
    const report = warn_input.reportValidity.bind(warn_input);
    warn_input.reportValidity = () => {
      if (warn_input.validationMessage) events.push("warning");
      return report();
    };
    const listening = new AbortController();
    document.addEventListener("focusin", () => events.push("focus"), {
      signal: listening.signal,
    });
    element.open = true;
    await userEvent.click(lines()[2]);
    await wait(50);
    listening.abort();
    expect(text()).toBe("One");
    expect(document.activeElement).toBe(element);
    expect(events).toContain("warning");
    expect(events.at(-1)).toBe("warning");
  });
});
