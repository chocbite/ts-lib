import { theme_init } from "#theme";
import { err, ok } from "@chocbite/ts-lib/result";
import {
  state,
  type State,
  type StateOrVal,
  type StateROSW,
} from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import list from "..";
import type { ListRow } from "../row";
import {
  list_search_query,
  type ListSearchQuery,
  type ListSearchResult,
} from "../search";

//Row backgrounds and line sizes come from theme variables
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
const press = (element: Element, key: string, init: KeyboardEventInit = {}) =>
  element.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const bar = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("list-searchbar");
const input = (container: HTMLElement) =>
  bar(container)!.querySelector("input")!;
const type = (container: HTMLElement, text: string) => {
  input(container).value = text;
  input(container).dispatchEvent(new Event("input", { bubbles: true }));
};
const warning = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>("input.list-warn")
    ?.validationMessage ?? "";

interface SearchOptions {
  search?: StateOrVal<string>;
  search_bar?: StateOrVal<boolean>;
}

//      ______ _      _______
//     |  ____| |    |__   __|
//     | |__  | |       | |
//     |  __| | |       | |
//     | |    | |____   | |
//     |_|    |______|  |_|

interface User {
  id: number;
  name: string;
  age: number;
  /**Shown by its name, searched through search_value */
  city: { name: string };
  /**An object the list can not read, not searched */
  tag: { text: string };
  /**A sync state, searched by its value */
  score: State<number>;
}
const user = (
  id: number,
  name: string,
  age: number,
  city: string,
  tag: string,
  score: number,
): User => ({
  id,
  name,
  age,
  city: { name: city },
  tag: { text: tag },
  score: state.ok(score),
});
const people = () => [
  user(1, "Ann", 31, "Oslo", "red", 7),
  user(2, "Bob", 45, "Rome", "blue", 8),
  user(3, "Dan", 28, "Kyiv", "green", 9),
];

type UserValues = Omit<User, "id">;

const user_columns = () => ({
  name: list.column_string("Name"),
  age: list.column({
    title: "Age",
    field_gen: () => list.number_field(),
    field_apply: (field, age: number) => (field.number = age),
  }),
  city: list.column({
    title: "City",
    field_gen: () => list.text_field(),
    field_apply: (field, city: { name: string }) => (field.text = city.name),
    search_value: (city) => city.name,
  }),
  tag: list.column({
    title: "Tag",
    field_gen: () => list.text_field(),
    field_apply: (field, tag: { text: string }) => (field.text = tag.text),
  }),
  score: list.column({
    title: "Score",
    field_gen: () => list.number_field(),
    field_apply: (_field, _score: State<number>) => {},
  }),
});

function users(
  rows: User[] | State<User[]>,
  options: SearchOptions & {
    selected?: StateROSW<number[], any, number[]>;
    /**Search answer of every row, without it the rows match by their values */
    answer?: (u: User, query: ListSearchQuery) => ListSearchResult<UserValues>;
    /**Search delay, 0 searches right away */
    delay?: number;
  } = {},
) {
  const { answer, delay, ...inputs } = options;
  const container = list.container(
    {
      transform: (u: User) =>
        ok({
          values: {
            name: u.name,
            age: u.age,
            city: u.city,
            tag: u.tag,
            score: u.score,
          },
          search: answer ? (query) => answer(u, query) : undefined,
        }),
      selection: inputs.selected
        ? { mode: "multi", key: (u: User) => u.id }
        : undefined,
      search_delay: delay ?? 0,
    },
    { columns: user_columns(), rows, ...inputs },
  );
  document.body.append(container);
  return container;
}

