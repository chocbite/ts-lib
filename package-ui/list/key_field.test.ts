import { none, ok, type Option } from "@chocbite/ts-lib/result";
import { state } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListKeyField, type ListKeyFieldOptions } from "./key_field";
import type { ListRowParent } from "./types";

afterEach(() => {
  document.body.replaceChildren();
});

function key_field(depth: number) {
  const open_set = vi.fn<(open: boolean) => void>();
  const select = vi.fn<(direction: string, field: Option<number>) => void>();
  let open = false;
  const fake: ListRowParent<number[]> = {
    depth,
    get open() {
      return open;
    },
    set open(value: boolean) {
      open = value;
      open_set(value);
    },
    select_adjacent: select,
    state: [],
  };
  const field = new ListKeyField(fake);
  document.body.append(field);
  return { field, open_set, select };
}

function press(element: HTMLElement, key: string) {
  const event = new KeyboardEvent("keydown", { key, cancelable: true });
  element.dispatchEvent(event);
  return event.defaultPrevented;
}

function svg() {
  return document.createElementNS("http://www.w3.org/2000/svg", "svg");
}

describe("List key field", () => {
  it("is focusable and indented by its depth", () => {
    const { field } = key_field(3);
    expect(field.tabIndex).toBe(0);
    const indents = [...field.children].filter((e) => e.tagName === "DIV");
    expect(indents).toHaveLength(3);
    expect((indents[2] as HTMLElement).style.borderColor).toBe("var(--i-2)");
  });

  it("maps keys to the parent", () => {
    const { field, open_set, select } = key_field(0);
    expect(press(field, "Enter")).toBe(true);
    expect(press(field, " ")).toBe(true);
    expect(press(field, "ArrowRight")).toBe(true);
    expect(press(field, "ArrowLeft")).toBe(true);
    expect(open_set.mock.calls.map((c) => c[0])).toEqual([
      true,
      false,
      true,
      false,
    ]);
    expect(press(field, "ArrowDown")).toBe(true);
    expect(press(field, "ArrowUp")).toBe(true);
    expect(select.mock.calls.map((c) => c[0])).toEqual(["next", "previous"]);
    expect(select.mock.calls[0][1]).toEqual(none());
    expect(press(field, "Tab")).toBe(false);
  });

  it("toggles the parent when the opener is clicked", () => {
    const { field, open_set } = key_field(0);
    (field.querySelector(":scope > span > div") as HTMLElement).click();
    expect(open_set).toHaveBeenCalledWith(true);
  });

  it("toggles the openable class", () => {
    const { field } = key_field(0);
    expect(field.openable).toBe(false);
    field.openable = true;
    expect(field.classList.contains("openable")).toBe(true);
    expect(field.openable).toBe(true);
    field.openable = false;
    expect(field.openable).toBe(false);
  });

  it("shows a single icon after the opener", () => {
    const { field } = key_field(1);
    field.icon = svg;
    field.icon = svg;
    expect(field.querySelectorAll("svg")).toHaveLength(1);
    expect(field.lastElementChild).toBeInstanceOf(SVGSVGElement);
    field.icon = undefined;
    expect(field.querySelectorAll("svg")).toHaveLength(0);
  });

  it("removes the icon when an icon state errors", () => {
    const { field } = key_field(0);
    const icon = state.from_w(svg);
    field.options = { icon };
    expect(field.querySelectorAll("svg")).toHaveLength(1);
    icon.set_err("fail");
    expect(field.querySelectorAll("svg")).toHaveLength(0);
  });

  it("stops following an icon state when the options are cleared", () => {
    const { field } = key_field(0);
    const icon = state.ok_w(svg);
    field.options = { icon };
    field.options = undefined;
    icon.set_ok(() => svg());
    expect(field.querySelectorAll("svg")).toHaveLength(0);
  });

  it("shows text after the icon", () => {
    const { field } = key_field(1);
    field.text = "Hello";
    field.icon = svg;
    const text = field.querySelector(":scope > span.text")!;
    expect(text.textContent).toBe("Hello");
    expect(field.lastElementChild).toBe(text);
    expect(text.previousElementSibling).toBeInstanceOf(SVGSVGElement);
    field.text = "World";
    expect(field.querySelectorAll(":scope > span.text")).toHaveLength(1);
    expect(text.textContent).toBe("World");
    field.text = "";
    expect(field.querySelector(":scope > span.text")).toBeNull();
  });

  it("follows a text state and shows its error", () => {
    const { field } = key_field(0);
    const text = state.from_w("a");
    field.options = { text };
    const box = () => field.querySelector(":scope > span.text")?.textContent;
    expect(box()).toBe("a");
    text.set_ok("b");
    expect(box()).toBe("b");
    text.set_err("fail");
    expect(box()).toBe("fail");
    field.options = undefined;
    expect(box()).toBeUndefined();
    text.set_ok("c");
    expect(box()).toBeUndefined();
  });

  it("accepts plain values and every kind of state for icon and text", () => {
    //Type check only, tsc fails when a kind of state is not accepted
    const options: ListKeyFieldOptions[] = [
      { icon: svg, text: "a" },
      { icon: state.ok(svg), text: state.ok("a") },
      { icon: state.from_w(svg), text: state.from_w("a") },
      { icon: state.rosw(ok(svg), true), text: state.resw(ok("a"), true) },
      { icon: state.roa(async () => ok(svg)), text: state.rea(async () => ok("a")) },
      { icon: state.reaw(async () => ok(svg), true), text: state.roaw(async () => ok("a"), true) },
      { icon: state.p.ros(state.ok(1), () => ok(svg)).state },
      { text: state.ros(state.s.help(ok("a"), {})) },
    ];
    expect(options).toHaveLength(8);
  });
});
