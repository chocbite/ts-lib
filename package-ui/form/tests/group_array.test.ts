import { ok, type ResultNice } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import form from "..";
import { form_errors } from "../errors";

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const show = <E extends HTMLElement>(element: E) =>
  document.body.appendChild(element);

afterEach(() => {
  (document.activeElement as HTMLElement | null)?.blur();
  document.body.replaceChildren();
});

describe("Array group value", () => {
  it("is the values of its items in order", () => {
    const group = form.group_array({
      elements: [form.stepper({ value: 1 }), form.stepper({ value: 2 })],
    });
    expect(group.get_value).toEqual(ok([1, 2]));
  });

  it("is an error naming the indexes of the items without a value, with their errors inside", () => {
    const group = form.group_array({
      elements: [
        form.stepper({ value: 1 }),
        form.stepper(),
        form.stepper({ value: 3 }),
        form.stepper(),
      ],
    });
    const value = group.get_value;
    expect(!value.ok && value.error.kind).toBe(form_errors.INVALID);
    expect(!value.ok && value.error.message).toBe(
      "Items without a valid value at index 1, 3",
    );
    expect(!value.ok && value.error.errors.map((error) => error.kind)).toEqual(
      [form_errors.NO_VALUE, form_errors.NO_VALUE],
    );
  });

  it("value_partial has the values of the items with one, in order, without gaps", () => {
    const group = form.group_array({
      elements: [
        form.stepper({ value: 1 }),
        form.stepper(),
        form.stepper({ value: 3 }),
      ],
    });
    expect(group.value_partial).toEqual(ok([1, 3]));
  });

  it("an empty array group has an empty array", () => {
    expect(form.group_array<number>().get_value).toEqual(ok([]));
  });

  it("gives a value to its items by position, values without an item are left out", () => {
    const a = form.stepper({ value: 1 });
    const b = form.stepper({ value: 2 });
    const group = form.group_array({ elements: [a, b] });
    group.set({ value: [5, 6, 7] });
    expect(a.buffer).toBe(5);
    expect(b.buffer).toBe(6);
    expect(group.get_value).toEqual(ok([5, 6]));
  });

  it("clear clears its items", () => {
    const a = form.stepper({ value: 1 });
    const group = form.group_array({ elements: [a] });
    group.clear();
    expect(a.buffer).toBeUndefined();
  });

  it("ignores the ids of its items", () => {
    const group = form.group_array({
      elements: [form.switch({ id: "x", value: true }), form.switch({ id: "x", value: false })],
    });
    expect(group.get_value).toEqual(ok([true, false]));
  });
});

describe("Array group change", () => {
  it("tells its change listener when an item without an id changes, with the values of the items that have one", async () => {
    const change = vi.fn();
    const b = form.switch({ value: false });
    const group = show(
      form.group_array({
        elements: [form.switch({ value: true }), form.switch(), b],
        change,
      }),
    );
    b.click();
    await wait();
    expect(change).toHaveBeenCalledWith([true, true]);
    expect(group.get_value.err).toBe(true);
  });

  it("does not tell its change listener about an item it no longer has", async () => {
    const change = vi.fn();
    const a = form.switch({ value: false });
    const group = show(form.group_array({ elements: [a], change }));
    group.set({ elements: [form.switch({ value: false })] });
    a.click();
    await wait();
    expect(change).not.toHaveBeenCalled();
  });

  it("passes a change of an item on to the group around it", async () => {
    const change = vi.fn();
    const item = form.switch({ value: false });
    show(
      form.group({
        elements: [form.group_array({ id: "list", elements: [item] })],
        change,
      }),
    );
    item.click();
    await wait();
    expect(change).toHaveBeenCalledWith({ list: [true] });
  });
});

