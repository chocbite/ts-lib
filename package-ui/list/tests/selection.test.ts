import ctm from "#context_menu";
import { theme_init } from "#theme";
import { err, ok, some, type Option, NiceError } from "@chocbite/ts-lib/result";
import {
  state,
  STATE_ARRAY_WRITE_KEY,
  type State,
  type StateROSW,
} from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import list from "..";
import type { ListRow } from "../row";
import type { ListSelectionOptions } from "../selection";

/**A test error whose nice text is its message, so shown texts read as before*/
const nice_err = (text: string) => new NiceError(Symbol(text), text);

//Glyphs and backgrounds come from theme variables
theme_init();

afterEach(() => {
  document.body.replaceChildren();
});

interface Item {
  id: number;
  name: string;
  sub?: Item[];
  selectable?: boolean;
  /**Opened state of the row */
  opened?: State<boolean>;
  invalid?: boolean;
  menu?: boolean;
  /**Own menu from a function giving an option of a menu, with one line */
  menu_fn?: boolean;
}

type AnyRow = ListRow<any, any, any, any>;

const item = (id: number, sub?: Item[]): Item => ({
  id,
  name: "item " + id,
  sub,
});

/**Selection state bound to each list made by create */
const bound = new WeakMap<
  HTMLElement,
  StateROSW<number[], Option<{}>, number[]>
>();

function create(
  rows: Item[] | State<Item[]>,
  selection: Partial<ListSelectionOptions<Item, number>> = {},
  sub_rows = false,
  selection_state: StateROSW<number[], Option<{}>, number[]> = state.ok_w<
    number[]
  >([]),
) {
  const container = list.container(
    {
      transform: (data: Item) =>
        data.invalid
          ? err("invalid")
          : ok({
              openable: Boolean(data.sub),
              opened: data.opened,
              sub_rows: sub_rows ? () => data.sub ?? [] : undefined,
              selectable: data.selectable,
              context_menu: data.menu_fn
                ? () =>
                    some(
                      ctm.menu([ctm.line({ text: "Own", on_click: () => {} })]),
                    )
                : data.menu
                  ? ctm.menu([ctm.line({ text: "Line", on_click: () => {} })])
                  : undefined,
              values: { name: data.name },
            }),
      sub_rows,
      selection: { mode: "multi", key: (data) => data.id, ...selection },
    },
    { columns: { name: list.column_string("Name") }, rows },
  );
  container.set({ selected: selection_state });
  bound.set(container, selection_state);
  document.body.append(container);
  return container;
}

function rows_of(container: HTMLElement): AnyRow[] {
  return [...container.querySelectorAll("list-row")] as AnyRow[];
}

/**Names of the selected rows in display order */
function selected(container: HTMLElement): string[] {
  return rows_of(container)
    .filter((row) => row.classList.contains("selected"))
    .map((row) => row.querySelector("list-textfield")!.textContent);
}

function cell(row: AnyRow): HTMLElement {
  return row.querySelector(":scope > div > list-textfield")!;
}

function click(
  element: HTMLElement,
  modifiers: { ctrlKey?: boolean; shiftKey?: boolean } = {},
) {
  element.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, ...modifiers }),
  );
}

function key(
  element: HTMLElement,
  key: string,
  modifiers: { ctrlKey?: boolean; shiftKey?: boolean } = {},
) {
  const e = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  element.dispatchEvent(e);
  return e;
}

function key_field(row: AnyRow): HTMLElement {
  return row.querySelector(":scope > div > list-keyfield")!;
}

function check(row: AnyRow): HTMLElement {
  return row.querySelector(":scope > div > list-checkfield")!;
}

/**Keys in the state bound to the list */
const ids = (container: HTMLElement) => bound.get(container)!.ok();

/**Writes the state bound to the list, like app code */
const write = (container: HTMLElement, keys: number[]) =>
  void bound.get(container)!.write(keys);

