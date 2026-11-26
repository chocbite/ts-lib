import { AccessTypes } from "#base";
import { NiceError, ok, type ResultNice } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { form_errors } from "../errors";
import { form_switch } from "../boolean/switch/switch";
import { form_lamp } from "../boolean/lamp/lamp";
import { form_stepper, type FormStepper } from "../number/stepper/stepper";
import { form_number_input } from "../number/number_input/number_input";
import { form_text } from "../text/text/text";
import type { FormSwitch } from "../boolean/switch/switch";
import { FormColors, FormElement, FormValueWrite } from "../base";
import { form_group } from "../group/group";
import { FormGroupBorderStyle } from "../group/group_base";

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**Group with a number "a" and a boolean "b" element*/
const make = (options: { a?: number; b?: boolean } = {}) => {
  const a = form_stepper({ id: "a", value: options.a });
  const b = form_switch({ id: "b", value: options.b });
  const group = form_group({ elements: [a, b] });
  document.body.appendChild(group);
  return { group, a, b };
};

describe("Group values", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("get_value fails while a component has no value, naming it, with its error inside", () => {
    const { group } = make({ a: 1 });
    const value = group.get_value;
    expect(!value.ok && value.error.kind).toBe(form_errors.INVALID);
    expect(!value.ok && value.error.message).toBe("Elements without a valid value: b");
    expect(!value.ok && value.error.errors.map((error) => error.kind)).toEqual([form_errors.NO_VALUE]);
  });

  it("get_value keeps the error of the state of a component, like a lost connection", () => {
    const failed = new NiceError(Symbol("Connection failed"), new TypeError("Failed to fetch"));
    const state = st.from_w(1);
    const a = form_stepper({ id: "a", value: state });
    const b = form_switch({ id: "b", value: true });
    const group = form_group({ elements: [a, b] });
    document.body.appendChild(group);
    state.set_err(failed);
    const value = group.get_value;
    expect(!value.ok && value.error.message).toBe("Elements without a valid value: a");
    expect(!value.ok && value.error.errors).toEqual([failed]);
  });

  it("get_value collects the values of all components by id", () => {
    const { group } = make({ a: 1, b: true });
    expect(group.get_value.unwrap()).toEqual({ a: 1, b: true });
  });

  it("value_partial only has the components with values", () => {
    const { group } = make({ b: false });
    expect(group.value_partial.unwrap()).toEqual({ b: false });
  });

  it("value_changed only has the components the user changed", async () => {
    const { group, a } = make({ a: 1, b: true });
    expect(group.value_changed.unwrap()).toEqual({});
    a.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await wait();
    expect(group.value_changed.unwrap()).toEqual({ a: 2 });
  });

  it("setting the value sets the components, ignoring unknown ids", () => {
    const { group, a, b } = make();
    group.set({ value: { a: 3, b: true, c: 9 } as { a: number; b: boolean } });
    expect(a.buffer).toBe(3);
    expect(b.buffer).toBe(true);
    expect(group.querySelector("form-stepper span")!.textContent).toBe("3");
  });

  it("the value option sets the components", () => {
    const group = form_group({
      elements: [form_stepper({ id: "a" })],
      value: { a: 4 },
    });
    expect(group.get_value.unwrap()).toEqual({ a: 4 });
  });

  it("clear clears all components", () => {
    const { group, a } = make({ a: 1, b: true });
    group.clear();
    expect(a.get_value.err).toBe(true);
    expect(group.value_partial.unwrap()).toEqual({});
  });

  it("nested groups give and take nested values", () => {
    const inner = form_group({
      id: "inner",
      elements: [form_stepper({ id: "x", value: 1 })],
    });
    const outer = form_group({
      elements: [inner, form_switch({ id: "y", value: true })],
    });
    expect(outer.get_value.unwrap()).toEqual({ inner: { x: 1 }, y: true });
    outer.set({ value: { inner: { x: 5 } } });
    expect(inner.get_value.unwrap()).toEqual({ x: 5 });
  });

  it("reads the values of its elements also while its value is a state", () => {
    const { group } = make({ a: 1, b: true });
    group.set({ value: st.ok_w({ a: 2 }) });
    expect(group.get_value.unwrap()).toEqual({ a: 2, b: true });
    expect(group.value_partial.unwrap()).toEqual({ a: 2, b: true });
    expect(group.value_changed.unwrap()).toEqual({});
  });

  it("sets the components from the bound state", () => {
    const { group, a, b } = make();
    group.set({ value: st.ok_w({ a: 7, b: true }) });
    expect(a.buffer).toBe(7);
    expect(b.buffer).toBe(true);
  });

  it("calls its change listener when the user changes a component", async () => {
    const change = vi.fn();
    const a = form_stepper({ id: "a", value: 1 });
    const group = form_group({ elements: [a], change });
    document.body.appendChild(group);
    a.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await wait();
    expect(change).toHaveBeenCalled();
  });

  it("gives its change listener the values of all components with values", async () => {
    const change = vi.fn();
    const a = form_stepper({ id: "a", value: 1 });
    const b = form_switch({ id: "b", value: true });
    const c = form_stepper({ id: "c" });
    const inner = form_group({ id: "inner", elements: [c] });
    const group = form_group({ elements: [a, b, inner], change });
    document.body.appendChild(group);
    a.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await wait();
    expect(change).toHaveBeenLastCalledWith({ a: 2, b: true });
    c.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await wait();
    expect(change).toHaveBeenLastCalledWith({
      a: 2,
      b: true,
      inner: { c: 1 },
    });
  });
});

