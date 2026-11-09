import { material_close_rounded } from "#icons";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { form_toggle_button } from "./toggle_button";

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const SELECTIONS = [
  { value: 1, text: "One" },
  { value: 2, text: "Two" },
  { value: 3, text: "Three" },
];

const make = (
  options: Parameters<typeof form_toggle_button<number, undefined>>[0] = {},
) => {
  const change = vi.fn();
  const element = form_toggle_button<number, undefined>({
    selections: SELECTIONS,
    change,
    ...options,
  });
  document.body.appendChild(element);
  /**Top divs of the options, the bottom divs are the next siblings*/
  const tops = () =>
    Array.from(element.querySelectorAll(":scope > div")).filter(
      (_div, index) => index % 2 === 0,
    ) as HTMLDivElement[];
  const selected = () =>
    tops().findIndex((top) => top.classList.contains("selected"));
  const key = (target: HTMLElement, key: string) => {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  };
  return { element, change, tops, selected, key };
};

describe("Toggle button", () => {
  afterEach(() => document.body.replaceChildren());

  it("creates a top and bottom for each selection", () => {
    const { element, tops } = make();
    expect(element.querySelectorAll(":scope > div").length).toBe(6);
    expect(tops().map((top) => top.textContent)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
    expect(tops().every((top) => top.tabIndex === 0)).toBe(true);
  });

  it("shows the icon on top and the text below when an icon is given", () => {
    const { tops } = make({
      selections: [{ value: 1, text: "Close", icon: material_close_rounded }],
    });
    const top = tops()[0];
    expect(top.querySelector("svg")).not.toBeNull();
    expect((top.nextElementSibling as HTMLElement).textContent).toBe("Close");
  });

  it("marks the initial value as selected", () => {
    const { tops, selected } = make({ value: 2 });
    expect(selected()).toBe(1);
    expect(tops()[1].nextElementSibling!.classList.contains("selected")).toBe(
      true,
    );
  });

  it("clicking an option selects it and calls change", async () => {
    const { element, tops, selected, change } = make({ value: 1 });
    tops()[2].click();
    await wait();
    expect(selected()).toBe(2);
    expect(element.buffer).toBe(3);
    expect(change).toHaveBeenCalledWith(3);
  });

  it("clicking the text below an icon selects the option", async () => {
    const { tops, change } = make({
      selections: [
        { value: 1, text: "A", icon: material_close_rounded },
        { value: 2, text: "B", icon: material_close_rounded },
      ],
    });
    (tops()[1].nextElementSibling as HTMLElement).click();
    await wait();
    expect(change).toHaveBeenCalledWith(2);
  });

  it("clicking the selected option does not call change", async () => {
    const { tops, change } = make({ value: 1 });
    tops()[0].click();
    await wait();
    expect(change).not.toHaveBeenCalled();
  });

  it("enter and space select the focused option", async () => {
    const { tops, change, key } = make();
    expect(key(tops()[1], "Enter").defaultPrevented).toBe(true);
    await wait();
    expect(change).toHaveBeenLastCalledWith(2);
    key(tops()[2], " ");
    await wait();
    expect(change).toHaveBeenLastCalledWith(3);
  });

  it("arrow keys select the adjacent option and stop at the ends", async () => {
    const { tops, selected, key } = make({ value: 2 });
    key(tops()[1], "ArrowRight");
    await wait();
    expect(selected()).toBe(2);
    key(tops()[2], "ArrowRight");
    await wait();
    expect(selected()).toBe(2);
    key(tops()[2], "ArrowLeft");
    await wait();
    key(tops()[1], "ArrowLeft");
    await wait();
    key(tops()[0], "ArrowLeft");
    await wait();
    expect(selected()).toBe(0);
  });

  it("moves focus along with the selection when focused", async () => {
    const { tops, key } = make({ value: 1 });
    tops()[0].focus();
    key(tops()[0], "ArrowRight");
    await wait();
    expect(document.activeElement).toBe(tops()[1]);
  });

  it("other keys are not handled", () => {
    const { tops, key } = make();
    expect(key(tops()[0], "a").defaultPrevented).toBe(false);
  });

  it("a value not in the selections selects nothing", () => {
    const { element, selected } = make({ value: 1 });
    element.value = 99;
    expect(selected()).toBe(-1);
  });

  it("arrow right after an unknown value starts from the first option", async () => {
    const { element, tops, selected, key } = make({ value: 2 });
    element.value = 99;
    key(tops()[0], "ArrowRight");
    await wait();
    expect(selected()).toBe(0);
  });

  it("replacing the selections keeps the current value selected", () => {
    const { element, tops, selected } = make({ value: 3 });
    element.selections = [
      { value: 3, text: "C" },
      { value: 4, text: "D" },
    ];
    expect(tops().map((top) => top.textContent)).toEqual(["C", "D"]);
    expect(selected()).toBe(0);
  });

  it("removing the selections empties the element", () => {
    const { element } = make({ value: 3 });
    element.selections = undefined;
    expect(element.children.length).toBe(0);
  });

  it("clear deselects", async () => {
    const { element, tops, selected } = make();
    tops()[1].click();
    await wait();
    element.clear();
    expect(selected()).toBe(-1);
    expect(element.buffer).toBeUndefined();
  });

  it("focus focuses the first option", () => {
    const { element, tops } = make();
    element.focus();
    expect(document.activeElement).toBe(tops()[0]);
  });

  it("follows and writes a bound state", async () => {
    const state = st.ok_w(1);
    const { element, tops, selected } = make();
    element.bind({ value: state });
    expect(selected()).toBe(0);
    tops()[1].click();
    await wait();
    expect(state.ok()).toBe(2);
    state.set_ok(3);
    await wait();
    expect(selected()).toBe(2);
  });
});
