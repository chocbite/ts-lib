import ctm from "@chocbite/ts-lib-ui/context-menu";
import {
  material_add_to_queue_rounded,
  material_folder_rounded,
} from "@chocbite/ts-lib-ui/icons";
import list from "@chocbite/ts-lib-ui/list";
import { array_from_length } from "@chocbite/ts-lib/common";
import { err, ok, type Option } from "@chocbite/ts-lib/result";
import state, { type State, type StateROSW } from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../helpers";

const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf"];
const word = (i: number) => WORDS[i % WORDS.length];

//      ____           _____ _____ _____
//     |  _ \   /\    / ____|_   _/ ____|
//     | |_) | /  \  | (___   | || |
//     |  _ < / /\ \  \___ \  | || |
//     | |_) / ____ \ ____) |_| || |____
//     |____/_/    \_\_____/|_____\_____|
{
  const sec = section(
    "Basic",
    "Header, resizable columns and hover of rows, selection has its own sections below",
  );
  const rows = state.ok_w(array_from_length(10, (i) => i));
  controls(sec, {
    "10 rows": () => rows.set_ok(array_from_length(10, (i) => i)),
    "3 rows": () => rows.set_ok(array_from_length(3, (i) => i)),
    Empty: () => rows.set_ok([]),
    "Push row": () => rows.array.push(rows.array.get.length),
  });
  sec.appendChild(
    list.container(
      {
        name: list.column_string("Name"),
        number: list.column({
          title: "Number",
          field_apply: (field, v: number) => (field.text = v.toString()),
          field_gen: () => list.text_field(),
        }),
        squared: list.column({
          title: "Squared",
          field_apply: (field, v: number) => (field.text = (v * v).toString()),
          field_gen: () => list.text_field(),
        }),
      },
      (item) => ok({
        values: { name: word(item), number: item, squared: item },
      }),
      rows,
    ),
  );
}

//      _____ _____ ____________  _____
//     / ____|_   _|___  /  ____|/ ____|
//    | (___   | |    / /| |__  | (___
//     \___ \  | |   / / |  __|  \___ \
//     ____) |_| |_ / /__| |____ ____) |
//    |_____/|_____/_____|______|_____/
{
  const sec = section(
    "Sizes",
    "The same headless list in different widths, does the text and padding fit",
  );
  const sizes = row(sec);
  const rows = state.ok_w(array_from_length(5, (i) => i));
  for (const width of ["8rem", "16rem", "32rem"])
    box(sizes, width, { width }).appendChild(
      list.container(
        { name: list.column_string("Name") },
        (item) => ok({ values: { name: word(item) + " " + item } }),
        rows,
        { headless: true },
      ),
    );
}

//      _      ____  _   _  _____
//     | |    / __ \| \ | |/ ____|
//     | |   | |  | |  \| | |  __
//     | |   | |  | | . ` | | |_ |
//     | |___| |__| | |\  | |__| |
//     |______\____/|_| \_|\_____|
{
  const sec = section(
    "Long text",
    "Long titles and values in narrow columns, how do they clip",
  );
  sec.appendChild(
    list.container(
      {
        a: list.column({
          init_width: 8,
          title: "A column with a very long title that does not fit",
          field_apply: (field, v: string) => (field.text = v),
          field_gen: () => list.text_field(),
        }),
        b: list.column({
          fixed_width: "min",
          title: "Fixed min",
          field_apply: (field, v: string) => (field.text = v),
          field_gen: () => list.text_field(),
        }),
        c: list.column_string("Auto"),
      },
      (item) => {
        const text = array_from_length(item + 1, (i) => word(i)).join(" ");
        return ok({ values: { a: text, b: word(item), c: text } });
      },
      array_from_length(6, (i) => i * 2),
    ),
  );
}

//         _      _____ _____ _   _
//    /\  | |    |_   _/ ____| \ | |
//   /  \ | |      | || |  __|  \| |
//  / /\ \| |      | || | |_ | . ` |
// / ____ \ |____ _| || |__| | |\  |
///_/    \_\______|_____\_____|_| \_|
{
  const sec = section(
    "Alignment",
    "The align option of a column moves its title and fields, center is the default. Text, number and node fields follow it, form fields do not. In the narrow list long values wrap, the lines should follow the alignment too",
  );
  sec.appendChild(
    list.container(
      {
        left: list.column_string("Left", { align: "left" }),
        center: list.column_string("Center", { align: "center" }),
        right: list.column_string("Right", { align: "right" }),
        number: list.column({
          title: "Number",
          align: "right",
          field_apply: (field, v: number) => (field.number = v),
          field_gen: () => list.number_field(),
        }),
        node: list.column({
          title: "Node",
          align: "right",
          field_apply: (field, v: string) => (field.node.textContent = v),
          field_gen: () => list.node_field(document.createElement("button")),
        }),
      },
      (item) =>
        ok({
          values: {
            left: word(item),
            center: word(item),
            right: word(item),
            number: item * 1234,
            node: "Press",
          },
        }),
      array_from_length(4, (i) => i),
    ),
  );
  box(sec, "24rem wide", { width: "24rem" }).appendChild(
    list.container(
      {
        left: list.column_string("Left", { align: "left" }),
        center: list.column_string("Center"),
        right: list.column_string("Right", { align: "right" }),
      },
      (item) => {
        const text = array_from_length(item * 4 + 1, (i) => word(i)).join(" ");
        return ok({ values: { left: text, center: text, right: text } });
      },
      array_from_length(3, (i) => i),
    ),
  );
}

