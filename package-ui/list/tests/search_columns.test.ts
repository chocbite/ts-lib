import ctm from "#context_menu";
import { theme_init } from "#theme";
import { ok } from "@chocbite/ts-lib/result";
import {
  state,
  type State,
  type StateJsonCompatible,
  type StateOrVal,
} from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import list from "..";
import type { ListRow } from "../row";
import {
  list_search_query,
  type ListCondition,
  type ListFilter,
} from "../search";

//Glyphs and backgrounds come from theme variables
theme_init();

afterEach(() => {
  document.body.replaceChildren();
});

type AnyRow = ListRow<any, any, any, any>;

const rows_of = (container: HTMLElement) =>
  [...container.querySelectorAll("list-row")] as AnyRow[];
/**Labels of the rows that can be seen, in display order */
const shown = (container: HTMLElement) =>
  rows_of(container)
    .filter((row) => (row.anchor as HTMLElement).checkVisibility())
    .map((row) => row.label);
const row_named = (container: HTMLElement, name: string) =>
  rows_of(container).find((row) => row.label === name)!;
const ALL = ["Ann", "Bob", "Dan"];
const press = (element: Element, key: string) =>
  element.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );
const header_cells = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>("list-headerfield"),
];
/**The column search cell of the column at the index */
const cell = (container: HTMLElement, index: number) =>
  header_cells(container)[index].querySelector<HTMLElement>(
    ":scope > [class~=list-search-cell]",
  )!;
const type_in = (element: HTMLElement, text: string) => {
  const input = element.querySelector("input")!;
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};
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
    .find((o) => o.textContent.startsWith(text))!
    .click();

/**Omit for each member of a union */
type Without<U, K extends PropertyKey> = U extends unknown ? Omit<U, K> : never;

/**Keys that differ from the names, so a text that matches a name shows it is the name that matched */
const STATUS = {
  r: { name: "Running" },
  p: { name: "Pending" },
  s: { name: "Stopped" },
};
type Status = keyof typeof STATUS;

interface Person {
  name: string;
  age: number;
  active: boolean;
  note: string;
  status: Status;
}
const person = (
  name: string,
  age: number,
  active: boolean,
  note: string,
  status: Status,
) => ({ name, age, active, note, status });
const people = () => [
  person("Ann", 31, true, "x", "r"),
  person("Bob", 45, false, "y", "p"),
  person("Dan", 28, true, "z", "s"),
];
const person_columns = () => ({
  name: list.column_string("Name"),
  age: list.column({
    title: "Age",
    type: "number",
    field_gen: () => list.number_field(),
    field_apply: (field, age: number) => (field.number = age),
  }),
  active: list.column({
    title: "Active",
    type: "bool",
    field_gen: () => list.text_field(),
    field_apply: (field, active: boolean) =>
      (field.text = active ? "yes" : "no"),
  }),
  //No type, so no cell, the search text still finds its values
  note: list.column({
    title: "Note",
    field_gen: () => list.text_field(),
    field_apply: (field, note: string) => (field.text = note),
  }),
  status: list.column({
    title: "Status",
    type: "enum",
    choices: STATUS,
    field_gen: () => list.text_field(),
    field_apply: (field, status: Status) => (field.text = STATUS[status].name),
  }),
});

function people_list(
  rows: Person[] | State<Person[]>,
  options: {
    filter?: StateOrVal<ListFilter>;
    column_search?: StateOrVal<boolean>;
    search?: StateOrVal<string>;
    search_bar?: boolean;
  } = {},
  config: { headless?: boolean; search_menu?: boolean; delay?: number } = {},
) {
  const container = list.container(
    {
      transform: (p: Person) =>
        ok({
          values: {
            name: p.name,
            age: p.age,
            active: p.active,
            note: p.note,
            status: p.status,
          },
        }),
      headless: config.headless,
      search_menu: config.search_menu ?? true,
      search_delay: config.delay ?? 0,
    },
    { columns: person_columns(), rows, ...options },
  );
  document.body.append(container);
  return container;
}

