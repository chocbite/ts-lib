import { theme_init } from "#theme";
import { ok, NiceError } from "@chocbite/ts-lib/result";
import { state, type State } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import list from "..";
import { ListKeyField, type ListKeyFieldOptions } from "../key_field";
import type { ListRow } from "../row";
import { ListAddRow } from "../add_row";

/**A test error whose nice text is its message, so shown texts read as before*/
const nice_err = (text: string) => new NiceError(Symbol(text), text);

//The lines are sized by theme variables
theme_init();

afterEach(() => {
  document.body.replaceChildren();
});

interface Item {
  name: string;
  tall?: boolean;
  sub?: Item[];
  key_field?: ListKeyFieldOptions;
}

/**List where a tall item gets a field far higher than the minimum row height */
function tree(items: Item[]) {
  const container = list.container(
    {
      transform: (item: Item) =>
        ok({
          openable: Boolean(item.sub),
          key_field: item.key_field,
          sub_rows: () => item.sub ?? [],
          values: { name: item },
        }),
      sub_rows: true,
    },
    {
      columns: {
        name: list.column({
          title: "Name",
          field_gen: () => list.node_field(document.createElement("div")),
          field_apply: (field, item: Item) => {
            field.node.textContent = item.name;
            field.node.style.height = item.tall ? "6rem" : "";
          },
        }),
      },
      rows: items,
    },
  );
  document.body.append(container);
  return container;
}

function key_fields(container: HTMLElement): ListKeyField<any>[] {
  return [
    ...container.querySelectorAll("list-keyfield"),
  ] as ListKeyField<any>[];
}

function opener(key: ListKeyField<any>): HTMLElement {
  return key.querySelector(":scope > span:not(.text)")!;
}

/**Distance from the top of the element to its horizontal line drawn by a bottom border of the pseudo element */
function line_y(element: Element, pseudo: "::after") {
  return parseFloat(getComputedStyle(element, pseudo).height);
}

describe("List key field lines", () => {
  it("centers the horizontal lines in a row taller than the minimum", () => {
    const container = tree([{ name: "a", tall: true }, { name: "b" }]);
    const [tall, normal] = key_fields(container);
    expect(tall.offsetHeight).toBeGreaterThan(normal.offsetHeight * 2);
    for (const key of [tall, normal]) {
      expect(line_y(key, "::after")).toBeCloseTo(key.clientHeight / 2, 0);
      expect(line_y(opener(key), "::after")).toBeCloseTo(
        opener(key).clientHeight / 2,
        0,
      );
    }
  });

  it("ends the vertical line of the last row in its middle", () => {
    const container = tree([{ name: "a" }, { name: "b", tall: true }]);
    const last = opener(key_fields(container)[1]);
    expect(parseFloat(getComputedStyle(last, "::before").height)).toBeCloseTo(
      last.clientHeight / 2,
      0,
    );
  });

  it("draws a line from an open row down to the line of its sub rows", () => {
    const container = tree([
      { name: "a", sub: [{ name: "a1", sub: [{ name: "a11" }] }] },
    ]);
    const [parent] = key_fields(container);
    expect(getComputedStyle(parent).backgroundImage).toBe("none");

    parent.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    const child = key_fields(container)[1];
    child.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    const grand_child = key_fields(container)[2];

    for (const [key, sub] of [
      [parent, child],
      [child, grand_child],
    ]) {
      const style = getComputedStyle(key);
      expect(style.backgroundImage).not.toBe("none");
      //The line covers the lower half
      expect(style.backgroundPositionY).toBe("100%");
      expect(style.backgroundSize).toBe("1px 50%");
      //At the vertical line of the sub row, the right border of its half wide opener line
      const sub_opener = opener(sub).getBoundingClientRect();
      const sub_line =
        sub_opener.left +
        parseFloat(getComputedStyle(opener(sub), "::before").width);
      const line =
        key.getBoundingClientRect().left +
        parseFloat(style.backgroundPositionX);
      expect(line).toBeCloseTo(sub_line, 0);
    }

    //Closing removes the line
    parent.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(getComputedStyle(parent).backgroundImage).toBe("none");
  });

  it("keeps the indent and opener sizes in a key column narrower than its content", () => {
    const container = tree([{ name: "a", sub: [{ name: "a1" }] }]);
    const [parent] = key_fields(container);
    parent.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    const child = key_fields(container)[1];
    const width = opener(child).offsetWidth;
    (container.firstElementChild as HTMLElement).style.gridTemplateColumns =
      "1rem auto";
    expect(opener(child).offsetWidth).toBe(width);
  });

  it("covers the line down to the sub rows with the icon and text, and shows it below them in a tall row", () => {
    const icon = () => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      return svg;
    };
    const container = tree([
      {
        name: "a",
        tall: true,
        key_field: { icon, text: "Text" },
        sub: [{ name: "a1" }],
      },
    ]);
    const [parent] = key_fields(container);
    parent.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    const background = getComputedStyle(parent).backgroundColor;
    for (const element of [
      parent.querySelector("svg")!,
      parent.querySelector(":scope > span.text")!,
    ]) {
      expect(getComputedStyle(element).backgroundColor).toBe(background);
      const rect = element.getBoundingClientRect();
      const key = parent.getBoundingClientRect();
      expect(rect.bottom).toBeLessThan(key.bottom - key.height / 4);
      expect(rect.top + rect.height / 2).toBeCloseTo(
        key.top + key.height / 2,
        0,
      );
    }
  });
});