describe("List selection with the pointer", () => {
  it("has no checkbox column without the option, binding a selection does nothing", () => {
    const container = list.container(
      { transform: (data: string) => ok({ values: { name: data } }) },
      { columns: { name: list.column_string("Name") }, rows: ["a"] },
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    container.set({ selected: state.ok_w<string[]>(["a"]) });
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
    document.body.append(container);
    expect(container.querySelector("list-checkfield")).toBeNull();
  });

  it("click selects only the clicked row", () => {
    const container = create([item(1), item(2), item(3)]);
    const rows = rows_of(container);
    click(cell(rows[0]));
    click(cell(rows[2]));
    expect(selected(container)).toEqual(["item 3"]);
    expect(ids(container)).toEqual([3]);
  });

  it("ctrl click toggles rows in multi mode", () => {
    const container = create([item(1), item(2), item(3)]);
    const rows = rows_of(container);
    click(cell(rows[0]));
    click(cell(rows[2]), { ctrlKey: true });
    expect(ids(container)).toEqual([1, 3]);
    click(cell(rows[0]), { ctrlKey: true });
    expect(ids(container)).toEqual([3]);
  });

  it("single mode keeps one row and ctrl click deselects it", () => {
    const container = create([item(1), item(2)], { mode: "single" });
    const rows = rows_of(container);
    click(cell(rows[0]));
    click(cell(rows[1]), { ctrlKey: true });
    expect(ids(container)).toEqual([2]);
    click(cell(rows[1]), { ctrlKey: true });
    expect(ids(container)).toEqual([]);
    click(cell(rows[0]), { shiftKey: true });
    expect(ids(container)).toEqual([1]);
  });

  it("shift click selects the range in display order, sub rows included", () => {
    const container = create(
      [item(1, [item(10), item(11)]), item(2), item(3)],
      {},
      true,
    );
    rows_of(container)[0].open = true;
    const rows = rows_of(container);
    expect(rows.length).toBe(5);
    click(cell(rows[4]));
    click(cell(rows[1]), { shiftKey: true });
    expect(selected(container)).toEqual([
      "item 10",
      "item 11",
      "item 2",
      "item 3",
    ]);
    //A range replaces the selection, in display order
    expect(ids(container)).toEqual([10, 11, 2, 3]);
    //The anchor stays, so the range shrinks from it
    click(cell(rows[3]), { shiftKey: true });
    expect(selected(container)).toEqual(["item 2", "item 3"]);
  });

  it("ctrl shift click adds the range", () => {
    const container = create([item(1), item(2), item(3), item(4)]);
    const rows = rows_of(container);
    click(cell(rows[0]));
    click(cell(rows[2]), { ctrlKey: true });
    click(cell(rows[3]), { ctrlKey: true, shiftKey: true });
    expect(ids(container)).toEqual([1, 3, 4]);
  });

  it("does not select unselectable or invalid rows", () => {
    const container = create([
      { ...item(1), selectable: false },
      { ...item(2), invalid: true },
      item(3),
    ]);
    const rows = rows_of(container);
    click(cell(rows[0]));
    click(rows[1].querySelector("list-error")!);
    expect(ids(container)).toEqual([]);
    click(cell(rows[2]));
    click(cell(rows[0]), { shiftKey: true });
    expect(ids(container)).toEqual([3]);
    expect(rows[0].classList.contains("selectable")).toBe(false);
  });

  it("clicking the sub row opener does not select", () => {
    const container = create([item(1, [item(10)])], {}, true);
    const opener = key_field(rows_of(container)[0]).querySelector(
      ":scope > span:not(.text) > div",
    ) as HTMLElement;
    click(opener);
    expect(rows_of(container).length).toBe(2);
    expect(ids(container)).toEqual([]);
  });
});

describe("List selection state", () => {
  it("is owned by the app, the list shows the keys the state holds", () => {
    const selection = state.ok_w<number[]>([2]);
    const container = create([item(1), item(2)], {}, false, selection);
    expect(selected(container)).toEqual(["item 2"]);
    selection.set_ok([1]);
    expect(selected(container)).toEqual(["item 1"]);
    selection.set_ok([]);
    expect(selected(container)).toEqual([]);
  });

  it("two lists bound to one state share the selection", () => {
    const selection = state.ok_w<number[]>([]);
    const a = create([item(1), item(2)], {}, false, selection);
    const b = create([item(2), item(1)], {}, false, selection);
    click(cell(rows_of(a)[0]));
    expect(selected(b)).toEqual(["item 1"]);
    click(cell(rows_of(b)[0]), { ctrlKey: true });
    expect(selection.ok()).toEqual([1, 2]);
    expect(selected(a)).toEqual(["item 1", "item 2"]);
  });

  it("writes array instructions, so only the changed keys are sent", () => {
    const container = create([item(1), item(2), item(3)]);
    const selection = bound.get(container)!;
    const writes: string[] = [];
    const real = selection.write.bind(selection);
    selection.write = (value) => {
      writes.push(
        (value as { [STATE_ARRAY_WRITE_KEY]?: { type: string } })[
          STATE_ARRAY_WRITE_KEY
        ]?.type ?? "plain",
      );
      return real(value);
    };
    const rows = rows_of(container);
    click(cell(rows[0]));
    click(cell(rows[1]), { ctrlKey: true });
    click(check(rows[2]));
    click(check(rows[0]));
    key(check(rows[0]), "a", { ctrlKey: true });
    key(check(rows[0]), "Escape");
    expect(writes).toEqual([
      "fresh",
      "push",
      "push",
      "delete",
      "fresh",
      "fresh",
    ]);
    expect(ids(container)).toEqual([]);
  });

  it("toggles leave keys of rows the list does not show in the state", () => {
    const container = create([item(1), item(2)], {}, false, state.ok_w([99]));
    const rows = rows_of(container);
    click(check(rows[0]));
    expect(ids(container)).toEqual([99, 1]);
    click(cell(rows[1]), { ctrlKey: true, shiftKey: true });
    expect(ids(container)).toEqual([99, 1, 2]);
    click(check(rows[0]));
    expect(ids(container)).toEqual([99, 2]);
    //A plain click replaces the selection
    click(cell(rows[0]));
    expect(ids(container)).toEqual([1]);
  });

  it("select all replaces the selection with the visible rows, deselect all clears it", () => {
    const container = create(
      [item(1, [item(10)]), { ...item(2), selectable: false }, item(3)],
      {},
      true,
      state.ok_w([99, 10]),
    );
    const header = container.querySelector(
      "list-headerrow > list-checkfield",
    ) as HTMLElement;
    key(key_field(rows_of(container)[0]), "a", { ctrlKey: true });
    expect(ids(container)).toEqual([1, 3]);
    click(header);
    expect(ids(container)).toEqual([]);
    write(container, [99]);
    //Nothing visible is selected, so the header selects all
    click(header);
    expect(ids(container)).toEqual([1, 3]);
  });

  it("never writes on its own, rows that go away keep their keys", () => {
    const rows = state.ok_w([
      item(1, [item(10), item(11)]),
      item(2),
      item(3),
      item(4),
    ]);
    const container = create(rows, {}, true);
    const selection = bound.get(container)!;
    rows_of(container)[0].open = true;
    write(container, [10, 2, 3, 4]);
    const keys = selection.ok();
    const updates = vi.fn();
    selection.sub(updates);
    //Closed, removed, invalid and unselectable
    rows_of(container)[0].open = false;
    rows.set_ok([
      item(1, [item(10), item(11)]),
      { ...item(3), invalid: true },
      { ...item(4), selectable: false },
    ]);
    expect(updates).not.toHaveBeenCalled();
    expect(selection.ok()).toBe(keys);
    expect(selected(container)).toEqual([]);
    //They show as selected again when they come back
    rows_of(container)[0].open = true;
    rows.set_ok([item(1, [item(10), item(11)]), item(2), item(3), item(4)]);
    rows_of(container)[0].open = true;
    expect(selected(container)).toEqual([
      "item 10",
      "item 2",
      "item 3",
      "item 4",
    ]);
  });

  it("follows the data when rows are reused for other data", () => {
    const rows = state.ok_w([item(1), item(2), item(3)]);
    const container = create(rows);
    click(cell(rows_of(container)[0]));
    //A fresh array updates the row elements by index
    rows.set_ok([item(3), item(2), item(1)]);
    expect(selected(container)).toEqual(["item 1"]);
    expect(ids(container)).toEqual([1]);
  });

  it("only touches the rows of changed keys", () => {
    const container = create(Array.from({ length: 1000 }, (_, i) => item(i)));
    write(
      container,
      Array.from({ length: 999 }, (_, i) => i),
    );
    const changed: Node[] = [];
    const observer = new MutationObserver((records) =>
      changed.push(...records.map((r) => r.target)),
    );
    observer.observe(container, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
    });
    click(check(rows_of(container)[999]));
    click(check(rows_of(container)[5]));
    observer.takeRecords().forEach((r) => changed.push(r.target));
    observer.disconnect();
    const rows = new Set(
      changed.filter((node) => (node as Element).tagName === "LIST-ROW"),
    );
    expect([...rows]).toEqual([rows_of(container)[999], rows_of(container)[5]]);
  });

  it("a rejected write changes nothing and shows why at the row", async () => {
    const selection = state.rosw<number[]>(ok([]), () =>
      Promise.resolve(err(nice_err("Not allowed"))),
    );
    const container = create([item(1), item(2)], {}, false, selection);
    const row = rows_of(container)[1];
    click(cell(row));
    const warn = container.querySelector<HTMLInputElement>("input.list-warn")!;
    await expect.poll(() => warn.validationMessage).toBe("Not allowed");
    expect(selected(container)).toEqual([]);
    //Shown at the row the user acted on
    expect(warn.getBoundingClientRect().top).toBe(
      row.anchor!.getBoundingClientRect().top,
    );
  });

  it("an async state shows the selection when it gives it back", async () => {
    const selection = state.rosw<number[]>(
      ok([]),
      (value, owner, old) =>
        new Promise((resolve) =>
          setTimeout(() => {
            state.a.read_set(
              state.a.write_apply(value, old?.ok ? [...old.value] : []),
              owner.set_ok.bind(owner),
            );
            resolve(ok(undefined));
          }, 10),
        ),
    );
    const container = create([item(1), item(2)], {}, false, selection);
    click(check(rows_of(container)[0]));
    expect(selected(container)).toEqual([]);
    await expect.poll(() => selected(container)).toEqual(["item 1"]);
    click(check(rows_of(container)[1]));
    await expect.poll(() => selection.ok()).toEqual([1, 2]);
  });

  it("an error of the state shows nothing selected", () => {
    const selection = state.from_w<number[]>([1]);
    const container = list.container(
      {
        transform: (data: Item) => ok({ values: { name: data.name } }),
        selection: { mode: "multi", key: (data) => data.id },
      },
      { columns: { name: list.column_string("Name") }, rows: [item(1)] },
    );
    container.set({ selected: selection });
    document.body.append(container);
    expect(selected(container)).toEqual(["item 1"]);
    selection.set_err(nice_err("broken"));
    expect(selected(container)).toEqual([]);
  });

  it("a list out of the document stops following the state and catches up when added", () => {
    const selection = state.ok_w<number[]>([]);
    const container = create([item(1), item(2)], {}, false, selection);
    container.remove();
    expect(selection.amount()).toBe(0);
    selection.set_ok([2]);
    document.body.append(container);
    expect(selected(container)).toEqual(["item 2"]);
  });

  it("works without a bound state", () => {
    const container = list.container(
      {
        transform: (data: Item) => ok({ values: { name: data.name } }),
        selection: { mode: "multi", key: (data) => data.id },
      },
      {
        columns: { name: list.column_string("Name") },
        rows: [item(1), item(2)],
      },
    );
    document.body.append(container);
    click(check(rows_of(container)[0]));
    click(check(rows_of(container)[1]));
    expect(selected(container)).toEqual(["item 1", "item 2"]);
    //Binding a state replaces the own one
    container.set({ selected: state.ok_w<number[]>([2]) });
    expect(selected(container)).toEqual(["item 2"]);
  });
});

