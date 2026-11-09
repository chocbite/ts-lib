import { BaseIntersectObserver } from "#base";
import ctm from "#context-menu";
import { px_to_rem } from "#theme";
import { none, ok } from "@chocbite/ts-lib/result";
import { state, type State } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import list from ".";
import { ListAddRow } from "./add_row";
import { ListField } from "./field";
import { ListKeyField } from "./key_field";
import { ListRow } from "./row";

type AnyRow = ListRow<any, any, any, any>;

afterEach(() => {
  document.body.replaceChildren();
});

/**The grid box inside the container */
function box_of(container: HTMLElement): HTMLDivElement {
  return container.firstElementChild as HTMLDivElement;
}

/**The header row of the container, undefined when headless */
function header_of(container: HTMLElement): HTMLElement | undefined {
  const first = box_of(container).firstElementChild;
  return first && first.tagName !== "DIV" ? (first as HTMLElement) : undefined;
}

/**The top level rows of the container */
function rows_of(container: HTMLElement): AnyRow[] {
  const child_box = [...box_of(container).children].find(
    (e) => e.tagName === "DIV",
  )!;
  return [...child_box.children] as AnyRow[];
}

/**The add row of the container, if any */
function add_row_of(container: HTMLElement): ListAddRow<any, any, any, any> {
  return [...box_of(container).children].find(
    (e) => e instanceof ListAddRow,
  ) as ListAddRow<any, any, any, any>;
}

/**The text of every column field in the row */
function cells(row: Element): string[] {
  return [...row.firstElementChild!.children]
    .filter((e) => e instanceof ListField)
    .map((e) => e.textContent);
}

/**The first column text of every top level row */
function texts(container: HTMLElement): string[] {
  return rows_of(container).map((r) => cells(r)[0]);
}

function header_texts(container: HTMLElement): string[] {
  return [...header_of(container)!.children].map((e) => e.textContent);
}

function number_list(
  rows: number[] | State<number[]>,
  options?: Parameters<typeof list.container>[3],
) {
  const container = list.container(
    { col: list.column_string("Column") },
    (item: number) => ok({ values: { col: item.toString() } }),
    rows,
    options,
  );
  document.body.append(container);
  return container;
}

describe("List container", () => {
  it("uses the given intersection observer for its fields", () => {
    const observer = new BaseIntersectObserver({});
    const observe = vi.spyOn(observer, "observe");
    document.body.append(
      list.container(
        { col: list.column_string("Column") },
        (item: number) => ok({ values: { col: item.toString() } }),
        [1, 2],
        { observer },
      ),
    );
    expect(observe).toHaveBeenCalled();
  });

  it("observes every field and the key fields with the intersection observer", () => {
    const observer = new BaseIntersectObserver({});
    const observe = vi.spyOn(observer, "observe");
    document.body.append(
      list.container(
        { a: list.column_string("A"), b: list.column_string("B") },
        (item: number) => ok({
          values: { a: item.toString(), b: item.toString() },
        }),
        [1, 2],
        { observer, sub_rows: true },
      ),
    );
    const observed = observe.mock.calls.map((c) => c[0]);
    expect(observed.filter((e) => e instanceof ListField)).toHaveLength(4);
    expect(observed.filter((e) => e instanceof ListKeyField)).toHaveLength(2);
  });

  it("unobserves fields of a removed row", () => {
    const observer = new BaseIntersectObserver({});
    const unobserve = vi.spyOn(observer, "unobserve");
    const rows = state.ok_w([1, 2]);
    number_list(rows, { observer });
    rows.array.pop();
    expect(unobserve).toHaveBeenCalledOnce();
  });

  it("does not observe anything without an observer", () => {
    const observe = vi.spyOn(BaseIntersectObserver.prototype, "observe");
    number_list([1, 2]);
    expect(observe).not.toHaveBeenCalled();
    observe.mockRestore();
  });
});

