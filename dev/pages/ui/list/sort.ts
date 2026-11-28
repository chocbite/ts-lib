import list, { type ListSort } from "@chocbite/ts-lib-ui/list";
import { array_from_length } from "@chocbite/ts-lib/common";
import { ok, some } from "@chocbite/ts-lib/result";
import state, { type State, type StateOrVal } from "@chocbite/ts-lib/state";
import { box, code, controls, row, section } from "../../../helpers";
//The page shows its own code under each section
import source from "./sort.ts?raw";

//#region people_list
const NAMES = ["Ann", "bob", "Dan", "eve", "Ida", "Kim", "lea", "Max", "Nora"];
const CITIES = ["Oslo", "Rome", "Kyiv", "Bern", "Lima", "Riga"];
/**An enum, values with a name each, sorted by the names */
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
  age?: number;
  city: { name: string };
  active: boolean;
  status: Status;
  tag: string;
}
const person = (i: number): Person => ({
  id: i,
  //Numbers in the names sort by number, Ann 2 before Ann 10, and case does not decide
  name: `${NAMES[i % NAMES.length]} ${Math.floor(i / 3) + 1}`,
  //Some rows have no age, they come first A to Z and last Z to A
  age: i % 7 === 3 ? undefined : 20 + ((i * 7) % 50),
  city: { name: CITIES[(i * 5) % CITIES.length] },
  active: i % 4 !== 0,
  status: STATUSES[(i * 2) % STATUSES.length],
  tag: ["red", "blue", "green"][i % 3],
});

const person_columns = () => ({
  name: list.column_string("Name"),
  age: list.column({
    title: "Age",
    type: "number",
    align: "right",
    field_gen: () => list.text_field(),
    field_apply: (field, age: number | undefined) =>
      (field.text = age === undefined ? "" : String(age)),
  }),
  city: list.column({
    title: "City",
    type: "string",
    field_gen: () => list.text_field(),
    field_apply: (field, city: { name: string }) => (field.text = city.name),
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
    field_apply: (field, status: Status) => (field.text = STATUS[status].name),
  }),
  tag: list.column({
    title: "Tag, not sortable",
    field_gen: () => list.text_field(),
    field_apply: (field, tag: string) => (field.text = tag),
  }),
});

function people_list(
  rows: StateOrVal<Person[]>,
  options: { sort?: StateOrVal<ListSort> } = {},
  config: { reorder?: boolean; multi?: boolean } = {},
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
      reorder: config.reorder ? {} : undefined,
      selection: config.multi
        ? { mode: "multi", key: (p: Person) => p.id }
        : undefined,
    },
    { columns: person_columns(), rows, ...options },
  );
}
//#endregion

/**Shows the value of the sort state under the list */
function show_sort(parent: HTMLElement, sort: State<ListSort>) {
  const pre = parent.appendChild(document.createElement("pre"));
  pre.style.whiteSpace = "pre-wrap";
  sort.sub(
    (value) =>
      (pre.textContent = value.ok
        ? JSON.stringify(value.value)
        : value.error.nice),
    true,
  );
}

//      _______ _____ _______ _      ______  _____
//     |__   __|_   _|__   __| |    |  ____|/ ____|
//        | |    | |    | |  | |    | |__  | (___
//        | |    | |    | |  | |    |  __|  \___ \
//        | |   _| |_   | |  | |____| |____ ____) |
//        |_|  |_____|  |_|  |______|______|_____/
{
  const sec = section(
    "Sort by the titles",
    "Click a title: the rows sort A to Z by it, a click again turns it Z to A, a third click shows the order of the data again. The icon after the title shows the direction, digits for age, letters for the rest. Shift click another title to sort by it where the first finds rows equal, the titles then show their place, 1 and 2. A click without shift sorts by that column alone again. Hover a title of a sortable column for the pointer and the hover color, the tag column has no type and does not sort. Drag the resize handle and let go over the title, it must not sort, a double click on the handle still fits the column. Right click a title for Sort A to Z, Sort Z to A, Then sort once another column sorts, and Clear sort, with the icons. The names have numbers, Ann 2 comes before Ann 10, and lower case names sort among the others. Some ages are empty, first in 1 to 9 and last in 9 to 1. Status sorts by the names of its choices, Paused, Running, Stopped. The rows keep alternating their backgrounds in the order shown",
  );
  //#region titles
  const sort = state.ok_w<ListSort>([]);
  const r = row(sec);
  const b = box(r, "multi selection, writable sort state", {
    width: "44rem",
    height: "18rem",
    display: "grid",
  });
  b.appendChild(
    people_list(array_from_length(40, person), { sort }, { multi: true }),
  );
  show_sort(sec, sort);
  controls(sec, {
    "City then age Z to A from app": () =>
      void sort.write([
        { column: "city", direction: "asc" },
        { column: "age", direction: "desc" },
      ]),
    "Unknown and tag columns, left out": () =>
      void sort.write([
        { column: "nope", direction: "asc" },
        { column: "tag", direction: "asc" },
      ]),
    Clear: () => void sort.write([]),
  });
  //#endregion
  code(sec, source, "titles", "people_list");
}

