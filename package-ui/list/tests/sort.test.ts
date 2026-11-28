import { theme_init } from "#theme";
import { err, ok } from "@chocbite/ts-lib/result";
import { state, type State, type StateOrVal } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import list, { type ListSort } from "..";
import type { ListRow } from "../row";
import { sub_rows_of } from "./rows";

//Row backgrounds come from theme variables
theme_init();

afterEach(() => {
  document.body.replaceChildren();
});

type AnyRow = ListRow<any, any, any, any>;

interface Item {
  id: number;
  name: string;
  size?: number;
  kind?: string;
  /**Shown by its label, sorted through search_value */
  place?: { label: string };
  /**Shown by its text, sorted through sort_value by its rank */
  level?: { text: string; rank: number };
  /**Makes the row invalid */
  broken?: boolean;
}

const item = (id: number, name: string, more: Partial<Item> = {}): Item => ({
  id,
  name,
  ...more,
});

/**Choices whose names are in another order than their values */
const KINDS = {
  x: { name: "Zulu" },
  y: { name: "Alpha" },
  z: { name: "Mike" },
};

const text = () => list.text_field();

const columns = () => ({
  name: list.column_string("Name"),
  size: list.column({
    title: "Size",
    type: "number",
    field_gen: text,
    field_apply: (field, size: number | undefined) =>
      (field.text = size === undefined ? "" : String(size)),
  }),
  kind: list.column({
    title: "Kind",
    type: "enum",
    choices: KINDS,
    field_gen: text,
    field_apply: (field, kind: keyof typeof KINDS | undefined) =>
      (field.text = kind ? KINDS[kind].name : ""),
  }),
  place: list.column({
    title: "Place",
    sortable: true,
    field_gen: text,
    field_apply: (field, place: { label: string } | undefined) =>
      (field.text = place?.label ?? ""),
    search_value: (place) => place?.label,
  }),
  level: list.column({
    title: "Level",
    field_gen: text,
    field_apply: (field, level: Item["level"]) =>
      (field.text = level?.text ?? ""),
    sort_value: (level) => level?.rank,
  }),
  //Without a type or sort_value it can not be sorted
  note: list.column({
    title: "Note",
    field_gen: text,
    field_apply: (field, note: string) => (field.text = note),
  }),
});

function items(
  rows: Item[] | State<Item[]>,
  options: { sort?: StateOrVal<ListSort>; reorder?: boolean } = {},
) {
  const container = list.container(
    {
      transform: (i: Item) =>
        i.broken
          ? err("Broken")
          : ok({
              values: {
                name: i.name,
                size: i.size,
                kind: i.kind as keyof typeof KINDS | undefined,
                place: i.place,
                level: i.level,
                note: i.name,
              },
            }),
      reorder: options.reorder ? {} : undefined,
    },
    { columns: columns(), rows, sort: options.sort },
  );
  document.body.append(container);
  return container;
}

const rows_of = (container: HTMLElement) =>
  [...container.querySelectorAll("list-row")] as AnyRow[];
const id_of = (row: AnyRow) => (row.data as { id: number }).id;
/**Ids of the rows in the order shown */
const ids = (container: HTMLElement) => rows_of(container).map(id_of);
const row_of = (container: HTMLElement, id: number) =>
  rows_of(container).find((row) => id_of(row) === id)!;
const sorted = (column: string, direction: "asc" | "desc" = "asc") =>
  state.ok_w<ListSort>([{ column, direction }]);

const headers = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>("list-headerfield"),
];
const header = (container: HTMLElement, title: string) =>
  headers(container).find((h) => h.textContent.startsWith(title))!;
/**The title of the header, which sorts when clicked */
const title = (container: HTMLElement, name: string) =>
  header(container, name).querySelector<HTMLElement>(":scope > div > span")!;
const click = (element: HTMLElement, shift = false) =>
  element.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      shiftKey: shift,
    }),
  );
/**The icon of the sort shown in the header, undefined while the column does not sort */
const sort_icon = (container: HTMLElement, name: string) =>
  header(container, name).querySelector(".sort svg")?.getAttribute("icon") ??
  undefined;