describe("List search of a flat list", () => {
  it("hides the rows whose values do not contain the text, ignoring case", () => {
    const container = users(people(), { search: "AN" });
    expect(shown(container)).toEqual(["Ann", "Dan"]);
  });

  it("matches numbers as text, a sync state by its value and an object by the search_value of its column", () => {
    const search = state.ok_w("45");
    const container = users(people(), { search });
    expect(shown(container)).toEqual(["Bob"]);
    void search.write("9");
    expect(shown(container)).toEqual(["Dan"]);
    void search.write("oslo");
    expect(shown(container)).toEqual(["Ann"]);
  });

  it("does not search a column whose values it can not read", () => {
    const container = users(people(), { search: "red" });
    expect(shown(container)).toEqual([]);
  });

  it("shows every row for an empty or blank text", () => {
    const search = state.ok_w("bob");
    const container = users(people(), { search });
    void search.write("  ");
    expect(shown(container)).toEqual(["Ann", "Bob", "Dan"]);
  });

  it("follows a state given with set, and a fixed value given after it", () => {
    const search = state.ok_w("ann");
    const container = users(people());
    expect(shown(container)).toEqual(["Ann", "Bob", "Dan"]);
    container.set({ search });
    expect(shown(container)).toEqual(["Ann"]);
    container.set({ search: "bob" });
    expect(shown(container)).toEqual(["Bob"]);
    void search.write("dan");
    expect(shown(container)).toEqual(["Bob"]);
    expect(search.amount()).toBe(0);
  });

  it("searches rows added or changed while searching", () => {
    const rows = state.ok_w(people());
    const container = users(rows, { search: "e" });
    expect(shown(container)).toEqual(["Bob"]);
    rows.array.push(user(4, "Eve", 50, "Bern", "x", 1));
    expect(shown(container)).toEqual(["Bob", "Eve"]);
    rows.array.change(0, user(1, "Anne", 31, "Oslo", "red", 7));
    expect(shown(container)).toEqual(["Anne", "Bob", "Eve"]);
  });

  it("shows a line when nothing matches", () => {
    const search = state.ok_w("zzz");
    const container = users(people(), { search });
    const none = () => container.querySelector<HTMLElement>("list-searchempty");
    expect(none()?.checkVisibility()).toBe(true);
    expect(none()!.textContent).toBe("No matches");
    void search.write("ann");
    expect(none()?.checkVisibility() ?? false).toBe(false);
  });

  it("alternates the row backgrounds over the rows it shows", () => {
    const container = users([...people(), user(4, "Eve", 50, "Bern", "x", 1)], {
      search: "e",
    });
    const background = (name: string) =>
      getComputedStyle(row_named(container, name).anchor!).backgroundColor;
    expect(shown(container)).toEqual(["Bob", "Eve"]);
    expect(background("Bob")).not.toBe(background("Eve"));
  });

  it("selects only the rows it shows, and keeps hidden selected keys in the state", () => {
    const selected = state.ok_w<number[]>([2]);
    const search = state.ok_w("an");
    const container = users(people(), { search, selected });
    expect(row_named(container, "Bob").selected).toBe(false);
    expect(selected.get().value).toEqual([2]);
    void search.write("");
    expect(row_named(container, "Bob").selected).toBe(true);
    void search.write("an");
    press(row_named(container, "Ann").anchor!, "a", { ctrlKey: true });
    expect(selected.get().value).toEqual([1, 3]);
  });
});

//      ____          _____
//     |  _ \   /\   |  __ \
//     | |_) | /  \  | |__) |
//     |  _ < / /\ \ |  _  /
//     | |_) / ____ \| | \ \
//     |____/_/    \_\_|  \_\

describe("List search bar", () => {
  it("shows a bar above the list that searches the rows", () => {
    const container = users(people(), { search_bar: true });
    type(container, "bob");
    expect(shown(container)).toEqual(["Bob"]);
    container.set({ search_bar: false });
    expect(bar(container)?.checkVisibility() ?? false).toBe(false);
    //The search stays without the bar
    expect(shown(container)).toEqual(["Bob"]);
  });

  it("writes a writable search state and shows the value of the state", () => {
    const search = state.ok_w("ann");
    const container = users(people(), { search, search_bar: true });
    expect(input(container).value).toBe("ann");
    type(container, "dan");
    expect(search.get().value).toBe("dan");
    expect(shown(container)).toEqual(["Dan"]);
    void search.write("bob");
    expect(input(container).value).toBe("bob");
  });

  it("is locked by a read only search state", () => {
    const search = state.ok("ann");
    const container = users(people(), {
      search: search.read_only,
      search_bar: true,
    });
    expect(input(container).readOnly).toBe(true);
    container.set({ search: "bob" });
    expect(input(container).readOnly).toBe(false);
  });

  it("clears with its clear button and with Escape", () => {
    const container = users(people(), { search: "ann", search_bar: true });
    bar(container)!.querySelector<HTMLElement>(".clear")!.click();
    expect(input(container).value).toBe("");
    expect(shown(container)).toEqual(["Ann", "Bob", "Dan"]);
    type(container, "bob");
    press(input(container), "Escape");
    expect(input(container).value).toBe("");
    expect(shown(container)).toEqual(["Ann", "Bob", "Dan"]);
  });

  it("keeps the header below the bar", () => {
    const container = users(people(), { search_bar: true });
    const header = container.querySelector<HTMLElement>("list-headerfield")!;
    expect(parseFloat(getComputedStyle(header).top)).toBeCloseTo(
      bar(container)!.offsetHeight,
      0,
    );
  });
});