{
  const sec = section(
    "Read only sort",
    "The sort is a read only state, a click on a title does nothing, the titles have no pointer or hover color and their menus have no sort lines. Only the buttons change the sort, the icons follow",
  );
  //#region read_only
  const sort = state.ok<ListSort>([{ column: "age", direction: "asc" }]);
  box(sec, "read only state", {
    width: "44rem",
    height: "12rem",
    display: "grid",
  }).appendChild(
    people_list(array_from_length(20, person), { sort: sort.read_only }),
  );
  controls(sec, {
    "Age 1 to 9": () => sort.set_ok([{ column: "age", direction: "asc" }]),
    "Name Z to A": () => sort.set_ok([{ column: "name", direction: "desc" }]),
    "No sort": () => sort.set_ok([]),
  });
  //#endregion
  code(sec, source, "read_only", "people_list");
}

//      _____  ______ _____  ______ ____  _____  _____  ______ _____
//     |  __ \|  ____/ ____|  ____/ __ \|  __ \|  __ \|  ____|  __ \
//     | |__) | |__ | |    | |__ | |  | | |__) | |  | | |__  | |__) |
//     |  _  /|  __|| |    |  __|| |  | |  _  /| |  | |  __| |  _  /
//     | | \ \| |___| |____| |___| |__| | | \ \| |__| | |____| | \ \
//     |_|  \_\______\_____|______\____/|_|  \_\_____/|______|_|  \_\
{
  const sec = section(
    "Changing rows",
    "The rows are an array state, sorted by age. The buttons add, remove and change rows, a changed age moves its row to its place, the other rows stay where they are. The list has reorder: while it sorts the handles are dimmed, dragging them and alt with the arrow keys moves nothing. Clear the sort and they drag again, the rows are back in the order of the data",
  );
  //#region changing_rows
  let next = 20;
  const rows = state.ok_w<Person[]>(array_from_length(next, person));
  const sort = state.ok_w<ListSort>([{ column: "age", direction: "asc" }]);
  box(sec, "array state, reorder", {
    width: "44rem",
    height: "16rem",
    display: "grid",
  }).appendChild(people_list(rows, { sort }, { reorder: true }));
  show_sort(sec, sort);
  let step = 0;
  controls(sec, {
    "Add a row": () => rows.array.push(person(next++)),
    "Remove the first row of the data": () => rows.array.splice(0, 1),
    "Change the age of the first row of the data": () => {
      const first = rows.ok()[0];
      if (first)
        rows.array.change(0, { ...first, age: 20 + ((step++ * 13) % 50) });
    },
    "Sort by age": () => void sort.write([{ column: "age", direction: "asc" }]),
    "Clear sort": () => void sort.write([]),
  });
  //#endregion
  code(sec, source, "changing_rows", "people_list");
}

//      _______ _____  ______ ______
//     |__   __|  __ \|  ____|  ____|
//        | |  | |__) | |__  | |__
//        | |  |  _  /|  __| |  __|
//        | |  | | \ \| |____| |____
//        |_|  |_|  \_\______|______|

//#region entries
interface Entry {
  id: number;
  name: string;
  size?: number;
  children?: State<Entry[]>;
}
let entry_id = 0;
const file = (name: string, size: number): Entry => ({
  id: entry_id++,
  name,
  size,
});
const folder = (name: string, children: Entry[] | State<Entry[]>): Entry => ({
  id: entry_id++,
  name,
  children: Array.isArray(children) ? state.ok(children) : children,
});
//#endregion