describe("List selection with the keyboard", () => {
  it("arrows only move the focus in single mode, space selects", () => {
    const container = create(
      [item(1), item(2), item(3)],
      { mode: "single" },
      true,
    );
    const rows = rows_of(container);
    key(key_field(rows[0]), " ");
    expect(ids(container)).toEqual([1]);
    key(key_field(rows[0]), "ArrowDown");
    expect(document.activeElement).toBe(key_field(rows[1]));
    expect(ids(container)).toEqual([1]);
    //Shift does not extend in single mode
    key(key_field(rows[1]), "ArrowDown", { shiftKey: true });
    expect(ids(container)).toEqual([1]);
    key(key_field(rows[2]), " ");
    expect(ids(container)).toEqual([3]);
  });

  it("arrows only move the focus in multi mode, like checkboxes, shift extends", () => {
    const container = create([item(1), item(2), item(3)], {}, true);
    const rows = rows_of(container);
    key(key_field(rows[0]), " ");
    expect(ids(container)).toEqual([1]);
    key(key_field(rows[0]), "ArrowDown");
    expect(document.activeElement).toBe(key_field(rows[1]));
    expect(ids(container)).toEqual([1]);
    key(key_field(rows[1]), "ArrowDown", { shiftKey: true });
    expect(ids(container)).toEqual([1, 2, 3]);
    key(key_field(rows[2]), "ArrowUp");
    key(key_field(rows[1]), " ");
    expect(ids(container)).toEqual([1, 3]);
  });

  it("space selects and enter opens", () => {
    const container = create([item(1, [item(10)])], {}, true);
    const row = rows_of(container)[0];
    expect(key(key_field(row), " ").defaultPrevented).toBe(true);
    expect(row.open).toBe(false);
    expect(ids(container)).toEqual([1]);
    key(key_field(row), "Enter");
    expect(row.open).toBe(true);
  });

  it("ctrl a selects all and escape clears", () => {
    const container = create([item(1), item(2)], {}, true);
    const field = key_field(rows_of(container)[0]);
    key(field, "a", { ctrlKey: true });
    expect(ids(container)).toEqual([1, 2]);
    key(field, "Escape");
    expect(ids(container)).toEqual([]);
  });

  it("a click focuses the keyboard cell of the row, so keys work right away", () => {
    for (const sub_rows of [false, true]) {
      const container = create([item(1), item(2), item(3)], {}, sub_rows);
      const rows = rows_of(container);
      const cell_of = sub_rows ? key_field : check;
      click(cell(rows[1]));
      expect(document.activeElement).toBe(cell_of(rows[1]));
      //No focus ring for a click, until a key is pressed
      expect(cell_of(rows[1]).classList.contains("click-focus")).toBe(true);
      key(document.activeElement as HTMLElement, "a", { ctrlKey: true });
      expect(cell_of(rows[1]).classList.contains("click-focus")).toBe(false);
      expect(ids(container)).toEqual([1, 2, 3]);
      //The checkbox is not focusable next to a key field, the click still moves the focus
      click(check(rows[2]));
      expect(document.activeElement).toBe(cell_of(rows[2]));
      key(document.activeElement as HTMLElement, "Escape");
      expect(ids(container)).toEqual([]);
      container.remove();
    }
  });

  it("a click does not take the focus from an input in the row", () => {
    const container = list.container(
      {
        transform: (data: number) => ok({ values: { name: data } }),
        selection: { mode: "multi" },
      },
      {
        columns: {
          name: list.column({
            title: "Name",
            field_gen: () => list.node_field(document.createElement("input")),
            field_apply: () => {},
          }),
        },
        rows: [1, 2],
      },
    );
    const selection = state.ok_w<number[]>([]);
    container.set({ selected: selection });
    document.body.append(container);
    const input = container.querySelector("input")!;
    input.focus();
    click(input);
    expect(document.activeElement).toBe(input);
    expect(selection.ok()).toEqual([1]);
  });

  it("ctrl a does nothing in single mode", () => {
    const container = create([item(1), item(2)], { mode: "single" }, true);
    key(key_field(rows_of(container)[0]), "a", { ctrlKey: true });
    expect(ids(container)).toEqual([]);
  });

  it("keeps arrow navigation without selection", () => {
    const container = list.container(
      {
        transform: (data: string) => ok({ values: { name: data } }),
        sub_rows: true,
      },
      { columns: { name: list.column_string("Name") }, rows: ["a", "b"] },
    );
    document.body.append(container);
    const rows = rows_of(container);
    key(key_field(rows[0]), "ArrowDown");
    expect(document.activeElement).toBe(key_field(rows[1]));
  });
});

