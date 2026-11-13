import { state } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListAddRow } from "./add_row";
import { ListKeyField } from "./key_field";
import type { ListRoot, ListRowParent } from "./types";
import { ok } from "@chocbite/ts-lib/result";

afterEach(() => {
  document.body.replaceChildren();
});

type Values = Record<string, string>;

function root(sub_rows: boolean): ListRoot<number, Values, number[], boolean> {
  return {
    sub_rows,
    columns: new Map(),
    columns_visible: [],
    transform: () => ok({ values: {} }),
  };
}

function parent(depth: number): ListRowParent<number[]> {
  return { depth, open: false, select_adjacent() {}, state: [] };
}

function add_row(sub_rows = false, depth = -1) {
  const row = new ListAddRow(root(sub_rows), parent(depth));
  document.body.append(row);
  return row;
}

function button_of(row: HTMLElement): HTMLElement {
  return row.lastElementChild as HTMLElement;
}

describe("List add row", () => {
  it("shows the text and calls on_add when clicked", () => {
    const row = add_row();
    const on_add = vi.fn();
    row.options = { text: "Add", on_add };
    expect(button_of(row).textContent).toBe("Add");
    expect(button_of(row).tabIndex).toBe(0);
    button_of(row).click();
    expect(on_add).toHaveBeenCalledOnce();
  });

  it("shows the icon before the text, from a fixed value or a state", () => {
    const icon = (name: string) => () => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.dataset.icon = name;
      return svg;
    };
    const row = add_row();
    row.options = { text: "Add", icon: icon("plus"), on_add() {} };
    const button = button_of(row);
    expect(button.firstElementChild?.getAttribute("data-icon")).toBe("plus");
    expect(button.textContent).toBe("Add");
    const icon_state = state.ok_w(icon("first"));
    row.options = { text: "Add", icon: icon_state, on_add() {} };
    expect(button.querySelectorAll("svg").length).toBe(1);
    expect(button.firstElementChild?.getAttribute("data-icon")).toBe("first");
    icon_state.set_ok(icon("second"));
    expect(button.querySelectorAll("svg").length).toBe(1);
    expect(button.firstElementChild?.getAttribute("data-icon")).toBe("second");
    row.options = { text: "Changed", on_add() {} };
    icon_state.set_ok(icon("third"));
    expect(button.querySelector("svg")).toBeNull();
    expect(button.textContent).toBe("Changed");
  });

  it("replaces on_add when the options change", () => {
    const row = add_row();
    const first = vi.fn();
    const second = vi.fn();
    row.options = { text: "Add", on_add: first };
    row.options = { text: "Add", on_add: second };
    button_of(row).click();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("has a depth one below its parent and a key field only with sub rows", () => {
    expect(add_row(false, -1).depth).toBe(0);
    expect(add_row(true, 1).depth).toBe(2);
    expect(add_row(false).firstElementChild).not.toBeInstanceOf(ListKeyField);
    expect(add_row(true).firstElementChild).toBeInstanceOf(ListKeyField);
  });

  it("is never open and ignores navigation", () => {
    const row = add_row(true);
    row.open = true;
    expect(row.open).toBe(false);
    const key = row.firstElementChild as HTMLElement;
    key.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    key.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(row.open).toBe(false);
  });

  it("follows a text state and shows its error", () => {
    const text = state.from_w("One");
    const row = add_row();
    row.options = { text, on_add: () => {} };
    expect(button_of(row).textContent).toBe("One");
    text.set_ok("Two");
    expect(button_of(row).textContent).toBe("Two");
    text.set_err("Broken");
    expect(button_of(row).textContent).toBe("Broken");
  });

  it("stops following a text state when given a fixed text", () => {
    const text = state.ok_w("One");
    const row = add_row();
    row.options = { text, on_add: () => {} };
    row.options = { text: "Fixed", on_add: () => {} };
    text.set_ok("Two");
    expect(button_of(row).textContent).toBe("Fixed");
  });

  it("is inert when disabled", () => {
    const row = add_row();
    row.options = { text: "Add", disabled: true, on_add: () => {} };
    expect(row.inert).toBe(true);
  });

  it("follows a disabled state and is enabled when it errors", () => {
    const disabled = state.from_w(true);
    const row = add_row();
    row.options = { text: "Add", disabled, on_add: () => {} };
    expect(row.inert).toBe(true);
    disabled.set_ok(false);
    expect(row.inert).toBe(false);
    disabled.set_ok(true);
    disabled.set_err("fail");
    expect(row.inert).toBe(false);
  });

  it("is enabled again when disabled is set back to false", () => {
    const row = add_row();
    row.options = { text: "Add", disabled: true, on_add: () => {} };
    row.options = { text: "Add", disabled: false, on_add: () => {} };
    expect(row.inert).toBe(false);
  });

  it("is enabled again when disabled is left out of new options", () => {
    const row = add_row();
    row.options = { text: "Add", disabled: true, on_add: () => {} };
    row.options = { text: "Add", on_add: () => {} };
    expect(row.inert).toBe(false);
  });

  it("stops following a disabled state when given a fixed value", () => {
    const disabled = state.ok_w(false);
    const row = add_row();
    row.options = { text: "Add", disabled, on_add: () => {} };
    row.options = { text: "Add", disabled: false, on_add: () => {} };
    disabled.set_ok(true);
    expect(row.inert).toBe(false);
  });

  it("gives the state of its parent", () => {
    const rows = [1, 2];
    const row = new ListAddRow(root(false), { ...parent(-1), state: rows });
    expect(row.state).toBe(rows);
  });
});