describe("Group elements", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("adds all elements, but only those with an id as value elements", () => {
    const a = form_stepper({ id: "a" });
    const plain = form_stepper();
    const lamp = form_lamp({
      id: "l",
      colors: [FormColors.Red, FormColors.Green],
    });
    const group = form_group({ elements: [a, plain, lamp] });
    expect([...group.children]).toEqual([a, plain, lamp]);
    expect(group.value_elements).toEqual({ a });
  });

  it("skips an element with an id already in the group", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const first = form_stepper({ id: "a" });
    const second = form_stepper({ id: "a" });
    const group = form_group({ elements: [first, second] });
    expect(error).toHaveBeenCalledTimes(1);
    expect(group.value_elements).toEqual({ a: first });
    expect(second.parentElement).toBeNull();
    error.mockRestore();
  });

  it("elements gives all elements, also those without an id, only those with an id are values", () => {
    const a = form_stepper({ id: "a" });
    const plain = form_stepper();
    const lamp = form_lamp({
      id: "l",
      colors: [FormColors.Red, FormColors.Green],
    });
    const group = form_group({ elements: [a, plain, lamp] });
    expect(group.elements).toEqual([a, plain, lamp]);
    expect(Object.keys(group.value_elements)).toEqual(["a"]);
  });

  it("takes other elements with the same ids, their values are its value", () => {
    const { group, a, b } = make({ a: 1, b: true });
    const a2 = form_number_input({ id: "a", value: 5 });
    const b2 = form_switch({ id: "b", value: false });
    const label = form_text({ text: "Label" });
    group.set({ elements: [label, a2, b2] });
    expect([...group.children]).toEqual([label, a2, b2]);
    expect(group.elements).toEqual([label, a2, b2]);
    expect(group.value_elements).toEqual({ a: a2, b: b2 });
    expect(group.get_value.unwrap()).toEqual({ a: 5, b: false });
    expect(a.parentElement).toBeNull();
    expect(b.parentElement).toBeNull();
  });

  it("leaves the elements it keeps in place, only new ones are put in", async () => {
    const { group, a, b } = make({ a: 1, b: true });
    const a2 = form_stepper({ id: "a", value: 2 });
    const removed: Node[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) removed.push(...record.removedNodes);
    });
    observer.observe(group, { childList: true });
    const label = form_text({ text: "Label" });
    group.set({ elements: [label, a, b] });
    group.set({ elements: [label, a2, b] });
    await wait();
    observer.disconnect();
    expect([...group.children]).toEqual([label, a2, b]);
    expect(removed).toEqual([a]);
  });

  it("moves a kept element when the order changes", () => {
    const { group, a, b } = make();
    group.set({ elements: [b, a] });
    expect([...group.children]).toEqual([b, a]);
  });

  it("gives a value given with the elements to the new elements", () => {
    const { group } = make({ a: 1, b: true });
    const a2 = form_stepper({ id: "a" });
    const b2 = form_switch({ id: "b" });
    group.set({ elements: [a2, b2], value: { a: 7, b: false } });
    expect(a2.buffer).toBe(7);
    expect(b2.buffer).toBe(false);
  });

  it("follows elements given as a state", () => {
    const a = form_stepper({ id: "a", value: 1 });
    const a2 = form_stepper({ id: "a", value: 2 });
    const elements = st.ok_w([a]);
    const group = form_group({ elements });
    document.body.appendChild(group);
    expect(group.get_value.unwrap()).toEqual({ a: 1 });
    elements.set_ok([a2]);
    expect([...group.children]).toEqual([a2]);
    expect(group.get_value.unwrap()).toEqual({ a: 2 });
  });

  it("does not tell its change listener about an element it no longer has", async () => {
    const change = vi.fn();
    const a = form_stepper({ id: "a", value: 1 });
    const b = form_switch({ id: "b", value: false });
    const group = form_group({ elements: [a, b], change });
    document.body.appendChild(group);
    const b2 = form_switch({ id: "b", value: false });
    group.set({ elements: [a, b2] });
    b.click();
    await wait();
    expect(change).not.toHaveBeenCalled();
    b2.click();
    await wait();
    expect(change).toHaveBeenCalledWith({ a: 1, b: true });
  });

  it("keeps its fault icon after the elements", () => {
    const value = st.err_w<{ a: number }>(
      new NiceError(Symbol("Broken"), "broken"),
    );
    const a = form_stepper({ id: "a" });
    const group = form_group({ elements: [a] }).set({ value });
    document.body.appendChild(group);
    const icon = group.lastElementChild;
    expect(icon).not.toBe(a);
    const a2 = form_stepper({ id: "a" });
    const label = form_text({ text: "Label" });
    group.set({ elements: [a2, label] });
    expect([...group.children]).toEqual([a2, label, icon]);
  });
});