//      _______ _____  ______ ______
//     |__   __|  __ \|  ____|  ____|
//        | |  | |__) | |__  | |__
//        | |  |  _  /|  __| |  __|
//        | |  | | \ \| |____| |____
//        |_|  |_|  \_\______|______|

interface Node {
  name: string;
  sub?: Node[];
  opened?: State<boolean>;
  invalid?: boolean;
}
const node = (name: string, sub?: Node[], opened?: State<boolean>): Node => ({
  name,
  sub,
  opened,
});
const files = (docs?: State<boolean>, pics?: State<boolean>) => [
  node("docs", [node("old", [node("2019.txt")]), node("notes.md")], docs),
  node("pics", [node("cat.png")], pics),
  node("readme.md"),
];
/**Whether a node below the node matches, the app answers from its own data */
const found_below = (item: Node, query: ListSearchQuery): boolean =>
  (item.sub ?? []).some(
    (sub) => query.match({}, sub.name) || found_below(sub, query),
  );

function tree(
  rows: Node[] | State<Node[]>,
  options: SearchOptions = {},
  config: {
    provider?: boolean;
    reorder?: boolean;
    always_below?: boolean;
    /**Answers match instead of the found key, so nothing is highlighted */
    plain_match?: boolean;
  } = {},
) {
  const provider = config.provider ?? true;
  const container = list.container(
    {
      transform: (item: Node) =>
        item.invalid
          ? err("invalid")
          : ok({
              openable: Boolean(item.sub),
              opened: item.opened,
              key_field: { text: item.name },
              sub_rows: () => item.sub ?? [],
              search: provider
                ? (query: ListSearchQuery): ListSearchResult =>
                    config.always_below
                      ? "below"
                      : ((config.plain_match
                          ? query.match({}, item.name) && "match"
                          : query.match({}, item.name)) ??
                        (found_below(item, query) ? "below" : "none"))
                : undefined,
              values: {},
            }),
      sub_rows: true,
      reorder: config.reorder ? {} : undefined,
      search_delay: 0,
    },
    { columns: {}, rows, ...options },
  );
  document.body.append(container);
  return container;
}

