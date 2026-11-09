import type { ContextMenu } from "#context-menu";
import type { SVGFunc } from "#svg";
import { none, ok, type Option } from "@chocbite/ts-lib/result";
import { state, type State } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import list from ".";
import { ListAddRow, type ListAddRowOptions } from "./add_row";
import { ListField } from "./field";
import { ListKeyField } from "./key_field";
import { ListRow } from "./row";

type Row = ListRow<number, { col: string }, number[], true>;
type AnyRow = ListRow<any, any, any, any>;

function create_list(sub_rows: () => number[] | State<number[]>): Row {
  let top_row: Row | undefined;
  document.body.append(
    list.container(
      { col: list.column_string("Column") },
      (item, row) => {
        if (row.depth === 0) top_row = row;
        return {
          openable: row.depth === 0,
          sub_rows,
          values: { col: item.toString() },
        };
      },
      [1],
      { sub_rows: true },
    ),
  );
  return top_row!;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("ListRow open", () => {
  it("adds open class when sub rows are an array", () => {
    const row = create_list(() => [10, 11]);
    row.open = true;
    expect(row.amount_rows()).toBe(2);
    expect(row.classList.contains("open")).toBe(true);
    expect(row.open).toBe(true);
  });

  it("adds open class when sub rows are a sync state", () => {
    const row = create_list(() => state.ok([10, 11]));
    row.open = true;
    expect(row.amount_rows()).toBe(2);
    expect(row.classList.contains("open")).toBe(true);
    expect(row.open).toBe(true);
  });

  it("adds open class when sub rows are an async state", async () => {
    const row = create_list(() => state.roa(async () => ok([10, 11])));
    row.open = true;
    await expect.poll(() => row.amount_rows()).toBe(2);
    expect(row.classList.contains("open")).toBe(true);
    expect(row.open).toBe(true);
  });
});

//      _    _ ______ _      _____  ______ _____   _____
//     | |  | |  ____| |    |  __ \|  ____|  __ \ / ____|
//     | |__| | |__  | |    | |__) | |__  | |__) | (___
//     |  __  |  __| | |    |  ___/|  __| |  _  / \___ \
//     | |  | | |____| |____| |    | |____| | \ \ ____) |
//     |_|  |_|______|______|_|    |______|_|  \_\_____/

interface Item {
  name: string;
  openable?: boolean | State<boolean>;
  opened?: boolean;
  sub?: () => Item[] | State<Item[]>;
  icon?: SVGFunc | State<SVGFunc>;
  add_row?: ListAddRowOptions;
  menu?: () => Option<ContextMenu>;
}

/**Item with two openable sub items named name+"1" and name+"2", recursively */
function tree(name: string): Item {
  return {
    name,
    openable: true,
    sub: () => [tree(name + "1"), tree(name + "2")],
  };
}

function item_list(rows: Item[] | State<Item[]>) {
  const transform = vi.fn((item: Item, _row: unknown, _rows: unknown) => ({
    openable: item.openable,
    opened: item.opened,
    sub_rows: item.sub,
    key_field: { icon: item.icon },
    add_row: item.add_row,
    context_menu: item.menu,
    values: { name: item.name },
  }));
  const container = list.container(
    { name: list.column_string("Name") },
    transform,
    rows,
    { sub_rows: true },
  );
  document.body.append(container);
  return { container, transform };
}

function sub_rows_of(row: AnyRow): AnyRow[] {
  return [...row.children[1].children] as AnyRow[];
}

function name_of(row: Element): string {
  return [...row.firstElementChild!.children]
    .filter((e) => e instanceof ListField)
    .map((e) => e.textContent)
    .join();
}

function names(rows: AnyRow[]): string[] {
  return rows.map(name_of);
}

/**Finds any rendered row by its name */
function find(container: HTMLElement, name: string): AnyRow {
  const row = [...container.querySelectorAll("*")].find(
    (e) => e instanceof ListRow && name_of(e) === name,
  );
  if (!row) throw new Error("Row not found " + name);
  return row as AnyRow;
}

function key_field_of(row: AnyRow): ListKeyField<any> {
  return row.firstElementChild!.firstElementChild as ListKeyField<any>;
}

function press(element: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
  return event;
}

function focused_name(): string | undefined {
  const active = document.activeElement;
  if (!(active instanceof ListKeyField)) return undefined;
  return name_of(active.parentElement!.parentElement!);
}

function svg_icon(id: string): SVGFunc {
  return () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = id;
    return svg;
  };
}

