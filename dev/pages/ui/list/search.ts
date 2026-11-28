import form from "@chocbite/ts-lib-ui/form";
import list, {
  type ListFilter,
  type ListSearchQuery,
  type ListSearchResult,
} from "@chocbite/ts-lib-ui/list";
import { array_from_length } from "@chocbite/ts-lib/common";
import { ok } from "@chocbite/ts-lib/result";
import state, { type StateOrVal } from "@chocbite/ts-lib/state";
import { box, code, controls, row, section } from "../../../helpers";
//The page shows its own code under each section
import source from "./search.ts?raw";

//#region people_list
const NAMES = ["Ann", "Bob", "Dan", "Eve", "Ida", "Kim", "Lea", "Max", "Nora"];
const CITIES = ["Oslo", "Rome", "Kyiv", "Bern", "Lima", "Riga"];
const TAGS = ["red", "blue", "green"];
/**An enum, values with a name each, like an enum of the state module */
const STATUS = {
  running: { name: "Running" },
  paused: { name: "Paused" },
  stopped: { name: "Stopped" },
};
type Status = keyof typeof STATUS;
const STATUSES = Object.keys(STATUS) as Status[];

interface Person {
  id: number;
  name: string;
  age: number;
  city: { name: string };
  tag: { text: string };
  active: boolean;
  status: Status;
}
const person = (i: number): Person => ({
  id: i,
  name: `${NAMES[i % NAMES.length]} ${i + 1}`,
  age: 20 + ((i * 7) % 50),
  city: { name: CITIES[(i * 5) % CITIES.length] },
  tag: { text: TAGS[i % TAGS.length] },
  active: i % 4 !== 0,
  status: STATUSES[(i * 2) % STATUSES.length],
});

