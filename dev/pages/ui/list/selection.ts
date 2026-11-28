import ctm from "@chocbite/ts-lib-ui/context_menu";
import list from "@chocbite/ts-lib-ui/list";
import { array_from_length } from "@chocbite/ts-lib/common";
import { err, ok, type Option } from "@chocbite/ts-lib/result";
import state, { type State, type StateROSW } from "@chocbite/ts-lib/state";
import {
  box,
  code,
  controls,
  demo_error,
  row,
  section,
} from "../../../helpers";
//The page shows its own code under each section
import source from "./selection.ts?raw";

//#region words
const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf"];
const word = (i: number) => WORDS[i % WORDS.length];
//#endregion

//       _____ ______ _      ______ _____ _______ _____ ____  _   _
//      / ____|  ____| |    |  ____/ ____|__   __|_   _/ __ \| \ | |
//     | (___ | |__  | |    | |__ | |       | |    | || |  | |  \| |
//      \___ \|  __| | |    |  __|| |       | |    | || |  | | . ` |
//      ____) | |____| |____| |___| |____   | |   _| || |__| | |\  |
//     |_____/|______|______|______\_____|  |_|  |_____\____/|_| \_|

//#region sel_list
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

/**Selection state of the app, given to lists as their selected input */
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
  return list.container(
    {
      transform: (item: SelItem) =>
        ok({
          openable: Boolean(item.sub),
          sub_rows: options.sub_rows ? () => item.sub ?? [] : undefined,
          selectable: item.id % 10 !== 2,
          context_menu: ctm.menu([
            ctm.line({ text: "Line of " + item.id, on_click: () => {} }),
          ]),
          values: { name: word(item.id), id: item.id },
        }),
      sub_rows: options.sub_rows,
      selection: { mode, key: (item) => item.id },
    },
    {
      columns: {
        name: list.column_string("Name"),
        id: list.column({
          title: "Id",
          field_apply: (field, v: number) => (field.text = v.toString()),
          field_gen: () => list.text_field(),
        }),
      },
      rows,
      selected: selection,
    },
  );
}
//#endregion

{
  const sec = section(
    "Selection",
    "Single shows radio buttons, multi shows checkboxes, check that both are easy to hit in touch mode. Click on a row selects only it, ctrl click toggles, shift click selects a range (multi). A checkbox toggles its row without clearing the others, the header checkbox selects all or clears and shows some or all, right click or long press on it, a header or the space below the rows for the menu of the list with select all / deselect all. Right click only opens the menu, it never changes the selection. The row menu gets select or deselect (and select all / deselect all in multi) in front of its own line. Row 2 is not selectable, its cell stays empty and selecting it shows a warning. Keyboard in the checkbox and radio cells: arrows only move the focus, space selects or toggles, escape clears, ctrl+a selects all (multi). Remove and reverse should keep the selection on the same names. Removing a selected row does not change the state, Reset brings it back selected",
  );
  //#region selection
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
  //#endregion
  code(sec, source, "selection", "sel_list", "words");
}

{
  const sec = section(
    "Selection rejected",
    "The left state refuses any selection with delta (3) in it, the right state refuses every write. A refused click, checkbox, select all or key shows the reason at the row and the selection stays as it was",
  );
  //#region selection_rejected
  const r = row(sec);
  /**State that applies the write instructions itself, so it can check the result before taking it */
  const checked = (check: (keys: readonly number[]) => string | undefined) =>
    state.rosw<number[]>(ok([]), (value, owner, old) => {
      const [keys, changes] = state.a.write_apply(
        value,
        old?.ok ? [...old.value] : [],
      );
      const problem = check(keys);
      if (problem) return Promise.resolve(err(demo_error("Rejected", problem)));
      state.a.read_set([keys, changes], owner.set_ok.bind(owner));
      return Promise.resolve(ok(undefined));
    });
  const rows = state.ok_w(sel_tree(6, 0));
  for (const [label, selection] of [
    [
      "delta is locked",
      checked((keys) =>
        keys.includes(3) ? "Delta can not be selected" : undefined,
      ),
    ],
    ["read only", checked(() => "The selection is read only")],
  ] as const) {
    const b = box(r, label, { width: "18rem" });
    b.appendChild(sel_list(rows, "multi", selection));
    sel_show(b, selection);
  }
  //#endregion
  code(sec, source, "selection_rejected", "sel_list", "words");
}