function icon_id(row: AnyRow): string | undefined {
  return key_field_of(row).querySelector("svg")?.id;
}

describe("ListRow keyboard navigation", () => {
  it("moves focus to the next and previous row with the arrow keys", () => {
    const { container } = item_list([tree("a"), tree("b"), tree("c")]);
    key_field_of(find(container, "a")).focus();
    press(document.activeElement as HTMLElement, "ArrowDown");
    expect(focused_name()).toBe("b");
    press(document.activeElement as HTMLElement, "ArrowDown");
    expect(focused_name()).toBe("c");
    press(document.activeElement as HTMLElement, "ArrowUp");
    expect(focused_name()).toBe("b");
  });

  it("keeps focus at the first and last row", () => {
    const { container } = item_list([tree("a"), tree("b")]);
    key_field_of(find(container, "b")).focus();
    press(document.activeElement as HTMLElement, "ArrowDown");
    expect(focused_name()).toBe("b");
    key_field_of(find(container, "a")).focus();
    press(document.activeElement as HTMLElement, "ArrowUp");
    expect(focused_name()).toBe("a");
  });

  it("enters the sub rows of an open row and leaves them again", () => {
    const { container } = item_list([tree("a"), tree("b")]);
    find(container, "a").open = true;
    key_field_of(find(container, "a")).focus();
    press(document.activeElement as HTMLElement, "ArrowDown");
    expect(focused_name()).toBe("a1");
    press(document.activeElement as HTMLElement, "ArrowDown");
    expect(focused_name()).toBe("a2");
    press(document.activeElement as HTMLElement, "ArrowDown");
    expect(focused_name()).toBe("b");
    press(document.activeElement as HTMLElement, "ArrowUp");
    expect(focused_name()).toBe("a2");
    press(document.activeElement as HTMLElement, "ArrowUp");
    expect(focused_name()).toBe("a1");
    press(document.activeElement as HTMLElement, "ArrowUp");
    expect(focused_name()).toBe("a");
  });

  it("moves up into the deepest last visible row and down out of it", () => {
    const { container } = item_list([tree("a"), tree("b")]);
    find(container, "a").open = true;
    find(container, "a2").open = true;
    find(container, "a22").open = true;
    key_field_of(find(container, "b")).focus();
    press(document.activeElement as HTMLElement, "ArrowUp");
    expect(focused_name()).toBe("a222");
    press(document.activeElement as HTMLElement, "ArrowDown");
    expect(focused_name()).toBe("b");
  });

  it("does not move focus out of the last row when its parents are last", () => {
    const { container } = item_list([tree("a")]);
    find(container, "a").open = true;
    find(container, "a2").open = true;
    key_field_of(find(container, "a22")).focus();
    press(document.activeElement as HTMLElement, "ArrowDown");
    expect(focused_name()).toBe("a22");
  });

  it("opens and closes with Enter, Space and the left and right arrows", () => {
    const { container } = item_list([tree("a")]);
    const row = find(container, "a");
    const key = key_field_of(row);
    expect(press(key, "Enter").defaultPrevented).toBe(true);
    expect(row.open).toBe(true);
    expect(names(sub_rows_of(row))).toEqual(["a1", "a2"]);
    press(key, "Enter");
    expect(row.open).toBe(false);
    expect(sub_rows_of(row)).toHaveLength(0);
    press(key, " ");
    expect(row.open).toBe(true);
    press(key, " ");
    expect(row.open).toBe(false);
    press(key, "ArrowRight");
    expect(row.open).toBe(true);
    press(key, "ArrowRight");
    expect(row.open).toBe(true);
    press(key, "ArrowLeft");
    expect(row.open).toBe(false);
    press(key, "ArrowLeft");
    expect(row.open).toBe(false);
  });

  it("does not prevent default for unhandled keys", () => {
    const { container } = item_list([tree("a")]);
    expect(press(key_field_of(find(container, "a")), "a").defaultPrevented).toBe(
      false,
    );
  });

  it("toggles the row when the opener is clicked without propagating", () => {
    const { container } = item_list([tree("a")]);
    const row = find(container, "a");
    const opener = key_field_of(row).querySelector(
      ":scope > span > div",
    ) as HTMLElement;
    const row_click = vi.fn();
    row.addEventListener("click", row_click);
    opener.click();
    expect(row.open).toBe(true);
    opener.click();
    expect(row.open).toBe(false);
    expect(row_click).not.toHaveBeenCalled();
  });

  it("indents the key field by the row depth", () => {
    const { container } = item_list([tree("a")]);
    find(container, "a").open = true;
    find(container, "a1").open = true;
    const indents = (row: AnyRow) =>
      [...key_field_of(row).children].filter((e) => e.tagName === "DIV")
        .length;
    expect(find(container, "a").depth).toBe(0);
    expect(find(container, "a11").depth).toBe(2);
    expect(indents(find(container, "a"))).toBe(0);
    expect(indents(find(container, "a1"))).toBe(1);
    expect(indents(find(container, "a11"))).toBe(2);
  });
});