//       ____  _____  _____  ______ _____
//      / __ \|  __ \|  __ \|  ____|  __ \
//     | |  | | |__) | |  | | |__  | |__) |
//     | |  | |  _  /| |  | |  __| |  _  /
//     | |__| | | \ \| |__| | |____| | \ \
//      \____/|_|  \_\_____/|______|_|  \_\
{
  const sec = section(
    "Column order",
    "Declared A, B, C with order 3, 1, unset, shown as B, C, A (unset uses its position). The buttons replace the columns, existing rows must follow",
  );
  const text_column = (title: string, order?: number) =>
    list.column({
      title,
      order,
      field_apply: (field, v: string) => (field.text = v),
      field_gen: () => list.text_field(),
    });
  const container = list.container(
    { a: text_column("A", 3), b: text_column("B", 1), c: text_column("C") },
    (item: number) => ok({
      values: { a: "a" + item, b: "b" + item, c: "c" + item },
    }),
    array_from_length(3, (i) => i),
  );
  controls(sec, {
    "Order 3, 1, unset": () =>
      (container.columns = {
        a: text_column("A", 3),
        b: text_column("B", 1),
        c: text_column("C"),
      }),
    "Object order": () =>
      (container.columns = {
        a: text_column("A"),
        b: text_column("B"),
        c: text_column("C"),
      }),
    Reversed: () =>
      (container.columns = {
        a: text_column("A", 3),
        b: text_column("B", 2),
        c: text_column("C", 1),
      }),
  });
  sec.appendChild(container);
}

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
      (item, list_row, rows_any) => {
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
            disabled: state.p.ros(sub_rows.related().value.length, (len) =>
              ok(len.value >= 4),
            ).state,
            on_add: () => sub_rows.write(state.a.write.push(item * 10 + 9)),
          },
          values: { name: word(item) + " " + item, remove },
          context_menu: ctm.menu([
            ctm.line("Remove", remove),
            ctm.line("Insert above", () =>
              rows_state.write(
                state.a.write.splice(list_row.index, 0, rows.array.get.length),
              ),
            ),
            ctm.line("Empty", () => rows_state.write(state.a.write.fresh([]))),
          ]),
        });
      },
      rows,
      {
        sub_rows: true,
        add_row: {
          text: "Add row",
          on_add: () => rows.array.push(rows.array.get.length),
        },
      },
    ),
  );
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
      (item: KeyItem) =>
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
      [...items, state_item],
      { sub_rows: true },
    ),
  );
  controls(sec, {
    "Icon: folder": () => state_icon.set_ok(material_folder_rounded),
    "Icon: add": () => state_icon.set_ok(material_add_to_queue_rounded),
    "Text: short": () => state_text.set_ok("Short"),
    "Text: long": () =>
      state_text.set_ok("A much longer state text for the key field"),
    "Text: error": () => state_text.set_err("Text failed"),
  });
}