{
  const sec = section(
    "Selection with sub rows",
    "The keyboard works in the key field here. Single has no radio buttons, the key field and a click on the row are enough. Arrows only move the focus, space selects or toggles, shift+arrows extend (multi), enter opens and closes. The row menu has open or close in front of the select lines. Row 2 can not be selected but has sub rows, a click on it or space opens and closes it without a warning, a double click leaves it open, its checkbox (multi) still warns. Closing a row hides its selected sub rows but keeps them in the state, opening shows them selected again. The buttons write the state like app code, keys of hidden sub rows show once their row is opened",
  );
  //#region selection_with_sub_rows
  const r = row(sec);
  for (const mode of ["single", "multi"] as const) {
    const b = box(r, mode, { width: "22rem" });
    const selection = sel_state();
    b.appendChild(
      sel_list(sel_tree(4, 2), mode, selection, { sub_rows: true }),
    );
    controls(b, {
      "Write 1, 11 and 4": () => void selection.write([1, 11, 4]),
      "Write none": () => void selection.write([]),
    });
    sel_show(b, selection);
  }
  //#endregion
  code(sec, source, "selection_with_sub_rows", "sel_list", "words");
}

{
  const sec = section(
    "Selection shared through a state",
    "All three lists are bound to one state. The middle list shows the same rows reversed with other columns, the selection follows the names, not the positions. The right list only shows the first three rows: toggling there keeps the keys it cannot see, select all and deselect all replace the whole selection. The buttons write the state like app code would",
  );
  //#region selection_shared_through_a_state
  const rows = state.ok_w(sel_tree(6, 0));
  const shared = sel_state();
  controls(sec, {
    "Write 1, 3 and 5": () => void shared.write([1, 3, 5]),
    "Write none": () => void shared.write([]),
    "Remove first": () => rows.set_ok(rows.ok().slice(1)),
    Reset: () => rows.set_ok(sel_tree(6, 0)),
  });
  const other = (title: string, rows: State<SelItem[]>) =>
    list.container(
      {
        transform: (item: SelItem) =>
          ok({
            selectable: item.id % 10 !== 2,
            values: { id: item.id, upper: word(item.id).toUpperCase() },
          }),
        selection: { mode: "multi", key: (item) => item.id },
      },
      {
        columns: {
          id: list.column({
            title: "Id",
            field_apply: (field, v: number) => (field.text = v.toString()),
            field_gen: () => list.text_field(),
          }),
          upper: list.column_string(title),
        },
        rows,
        selected: shared,
      },
    );
  const r = row(sec);
  box(r, "names", { width: "14rem" }).appendChild(
    sel_list(rows, "multi", shared),
  );
  box(r, "reversed, other columns", { width: "14rem" }).appendChild(
    other(
      "Upper",
      rows.proxy_map((r) => [...r].reverse()),
    ),
  );
  box(r, "first three rows", { width: "14rem" }).appendChild(
    other(
      "Upper",
      rows.proxy_map((r) => r.slice(0, 3)),
    ),
  );
  sel_show(sec, shared);
  //#endregion
  code(sec, source, "selection_shared_through_a_state", "sel_list", "words");
}

{
  const sec = section(
    "Selection of many rows",
    "Press the button for 10000 rows, then ctrl+a with focus in the list, click a row and shift click far below. How fast do selecting and clearing feel. Toggling one checkbox writes one push or delete to the state, so only that row changes",
  );
  //#region selection_of_many_rows
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
  //#endregion
  code(sec, source, "selection_of_many_rows", "sel_list", "words");
}
