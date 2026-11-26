import { material_close_rounded } from "#icons";
import { ok, type ResultNice } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import form from "..";
import type { FormDropDownMultiCreateOptions } from "..";

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const SELECTIONS = [
  { value: 1, text: "One" },
  { value: 2, text: "Two", icon: material_close_rounded },
  { value: 3, text: "Three" },
];

const box = () => document.querySelector("form-dropdownbox")!;
const is_open = () => box().classList.contains("open");
/**Lines of the open popup*/
const lines = () =>
  Array.from(
    box().firstElementChild!.firstElementChild!.firstElementChild!.children,
  ) as HTMLDivElement[];
/**Texts of the lines shown as selected*/
const checked = () =>
  lines()
    .filter((line) => line.classList.contains("selected"))
    .map((line) => line.textContent);

const make = (
  options: FormDropDownMultiCreateOptions<number, undefined> = {},
) => {
  const change = vi.fn();
  const element = form.dropdown_multi<number>({
    selections: SELECTIONS,
    change,
    ...options,
  });
  document.body.appendChild(element);
  const text = () => element.firstElementChild!.textContent;
  const warning = () => element.querySelector("input")!.validationMessage;
  return { element, change, text, warning };
};

afterEach(() => {
  (document.activeElement as HTMLElement | null)?.blur();
  document.body.replaceChildren();
});

describe("Multi dropdown display", () => {
  it("shows the default text without a value, and has no value", () => {
    const { element, text } = make();
    expect(text()).toBe("Select something");
    expect(element.hasAttribute("no-value")).toBe(true);
  });

  it("shows the default text with nothing selected, which is a value", () => {
    const { element, text } = make({ value: [], default: "None" });
    expect(text()).toBe("None");
    expect(element.hasAttribute("no-value")).toBe(false);
    expect(element.get_value).toEqual(ok([]));
  });

  it("shows the names of the selected ones in the order of the selections, each once", () => {
    const { text } = make({ value: st.ok([3, 1, 3, 9]) });
    expect(text()).toBe("One, Three");
  });

  it("updates the names when the selections are replaced", () => {
    const { element, text } = make({ value: [1, 2] });
    element.set({
      selections: [
        { value: 2, text: "Deux" },
        { value: 1, text: "Un" },
      ],
    });
    expect(text()).toBe("Deux, Un");
  });

  it("clear shows the default", () => {
    const { element, text } = make({ value: [1] });
    element.clear();
    expect(text()).toBe("Select something");
    expect(element.hasAttribute("no-value")).toBe(true);
  });
});

