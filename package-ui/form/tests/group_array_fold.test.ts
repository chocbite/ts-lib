import { ok } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import form from "..";
import type { FormGroupArrayCreateOptions } from "..";

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const show = <E extends HTMLElement>(element: E) =>
  document.body.appendChild(element);

/**Clicks an element, also an svg, which has no click method*/
const click = (element: Element) =>
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));

/**The text the bar shows, the place while paging, else the number of items*/
const bar_text = (group: HTMLElement) => {
  const pager = group.querySelector<HTMLElement>(".fold-pager")!;
  return pager.hidden
    ? group.querySelector(".fold-label")!.textContent
    : pager.querySelector(".fold-count")!.textContent;
};

afterEach(() => {
  (document.activeElement as HTMLElement | null)?.blur();
  document.body.replaceChildren();
});

/**An array group of three steppers with the values 1, 2 and 3, in the document*/
const make = (options: FormGroupArrayCreateOptions<number, undefined> = {}) => {
  const items = [1, 2, 3].map((value) => form.stepper({ value }));
  const group = show(
    form.group_array({ elements: items, foldable: true, ...options }),
  );
  const bar = () => group.querySelector<HTMLElement>(":scope > .fold-bar");
  const part = (name: string) =>
    group.querySelector<HTMLElement>(":scope > .fold-bar .fold-" + name)!;
  /**The items in the document, by their values*/
  const shown = () =>
    [...group.children]
      .filter((child) => child.matches("form-stepper"))
      .map((child) => (child as (typeof items)[number]).buffer);
  return { group, items, bar, part, shown, text: () => bar_text(group) };
};

describe("Array group folding", () => {
  it("has no bar and shows every item without foldable", () => {
    const { bar, shown } = make({ foldable: false });
    expect(bar()).toBeNull();
    expect(shown()).toEqual([1, 2, 3]);
  });

  it("shows a bar and one item at a time when foldable", () => {
    const { group, bar, shown, text } = make();
    expect(group.firstElementChild).toBe(bar());
    expect(shown()).toEqual([1]);
    expect(text()).toBe("1 / 3");
  });

  it("pages with the arrows of the bar, which stop at the ends", () => {
    const { part, shown, text } = make();
    expect(part("prev").classList.contains("disabled")).toBe(true);
    click(part("next"));
    click(part("next"));
    expect(shown()).toEqual([3]);
    expect(text()).toBe("3 / 3");
    expect(part("next").classList.contains("disabled")).toBe(true);
    click(part("next"));
    expect(shown()).toEqual([3]);
    click(part("prev"));
    expect(shown()).toEqual([2]);
  });

  it("pages with the arrow keys on the pager, home and end go to the first and the last", async () => {
    const { part, shown } = make();
    part("pager").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(shown()).toEqual([2]);
    await userEvent.keyboard("{ArrowLeft}");
    expect(shown()).toEqual([1]);
    await userEvent.keyboard("{End}");
    expect(shown()).toEqual([3]);
    await userEvent.keyboard("{Home}");
    expect(shown()).toEqual([1]);
  });

  it("folds and unfolds with Enter and Space on the button", async () => {
    const { part, shown } = make();
    part("toggle").focus();
    await userEvent.keyboard("{Enter}");
    expect(shown()).toEqual([1, 2, 3]);
    await userEvent.keyboard(" ");
    expect(shown()).toEqual([1]);
  });

  it("tells what the button does", () => {
    const { part } = make();
    expect(part("toggle").title).toBe("Show all");
    part("toggle").click();
    expect(part("toggle").title).toBe("Show one at a time");
  });

  it("unfolds and folds with the button of the bar", () => {
    const { part, shown, text } = make();
    part("toggle").click();
    expect(shown()).toEqual([1, 2, 3]);
    expect(text()).toBe("3 entries");
    expect(part("pager").hidden).toBe(true);
    expect(part("label").hidden).toBe(false);
    part("toggle").click();
    expect(shown()).toEqual([1]);
  });

  it("starts unfolded with folded false", () => {
    const { shown } = make({ folded: false });
    expect(shown()).toEqual([1, 2, 3]);
  });

  it("keeps the values of the hidden items in its value", () => {
    const { group } = make();
    expect(group.get_value).toEqual(ok([1, 2, 3]));
  });

  it("keeps what was typed in an item when paging away and back", async () => {
    const items = [form.text_input({ value: "" }), form.text_input({ value: "" })];
    const group = show(form.group_array({ elements: items, foldable: true }));
    await userEvent.click(items[0].querySelector("input")!);
    await userEvent.keyboard("typed");
    //Paged from outside the field, like from an index state, the browser leaves the field it takes out, which sets what was typed
    click(group.querySelector(".fold-next")!);
    expect(items[0].isConnected).toBe(false);
    await wait();
    click(group.querySelector(".fold-prev")!);
    expect(items[0].querySelector("input")!.value).toBe("typed");
    expect(group.get_value).toEqual(ok(["typed", ""]));
  });

  it("says when it has no entries", () => {
    const group = show(form.group_array<number>({ foldable: true }));
    const part = (name: string) =>
      group.querySelector<HTMLElement>(".fold-" + name)!;
    expect(bar_text(group)).toBe("No entries");
    expect(part("pager").hidden).toBe(true);
    expect(part("toggle").hidden).toBe(true);
  });

  it("removes the bar and shows every item when it is no longer foldable", () => {
    const { group, bar, shown } = make();
    group.set({ foldable: false });
    expect(bar()).toBeNull();
    expect(shown()).toEqual([1, 2, 3]);
  });

  it("lays out the items after the bar", () => {
    const { group, items, part } = make({ folded: false });
    const bar = group.firstElementChild;
    part("toggle").click();
    part("toggle").click();
    expect([...group.children]).toEqual([bar, ...items]);
  });
});