/**The place of the column among several sorted columns shown in the header */
const sort_place = (container: HTMLElement, name: string) =>
  header(container, name).querySelector(".sort")?.textContent ?? "";

const right_click = (element: Element) =>
  element.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
  );
const options = () => [
  ...document.documentElement.querySelectorAll<HTMLElement>(
    "contextmenu-option",
  ),
];
const texts = () => options().map((o) => o.textContent);
const choose = (text: string) =>
  options()
    .find((o) => o.textContent === text)!
    .click();
/**Closes the open menu with escape, the menu has the focus, a menu left open takes the focus back when another element gets it */
const close_menu = () => {
  (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
    }),
  );
  expect(options()).toEqual([]);
};

//       ____  _____  _____  ______ _____
//      / __ \|  __ \|  __ \|  ____|  __ \
//     | |  | | |__) | |  | | |__  | |__) |
//     | |  | |  _  /| |  | |  __| |  _  /
//     | |__| | | \ \| |__| | |____| | \ \
//      \____/|_|  \_\_____/|______|_|  \_\

describe("List sort order", () => {
  it("sorts a text column A to Z, numbers in the text by number and without minding case, and Z to A", () => {
    const sort = sorted("name");
    const container = items(
      [
        item(1, "item 10"),
        item(2, "Banana"),
        item(3, "item 2"),
        item(4, "apple"),
      ],
      { sort },
    );
    expect(ids(container)).toEqual([4, 2, 3, 1]);
    void sort.write([{ column: "name", direction: "desc" }]);
    expect(ids(container)).toEqual([1, 3, 2, 4]);
  });

  it("sorts a number column by number, rows without a value first A to Z and last Z to A", () => {
    const sort = sorted("size");
    const container = items(
      [
        item(1, "a", { size: 10 }),
        item(2, "b"),
        item(3, "c", { size: 9 }),
        item(4, "d", { size: -1 }),
        item(5, "e", { size: NaN }),
      ],
      { sort },
    );
    expect(ids(container)).toEqual([2, 5, 4, 3, 1]);
    void sort.write([{ column: "size", direction: "desc" }]);
    expect(ids(container)).toEqual([1, 3, 4, 2, 5]);
  });

  it("sorts an enum column by the names of its choices", () => {
    const container = items(
      [
        item(1, "a", { kind: "x" }),
        item(2, "b", { kind: "y" }),
        item(3, "c", { kind: "z" }),
        item(4, "d"),
      ],
      { sort: sorted("kind") },
    );
    expect(ids(container)).toEqual([4, 2, 3, 1]);
  });

  it("keeps rows with equal values in the order of the data, in both directions", () => {
    const sort = sorted("name");
    const container = items(
      [item(1, "b"), item(2, "a"), item(3, "b"), item(4, "a")],
      { sort },
    );
    expect(ids(container)).toEqual([2, 4, 1, 3]);
    void sort.write([{ column: "name", direction: "desc" }]);
    expect(ids(container)).toEqual([1, 3, 2, 4]);
  });

  it("sorts rows the first column finds equal by the next", () => {
    const container = items(
      [
        item(1, "a", { size: 1 }),
        item(2, "b", { size: 2 }),
        item(3, "c", { size: 1 }),
        item(4, "d", { size: 2 }),
      ],
      {
        sort: [
          { column: "size", direction: "asc" },
          { column: "name", direction: "desc" },
        ],
      },
    );
    expect(ids(container)).toEqual([3, 1, 4, 2]);
  });

  it("sorts by the sort_value of a column, else by its search_value, and an invalid row as a row without values", () => {
    const sort = sorted("level");
    const container = items(
      [
        item(1, "a", {
          level: { text: "high", rank: 3 },
          place: { label: "Oslo" },
        }),
        item(2, "b", {
          level: { text: "low", rank: 1 },
          place: { label: "Bergen" },
        }),
        item(3, "c", { broken: true }),
        item(4, "d", {
          level: { text: "mid", rank: 2 },
          place: { label: "Tromsø" },
        }),
      ],
      { sort },
    );
    expect(ids(container)).toEqual([3, 2, 4, 1]);
    void sort.write([{ column: "place", direction: "asc" }]);
    expect(ids(container)).toEqual([3, 2, 1, 4]);
  });

  it("sorts a value shown as a text by its text, in a number column by its value", () => {
    type Shown = { n: number; t: string };
    const shown_column = (type: "number" | undefined) =>
      list.column({
        title: type ?? "text",
        type,
        sortable: true,
        field_gen: text,
        field_apply: (field, value: Shown) => (field.text = value.t),
        search_value: (value) => ({ value: value.n, text: value.t }),
      });
    const sort = sorted("plain");
    const container = list.container(
      {
        transform: (row: { id: number; value: Shown }) =>
          ok({ values: { plain: row.value, number: row.value } }),
      },
      {
        columns: {
          plain: shown_column(undefined),
          number: shown_column("number"),
        },
        rows: [
          { id: 1, value: { n: 1500, t: "1.5 kW" } },
          { id: 2, value: { n: 500, t: "500 W" } },
          { id: 3, value: { n: 3000, t: "3 kW" } },
        ],
        sort,
      },
    );
    document.body.append(container);
    expect(ids(container)).toEqual([1, 3, 2]);
    void sort.write([{ column: "number", direction: "asc" }]);
    expect(ids(container)).toEqual([2, 1, 3]);
  });

  it("leaves out columns the list does not have, columns that can not be sorted and a column given again", () => {
    const container = items(
      [
        item(1, "a", { size: 1 }),
        item(2, "b", { size: 3 }),
        item(3, "c", { size: 2 }),
      ],
      {
        sort: [
          { column: "nope", direction: "asc" },
          { column: "note", direction: "desc" },
          { column: "size", direction: "desc" },
          { column: "size", direction: "asc" },
        ],
      },
    );
    expect(ids(container)).toEqual([2, 3, 1]);
    expect(sort_icon(container, "Note")).toBeUndefined();
    expect(sort_place(container, "Size")).toBe("");
  });

  it("goes back to the order of the data when the sort is cleared", () => {
    const sort = sorted("name", "desc");
    const container = items([item(1, "a"), item(2, "c"), item(3, "b")], {
      sort,
    });
    expect(ids(container)).toEqual([2, 3, 1]);
    void sort.write([]);
    expect(ids(container)).toEqual([1, 2, 3]);
  });

  it("keeps the rows sorted while rows of an array state are added, removed, changed and moved", () => {
    const rows = state.ok_w<Item[]>([item(1, "d"), item(2, "b"), item(3, "f")]);
    const container = items(rows, { sort: sorted("name") });
    expect(ids(container)).toEqual([2, 1, 3]);
    rows.array.push(item(4, "a"));
    expect(ids(container)).toEqual([4, 2, 1, 3]);
    rows.array.splice(1, 0, item(5, "c"));
    expect(ids(container)).toEqual([4, 2, 5, 1, 3]);
    //The data is now 1 5 2 3 4, a changed value moves its row
    rows.array.change(0, item(1, "z"));
    expect(ids(container)).toEqual([4, 2, 5, 3, 1]);
    rows.array.splice(3, 1);
    expect(ids(container)).toEqual([4, 2, 5, 1]);
    //A row equal to another follows it in the data, and comes before it once moved in front of it
    rows.array.push(item(6, "b"));
    expect(ids(container)).toEqual([4, 2, 6, 5, 1]);
    rows.array.move(4, 0);
    expect(ids(container)).toEqual([4, 6, 2, 5, 1]);
  });

  it("sorts again when the columns change", () => {
    const container = items(
      [item(1, "a", { size: 2 }), item(2, "b", { size: 1 })],
      {
        sort: sorted("size"),
      },
    );
    expect(ids(container)).toEqual([2, 1]);
    const { size: _size, ...rest } = columns();
    container.set({ columns: rest as ReturnType<typeof columns> });
    expect(ids(container)).toEqual([1, 2]);
  });
});