describe("List key field lines of an error instead of rows", () => {
  /**Vertical line of the error, full height when the line continues below, half when it ends in the middle */
  function error_line(container: HTMLElement) {
    const key = container.querySelector<HTMLElement>(
      "list-rowserror > list-keyfield",
    )!;
    const line = parseFloat(
      getComputedStyle(opener(key as ListKeyField<any>), "::before").height,
    );
    return line / opener(key as ListKeyField<any>).clientHeight;
  }
  function errored(add: boolean, sub: boolean) {
    const rows = state.from_w<string[]>(["a"]);
    const sub_rows = state.from_w<string[]>(["b"]);
    const container = list.container(
      {
        transform: (name: string) =>
          ok({
            openable: name === "a",
            opened: true,
            sub_rows: () => sub_rows,
            add_row:
              sub && add ? { text: "Add sub", on_add: () => {} } : undefined,
            values: { name },
          }),
        sub_rows: true,
      },
      {
        columns: { name: list.column_string("Name") },
        rows,
        add_row: !sub && add ? { text: "Add", on_add: () => {} } : undefined,
      },
    );
    document.body.append(container);
    (sub ? sub_rows : rows).set_err(nice_err("broken"));
    return container;
  }

  it("continues the line down to the add row after the error", () => {
    expect(error_line(errored(true, false))).toBeCloseTo(1, 1);
  });

  it("continues the line down to the add row of the parent after the error of its sub rows", () => {
    expect(error_line(errored(true, true))).toBeCloseTo(1, 1);
  });

  it("ends the line in the middle of the error without an add row", () => {
    expect(error_line(errored(false, false))).toBeCloseTo(0.5, 1);
    document.body.replaceChildren();
    expect(error_line(errored(false, true))).toBeCloseTo(0.5, 1);
  });
});

