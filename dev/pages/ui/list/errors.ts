import list from "@chocbite/ts-lib-ui/list";
import { array_from_length } from "@chocbite/ts-lib/common";
import { err, ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { code, controls, demo_error, section } from "../../../helpers";
//The page shows its own code under each section
import source from "./errors.ts?raw";

//#region words
const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf"];
const word = (i: number) => WORDS[i % WORDS.length];
//#endregion

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
  //#region errors
  const initial = () => array_from_length(4, (i) => i);
  const failing = state.from_w(initial());
  const invalid = state.ok_w(array_from_length(6, (i) => i));
  const sub_rows = state.from_w([10, 12]);
  let show_invalid = true;
  const invalid_text = (item: number) =>
    show_invalid && item % 3 === 1
      ? `Row ${item} could not be read`
      : undefined;

  controls(sec, {
    "List error": () => failing.set_err(demo_error("Could not read the rows")),
    "List recover": () => failing.set_ok(initial()),
    "Toggle invalid rows": () => {
      show_invalid = !show_invalid;
      invalid.set_ok([...invalid.ok()]);
    },
    "Sub rows error": () =>
      sub_rows.set_err(demo_error("Could not read the sub rows")),
    "Sub rows recover": () => sub_rows.set_ok([10, 12]),
  });

  sec.appendChild(
    list.container(
      {
        transform: (item) =>
          ok({ values: { name: word(item), id: item.toString() } }),
      },
      {
        columns: {
          name: list.column_string("Name"),
          id: list.column_string("Id"),
        },
        rows: failing,
        add_row: { text: "Add row (does nothing here)", on_add: () => {} },
      },
    ),
  );
  sec.appendChild(
    list.container(
      {
        transform: (item) => {
          const text = invalid_text(item);
          if (text !== undefined) return err(text);
          return ok({ values: { name: word(item), id: item.toString() } });
        },
      },
      {
        columns: {
          name: list.column_string("Name"),
          id: list.column_string("Id"),
        },
        rows: invalid,
      },
    ),
  );
  sec.appendChild(
    list.container(
      {
        transform: (item, list_row) => {
          const text = invalid_text(item);
          if (text !== undefined) return err(text);
          return ok({
            openable: list_row.depth === 0,
            opened: item === 0,
            sub_rows: () => sub_rows,
            values: { name: word(item), id: item.toString() },
          });
        },
        sub_rows: true,
      },
      {
        columns: {
          name: list.column_string("Name"),
          id: list.column_string("Id"),
        },
        rows: invalid,
      },
    ),
  );
  //#endregion
  code(sec, source, "errors", "words");
}