describe("List search conditions", () => {
  it("is a value JSON can store", () => {
    expectTypeOf<StateJsonCompatible<ListFilter>>().toEqualTypeOf<true>();
  });

  it("matches the conditions and the text with query.match, the conditions are not highlighted", () => {
    const older: ListCondition = {
      column: "age",
      type: "number",
      op: ">",
      value: 30,
    };
    const query = list_search_query("o", { conditions: [older] })!;
    expect(query.match({ name: "Bob", age: 45 })).toEqual({
      columns: ["name"],
      key: false,
    });
    expect(query.match({ name: "Bob", age: 20 })).toBeUndefined();
    //Without a value for its column a condition does not hold
    expect(query.match({ name: "Bob" })).toBeUndefined();
    const only = list_search_query("", { conditions: [older] })!;
    expect(only.text).toBe("");
    expect(only.match({ age: 45 })).toEqual({ columns: [], key: false });
    expect(list_search_query("", { conditions: [] })).toBeUndefined();
  });

  it("checks every kind of condition", () => {
    const holds = (
      condition: Without<ListCondition, "column">,
      value: string | number | boolean,
    ) =>
      list_search_query("", {
        conditions: [{ column: "x", ...condition }],
      })!.match({
        x: value,
      }) !== undefined;
    expect(holds({ type: "string", op: "contains", value: "OB" }, "Bob")).toBe(
      true,
    );
    expect(holds({ type: "string", op: "contains", value: "x" }, "Bob")).toBe(
      false,
    );
    expect(
      holds({ type: "string", op: "not_contains", value: "x" }, "Bob"),
    ).toBe(true);
    expect(holds({ type: "string", op: "is", value: "bob" }, "Bob")).toBe(true);
    expect(holds({ type: "string", op: "is", value: "bo" }, "Bob")).toBe(false);
    expect(holds({ type: "string", op: "is_not", value: "bob" }, "Bob")).toBe(
      false,
    );
    expect(holds({ type: "string", op: "is_not", value: "bo" }, "Bob")).toBe(
      true,
    );
    expect(holds({ type: "string", op: "starts", value: "bo" }, "Bob")).toBe(
      true,
    );
    expect(holds({ type: "string", op: "starts", value: "ob" }, "Bob")).toBe(
      false,
    );
    expect(holds({ type: "string", op: "ends", value: "OB" }, "Bob")).toBe(
      true,
    );
    expect(holds({ type: "string", op: "ends", value: "bo" }, "Bob")).toBe(
      false,
    );
    //Both ends are in the range, given in either order
    const between = (value: number, range: [number, number]) =>
      holds({ type: "number", op: "between", value: range }, value);
    expect(between(30, [30, 50])).toBe(true);
    expect(between(50, [30, 50])).toBe(true);
    expect(between(40, [50, 30])).toBe(true);
    expect(between(51, [30, 50])).toBe(false);
    expect(
      holds({ type: "number", op: "not_between", value: [30, 50] }, 51),
    ).toBe(true);
    expect(
      holds({ type: "number", op: "not_between", value: [30, 50] }, 30),
    ).toBe(false);
    expect(holds({ type: "number", op: "=", value: 5 }, 5)).toBe(true);
    expect(holds({ type: "number", op: "!=", value: 5 }, 5)).toBe(false);
    expect(holds({ type: "number", op: "<", value: 5 }, 4)).toBe(true);
    expect(holds({ type: "number", op: "<=", value: 5 }, 5)).toBe(true);
    expect(holds({ type: "number", op: ">", value: 5 }, 5)).toBe(false);
    expect(holds({ type: "number", op: ">=", value: 5 }, 5)).toBe(true);
    expect(holds({ type: "number", op: "=", value: 5 }, "5")).toBe(false);
    expect(holds({ type: "bool", value: true }, true)).toBe(true);
    expect(holds({ type: "bool", value: true }, false)).toBe(false);
    expect(holds({ type: "enum", op: "in", value: ["a", 2] }, 2)).toBe(true);
    expect(holds({ type: "enum", op: "in", value: ["a", 2] }, "b")).toBe(false);
    expect(holds({ type: "enum", op: "not_in", value: ["a"] }, "b")).toBe(true);
  });
});