describe("ListRow opening", () => {
  it("opens on creation when opened is set", () => {
    const { container } = item_list([{ ...tree("a"), opened: true }]);
    const row = find(container, "a");
    expect(row.open).toBe(true);
    expect(names(sub_rows_of(row))).toEqual(["a1", "a2"]);
  });

  it("can not be opened when not openable", () => {
    const { container } = item_list([{ ...tree("a"), openable: false }]);
    const row = find(container, "a");
    row.open = true;
    expect(row.open).toBe(false);
    expect(row.openable).toBe(false);
    expect(row.amount_rows()).toBe(0);
  });

  it("does not open when there are no sub rows", () => {
    const { container } = item_list([{ name: "a", openable: true }]);
    const row = find(container, "a");
    row.open = true;
    expect(row.open).toBe(false);
  });

  it("closes when openable is set false", () => {
    const { container } = item_list([tree("a")]);
    const row = find(container, "a");
    row.open = true;
    row.openable = false;
    expect(row.open).toBe(false);
    expect(row.amount_rows()).toBe(0);
    expect(key_field_of(row).classList.contains("openable")).toBe(false);
  });

  it("stops following the sub rows state when closed", () => {
    const sub = state.ok_w<Item[]>([{ name: "x" }]);
    const { container } = item_list([
      { name: "a", openable: true, sub: () => sub },
    ]);
    const row = find(container, "a");
    row.open = true;
    expect(sub.amount()).toBe(1);
    row.open = false;
    expect(sub.amount()).toBe(0);
    sub.array.push({ name: "y" });
    expect(row.open).toBe(false);
    expect(row.amount_rows()).toBe(0);
  });

  it("follows openable from a state", () => {
    const openable = state.from_w(false);
    const { container } = item_list([{ ...tree("a"), openable }]);
    const row = find(container, "a");
    expect(row.openable).toBe(false);
    openable.set_ok(true);
    expect(row.openable).toBe(true);
    row.open = true;
    expect(row.open).toBe(true);
    openable.set_ok(false);
    expect(row.open).toBe(false);
    openable.set_ok(true);
    row.open = true;
    openable.set_err("fail");
    expect(row.open).toBe(false);
    expect(row.openable).toBe(false);
  });

  it("opens on creation when opened is set and openable is a state", () => {
    const { container } = item_list([
      { ...tree("a"), openable: state.ok(true), opened: true },
    ]);
    const row = find(container, "a");
    expect(row.openable).toBe(true);
    expect(row.open).toBe(true);
  });

  it("becomes not openable when updated data sets openable false", () => {
    const rows = state.ok_w<Item[]>([tree("a")]);
    const { container } = item_list(rows);
    const row = find(container, "a");
    expect(row.openable).toBe(true);
    rows.array.change(0, { ...tree("a"), openable: false });
    expect(row.openable).toBe(false);
  });

  it("stops following an openable state when updated data gives a boolean", () => {
    const openable = state.ok_w(true);
    const rows = state.ok_w<Item[]>([{ ...tree("a"), openable }]);
    const { container } = item_list(rows);
    const row = find(container, "a");
    rows.array.change(0, { ...tree("a"), openable: false });
    openable.set_ok(false);
    openable.set_ok(true);
    expect(row.openable).toBe(false);
  });

  it("refreshes the sub rows of an open row when its data changes", () => {
    const rows = state.ok_w<Item[]>([tree("a")]);
    const { container } = item_list(rows);
    const row = find(container, "a");
    row.open = true;
    rows.array.change(0, { ...tree("b") });
    expect(name_of(row)).toBe("b");
    expect(row.open).toBe(true);
    expect(names(sub_rows_of(row))).toEqual(["b1", "b2"]);
  });

  it("closes an open row when its updated data has no sub rows", () => {
    const rows = state.ok_w<Item[]>([tree("a")]);
    const { container } = item_list(rows);
    const row = find(container, "a");
    row.open = true;
    rows.array.change(0, { name: "b", openable: true });
    expect(row.open).toBe(false);
    expect(row.amount_rows()).toBe(0);
  });
});