//      _______ _____  ______ ______
//     |__   __|  __ \|  ____|  ____|
//        | |  | |__) | |__  | |__
//        | |  |  _  /|  __| |  __|
//        | |  | | \ \| |____| |____
//        |_|  |_|  \_\______|______|

interface Node {
  id: number;
  name: string;
  sub?: Node[];
}

function tree(sort: StateOrVal<ListSort>) {
  const container = list.container(
    {
      transform: (node: Node) =>
        ok({
          openable: Boolean(node.sub),
          opened: true,
          key_field: { text: node.name },
          sub_rows: () => node.sub ?? [],
          values: { name: node.name },
        }),
      sub_rows: true,
    },
    {
      columns: { name: list.column_string("Name") },
      rows: [
        {
          id: 1,
          name: "b",
          sub: [
            { id: 11, name: "z" },
            { id: 12, name: "y" },
          ],
        },
        {
          id: 2,
          name: "a",
          sub: [
            { id: 21, name: "x" },
            { id: 22, name: "w" },
          ],
        },
      ],
      sort,
    },
  );
  document.body.append(container);
  return container;
}

describe("List sort of sub rows", () => {
  it("sorts the sub rows inside their parent and moves a row with its sub rows", () => {
    const sort = sorted("name");
    const container = tree(sort);
    expect(ids(container)).toEqual([2, 22, 21, 1, 12, 11]);
    expect(sub_rows_of(row_of(container, 2)).map(id_of)).toEqual([22, 21]);
    void sort.write([{ column: "name", direction: "desc" }]);
    expect(ids(container)).toEqual([1, 11, 12, 2, 21, 22]);
  });

  it("ends the tree lines in the last row shown of each parent", () => {
    const container = tree(sorted("name"));
    const last = rows_of(container)
      .filter((row) => row.classList.contains("last"))
      .map(id_of);
    expect(last).toEqual([21, 1, 11]);
  });

  it("follows the order shown with the arrow keys", () => {
    const container = tree(sorted("name"));
    const key = (id: number) =>
      row_of(container, id).querySelector<HTMLElement>("list-keyfield")!;
    key(2).focus();
    const order: number[] = [];
    for (let i = 0; i < 5; i++) {
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        }),
      );
      order.push(id_of(document.activeElement!.closest("list-row") as AnyRow));
    }
    expect(order).toEqual([22, 21, 1, 12, 11]);
  });

  it("alternates the backgrounds of the rows in the order shown", () => {
    const container = tree(sorted("name"));
    const background = (id: number) =>
      getComputedStyle(row_of(container, id).anchor!).backgroundColor;
    expect(background(2)).not.toBe(background(22));
    expect(background(2)).toBe(background(21));
    expect(background(22)).toBe(background(1));
  });
});