describe("Group layout", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("switches between border styles", () => {
    const group = form_group({ border: FormGroupBorderStyle.Inset });
    expect(group.classList.contains("inset")).toBe(true);
    group.set({ border: FormGroupBorderStyle.Outset });
    expect(group.classList.contains("inset")).toBe(false);
    expect(group.classList.contains("outset")).toBe(true);
    group.set({ border: FormGroupBorderStyle.None });
    expect(group.classList.contains("outset")).toBe(false);
  });

  it("removes the line border when the border changes", () => {
    const group = form_group({ border: FormGroupBorderStyle.Line });
    expect(group.classList.contains("line")).toBe(true);
    group.set({ border: FormGroupBorderStyle.None });
    expect(group.classList.contains("line")).toBe(false);
    group.set({ border: FormGroupBorderStyle.Inset });
    expect(group.classList.contains("line")).toBe(false);
  });

  it("sets and removes a max height", () => {
    const group = form_group({ max_height: 10 });
    expect(group.classList.contains("max_height")).toBe(true);
    expect(group.style.getPropertyValue("--max_height")).toBe("10rem");
    group.set({ max_height: 0 });
    expect(group.classList.contains("max_height")).toBe(false);
  });

  it("embeds", () => {
    const group = form_group({ embed: true });
    expect(group.classList.contains("embed")).toBe(true);
    group.set({ embed: false });
    expect(group.classList.contains("embed")).toBe(false);
  });

  it("is a column by default", () => {
    expect(form_group().classList.contains("flex-col")).toBe(true);
  });

  it("makes grid columns and rows", () => {
    const group = form_group({ column: "5rem" });
    expect(group.classList.contains("grid-col")).toBe(true);
    expect(group.classList.contains("flex-col")).toBe(false);
    expect(group.style.gridTemplateColumns).toBe(
      "repeat(auto-fit, minmax(5rem, 1fr))",
    );
    group.set({ column: ["2rem", "3rem"] });
    expect(group.style.gridTemplateColumns).toBe(
      "minmax(2rem, 1fr) minmax(3rem, 1fr)",
    );
    group.set({ row: true });
    expect(group.classList.contains("flex-row")).toBe(true);
    expect(group.classList.contains("grid-col")).toBe(false);
    group.set({ row: "4rem" });
    expect(group.classList.contains("grid-row")).toBe(true);
    expect(group.style.gridTemplateRows).toBe(
      "repeat(auto-fit, minmax(4rem, 1fr))",
    );
  });

  it("is focusable only with read access", () => {
    const group = form_group();
    group.set({ access: AccessTypes.Read });
    expect(group.tabIndex).toBe(0);
    expect(group.inert).toBe(true);
    group.set({ access: AccessTypes.Write });
    expect(group.hasAttribute("tabindex")).toBe(false);
    expect(group.onfocus).toBeNull();
  });
});

