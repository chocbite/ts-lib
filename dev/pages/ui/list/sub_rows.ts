import { AccessTypes } from "@chocbite/ts-lib-ui/base";
import ctm from "@chocbite/ts-lib-ui/context_menu";
import {
  material_add_to_queue_rounded,
  material_folder_rounded,
} from "@chocbite/ts-lib-ui/icons";
import list from "@chocbite/ts-lib-ui/list";
import { array_from_length } from "@chocbite/ts-lib/common";
import { err, ok } from "@chocbite/ts-lib/result";
import state, { type State, type StateROS } from "@chocbite/ts-lib/state";
import { box, controls, row, section, demo_error } from "../../../helpers";

const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf"];
const word = (i: number) => WORDS[i % WORDS.length];

//      _____ _    _ ____    _____   ______          _______
//     / ____| |  | |  _ \  |  __ \ / __ \ \        / / ____|
//    | (___ | |  | | |_) | | |__) | |  | \ \  /\  / / (___
//     \___ \| |  | |  _ <  |  _  /| |  | |\ \/  \/ / \___ \
//     ____) | |__| | |_) | | | \ \| |__| | \  /\  /  ____) |
//    |_____/ \____/|____/  |_|  \_\\____/   \/  \/  |_____/
{
  const sec = section(
    "Sub rows, add row, icons and context menu",
    "Open rows, add rows, right click a row. Every other row has an icon, every fourth has key field text, every third cannot be opened. Drag the key column header narrower so the long text of row 4 wraps, its lines should stay centered. An open row draws a line from its middle down to its sub rows, double press the handle to fit the key column again",
  );
  const rows = state.ok_w(array_from_length(6, (i) => i));
  sec.appendChild(
    list.container(
      {
        transform: (item, list_row, rows_any) => {
          //Top and sub rows on this page are all writable states
          const rows_state = rows_any as typeof rows;
          const sub_rows = state.rosw(
            state.a.help(ok(array_from_length(2, (i) => item * 10 + i))),
            true,
          );
          const remove = () =>
            rows_state.write(state.a.write.splice(list_row.index, 1));
          return ok({
            openable: item % 3 !== 2,
            key_field: {
              icon: item % 2 ? material_folder_rounded : undefined,
              text:
                item === 4
                  ? "Long key text that wraps in a narrow key column"
                  : item % 4 === 0
                    ? "#" + item
                    : undefined,
            },
            sub_rows: () => sub_rows,
            add_row: {
              text: "Add sub row",
              icon: material_add_to_queue_rounded,
              //Locked at four sub rows
              access: sub_rows
                .related()
                .value.length.proxy_map((len) =>
                  len >= 4 ? AccessTypes.Read : AccessTypes.Write,
                ).state,
              on_add: () => sub_rows.write(state.a.write.push(item * 10 + 9)),
            },
            values: { name: word(item) + " " + item, remove },
            context_menu: ctm.menu([
              ctm.line({ text: "Remove", on_click: remove }),
              ctm.line({
                text: "Insert above",
                on_click: () =>
                  rows_state.write(
                    state.a.write.splice(
                      list_row.index,
                      0,
                      rows.array.get.length,
                    ),
                  ),
              }),
              ctm.line({
                text: "Empty",
                on_click: () => rows_state.write(state.a.write.fresh([])),
              }),
            ]),
          });
        },
        sub_rows: true,
      },
      {
        columns: {
          name: list.column_string("Name"),
          remove: list.column({
            fixed_width: "min",
            title: "Remove",
            field_apply: (field, remove: () => void) => {
              field.node.onclick = remove;
            },
            field_gen: () => {
              const button = document.createElement("button");
              button.textContent = "Remove";
              return list.node_field(button);
            },
          }),
        },
        rows,
        add_row: {
          text: "Add row",
          on_add: () => rows.array.push(rows.array.get.length),
        },
      },
    ),
  );
}

