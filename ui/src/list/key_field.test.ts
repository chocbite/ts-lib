import { none, type Option } from "@chocbite/ts-lib/result";
import { state } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListKeyField } from "./key_field";
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
});