describe("List container header and columns", () => {
  it("renders a header field per column with the column title", () => {
    const container = list.container(
      { a: list.column_string("First"), b: list.column_string("Second") },
      (item: number) => ok({ values: { a: `${item}a`, b: `${item}b` } }),
      [1],
    );
    document.body.append(container);
    expect(header_texts(container)).toEqual(["First", "Second"]);
    expect(cells(rows_of(container)[0])).toEqual(["1a", "1b"]);
  });

  it("omits the header row when headless", () => {
    const container = number_list([1, 2], { headless: true });
    expect(header_of(container)).toBeUndefined();
    expect(texts(container)).toEqual(["1", "2"]);
  });

  it("adds an empty header field and a min-content grid column for sub rows", () => {
    const container = number_list([1], { sub_rows: true });
    expect(header_texts(container)).toEqual(["", "Column"]);
    expect(box_of(container).style.gridTemplateColumns).toBe(
      "min-content auto",
    );
    expect(box_of(container).classList.contains("sub-rows")).toBe(true);
  });

  it("sets grid column widths from the column options", () => {
    const container = list.container(
      {
        auto: list.column({
          title: "Auto",
          field_gen: () => list.text_field(),
          field_apply: () => {},
        }),
        init: list.column({
          title: "Init",
          init_width: 10,
          field_gen: () => list.text_field(),
          field_apply: () => {},
        }),
        tiny: list.column({
          title: "Tiny",
          init_width: 0.5,
          field_gen: () => list.text_field(),
          field_apply: () => {},
        }),
        min: list.column({
          title: "Min",
          fixed_width: "min",
          field_gen: () => list.text_field(),
          field_apply: () => {},
        }),
        max: list.column({
          title: "Max",
          fixed_width: "max",
          field_gen: () => list.text_field(),
          field_apply: () => {},
        }),
        fixed: list.column({
          title: "Fixed",
          init_width: 20,
          fixed_width: 4,
          field_gen: () => list.text_field(),
          field_apply: () => {},
        }),
      },
      () => ok({
        values: {
          auto: undefined,
          init: undefined,
          tiny: undefined,
          min: undefined,
          max: undefined,
          fixed: undefined,
        },
      }),
      [],
    );
    document.body.append(container);
    expect(box_of(container).style.gridTemplateColumns).toBe(
      "auto 10rem 1rem min-content max-content 4rem",
    );
  });

  it("only gives resize handles to columns without a fixed width", () => {
    const container = list.container(
      {
        a: list.column_string("A"),
        b: list.column({
          title: "B",
          fixed_width: 5,
          field_gen: () => list.text_field(),
          field_apply: (f, v: string) => (f.text = v),
        }),
      },
      () => ok({ values: { a: "", b: "" } }),
      [],
    );
    document.body.append(container);
    const [a, b] = [...header_of(container)!.children];
    expect(a.firstElementChild!.childElementCount).toBe(2);
    expect(b.firstElementChild!.childElementCount).toBe(1);
  });

  it("resizes a column by dragging its handle and resets on double press", () => {
    const container = number_list([1, 2]);
    const field = header_of(container)!.firstElementChild as HTMLElement;
    field.setPointerCapture = () => {};
    field.releasePointerCapture = () => {};
    const field_box = field.firstElementChild as HTMLElement;
    const sizer = field_box.lastElementChild as HTMLElement;
    const start_width = field_box.offsetWidth;

    sizer.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 100, pointerId: 1 }),
    );
    field.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 150, pointerId: 1 }),
    );
    field.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    const width = Math.max(px_to_rem(start_width + 50), 1);
    expect(parseFloat(box_of(container).style.gridTemplateColumns)).toBeCloseTo(
      width,
    );

    //Moving after release does nothing
    field.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 500, pointerId: 1 }),
    );
    expect(parseFloat(box_of(container).style.gridTemplateColumns)).toBeCloseTo(
      width,
    );

    //Second press within 300ms resets to auto
    sizer.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 100, pointerId: 1 }),
    );
    expect(box_of(container).style.gridTemplateColumns).toBe("auto");
  });

  it("does not write a resized width into the given column options", () => {
    const col = list.column_string("Column");
    const container = list.container(
      { col },
      (item: number) => ok({ values: { col: item.toString() } }),
      [1],
    );
    document.body.append(container);
    const field = header_of(container)!.firstElementChild as HTMLElement;
    field.setPointerCapture = () => {};
    field.releasePointerCapture = () => {};
    const sizer = field.firstElementChild!.lastElementChild as HTMLElement;
    sizer.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 100, pointerId: 1 }),
    );
    field.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 150, pointerId: 1 }),
    );
    field.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    expect(box_of(container).style.gridTemplateColumns).not.toBe("auto");
    expect(col.init_width).toBeUndefined();
  });

  it("orders columns by their order option", () => {
    const container = list.container(
      {
        a: list.column({
          title: "A",
          order: 2,
          field_gen: () => list.text_field(),
          field_apply: (f, v: string) => (f.text = v),
        }),
        b: list.column({
          title: "B",
          order: 1,
          field_gen: () => list.text_field(),
          field_apply: (f, v: string) => (f.text = v),
        }),
      },
      () => ok({ values: { a: "a", b: "b" } }),
      [1],
    );
    document.body.append(container);
    expect(header_texts(container)).toEqual(["B", "A"]);
    expect(cells(rows_of(container)[0])).toEqual(["b", "a"]);
  });

  it("rebuilds existing rows when the columns are replaced", () => {
    const a = list.column_string("A");
    const b = list.column_string("B");
    const container = list.container(
      { a, b },
      () => ok({ values: { a: "a", b: "b" } }),
      [1],
    );
    document.body.append(container);
    container.columns = { b, a };
    expect(header_texts(container)).toEqual(["B", "A"]);
    expect(cells(rows_of(container)[0])).toEqual(["b", "a"]);
  });
});