describe("List search of sub rows", () => {
  it("opens the rows it finds something below, showing only what matches in them", () => {
    const container = tree(files(), { search: "2019" });
    expect(shown(container)).toEqual(["docs", "old", "2019.txt"]);
  });

  it("shows a matching row as it is, without filtering its sub rows", () => {
    const container = tree(files(), { search: "pic" });
    expect(shown(container)).toEqual(["pics"]);
    row_named(container, "pics").open = true;
    expect(shown(container)).toEqual(["pics", "cat.png"]);
  });

  it("closes the rows it opened when the search clears, and keeps the rows the user opened", () => {
    const search = state.ok_w("");
    const container = tree(files(), { search });
    row_named(container, "pics").open = true;
    void search.write("2019");
    expect(shown(container)).toEqual(["docs", "old", "2019.txt"]);
    void search.write("");
    expect(shown(container)).toEqual(["docs", "pics", "cat.png", "readme.md"]);
  });

  it("does not write the opened states of the rows it opens, and leaves a row open that its state opens", () => {
    const docs = state.ok_w(false);
    const pics = state.ok_w(true);
    const search = state.ok_w("2019");
    const container = tree(files(docs, pics), { search });
    expect(shown(container)).toEqual(["docs", "old", "2019.txt"]);
    expect(docs.get().value).toBe(false);
    void search.write("cat");
    expect(shown(container)).toEqual(["pics", "cat.png"]);
    void search.write("");
    expect(shown(container)).toEqual(["docs", "pics", "cat.png", "readme.md"]);
    expect(pics.get().value).toBe(true);
  });

  it("leaves a row the user closed closed until the search changes", () => {
    const search = state.ok_w("2019");
    const container = tree(files(), { search });
    row_named(container, "docs").open = false;
    expect(shown(container)).toEqual(["docs"]);
    void search.write("201");
    expect(shown(container)).toEqual(["docs", "old", "2019.txt"]);
  });

  it("matches rows without a search by their own values and key field text, without opening them", () => {
    const search = state.ok_w("2019");
    const container = tree(files(), { search }, { provider: false });
    expect(shown(container)).toEqual([]);
    void search.write("DOC");
    expect(shown(container)).toEqual(["docs"]);
  });

  it("hides invalid rows while searching", () => {
    const search = state.ok_w("");
    const container = tree([node("a"), { name: "b", invalid: true }], {
      search,
    });
    expect(shown(container)).toEqual(["a", ""]);
    //The error text of the invalid row is not searched
    void search.write("inv");
    expect(shown(container)).toEqual([]);
  });

  it("ends the line of the last sub row it shows in the middle of the row", () => {
    const container = tree(files(), { search: "2019" });
    const opener = row_named(container, "old").querySelector(
      ":scope > div > list-keyfield > span.opener",
    )!;
    expect(parseFloat(getComputedStyle(opener, "::before").height)).toBeCloseTo(
      opener.clientHeight / 2,
      0,
    );
  });

  it("stops after opening 1000 rows with a warning, the upper levels first", () => {
    const endless = (name: string): Node => ({
      name,
      get sub() {
        return [
          endless(name + ".1"),
          endless(name + ".2"),
          endless(name + ".3"),
        ];
      },
    });
    const container = tree(
      [endless("x")],
      { search: "x" },
      { always_below: true },
    );
    const amount = rows_of(container).length;
    expect(amount).toBeGreaterThan(1000);
    expect(amount).toBeLessThanOrEqual(1 + 3 * 1000);
    expect(warning(container)).toBe(
      "Stopped after opening 1000 rows for the search",
    );
    //Level by level, every row above the deepest level is open
    const depth = (row: AnyRow) => row.label.split(".").length - 1;
    const deepest = Math.max(...rows_of(container).map(depth));
    for (const row of rows_of(container))
      if (depth(row) < deepest - 1) expect(row.open).toBe(true);
  });

  it("skips the rows it hides when moving the focus with the arrow keys", () => {
    const container = tree(files(), { search: "e" });
    expect(shown(container)).toEqual(["docs", "notes.md", "readme.md"]);
    const key_field = (name: string) =>
      row_named(container, name).querySelector<HTMLElement>("list-keyfield")!;
    const focused = () =>
      (document.activeElement?.closest("list-row") as AnyRow | null)?.label;
    key_field("docs").focus();
    press(key_field("docs"), "ArrowDown");
    expect(focused()).toBe("notes.md");
    press(key_field("notes.md"), "ArrowDown");
    expect(focused()).toBe("readme.md");
    press(key_field("readme.md"), "ArrowUp");
    expect(focused()).toBe("notes.md");
    press(key_field("notes.md"), "ArrowUp");
    expect(focused()).toBe("docs");
  });

  it("does not open hidden rows with open all", () => {
    const container = tree(files(), { search: "readme" });
    container.open_all();
    expect(row_named(container, "docs").open).toBe(false);
    expect(row_named(container, "pics").open).toBe(false);
  });

  it("moves a row past the rows it hides with alt and the arrow keys", async () => {
    const rows = state.ok_w([node("a1"), node("b"), node("a2")]);
    const container = tree(rows, { search: "a" }, { reorder: true });
    const key_field = row_named(container, "a1").querySelector<HTMLElement>(
      "list-keyfield",
    )!;
    press(key_field, "ArrowDown", { altKey: true });
    await settle();
    expect(rows.get().value.map((n) => n.name)).toEqual(["b", "a2", "a1"]);
  });
});

//      _    _ _____ _____ _    _ _      _____ _____ _    _ _______
//     | |  | |_   _/ ____| |  | | |    |_   _/ ____| |  | |__   __|
//     | |__| | | || |  __| |__| | |      | || |  __| |__| |  | |
//     |  __  | | || | |_ |  __  | |      | || | |_ |  __  |  | |
//     | |  | |_| || |__| | |  | | |____ _| || |__| | |  | |  | |
//     |_|  |_|_____\_____|_|  |_|______|_____\_____|_|  |_|  |_|