describe("Multi dropdown popup", () => {
  it("lists the options with check boxes and marks the selected ones", () => {
    const { element } = make({ value: [1, 3] });
    element.open = true;
    expect(is_open()).toBe(true);
    expect(lines().map((line) => line.textContent)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
    expect(lines().every((line) => line.firstElementChild!.matches(".check")))
      .toBe(true);
    expect(lines()[1].querySelector("svg")).not.toBeNull();
    expect(checked()).toEqual(["One", "Three"]);
    expect(document.activeElement).toBe(lines()[0]);
    element.open = false;
    expect(is_open()).toBe(false);
  });

  it("toggles the clicked option and stays open", async () => {
    const { element, change, text } = make({ value: [3] });
    element.open = true;
    await userEvent.click(lines()[0]);
    await wait();
    expect(change).toHaveBeenLastCalledWith([1, 3]);
    expect(checked()).toEqual(["One", "Three"]);
    expect(text()).toBe("One, Three");
    expect(is_open()).toBe(true);
    await userEvent.click(lines()[2]);
    await wait();
    expect(change).toHaveBeenLastCalledWith([1]);
    expect(checked()).toEqual(["One"]);
    expect(is_open()).toBe(true);
    expect(change).toHaveBeenCalledTimes(2);
  });

  it("starts a value from the first pick without one", async () => {
    const { element, change } = make();
    element.open = true;
    await userEvent.click(lines()[1]);
    await wait();
    expect(change).toHaveBeenLastCalledWith([2]);
    expect(element.hasAttribute("no-value")).toBe(false);
  });

  it("toggles with space and enter", async () => {
    const { element, change } = make({ value: [] });
    element.open = true;
    lines()[1].focus();
    await userEvent.keyboard(" ");
    await wait();
    expect(change).toHaveBeenLastCalledWith([2]);
    await userEvent.keyboard("{Enter}");
    await wait();
    expect(change).toHaveBeenLastCalledWith([]);
    expect(is_open()).toBe(true);
  });

  it("escape closes the popup and gives the focus back", async () => {
    const { element } = make({ value: [] });
    element.open = true;
    lines()[0].focus();
    await userEvent.keyboard("{Escape}");
    expect(is_open()).toBe(false);
    expect(document.activeElement).toBe(element);
  });

  it("leaves out values not in the selections when the user changes the value", async () => {
    const { element, change } = make({ value: [9, 2] });
    element.open = true;
    await userEvent.click(lines()[0]);
    await wait();
    expect(change).toHaveBeenLastCalledWith([1, 2]);
  });

  it("follows the state while open", async () => {
    const value = st.ok_w([1]);
    const { element } = make({ value });
    element.open = true;
    value.set_ok([2, 3]);
    await wait();
    expect(checked()).toEqual(["Two", "Three"]);
  });

  it("writes a bound state", async () => {
    const value = st.ok_w<number[]>([]);
    const { element } = make({ value });
    element.open = true;
    await userEvent.click(lines()[2]);
    await userEvent.click(lines()[0]);
    await wait();
    expect(value.ok()).toEqual([1, 3]);
  });

  it("lines the close line up with the options", () => {
    const { element } = make({
      selections: Array.from({ length: 200 }, (_value, index) => ({
        value: index,
        text: "Option " + index,
      })),
    });
    element.open = true;
    const closer = lines()[0];
    expect(closer.textContent).toBe("Close");
    expect(closer.children.length).toBe(lines()[1].children.length);
    expect(closer.firstElementChild!.matches(".check")).toBe(false);
    element.open = false;
  });
});

describe("Multi dropdown refused picks", () => {
  it("refuses more than max with a warning, keeps the popup open and the checks as they were", async () => {
    const { element, change, warning } = make({ value: [1, 2], max: 2 });
    element.open = true;
    await userEvent.click(lines()[2]);
    await wait(50);
    expect(change).not.toHaveBeenCalled();
    expect(warning()).toContain("At most 2 can be selected");
    expect(checked()).toEqual(["One", "Two"]);
    expect(is_open()).toBe(true);
    expect(box().contains(document.activeElement)).toBe(true);
  });

  it("refuses fewer than min", async () => {
    const { element, change, warning } = make({ value: [1], min: 1 });
    element.open = true;
    await userEvent.click(lines()[0]);
    await wait(50);
    expect(change).not.toHaveBeenCalled();
    expect(warning()).toContain("At least 1 must be selected");
    expect(checked()).toEqual(["One"]);
  });

  it("takes 0 as no limit", async () => {
    const { element, change } = make({ value: [1, 2], max: 0, min: 0 });
    element.open = true;
    await userEvent.click(lines()[2]);
    await wait();
    expect(change).toHaveBeenLastCalledWith([1, 2, 3]);
  });

  it("refuses a pick on a read only state and shows the value again", async () => {
    const { element, warning } = make({ value: st.ok([2]) });
    element.open = true;
    await userEvent.click(lines()[0]);
    await wait(50);
    expect(warning()).not.toBe("");
    expect(checked()).toEqual(["Two"]);
    expect(is_open()).toBe(true);
  });
});

describe("Multi dropdown shares the popup", () => {
  it("uses the one popup of the document with the dropdown", () => {
    const multi = make({ value: [] });
    const single = form.dropdown({ selections: [{ value: 9, text: "Nine" }] });
    document.body.appendChild(single);
    expect(document.querySelectorAll("form-dropdownbox").length).toBe(1);
    multi.element.open = true;
    single.open = true;
    expect(lines().map((line) => line.textContent)).toEqual(["Nine"]);
    expect(lines()[0].querySelector(".check")).toBeNull();
    multi.element.open = true;
    expect(lines().map((line) => line.textContent)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
    multi.element.open = false;
    expect(is_open()).toBe(false);
  });
});

/**Type tests, only type checked, never called*/
function dropdown_multi_type_tests() {
  const group = form.group({
    elements: [
      form.dropdown_multi({ id: "colors", selections: [{ value: "red", text: "Red" }] }),
    ],
  });
  expectTypeOf(group.get_value).toEqualTypeOf<ResultNice<{ colors: string[] }>>();
  // @ts-expect-error the value is an array of the selections
  form.dropdown_multi({ value: "red", selections: [{ value: "red", text: "Red" }] });
}
void dropdown_multi_type_tests;
