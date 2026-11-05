import { ok } from "@chocbite/ts-lib/result";
import { state, type State } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import list from ".";
import type { ListRow } from "./row";

type Row = ListRow<number, { col: string }, number[], true>;

function create_list(sub_rows: () => number[] | State<number[]>): Row {
  let top_row: Row | undefined;
  document.body.append(
    list.container(
      { col: list.column_string("Column") },
      (item, row) => {
        if (row.depth === 0) top_row = row;
        return {
          openable: row.depth === 0,
          sub_rows,
          values: { col: item.toString() },
        };
      },
      [1],
      { sub_rows: true },
    ),
  );
  return top_row!;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("ListRow open", () => {
  it("adds open class when sub rows are an array", () => {
    const row = create_list(() => [10, 11]);
    row.open = true;
    expect(row.amount_rows()).toBe(2);
    expect(row.classList.contains("open")).toBe(true);
    expect(row.open).toBe(true);
  });

  it("adds open class when sub rows are a sync state", () => {
    const row = create_list(() => state.ok([10, 11]));
    row.open = true;
    expect(row.amount_rows()).toBe(2);
    expect(row.classList.contains("open")).toBe(true);
    expect(row.open).toBe(true);
  });

  it("adds open class when sub rows are an async state", async () => {
    const row = create_list(() => state.roa(async () => ok([10, 11])));
    row.open = true;
    await expect.poll(() => row.amount_rows()).toBe(2);
    expect(row.classList.contains("open")).toBe(true);
    expect(row.open).toBe(true);
  });
});