//      _    _ ______          _____  ______ _____
//     | |  | |  ____|   /\   |  __ \|  ____|  __ \
//     | |__| | |__     /  \  | |  | | |__  | |__) |
//     |  __  |  __|   / /\ \ | |  | |  __| |  _  /
//     | |  | | |____ / ____ \| |__| | |____| | \ \
//     |_|  |_|______/_/    \_\_____/|______|_|  \_\

describe("List sort by the user", () => {
  const data = () => [
    item(1, "b", { size: 1 }),
    item(2, "a", { size: 3 }),
    item(3, "c", { size: 2 }),
  ];

  it("sorts by a column alone at a click on its title, A to Z, then Z to A, then not", () => {
    const sort = state.ok_w<ListSort>([]);
    const container = items(data(), { sort });
    click(title(container, "Name"));
    expect(sort.ok()).toEqual([{ column: "name", direction: "asc" }]);
    expect(ids(container)).toEqual([2, 1, 3]);
    expect(sort_icon(container, "Name")).toBe("icon_sort_a_z_rounded");
    click(title(container, "Name"));
    expect(sort.ok()).toEqual([{ column: "name", direction: "desc" }]);
    expect(sort_icon(container, "Name")).toBe("icon_sort_z_a_rounded");
    click(title(container, "Name"));
    expect(sort.ok()).toEqual([]);
    expect(sort_icon(container, "Name")).toBeUndefined();
    expect(ids(container)).toEqual([1, 2, 3]);
  });

  it("shows the digits for a number column", () => {
    const container = items(data());
    click(title(container, "Size"));
    expect(sort_icon(container, "Size")).toBe("icon_sort_1_9_rounded");
    click(title(container, "Size"));
    expect(sort_icon(container, "Size")).toBe("icon_sort_9_1_rounded");
  });

  it("adds a column with a shift click and shows the place of each sorted column, a click sorts by a column alone again", () => {
    const sort = state.ok_w<ListSort>([]);
    const container = items(data(), { sort });
    click(title(container, "Name"));
    click(title(container, "Size"), true);
    expect(sort.ok()).toEqual([
      { column: "name", direction: "asc" },
      { column: "size", direction: "asc" },
    ]);
    expect(sort_place(container, "Name")).toBe("1");
    expect(sort_place(container, "Size")).toBe("2");
    click(title(container, "Size"), true);
    expect(sort.ok()).toEqual([
      { column: "name", direction: "asc" },
      { column: "size", direction: "desc" },
    ]);
    click(title(container, "Size"), true);
    expect(sort.ok()).toEqual([{ column: "name", direction: "asc" }]);
    expect(sort_place(container, "Name")).toBe("");
    click(title(container, "Name"), true);
    click(title(container, "Size"), true);
    click(title(container, "Size"));
    expect(sort.ok()).toEqual([{ column: "size", direction: "asc" }]);
  });

  it("does not sort at a click on the title of a column that can not be sorted", () => {
    const sort = state.ok_w<ListSort>([]);
    const container = items(data(), { sort });
    click(title(container, "Note"));
    expect(sort.ok()).toEqual([]);
    expect(header(container, "Note").classList.contains("sortable")).toBe(
      false,
    );
    expect(header(container, "Name").classList.contains("sortable")).toBe(true);
  });

  it("starts at a fixed value the user changes, and only follows a read only state", () => {
    const container = items(data(), {
      sort: [{ column: "name", direction: "asc" }],
    });
    expect(ids(container)).toEqual([2, 1, 3]);
    click(title(container, "Name"));
    expect(ids(container)).toEqual([3, 1, 2]);
    container.set({
      sort: state.ok<ListSort>([{ column: "size", direction: "asc" }]),
    });
    expect(ids(container)).toEqual([1, 3, 2]);
    expect(header(container, "Name").classList.contains("sortable")).toBe(
      false,
    );
    click(title(container, "Name"));
    expect(ids(container)).toEqual([1, 3, 2]);
    right_click(title(container, "Name"));
    expect(texts()).not.toContain("Sort A to Z");
    close_menu();
  });

  it("has lines in the menu of a title to sort by its column, then by it, and to clear the sort", () => {
    const sort = state.ok_w<ListSort>([]);
    const container = items(data(), { sort });
    right_click(title(container, "Name"));
    expect(texts()).toContain("Sort A to Z");
    expect(texts()).toContain("Sort Z to A");
    expect(texts()).not.toContain("Clear sort");
    expect(texts().some((t) => t.startsWith("Then"))).toBe(false);
    choose("Sort Z to A");
    expect(sort.ok()).toEqual([{ column: "name", direction: "desc" }]);
    right_click(title(container, "Size"));
    expect(texts()).toEqual(
      expect.arrayContaining([
        "Sort 1 to 9",
        "Sort 9 to 1",
        "Then sort 1 to 9",
        "Then sort 9 to 1",
        "Clear sort",
      ]),
    );
    choose("Then sort 9 to 1");
    expect(sort.ok()).toEqual([
      { column: "name", direction: "desc" },
      { column: "size", direction: "desc" },
    ]);
    right_click(title(container, "Note"));
    expect(texts().some((t) => t.startsWith("Sort"))).toBe(false);
    expect(texts()).toContain("Clear sort");
    choose("Clear sort");
    expect(sort.ok()).toEqual([]);
  });

  it("does not move rows while the list sorts", async () => {
    const rows = state.ok_w<Item[]>(data());
    const sort = sorted("name");
    const container = items(rows, { sort, reorder: true });
    const row = row_of(container, 2);
    expect(row.movable).toBe(false);
    row.key_down(
      new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rows.ok().map((i) => i.id)).toEqual([1, 2, 3]);
    void sort.write([]);
    expect(row_of(container, 2).movable).toBe(true);
  });
});