describe("List column search", () => {
  it("shows a cell under the title of each column, by the type of the column", () => {
    const column_search = state.ok_w(false);
    const container = people_list(people(), { column_search });
    expect(container.querySelector(".list-search-cell")).toBeNull();
    void column_search.write(true);
    expect(
      header_cells(container).map((_, i) => cell(container, i).localName),
    ).toEqual([
      "list-searchtext",
      "list-searchnumber",
      "list-searchbool",
      "list-searchnone",
      "list-searchenum",
    ]);
    void column_search.write(false);
    expect(container.querySelector(".list-search-cell")).toBeNull();
  });

  it("does not change the widths of the columns, also not while typing", () => {
    const column_search = state.ok_w(false);
    const container = people_list(people(), { column_search });
    const widths = () => header_cells(container).map((h) => h.offsetWidth);
    const before = widths();
    void column_search.write(true);
    expect(widths()).toEqual(before);
    type_in(cell(container, 0), "x");
    expect(widths()).toEqual(before);
  });

  it("filters the rows whose value contains the text of a text cell, and writes the filter", () => {
    const filter = state.ok_w<ListFilter>({ conditions: [] });
    const container = people_list(people(), { filter, column_search: true });
    type_in(cell(container, 0), "AN");
    expect(shown(container)).toEqual(["Ann", "Dan"]);
    expect(filter.get().value).toEqual({
      conditions: [
        { column: "name", type: "string", op: "contains", value: "AN" },
      ],
    });
    type_in(cell(container, 0), "");
    expect(shown(container)).toEqual(ALL);
    expect(filter.get().value).toEqual({ conditions: [] });
  });

  it("starts a text and a number cell with ~, and puts the caret after it", async () => {
    const container = people_list(people(), { column_search: true });
    const input = cell(container, 1).querySelector("input")!;
    expect(cell(container, 0).querySelector("input")!.value).toBe("~");
    expect(input.value).toBe("~");
    input.setSelectionRange(0, 0);
    input.focus();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(input.selectionStart).toBe(1);
  });

  it("finds numbers as text with ~, and compares them with the other operators", () => {
    const filter = state.ok_w<ListFilter>({ conditions: [] });
    const container = people_list(people(), { filter, column_search: true });
    const age = cell(container, 1);
    type_in(age, "~4");
    expect(shown(container)).toEqual(["Bob"]);
    expect(filter.get().value).toEqual({
      conditions: [
        { column: "age", type: "string", op: "contains", value: "4" },
      ],
    });
    //Without an operator it is ~
    type_in(age, "3");
    expect(shown(container)).toEqual(["Ann"]);
    type_in(age, "=4");
    expect(shown(container)).toEqual([]);
    type_in(age, ">30");
    expect(shown(container)).toEqual(["Ann", "Bob"]);
    expect(filter.get().value).toEqual({
      conditions: [{ column: "age", type: "number", op: ">", value: 30 }],
    });
    type_in(age, "<=31");
    expect(shown(container)).toEqual(["Ann", "Dan"]);
    type_in(age, ">= 45");
    expect(shown(container)).toEqual(["Bob"]);
    type_in(age, "!=45");
    expect(shown(container)).toEqual(["Ann", "Dan"]);
    type_in(age, "<");
    expect(shown(container)).toEqual(ALL);
  });

  it("finds numbers between two with .., and not between with !=", () => {
    const filter = state.ok_w<ListFilter>({ conditions: [] });
    const container = people_list(people(), { filter, column_search: true });
    const age = cell(container, 1);
    type_in(age, "30..50");
    expect(shown(container)).toEqual(["Ann", "Bob"]);
    expect(filter.get().value).toEqual({
      conditions: [
        { column: "age", type: "number", op: "between", value: [30, 50] },
      ],
    });
    type_in(age, "=28 .. 31");
    expect(shown(container)).toEqual(["Ann", "Dan"]);
    type_in(age, "!=30..40");
    expect(shown(container)).toEqual(["Bob", "Dan"]);
    expect(filter.get().value).toEqual({
      conditions: [
        { column: "age", type: "number", op: "not_between", value: [30, 40] },
      ],
    });
    type_in(age, "-1,5..28,5");
    expect(shown(container)).toEqual(["Dan"]);
    //A range can not be smaller or bigger
    type_in(age, ">30..40");
    expect(age.classList.contains("invalid")).toBe(true);
    expect(shown(container)).toEqual(ALL);
  });

  it("writes a range from the app with .. and not between with !=", () => {
    const filter = state.ok_w<ListFilter>({
      conditions: [
        { column: "age", type: "number", op: "between", value: [30, 50] },
      ],
    });
    const container = people_list(people(), { filter, column_search: true });
    const input = cell(container, 1).querySelector("input")!;
    expect(input.value).toBe("30..50");
    void filter.write({
      conditions: [
        { column: "age", type: "number", op: "not_between", value: [30, 50] },
      ],
    });
    expect(input.value).toBe("!=30..50");
    expect(shown(container)).toEqual(["Dan"]);
  });

  it("finds a text that ends with $", () => {
    const filter = state.ok_w<ListFilter>({ conditions: [] });
    const container = people_list(people(), { filter, column_search: true });
    type_in(cell(container, 0), "$AN");
    expect(shown(container)).toEqual(["Dan"]);
    expect(filter.get().value).toEqual({
      conditions: [{ column: "name", type: "string", op: "ends", value: "AN" }],
    });
  });

  it("takes the single keys ≥ ≤ ≠ and a decimal comma", () => {
    const container = people_list(people(), { column_search: true });
    const age = cell(container, 1);
    type_in(age, "≥45");
    expect(shown(container)).toEqual(["Bob"]);
    type_in(age, "≤ 28,5");
    expect(shown(container)).toEqual(["Dan"]);
    type_in(age, "≠31");
    expect(shown(container)).toEqual(["Bob", "Dan"]);
  });

  it("marks a number it can not read and does not filter by it", () => {
    const container = people_list(people(), { column_search: true });
    const age = cell(container, 1);
    type_in(age, "=4x");
    expect(age.classList.contains("invalid")).toBe(true);
    expect(shown(container)).toEqual(ALL);
    //Still the text that was typed
    expect(age.querySelector("input")!.value).toBe("=4x");
    type_in(age, "=45");
    expect(age.classList.contains("invalid")).toBe(false);
    expect(shown(container)).toEqual(["Bob"]);
  });

  it("matches a whole text with =, not it with != and leaves out a text with !~", () => {
    const filter = state.ok_w<ListFilter>({ conditions: [] });
    const container = people_list(people(), { filter, column_search: true });
    const name = cell(container, 0);
    type_in(name, "=ann");
    expect(shown(container)).toEqual(["Ann"]);
    expect(filter.get().value).toEqual({
      conditions: [{ column: "name", type: "string", op: "is", value: "ann" }],
    });
    type_in(name, "=an");
    expect(shown(container)).toEqual([]);
    type_in(name, "!=ann");
    expect(shown(container)).toEqual(["Bob", "Dan"]);
    type_in(name, "!~an");
    expect(shown(container)).toEqual(["Bob"]);
    //Text can not be compared by size
    type_in(name, ">b");
    expect(name.classList.contains("invalid")).toBe(true);
    expect(shown(container)).toEqual(ALL);
  });

  it("keeps what is typed while it means the same, and clears to ~ with escape and the cross", () => {
    const filter = state.ok_w<ListFilter>({ conditions: [] });
    const container = people_list(people(), { filter, column_search: true });
    const age = cell(container, 1);
    const input = age.querySelector("input")!;
    type_in(age, "= 45");
    expect(input.value).toBe("= 45");
    void filter.write({
      conditions: [{ column: "age", type: "number", op: "=", value: 45 }],
    });
    expect(input.value).toBe("= 45");
    press(input, "Escape");
    expect(input.value).toBe("~");
    expect(filter.get().value).toEqual({ conditions: [] });
    type_in(age, ">30");
    age.querySelector<HTMLElement>(".clear")!.click();
    expect(input.value).toBe("~");
    expect(shown(container)).toEqual(ALL);
  });

  it("cycles a bool cell through any, yes and no", () => {
    const container = people_list(people(), { column_search: true });
    const bool = cell(container, 2);
    bool.click();
    expect(shown(container)).toEqual(["Ann", "Dan"]);
    bool.click();
    expect(shown(container)).toEqual(["Bob"]);
    bool.click();
    expect(shown(container)).toEqual(ALL);
  });

  it("combines the cells with each other and the search text, and highlights only the text", () => {
    const container = people_list(people(), {
      column_search: true,
      search: "a",
    });
    expect(shown(container)).toEqual(["Ann", "Dan"]);
    type_in(cell(container, 1), "28");
    expect(shown(container)).toEqual(["Dan"]);
    const cells = [...row_named(container, "Dan").firstElementChild!.children];
    expect(cells.map((c) => c.classList.contains("search-found"))).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it("follows a filter state, and shows conditions it can not edit as a summary that clears", () => {
    const filter = state.ok_w<ListFilter>({
      conditions: [
        { column: "age", type: "number", op: ">", value: 30 },
        { column: "age", type: "number", op: "<", value: 40 },
      ],
    });
    const container = people_list(people(), { filter, column_search: true });
    expect(shown(container)).toEqual(["Ann"]);
    const age = cell(container, 1);
    expect(age.querySelector(".summary")!.textContent).toBe("& >30, <40");
    expect(age.querySelector("input")!.checkVisibility()).toBe(false);
    age.querySelector<HTMLElement>(".clear")!.click();
    expect(filter.get().value).toEqual({ conditions: [] });
    expect(shown(container)).toEqual(ALL);
    void filter.write({
      conditions: [{ column: "age", type: "number", op: "=", value: 45 }],
    });
    expect(age.querySelector("input")!.value).toBe("=45");
    expect(shown(container)).toEqual(["Bob"]);
  });

  it("filters without the cells shown, and leaves out conditions of columns the list does not have", () => {
    const container = people_list(people(), {
      filter: {
        conditions: [
          { column: "active", type: "bool", value: false },
          { column: "gone", type: "string", op: "contains", value: "zzz" },
        ],
      },
    });
    expect(shown(container)).toEqual(["Bob"]);
  });

  it("is locked by a read only filter state", () => {
    const filter = state.ok<ListFilter>({
      conditions: [
        { column: "name", type: "string", op: "contains", value: "b" },
      ],
    });
    const container = people_list(people(), {
      filter: filter.read_only,
      column_search: true,
    });
    expect(cell(container, 0).querySelector("input")!.readOnly).toBe(true);
    cell(container, 2).click();
    expect(shown(container)).toEqual(["Bob"]);
  });

  it("waits for the delay while typing in a cell, and searches right away for enter", () => {
    const container = people_list(
      people(),
      { column_search: true },
      { delay: 50 },
    );
    type_in(cell(container, 0), "bob");
    expect(shown(container)).toEqual(ALL);
    press(cell(container, 0).querySelector("input")!, "Enter");
    expect(shown(container)).toEqual(["Bob"]);
  });

  it("keeps the cells and their filter when the columns change", () => {
    const container = people_list(people(), { column_search: true });
    type_in(cell(container, 0), "bob");
    container.set({ columns: person_columns() });
    expect(cell(container, 0).querySelector("input")!.value).toBe("~bob");
    expect(shown(container)).toEqual(["Bob"]);
  });

  it("shows only the cells in a headless list, and nothing above the rows without the column search", () => {
    const container = people_list(
      people(),
      { column_search: true },
      { headless: true },
    );
    expect(cell(container, 0).localName).toBe("list-searchtext");
    expect(
      header_cells(container)[0]
        .querySelector<HTMLElement>(":scope > div")!
        .checkVisibility(),
    ).toBe(false);
    container.set({ column_search: false });
    expect(container.querySelector("list-headerrow")).toBeNull();
  });
});

describe("List search menu", () => {
  it("has search columns and clear search in the menus of the rows, the headers and the list", () => {
    const column_search = state.ok_w(false);
    const container = people_list(people(), { column_search, search: "a" });
    right_click(row_named(container, "Ann").anchor!);
    expect(texts()).toEqual([
      "Search columns",
      "Advanced search…",
      "Clear search",
    ]);
    choose("Search columns");
    expect(column_search.get().value).toBe(true);
    //The title has the lines sorting by its column in front
    right_click(
      header_cells(container)[0].querySelector(":scope > div > span")!,
    );
    expect(texts()).toEqual([
      "Sort A to Z",
      "Sort Z to A",
      "Hide column search",
      "Advanced search…",
      "Clear search",
    ]);
    choose("Clear search");
    expect(shown(container)).toEqual(ALL);
    right_click(container);
    expect(texts()).toEqual(["Hide column search", "Advanced search…"]);
    choose("Hide column search");
    expect(column_search.get().value).toBe(false);
  });

  it("shows the menu of the list on the search bar and the cells, their inputs too", () => {
    const container = people_list(people(), {
      search: "a",
      search_bar: true,
      column_search: true,
    });
    const bar = container.querySelector<HTMLElement>("list-searchbar input")!;
    const lines = ["Hide column search", "Advanced search…", "Clear search"];
    for (const target of [
      bar,
      cell(container, 0).querySelector("input")!,
      cell(container, 1).querySelector("input")!,
      cell(container, 4),
    ]) {
      right_click(target);
      expect(texts()).toEqual(lines);
    }
    choose("Clear search");
    expect(shown(container)).toEqual(ALL);
  });

  it("clears the filter when the column search is hidden from the menu", () => {
    const filter = state.ok_w<ListFilter>({
      conditions: [{ column: "age", type: "number", op: "=", value: 45 }],
    });
    const container = people_list(people(), { filter, column_search: true });
    right_click(header_cells(container)[0]);
    choose("Hide column search");
    expect(filter.get().value).toEqual({ conditions: [] });
    expect(shown(container)).toEqual(ALL);
  });

  it("has no line to search columns for a read only column search state", () => {
    const container = people_list(people(), {
      column_search: state.ok(false).read_only,
    });
    right_click(header_cells(container)[0]);
    expect(texts()).not.toContain("Search columns");
  });

  it("has no search lines without search_menu", () => {
    const container = people_list(
      people(),
      { search: "a" },
      { search_menu: false },
    );
    //A row without one of its own has none, the list takes the right click without lines, so the browser menu does not open
    expect(ctm.has(row_named(container, "Ann"))).toBe(false);
    for (const target of [row_named(container, "Ann"), container]) {
      //A menu of the test before can still be open, no menu opens over it
      const before = options();
      const event = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(options()).toEqual(before);
    }
  });
});

describe("List column search of an enum", () => {
  const status = (container: HTMLElement) => cell(container, 4);
  const panel = (container: HTMLElement) =>
    status(container).querySelector<HTMLElement>("list-searchchoices");
  const choices = (container: HTMLElement) => [
    ...panel(container)!.querySelectorAll<HTMLElement>(".choice"),
  ];
  const choice = (container: HTMLElement, name: string) =>
    choices(container).find((c) => c.textContent === name)!;
  const open = (container: HTMLElement) =>
    panel(container)?.checkVisibility() ?? false;

  it("folds down the choices under the cell, a press on one filters by it, and the cell shows the names", () => {
    const filter = state.ok_w<ListFilter>({ conditions: [] });
    const container = people_list(people(), { filter, column_search: true });
    expect(status(container).localName).toBe("list-searchenum");
    expect(open(container)).toBe(false);
    status(container).click();
    expect(open(container)).toBe(true);
    expect(choices(container).map((c) => c.textContent)).toEqual([
      "Running",
      "Pending",
      "Stopped",
    ]);
    choice(container, "Running").click();
    expect(filter.get().value).toEqual({
      conditions: [{ column: "status", type: "enum", op: "in", value: ["r"] }],
    });
    expect(shown(container)).toEqual(["Ann"]);
    choice(container, "Stopped").click();
    expect(shown(container)).toEqual(["Ann", "Dan"]);
    expect(status(container).querySelector(".text")!.textContent).toBe(
      "Running, Stopped",
    );
    //Stays open to choose more
    expect(open(container)).toBe(true);
    choice(container, "Running").click();
    expect(shown(container)).toEqual(["Dan"]);
  });

  it("closes the choices on a press outside, escape and a press on the cell", () => {
    const container = people_list(people(), { column_search: true });
    status(container).click();
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    expect(open(container)).toBe(false);
    status(container).click();
    press(choices(container)[0], "Escape");
    expect(open(container)).toBe(false);
    status(container).click();
    status(container).click();
    expect(open(container)).toBe(false);
  });

  it("shows a condition it can not edit as a summary with the names", () => {
    const container = people_list(people(), {
      filter: {
        conditions: [
          { column: "status", type: "enum", op: "not_in", value: ["s"] },
        ],
      },
      column_search: true,
    });
    expect(shown(container)).toEqual(["Ann", "Bob"]);
    expect(status(container).querySelector(".summary")!.textContent).toBe(
      "& not Stopped",
    );
  });

  it("has clear all over the choices, which leaves them all out and stays open", () => {
    const filter = state.ok_w<ListFilter>({
      conditions: [
        { column: "status", type: "enum", op: "in", value: ["r", "s"] },
      ],
    });
    const container = people_list(people(), { filter, column_search: true });
    status(container).click();
    const clear = panel(container)!.querySelector<HTMLElement>(".clear-all")!;
    expect(clear.textContent).toBe("Clear all");
    clear.click();
    expect(filter.get().value).toEqual({ conditions: [] });
    expect(shown(container)).toEqual(ALL);
    expect(open(container)).toBe(true);
    expect(choices(container).some((c) => c.classList.contains("picked"))).toBe(
      false,
    );
  });

  it("does not fold down for a read only filter state", () => {
    const container = people_list(people(), {
      filter: state.ok<ListFilter>({ conditions: [] }).read_only,
      column_search: true,
    });
    status(container).click();
    expect(open(container)).toBe(false);
  });

  it("keeps the choices inside a short list", () => {
    const container = people_list(people(), { column_search: true });
    container.style.height = "5rem";
    status(container).click();
    const list_box = container.getBoundingClientRect();
    const box = panel(container)!.getBoundingClientRect();
    expect(box.bottom).toBeLessThanOrEqual(list_box.bottom + 1);
    expect(box.right).toBeLessThanOrEqual(list_box.right + 1);
  });

  it("matches the search text with the names of the choices", () => {
    const container = people_list(people(), { search: "pend" });
    expect(shown(container)).toEqual(["Bob"]);
  });

  it("matches the text of a value shown as a text by the text and a condition by the value", () => {
    const query = list_search_query("run", {
      conditions: [{ column: "s", type: "enum", op: "in", value: ["r"] }],
    })!;
    expect(query.match({ s: { value: "r", text: "Running" } })).toEqual({
      columns: ["s"],
      key: false,
    });
    expect(query.match({ s: { value: "p", text: "Running" } })).toBeUndefined();
  });
});
