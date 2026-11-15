import { theme_init } from "#theme";
import { err, ok, type Option } from "@chocbite/ts-lib/result";
import {
  state,
  STATE_ARRAY_WRITE_KEY,
  type StateROSW,
} from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import list from ".";
import type { ListDropTarget } from "./drag";
import type { ListRow } from "./row";

//Row sizes come from theme variables
theme_init();

afterEach(() => {
  document.body.replaceChildren();
});

type Rows = StateROSW<Node[], Option<{}>, Node[]>;

interface Node {
  id: number;
  children?: Rows;
}

type AnyRow = ListRow<any, any, any, any>;

const node = (id: number, children?: Node[]): Node => ({
  id,
  children: children ? state.ok_w(children) : undefined,
});
const nodes = (...ids: number[]) => state.ok_w(ids.map((id) => node(id)));
const ids = (rows: Rows) => rows.ok().map((n) => n.id);

function tree(
  rows: Node[] | Rows,
  options: {
    multi?: boolean;
    can_drop?: (data: Node, target: ListDropTarget<Node>) => boolean;
    group?: ReturnType<typeof list.drag_group<Node>>;
    no_remove?: boolean;
  } = {},
) {
  const container = list.container(
    { name: list.column_string("Name") },
    (data: Node) =>
      ok({
        openable: Boolean(data.children),
        sub_rows: () => data.children ?? [],
        values: { name: "n" + data.id },
      }),
    rows,
    {
      sub_rows: true,
      reorder: {
        can_drop: options.can_drop,
        group: options.group,
        no_remove: options.no_remove,
      },
      selection: options.multi
        ? { mode: "multi", key: (data) => data.id }
        : undefined,
    },
  );
  container.style.height = "30rem";
  document.body.append(container);
  return container;
}

function rows_of(container: HTMLElement): AnyRow[] {
  return [...container.querySelectorAll("list-row")] as AnyRow[];
}
function row_named(container: HTMLElement, name: string): AnyRow {
  return rows_of(container).find((row) => row.label === name)!;
}
function handle(row: AnyRow): HTMLElement {
  return row.querySelector(":scope > div > list-dragfield")!;
}
/**Point at a part of the height of the row, 0 is the top and 1 the bottom */
function at(row: AnyRow, part: number) {
  const rect = row.anchor!.getBoundingClientRect();
  return { x: rect.right + 20, y: rect.top + rect.height * part };
}
const frame = () => new Promise((r) => requestAnimationFrame(r));
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function pointer(target: HTMLElement, type: string, x: number, y: number) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      pointerId: 1,
      clientX: x,
      clientY: y,
    }),
  );
}

/**Drags the handle of the row to the point and drops, or only moves there without drop */
async function drag(
  row: AnyRow,
  to: { x: number; y: number },
  drop: boolean = true,
) {
  const grip = handle(row);
  const rect = grip.getBoundingClientRect();
  pointer(grip, "pointerdown", rect.left + 2, rect.top + 2);
  pointer(grip, "pointermove", to.x, to.y);
  await frame();
  await frame();
  if (!drop) return grip;
  pointer(grip, "pointerup", to.x, to.y);
  await settle();
  return grip;
}

/**Records the array write instruction types written to the state */
function writes(rows: Rows): string[] {
  const types: string[] = [];
  const write = rows.write.bind(rows);
  rows.write = (value) => {
    types.push(
      (value as { [STATE_ARRAY_WRITE_KEY]?: { type: string } })[
        STATE_ARRAY_WRITE_KEY
      ]?.type ?? "plain",
    );
    return write(value);
  };
  return types;
}

