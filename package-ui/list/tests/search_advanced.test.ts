import { ANIMATION_LEVEL, AnimationLevels, theme_init } from "#theme";
import { ok } from "@chocbite/ts-lib/result";
import { state, type State, type StateOrVal } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import list from "..";
import type { ListRow } from "../row";
import type { ListFilter } from "../search";

//Glyphs and backgrounds come from theme variables
theme_init();

afterEach(() => {
  //The dialog is a panel of the panel container, outside the body
  for (const panel of document.querySelectorAll("composition-panel"))
    (panel as HTMLElement & { close(): void }).close();
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
const ALL = ["Ann", "Bob", "Dan"];
const press = (element: Element, key: string) =>
  element.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );
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

//      _____ _____          _      ____   _____
//     |  __ \_   _|   /\   | |    / __ \ / ____|
//     | |  | || |    /  \  | |   | |  | | |  __
//     | |  | || |   / /\ \ | |   | |  | | | |_ |
//     | |__| || |_ / ____ \| |___| |__| | |__| |
//     |_____/_____/_/    \_\______\____/ \_____|

const dialog = () => document.querySelector<HTMLElement>("list-advancedsearch");
const conditions = () => [
  ...dialog()!.querySelectorAll<HTMLElement>("list-advancedcondition"),
];
type Dropdown = HTMLElement & { open: boolean };
/**The column dropdown, the operator dropdown and the value dropdown of a bool or enum */
const dropdowns = (row: HTMLElement) => [
  ...row.querySelectorAll<Dropdown>("form-dropdown, form-dropdownmulti"),
];
/**The text a dropdown shows */
const showing = (dropdown: HTMLElement) =>
  dropdown.firstElementChild!.textContent;
const popup_lines = () =>
  [
    ...document.querySelector("form-dropdownbox")!.firstElementChild!
      .firstElementChild!.firstElementChild!.children,
  ] as HTMLElement[];
/**The form elements write their states and call change a moment later */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
/**Picks a line in the popup of a dropdown, a multi dropdown stays open */
const pick = async (dropdown: Dropdown, ...texts: string[]) => {
  dropdown.open = true;
  for (const text of texts) {
    popup_lines()
      .find((line) => line.textContent === text)!
      .click();
    await settle();
  }
  dropdown.open = false;
};
const value_input = (row: HTMLElement) =>
  row.querySelector<HTMLInputElement>("form-textinput input")!;
const type_value = async (row: HTMLElement, text: string) => {
  const input = value_input(row);
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
};
const button = (text: string) =>
  [...dialog()!.querySelectorAll<HTMLElement>("form-button")].find(
    (b) => b.textContent === text,
  )!;
const remove = (row: HTMLElement) =>
  row.querySelector<HTMLElement>("form-button")!.click();

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

function people_list(
  rows: Person[] | State<Person[]>,
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
            note: p.note,
            status: p.status,
          },
        }),
      search_menu: true,
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
        //No type, the advanced search leaves it out
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
          field_apply: (field, status: Status) =>
            (field.text = STATUS[status].name),
        }),
      },
      rows,
      ...options,
    },
  );
  document.body.append(container);
  return container;
}

const open_from_menu = (container: HTMLElement) => {
  right_click(rows_of(container)[0].anchor!);
  choose("Advanced search");
};

