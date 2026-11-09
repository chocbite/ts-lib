import ctm from "@chocbite/ts-lib-ui/context-menu";
import {
  material_add_to_queue_rounded,
  material_folder_rounded,
} from "@chocbite/ts-lib-ui/icons";
import list from "@chocbite/ts-lib-ui/list";
import { array_from_length } from "@chocbite/ts-lib/common";
import { err, ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
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
    "Header, resizable columns, hover and selection of rows",
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
    "Open rows, add rows, right click a row. Every other row has an icon, every third cannot be opened",
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
