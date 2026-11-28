import list from "@chocbite/ts-lib-ui/list";
import { array_from_length } from "@chocbite/ts-lib/common";
import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { box, code, controls, row, section } from "../../../helpers";
//The page shows its own code under each section
import source from "./basics.ts?raw";

//#region words
const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf"];
const word = (i: number) => WORDS[i % WORDS.length];
//#endregion

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
  //#region basic
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
        transform: (item) =>
          ok({
            values: { name: word(item), number: item, squared: item },
          }),
      },
      {
        columns: {
          name: list.column_string("Name"),
          number: list.column({
            title: "Number",
            field_apply: (field, v: number) => (field.text = v.toString()),
            field_gen: () => list.text_field(),
          }),
          squared: list.column({
            title: "Squared",
            field_apply: (field, v: number) =>
              (field.text = (v * v).toString()),
            field_gen: () => list.text_field(),
          }),
        },
        rows,
      },
    ),
  );
  //#endregion
  code(sec, source, "basic", "words");
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
  //#region sizes
  const sizes = row(sec);
  const rows = state.ok_w(array_from_length(5, (i) => i));
  for (const width of ["8rem", "16rem", "32rem"])
    box(sizes, width, { width }).appendChild(
      list.container(
        {
          transform: (item) =>
            ok({ values: { name: word(item) + " " + item } }),
          headless: true,
        },
        { columns: { name: list.column_string("Name") }, rows },
      ),
    );
  //#endregion
  code(sec, source, "sizes", "words");
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
  //#region long_text
  sec.appendChild(
    list.container(
      {
        transform: (item) => {
          const text = array_from_length(item + 1, (i) => word(i)).join(" ");
          return ok({ values: { a: text, b: word(item), c: text } });
        },
      },
      {
        columns: {
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
        rows: array_from_length(6, (i) => i * 2),
      },
    ),
  );
  //#endregion
  code(sec, source, "long_text", "words");
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
  //#region alignment
  sec.appendChild(
    list.container(
      {
        transform: (item) =>
          ok({
            values: {
              left: word(item),
              center: word(item),
              right: word(item),
              number: item * 1234,
              node: "Press",
            },
          }),
      },
      {
        columns: {
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
        rows: array_from_length(4, (i) => i),
      },
    ),
  );
  box(sec, "24rem wide", { width: "24rem" }).appendChild(
    list.container(
      {
        transform: (item) => {
          const text = array_from_length(item * 4 + 1, (i) => word(i)).join(
            " ",
          );
          return ok({ values: { left: text, center: text, right: text } });
        },
      },
      {
        columns: {
          left: list.column_string("Left", { align: "left" }),
          center: list.column_string("Center"),
          right: list.column_string("Right", { align: "right" }),
        },
        rows: array_from_length(3, (i) => i),
      },
    ),
  );
  //#endregion
  code(sec, source, "alignment", "words");
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
  //#region column_order
  const text_column = (title: string, order?: number) =>
    list.column({
      title,
      order,
      field_apply: (field, v: string) => (field.text = v),
      field_gen: () => list.text_field(),
    });
  const container = list.container(
    {
      transform: (item: number) =>
        ok({
          values: { a: "a" + item, b: "b" + item, c: "c" + item },
        }),
    },
    {
      columns: {
        a: text_column("A", 3),
        b: text_column("B", 1),
        c: text_column("C"),
      },
      rows: array_from_length(3, (i) => i),
    },
  );
  controls(sec, {
    "Order 3, 1, unset": () =>
      container.set({
        columns: {
          a: text_column("A", 3),
          b: text_column("B", 1),
          c: text_column("C"),
        },
      }),
    "Object order": () =>
      container.set({
        columns: {
          a: text_column("A"),
          b: text_column("B"),
          c: text_column("C"),
        },
      }),
    Reversed: () =>
      container.set({
        columns: {
          a: text_column("A", 3),
          b: text_column("B", 2),
          c: text_column("C", 1),
        },
      }),
  });
  sec.appendChild(container);
  //#endregion
  code(sec, source, "column_order");
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
  //#region many_rows
  const rows = state.ok_w<number[]>([]);
  controls(sec, {
    "10000 rows": () => rows.set_ok(array_from_length(10000, (i) => i)),
    Clear: () => rows.set_ok([]),
  });
  box(sec, "10000 rows", { height: "20rem", display: "grid" }).appendChild(
    list.container(
      {
        transform: (item) => ok({ values: { name: word(item), number: item } }),
      },
      {
        columns: {
          name: list.column_string("Name"),
          number: list.column({
            title: "Number",
            field_apply: (field, v: number) => (field.text = v.toString()),
            field_gen: () => list.text_field(),
          }),
        },
        rows,
      },
    ),
  );
  //#endregion
  code(sec, source, "many_rows", "words");
}