describe("List advanced search", () => {
  it("opens from the menu with a row for each condition of the filter", () => {
    const filter = state.ok_w<ListFilter>({
      conditions: [
        { column: "age", type: "number", op: ">=", value: 30 },
        { column: "name", type: "string", op: "contains", value: "an" },
      ],
    });
    const container = people_list(people(), { filter });
    right_click(rows_of(container)[0].anchor!);
    expect(texts()).toContain("Advanced search…");
    choose("Advanced search");
    expect(dialog()).not.toBeNull();
    expect(conditions().length).toBe(2);
    const [age, name] = conditions();
    expect(dropdowns(age).map(showing)).toEqual(["Age", ">= at least"]);
    expect(value_input(age).value).toBe("30");
    expect(dropdowns(name).map(showing)).toEqual(["Name", "~ contains"]);
    expect(value_input(name).value).toBe("an");
  });

  it("applies the conditions it builds and closes", async () => {
    const filter = state.ok_w<ListFilter>({ conditions: [] });
    const container = people_list(people(), { filter });
    open_from_menu(container);
    button("Add condition").click();
    const [row] = conditions();
    await pick(dropdowns(row)[0], "Age");
    await pick(dropdowns(row)[1], "> more than");
    await type_value(row, "30,5");
    //Nothing filters before apply
    expect(shown(container)).toEqual(ALL);
    button("Apply").click();
    expect(filter.get().value).toEqual({
      conditions: [{ column: "age", type: "number", op: ">", value: 30.5 }],
    });
    expect(shown(container)).toEqual(["Ann", "Bob"]);
    expect(dialog()).toBeNull();
  });

  it("applies with enter in a value", async () => {
    const container = people_list(people());
    open_from_menu(container);
    button("Add condition").click();
    await type_value(conditions()[0], "bo");
    press(value_input(conditions()[0]), "Enter");
    expect(dialog()).toBeNull();
    expect(shown(container)).toEqual(["Bob"]);
  });

  it("offers the operators of the type of the column, yes or no for a bool and the choices of an enum", async () => {
    const filter = state.ok_w<ListFilter>({ conditions: [] });
    const container = people_list(people(), { filter });
    open_from_menu(container);
    button("Add condition").click();
    const [row] = conditions();
    dropdowns(row)[1].open = true;
    expect(popup_lines().map((line) => line.textContent)).toEqual([
      "~ contains",
      "!~ does not contain",
      "= is",
      "!= is not",
      "^ starts with",
      "$ ends with",
    ]);
    dropdowns(row)[1].open = false;
    await pick(dropdowns(row)[0], "Status");
    expect(showing(dropdowns(row)[1])).toBe("is one of");
    await pick(dropdowns(row)[2], "Running", "Stopped");
    button("Add condition").click();
    const bool = conditions()[1];
    await pick(dropdowns(bool)[0], "Active");
    expect(showing(dropdowns(bool)[1])).toBe("is");
    await pick(dropdowns(bool)[2], "No");
    button("Apply").click();
    expect(filter.get().value).toEqual({
      conditions: [
        { column: "status", type: "enum", op: "in", value: ["r", "s"] },
        { column: "active", type: "bool", value: false },
      ],
    });
    expect(shown(container)).toEqual([]);
  });

  it("has between and not between for numbers, with two values", async () => {
    const filter = state.ok_w<ListFilter>({
      conditions: [
        { column: "age", type: "number", op: "between", value: [30, 50] },
      ],
    });
    const container = people_list(people(), { filter });
    open_from_menu(container);
    const [row] = conditions();
    expect(dropdowns(row).map(showing)).toEqual(["Age", "between"]);
    const values = () => [
      ...row.querySelectorAll<HTMLInputElement>("form-textinput input"),
    ];
    expect(values().map((input) => input.value)).toEqual(["30", "50"]);
    dropdowns(row)[1].open = true;
    expect(popup_lines().map((line) => line.textContent)).toContain(
      "not between",
    );
    dropdowns(row)[1].open = false;
    await pick(dropdowns(row)[1], "not between");
    values()[1].value = "40";
    values()[1].dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    button("Apply").click();
    expect(filter.get().value).toEqual({
      conditions: [
        { column: "age", type: "number", op: "not_between", value: [30, 40] },
      ],
    });
    expect(shown(container)).toEqual(["Bob", "Dan"]);
  });

  it("only offers the columns that have a type", () => {
    const container = people_list(people());
    open_from_menu(container);
    button("Add condition").click();
    dropdowns(conditions()[0])[0].open = true;
    expect(popup_lines().map((line) => line.textContent)).toEqual([
      "Name",
      "Age",
      "Active",
      "Status",
    ]);
  });

  it("leaves out a condition without a value", () => {
    const filter = state.ok_w<ListFilter>({ conditions: [] });
    const container = people_list(people(), { filter });
    open_from_menu(container);
    button("Add condition").click();
    button("Apply").click();
    expect(filter.get().value).toEqual({ conditions: [] });
  });

  it("discards what it changed with cancel and escape", async () => {
    const filter = state.ok_w<ListFilter>({
      conditions: [{ column: "age", type: "number", op: ">=", value: 30 }],
    });
    const container = people_list(people(), { filter });
    open_from_menu(container);
    await type_value(conditions()[0], "40");
    button("Cancel").click();
    expect(dialog()).toBeNull();
    expect(filter.get().value.conditions[0]).toMatchObject({ value: 30 });
    open_from_menu(container);
    remove(conditions()[0]);
    press(dialog()!, "Escape");
    expect(dialog()).toBeNull();
    expect(filter.get().value.conditions.length).toBe(1);
  });

  it("removes a row and clears all", () => {
    const filter = state.ok_w<ListFilter>({
      conditions: [
        { column: "age", type: "number", op: ">=", value: 30 },
        { column: "name", type: "string", op: "contains", value: "an" },
      ],
    });
    const container = people_list(people(), { filter });
    open_from_menu(container);
    remove(conditions()[0]);
    expect(conditions().length).toBe(1);
    button("Apply").click();
    expect(filter.get().value).toEqual({
      conditions: [
        { column: "name", type: "string", op: "contains", value: "an" },
      ],
    });
    open_from_menu(container);
    button("Clear all").click();
    expect(conditions().length).toBe(0);
    button("Apply").click();
    expect(filter.get().value).toEqual({ conditions: [] });
  });

  it("shows conditions it can not edit as rows that keep them, which can be removed", () => {
    const filter = state.ok_w<ListFilter>({
      conditions: [
        { column: "gone", type: "string", op: "contains", value: "a" },
        { column: "note", type: "string", op: "contains", value: "x" },
        { column: "age", type: "number", op: ">=", value: 30 },
      ],
    });
    const container = people_list(people(), { filter });
    open_from_menu(container);
    const [gone, note, age] = conditions();
    //Shown as it is, without its fields
    expect(dropdowns(gone).some((dropdown) => dropdown.checkVisibility())).toBe(
      false,
    );
    expect(gone.textContent).toContain("gone ~a");
    expect(note.textContent).toContain("Note ~x");
    expect(dropdowns(age).map(showing)).toEqual(["Age", ">= at least"]);
    button("Apply").click();
    expect(filter.get().value).toEqual({
      conditions: [
        { column: "gone", type: "string", op: "contains", value: "a" },
        { column: "note", type: "string", op: "contains", value: "x" },
        { column: "age", type: "number", op: ">=", value: 30 },
      ],
    });
    open_from_menu(container);
    remove(conditions()[0]);
    button("Apply").click();
    expect(filter.get().value.conditions.length).toBe(2);
  });

  it("opens with a new condition of the column when & is typed in its cell, and gives the focus back", async () => {
    const filter = state.ok_w<ListFilter>({
      conditions: [{ column: "age", type: "number", op: ">=", value: 30 }],
    });
    const container = people_list(people(), { filter, column_search: true });
    const input = cell(container, 1).querySelector("input")!;
    input.focus();
    type_in(cell(container, 1), "&");
    expect(dialog()).not.toBeNull();
    //The cell shows its condition again
    expect(input.value).toBe(">=30");
    expect(conditions().length).toBe(2);
    expect(showing(dropdowns(conditions()[1])[0])).toBe("Age");
    button("Cancel").click();
    //When the content tells it closed, a moment later
    await settle();
    expect(document.activeElement).toBe(input);
  });

  it("opens with the conditions when the summary of a cell is pressed", () => {
    const filter = state.ok_w<ListFilter>({
      conditions: [
        { column: "age", type: "number", op: ">", value: 30 },
        { column: "age", type: "number", op: "<", value: 40 },
      ],
    });
    const container = people_list(people(), { filter, column_search: true });
    cell(container, 1).querySelector<HTMLElement>(".summary")!.click();
    expect(dialog()).not.toBeNull();
    expect(conditions().length).toBe(2);
  });

  it("does not open for a read only filter state", () => {
    const filter = state.ok<ListFilter>({
      conditions: [
        { column: "age", type: "number", op: ">", value: 30 },
        { column: "age", type: "number", op: "<", value: 40 },
      ],
    });
    const container = people_list(people(), {
      filter: filter.read_only,
      column_search: true,
    });
    right_click(rows_of(container)[0].anchor!);
    expect(texts()).not.toContain("Advanced search…");
    cell(container, 1).querySelector<HTMLElement>(".summary")!.click();
    expect(dialog()).toBeNull();
  });

  it("opens in a panel of the document of the list", () => {
    const container = people_list(people());
    (container as HTMLElement & { advanced_search(): void }).advanced_search();
    const panel = dialog()!.closest("composition-panel")!;
    expect(panel.ownerDocument).toBe(container.ownerDocument);
  });
});

