import { AccessTypes } from "#base";
import { ok, type Result } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { FormColors } from "../base";
import { form_switch } from "../boolean/switch/switch";
import { form_lamp } from "../boolean/lamp/lamp";
import { form_stepper } from "../number/stepper/stepper";
import { form_group } from "./group";
import { FormGroupBorderStyle } from "./group_base";

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

  it("get_value fails while a component has no value", () => {
    const { group } = make({ a: 1 });
    const value = group.get_value;
    expect(value.err && value.error).toBe("Component with id b has no value");
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
    group.value = { a: 3, b: true, c: 9 } as { a: number; b: boolean };
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
    outer.value = { inner: { x: 5 } };
    expect(inner.get_value.unwrap()).toEqual({ x: 5 });
  });

  it("fails reading values while bound to a state", () => {
    const { group } = make({ a: 1, b: true });
    group.bind({ value: st.ok_w({ a: 2 }) });
    expect(group.get_value.err).toBe(true);
    expect(group.value_partial.err).toBe(true);
    expect(group.value_changed.err).toBe(true);
  });

  it("sets the components from the bound state", () => {
    const { group, a, b } = make();
    group.bind({ value: st.ok_w({ a: 7, b: true }) });
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

  it("adds more elements when elements is set again", () => {
    const group = form_group({ elements: [form_stepper({ id: "a" })] });
    group.elements = [form_switch({ id: "b" })];
    expect(Object.keys(group.value_elements)).toEqual(["a", "b"]);
    expect(group.children.length).toBe(2);
  });

  it("elements gives all added elements, also those without an id", () => {
    const a = form_stepper({ id: "a" });
    const plain = form_stepper();
    const lamp = form_lamp({
      id: "l",
      colors: [FormColors.Red, FormColors.Green],
    });
    const group = form_group({ elements: [a, plain] });
    group.elements = [lamp];
    expect(group.elements).toEqual([a, plain, lamp]);
  });
});

describe("Group layout", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("switches between border styles", () => {
    const group = form_group({ border: FormGroupBorderStyle.Inset });
    expect(group.classList.contains("inset")).toBe(true);
    group.border = FormGroupBorderStyle.Outset;
    expect(group.classList.contains("inset")).toBe(false);
    expect(group.classList.contains("outset")).toBe(true);
    group.border = FormGroupBorderStyle.None;
    expect(group.classList.contains("outset")).toBe(false);
  });

  it("removes the line border when the border changes", () => {
    const group = form_group({ border: FormGroupBorderStyle.Line });
    expect(group.classList.contains("line")).toBe(true);
    group.border = FormGroupBorderStyle.None;
    expect(group.classList.contains("line")).toBe(false);
    group.border = FormGroupBorderStyle.Inset;
    expect(group.classList.contains("line")).toBe(false);
  });

  it("sets and removes a max height", () => {
    const group = form_group({ max_height: 10 });
    expect(group.classList.contains("max_height")).toBe(true);
    expect(group.style.getPropertyValue("--max_height")).toBe("10rem");
    group.max_height = undefined;
    expect(group.classList.contains("max_height")).toBe(false);
  });

  it("embeds", () => {
    const group = form_group({ embed: true });
    expect(group.classList.contains("embed")).toBe(true);
    group.embed = false;
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
    group.column = ["2rem", "3rem"];
    expect(group.style.gridTemplateColumns).toBe(
      "minmax(2rem, 1fr) minmax(3rem, 1fr)",
    );
    group.row = true;
    expect(group.classList.contains("flex-row")).toBe(true);
    expect(group.classList.contains("grid-col")).toBe(false);
    group.row = "4rem";
    expect(group.classList.contains("grid-row")).toBe(true);
    expect(group.style.gridTemplateRows).toBe(
      "repeat(auto-fit, minmax(4rem, 1fr))",
    );
  });

  it("is focusable only with read access", () => {
    const group = form_group();
    group.access = AccessTypes.Read;
    expect(group.tabIndex).toBe(0);
    expect(group.inert).toBe(true);
    group.access = AccessTypes.Write;
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
    Result<{ a: number; b: boolean }, string>
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
    Result<{ a: number }, string>
  >();
  return ok(undefined);
}