function people_list(
  amount: number,
  options: {
    search?: StateOrVal<string>;
    search_bar?: boolean;
    filter?: StateOrVal<ListFilter>;
    column_search?: StateOrVal<boolean>;
  } = {},
  multi = false,
  config: { search_menu?: boolean; headless?: boolean } = {},
) {
  return list.container(
    {
      transform: (p: Person) =>
        ok({
          values: {
            name: p.name,
            age: p.age,
            city: p.city,
            active: p.active,
            status: p.status,
            tag: p.tag,
          },
        }),
      selection: multi
        ? { mode: "multi", key: (p: Person) => p.id }
        : undefined,
      ...config,
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
        city: list.column({
          title: "City",
          type: "string",
          field_gen: () => list.text_field(),
          field_apply: (field, city: { name: string }) =>
            (field.text = city.name),
          search_value: (city) => city.name,
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
        tag: list.column({
          title: "Tag, not searched",
          field_gen: () => list.text_field(),
          field_apply: (field, tag: { text: string }) =>
            (field.text = tag.text),
        }),
      },
      rows: array_from_length(amount, person),
      ...options,
    },
  );
}
//#endregion

//      ______ _      _______
//     |  ____| |    |__   __|
//     | |__  | |       | |
//     |  __| | |       | |
//     | |    | |____   | |
//     |_|    |______|  |_|
{
  const sec = section(
    "Flat list",
    "Type in the bar or the text input beside it, they share one state. The search waits until typing pauses for 200 ms, enter searches right away. The cells that have the text get a see through yellow over their background, check it on odd, even, hovered and selected rows. The search ignores case and matches numbers as text, so 4 finds the ages with a 4. The city column is searched through search_value, the tag column holds objects without one, so red finds nothing. The clear button and escape empty the bar. Scroll the list: the bar stays on top and the header sticks below it, the rows keep alternating their backgrounds over the hidden ones. Select some rows, search, then select all with the checkbox in the header: only the rows shown are selected, rows selected before and hidden stay selected and show again when the search is cleared",
  );
  //#region flat_list
  const search = state.ok_w("");
  const r = row(sec);
  box(r, "search bar, multi selection", {
    width: "30rem",
    height: "16rem",
    display: "grid",
  }).appendChild(people_list(40, { search, search_bar: true }, true));
  box(r, "the same state in a text input", { width: "14rem" }).appendChild(
    form.text_input({ value: search, placeholder: "Search" }),
  );
  controls(sec, {
    "Search oslo from app": () => void search.write("oslo"),
    "Search zzz, nothing matches": () => void search.write("zzz"),
    Clear: () => void search.write(""),
  });
  //#endregion
  code(sec, source, "flat_list", "people_list");
}

{
  const sec = section(
    "Read only search",
    "The search is a read only state, the bar is locked and has no clear button, only the buttons change the search",
  );
  //#region read_only_search
  const search = state.ok("an");
  box(sec, "read only state", {
    width: "30rem",
    height: "12rem",
    display: "grid",
  }).appendChild(
    people_list(20, { search: search.read_only, search_bar: true }),
  );
  controls(sec, {
    "Search an": () => search.set_ok("an"),
    "Search lima": () => search.set_ok("lima"),
    Clear: () => search.set_ok(""),
  });
  //#endregion
  code(sec, source, "read_only_search", "people_list");
}

//       _____ ____  _     _    _ __  __ _   _
//      / ____/ __ \| |   | |  | |  \/  | \ | |
//     | |   | |  | | |   | |  | | \  / |  \| |
//     | |   | |  | | |   | |  | | |\/| | . ` |
//     | |___| |__| | |___| |__| | |  | | |\  |
//      \_____\____/|______\____/|_|  |_|_| \_|
{
  const sec = section(
    "Column search",
    "Right click anywhere on the list, the search bar, the cells and their inputs included, for search columns, it shows a cell under the title of every column with a type. Name, age and city start with ~, a similar value, click in one: the caret is after the ~. Backspace it and type = != ^ $ !~ for text, or = != > < >= <= for age, ≥ ≤ ≠ from the symbol page work too, try >=40, =34, 30..40 for between and !=30..40 for not between. =4x on age is shown in red and does not filter. Active cycles any, yes and no with a press. The tag column has no type and no cell, the status column is an enum, a press on its cell folds down the choices to pick from, they stay until a press outside, escape or a press on the cell, clear all leaves them all out, and the search bar finds the names of the statuses. Its app button picks two. The cells combine with each other and the search bar, only the text of the bar is highlighted. Typing waits for the delay, enter searches right away, escape and the cross clear a cell. The app button gives age a range the cell can not edit, it shows it as a summary after &, the sign of the advanced filter, with a cross that clears it. Hide column search in the menu clears the filter. Check the header in touch mode, the checkbox stays at the height of the titles. The headless list shows only the cells, toggled by the button under it",
  );
  //#region column_search
  const filter = state.ok_w<ListFilter>({ conditions: [] });
  const column_search = state.ok_w(false);
  const r = row(sec);
  const b = box(r, "search_menu, search bar, multi selection", {
    width: "40rem",
    height: "16rem",
    display: "grid",
  });
  b.appendChild(
    people_list(40, { search_bar: true, filter, column_search }, true, {
      search_menu: true,
    }),
  );
  const shown = b.appendChild(document.createElement("pre"));
  shown.style.whiteSpace = "pre-wrap";
  filter.sub(
    (value) => (shown.textContent = JSON.stringify(value.value)),
    true,
  );
  controls(sec, {
    "Column search": () => void column_search.write(!column_search.get().value),
    "Status running or paused from app": () =>
      void filter.write({
        conditions: [
          {
            column: "status",
            type: "enum",
            op: "in",
            value: ["running", "paused"],
          },
        ],
      }),
    "Age 30 to 50 from app": () =>
      void filter.write({
        conditions: [
          { column: "age", type: "number", op: ">=", value: 30 },
          { column: "age", type: "number", op: "<=", value: 50 },
        ],
      }),
    "Clear filter": () => void filter.write({ conditions: [] }),
  });
  const headless_search = state.ok_w(true);
  const h = box(r, "headless", {
    width: "34rem",
    height: "12rem",
    display: "grid",
  });
  h.appendChild(
    people_list(20, { column_search: headless_search }, false, {
      search_menu: true,
      headless: true,
    }),
  );
  controls(h, {
    "Column search": () =>
      void headless_search.write(!headless_search.get().value),
  });
  interface File {
    name: string;
    size?: number;
    sub?: File[];
  }
  const files: File[] = [
    {
      name: "Documents",
      sub: [
        { name: "report.pdf", size: 120 },
        { name: "notes.md", size: 4 },
      ],
    },
    {
      name: "Pictures",
      sub: [
        { name: "beach.png", size: 2048 },
        { name: "cat.png", size: 512 },
      ],
    },
    { name: "readme.md", size: 2 },
  ];
  //The answer gives the values the conditions check, a folder has no size, so only what is below it can meet a size
  const found_below = (file: File, query: ListSearchQuery): boolean =>
    (file.sub ?? []).some(
      (sub) =>
        query.match({ size: sub.size }, sub.name) || found_below(sub, query),
    );
  box(r, "sub rows, type 512 in size", { width: "20rem" }).appendChild(
    list.container(
      {
        transform: (file: File) =>
          ok({
            openable: Boolean(file.sub),
            key_field: { text: file.name },
            sub_rows: () => file.sub ?? [],
            search: (query) =>
              query.match({ size: file.size }, file.name) ??
              (found_below(file, query) ? "below" : "none"),
            values: { size: file.size },
          }),
        sub_rows: true,
        search_menu: true,
      },
      {
        columns: {
          size: list.column({
            title: "Size",
            type: "number",
            field_gen: () => list.text_field(),
            field_apply: (field, size: number | undefined) =>
              (field.text = size === undefined ? "" : String(size)),
          }),
        },
        rows: files,
        column_search: true,
      },
    ),
  );
  //#endregion
  code(sec, source, "column_search", "people_list");
}

{
  const sec = section(
    "Advanced search",
    "The dialog for conditions a cell can not make, like age between 30 and 50. Open it from the menu of a row, from the buttons of the app, or type & in a cell of the column search, which starts a new condition of that column. A row per condition: the column, the operator in words, the value and a button that removes it, between and not between for age give two values, the value is a text input for text and age, yes or no for active and the statuses to pick several of for status. Groups: the header of a group has its mode, all, any or none of these, Add condition, Add group and remove, nested groups are indented with a line on their left, the Collapse button of form under a nested group hides what is in it, with the animation, and the button then shows a line of what is in it, cut off with … when it is too long. The conditions and groups are spaced like the elements of form. The groups button of the app gives active and (younger than 30 or none of running), the active and status cells show it as summaries ending in …, typing in the name cell adds its condition under all of it. Nothing changes until Apply or enter in a value, Cancel and escape leave the filter as it was. Size the panel from its edges, taller the buttons stay at the bottom, lower only the conditions scroll. The focus goes back to where it was. Check it in touch mode",
  );
  //#region advanced_search
  const filter = state.ok_w<ListFilter>({
    conditions: [
      { column: "age", type: "number", op: ">=", value: 30 },
      { column: "age", type: "number", op: "<=", value: 50 },
    ],
  });
  const b = box(sec, "search_menu, the column search shows the range as &", {
    width: "40rem",
    height: "14rem",
    display: "grid",
  });
  const container = people_list(40, { filter, column_search: true }, false, {
    search_menu: true,
  });
  b.appendChild(container);
  const shown = b.appendChild(document.createElement("pre"));
  shown.style.whiteSpace = "pre-wrap";
  filter.sub(
    (value) => (shown.textContent = JSON.stringify(value.value)),
    true,
  );
  controls(sec, {
    "Advanced search": () => container.advanced_search(),
    "Advanced search, new status condition": () =>
      container.advanced_search("status"),
    "Filter with groups from app": () =>
      void filter.write({
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
                  {
                    column: "status",
                    type: "enum",
                    op: "in",
                    value: ["running"],
                  },
                ],
              },
            ],
          },
        ],
      }),
  });
  //#endregion
  code(sec, source, "advanced_search", "people_list");
}