describe("List container rows from arrays", () => {
  it("renders a row per item with the transformed values", () => {
    const container = number_list([1, 2, 3]);
    expect(texts(container)).toEqual(["1", "2", "3"]);
    expect(container.amount_rows()).toBe(3);
  });

  it("renders no rows for an empty array", () => {
    const container = number_list([]);
    expect(container.amount_rows()).toBe(0);
  });

  it("reuses existing rows when given a new longer array", () => {
    const container = number_list([1, 2]);
    const before = rows_of(container);
    container.rows = [5, 6, 7];
    expect(texts(container)).toEqual(["5", "6", "7"]);
    expect(rows_of(container).slice(0, 2)).toEqual(before);
  });

  it("removes surplus rows when given a new shorter array", () => {
    const container = number_list([1, 2, 3, 4]);
    const first = rows_of(container)[0];
    container.rows = [9];
    expect(texts(container)).toEqual(["9"]);
    expect(rows_of(container)[0]).toBe(first);
    container.rows = [];
    expect(container.amount_rows()).toBe(0);
  });

  it("calls the transformer with the item, the row and the rows", () => {
    const rows = [4, 5];
    const transform = vi.fn((item: number, _row: unknown, _rows: unknown) => ok({
      values: { col: item.toString() },
    }));
    document.body.append(
      list.container({ col: list.column_string("Col") }, transform, rows),
    );
    expect(transform).toHaveBeenCalledTimes(2);
    expect(transform.mock.calls[0][0]).toBe(4);
    expect(transform.mock.calls[0][1]).toBeInstanceOf(ListRow);
    expect(transform.mock.calls[0][2]).toBe(rows);
    expect(transform.mock.calls[1][0]).toBe(5);
  });

  it("gives top level rows depth 0 and their index", () => {
    const container = number_list([1, 2, 3]);
    expect(rows_of(container).map((r) => r.depth)).toEqual([0, 0, 0]);
    expect(rows_of(container).map((r) => r.index)).toEqual([0, 1, 2]);
  });

  it("counts sub rows recursively", () => {
    const container = list.container(
      { col: list.column_string("Col") },
      (item: number, row) => ok({
        openable: true,
        opened: row.depth < 2,
        sub_rows: () => [item * 10, item * 10 + 1],
        values: { col: item.toString() },
      }),
      [1, 2],
      { sub_rows: true },
    );
    document.body.append(container);
    expect(container.amount_rows()).toBe(2);
    //2 top, 4 depth 1, 8 depth 2
    expect(container.amount_rows(true)).toBe(14);
  });

  it("attaches the context menu given by the transformer to the row", () => {
    const container = list.container(
      { col: list.column_string("Col") },
      (item: number) => ok({
        context_menu:
          item === 1 ? ctm.menu([ctm.line("Do", () => {})]) : undefined,
        values: { col: item.toString() },
      }),
      [1, 2],
    );
    document.body.append(container);
    const [one, two] = rows_of(container);
    expect(ctm.has(one)).toBe(true);
    expect(ctm.has(two)).toBe(false);
    container.rows = [2, 1];
    expect(ctm.has(one)).toBe(false);
    expect(ctm.has(two)).toBe(true);
  });

  it("calls the context menu function of the row that was right clicked", () => {
    const lines = vi.fn(() => none());
    const container = list.container(
      { col: list.column_string("Col") },
      () => ok({ context_menu: lines, values: { col: "x" } }),
      [1],
    );
    document.body.append(container);
    rows_of(container)[0].dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    expect(lines).toHaveBeenCalledOnce();
  });
});