describe("Array group elements", () => {
  it("keeps the instances it is given, only new items are put in", async () => {
    const a = form.stepper({ value: 1 });
    const b = form.stepper({ value: 2 });
    const group = show(form.group_array({ elements: [a, b] }));
    const removed: Node[] = [];
    const added: Node[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        removed.push(...record.removedNodes);
        added.push(...record.addedNodes);
      }
    });
    observer.observe(group, { childList: true });
    const c = form.stepper({ value: 3 });
    group.set({ elements: [a, c, b] });
    await wait();
    group.set({ elements: [a, c] });
    await wait();
    observer.disconnect();
    expect([...group.children]).toEqual([a, c]);
    expect(group.elements).toEqual([a, c]);
    expect(added).toEqual([c]);
    expect(removed).toEqual([b]);
    expect(group.get_value).toEqual(ok([1, 3]));
  });

  it("keeps the focus of a field the user is typing in when items are added and removed", async () => {
    const a = form.text_input({ value: "" });
    const b = form.text_input({ value: "b" });
    const group = show(form.group_array({ elements: [a, b] }));
    const input = a.querySelector("input")!;
    await userEvent.click(input);
    await userEvent.keyboard("ab");
    group.set({ elements: [form.text_input({ value: "new" }), a, b] });
    group.set({ elements: [form.text_input({ value: "new" }), a] });
    expect(document.activeElement).toBe(input);
    await userEvent.keyboard("c");
    expect(input.value).toBe("abc");
  });

  it("moves an item when the order changes", () => {
    const a = form.stepper({ value: 1 });
    const b = form.stepper({ value: 2 });
    const group = form.group_array({ elements: [a, b] });
    group.set({ elements: [b, a] });
    expect([...group.children]).toEqual([b, a]);
    expect(group.get_value).toEqual(ok([2, 1]));
  });

  it("shows an item given twice once", () => {
    const a = form.stepper({ value: 1 });
    const group = form.group_array({ elements: [a, a] });
    expect([...group.children]).toEqual([a]);
    expect(group.get_value).toEqual(ok([1]));
  });

  it("gives a value given with the items to the new items", () => {
    const group = form.group_array({ elements: [form.stepper({ value: 1 })] });
    const a = form.stepper();
    const b = form.stepper();
    group.set({ elements: [a, b], value: [4, 5] });
    expect(group.get_value).toEqual(ok([4, 5]));
  });

  it("follows items given as a state", () => {
    const a = form.stepper({ value: 1 });
    const b = form.stepper({ value: 2 });
    const items = st.ok_w([a]);
    const group = show(form.group_array({ elements: items }));
    expect(group.get_value).toEqual(ok([1]));
    items.set_ok([a, b]);
    expect([...group.children]).toEqual([a, b]);
    expect(group.get_value).toEqual(ok([1, 2]));
  });

  it("holds groups as items, its value is their values", () => {
    const group = form.group_array({
      elements: [
        form.group({ elements: [form.stepper({ id: "n", value: 1 })] }),
        form.group({ elements: [form.stepper({ id: "n", value: 2 })] }),
      ],
    });
    expect(group.get_value).toEqual(ok([{ n: 1 }, { n: 2 }]));
  });

  it("lays out like a group", () => {
    const group = form.group_array<number>({ column: "5rem", border: "inset" });
    expect(group.classList.contains("grid-col")).toBe(true);
    expect(group.classList.contains("inset")).toBe(true);
    expect(group.style.gridTemplateColumns).toBe(
      "repeat(auto-fit, minmax(5rem, 1fr))",
    );
  });

  it("can be held by a group collapser", () => {
    const group = form.group_array({ elements: [form.stepper({ value: 1 })] });
    const collapser = form.group_collapser(group);
    expect(collapser.firstElementChild).toBe(group);
  });
});

/**Type tests, only type checked, never called*/
function group_array_types() {
  //The value type comes from the items
  const numbers = form.group_array({
    elements: [form.stepper(), form.number_input()],
  });
  expectTypeOf(numbers.get_value).toEqualTypeOf<ResultNice<number[]>>();
  expectTypeOf(numbers.elements[0].buffer).toEqualTypeOf<number | undefined>();
  //Or is declared
  const texts = form.group_array<string>();
  texts.set({ elements: [form.text_input(), form.password()] });
  // @ts-expect-error a switch is not a text
  texts.set({ elements: [form.switch()] });
  // @ts-expect-error a label has no value, items are value elements only
  texts.set({ elements: [form.text({ text: "Label" })] });
  // @ts-expect-error the value is an array of texts
  texts.set({ value: "text" });
  //In a group by its id
  const group = form.group({
    elements: [form.group_array<number, "list">({ id: "list" })],
  });
  expectTypeOf(group.get_value).toEqualTypeOf<
    ResultNice<{ list: number[] }>
  >();
}
void group_array_types;