{
  const sec = section(
    "Key field only, no value columns",
    "A list with only the key column, the names are key field text. The key column fills the box. The rows must stay under each other, the add rows and the invalid row run from the key column to the end, after the tree lines. Open Beta for its sub rows and their add row. Add rows until the error row shows instead of the rows",
  );
  const rows = state.from_w<string[]>(["Alpha", "Beta", "invalid", "Gamma"]);
  let count = 0;
  const names = (name: string) => [name + " 1", name + " 2"];
  {
    const b = box(sec, "key column only", { width: "16rem" });
    b.appendChild(
      list.container(
        {
          transform: (name: string) =>
            name === "invalid"
              ? err("This row is invalid")
              : ok({
                  key_field: { text: name },
                  openable: name === "Beta",
                  sub_rows: () => names(name),
                  add_row:
                    name === "Beta"
                      ? { text: "Add sub row", on_add: () => {} }
                      : undefined,
                  values: {},
                }),
          headless: true,
          sub_rows: true,
        },
        {
          columns: {},
          rows,
          add_row: {
            text: "Add row",
            on_add: () => {
              count++;
              if (count > 2)
                rows.set_err(demo_error("The rows failed to load"));
              else void rows.write(state.a.write.push("New " + count));
            },
          },
        },
      ),
    );
  }
  controls(sec, { Reset: () => location.reload() });
}

{
  const sec = section(
    "Open all and close all",
    "The buttons in the key column header open and close all rows. Right click the header, a row or the space below the rows for open all, and close all while a row is open, in the menu of the list, the headerless list has only that and the buttons under it, which call open_all and close_all like app code. The endless list has three sub rows in every row, open all stops after 1000 rows with a warning at the header and opening again continues, upper levels first",
  );
  interface TreeNode {
    name: string;
    sub?: TreeNode[];
  }
  const tree = (): TreeNode[] => [
    {
      name: "Documents",
      sub: [{ name: "Old", sub: [{ name: "2019.txt" }] }, { name: "notes.md" }],
    },
    { name: "Pictures", sub: [{ name: "cat.png" }] },
    { name: "readme.md" },
  ];
  const endless = (name: string): TreeNode => ({
    name,
    get sub() {
      return [endless(name + ".1"), endless(name + ".2"), endless(name + ".3")];
    },
  });
  const tree_list = (rows: TreeNode[], headless: boolean) =>
    list.container(
      {
        transform: (data: TreeNode) =>
          ok({
            openable: Boolean(data.sub),
            key_field: { text: data.name },
            sub_rows: () => data.sub ?? [],
            values: {},
          }),
        sub_rows: true,
        headless,
      },
      { columns: {}, rows },
    );
  const r = row(sec);
  box(r, "header", { width: "14rem" }).appendChild(tree_list(tree(), false));
  const headless = tree_list(tree(), true);
  const b = box(r, "headless, app buttons", { width: "14rem" });
  b.appendChild(headless);
  controls(b, {
    "Open all": () => headless.open_all(),
    "Close all": () => headless.close_all(),
  });
  box(r, "endless", {
    width: "18rem",
    height: "20rem",
    display: "grid",
  }).appendChild(tree_list([endless("x")], false));
}

{
  const sec = section(
    "Opened as a state",
    "Open some folders in both lists. Rebuild empties the rows and gives new ones, like an editor showing other data: the state list keeps its folders open, the plain list closes them. Reverse gives the rows in the other order, rows are reused by position, so in the plain list the open state stays at the position, in the state list it stays with the folder. Open, close, open all, close all and the row menu all change the state text under the list. The read only list only follows the buttons under it: its folders have no opener arrow, the tree lines show in its place and an open folder keeps its line down to the sub rows, keys and open all do nothing and its row menu has no open or close line",
  );
  interface Folder {
    name: string;
    sub?: Folder[];
  }
  const folders = (): Folder[] => [
    {
      name: "Documents",
      sub: [{ name: "Old", sub: [{ name: "2019.txt" }] }, { name: "notes.md" }],
    },
    { name: "Pictures", sub: [{ name: "cat.png" }] },
    { name: "Music", sub: [{ name: "song.mp3" }] },
  ];
  const names = ["Documents", "Old", "Pictures", "Music"];
  //One state per folder name, kept by the app across rebuilds
  const writable = new Map(names.map((n) => [n, state.ok_w(false)]));
  const read_only = new Map(names.map((n) => [n, state.ok(n === "Pictures")]));
  const folder_list = (
    rows: State<Folder[]>,
    opened?: (name: string) => State<boolean>,
  ) =>
    list.container(
      {
        transform: (data: Folder) =>
          ok({
            openable: Boolean(data.sub),
            //Only folders have a state, the files can not be opened
            opened: (data.sub && opened?.(data.name)) ?? false,
            key_field: { text: data.name },
            sub_rows: () => data.sub ?? [],
            values: {},
          }),
        sub_rows: true,
      },
      { columns: {}, rows },
    );
  const show = (
    parent: HTMLElement,
    states: Map<string, StateROS<boolean>>,
  ) => {
    const text = parent.appendChild(document.createElement("div"));
    const update = () => {
      const open = names.filter((n) => states.get(n)!.get().value);
      text.textContent = "Open: " + (open.join(", ") || "none");
    };
    for (const s of states.values()) s.sub(update);
    update();
  };
  const rows = state.ok_w<Folder[]>(folders());
  const read_only_rows = state.ok_w<Folder[]>(folders());
  const r = row(sec);
  const b1 = box(r, "writable states", { width: "14rem" });
  b1.appendChild(folder_list(rows, (n) => writable.get(n)!));
  show(b1, writable);
  box(r, "plain opened", { width: "14rem" }).appendChild(folder_list(rows));
  const b3 = box(r, "read only states", { width: "14rem" });
  b3.appendChild(
    folder_list(read_only_rows, (n) => read_only.get(n)!.read_only),
  );
  show(b3, read_only);
  controls(b3, {
    "Toggle Documents": () => {
      const s = read_only.get("Documents")!;
      s.set_ok(!s.get().value);
    },
    "Toggle Pictures": () => {
      const s = read_only.get("Pictures")!;
      s.set_ok(!s.get().value);
    },
  });
  controls(sec, {
    Rebuild: () => {
      rows.set_ok([]);
      rows.set_ok(folders());
    },
    Reverse: () => rows.set_ok([...rows.get().value].reverse()),
    "Open Music from app": () => void writable.get("Music")!.write(true),
  });
}