describe("List container rows from states", () => {
  it("only renders state rows once connected", () => {
    const rows = state.ok_w([1, 2]);
    const container = list.container(
      { col: list.column_string("Col") },
      (item) => ok({ values: { col: item.toString() } }),
      rows,
    );
    expect(container.amount_rows()).toBe(0);
    document.body.append(container);
    expect(texts(container)).toEqual(["1", "2"]);
  });

  it("renders no rows for a state in error", () => {
    const rows = state.err_w<number[]>("fail");
    const container = number_list(rows);
    expect(container.amount_rows()).toBe(0);
    rows.set_ok([1]);
    expect(texts(container)).toEqual(["1"]);
    rows.set_err("again");
    expect(container.amount_rows()).toBe(0);
  });

  it("adds rows on push without recreating existing rows", () => {
    const rows = state.ok_w([1, 2]);
    const container = number_list(rows);
    const before = rows_of(container);
    rows.array.push(3, 4);
    expect(texts(container)).toEqual(["1", "2", "3", "4"]);
    expect(rows_of(container).slice(0, 2)).toEqual(before);
  });

  it("adds rows to an empty state on push", () => {
    const rows = state.ok_w<number[]>([]);
    const container = number_list(rows);
    rows.array.push(1);
    expect(texts(container)).toEqual(["1"]);
  });

  it("adds rows at the start on unshift", () => {
    const rows = state.ok_w([1, 2]);
    const container = number_list(rows);
    const before = rows_of(container);
    rows.array.unshift(-1, 0);
    expect(texts(container)).toEqual(["-1", "0", "1", "2"]);
    expect(rows_of(container).slice(2)).toEqual(before);
  });

  it("removes the last row on pop and the first on shift", () => {
    const rows = state.ok_w([1, 2, 3]);
    const container = number_list(rows);
    const middle = rows_of(container)[1];
    rows.array.pop();
    expect(texts(container)).toEqual(["1", "2"]);
    rows.array.shift();
    expect(texts(container)).toEqual(["2"]);
    expect(rows_of(container)[0]).toBe(middle);
    rows.array.pop();
    expect(container.amount_rows()).toBe(0);
  });

  it("removes and inserts rows on splice", () => {
    const rows = state.ok_w([1, 2, 3, 4]);
    const container = number_list(rows);
    rows.array.splice(1, 2, 7, 8, 9);
    expect(texts(container)).toEqual(["1", "7", "8", "9", "4"]);
    rows.array.splice(0, 1);
    expect(texts(container)).toEqual(["7", "8", "9", "4"]);
    rows.array.splice(4, 0, 5);
    expect(texts(container)).toEqual(["7", "8", "9", "4", "5"]);
  });

  it("removes every matching row on delete", () => {
    const rows = state.ok_w([1, 2, 1, 3, 1]);
    const container = number_list(rows);
    rows.array.delete(1);
    expect(texts(container)).toEqual(["2", "3"]);
  });

  it("updates changed rows in place", () => {
    const rows = state.ok_w([1, 2, 3]);
    const container = number_list(rows);
    const before = rows_of(container);
    rows.array.change(1, 20, 30);
    expect(texts(container)).toEqual(["1", "20", "30"]);
    expect(rows_of(container)).toEqual(before);
  });

  it("adds rows when a change runs past the end", () => {
    const rows = state.ok_w([1, 2]);
    const container = number_list(rows);
    rows.array.change(1, 20, 30, 40);
    expect(texts(container)).toEqual(["1", "20", "30", "40"]);
  });

  it("moves a single row forward and backward", () => {
    const rows = state.ok_w([1, 2, 3, 4]);
    const container = number_list(rows);
    const first = rows_of(container)[0];
    rows.array.move(0, 2);
    expect(texts(container)).toEqual(["2", "3", "1", "4"]);
    expect(rows_of(container)[2]).toBe(first);
    rows.array.move(2, 0);
    expect(texts(container)).toEqual(["1", "2", "3", "4"]);
    rows.array.move(1, 3);
    expect(texts(container)).toEqual(["1", "3", "4", "2"]);
  });

  it("moves multiple rows at once", () => {
    const rows = state.ok_w([1, 2, 3, 4]);
    const container = number_list(rows);
    rows.array.move(2, 0, 2);
    expect(rows.get().unwrap()).toEqual([3, 4, 1, 2]);
    expect(texts(container)).toEqual(["3", "4", "1", "2"]);
  });

  it("re-renders all rows on sort and set", () => {
    const rows = state.ok_w([3, 1, 2]);
    const container = number_list(rows);
    rows.array.sort((a, b) => a - b);
    expect(texts(container)).toEqual(["1", "2", "3"]);
    rows.set_ok([9, 8]);
    expect(texts(container)).toEqual(["9", "8"]);
  });

  it("stops following a state after the rows are replaced with an array", () => {
    const rows = state.ok_w([1, 2]);
    const container = number_list(rows);
    container.rows = [5];
    rows.array.push(3);
    expect(texts(container)).toEqual(["5"]);
    expect(rows.amount()).toBe(0);
  });

  it("follows a new state after the rows are replaced", () => {
    const first = state.ok_w([1]);
    const second = state.ok_w([2, 3]);
    const container = number_list(first);
    container.rows = second;
    expect(texts(container)).toEqual(["2", "3"]);
    first.array.push(9);
    second.array.push(4);
    expect(texts(container)).toEqual(["2", "3", "4"]);
  });

  it("unsubscribes from the state while disconnected and catches up on reconnect", () => {
    const rows = state.ok_w([1, 2]);
    const container = number_list(rows);
    container.remove();
    expect(rows.amount()).toBe(0);
    rows.array.push(3);
    document.body.append(container);
    expect(texts(container)).toEqual(["1", "2", "3"]);
  });

  it("renders rows from an async state", async () => {
    const container = number_list(state.roa(async () => ok([1, 2])));
    await expect.poll(() => texts(container)).toEqual(["1", "2"]);
  });
});