describe("ListRow sub rows from states", () => {
  function setup(init: string[]) {
    const sub = state.ok_w<Item[]>(init.map((name) => ({ name })));
    const { container, transform } = item_list([
      { name: "a", openable: true, opened: true, sub: () => sub },
    ]);
    const row = find(container, "a");
    return { sub, row, transform };
  }

  it("renders sub rows and passes the sub row state to the transformer", () => {
    const { sub, row, transform } = setup(["x", "y"]);
    expect(names(sub_rows_of(row))).toEqual(["x", "y"]);
    const call = transform.mock.calls.find((c) => c[0].name === "x")!;
    expect((call[1] as AnyRow).depth).toBe(1);
    expect(call[2]).toBe(sub);
    expect(row.state).toBe(sub);
  });

  it("follows push, unshift, pop, shift, splice, change and delete", () => {
    const { sub, row } = setup(["b", "c"]);
    sub.array.push({ name: "d" });
    sub.array.unshift({ name: "a" });
    expect(names(sub_rows_of(row))).toEqual(["a", "b", "c", "d"]);
    sub.array.pop();
    sub.array.shift();
    expect(names(sub_rows_of(row))).toEqual(["b", "c"]);
    sub.array.splice(1, 1, { name: "x" }, { name: "y" });
    expect(names(sub_rows_of(row))).toEqual(["b", "x", "y"]);
    sub.array.change(0, { name: "z" });
    expect(names(sub_rows_of(row))).toEqual(["z", "x", "y"]);
    sub.array.delete(sub.array.get[1]);
    expect(names(sub_rows_of(row))).toEqual(["z", "y"]);
  });

  it("removes the open class when the sub rows become empty and adds it back", () => {
    const { sub, row } = setup(["x"]);
    sub.array.pop();
    expect(row.open).toBe(false);
    sub.array.push({ name: "y" });
    expect(row.open).toBe(true);
    expect(names(sub_rows_of(row))).toEqual(["y"]);
  });

  it("moves a single sub row", () => {
    const { sub, row } = setup(["a", "b", "c"]);
    sub.array.move(0, 2);
    expect(names(sub_rows_of(row))).toEqual(["b", "c", "a"]);
  });

  it("moves multiple sub rows at once", () => {
    const { sub, row } = setup(["a", "b", "c", "d"]);
    sub.array.move(2, 0, 2);
    expect(names(sub_rows_of(row))).toEqual(["c", "d", "a", "b"]);
  });
});

