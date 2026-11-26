import { theme_init } from "#theme";
import { ok } from "@chocbite/ts-lib/result";
import { state, type StateOrVal } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
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
const header_cells = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>("list-headerfield"),
];
const cell = (container: HTMLElement, index: number) =>
  header_cells(container)[index].querySelector<HTMLElement>(
    ":scope > [class~=list-search-cell]",
  )!;
const type_in = (element: HTMLElement, text: string) => {
  const input = element.querySelector("input")!;
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

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
  status: Status;
}
const people = (): Person[] => [
  { name: "Ann", age: 31, active: true, status: "r" },
  { name: "Bob", age: 45, active: false, status: "p" },
  { name: "Dan", age: 28, active: true, status: "s" },
];

function people_list(
  options: {
    filter?: StateOrVal<ListFilter>;
    column_search?: StateOrVal<boolean>;
  } = {},
) {
  const container = list.container(
    {
      transform: (p: Person) =>
        ok({
          values: {
            name: p.name,
            age: p.age,
            active: p.active,
            status: p.status,
          },
        }),
      search_delay: 0,
    },
    {
      columns: {
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
        status: list.column({
          title: "Status",
          type: "enum",
          choices: STATUS,
          field_gen: () => list.text_field(),
          field_apply: (field, status: Status) =>
            (field.text = STATUS[status].name),
        }),
      },
      rows: people(),
      ...options,
    },
  );
  document.body.append(container);
  return container;
}

const older = (than: number): ListCondition => ({
  column: "age",
  type: "number",
  op: ">",
  value: than,
});
const named = (text: string): ListCondition => ({
  column: "name",
  type: "string",
  op: "contains",
  value: text,
});
const status_is = (...value: Status[]): ListCondition => ({
  column: "status",
  type: "enum",
  op: "in",
  value,
});

describe("List search groups", () => {
  it("matches all, any or none of the conditions of a group, all without a mode", () => {
    const match = (filter: ListFilter, values: object) =>
      list_search_query("", filter)!.match(values) !== undefined;
    const bob = { name: "Bob", age: 45 };
    const conditions = [older(40), named("ann")];
    expect(match({ conditions }, bob)).toBe(false);
    expect(match({ mode: "all", conditions }, bob)).toBe(false);
    expect(match({ mode: "any", conditions }, bob)).toBe(true);
    expect(match({ mode: "none", conditions }, bob)).toBe(false);
    expect(match({ mode: "none", conditions }, { name: "Dan", age: 28 })).toBe(
      true,
    );
  });

  it("matches groups in groups, and leaves out an empty group", () => {
    const filter: ListFilter = {
      conditions: [
        older(30),
        {
          type: "group",
          mode: "any",
          conditions: [
            named("bob"),
            { type: "group", mode: "none", conditions: [older(40)] },
          ],
        },
        { type: "group", mode: "any", conditions: [] },
      ],
    };
    const query = list_search_query("", filter)!;
    expect(query.match({ name: "Bob", age: 45 })).toBeDefined();
    expect(query.match({ name: "Ann", age: 35 })).toBeDefined();
    expect(query.match({ name: "Eve", age: 41 })).toBeUndefined();
    //The empty group is left out
    expect(query.filter).toEqual({ conditions: filter.conditions.slice(0, 2) });
    //Only empty groups, no search
    expect(
      list_search_query("", {
        conditions: [{ type: "group", mode: "any", conditions: [] }],
      }),
    ).toBeUndefined();
  });

  it("filters the rows of a list by a tree of conditions", () => {
    const filter = state.ok_w<ListFilter>({ mode: "any", conditions: [] });
    const container = people_list({ filter });
    void filter.write({ mode: "any", conditions: [older(40), named("dan")] });
    expect(shown(container)).toEqual(["Bob", "Dan"]);
    void filter.write({
      conditions: [
        { column: "active", type: "bool", value: true },
        {
          type: "group",
          mode: "any",
          conditions: [older(30), status_is("s")],
        },
      ],
    });
    expect(shown(container)).toEqual(["Ann", "Dan"]);
    void filter.write({
      conditions: [
        { type: "group", mode: "none", conditions: [status_is("p")] },
      ],
    });
    expect(shown(container)).toEqual(["Ann", "Dan"]);
  });

  it("leaves out conditions of columns the list does not have, also in groups, and a group left empty", () => {
    const container = people_list({
      filter: {
        mode: "any",
        conditions: [
          older(40),
          {
            type: "group",
            mode: "all",
            conditions: [
              { column: "gone", type: "string", op: "contains", value: "x" },
            ],
          },
        ],
      },
    });
    //Without the empty group any is only older than 40
    expect(shown(container)).toEqual(["Bob"]);
  });
});

describe("List search groups and the cells", () => {
  it("edits the column in a cell while all of the root holds it and no group has it", () => {
    const filter = state.ok_w<ListFilter>({
      conditions: [
        older(30),
        { type: "group", mode: "any", conditions: [status_is("r")] },
      ],
    });
    const container = people_list({ filter, column_search: true });
    expect(cell(container, 1).querySelector("input")!.value).toBe(">30");
    type_in(cell(container, 1), ">40");
    //The groups and the mode stay
    expect(filter.get().value).toEqual({
      conditions: [
        { type: "group", mode: "any", conditions: [status_is("r")] },
        older(40),
      ],
    });
  });

  it("shows a column a group has as a summary with …", () => {
    const container = people_list({
      filter: {
        conditions: [
          older(30),
          {
            type: "group",
            mode: "any",
            conditions: [older(40), status_is("r")],
          },
        ],
      },
      column_search: true,
    });
    const age = cell(container, 1);
    expect(age.classList.contains("summary-shown")).toBe(true);
    expect(age.querySelector(".summary")!.textContent).toBe("& >30 …");
    const status = cell(container, 3);
    expect(status.querySelector(".summary")!.textContent).toBe("& …");
    //A column no condition is on can still be edited
    expect(cell(container, 0).classList.contains("summary-shown")).toBe(false);
  });

  it("shows the columns of a root of any or none as summaries", () => {
    const container = people_list({
      filter: { mode: "any", conditions: [older(40), named("dan")] },
      column_search: true,
    });
    expect(cell(container, 0).querySelector(".summary")!.textContent).toBe(
      "& ~dan …",
    );
    expect(cell(container, 1).querySelector(".summary")!.textContent).toBe(
      "& >40 …",
    );
  });

  it("keeps the mode of the root when a cell clears its column", () => {
    const filter = state.ok_w<ListFilter>({
      mode: "all",
      conditions: [older(30)],
    });
    const container = people_list({ filter, column_search: true });
    cell(container, 1).querySelector<HTMLElement>(".clear")!.click();
    expect(filter.get().value).toEqual({ mode: "all", conditions: [] });
  });
});