//      _  ________     __
//     | |/ /  ____\ \   / /
//     | ' /| |__   \ \_/ /
//     |  < |  __|   \   /
//     | . \| |____   | |
//     |_|\_\______|  |_|

interface Folder {
  id: number;
  name: string | State<string>;
  size?: number;
  sub?: Folder[];
}

/**A tree with the names in the key field, which has no column */
function key_tree(rows: StateOrVal<Folder[]>, sort?: StateOrVal<ListSort>) {
  const container = list.container(
    {
      transform: (folder: Folder) =>
        ok({
          openable: Boolean(folder.sub),
          opened: true,
          key_field: { text: folder.name },
          sub_rows: () => folder.sub ?? [],
          values: { size: folder.size },
        }),
      sub_rows: true,
    },
    {
      columns: {
        size: list.column({
          title: "Size",
          type: "number",
          field_gen: text,
          field_apply: (field, size: number | undefined) =>
            (field.text = size === undefined ? "" : String(size)),
        }),
      },
      rows,
      sort,
    },
  );
  document.body.append(container);
  return container;
}

const folders = (): Folder[] => [
  {
    id: 1,
    name: "b 10",
    size: 1,
    sub: [
      { id: 11, name: "z" },
      { id: 12, name: "Y" },
    ],
  },
  {
    id: 2,
    name: "b 2",
    size: 3,
    sub: [
      { id: 21, name: "x" },
      { id: 22, name: state.ok("w") },
    ],
  },
  { id: 3, name: "A", size: 2 },
];

