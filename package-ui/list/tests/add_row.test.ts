import { state } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessTypes } from "#base";
import { ListAddRow, type ListAddRowOptions } from "../add_row";
import { ListKeyField } from "../key_field";
import type { ListRoot, ListRowsParent } from "../types";
import { none, ok, NiceError } from "@chocbite/ts-lib/result";

/**A test error whose nice text is its message, so shown texts read as before*/
const nice_err = (text: string) => new NiceError(Symbol(text), text);

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
    search_hold: (func) => func(),
    search_queue() {},
    has_menu: false,
    open_all_lines: () => [],
    select_all_lines: () => [],
    search_lines: () => [],
    menu: () => none(),
    open_all() {},
    close_all() {},
    sort_focus: new Set(),
    sort_held: () => false,
    sort_changed() {},
  };
}

function parent(depth: number): ListRowsParent<number[]> {
  return {
    depth,
    open: false,
    select_adjacent() {},
    state: [],
    lines: [],
    //The add row never reads the rows of its parent
    group: undefined as never,
  };
}

function add_row(
  sub_rows = false,
  depth = -1,
  options: ListAddRowOptions = {},
) {
  const row = ListAddRow.create<
    ListAddRow<number, Values, number[], boolean>,
    [ListRoot<number, Values, number[], boolean>, ListRowsParent<number[]>]
  >(options, root(sub_rows), parent(depth));
  document.body.append(row);
  return row;
}

function button_of(row: HTMLElement): HTMLElement {
  return row.lastElementChild as HTMLElement;
}

describe("List add row", () => {
  it("shows the text and calls on_add when clicked", () => {
    const on_add = vi.fn();
    const row = add_row(false, -1, { text: "Add", on_add });
    expect(button_of(row).textContent).toBe("Add");
    expect(button_of(row).tabIndex).toBe(0);
    button_of(row).click();
    expect(on_add).toHaveBeenCalledOnce();
  });

  it("shows the icon before the text, from a fixed value or a state, null removes it", () => {
    const icon = (name: string) => () => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.dataset.icon = name;
      return svg;
    };
    const row = add_row(false, -1, { text: "Add", icon: icon("plus") });
    const button = button_of(row);
    expect(button.firstElementChild?.getAttribute("data-icon")).toBe("plus");
    expect(button.textContent).toBe("Add");
    const icon_state = state.ok_w(icon("first"));
    row.set({ icon: icon_state });
    expect(button.querySelectorAll("svg").length).toBe(1);
    expect(button.firstElementChild?.getAttribute("data-icon")).toBe("first");
    icon_state.set_ok(icon("second"));
    expect(button.querySelectorAll("svg").length).toBe(1);
    expect(button.firstElementChild?.getAttribute("data-icon")).toBe("second");
    //Left out it stays
    row.set({ text: "Changed" });
    expect(button.firstElementChild?.getAttribute("data-icon")).toBe("second");
    row.set({ icon: null });
    icon_state.set_ok(icon("third"));
    expect(button.querySelector("svg")).toBeNull();
    expect(button.textContent).toBe("Changed");
  });

  it("replaces on_add with set", () => {
    const first = vi.fn();
    const second = vi.fn();
    const row = add_row(false, -1, { text: "Add", on_add: first });
    row.set({ on_add: second });
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
    const row = add_row(false, -1, { text });
    expect(button_of(row).textContent).toBe("One");
    text.set_ok("Two");
    expect(button_of(row).textContent).toBe("Two");
    text.set_err(nice_err("Broken"));
    expect(button_of(row).textContent).toBe("Broken");
  });

  it("stops following a text state when given a fixed text", () => {
    const text = state.ok_w("One");
    const row = add_row(false, -1, { text });
    row.set({ text: "Fixed" });
    text.set_ok("Two");
    expect(button_of(row).textContent).toBe("Fixed");
  });

  it("is locked with read access and unlocked with write access", () => {
    const row = add_row(false, -1, { text: "Add", access: AccessTypes.Read });
    expect(row.inert).toBe(true);
    //Left out it stays
    row.set({ text: "More" });
    expect(row.inert).toBe(true);
    row.set({ access: AccessTypes.Write });
    expect(row.inert).toBe(false);
  });

  it("follows an access state", () => {
    const access = state.ok_w<AccessTypes>(AccessTypes.Read);
    const row = add_row(false, -1, { text: "Add", access });
    expect(row.inert).toBe(true);
    access.set_ok(AccessTypes.Write);
    expect(row.inert).toBe(false);
  });

  it("gives the state of its parent", () => {
    const rows = [1, 2];
    const row = new ListAddRow(root(false), { ...parent(-1), state: rows });
    expect(row.state).toBe(rows);
  });
});