//      _______ _____  ______ ______
//     |__   __|  __ \|  ____|  ____|
//        | |  | |__) | |__  | |__
//        | |  |  _  /|  __| |  __|
//        | |  | | \ \| |____| |____
//        |_|  |_|  \_\______|______|

//#region folder_list
interface Folder {
  name: string;
  sub?: Folder[];
}
const folder = (name: string, sub?: Folder[]): Folder => ({ name, sub });
const folders = (): Folder[] => [
  folder("Documents", [
    folder("Work", [
      folder("report.pdf"),
      folder("budget.xlsx"),
      folder("Old", [folder("2019.txt"), folder("2020.txt")]),
    ]),
    folder("notes.md"),
    folder("todo.md"),
  ]),
  folder("Pictures", [
    folder("Holiday", [folder("beach.png"), folder("hotel.png")]),
    folder("cat.png"),
  ]),
  folder("Music", [
    folder("song.mp3"),
    folder("Live", [folder("concert.mp3")]),
  ]),
  folder("readme.md"),
];
/**Whether something below the folder matches, answered from the data, so nothing has to be opened to know */
const found_below = (item: Folder, query: ListSearchQuery): boolean =>
  (item.sub ?? []).some(
    (sub) => query.match({}, sub.name) || found_below(sub, query),
  );