const key_header = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("list-headerfield.key")!;
/**The part of the key header that sorts when clicked, with the open all and close all buttons in it */
const key_title = (container: HTMLElement) =>
  key_header(container).querySelector<HTMLElement>(":scope > div > span")!;

describe("List sort by the key field", () => {
  it("sorts by the text of the key field with the column #key, the sub rows too, a state of a text by its value", () => {
    const sort = sorted("#key");
    const container = key_tree(folders(), sort);
    expect(ids(container)).toEqual([3, 2, 22, 21, 1, 12, 11]);
    void sort.write([{ column: "#key", direction: "desc" }]);
    expect(ids(container)).toEqual([1, 11, 12, 2, 21, 22, 3]);
  });

  it("sorts by the key field and a column after each other", () => {
    const data = folders();
    data[2].name = "b 2";
    const container = key_tree(data, [
      { column: "#key", direction: "asc" },
      { column: "size", direction: "asc" },
    ]);
    //The key alone gives 2, 3, 1 and the size alone 1, 3, 2
    expect(ids(container).filter((id) => id < 10)).toEqual([3, 2, 1]);
  });

  it("moves a row whose key text changes", () => {
    const rows = state.ok_w<Folder[]>(folders());
    const container = key_tree(rows, sorted("#key"));
    rows.array.change(2, { id: 3, name: "c", size: 2 });
    expect(ids(container).filter((id) => id < 10)).toEqual([2, 1, 3]);
  });

  it("leaves #key out in a list without sub rows, which has no key field", () => {
    const container = items([item(1, "b"), item(2, "a")], {
      sort: sorted("#key"),
    });
    expect(ids(container)).toEqual([1, 2]);
    expect(
      container.querySelector(":scope > div")!.classList.contains("sorted"),
    ).toBe(false);
  });

  it("sorts by the key field at a click on its header, not at a click on open all or close all", () => {
    const sort = state.ok_w<ListSort>([]);
    const container = key_tree(folders(), sort);
    expect(key_header(container).classList.contains("sortable")).toBe(true);
    click(key_title(container).querySelector<HTMLElement>(".list-close-all")!);
    click(key_title(container).querySelector<HTMLElement>(".list-open-all")!);
    expect(sort.ok()).toEqual([]);
    click(key_title(container));
    expect(sort.ok()).toEqual([{ column: "#key", direction: "asc" }]);
    expect(
      key_header(container).querySelector(".sort svg")?.getAttribute("icon"),
    ).toBe("icon_sort_a_z_rounded");
    click(title(container, "Size"), true);
    expect(key_header(container).querySelector(".sort")?.textContent).toBe("1");
    expect(sort_place(container, "Size")).toBe("2");
    click(key_title(container));
    expect(sort.ok()).toEqual([{ column: "#key", direction: "asc" }]);
    click(key_title(container));
    expect(sort.ok()).toEqual([{ column: "#key", direction: "desc" }]);
    expect(
      key_header(container).querySelector(".sort svg")?.getAttribute("icon"),
    ).toBe("icon_sort_z_a_rounded");
  });

  it("has the lines to sort in the menu of the key header, none with a read only sort", () => {
    const sort = state.ok_w<ListSort>([{ column: "size", direction: "asc" }]);
    const container = key_tree(folders(), sort);
    right_click(key_title(container));
    expect(texts()).toEqual(
      expect.arrayContaining([
        "Sort A to Z",
        "Sort Z to A",
        "Then sort A to Z",
        "Then sort Z to A",
        "Clear sort",
      ]),
    );
    choose("Then sort Z to A");
    expect(sort.ok()).toEqual([
      { column: "size", direction: "asc" },
      { column: "#key", direction: "desc" },
    ]);
    document.body.replaceChildren();
    const fixed = key_tree(folders(), state.ok<ListSort>([]).read_only);
    expect(key_header(fixed).classList.contains("sortable")).toBe(false);
    right_click(key_title(fixed));
    expect(texts().some((t) => t.startsWith("Sort"))).toBe(false);
    close_menu();
  });
});

