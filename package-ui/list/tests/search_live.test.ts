import { ok } from "@chocbite/ts-lib/result";
import { state, type State, type StateOrVal } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import list, { type ListFilter } from "..";
import type { ListRow } from "../row";

afterEach(() => {
  document.body.replaceChildren();
});

type AnyRow = ListRow<any, any, any, any>;
type Writable<T> = ReturnType<typeof state.ok_w<T>>;

interface Live {
  id: number;
  name: string | State<string>;
  /**A value given as a state */
  age: Writable<number>;
  /**Searched through search_value, which returns the state of its label */
  place: { label: Writable<string> };
}

const live = (
  id: number,
  age: number,
  place = "",
  name: string | State<string> = `row ${id}`,
): Live => ({
  id,
  name,
  age: state.ok_w(age),
  place: { label: state.ok_w(place) },
});

/**A tree with values given as states, the names in the key field, it searches without waiting */
function live_list(
  rows: StateOrVal<Live[]>,
  options: { search?: StateOrVal<string>; filter?: StateOrVal<ListFilter> },
) {
  const container = list.container(
    {
      transform: (row: Live) =>
        ok({
          key_field: { text: row.name },
          values: { age: row.age, place: row.place },
        }),
      sub_rows: true,
      search_delay: 0,
    },
    {
      columns: {
        age: list.column({
          title: "Age",
          type: "number",
          field_gen: () => list.text_field(),
          field_apply: (field, age: Writable<number>) =>
            (field.text = String(age.ok())),
        }),
        place: list.column({
          title: "Place",
          type: "string",
          field_gen: () => list.text_field(),
          field_apply: (field, place: Live["place"]) =>
            (field.text = place.label.ok()),
          search_value: (place) => place.label,
        }),
      },
      rows,
      ...options,
    },
  );
  document.body.append(container);
  return container;
}

const rows_of = (container: HTMLElement) =>
  [...container.querySelectorAll("list-row")] as AnyRow[];
const id_of = (row: AnyRow) => (row.data as Live).id;
/**Ids of the rows the search shows */
const shown = (container: HTMLElement) =>
  rows_of(container)
    .filter((row) => !row.search_hidden)
    .map(id_of);
const row_of = (container: HTMLElement, id: number) =>
  rows_of(container).find((row) => id_of(row) === id)!;
const key_of = (container: HTMLElement, id: number) =>
  row_of(container, id).querySelector<HTMLElement>("list-keyfield")!;
/**Whether the cell of the column, 0 for age and 1 for place, is highlighted as found */
const found = (container: HTMLElement, id: number, column: number) =>
  row_of(container, id)
    .querySelectorAll("list-textfield")
    [column].classList.contains("search-found");
/**Waits for the next frame, where the list answers the search again for the rows whose states changed */
const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe("List search of values from states", () => {
  it("hides a row whose state stops having the text and shows one that starts, at the next frame", async () => {
    const rows = [live(1, 14), live(2, 20), live(3, 34)];
    const container = live_list(rows, { search: "4" });
    expect(shown(container)).toEqual([1, 3]);
    rows[0].age.set_ok(10);
    rows[1].age.set_ok(40);
    expect(shown(container)).toEqual([1, 3]);
    await frame();
    expect(shown(container)).toEqual([2, 3]);
  });

  it("follows a state from search_value and the text of the key field as a state", async () => {
    const name = state.ok_w("Ann");
    const rows = [live(1, 0, "Oslo", name), live(2, 0, "Rome", "Bob")];
    const place = live_list(rows, { search: "oslo" });
    expect(shown(place)).toEqual([1]);
    rows[1].place.label.set_ok("Oslo");
    await frame();
    expect(shown(place)).toEqual([1, 2]);
    document.body.replaceChildren();
    const key = live_list(rows, { search: "ann" });
    expect(shown(key)).toEqual([1]);
    name.set_ok("Dan");
    await frame();
    expect(shown(key)).toEqual([]);
  });

  it("follows the conditions of the filter, reading only the columns of the conditions while there is no text", async () => {
    const rows = [live(1, 10), live(2, 40)];
    const search = state.ok_w("");
    const container = live_list(rows, {
      search,
      filter: {
        conditions: [{ column: "age", type: "number", op: ">", value: 30 }],
      },
    });
    expect(shown(container)).toEqual([2]);
    expect(rows[0].age.amount()).toBe(1);
    expect(rows[0].place.label.amount()).toBe(0);
    rows[0].age.set_ok(50);
    await frame();
    expect(shown(container)).toEqual([1, 2]);
    void search.write("row");
    expect(rows[0].place.label.amount()).toBe(1);
  });

  it("stops following the states when the search ends", () => {
    const name = state.ok_w("Ann");
    const rows = [live(1, 14, "Oslo", name)];
    const search = state.ok_w("4");
    live_list(rows, { search });
    //The key field shows the name state itself, so it has one more subscriber
    expect(
      [rows[0].age, rows[0].place.label, name].map((s) => s.amount()),
    ).toEqual([1, 1, 2]);
    void search.write("");
    expect(
      [rows[0].age, rows[0].place.label, name].map((s) => s.amount()),
    ).toEqual([0, 0, 1]);
  });

  it("highlights the cells that have the text after their states change", async () => {
    const rows = [live(1, 14, "Rome")];
    const container = live_list(rows, { search: "4" });
    expect([found(container, 1, 0), found(container, 1, 1)]).toEqual([
      true,
      false,
    ]);
    rows[0].age.set_ok(10);
    rows[0].place.label.set_ok("Rome 4");
    await frame();
    expect([found(container, 1, 0), found(container, 1, 1)]).toEqual([
      false,
      true,
    ]);
  });

  it("shows that nothing matches once the last row stops matching", async () => {
    const rows = [live(1, 14)];
    const container = live_list(rows, { search: "4" });
    expect(container.querySelector("list-searchempty")).toBeNull();
    rows[0].age.set_ok(10);
    await frame();
    expect(container.querySelector("list-searchempty")).not.toBeNull();
  });

  it("keeps a row with the focus shown until the focus leaves", async () => {
    const rows = [live(1, 14), live(2, 24)];
    const container = live_list(rows, { search: "4" });
    const focused = key_of(container, 1);
    focused.focus();
    rows[0].age.set_ok(10);
    await frame();
    expect(shown(container)).toEqual([1, 2]);
    expect(document.activeElement).toBe(focused);
    key_of(container, 2).focus();
    await frame();
    expect(shown(container)).toEqual([2]);
  });

  it("keeps a row with the focus shown when its data stops matching", async () => {
    const rows = state.ok_w<Live[]>([live(1, 14), live(2, 24)]);
    const container = live_list(rows, { search: "4" });
    const focused = key_of(container, 1);
    focused.focus();
    rows.array.change(0, live(1, 10));
    expect(shown(container)).toEqual([1, 2]);
    expect(document.activeElement).toBe(focused);
    focused.blur();
    await frame();
    expect(shown(container)).toEqual([2]);
  });

  it("keeps the rows while a pointer is pressed on the list", async () => {
    const rows = [live(1, 14), live(2, 24)];
    const container = live_list(rows, { search: "4" });
    row_of(container, 2).dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    rows[0].age.set_ok(10);
    await frame();
    expect(shown(container)).toEqual([1, 2]);
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    await frame();
    expect(shown(container)).toEqual([2]);
  });
});