describe("List container add row", () => {
  it("renders the add row button which calls on_add", () => {
    const on_add = vi.fn();
    const container = number_list([1], {
      add_row: { text: "Add", on_add },
    });
    const add = add_row_of(container);
    expect(add).toBeInstanceOf(ListAddRow);
    expect(add.textContent).toBe("Add");
    expect(box_of(container).classList.contains("addrow")).toBe(true);
    (add.lastElementChild as HTMLElement).click();
    expect(on_add).toHaveBeenCalledOnce();
  });

  it("updates and removes the add row", () => {
    const container = number_list([1], {
      add_row: { text: "Add", on_add: () => {} },
    });
    const add = add_row_of(container);
    container.add_row = { text: "New", on_add: () => {} };
    expect(add_row_of(container)).toBe(add);
    expect(add.textContent).toBe("New");
    container.add_row = undefined;
    expect(add_row_of(container)).toBeUndefined();
    expect(box_of(container).classList.contains("addrow")).toBe(false);
  });

  it("adds a key field to the add row when the list has sub rows", () => {
    const container = number_list([1], {
      sub_rows: true,
      add_row: { text: "Add", on_add: () => {} },
    });
    expect(add_row_of(container).firstElementChild).toBeInstanceOf(
      ListKeyField,
    );
  });

  it("re-enables the add row when disabled is set back to false", () => {
    const container = number_list([1], {
      add_row: { text: "Add", disabled: true, on_add: () => {} },
    });
    expect(add_row_of(container).inert).toBe(true);
    container.add_row = { text: "Add", disabled: false, on_add: () => {} };
    expect(add_row_of(container).inert).toBe(false);
  });
});