describe("List selection checkboxes and radio buttons", () => {
  it("toggle rows without touching the others", () => {
    const container = create([item(1), item(2), item(3)]);
    const rows = rows_of(container);
    click(check(rows[0]));
    click(check(rows[2]));
    expect(ids(container)).toEqual([1, 3]);
    click(check(rows[0]));
    expect(ids(container)).toEqual([3]);
    //Clicking the row itself still selects only it
    click(cell(rows[1]));
    expect(ids(container)).toEqual([2]);
  });

  it("show the selection with icon glyphs", () => {
    const container = create([item(1), item(2)]);
    const rows = rows_of(container);
    click(check(rows[0]));
    const glyph = (element: Element) =>
      getComputedStyle(element, "::before").content;
    expect(glyph(check(rows[0]))).toBe('"\ue834"');
    expect(glyph(check(rows[1]))).toBe('"\ue835"');
  });

  it("are the keyboard cell without sub rows, where arrows only move focus", () => {
    const container = create([item(1), item(2)]);
    const rows = rows_of(container);
    expect(check(rows[0]).tabIndex).toBe(0);
    check(rows[0]).focus();
    key(check(rows[0]), "ArrowDown");
    expect(document.activeElement).toBe(check(rows[1]));
    expect(ids(container)).toEqual([]);
    key(check(rows[1]), " ");
    key(check(rows[1]), "ArrowUp");
    key(check(rows[0]), " ");
    expect(ids(container)).toEqual([2, 1]);
  });

  it("header checkbox selects all, clears and shows some or all", () => {
    const container = create([item(1), item(2)]);
    const header = container.querySelector(
      "list-headerrow > list-checkfield",
    ) as HTMLElement;
    click(header);
    expect(ids(container)).toEqual([1, 2]);
    expect(header.className).toBe("some all");
    click(check(rows_of(container)[0]));
    expect(header.classList.contains("some")).toBe(true);
    expect(header.classList.contains("all")).toBe(false);
    click(header);
    expect(ids(container)).toEqual([]);
    expect(header.classList.contains("some")).toBe(false);
  });

  it("are in the first grid column in front of the key fields", () => {
    const container = create([item(1, [item(10)])], {}, true);
    const row = rows_of(container)[0];
    row.open = true;
    const left = (element: Element) => element.getBoundingClientRect().left;
    expect(left(check(row))).toBeLessThan(left(key_field(row)));
    const sub = rows_of(container)[1];
    expect(left(key_field(sub))).toBe(left(key_field(row)));
    expect(left(cell(sub))).toBe(left(cell(row)));
  });

  it("keep the row height for unselectable rows without a glyph", () => {
    const container = create([{ ...item(1), selectable: false }, item(2)]);
    const [a, b] = rows_of(container).map(
      (row) => check(row).getBoundingClientRect().height,
    );
    expect(a).toBe(b);
  });

  it("are radio buttons in single mode, clicking one selects only it", () => {
    const container = create([item(1), item(2)], { mode: "single" });
    const rows = rows_of(container);
    click(check(rows[0]));
    click(check(rows[1]));
    click(check(rows[1]));
    expect(ids(container)).toEqual([2]);
    const glyph = (element: Element) =>
      getComputedStyle(element, "::before").content;
    expect(glyph(check(rows[0]))).toBe('"\ue836"');
    expect(glyph(check(rows[1]))).toBe('"\ue837"');
    //No select all in the header
    const header = container.querySelector(
      "list-headerrow > list-checkfield",
    ) as HTMLElement;
    click(header);
    expect(ids(container)).toEqual([2]);
    expect(glyph(header)).toBe("none");
  });

  it("header checkbox has a menu to select all and deselect all", () => {
    const container = create([item(1), item(2), item(3)]);
    const header = container.querySelector(
      "list-headerrow > list-checkfield",
    ) as HTMLElement;
    const menu_click = (text: string) => {
      header.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
      );
      const options = [
        ...document.documentElement.querySelectorAll("contextmenu-option"),
      ] as HTMLElement[];
      expect(options.map((o) => o.textContent)).toEqual([
        "Select allCtrl+A",
        "Deselect allEsc",
      ]);
      options.find((o) => o.textContent.startsWith(text))!.click();
    };
    click(cell(rows_of(container)[1]));
    menu_click("Select all");
    expect(ids(container)).toEqual([1, 2, 3]);
    menu_click("Deselect all");
    expect(ids(container)).toEqual([]);
    expect(
      document.documentElement.querySelector("contextmenu-option"),
    ).toBeNull();
  });

  it("single mode has no header menu", () => {
    const container = create([item(1)], { mode: "single" });
    container
      .querySelector("list-headerrow > list-checkfield")!
      .dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
      );
    expect(
      document.documentElement.querySelector("contextmenu-option"),
    ).toBeNull();
  });

  it("are left out in single mode with a key column, the row and its key field select", () => {
    const container = create([item(1), item(2)], { mode: "single" }, true);
    const rows = rows_of(container);
    expect(container.querySelector("list-checkfield")).toBeNull();
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.gridTemplateColumns).toBe("max-content auto");
    expect(key_field(rows[0]).getBoundingClientRect().left).toBe(
      container.getBoundingClientRect().left,
    );
    click(cell(rows[0]));
    expect(ids(container)).toEqual([1]);
    expect(document.activeElement).toBe(key_field(rows[0]));
    key(key_field(rows[0]), "ArrowDown");
    key(key_field(rows[1]), " ");
    expect(ids(container)).toEqual([2]);
  });

  it("stay in multi mode with a key column", () => {
    const container = create([item(1), item(2)], {}, true);
    expect(check(rows_of(container)[0])).not.toBeNull();
    expect(
      container.querySelector("list-headerrow > list-checkfield"),
    ).not.toBeNull();
  });

  it("are the keyboard cell without sub rows in single mode too", () => {
    const container = create([item(1), item(2)], { mode: "single" });
    const rows = rows_of(container);
    expect(check(rows[0]).tabIndex).toBe(0);
    key(check(rows[0]), " ");
    key(check(rows[0]), "ArrowDown");
    expect(document.activeElement).toBe(check(rows[1]));
    expect(ids(container)).toEqual([1]);
    key(check(rows[1]), " ");
    expect(ids(container)).toEqual([2]);
  });
});