describe("List reorder handles", () => {
  it("are a column in front of the selection, only movable rows have a grip", () => {
    const container = tree(nodes(1, 2), { multi: true });
    const cells = [
      ...rows_of(container)[0].querySelector(":scope > div")!.children,
    ];
    expect(cells.map((c) => c.tagName)).toEqual([
      "LIST-DRAGFIELD",
      "LIST-CHECKFIELD",
      "LIST-KEYFIELD",
      "LIST-TEXTFIELD",
    ]);
    expect(rows_of(container)[0].movable).toBe(true);
    //A plain array can not be written
    const fixed = tree([node(1)]);
    expect(rows_of(fixed)[0].movable).toBe(false);
    expect(
      getComputedStyle(handle(rows_of(fixed)[0]), "::before").content,
    ).toBe("none");
    expect(
      getComputedStyle(handle(rows_of(container)[0]), "::before").content,
    ).toBe('""');
  });

  it("keep the error and add rows after them, from the key column to the end", () => {
    const rows = state.from_w<Node[]>([node(1)]);
    const container = tree(rows as unknown as Rows, { multi: true });
    rows.set_err("broken");
    const key = container
      .querySelector("list-rowserror > list-keyfield")!
      .getBoundingClientRect();
    const key_header = container
      .querySelector("list-headerrow > .key")!
      .getBoundingClientRect();
    const last_header = container
      .querySelector("list-headerrow > :last-child")!
      .getBoundingClientRect();
    expect(key.left).toBeCloseTo(key_header.left, 0);
    expect(key.right).toBeCloseTo(last_header.right, 0);
  });
});