describe("Array group folding, folded and index as inputs", () => {
  it("writes folded to a writable state", () => {
    const folded = st.ok_w(true);
    const { part, shown } = make({ folded });
    part("toggle").click();
    expect(folded.ok()).toBe(false);
    expect(shown()).toEqual([1, 2, 3]);
    folded.set_ok(true);
    expect(shown()).toEqual([1]);
  });

  it("is locked by a read only folded state", () => {
    const { part, shown } = make({ folded: st.ok(true) });
    expect(part("toggle").classList.contains("disabled")).toBe(true);
    part("toggle").click();
    expect(shown()).toEqual([1]);
  });

  it("writes the index to a writable state and follows it", () => {
    const index = st.ok_w(1);
    const { part, shown } = make({ index });
    expect(shown()).toEqual([2]);
    click(part("next"));
    expect(index.ok()).toBe(2);
    expect(shown()).toEqual([3]);
    index.set_ok(0);
    expect(shown()).toEqual([1]);
  });

  it("is locked by a read only index state", () => {
    const { part, shown } = make({ index: st.ok(1) });
    expect(part("next").classList.contains("disabled")).toBe(true);
    click(part("next"));
    expect(shown()).toEqual([2]);
  });

  it("shows the last item for an index past the end", () => {
    const { shown, text } = make({ index: 9 });
    expect(shown()).toEqual([3]);
    expect(text()).toBe("3 / 3");
  });

  it("folds to the item the focus was in while unfolded", async () => {
    const { group, items, part, shown, text } = make({ folded: false });
    await userEvent.click(items[2].querySelector("span[contenteditable]")!);
    part("toggle").click();
    expect(shown()).toEqual([3]);
    expect(text()).toBe("3 / 3");
    expect(group.contains(document.activeElement)).toBe(true);
  });
});

describe("Array group folding, items changing", () => {
  it("follows the shown item when items are put in before it, writing the index", () => {
    const index = st.ok_w(1);
    const { group, items, shown, text } = make({ index });
    const added = form.stepper({ value: 0 });
    group.set({ elements: [added, ...items] });
    expect(shown()).toEqual([2]);
    expect(index.ok()).toBe(2);
    expect(text()).toBe("3 / 4");
  });

  it("shows the item now at the place of a removed shown item, or the last", () => {
    const { group, items, part, shown } = make();
    click(part("next"));
    group.set({ elements: [items[0], items[2]] });
    expect(shown()).toEqual([3]);
    group.set({ elements: [items[0]] });
    expect(shown()).toEqual([1]);
  });
});