describe("List selection in the row menu", () => {
  const right_click = (element: HTMLElement) =>
    element.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
  const options = () =>
    [
      ...document.documentElement.querySelectorAll("contextmenu-option"),
    ] as HTMLElement[];
  const texts = () => options().map((o) => o.textContent);
  const choose = (text: string) =>
    options()
      .find((o) => o.textContent.startsWith(text))!
      .click();

  it("right click only opens the menu, on the row or its checkbox or radio button", () => {
    for (const mode of ["multi", "single"] as const) {
      const container = create([{ ...item(1), menu: true }, item(2)], { mode });
      const rows = rows_of(container);
      const expected =
        mode === "multi"
          ? ["Select", "Select allCtrl+A", "Deselect allEsc", "Line"]
          : ["Select", "Line"];
      //The own menu is a menu instance, its lines go back to it after every open
      for (const target of [cell(rows[0]), check(rows[0]), cell(rows[0])]) {
        right_click(target);
        expect(texts()).toEqual(expected);
        choose("Line");
      }
      expect(ids(container)).toEqual([]);
      container.remove();
    }
  });

  it("has select lines in front of the own lines, built when it opens", () => {
    const container = create([
      { ...item(1), menu_fn: true },
      { ...item(2), menu_fn: true },
    ]);
    const rows = rows_of(container);
    click(cell(rows[0]));
    right_click(cell(rows[1]));
    expect(texts()).toEqual([
      "Select",
      "Select allCtrl+A",
      "Deselect allEsc",
      "Own",
    ]);
    choose("Select");
    expect(ids(container)).toEqual([1, 2]);
    right_click(cell(rows[1]));
    expect(texts()).toEqual([
      "Deselect",
      "Select allCtrl+A",
      "Deselect allEsc",
      "Own",
    ]);
    expect(
      document.documentElement.querySelector("contextmenu-divider"),
    ).not.toBeNull();
    choose("Deselect");
    expect(ids(container)).toEqual([1]);
    right_click(check(rows[1]));
    choose("Select all");
    expect(ids(container)).toEqual([1, 2]);
    right_click(cell(rows[0]));
    choose("Deselect all");
    expect(ids(container)).toEqual([]);
  });

  it("single mode has only select or deselect, select replaces the selection", () => {
    const container = create(
      [
        { ...item(1), menu_fn: true },
        { ...item(2), menu_fn: true },
      ],
      { mode: "single" },
    );
    const rows = rows_of(container);
    click(cell(rows[0]));
    right_click(check(rows[1]));
    expect(texts()).toEqual(["Select", "Own"]);
    choose("Select");
    expect(ids(container)).toEqual([2]);
  });

  it("unselectable rows show only the own lines, or no menu without them", () => {
    const container = create([
      { ...item(1), menu_fn: true, selectable: false },
      { ...item(2), selectable: false },
    ]);
    right_click(cell(rows_of(container)[0]));
    expect(texts()).toEqual(["Own"]);
    choose("Own");
    right_click(cell(rows_of(container)[1]));
    expect(options()).toEqual([]);
  });

  it("selectable rows without an own menu get a menu with the select lines", () => {
    const container = create([item(1)], { mode: "single" });
    right_click(cell(rows_of(container)[0]));
    expect(texts()).toEqual(["Select"]);
    choose("Select");
    expect(ids(container)).toEqual([1]);
  });

  it("a list without selection uses the row menu as it is", () => {
    const menu = ctm.menu([ctm.line({ text: "Plain", on_click: () => {} })]);
    const container = list.container(
      {
        transform: (data: string) =>
          ok({ context_menu: menu, values: { name: data } }),
      },
      { columns: { name: list.column_string("Name") }, rows: ["a"] },
    );
    document.body.append(container);
    right_click(cell(rows_of(container)[0]));
    expect(menu.isConnected).toBe(true);
    choose("Plain");
  });

  it("openable rows get open or close in front, with or without selection", () => {
    const container = create(
      [{ ...item(1, [item(10)]), menu: true }, item(2)],
      { mode: "single" },
      true,
    );
    const row = rows_of(container)[0];
    right_click(cell(row));
    expect(texts()).toEqual(["Open", "Select", "Line"]);
    choose("Open");
    expect(row.open).toBe(true);
    right_click(cell(row));
    expect(texts()[0]).toBe("Close");
    choose("Close");
    expect(row.open).toBe(false);
    //A row that can not be opened has no open line
    right_click(cell(rows_of(container)[1]));
    expect(texts()).toEqual(["Select"]);
    choose("Select");

    const plain = list.container(
      {
        transform: (data: Item) =>
          ok({
            openable: Boolean(data.sub),
            sub_rows: () => data.sub ?? [],
            values: { name: data.name },
          }),
        sub_rows: true,
      },
      {
        columns: { name: list.column_string("Name") },
        rows: [item(1, [item(10)]), item(2)],
      },
    );
    document.body.append(plain);
    right_click(cell(rows_of(plain)[0]));
    expect(texts()).toEqual(["Open"]);
    choose("Open");
    expect(rows_of(plain).length).toBe(3);
    //Not openable and nothing else gives only close all while a row is open
    right_click(cell(rows_of(plain)[2]));
    expect(texts()).toEqual(["Close all"]);
    choose("Close all");
    right_click(cell(rows_of(plain)[1]));
    expect(options()).toEqual([]);
  });

  it("follows an openable state", () => {
    const openable = state.ok_w(false);
    const container = list.container(
      {
        transform: (data: Item) =>
          ok({
            openable,
            sub_rows: () => data.sub ?? [],
            values: { name: data.name },
          }),
        sub_rows: true,
      },
      {
        columns: { name: list.column_string("Name") },
        rows: [item(1, [item(10)])],
      },
    );
    document.body.append(container);
    const row = rows_of(container)[0];
    right_click(cell(row));
    expect(options()).toEqual([]);
    openable.set_ok(true);
    right_click(cell(row));
    expect(texts()).toEqual(["Open"]);
    choose("Open");
    expect(row.open).toBe(true);
  });
});