function folder_list(
  rows: Folder[],
  options: { search?: StateOrVal<string> } = {},
  search?: (item: Folder, query: ListSearchQuery) => ListSearchResult,
) {
  return list.container(
    {
      transform: (item: Folder) =>
        ok({
          openable: Boolean(item.sub),
          key_field: { text: item.name },
          sub_rows: () => item.sub ?? [],
          search: search ? (query) => search(item, query) : undefined,
          values: {},
        }),
      sub_rows: true,
    },
    { columns: {}, rows, search_bar: true, ...options },
  );
}
//#endregion

{
  const sec = section(
    "Sub rows",
    "Search 2019 or png in the left list: the rows with a match below open and show only what matches, the key field text of the rows that match is highlighted, the folders opened for what is below them are not, search work, the folder matches itself, so it is shown closed and opens with everything in it. Open a folder before searching, it stays open after the search is cleared, while the folders the search opened close again. Close a folder the search opened, it stays closed until the text changes. The right list has no search answer, it matches the rows by their key field text and never opens one, so it only finds what is open",
  );
  //#region sub_rows
  const r = row(sec);
  box(r, "search answer from the data", { width: "16rem" }).appendChild(
    folder_list(
      folders(),
      {},
      (item, query) =>
        query.match({}, item.name) ??
        (found_below(item, query) ? "below" : "none"),
    ),
  );
  box(r, "no search answer", { width: "16rem" }).appendChild(
    folder_list(folders()),
  );
  //#endregion
  code(sec, source, "sub_rows", "folder_list");
}

//      __  __          _   ___     __
//     |  \/  |   /\   | \ | \ \   / /
//     | \  / |  /  \  |  \| |\ \_/ /
//     | |\/| | / /\ \ | . ` | \   /
//     | |  | |/ ____ \| |\  |  | |
//     |_|  |_/_/    \_\_| \_|  |_|
{
  const sec = section(
    "Many rows",
    "5000 rows to feel how fast typing filters, the search waits until typing pauses. The endless tree has a search answer that always finds something below, the search opens it level by level and stops after 1000 rows with a warning at the bar",
  );
  //#region many_rows
  const r = row(sec);
  controls(sec, {
    "5000 rows": () =>
      box(r, "5000 rows", {
        width: "30rem",
        height: "20rem",
        display: "grid",
      }).appendChild(people_list(5000, { search_bar: true })),
    "Endless tree": () => {
      const endless = (name: string): Folder => ({
        name,
        get sub() {
          return [endless(name + ".1"), endless(name + ".2")];
        },
      });
      box(r, "endless tree", {
        width: "18rem",
        height: "20rem",
        display: "grid",
      }).appendChild(
        folder_list([endless("x")], { search: "x" }, () => "below"),
      );
    },
  });
  //#endregion
  code(sec, source, "many_rows", "people_list", "folder_list");
}