//      ______ _____  _____   ____  _____   _____
//     |  ____|  __ \|  __ \ / __ \|  __ \ / ____|
//     | |__  | |__) | |__) | |  | | |__) | (___
//     |  __| |  _  /|  _  /| |  | |  _  / \___ \
//     | |____| | \ \| | \ \| |__| | | \ \ ____) |
//     |______|_|  \_\_|  \_\\____/|_|  \_\_____/
{
  const sec = section(
    "Errors",
    "First list: an error in the state replaces the rows with its text, the add row stays. Second and third list: invalid rows show their text instead of the fields, in the third they keep the indent and arrow keys move through them. The sub rows of row 0 can fail too",
  );
  const initial = () => array_from_length(4, (i) => i);
  const failing = state.from_w(initial());
  const invalid = state.ok_w(array_from_length(6, (i) => i));
  const sub_rows = state.from_w([10, 12]);
  let show_invalid = true;
  const invalid_text = (item: number) =>
    show_invalid && item % 3 === 1 ? `Row ${item} could not be read` : undefined;

  controls(sec, {
    "List error": () => failing.set_err("Could not read the rows"),
    "List recover": () => failing.set_ok(initial()),
    "Toggle invalid rows": () => {
      show_invalid = !show_invalid;
      invalid.set_ok([...invalid.ok()]);
    },
    "Sub rows error": () => sub_rows.set_err("Could not read the sub rows"),
    "Sub rows recover": () => sub_rows.set_ok([10, 12]),
  });

  sec.appendChild(
    list.container(
      { name: list.column_string("Name"), id: list.column_string("Id") },
      (item) => ok({ values: { name: word(item), id: item.toString() } }),
      failing,
      { add_row: { text: "Add row (does nothing here)", on_add: () => {} } },
    ),
  );
  sec.appendChild(
    list.container(
      { name: list.column_string("Name"), id: list.column_string("Id") },
      (item) => {
        const text = invalid_text(item);
        if (text !== undefined) return err(text);
        return ok({ values: { name: word(item), id: item.toString() } });
      },
      invalid,
    ),
  );
  sec.appendChild(
    list.container(
      { name: list.column_string("Name"), id: list.column_string("Id") },
      (item, list_row) => {
        const text = invalid_text(item);
        if (text !== undefined) return err(text);
        return ok({
          openable: list_row.depth === 0,
          opened: item === 0,
          sub_rows: () => sub_rows,
          values: { name: word(item), id: item.toString() },
        });
      },
      invalid,
      { sub_rows: true },
    ),
  );
}

//     __  __          _   ___     __
//    |  \/  |   /\   | \ | \ \   / /
//    | \  / |  /  \  |  \| |\ \_/ /
//    | |\/| | / /\ \ | . ` | \   /
//    | |  | |/ ____ \| |\  |  | |
//    |_|  |_/_/    \_\_| \_|  |_|
{
  const sec = section(
    "Many rows",
    "Press the button for 10000 rows in a 20rem high box, how does scrolling feel",
  );
  const rows = state.ok_w<number[]>([]);
  controls(sec, {
    "10000 rows": () => rows.set_ok(array_from_length(10000, (i) => i)),
    Clear: () => rows.set_ok([]),
  });
  box(sec, "10000 rows", { height: "20rem", display: "grid" }).appendChild(
    list.container(
      {
        name: list.column_string("Name"),
        number: list.column({
          title: "Number",
          field_apply: (field, v: number) => (field.text = v.toString()),
          field_gen: () => list.text_field(),
        }),
      },
      (item) => ok({ values: { name: word(item), number: item } }),
      rows,
    ),
  );
}

//       _____ ______ _      ______ _____ _______ _____ ____  _   _
//      / ____|  ____| |    |  ____/ ____|__   __|_   _/ __ \| \ | |
//     | (___ | |__  | |    | |__ | |       | |    | || |  | |  \| |
//      \___ \|  __| | |    |  __|| |       | |    | || |  | | . ` |
//      ____) | |____| |____| |___| |____   | |   _| || |__| | |\  |
//     |_____/|______|______|______\_____|  |_|  |_____\____/|_| \_|

interface SelItem {
  id: number;
  sub?: SelItem[];
}

/**Tree of items with unique ids, item 2 of every level is not selectable */
function sel_tree(amount: number, depth: number, base = 0): SelItem[] {
  return array_from_length(amount, (i) => {
    const id = base * 10 + i + 1;
    return {
      id,
      sub: depth > 0 ? sel_tree(3, depth - 1, id) : undefined,
    };
  });
}

/**Selection state of the app, given to lists with bind */
type SelState = StateROSW<number[], Option<{}>, number[]>;
const sel_state = (keys: number[] = []): SelState => state.ok_w(keys);

/**Adds a line under the list that shows the selected keys */
function sel_show(parent: HTMLElement, selection: SelState) {
  const text = parent.appendChild(document.createElement("p"));
  selection.sub((r) => {
    text.textContent = "Selected: " + (r.value.join(", ") || "none");
  }, true);
}

function sel_list(
  rows: SelItem[] | State<SelItem[]>,
  mode: "single" | "multi",
  selection: SelState,
  options: { sub_rows?: boolean } = {},
) {
  return list
    .container(
      {
        name: list.column_string("Name"),
        id: list.column({
          title: "Id",
          field_apply: (field, v: number) => (field.text = v.toString()),
          field_gen: () => list.text_field(),
        }),
      },
      (item: SelItem) =>
        ok({
          openable: Boolean(item.sub),
          sub_rows: options.sub_rows ? () => item.sub ?? [] : undefined,
          selectable: item.id % 10 !== 2,
          context_menu: ctm.menu([ctm.line("Line of " + item.id, () => {})]),
          values: { name: word(item.id), id: item.id },
        }),
      rows,
      {
        sub_rows: options.sub_rows,
        selection: { mode, key: (item) => item.id },
      },
    )
    .bind({ selection });
}