//       _____ _____   ____  _    _ _____   _____
//      / ____|  __ \ / __ \| |  | |  __ \ / ____|
//     | |  __| |__) | |  | | |  | | |__) | (___
//     | | |_ |  _  /| |  | | |  | |  ___/ \___ \
//     | |__| | | \ \| |__| | |__| | |     ____) |
//      \_____|_|  \_\\____/ \____/|_|    |_____/

describe("List advanced search groups", () => {
  const groups = () => [
    ...dialog()!.querySelectorAll<HTMLElement>("list-advancedgroup"),
  ];
  /**The mode dropdown of a group, the first dropdown of its header */
  const mode = (group: HTMLElement) =>
    group.querySelector<Dropdown>(":scope > .header > form-dropdown")!;
  const group_button = (group: HTMLElement, text: string) =>
    [
      ...group.querySelectorAll<HTMLElement>(":scope > .header > form-button"),
    ].find((b) => b.textContent === text)!;
  /**The items of a group, in its array group, which a nested group has in a collapser */
  const items = (group: HTMLElement) => [
    ...group.querySelector(
      ":scope > form-grouparray, :scope > form-group-collapser > form-grouparray",
    )!.children,
  ];

  it("shows the groups of the filter with their mode, and applies them as they are", () => {
    const filter = state.ok_w<ListFilter>({
      mode: "any",
      conditions: [
        { column: "age", type: "number", op: ">", value: 40 },
        {
          type: "group",
          mode: "none",
          conditions: [
            { column: "status", type: "enum", op: "in", value: ["p"] },
          ],
        },
      ],
    });
    const container = people_list(people(), { filter });
    open_from_menu(container);
    const [root, nested] = groups();
    expect(showing(mode(root))).toBe("Any of these");
    expect(showing(mode(nested))).toBe("None of these");
    expect(items(root).length).toBe(2);
    expect(items(nested).length).toBe(1);
    button("Apply").click();
    expect(filter.get().value).toEqual({
      mode: "any",
      conditions: [
        { column: "age", type: "number", op: ">", value: 40 },
        {
          type: "group",
          mode: "none",
          conditions: [
            { column: "status", type: "enum", op: "in", value: ["p"] },
          ],
        },
      ],
    });
  });

  it("adds a group with a condition in it, and applies the mode given to it", async () => {
    const filter = state.ok_w<ListFilter>({ conditions: [] });
    const container = people_list(people(), { filter });
    open_from_menu(container);
    group_button(groups()[0], "Add group").click();
    const nested = groups()[1];
    expect(items(nested).length).toBe(1);
    await pick(mode(nested), "Any of these");
    group_button(nested, "Add condition").click();
    const [first, second] = conditions();
    await type_value(first, "ann");
    await pick(dropdowns(second)[0], "Age");
    await pick(dropdowns(second)[1], "> more than");
    await type_value(second, "40");
    button("Apply").click();
    expect(filter.get().value).toEqual({
      conditions: [
        {
          type: "group",
          mode: "any",
          conditions: [
            { column: "name", type: "string", op: "contains", value: "ann" },
            { column: "age", type: "number", op: ">", value: 40 },
          ],
        },
      ],
    });
    expect(shown(container)).toEqual(["Ann", "Bob"]);
  });

  it("removes a group with what is in it, and leaves out a group left empty", () => {
    const filter = state.ok_w<ListFilter>({
      conditions: [
        { column: "age", type: "number", op: ">", value: 40 },
        {
          type: "group",
          mode: "any",
          conditions: [
            { column: "name", type: "string", op: "contains", value: "a" },
          ],
        },
      ],
    });
    const container = people_list(people(), { filter });
    open_from_menu(container);
    group_button(groups()[1], "").click();
    expect(groups().length).toBe(1);
    group_button(groups()[0], "Add group").click();
    //The condition of the new group has no value, so the group is empty
    button("Apply").click();
    expect(filter.get().value).toEqual({
      conditions: [{ column: "age", type: "number", op: ">", value: 40 }],
    });
  });

  it("spaces its items and its header like form elements", () => {
    const container = people_list(people(), {
      filter: {
        conditions: [
          { column: "age", type: "number", op: ">", value: 40 },
          {
            type: "group",
            mode: "any",
            conditions: [
              { column: "name", type: "string", op: "contains", value: "a" },
            ],
          },
          { column: "name", type: "string", op: "contains", value: "b" },
        ],
      },
    });
    open_from_menu(container);
    const root = groups()[0];
    const header = root.querySelector(":scope > .header")!;
    const [first, ...rest] = [header, ...items(root)].map((item) =>
      item.getBoundingClientRect(),
    );
    let above = first;
    for (const rect of rest) {
      expect(rect.top - above.bottom).toBeGreaterThan(4);
      above = rect;
    }
  });

  it("collapses a group with a form collapser, showing a summary of what is in it on its button", async () => {
    await ANIMATION_LEVEL.write(AnimationLevels.None);
    const container = people_list(people(), {
      filter: {
        conditions: [
          {
            type: "group",
            mode: "any",
            conditions: [
              { column: "age", type: "number", op: ">", value: 40 },
              { column: "status", type: "enum", op: "in", value: ["p", "s"] },
            ],
          },
        ],
      },
    });
    open_from_menu(container);
    const nested = groups()[1];
    const collapser = nested.querySelector<HTMLElement>(
      ":scope > form-group-collapser",
    )!;
    const button = collapser.querySelector<HTMLElement>(":scope > span")!;
    const array = collapser.querySelector<HTMLElement>(
      ":scope > form-grouparray",
    )!;
    expect(array.checkVisibility()).toBe(true);
    expect(button.textContent).toBe("Collapse");
    button.click();
    expect(array.checkVisibility()).toBe(false);
    expect(button.textContent).toBe("Age >40, Status Pending or Stopped");
    button.click();
    expect(array.checkVisibility()).toBe(true);
    expect(button.textContent).toBe("Collapse");
  });

  it("keeps a condition on one line when collapsing a group makes the dialog narrower", async () => {
    //The dialog is as wide as its content, wide enough for the rows when it fits on the page
    const [width, height] = [window.innerWidth, window.innerHeight];
    await page.viewport(1000, 800);
    try {
      await ANIMATION_LEVEL.write(AnimationLevels.None);
      const container = people_list(people(), {
        filter: {
          conditions: [
            { column: "active", type: "bool", value: true },
            {
              type: "group",
              mode: "any",
              conditions: [
                { column: "age", type: "number", op: "<", value: 30 },
                {
                  type: "group",
                  mode: "none",
                  conditions: [
                    { column: "status", type: "enum", op: "in", value: ["r"] },
                  ],
                },
              ],
            },
          ],
        },
      });
      open_from_menu(container);
      const fields = items(groups()[0])[0].querySelector(":scope > .fields")!;
      const one_line = () =>
        new Set(
          [...fields.children].map(
            (field) => field.getBoundingClientRect().top,
          ),
        ).size === 1;
      expect(one_line()).toBe(true);
      groups()[1]
        .querySelector<HTMLElement>(":scope > form-group-collapser > span")!
        .click();
      expect(one_line()).toBe(true);
    } finally {
      await page.viewport(width, height);
    }
  });

  it("names an empty group on the button when it is collapsed", async () => {
    await ANIMATION_LEVEL.write(AnimationLevels.None);
    const container = people_list(people(), {
      filter: {
        conditions: [{ type: "group", mode: "any", conditions: [] }],
      },
    });
    open_from_menu(container);
    const nested = groups()[1];
    const button = nested.querySelector<HTMLElement>(
      ":scope > form-group-collapser > span",
    )!;
    button.click();
    expect(button.textContent).toBe("Nothing in the group");
  });

  it("keeps a long summary on one line, the dialog does not widen for it", async () => {
    await ANIMATION_LEVEL.write(AnimationLevels.None);
    const long = "a long name to search for ".repeat(12);
    const container = people_list(people(), {
      filter: {
        conditions: [
          {
            type: "group",
            mode: "any",
            conditions: [
              { column: "name", type: "string", op: "contains", value: long },
            ],
          },
        ],
      },
    });
    open_from_menu(container);
    const dialog_width = dialog()!.getBoundingClientRect().width;
    const nested = groups()[1];
    const button = nested.querySelector<HTMLElement>(
      ":scope > form-group-collapser > span",
    )!;
    const height = button.getBoundingClientRect().height;
    button.click();
    expect(button.textContent).toContain(long.trim());
    expect(button.getBoundingClientRect().height).toBe(height);
    expect(dialog()!.getBoundingClientRect().width).toBeLessThanOrEqual(
      dialog_width,
    );
  });

  it("has no collapse or remove for the root, it is the whole filter", () => {
    const container = people_list(people());
    open_from_menu(container);
    const root = groups()[0];
    expect(root.querySelector(":scope > form-group-collapser")).toBeNull();
    expect(group_button(root, "")).toBeUndefined();
  });
});
