import { err, ok } from "@chocbite/ts-lib/result";
import { state, type State } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import list from ".";
import type { ListTextField } from "./field";
import { ListRow } from "./row";

type SubRow = ListRow<number, { col: string }, number[], true>;

const text_column = (title: string, field_gen: () => ListTextField) =>
  list.column({
    title,
    field_gen,
    field_apply: (field, value: string) => (field.text = value),
  });

const error_of = (element: Element) =>
  element.querySelector("list-error")?.textContent;

const key_field_of = (row: Element) =>
  row.querySelector<HTMLElement>(":scope > div > list-keyfield")!;

const press = (element: HTMLElement, key: string) =>
  element.dispatchEvent(new KeyboardEvent("keydown", { key }));

/**List where the items in the map are invalid with the given text */
function plain_list(
  rows: number[] | State<number[]>,
  invalid: Map<number, string> = new Map(),
) {
  const field_gen = vi.fn(() => list.text_field());
  const container = list.container(
    { col: text_column("Column", field_gen) },
    (item: number) => {
      const text = invalid.get(item);
      return text === undefined
        ? ok({ values: { col: item.toString() } })
        : err(text);
    },
    rows,
  );
  document.body.append(container);
  return { container, field_gen };
}

/**List with sub rows, top level rows are openable and the items in the map are invalid */
function sub_list(
  rows: number[],
  sub_rows: () => number[] | State<number[]>,
  invalid: Map<number, string> = new Map(),
) {
  const by_item = new Map<number, SubRow>();
  const container = list.container(
    { col: list.column_string("Column") },
    (item, row) => {
      by_item.set(item, row);
      const text = invalid.get(item);
      if (text !== undefined) return err(text);
      return ok({
        openable: row.depth === 0,
        sub_rows,
        add_row: row.depth === 0 ? { text: "Add", on_add() {} } : undefined,
        values: { col: item.toString() },
      });
    },
    rows,
    { sub_rows: true },
  );
  document.body.append(container);
  return { container, row: (item: number) => by_item.get(item)! };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("List container state error", () => {
  it("shows the error text instead of the rows", async () => {
    const rows = state.from_w([1, 2]);
    const { container } = plain_list(rows);
    await expect.poll(() => container.amount_rows()).toBe(2);
    rows.set_err("Read failed");
    await expect.poll(() => error_of(container)).toBe("Read failed");
    expect(container.amount_rows()).toBe(0);
  });

  it("shows an error state from the start", async () => {
    const { container } = plain_list(state.err_w<number[]>("No data"));
    await expect.poll(() => error_of(container)).toBe("No data");
  });

  it("removes the error and shows the rows when the state recovers", async () => {
    const rows = state.from_w([1, 2]);
    const { container } = plain_list(rows);
    rows.set_err("Read failed");
    await expect.poll(() => error_of(container)).toBe("Read failed");
    rows.set_ok([3]);
    await expect.poll(() => container.amount_rows()).toBe(1);
    expect(error_of(container)).toBeUndefined();
  });

  it("updates the text and keeps one element for a new error", async () => {
    const rows = state.err_w<number[]>("First");
    const { container } = plain_list(rows);
    await expect.poll(() => error_of(container)).toBe("First");
    rows.set_err("Second");
    await expect.poll(() => error_of(container)).toBe("Second");
    expect(container.querySelectorAll("list-error").length).toBe(1);
  });

  it("removes the error when given an array instead of the state", async () => {
    const { container } = plain_list(state.err_w<number[]>("No data"));
    await expect.poll(() => error_of(container)).toBe("No data");
    container.rows = [1];
    expect(error_of(container)).toBeUndefined();
    expect(container.amount_rows()).toBe(1);
  });

  it("keeps the add row", async () => {
    const container = list.container(
      { col: list.column_string("Column") },
      (item: number) => ok({ values: { col: item.toString() } }),
      state.err_w<number[]>("No data"),
      { add_row: { text: "Add", on_add() {} } },
    );
    document.body.append(container);
    await expect.poll(() => error_of(container)).toBe("No data");
    expect(container.querySelector("list-addrow")).not.toBeNull();
  });

  it("does not parse the text as markup", async () => {
    const { container } = plain_list(state.err_w<number[]>("<b>bold</b>"));
    await expect.poll(() => error_of(container)).toBe("<b>bold</b>");
    expect(container.querySelector("b")).toBeNull();
  });

  it("shows an empty error as an error", async () => {
    const { container } = plain_list(state.err_w<number[]>(""));
    await expect
      .poll(() => container.querySelector("list-error"))
      .not.toBeNull();
  });
});

describe("List invalid rows", () => {
  it("replaces only the invalid row with the text", () => {
    const { container } = plain_list(
      [1, 2],
      new Map([[2, "Bad row"]]),
    );
    const [valid, invalid] = container.querySelectorAll("list-row");
    expect(valid.textContent).toBe("1");
    expect(invalid.textContent).toBe("Bad row");
    expect(invalid.querySelector("list-textfield")).toBeNull();
    expect(container.amount_rows()).toBe(2);
  });

  it("goes from valid to invalid and back without new fields", () => {
    const invalid = new Map<number, string>();
    const { container, field_gen } = plain_list([1], invalid);
    expect(field_gen).toHaveBeenCalledTimes(1);

    invalid.set(1, "Bad row");
    container.rows = [1];
    expect(container.querySelector("list-row")!.textContent).toBe("Bad row");

    invalid.clear();
    container.rows = [1];
    expect(container.querySelector("list-row")!.textContent).toBe("1");
    expect(error_of(container)).toBeUndefined();
    expect(field_gen).toHaveBeenCalledTimes(1);
  });

  it("updates the text of a row that stays invalid", () => {
    const invalid = new Map([[1, "First"]]);
    const { container } = plain_list([1], invalid);
    invalid.set(1, "Second");
    container.rows = [1];
    expect(error_of(container)).toBe("Second");
    expect(container.querySelectorAll("list-error").length).toBe(1);
  });

  it("keeps the text when the columns change, and uses the new columns on recovery", () => {
    const invalid = new Map([[1, "Bad row"]]);
    const { container, field_gen } = plain_list([1], invalid);
    container.columns = { col: text_column("New", field_gen) };
    expect(error_of(container)).toBe("Bad row");

    invalid.clear();
    container.rows = [1];
    expect(container.querySelector("list-row")!.textContent).toBe("1");
    expect(container.querySelectorAll("list-textfield").length).toBe(1);
  });

  it("keeps the key field in lists with sub rows", () => {
    const { row } = sub_list([1], () => [], new Map([[1, "Bad row"]]));
    expect(key_field_of(row(1))).not.toBeNull();
    expect(error_of(row(1))).toBe("Bad row");
    expect(row(1).openable).toBe(false);
  });

  it("closes the sub rows and removes the add row when a row turns invalid", () => {
    const invalid = new Map<number, string>();
    const { container, row } = sub_list([1], () => [10, 11], invalid);
    row(1).open = true;
    expect(row(1).amount_rows()).toBe(2);
    expect(row(1).querySelector("list-addrow")).not.toBeNull();

    invalid.set(1, "Bad row");
    container.rows = [1];
    expect(row(1).open).toBe(false);
    expect(row(1).amount_rows()).toBe(0);
    expect(row(1).openable).toBe(false);
    expect(row(1).querySelector("list-addrow")).toBeNull();
  });

  it("can be opened again after recovering", () => {
    const invalid = new Map([[1, "Bad row"]]);
    const { container, row } = sub_list([1], () => [10], invalid);
    invalid.clear();
    container.rows = [1];
    expect(row(1).openable).toBe(true);
    row(1).open = true;
    expect(row(1).amount_rows()).toBe(1);
  });

  it("can be moved through with the arrow keys", () => {
    const { row } = sub_list([1, 2, 3], () => [], new Map([[2, "Bad row"]]));
    key_field_of(row(1)).focus();
    press(key_field_of(row(1)), "ArrowDown");
    expect(document.activeElement).toBe(key_field_of(row(2)));
    press(key_field_of(row(2)), "ArrowDown");
    expect(document.activeElement).toBe(key_field_of(row(3)));
  });
});

describe("List sub row state error", () => {
  const failing = async () => {
    const sub = state.err_w<number[]>("Sub rows failed");
    const lists = sub_list([1, 2], () => sub);
    lists.row(1).open = true;
    await expect.poll(() => error_of(lists.row(1))).toBe("Sub rows failed");
    return { ...lists, sub };
  };

  it("shows the error text under the open row", async () => {
    const { row } = await failing();
    expect(row(1).open).toBe(true);
    expect(row(1).amount_rows()).toBe(0);
  });

  it("removes the error when the row is closed", async () => {
    const { row } = await failing();
    row(1).open = false;
    expect(error_of(row(1))).toBeUndefined();
    expect(row(1).open).toBe(false);
  });

  it("shows the sub rows when the state recovers", async () => {
    const { row, sub } = await failing();
    sub.set_ok([10, 11]);
    await expect.poll(() => row(1).amount_rows()).toBe(2);
    expect(error_of(row(1))).toBeUndefined();
    expect(row(1).open).toBe(true);
  });

  it("continues the tree lines with a key field one level deeper", async () => {
    const { row } = await failing();
    const key_field = row(1).querySelector(
      ":scope > list-rowserror > list-keyfield",
    )!;
    expect(key_field.querySelectorAll(":scope > div").length).toBe(
      row(1).depth + 1,
    );
  });

  it("has a key field at the top level of a list with sub rows only", async () => {
    const with_sub_rows = list.container(
      { col: list.column_string("Column") },
      (item: number) => ok({ values: { col: item.toString() } }),
      state.err_w<number[]>("No data"),
      { sub_rows: true },
    );
    document.body.append(with_sub_rows);
    await expect.poll(() => error_of(with_sub_rows)).toBe("No data");
    const key_field = with_sub_rows.querySelector("list-rowserror > list-keyfield")!;
    expect(key_field.querySelectorAll(":scope > div").length).toBe(0);

    const { container } = plain_list(state.err_w<number[]>("No data"));
    await expect.poll(() => error_of(container)).toBe("No data");
    expect(container.querySelector("list-rowserror > list-keyfield")).toBeNull();
  });

  it("skips the error with the arrow keys", async () => {
    const { row } = await failing();
    key_field_of(row(1)).focus();
    press(key_field_of(row(1)), "ArrowDown");
    expect(document.activeElement).toBe(key_field_of(row(2)));
    press(key_field_of(row(2)), "ArrowUp");
    expect(document.activeElement).toBe(key_field_of(row(1)));
  });
});