describe("List search highlights", () => {
  const cells = (row: AnyRow) =>
    [...row.firstElementChild!.children] as HTMLElement[];
  const found = (row: AnyRow) =>
    cells(row).map((cell) => cell.classList.contains("search-found"));
  const highlighted = (element: Element) =>
    getComputedStyle(element).backgroundImage !== "none";

  it("gives the columns and the key text that have the text from query.match", () => {
    const query = list_search_query("o")!;
    expect(query.match({ a: "Bob", b: 10, c: "x" }, "Old")).toEqual({
      columns: ["a"],
      key: true,
    });
    expect(query.match({ a: "x" }, "y")).toBeUndefined();
    //Numbers as text
    expect(list_search_query("4")!.match({ b: 40 })).toEqual({
      columns: ["b"],
      key: false,
    });
  });

  it("types an answer written in the transform of a list with columns, checking the keys it returns", () => {
    //Checked by the typecheck, the query gets its type before the list knows the columns
    const columns = { name: list.column_string("Name") };
    list.container(
      {
        transform: (u: User) =>
          ok({
            values: { name: u.name },
            search: (query) => query.match({ name: u.name }) ?? "none",
          }),
      },
      { columns, rows: people() },
    );
    list.container(
      {
        // @ts-expect-error A column the list does not have
        transform: (u: User) =>
          ok({
            values: { name: u.name },
            search: (query) => query.match({ nmae: u.name }) ?? "none",
          }),
      },
      { columns, rows: people() },
    );
  });

  it("highlights the cells whose values have the text, until the search clears", () => {
    const search = state.ok_w("o");
    const container = users(people(), { search });
    expect(found(row_named(container, "Ann"))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
    const bob = row_named(container, "Bob");
    expect(found(bob)).toEqual([true, false, true, false, false]);
    expect(highlighted(cells(bob)[0])).toBe(true);
    expect(highlighted(cells(bob)[1])).toBe(false);
    void search.write("");
    expect(found(bob)).toEqual([false, false, false, false, false]);
    expect(highlighted(cells(bob)[0])).toBe(false);
  });

  it("highlights the columns a search answer gives, and nothing for a plain match", () => {
    let result: ListSearchResult<UserValues> = { columns: ["city"] };
    const search = state.ok_w("x");
    const container = users(people(), { search, answer: () => result });
    expect(found(row_named(container, "Ann"))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
    result = "match";
    void search.write("y");
    expect(found(row_named(container, "Ann"))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("keeps the highlights when the columns change", () => {
    const container = users(people(), { search: "rome" });
    container.set({ columns: user_columns() });
    expect(found(row_named(container, "Bob"))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it("highlights the key field text of a row the answer found the text in, and not of a plain match", () => {
    const key = (container: HTMLElement, name: string) =>
      row_named(container, name).querySelector("list-keyfield")!;
    const container = tree(files(), { search: "doc" });
    expect(highlighted(key(container, "docs").querySelector(".text")!)).toBe(
      true,
    );
    //Only the text, not the tree lines and the opener
    expect(highlighted(key(container, "docs"))).toBe(false);
    const plain = tree(files(), { search: "doc" }, { plain_match: true });
    expect(highlighted(key(plain, "docs").querySelector(".text")!)).toBe(false);
  });
});

//      _____  ______ _           __     __
//     |  __ \|  ____| |        /\ \   / /
//     | |  | | |__  | |       /  \ \_/ /
//     | |  | |  __| | |      / /\ \   /
//     | |__| | |____| |____ / ____ \| |
//     |_____/|______|______/_/    \_\_|

describe("List search delay", () => {
  it("waits for the delay after the text changes, and searches once for a burst of changes", async () => {
    let answers = 0;
    const search = state.ok_w("");
    const container = users(people(), {
      search,
      delay: 50,
      answer: (u, query) => {
        answers++;
        return query.match({ name: u.name }) ?? "none";
      },
    });
    void search.write("a");
    void search.write("an");
    void search.write("ann");
    expect(shown(container)).toEqual(["Ann", "Bob", "Dan"]);
    expect(answers).toBe(0);
    await wait(100);
    expect(shown(container)).toEqual(["Ann"]);
    expect(answers).toBe(3);
  });

  it("searches for the first value right away", () => {
    const container = users(people(), { search: "ann", delay: 50 });
    expect(shown(container)).toEqual(["Ann"]);
    container.set({ search: state.ok_w("bob") });
    expect(shown(container)).toEqual(["Bob"]);
  });

  it("searches right away for enter, the clear button and escape in the bar", async () => {
    const container = users(people(), { search_bar: true, delay: 50 });
    type(container, "bob");
    expect(shown(container)).toEqual(["Ann", "Bob", "Dan"]);
    press(input(container), "Enter");
    expect(shown(container)).toEqual(["Bob"]);
    bar(container)!.querySelector<HTMLElement>(".clear")!.click();
    expect(shown(container)).toEqual(["Ann", "Bob", "Dan"]);
    type(container, "dan");
    press(input(container), "Escape");
    expect(shown(container)).toEqual(["Ann", "Bob", "Dan"]);
    //The text that waited is not searched after the escape
    await wait(100);
    expect(shown(container)).toEqual(["Ann", "Bob", "Dan"]);
  });

  it("searches right away for enter in the bar with a writable state", () => {
    const search = state.ok_w("");
    const container = users(people(), { search, search_bar: true, delay: 50 });
    type(container, "dan");
    expect(search.get().value).toBe("dan");
    expect(shown(container)).toEqual(["Ann", "Bob", "Dan"]);
    press(input(container), "Enter");
    expect(shown(container)).toEqual(["Dan"]);
  });
});