describe("ListRow key field icon", () => {
  it("renders, replaces and removes the icon from the row data", () => {
    const rows = state.ok_w<Item[]>([{ name: "a", icon: svg_icon("one") }]);
    const { container } = item_list(rows);
    const row = find(container, "a");
    expect(icon_id(row)).toBe("one");
    rows.array.change(0, { name: "a", icon: svg_icon("two") });
    expect(icon_id(row)).toBe("two");
    expect(key_field_of(row).querySelectorAll("svg")).toHaveLength(1);
    rows.array.change(0, { name: "a" });
    expect(icon_id(row)).toBeUndefined();
  });

  it("follows an icon state", () => {
    const icon = state.ok_w(svg_icon("one"));
    const { container } = item_list([{ name: "a", icon }]);
    const row = find(container, "a");
    expect(icon_id(row)).toBe("one");
    icon.set_ok(svg_icon("two"));
    expect(icon_id(row)).toBe("two");
  });

  it("stops following an icon state when updated data gives a fixed icon", () => {
    const icon = state.ok_w(svg_icon("one"));
    const rows = state.ok_w<Item[]>([{ name: "a", icon }]);
    const { container } = item_list(rows);
    const row = find(container, "a");
    rows.array.change(0, { name: "a", icon: svg_icon("fixed") });
    expect(icon_id(row)).toBe("fixed");
    icon.set_ok(svg_icon("two"));
    expect(icon_id(row)).toBe("fixed");
  });
});

describe("ListRow add row", () => {
  it("adds, updates and removes an add row from the row data", () => {
    const on_add = vi.fn();
    const rows = state.ok_w<Item[]>([
      { name: "a", add_row: { text: "Add", on_add } },
    ]);
    const { container } = item_list(rows);
    const row = find(container, "a");
    const add = row.lastElementChild as ListAddRow<any, any, any, any>;
    expect(add).toBeInstanceOf(ListAddRow);
    expect(row.classList.contains("addrow")).toBe(true);
    expect(add.depth).toBe(1);
    expect(add.textContent).toBe("Add");
    (add.lastElementChild as HTMLElement).click();
    expect(on_add).toHaveBeenCalledOnce();

    rows.array.change(0, { name: "a", add_row: { text: "More", on_add } });
    expect(row.lastElementChild).toBe(add);
    expect(add.textContent).toBe("More");

    rows.array.change(0, { name: "a" });
    expect(row.querySelector(":scope > *:last-child")).not.toBeInstanceOf(
      ListAddRow,
    );
    expect(row.classList.contains("addrow")).toBe(false);
  });
});

describe("ListRow context menu", () => {
  it("does not summon the parent row context menu from a sub row without one", () => {
    const parent_menu = vi.fn(() => none());
    const { container } = item_list([
      {
        name: "a",
        openable: true,
        opened: true,
        sub: () => [{ name: "b" }],
        menu: parent_menu,
      },
    ]);
    find(container, "b").dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    expect(parent_menu).not.toHaveBeenCalled();
  });

  it("summons the sub row context menu instead of the parent one", () => {
    const parent_menu = vi.fn(() => none());
    const sub_menu = vi.fn(() => none());
    const { container } = item_list([
      {
        name: "a",
        openable: true,
        opened: true,
        sub: () => [{ name: "b", menu: sub_menu }],
        menu: parent_menu,
      },
    ]);
    find(container, "b").dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    expect(sub_menu).toHaveBeenCalledOnce();
    expect(parent_menu).not.toHaveBeenCalled();
  });
});