describe("List selection of a row that can not be selected", () => {
  const warning = (container: HTMLElement) =>
    container.querySelector<HTMLInputElement>("input.list-warn")
      ?.validationMessage ?? "";

  it("warns when the row is clicked", () => {
    const container = create([{ ...item(1), selectable: false }]);
    click(cell(rows_of(container)[0]));
    expect(warning(container)).toBe("Not selectable");
    expect(ids(container)).toEqual([]);
  });

  it("moves the focus before the warning, the browser closes the warning when the focus moves", () => {
    for (const sub_rows of [false, true]) {
      const container = create(
        [{ ...item(1), selectable: false }],
        {},
        sub_rows,
      );
      const row = rows_of(container)[0];
      const shown_with = vi.spyOn(HTMLInputElement.prototype, "reportValidity");
      let focus_at_warning: Element | null = null;
      shown_with.mockImplementation(function (this: HTMLInputElement) {
        focus_at_warning = document.activeElement;
        return false;
      });
      for (const target of [cell(row), check(row)].filter(Boolean)) {
        focus_at_warning = null;
        (document.activeElement as HTMLElement | null)?.blur();
        click(target);
        expect(focus_at_warning).not.toBeNull();
        expect(document.activeElement).toBe(focus_at_warning);
      }
      shown_with.mockRestore();
      container.remove();
    }
  });

  it("warns when its checkbox or radio button cell is clicked", () => {
    const container = create([{ ...item(1), selectable: false }]);
    click(check(rows_of(container)[0]));
    expect(warning(container)).toBe("Not selectable");
  });

  it("warns on space in its keyboard cell", () => {
    const container = create([{ ...item(1), selectable: false }], {}, true);
    key(key_field(rows_of(container)[0]), " ");
    expect(warning(container)).toBe("Not selectable");
  });

  it("warns for an invalid row", () => {
    const container = create([{ ...item(1), invalid: true }]);
    click(rows_of(container)[0].querySelector("list-error")!);
    expect(warning(container)).toBe("Not selectable");
  });
});