{
  const sec = section(
    "Selection",
    "Single shows radio buttons, multi shows checkboxes, check that both are easy to hit in touch mode. Click on a row selects only it, ctrl click toggles, shift click selects a range (multi). A checkbox toggles its row without clearing the others, the header checkbox selects all or clears and shows some or all, right click or long press on it for a select all / deselect all menu. Right click only opens the menu, it never changes the selection. The row menu gets select or deselect (and select all / deselect all in multi) in front of its own line. Row 2 is not selectable, its cell stays empty. Keyboard in the checkbox and radio cells: arrows only move the focus, space selects or toggles, escape clears, ctrl+a selects all (multi). Remove and reverse should keep the selection on the same names. Removing a selected row does not change the state, Reset brings it back selected",
  );
  const rows = state.ok_w(sel_tree(6, 0));
  controls(sec, {
    "Remove first": () => rows.set_ok(rows.ok().slice(1)),
    Reverse: () => rows.set_ok([...rows.ok()].reverse()),
    Reset: () => rows.set_ok(sel_tree(6, 0)),
  });
  const r = row(sec);
  for (const mode of ["single", "multi"] as const) {
    const b = box(r, mode, { width: "18rem" });
    const selection = sel_state();
    b.appendChild(sel_list(rows, mode, selection));
    sel_show(b, selection);
  }
}

{
  const sec = section(
    "Selection with sub rows",
    "The keyboard works in the key field here. Arrows only move the focus, space selects or toggles, shift+arrows extend (multi), enter opens and closes. The row menu has open or close in front of the select lines. Closing a row hides its selected sub rows but keeps them in the state, opening shows them selected again. The buttons write the state like app code, keys of hidden sub rows show once their row is opened",
  );
  const r = row(sec);
  for (const mode of ["single", "multi"] as const) {
    const b = box(r, mode, { width: "22rem" });
    const selection = sel_state();
    b.appendChild(sel_list(sel_tree(4, 2), mode, selection, { sub_rows: true }));
    controls(b, {
      "Write 1, 11 and 4": () => void selection.write([1, 11, 4]),
      "Write none": () => void selection.write([]),
    });
    sel_show(b, selection);
  }
}

{
  const sec = section(
    "Selection shared through a state",
    "All three lists are bound to one state. The middle list shows the same rows reversed with other columns, the selection follows the names, not the positions. The right list only shows the first three rows: toggling there keeps the keys it cannot see, select all and deselect all replace the whole selection. The buttons write the state like app code would",
  );
  const rows = state.ok_w(sel_tree(6, 0));
  const shared = sel_state();
  controls(sec, {
    "Write 1, 3 and 5": () => void shared.write([1, 3, 5]),
    "Write none": () => void shared.write([]),
    "Remove first": () => rows.set_ok(rows.ok().slice(1)),
    Reset: () => rows.set_ok(sel_tree(6, 0)),
  });
  const other = (
    title: string,
    rows: State<SelItem[]>,
  ) =>
    list
      .container(
        {
          id: list.column({
            title: "Id",
            field_apply: (field, v: number) => (field.text = v.toString()),
            field_gen: () => list.text_field(),
          }),
          upper: list.column_string(title),
        },
        (item: SelItem) =>
          ok({
            selectable: item.id % 10 !== 2,
            values: { id: item.id, upper: word(item.id).toUpperCase() },
          }),
        rows,
        { selection: { mode: "multi", key: (item) => item.id } },
      )
      .bind({ selection: shared });
  const r = row(sec);
  box(r, "names", { width: "14rem" }).appendChild(
    sel_list(rows, "multi", shared),
  );
  box(r, "reversed, other columns", { width: "14rem" }).appendChild(
    other("Upper", state.p.ros(rows, (r) => ok([...r.value].reverse()))),
  );
  box(r, "first three rows", { width: "14rem" }).appendChild(
    other("Upper", state.p.ros(rows, (r) => ok(r.value.slice(0, 3)))),
  );
  sel_show(sec, shared);
}

{
  const sec = section(
    "Selection of many rows",
    "Press the button for 10000 rows, then ctrl+a with focus in the list, click a row and shift click far below. How fast do selecting and clearing feel. Toggling one checkbox writes one push or delete to the state, so only that row changes",
  );
  const rows = state.ok_w<SelItem[]>([]);
  controls(sec, {
    "10000 rows": () =>
      rows.set_ok(array_from_length(10000, (i) => ({ id: i * 10 + 1 }))),
    Clear: () => rows.set_ok([]),
  });
  const b = box(sec, "10000 rows", { height: "20rem", display: "grid" });
  const selection = sel_state();
  b.appendChild(sel_list(rows, "multi", selection));
  sel_show(sec, selection);
}