//      _      _______      ________
//     | |    |_   _\ \    / /  ____|
//     | |      | |  \ \  / /| |__
//     | |      | |   \ \/ / |  __|
//     | |____ _| |_   \  /  | |____
//     |______|_____|   \/   |______|

type Writable = ReturnType<typeof state.ok_w<number>>;

interface Live {
  id: number;
  name: string | State<string>;
  size: Writable;
  /**Sorted through sort_value, which returns the state */
  rank?: Writable;
  sub?: Live[];
}

const live = (
  id: number,
  size: number,
  more: Partial<Omit<Live, "size">> = {},
): Live => ({ id, name: `row ${id}`, size: state.ok_w(size), ...more });

/**A tree with values given as states, the sizes as values, the ranks through sort_value and the names in the key field */
function live_list(rows: StateOrVal<Live[]>, sort: StateOrVal<ListSort>) {
  const container = list.container(
    {
      transform: (row: Live) =>
        ok({
          openable: Boolean(row.sub),
          opened: true,
          key_field: { text: row.name },
          sub_rows: () => row.sub ?? [],
          values: { size: row.size, rank: row.rank },
        }),
      sub_rows: true,
    },
    {
      columns: {
        size: list.column({
          title: "Size",
          type: "number",
          field_gen: text,
          field_apply: (field, size: Writable) =>
            (field.text = String(size.ok())),
        }),
        rank: list.column({
          title: "Rank",
          field_gen: text,
          field_apply: (field, rank: Writable | undefined) =>
            (field.text = String(rank?.ok())),
          sort_value: (rank) => rank,
        }),
      },
      rows,
      sort,
    },
  );
  document.body.append(container);
  return container;
}

/**Waits for the next frame, where the list places the rows whose values changed */
const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const top_ids = (container: HTMLElement) =>
  ids(container).filter((id) => id < 10);
const key_of = (container: HTMLElement, id: number) =>
  row_of(container, id).querySelector<HTMLElement>("list-keyfield")!;

