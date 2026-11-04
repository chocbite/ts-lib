import { array_from_length } from "@chocbite/ts-lib/common";
import ctm from "#context-menu";
import { material_add_to_queue_rounded } from "#icons";
import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import list from ".";

const st_rows = state.ok_w(array_from_length(10, (i) => i));

const test_list = list.container(
  {
    col1: list.column({
      init_width: 15,
      title: "Column 1, the one and only, the best, the biggest",
      field_apply: (field, v: number) => (field.text = v.toString()),
      field_gen: () => list.text_field(),
    }),
    col2: list.column({
      title: "Column 2",
      field_apply: (field, v: number) =>
        (field.text = (v * Math.random()).toFixed(2)),
      field_gen: () => list.text_field(),
    }),
    col3: list.column({
      fixed_width: "min",
      title: "Remove",
      field_apply: (field, v: () => ReturnType<typeof st_rows.write>) => {
        field.node.onclick = async () => {
          (await v()).map_err((err) => window.prompt(err));
        };
      },
      field_gen: () => {
        const butt = document.createElement("button");
        butt.textContent = "Remove";
        return list.node_field(butt);
      },
    }),
  },
  (item, row, stat) => {
    const sub_rows = state.rosw(
      state.a.help(ok(array_from_length(3, (i) => i))),
      true,
    );
    const add_row =
      Math.random() > 0.5
        ? {
            disabled: state.p.ros(sub_rows.related().value.length, (len) =>
              ok(len.value >= 3),
            ).state,
            text: "Add New Row",
            on_add: () => sub_rows.write(state.a.write.push(Math.random())),
          }
        : undefined;
    return {
      openable: Math.random() > 0.5,
      key_field: {
        icon: Math.random() > 0.5 ? material_add_to_queue_rounded : undefined,
      },
      sub_rows: () => sub_rows,
      add_row,
      values: {
        col1: item,
        col2: item,
        col3: () => stat.write(state.a.write.splice(row.index, 1)),
      },
      context_menu: ctm.menu([
        ctm.line("Remove", () =>
          stat.write(state.a.write.splice(row.index, 1)),
        ),
        ctm.line("Add New Row", () =>
          stat.write(state.a.write.splice(row.index, 0, Math.random())),
        ),
        ctm.line("Empty", () => stat.write(state.a.write.fresh([]))),
      ]),
    };
  },
  st_rows,
  {
    sub_rows: true,
    add_row: {
      text: "Add Row",
      on_add: () => {
        st_rows.array.push(st_rows.array.get.length);
      },
    },
  },
);
document.body.appendChild(test_list);

const refresh = document.createElement("button");
refresh.textContent = "Refresh";
refresh.onclick = () =>
  st_rows.set_ok(
    array_from_length(Math.floor(Math.random() * 7) + 3, (i) => i),
  );
document.body.appendChild(refresh);

const test_list2 = list.container(
  {
    col1: list.column({
      init_width: 15,
      title: "Column 1, the one and only, the best, the biggest",
      field_apply: (field, v: number) => (field.text = v.toString()),
      field_gen: () => list.text_field(),
    }),
    col2: list.column({
      title: "Column 2",
      field_apply: (field, v: number) =>
        (field.text = (v * Math.random()).toFixed(2)),
      field_gen: () => list.text_field(),
    }),
    col3: list.column({
      fixed_width: "min",
      title: "Remove",
      field_apply: (field, v: () => ReturnType<typeof st_rows.write>) => {
        field.node.onclick = async () => {
          (await v()).map_err((err) => window.prompt(err));
        };
      },
      field_gen: () => {
        const butt = document.createElement("button");
        butt.textContent = "Remove";
        return list.node_field(butt);
      },
    }),
  },
  (item, row, stat) => {
    const sub_rows = state.rosw(
      state.a.help(ok(array_from_length(3, (i) => i))),
      true,
    );
    const add_row =
      Math.random() > 0.5
        ? {
            disabled: state.p.ros(sub_rows.related().value.length, (len) =>
              ok(len.value >= 3),
            ).state,
            text: "Add New Row",
            on_add: () => sub_rows.write(state.a.write.push(Math.random())),
          }
        : undefined;
    return {
      openable: Math.random() > 0.5,
      key_field: {
        icon: Math.random() > 0.5 ? material_add_to_queue_rounded : undefined,
      },
      sub_rows: () => sub_rows,
      add_row,
      values: {
        col1: item,
        col2: item,
        col3: () => stat.write(state.a.write.splice(row.index, 1)),
      },
      context_menu: ctm.menu([
        ctm.line("Remove", () =>
          stat.write(state.a.write.splice(row.index, 1)),
        ),
        ctm.line("Add New Row", () =>
          stat.write(state.a.write.splice(row.index, 0, Math.random())),
        ),
        ctm.line("Empty", () => stat.write(state.a.write.fresh([]))),
      ]),
    };
  },
  st_rows,
  {
    sub_rows: true,
    add_row: {
      text: "Add Row",
      on_add: () => {
        st_rows.array.push(st_rows.array.get.length);
      },
    },
  },
);
document.body.appendChild(test_list2);

const test_list3 = list.container(
  {
    col1: list.column_string("Column 1"),
  },
  (item) => {
    const sub_rows = state.rosw(
      state.a.help(ok(array_from_length(3, (i) => i))),
      true,
    );
    const add_row =
      Math.random() > 0.5
        ? {
            disabled: state.p.ros(sub_rows.related().value.length, (len) =>
              ok(len.value >= 3),
            ).state,
            text: "Add New Row",
            on_add: () => sub_rows.write(state.a.write.push(Math.random())),
          }
        : undefined;
    return {
      openable: Math.random() > 0.5,
      key_field: {
        icon: Math.random() > 0.5 ? material_add_to_queue_rounded : undefined,
      },
      add_row,
      values: {
        col1: item.toString(),
      },
    };
  },
  st_rows,
  {
    headless: true,
    add_row: {
      text: "Add Row",
      on_add: () => st_rows.array.push(st_rows.array.get.length),
    },
  },
);
document.body.appendChild(test_list3);