/**Only type checked, never called*/
export function group_types() {
  const group = form_group({
    elements: [
      form_stepper({ id: "a" }),
      form_switch({ id: "b" }),
      form_stepper(),
    ],
  });
  expectTypeOf(group.get_value).toEqualTypeOf<
    ResultNice<{ a: number; b: boolean }>
  >();
  expectTypeOf(group.value_elements.a.buffer).toEqualTypeOf<
    number | undefined
  >();
  expectTypeOf(group.value_elements.b.buffer).toEqualTypeOf<
    boolean | undefined
  >();
  // @ts-expect-error Elements without an id have no key
  void group.value_elements.c;

  //A lamp is not collected by the group, so it is not part of the value
  const with_lamp = form_group({
    elements: [
      form_stepper({ id: "a" }),
      form_lamp({ id: "l", colors: [FormColors.Red, FormColors.Green] }),
    ],
  });
  expectTypeOf(with_lamp.get_value).toEqualTypeOf<
    ResultNice<{ a: number }>
  >();

  //Elements given again need the same ids and value types, other elements and labels are free
  group.set({
    elements: [
      form_text({ text: "Label" }),
      form_number_input({ id: "a" }),
      form_switch({ id: "b" }),
    ],
  });
  // @ts-expect-error b is missing
  group.set({ elements: [form_stepper({ id: "a" })] });
  group.set({
    // @ts-expect-error c is not in the value
    elements: [form_stepper({ id: "a" }), form_switch({ id: "b" }), form_switch({ id: "c" })],
  });
  // @ts-expect-error a is a number
  group.set({ elements: [form_switch({ id: "a" }), form_switch({ id: "b" })] });
  //Also as a state
  group.set({
    elements: st.ok_w<[FormStepper<"a">, FormSwitch<"b">]>([
      form_stepper({ id: "a" }),
      form_switch({ id: "b" }),
    ]),
  });
  //The value elements are typed by their value, as another element with the same value can take the place
  expectTypeOf(group.value_elements.a).toEqualTypeOf<FormValueWrite<number, "a">>();

  //A group built from data has no typed value, so it takes any elements
  const built: FormElement[] = [];
  const from_data = form_group({ elements: built });
  from_data.set({ elements: [form_switch({ id: "x" })] as FormElement[] });
  return ok(undefined);
}
