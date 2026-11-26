import list from "@chocbite/ts-lib-ui/list";
import { err, ok, type Option } from "@chocbite/ts-lib/result";
import state, { type StateROSW } from "@chocbite/ts-lib/state";
import { box, controls, row, section, demo_error } from "../../../helpers";

//      _____  ______ ____  _____  _____  ______ _____
//     |  __ \|  ____/ __ \|  __ \|  __ \|  ____|  __ \
//     | |__) | |__ | |  | | |__) | |  | | |__  | |__) |
//     |  _  /|  __|| |  | |  _  /| |  | |  __| |  _  /
//     | | \ \| |___| |__| | | \ \| |__| | |____| | \ \
//     |_|  \_\______\____/|_|  \_\_____/|______|_|  \_\

interface DragNode {
  name: string;
  /**Folders have children, files do not */
  children?: StateROSW<DragNode[], Option<{}>, DragNode[]>;
}

const drag_file = (name: string): DragNode => ({ name });
const drag_folder = (name: string, children: DragNode[]): DragNode => ({
  name,
  children: state.ok_w(children),
});
const drag_tree = () =>
  state.ok_w([
    drag_folder("Documents", [
      drag_file("letter.txt"),
      drag_file("notes.md"),
      drag_folder("Old", [drag_file("2019.txt"), drag_file("2020.txt")]),
    ]),
    drag_folder("Pictures", [drag_file("cat.png"), drag_file("dog.png")]),
    drag_file("readme.md"),
    drag_file("todo.txt"),
    drag_file("budget.xlsx"),
  ]);

/**Shows the names of the rows state as an indented tree under the list */
function drag_show(
  parent: HTMLElement,
  rows: StateROSW<DragNode[], Option<{}>, DragNode[]>,
) {
  const text = parent.appendChild(document.createElement("pre"));
  text.style.fontSize = "0.8rem";
  const lines = (nodes: readonly DragNode[], depth: number): string[] =>
    nodes.flatMap((n) => [
      "  ".repeat(depth) + n.name,
      ...(n.children ? lines(n.children.ok(), depth + 1) : []),
    ]);
  const show = () => (text.textContent = lines(rows.ok(), 0).join("\n"));
  //Sub row states change without the top state, so the text is refreshed on a timer
  rows.sub(show, true);
  setInterval(show, 500);
}

function drag_list(
  rows: StateROSW<DragNode[], Option<{}>, DragNode[]> | DragNode[],
  options: {
    group?: ReturnType<typeof list.drag_group<DragNode>>;
    multi?: boolean;
    no_remove?: boolean;
  } = {},
) {
  return list.container(
    {
      transform: (node: DragNode) =>
        ok({
          openable: Boolean(node.children),
          sub_rows: () => node.children ?? [],
          values: { name: node.name },
        }),
      sub_rows: true,
      reorder: {
        group: options.group,
        no_remove: options.no_remove,
        //Only folders take rows, and nothing goes into "Pictures" but pictures
        can_drop: (data, target) =>
          target.parent?.name !== "Pictures" || data.name.endsWith(".png"),
      },
      selection: options.multi
        ? { mode: "multi", key: (node) => node.name }
        : undefined,
    },
    {
      columns: { name: list.column_string("Name", { align: "left" }) },
      rows,
    },
  );
}

{
  const sec = section(
    "Reorder",
    "Drag the grip in front of a row. A line shows where it goes, the middle of a folder drops into it, hovering into a closed folder opens it after a moment. Escape cancels. Alt+arrow up/down moves the focused row. Pictures only takes .png files. The text under the list is the state, the list only writes moves to it. Check touch mode, the grip should drag and the rest of the list should still scroll",
  );
  const r = row(sec);
  const rows = drag_tree();
  const b = box(r, "folders", {
    width: "18rem",
    height: "20rem",
    display: "grid",
  });
  b.appendChild(drag_list(rows));
  drag_show(box(r, "state"), rows);
  controls(sec, { Reset: () => location.reload() });
}

{
  const sec = section(
    "Reorder selected rows",
    "Select rows with the checkboxes, then drag one of them: all selected rows move together and keep their order, rows next to each other move with one write. Dragging a row that is not selected moves only that row",
  );
  const r = row(sec);
  const rows = drag_tree();
  const b = box(r, "multi", {
    width: "20rem",
    height: "20rem",
    display: "grid",
  });
  b.appendChild(drag_list(rows, { multi: true }));
  drag_show(box(r, "state"), rows);
}

{
  const sec = section(
    "Reorder between lists",
    "The first two lists are in one drag group and give rows to each other. The third list is not in the group, nothing goes in or out of it. The fourth list has a plain array, so it has no grips",
  );
  const r = row(sec);
  const group = list.drag_group<DragNode>();
  const left = drag_tree();
  const right = state.ok_w([
    drag_file("inbox.txt"),
    drag_folder("Archive", []),
  ]);
  box(r, "group A", {
    width: "14rem",
    height: "16rem",
    display: "grid",
  }).appendChild(drag_list(left, { group }));
  box(r, "group A", {
    width: "14rem",
    height: "16rem",
    display: "grid",
  }).appendChild(drag_list(right, { group }));
  box(r, "no group", {
    width: "14rem",
    height: "16rem",
    display: "grid",
  }).appendChild(drag_list(drag_tree()));
  box(r, "plain array", {
    width: "14rem",
    height: "16rem",
    display: "grid",
  }).appendChild(drag_list([drag_file("fixed.txt"), drag_file("rows.txt")]));
}

{
  const sec = section(
    "Reorder between lists, the app removes",
    "Like an app that takes a row out of one list itself when it is added to the other. The lists have no_remove, so they only insert and the app removes, a row moved between the top levels is gone from the first list once. Without no_remove both would remove and a second row would disappear",
  );
  const r = row(sec);
  const group = list.drag_group<DragNode>();
  const left = state.ok_w([
    drag_file("a.txt"),
    drag_file("b.txt"),
    drag_file("c.txt"),
  ]);
  const right = state.ok_w([drag_file("d.txt"), drag_file("e.txt")]);
  //The app logic, a row added to one list is removed from the other
  const take_out = (from: typeof left, to: typeof left) => {
    to.sub(() => {
      const added = new Set(to.ok());
      const index = from.ok().findIndex((node) => added.has(node));
      if (index >= 0) void from.write(state.a.write.splice(index, 1));
    });
  };
  take_out(left, right);
  take_out(right, left);
  box(r, "left", {
    width: "14rem",
    height: "12rem",
    display: "grid",
  }).appendChild(drag_list(left, { group, no_remove: true }));
  box(r, "right", {
    width: "14rem",
    height: "12rem",
    display: "grid",
  }).appendChild(drag_list(right, { group, no_remove: true }));
  drag_show(box(r, "left state"), left);
  drag_show(box(r, "right state"), right);
}

{
  const sec = section(
    "Reorder rejected",
    "The rows state rejects every write, a drag shows the reason at the row and nothing moves. The same goes for alt+arrow",
  );
  const rows = state.rosw<DragNode[]>(
    ok([drag_file("one.txt"), drag_file("two.txt"), drag_file("three.txt")]),
    () => Promise.resolve(err(demo_error("Rejected", "This list is locked"))),
  );
  box(sec, "locked", { width: "16rem" }).appendChild(drag_list(rows));
}