describe("List reorder in one parent", () => {
  it("moves a row after another with one move write", async () => {
    const rows = nodes(1, 2, 3);
    const types = writes(rows);
    const container = tree(rows);
    const moved = row_named(container, "n1");
    await drag(moved, at(row_named(container, "n3"), 0.9));
    expect(ids(rows)).toEqual([2, 3, 1]);
    expect(types).toEqual(["move"]);
    //The element is kept, only moved
    expect(rows_of(container)[2]).toBe(moved);
  });

  it("moves a row before another", async () => {
    const rows = nodes(1, 2, 3);
    const container = tree(rows);
    await drag(row_named(container, "n3"), at(row_named(container, "n1"), 0.1));
    expect(ids(rows)).toEqual([3, 1, 2]);
  });

  it("drops below the last row at the end", async () => {
    const rows = nodes(1, 2, 3);
    const container = tree(rows);
    const last = rows_of(container)[2].anchor!.getBoundingClientRect();
    await drag(row_named(container, "n1"), {
      x: last.right + 20,
      y: last.bottom + 40,
    });
    expect(ids(rows)).toEqual([2, 3, 1]);
  });

  it("does nothing for a small press, escape or a drop on itself", async () => {
    const rows = nodes(1, 2, 3);
    const types = writes(rows);
    const container = tree(rows);
    const row = row_named(container, "n1");
    const grip = handle(row);
    const rect = grip.getBoundingClientRect();
    pointer(grip, "pointerdown", rect.left + 2, rect.top + 2);
    pointer(grip, "pointermove", rect.left + 4, rect.top + 3);
    pointer(grip, "pointerup", rect.left + 4, rect.top + 3);
    await drag(row, at(row_named(container, "n3"), 0.9), false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    pointer(grip, "pointerup", 0, 0);
    await settle();
    await drag(row, at(row, 0.9));
    expect(ids(rows)).toEqual([1, 2, 3]);
    expect(types).toEqual([]);
  });

  it("shows where the row goes while dragging, and dims it", async () => {
    const rows = nodes(1, 2, 3);
    const container = tree(rows);
    const target = row_named(container, "n2");
    const grip = await drag(row_named(container, "n1"), at(target, 0.9), false);
    const indicator = container.querySelector<HTMLElement>("span.list-drop")!;
    expect(indicator.hidden).toBe(false);
    expect(indicator.className).toBe("list-drop after");
    //Inside the bottom edge of the target row
    const line = indicator.getBoundingClientRect();
    expect(line.height).toBe(5);
    expect(line.bottom).toBeCloseTo(
      target.anchor!.getBoundingClientRect().bottom,
      0,
    );
    expect(row_named(container, "n1").classList.contains("dragging")).toBe(
      true,
    );
    expect(document.querySelector("span.list-drag-label")!.textContent).toBe(
      "n1",
    );
    pointer(grip, "pointerup", 0, 0);
    await settle();
    expect(indicator.hidden).toBe(true);
  });

  it("starts the line at the depth the rows land at", async () => {
    const rows = state.ok_w([node(1), node(2, [node(20), node(21)]), node(3)]);
    const container = tree(rows);
    row_named(container, "n2").open = true;
    const indicator = container.querySelector<HTMLElement>("span.list-drop")!;
    const line_at = async (row: AnyRow, part: number) => {
      const grip = await drag(row_named(container, "n1"), at(row, part), false);
      const rect = indicator.getBoundingClientRect();
      //Cancelled, so nothing moves between the two measurements
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      pointer(grip, "pointerup", 0, 0);
      await settle();
      return rect;
    };
    //Both at the border between the last sub row and the next top level row
    const sub = await line_at(row_named(container, "n21"), 0.9);
    const top = await line_at(row_named(container, "n3"), 0.1);
    expect(sub.left).toBeGreaterThan(top.left + 5);
    //Each inside its own row
    expect(sub.bottom).toBeLessThanOrEqual(
      row_named(container, "n21").anchor!.getBoundingClientRect().bottom + 0.5,
    );
    expect(top.top).toBeGreaterThanOrEqual(
      row_named(container, "n3").anchor!.getBoundingClientRect().top - 0.5,
    );
    //Starting at the indent of the row
    const opener = (name: string) =>
      row_named(container, name)
        .querySelector("list-keyfield > span:not(.text)")!
        .getBoundingClientRect().left;
    expect(sub.left).toBeCloseTo(opener("n21"), 0);
    expect(top.left).toBeCloseTo(opener("n3"), 0);
    expect(ids(rows)).toEqual([1, 2, 3]);
  });

  it("never makes the list wider than its rows while dragging", async () => {
    const rows = state.ok_w([
      node(1),
      node(2, [node(20, [node(200)])]),
      node(3),
    ]);
    const container = tree(rows);
    container.style.width = "15rem";
    row_named(container, "n2").open = true;
    row_named(container, "n20").open = true;
    expect(container.scrollWidth).toBe(container.clientWidth);
    for (const [name, part] of [
      ["n200", 0.9],
      ["n20", 0.1],
      ["n3", 0.1],
      ["n200", 0.1],
    ] as const) {
      const grip = await drag(
        row_named(container, "n1"),
        at(row_named(container, name), part),
        false,
      );
      expect(
        container.querySelector<HTMLElement>("span.list-drop")!.hidden,
      ).toBe(false);
      expect(container.scrollWidth).toBe(container.clientWidth);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      pointer(grip, "pointerup", 0, 0);
      await settle();
    }
  });

  it("draws the line 5px thick", async () => {
    const container = tree(nodes(1, 2));
    await drag(
      row_named(container, "n1"),
      at(row_named(container, "n2"), 0.9),
      false,
    );
    expect(
      container
        .querySelector<HTMLElement>("span.list-drop")!
        .getBoundingClientRect().height,
    ).toBe(5);
  });

  it("moves with alt and the arrow keys and keeps the focus", async () => {
    const rows = nodes(1, 2, 3);
    const container = tree(rows);
    const key_field = row_named(container, "n2").querySelector<HTMLElement>(
      "list-keyfield",
    )!;
    key_field.focus();
    key_field.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        altKey: true,
        bubbles: true,
      }),
    );
    await settle();
    expect(ids(rows)).toEqual([2, 1, 3]);
    expect(document.activeElement).toBe(key_field);
    key_field.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        altKey: true,
        bubbles: true,
      }),
    );
    await settle();
    expect(ids(rows)).toEqual([2, 1, 3]);
  });

  it("a rejected move leaves the row and shows why", async () => {
    const rows = state.rosw<Node[]>(ok([node(1), node(2)]), () =>
      Promise.resolve(err("Locked")),
    );
    const container = tree(rows);
    await drag(row_named(container, "n1"), at(row_named(container, "n2"), 0.9));
    const warn = container.querySelector<HTMLInputElement>("input.list-warn")!;
    await expect.poll(() => warn.validationMessage).toBe("Locked");
    expect(rows_of(container).map((row) => row.label)).toEqual(["n1", "n2"]);
  });
});