describe("List selection of a row that can only be opened", () => {
  const warning = (container: HTMLElement) =>
    container.querySelector<HTMLInputElement>("input.list-warn")
      ?.validationMessage ?? "";
  /**A folder that can not be selected, with a selectable sub row */
  const folder = () =>
    create(
      [{ ...item(1, [item(10)]), selectable: false }],
      { mode: "single" },
      true,
    );
  const click_count = (element: HTMLElement, detail: number) =>
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, detail }),
    );

  it("opens and closes with a click on the row, without a warning", () => {
    const container = folder();
    const row = rows_of(container)[0];
    click(cell(row));
    expect(row.open).toBe(true);
    expect(warning(container)).toBe("");
    click(cell(row));
    expect(row.open).toBe(false);
    expect(ids(container)).toEqual([]);
  });

  it("stays open after a double click, the second click of it is ignored", () => {
    const container = folder();
    const row = rows_of(container)[0];
    click_count(cell(row), 1);
    click_count(cell(row), 2);
    expect(row.open).toBe(true);
    //A later single click closes it again
    click_count(cell(row), 1);
    expect(row.open).toBe(false);
  });

  it("opens and closes with space in its key field, without a warning", () => {
    const container = folder();
    const row = rows_of(container)[0];
    key(key_field(row), " ");
    expect(row.open).toBe(true);
    key(key_field(row), " ");
    expect(row.open).toBe(false);
    expect(warning(container)).toBe("");
  });

  it("writes its opened state when a click or space opens and closes it", () => {
    const opened = state.ok_w(false);
    const container = create(
      [{ ...item(1, [item(10)]), selectable: false, opened }],
      { mode: "single" },
      true,
    );
    const row = rows_of(container)[0];
    click(cell(row));
    expect(opened.get().value).toBe(true);
    expect(row.open).toBe(true);
    click(cell(row));
    expect(opened.get().value).toBe(false);
    expect(row.open).toBe(false);
    key(key_field(row), " ");
    expect(opened.get().value).toBe(true);
    expect(row.open).toBe(true);
  });

  it("still warns for a click on its checkbox", () => {
    const container = create(
      [{ ...item(1, [item(10)]), selectable: false }],
      { mode: "multi" },
      true,
    );
    const row = rows_of(container)[0];
    click(check(row));
    expect(row.open).toBe(false);
    expect(warning(container)).toBe("Not selectable");
  });
});