//     _  __________     __  ______ _____ ______ _      _____
//    | |/ /  ____\ \   / / |  ____|_   _|  ____| |    |  __ \
//    | ' /| |__   \ \_/ /  | |__    | | | |__  | |    | |  | |
//    |  < |  __|   \   /   |  __|   | | |  __| | |    | |  | |
//    | . \| |____   | |    | |     _| |_| |____| |____| |__| |
//    |_|\_\______|  |_|    |_|    |_____|______|______|_____/
{
  const sec = section(
    "Key field icon and text",
    "Every combination of icon and text, all rows open. The line down to the sub rows must stay behind the icon and the text, and show below them in the tall row. The state row changes its icon and text from the buttons, an error shows as the text",
  );
  interface KeyItem {
    name: string;
    icon?: boolean;
    text?: string;
    tall?: boolean;
  }
  const items: KeyItem[] = [
    { name: "Nothing" },
    { name: "Icon only", icon: true },
    { name: "Text only", text: "Text" },
    { name: "Icon and text", icon: true, text: "Text" },
    {
      name: "Icon and long text",
      icon: true,
      text: "Long key text that wraps in a narrow key column",
    },
    { name: "Icon and text, tall row", icon: true, text: "Tall", tall: true },
  ];
  const state_icon = state.from_w(material_folder_rounded);
  const state_text = state.from_w("State text");
  const state_item: KeyItem = { name: "From states" };
  const field = (item: KeyItem) =>
    item === state_item
      ? { icon: state_icon, text: state_text }
      : {
          icon: item.icon ? material_folder_rounded : undefined,
          text: item.text,
        };
  sec.appendChild(
    list.container(
      {
        transform: (item: KeyItem) =>
          ok({
            openable: !item.name.startsWith("Sub"),
            opened: !item.name.startsWith("Sub"),
            key_field: field(item),
            sub_rows: () => [
              { name: "Sub with icon and text", icon: true, text: "Sub" },
              { name: "Sub with text", text: "Sub" },
            ],
            values: { name: item },
          }),
        sub_rows: true,
      },
      {
        columns: {
          name: list.column({
            title: "Name",
            field_gen: () => list.node_field(document.createElement("div")),
            field_apply: (field, item: KeyItem) => {
              field.node.textContent = item.name;
              field.node.style.height = item.tall ? "4rem" : "";
              field.node.style.alignContent = "center";
            },
          }),
        },
        rows: [...items, state_item],
      },
    ),
  );
  controls(sec, {
    "Icon: folder": () => state_icon.set_ok(material_folder_rounded),
    "Icon: add": () => state_icon.set_ok(material_add_to_queue_rounded),
    "Text: short": () => state_text.set_ok("Short"),
    "Text: long": () =>
      state_text.set_ok("A much longer state text for the key field"),
    "Text: error": () => state_text.set_err(demo_error("Text failed")),
  });
}