describe("List reorder between parents", () => {
  it("drops into a closed row as its last sub row and opens it", async () => {
    const rows = state.ok_w([node(1), node(2, [node(20)])]);
    const types = writes(rows);
    const container = tree(rows);
    const parent = row_named(container, "n2");
    await drag(row_named(container, "n1"), at(parent, 0.5));
    expect(ids(rows)).toEqual([2]);
    expect(ids(rows.ok()[0].children!)).toEqual([20, 1]);
    expect(parent.open).toBe(true);
    expect(types).toEqual(["splice"]);
  });

  it("moves a sub row out before a top level row, inserting before removing", async () => {
    const rows = state.ok_w([node(1), node(2, [node(20), node(21)])]);
    const children = rows.ok()[1].children!;
    const order: string[] = [];
    const targets: [string, Rows][] = [
      ["top", rows],
      ["children", children],
    ];
    for (const [name, target] of targets) {
      const write = target.write.bind(target);
      target.write = (value) => {
        order.push(name);
        return write(value);
      };
    }
    const container = tree(rows);
    row_named(container, "n2").open = true;
    await drag(
      row_named(container, "n21"),
      at(row_named(container, "n1"), 0.1),
    );
    expect(ids(rows)).toEqual([21, 1, 2]);
    expect(ids(children)).toEqual([20]);
    expect(order).toEqual(["top", "children"]);
  });

  it("drops after an open row as its first sub row", async () => {
    const rows = state.ok_w([node(1), node(2, [node(20)])]);
    const container = tree(rows);
    const parent = row_named(container, "n2");
    parent.open = true;
    await drag(row_named(container, "n1"), at(parent, 0.9));
    expect(ids(rows.ok()[0].children!)).toEqual([1, 20]);
  });

  it("can not drop a row into itself or its sub rows", async () => {
    const rows = state.ok_w([node(1, [node(10, [node(100)])]), node(2)]);
    const container = tree(rows);
    const top = row_named(container, "n1");
    top.open = true;
    row_named(container, "n10").open = true;
    await drag(top, at(row_named(container, "n10"), 0.5));
    await drag(top, at(row_named(container, "n100"), 0.1));
    expect(ids(rows)).toEqual([1, 2]);
    expect(ids(rows.ok()[0].children!)).toEqual([10]);
  });

  it("asks can_drop with the data and the new parent", async () => {
    const rows = state.ok_w([node(1), node(2, [node(20)]), node(3)]);
    const asked: [number, number | undefined][] = [];
    const container = tree(rows, {
      can_drop: (data, target) => {
        asked.push([data.id, target.parent?.id]);
        return target.parent === undefined;
      },
    });
    await drag(row_named(container, "n1"), at(row_named(container, "n2"), 0.5));
    expect(ids(rows)).toEqual([1, 2, 3]);
    await drag(row_named(container, "n1"), at(row_named(container, "n3"), 0.9));
    expect(ids(rows)).toEqual([2, 3, 1]);
    expect(asked).toContainEqual([1, 2]);
    expect(asked).toContainEqual([1, undefined]);
  });

  it("a failed remove leaves the row in both places, never loses it", async () => {
    const children = state.ok_w([node(20)]);
    const rows = state.rosw<Node[]>(ok([node(1), { id: 2, children }]), () =>
      Promise.resolve(err("Can not remove")),
    );
    const container = tree(rows);
    await drag(row_named(container, "n1"), at(row_named(container, "n2"), 0.5));
    expect(ids(children)).toEqual([20, 1]);
    expect(ids(rows)).toEqual([1, 2]);
    const warn = container.querySelector<HTMLInputElement>("input.list-warn")!;
    await expect.poll(() => warn.validationMessage).toBe("Can not remove");
  });
});