{
  const sec = section(
    "Sub rows and the key field",
    "The names are in the key field, which has no column, it sorts by its text as the column #key. Click the header of the key column to sort by name, a click on its open all and close all buttons must not sort, right click it for the sort lines. Shift click Size to sort by it after the name. The sub rows sort inside their row by the same columns, a row moves with its sub rows. Sort by name and size both ways: the tree lines end in the last row shown of each level, the backgrounds alternate over every row shown, sub rows included. The arrow keys follow the order shown. Add a file to docs and it lands in its place, rename the first file of docs and it moves",
  );
  //#region tree
  //The files of docs change, the other folders are fixed
  const docs_files = state.ok_w<Entry[]>([
    file("report 10.pdf", 120),
    file("Report 2.pdf", 80),
    file("notes.txt", 4),
    folder("archive", [file("old.zip", 900), file("Older.zip", 1200)]),
  ]);
  const docs = folder("docs", docs_files);
  const rows = state.ok_w<Entry[]>([
    docs,
    folder("Music", [file("song b.mp3", 3000), file("song A.mp3", 2500)]),
    file("readme.md", 2),
    folder("app", [file("main.ts", 30), file("index.html", 6)]),
  ]);
  const sort = state.ok_w<ListSort>([{ column: "#key", direction: "asc" }]);
  box(sec, "tree sorted by the key field", {
    width: "30rem",
    height: "22rem",
    display: "grid",
  }).appendChild(
    list.container(
      {
        transform: (entry: Entry) =>
          ok({
            openable: Boolean(entry.children),
            opened: true,
            sub_rows: entry.children ? () => entry.children! : undefined,
            key_field: { text: entry.name },
            values: { size: entry.size },
          }),
        sub_rows: true,
      },
      {
        columns: {
          size: list.column({
            title: "Size",
            type: "number",
            align: "right",
            field_gen: () => list.text_field(),
            field_apply: (field, size: number | undefined) =>
              (field.text = size === undefined ? "" : `${size} kB`),
          }),
        },
        rows,
        sort,
      },
    ),
  );
  show_sort(sec, sort);
  let added = 0;
  controls(sec, {
    "Add a file to docs": () =>
      docs_files.array.push(file(`added ${++added}.txt`, added * 10)),
    "Rename the first file of docs": () => {
      const first = docs_files.ok()[0];
      docs_files.array.change(0, {
        ...first,
        name: first.name.startsWith("z") ? "a renamed" : "zz renamed",
      });
    },
    "Name A to Z": () =>
      void sort.write([{ column: "#key", direction: "asc" }]),
    "Size 9 to 1": () =>
      void sort.write([{ column: "size", direction: "desc" }]),
    "Size 9 to 1 then name": () =>
      void sort.write([
        { column: "size", direction: "desc" },
        { column: "#key", direction: "asc" },
      ]),
    "Clear sort": () => void sort.write([]),
  });
  //#endregion
  code(sec, source, "tree", "entries");
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
    "5000 rows, the buttons sort them and show the time until the next frame is painted, which includes moving the rows and the restyle of the alternating backgrounds. Clicking the titles works too. Change a row in the sorted list to see the time of one row moving",
  );
  //#region many_rows
  const status = sec.appendChild(document.createElement("div"));
  status.style.fontFamily = "monospace";
  const r = row(sec);
  const sort = state.ok_w<ListSort>([]);
  const rows = state.ok_w<Person[]>([]);
  /**Runs the change and shows the time until the next frame is painted */
  const timed = (label: string, change: () => void) => {
    const start = performance.now();
    change();
    const done = performance.now();
    requestAnimationFrame(() =>
      setTimeout(() => {
        status.textContent = `${label}: ${(done - start).toFixed(1)} ms in script, ${(performance.now() - start).toFixed(1)} ms until painted`;
      }),
    );
  };
  let built = false;
  controls(sec, {
    "5000 rows": () => {
      if (built) return;
      built = true;
      timed("Build", () => {
        rows.set_ok(array_from_length(5000, person));
        box(r, "5000 rows", {
          width: "44rem",
          height: "20rem",
          display: "grid",
        }).appendChild(people_list(rows, { sort }));
      });
    },
    "Name A to Z": () =>
      timed("Name A to Z", () =>
        sort.set_ok([{ column: "name", direction: "asc" }]),
      ),
    "Name Z to A": () =>
      timed("Name Z to A", () =>
        sort.set_ok([{ column: "name", direction: "desc" }]),
      ),
    "Age then city": () =>
      timed("Age then city", () =>
        sort.set_ok([
          { column: "age", direction: "asc" },
          { column: "city", direction: "asc" },
        ]),
      ),
    "Change one row": () =>
      timed("Change one row", () => {
        const first = rows.ok()[0];
        if (first)
          rows.array.change(0, {
            ...first,
            name: first.name.startsWith("Z") ? "A changed" : "Z changed",
          });
      }),
    "Clear sort": () => timed("Clear sort", () => sort.set_ok([])),
  });
  //#endregion
  code(sec, source, "many_rows", "people_list");
}

//      _      _______      ________
//     | |    |_   _\ \    / /  ____|
//     | |      | |  \ \  / /| |__
//     | |      | |   \ \/ / |  __|
//     | |____ _| |_   \  /  | |____
//     |______|_____|   \/   |______|