/**Type tests, never called, only checked by tsc */
export function container_type_tests() {
  //Item type is inferred from a state
  list.container(
    { col: list.column_string("Col") },
    (item, _row, rows) => {
      expectTypeOf(item).toEqualTypeOf<number>();
      expectTypeOf(rows).toEqualTypeOf<State<number[]>>();
      return ok({ values: { col: item.toString() } });
    },
    state.ok([1, 2]) as State<number[]>,
  );

  list.container(
    { col: list.column_string("Col") },
    //@ts-expect-error A value for every column is required
    () => ok({ values: {} }),
    [1],
  );

  list.container(
    { col: list.column_string("Col") },
    //@ts-expect-error The value must match the column type
    () => ok({ values: { col: 5 } }),
    [1],
  );

  list.container(
    { col: list.column_string("Col") },
    //@ts-expect-error Sub rows are not allowed without the sub_rows option
    (item: number) => ok({ sub_rows: () => [item], values: { col: "" } }),
    [1],
  );

  //Sub rows may come from a state even when the top level rows are an array,
  //the transformer then receives that state for the sub rows
  list.container(
    { col: list.column_string("Col") },
    (item: number, _row, rows) => {
      expectTypeOf(rows).toEqualTypeOf<number[] | State<number[]>>();
      return ok({
        sub_rows: () => state.ok([item]) as State<number[]>,
        values: { col: "" },
      });
    },
    [1],
    { sub_rows: true },
  );

  //The state of a row and of its add row are the row's sub rows, which can be a state
  //even when the top level rows are an array
  expectTypeOf<ListRow<number, {}, number[], true>["state"]>().toEqualTypeOf<
    number[] | State<number[]>
  >();
  expectTypeOf<
    ListAddRow<number, {}, number[], true>["state"]
  >().toEqualTypeOf<number[] | State<number[]>>();
}

describe("List container sub row transformer argument", () => {
  it("passes the sub row state to the transformer of sub rows", () => {
    const sub = state.ok([2]);
    const received: unknown[] = [];
    document.body.append(
      list.container(
        { col: list.column_string("Col") },
        (item: number, row, rows) => {
          if (row.depth === 1) received.push(rows);
          return ok({
            openable: true,
            opened: true,
            sub_rows: row.depth === 0 ? () => sub : undefined,
            values: { col: item.toString() },
          });
        },
        [1],
        { sub_rows: true },
      ),
    );
    //Runtime value is a state, while the transformer type says number[]
    expect(received).toEqual([sub]);
  });
});