describe("List reorder of selected rows", () => {
  it("moves all selected rows, one write per run of rows next to each other", async () => {
    const rows = nodes(1, 2, 3, 4, 5, 6);
    const types = writes(rows);
    const container = tree(rows, { multi: true });
    for (const name of ["n1", "n3", "n4"])
      row_named(container, name)
        .querySelector<HTMLElement>("list-checkfield")!
        .click();
    await drag(row_named(container, "n3"), at(row_named(container, "n6"), 0.9));
    expect(ids(rows)).toEqual([2, 5, 6, 1, 3, 4]);
    expect(types).toEqual(["move", "move"]);
    expect(document.querySelector("span.list-drag-label")).toBeNull();
  });

  it("moves a selected parent with its sub rows and leaves out its selected sub rows", async () => {
    const rows = state.ok_w([node(1, [node(10)]), node(2), node(3)]);
    const container = tree(rows, { multi: true });
    row_named(container, "n1").open = true;
    for (const name of ["n1", "n10"])
      row_named(container, name)
        .querySelector<HTMLElement>("list-checkfield")!
        .click();
    await drag(row_named(container, "n1"), at(row_named(container, "n3"), 0.9));
    expect(ids(rows)).toEqual([2, 3, 1]);
    expect(ids(rows.ok()[2].children!)).toEqual([10]);
  });

  it("drags only the row when it is not selected", async () => {
    const rows = nodes(1, 2, 3);
    const container = tree(rows, { multi: true });
    row_named(container, "n2")
      .querySelector<HTMLElement>("list-checkfield")!
      .click();
    await drag(row_named(container, "n1"), at(row_named(container, "n3"), 0.9));
    expect(ids(rows)).toEqual([2, 3, 1]);
  });
});

describe("List reorder between lists", () => {
  it("gives rows to another list of the same group", async () => {
    const group = list.drag_group<Node>();
    const a = nodes(1, 2);
    const b = nodes(3, 4);
    const first = tree(a, { group });
    const second = tree(b, { group });
    await drag(row_named(first, "n1"), at(row_named(second, "n3"), 0.9));
    expect(ids(a)).toEqual([2]);
    expect(ids(b)).toEqual([3, 1, 4]);
  });

  it("only inserts with no_remove, for apps that remove the rows themselves", async () => {
    const group = list.drag_group<Node>();
    const a = nodes(1, 2);
    const b = nodes(3, 4);
    const first = tree(a, { group, no_remove: true });
    const second = tree(b, { group });
    //The app removes the row from where it came from after it is added to the second list
    const removed = new Promise<void>((done) =>
      b.sub(() =>
        setTimeout(() => {
          void a.write(state.a.write.splice(0, 1));
          done();
        }, 0),
      ),
    );
    await drag(row_named(first, "n1"), at(row_named(second, "n3"), 0.9));
    await removed;
    expect(ids(a)).toEqual([2]);
    expect(ids(b)).toEqual([3, 1, 4]);
  });

  it("does not remove a row the app already removed during the insert", async () => {
    const group = list.drag_group<Node>();
    const a = nodes(1, 2);
    const b = nodes(3, 4);
    b.sub(() => void a.write(state.a.write.splice(0, 1)));
    const first = tree(a, { group });
    const second = tree(b, { group });
    await drag(row_named(first, "n1"), at(row_named(second, "n3"), 0.9));
    expect(ids(a)).toEqual([2]);
    expect(ids(b)).toEqual([3, 1, 4]);
  });

  it("still moves inside one parent with no_remove", async () => {
    const a = nodes(1, 2, 3);
    const container = tree(a, { no_remove: true });
    await drag(row_named(container, "n1"), at(row_named(container, "n3"), 0.9));
    expect(ids(a)).toEqual([2, 3, 1]);
  });

  it("does not give rows to a list of another group or without group", async () => {
    const a = nodes(1, 2);
    const b = nodes(3, 4);
    const first = tree(a, { group: list.drag_group<Node>() });
    const second = tree(b);
    await drag(row_named(first, "n1"), at(row_named(second, "n3"), 0.9));
    expect(ids(a)).toEqual([1, 2]);
    expect(ids(b)).toEqual([3, 4]);
  });

  it("only lets lists with the same row type join a group", () => {
    const group = list.drag_group<Node>();
    const make = () =>
      list.container(
        { name: list.column_string("Name") },
        (data: string) => ok({ values: { name: data } }),
        state.ok_w(["a"]),
        // @ts-expect-error a list of strings can not join a group of nodes
        { reorder: { group } },
      );
    expect(make).toBeTypeOf("function");
  });
});