describe("List sort of values from states", () => {
  it("follows a value given as a state, the row moves at the next frame", async () => {
    const rows = [live(1, 1), live(2, 2), live(3, 3)];
    const container = live_list(rows, sorted("size"));
    expect(top_ids(container)).toEqual([1, 2, 3]);
    rows[0].size.set_ok(5);
    expect(top_ids(container)).toEqual([1, 2, 3]);
    await frame();
    expect(top_ids(container)).toEqual([2, 3, 1]);
    rows[2].size.set_ok(0);
    rows[0].size.set_ok(-1);
    await frame();
    expect(top_ids(container)).toEqual([1, 3, 2]);
  });

  it("follows a state from sort_value and a state of the key field text", async () => {
    const name = state.ok_w("b");
    const rows = [
      live(1, 0, { rank: state.ok_w(1), name }),
      live(2, 0, { rank: state.ok_w(2), name: "c" }),
    ];
    const rank = live_list(rows, sorted("rank"));
    rows[0].rank!.set_ok(3);
    await frame();
    expect(top_ids(rank)).toEqual([2, 1]);
    document.body.replaceChildren();
    const key = live_list(rows, sorted("#key"));
    expect(top_ids(key)).toEqual([1, 2]);
    name.set_ok("d");
    await frame();
    expect(top_ids(key)).toEqual([2, 1]);
  });

  it("sorts the sub rows by their states, also those that changed while their row was closed", async () => {
    const subs = [live(11, 1), live(12, 2)];
    const rows = [live(1, 1, { sub: subs }), live(2, 2)];
    const container = live_list(rows, sorted("size"));
    expect(ids(container)).toEqual([1, 11, 12, 2]);
    subs[0].size.set_ok(3);
    await frame();
    expect(ids(container)).toEqual([1, 12, 11, 2]);
    row_of(container, 1).open = false;
    subs[1].size.set_ok(4);
    row_of(container, 1).open = true;
    await frame();
    expect(ids(container)).toEqual([1, 11, 12, 2]);
  });

  it("stops following the states when the sort no longer needs them", async () => {
    const rows = [live(1, 1), live(2, 2)];
    const sort = sorted("size");
    const container = live_list(rows, sort);
    expect(rows[0].size.amount()).toBe(1);
    void sort.write([{ column: "#key", direction: "asc" }]);
    expect(rows[0].size.amount()).toBe(0);
    void sort.write([{ column: "size", direction: "asc" }]);
    expect(rows[0].size.amount()).toBe(1);
    void sort.write([]);
    expect(rows[0].size.amount()).toBe(0);
    rows[0].size.set_ok(5);
    await frame();
    expect(top_ids(container)).toEqual([1, 2]);
  });

  it("keeps the row with the focus in place until the focus leaves, the other rows still move", async () => {
    const rows = [live(1, 1), live(2, 2), live(3, 3), live(4, 4)];
    const container = live_list(rows, sorted("size"));
    const focused = key_of(container, 2);
    focused.focus();
    rows[1].size.set_ok(9);
    rows[2].size.set_ok(0);
    await frame();
    expect(top_ids(container)).toEqual([3, 1, 2, 4]);
    expect(document.activeElement).toBe(focused);
    key_of(container, 4).focus();
    await frame();
    expect(top_ids(container)).toEqual([3, 1, 4, 2]);
  });

  it("keeps a row with the focus in the row box while the rows move around it, so it keeps the focus", () => {
    const rows = state.ok_w<Item[]>([
      item(1, "a", { size: 1 }),
      item(2, "b", { size: 2 }),
      item(3, "c", { size: 3 }),
    ]);
    const container = items(rows, { sort: sorted("size") });
    const focused = row_of(container, 1).querySelector<HTMLElement>(
      "list-checkfield, list-keyfield, list-textfield",
    )!;
    focused.tabIndex = 0;
    focused.focus();
    expect(document.activeElement).toBe(focused);
    //All rows at once, the longest run that keeps its order is 2 and 3, so without the focus row 1 would be moved
    rows.set_ok([
      item(1, "a", { size: 1 }),
      item(2, "b", { size: -2 }),
      item(3, "c", { size: -1 }),
    ]);
    expect(ids(container)).toEqual([2, 3, 1]);
    expect(document.activeElement).toBe(focused);
  });

  it("keeps the rows in place while a pointer is pressed on the list", async () => {
    const rows = [live(1, 1), live(2, 2), live(3, 3)];
    const container = live_list(rows, sorted("size"));
    row_of(container, 2).dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    rows[0].size.set_ok(5);
    await frame();
    expect(top_ids(container)).toEqual([1, 2, 3]);
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    await frame();
    expect(top_ids(container)).toEqual([2, 3, 1]);
  });

  it("holds a data change of the row with the focus like a change of its states", async () => {
    const rows = state.ok_w<Live[]>([live(1, 1), live(2, 2), live(3, 3)]);
    const container = live_list(rows, sorted("size"));
    const focused = key_of(container, 1);
    focused.focus();
    rows.array.change(0, live(1, 9));
    expect(top_ids(container)).toEqual([1, 2, 3]);
    expect(document.activeElement).toBe(focused);
    focused.blur();
    await frame();
    expect(top_ids(container)).toEqual([2, 3, 1]);
  });
});