describe("List rows across levels", () => {
  interface Node {
    name: string;
    sub?: Node[];
    add?: boolean;
  }
  /**A tree with every row open, the add row options of a node add a row below its sub rows */
  function open_tree(
    rows: Node[] | State<Node[]>,
    options: { add_row?: boolean; search?: string } = {},
  ) {
    const container = list.container(
      {
        transform: (node: Node) =>
          ok({
            openable: Boolean(node.sub),
            opened: true,
            sub_rows: () => node.sub ?? [],
            add_row: node.add ? { text: "Add", on_add: () => {} } : undefined,
            key_field: { text: node.name },
            values: { name: node.name },
          }),
        sub_rows: true,
        search_delay: 0,
      },
      {
        columns: { name: list.column_string("Name") },
        rows,
        add_row: options.add_row ? { text: "Add", on_add: () => {} } : null,
        search: options.search,
      },
    );
    document.body.append(container);
    return container;
  }
  const row_named = (container: HTMLElement, name: string) =>
    [
      ...container.querySelectorAll<ListRow<any, any, any, any>>("list-row"),
    ].find((row) => row.label === name)!;
  /**Whether the indent line of the level shows in the key field of the row, it is transparent where the line ended above */
  const indent_line = (container: HTMLElement, name: string, level: number) => {
    const key = row_named(container, name).querySelector("list-keyfield")!;
    const indent = [...key.children].filter((e) => e.tagName === "DIV")[level];
    return getComputedStyle(indent).borderRightColor !== "rgba(0, 0, 0, 0)";
  };
  const name_cell_background = (container: HTMLElement, name: string) =>
    getComputedStyle(
      row_named(container, name).querySelector(":scope > div > :last-child")!,
    ).backgroundColor;

  it("alternates the backgrounds over the rows in the order they are shown, sub rows included", () => {
    const container = open_tree([
      {
        name: "a",
        sub: [{ name: "a1" }, { name: "a2", sub: [{ name: "a21" }] }],
      },
      { name: "b" },
    ]);
    const order = ["a", "a1", "a2", "a21", "b"];
    expect(
      [...container.querySelectorAll<ListRow<any, any, any, any>>("list-row")]
        .filter((row) => row.anchor?.checkVisibility())
        .map((row) => row.label),
    ).toEqual(order);
    for (let i = 1; i < order.length; i++)
      expect(name_cell_background(container, order[i])).not.toBe(
        name_cell_background(container, order[i - 1]),
      );
  });

  it("runs the line of a level on past the sub rows of a row with rows after it, and ends it below the last", () => {
    const container = open_tree([
      { name: "a", sub: [{ name: "a1", sub: [{ name: "a11" }] }] },
      { name: "b", sub: [{ name: "b1", sub: [{ name: "b11" }] }] },
    ]);
    expect(indent_line(container, "a11", 0)).toBe(true);
    expect(indent_line(container, "a11", 1)).toBe(false);
    expect(indent_line(container, "b11", 0)).toBe(false);
    expect(indent_line(container, "b11", 1)).toBe(false);
  });

  it("runs the line on to the add row below the last row", () => {
    const container = open_tree(
      [{ name: "a", add: true, sub: [{ name: "a1", sub: [{ name: "a11" }] }] }],
      { add_row: true },
    );
    expect(indent_line(container, "a11", 0)).toBe(true);
    expect(indent_line(container, "a11", 1)).toBe(true);
  });

  it("ends the line below a row that becomes the last when the rows after it are removed", () => {
    const rows = state.ok_w<Node[]>([
      { name: "a", sub: [{ name: "a1" }] },
      { name: "b" },
    ]);
    const container = open_tree(rows);
    expect(indent_line(container, "a1", 0)).toBe(true);
    rows.array.pop();
    expect(indent_line(container, "a1", 0)).toBe(false);
    rows.array.push({ name: "c" });
    expect(indent_line(container, "a1", 0)).toBe(true);
  });

  it("ends the line below the last row the search shows", () => {
    const container = open_tree(
      [{ name: "ax", sub: [{ name: "ax1" }] }, { name: "b" }],
      { search: "x" },
    );
    expect(indent_line(container, "ax1", 0)).toBe(false);
  });

  it("keeps the sub rows, error and add row after their row when rows are moved, added and removed", () => {
    const rows = state.ok_w<Node[]>([
      { name: "a", add: true, sub: [{ name: "a1" }, { name: "a2" }] },
      { name: "b" },
    ]);
    const container = open_tree(rows);
    /**The rows and add rows in the row box, in order */
    const order = () =>
      [
        ...container.querySelectorAll<HTMLElement>(
          ":scope > div > div > list-row, :scope > div > div > list-addrow",
        ),
      ].map((element) =>
        element instanceof ListAddRow
          ? "add"
          : (element as ListRow<any, any, any, any>).label,
      );
    expect(order()).toEqual(["a", "a1", "a2", "add", "b"]);
    rows.array.move(0, 1);
    expect(order()).toEqual(["b", "a", "a1", "a2", "add"]);
    rows.array.unshift({ name: "c", sub: [{ name: "c1" }] });
    expect(order()).toEqual(["c", "c1", "b", "a", "a1", "a2", "add"]);
    rows.array.splice(1, 1, { name: "d" });
    expect(order()).toEqual(["c", "c1", "d", "a", "a1", "a2", "add"]);
    rows.array.shift();
    expect(order()).toEqual(["d", "a", "a1", "a2", "add"]);
    rows.set_ok([{ name: "e" }]);
    expect(order()).toEqual(["e"]);
  });

  it("hides the add row of a row the search hides, with the row", () => {
    const container = open_tree(
      [{ name: "a", add: true, sub: [{ name: "a1" }] }, { name: "bx" }],
      { search: "x" },
    );
    expect(
      [...container.querySelectorAll<HTMLElement>("list-addrow span.add")].map(
        (add) => add.checkVisibility(),
      ),
    ).toEqual([false]);
  });
});