//#region machine_list
interface Machine {
  id: number;
  name: string;
  /**Changes while the list shows it, the list follows it */
  load: ReturnType<typeof state.ok_w<number>>;
}
const machine = (i: number): Machine => ({
  id: i,
  name: `Machine ${i + 1}`,
  load: state.ok_w((i * 37) % 100),
});

function machine_list(rows: Machine[], sort: StateOrVal<ListSort>) {
  return list.container(
    {
      transform: (m: Machine) =>
        ok({ values: { name: m.name, load: m.load, note: m.id } }),
    },
    {
      columns: {
        name: list.column_string("Name", { align: "left" }),
        load: list.column({
          title: "Load %",
          type: "number",
          align: "right",
          field_gen: () => list.number_field(),
          //The field shows the state and the list sorts by it, both follow it
          field_apply: (field, load: Machine["load"]) =>
            field.attach_state_to_prop("number", load, () => some(NaN)),
        }),
        note: list.column({
          title: "Note, type here",
          field_gen: () => list.node_field(document.createElement("input")),
          field_apply: (field, id: number) =>
            (field.node.placeholder = `Note ${id + 1}`),
        }),
      },
      rows,
      sort,
    },
  );
}

/**Changes the loads of some machines at every tick, the same machines each time the page loads */
function ticker(machines: Machine[], per_tick: number) {
  let tick = 0;
  return () => {
    for (let i = 0; i < per_tick; i++) {
      const n = tick * per_tick + i;
      machines[(n * 7) % machines.length].load.set_ok((n * 37 + tick) % 100);
    }
    tick++;
  };
}
//#endregion

/**Shows the frames per second and the longest frame of the last second, how the page keeps up */
function frame_meter(parent: HTMLElement) {
  const meter = parent.appendChild(document.createElement("div"));
  meter.style.fontFamily = "monospace";
  let frames = 0;
  let longest = 0;
  let last = performance.now();
  let second = last;
  const frame = (now: number) => {
    frames++;
    longest = Math.max(longest, now - last);
    last = now;
    if (now - second >= 1000) {
      meter.textContent = `${frames} frames per second, longest frame ${longest.toFixed(0)} ms`;
      frames = 0;
      longest = 0;
      second = now;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

{
  const sec = section(
    "Live values",
    "The loads are states, the list sorts by them and follows them, a changed load moves its row to its place at the next frame. Start the ticking, three loads change twice a second. Click in a note and type: while it has the focus the row stays where its old load put it, its load still changes and the other rows move past it, the input keeps the focus, and the row moves once you leave it. Press and hold anywhere on the list: nothing moves until you let go. Sort by name and the loads change without moving the rows",
  );
  //#region live_values
  const machines = array_from_length(12, machine);
  const sort = state.ok_w<ListSort>([{ column: "load", direction: "desc" }]);
  box(sec, "loads as states", {
    width: "30rem",
    height: "18rem",
    display: "grid",
  }).appendChild(machine_list(machines, sort));
  show_sort(sec, sort);
  const tick = ticker(machines, 3);
  let timer = 0;
  controls(sec, {
    "Start ticking": () => {
      if (!timer) timer = window.setInterval(tick, 500);
    },
    "Stop ticking": () => {
      clearInterval(timer);
      timer = 0;
    },
    "Tick once": tick,
  });
  //#endregion
  code(sec, source, "live_values", "machine_list");
}

{
  const sec = section(
    "Many live values",
    "5000 machines sorted by load, 50 loads change ten times a second. Placing the rows after a change costs a restyle of every row, on a big list that takes several frames, so the list then waits four times as long as placing took before it places the rows again, the page keeps reacting. Watch the frames per second and the longest frame, scroll and click while it ticks, and compare in touch mode or with a slower computer",
  );
  //#region many_live_values
  const r = row(sec);
  frame_meter(sec);
  let machines: Machine[] = [];
  let timer = 0;
  controls(sec, {
    "5000 machines": () => {
      if (machines.length) return;
      machines = array_from_length(5000, machine);
      box(r, "5000 machines", {
        width: "30rem",
        height: "20rem",
        display: "grid",
      }).appendChild(
        machine_list(machines, [{ column: "load", direction: "desc" }]),
      );
    },
    "Start ticking": () => {
      if (!timer && machines.length)
        timer = window.setInterval(ticker(machines, 50), 100);
    },
    "Stop ticking": () => {
      clearInterval(timer);
      timer = 0;
    },
  });
  //#endregion
  code(sec, source, "many_live_values", "machine_list");
}
