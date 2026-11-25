import { theme_init } from "#theme";
import { ok } from "@chocbite/ts-lib/result";
import { state, type State } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import list from "..";
import type { ListRow } from "../row";

//Glyphs come from theme variables
theme_init();

afterEach(() => {
  document.body.replaceChildren();
});

type AnyRow = ListRow<any, any, any, any>;

interface Node {
  name: string;
  sub?: Node[];
  opened?: State<boolean>;
}
const node = (name: string, sub?: Node[]): Node => ({ name, sub });

/**Three levels, a has b which has c, d has nothing */
const tree = () => [node("a", [node("b", [node("c")])]), node("d")];

/**Endless tree, every row has three sub rows, like a mistake that makes the data recursive */
const endless = (name: string): Node => ({
  name,
  get sub() {
    return [endless(name + ".1"), endless(name + ".2"), endless(name + ".3")];
  },
});

function make(rows: Node[], headless = false) {
  const container = list.container(
    {
      transform: (data: Node) =>
        ok({
          openable: Boolean(data.sub),
          opened: data.opened,
          sub_rows: () => data.sub ?? [],
          values: { name: data.name },
        }),
      sub_rows: true,
      headless,
    },
    { columns: { name: list.column_string("Name") }, rows },
  );
  document.body.append(container);
  return container;
}

function rows_of(container: HTMLElement): AnyRow[] {
  return [...container.querySelectorAll("list-row")] as AnyRow[];
}
const names = (container: HTMLElement) =>
  rows_of(container).map((row) => row.label);
const key_header = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("list-headerrow > .key")!;
const button = (container: HTMLElement, kind: "open" | "close") =>
  key_header(container).querySelector<HTMLElement>(`.list-${kind}-all`)!;

function click(element: HTMLElement) {
  element.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true }),
  );
}
const right_click = (element: HTMLElement) =>
  element.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
  );
const options = () =>
  [
    ...document.documentElement.querySelectorAll("contextmenu-option"),
  ] as HTMLElement[];
const texts = () => options().map((o) => o.textContent);
const choose = (text: string) =>
  options()
    .find((o) => o.textContent.startsWith(text))!
    .click();
const warning = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>("input.list-warn")
    ?.validationMessage ?? "";

describe("List open all and close all", () => {
  it("opens every level and closes them again with the key header buttons", () => {
    const container = make(tree());
    expect(names(container)).toEqual(["a", "d"]);
    click(button(container, "open"));
    expect(names(container)).toEqual(["a", "b", "c", "d"]);
    click(button(container, "close"));
    expect(names(container)).toEqual(["a", "d"]);
  });

  it("has open all and close all in the menu of the key header", () => {
    const container = make(tree());
    right_click(key_header(container));
    expect(texts()).toEqual(["Open all", "Close all"]);
    choose("Open all");
    expect(names(container)).toEqual(["a", "b", "c", "d"]);
    right_click(key_header(container));
    choose("Close all");
    expect(names(container)).toEqual(["a", "d"]);
  });

  it("has close all in the menu of every row while a row is open, also without a header", () => {
    const container = make(tree(), true);
    const [a, d] = rows_of(container);
    //Nothing open, nothing to close
    right_click(d.anchor as HTMLElement);
    expect(texts()).toEqual([]);
    right_click(a.anchor as HTMLElement);
    expect(texts()).toEqual(["Open"]);
    choose("Open");
    //A row that can not be opened gets it too
    right_click(d.anchor as HTMLElement);
    expect(texts()).toEqual(["Close all"]);
    right_click(a.anchor as HTMLElement);
    expect(texts()).toEqual(["Close", "Close all"]);
    const b = rows_of(container)[1];
    right_click(b.anchor as HTMLElement);
    expect(texts()).toEqual(["Open", "Close all"]);
    choose("Close all");
    expect(names(container)).toEqual(["a", "d"]);
  });

  it("stops after 1000 rows with a warning, opening again continues, the upper levels first", () => {
    const container = make([endless("x")]);
    click(button(container, "open"));
    const first = rows_of(container).length;
    //One row more than the limit opens at most its three sub rows
    expect(first).toBeGreaterThan(1000);
    expect(first).toBeLessThanOrEqual(1 + 1000 + 3);
    expect(warning(container)).toBe(
      "Stopped after opening 1000 rows, open all again for more",
    );
    //Level by level, every row above the deepest level is open
    const depth = (row: AnyRow) => row.label.split(".").length - 1;
    const deepest = Math.max(...rows_of(container).map(depth));
    for (const row of rows_of(container))
      if (depth(row) < deepest - 1) expect(row.open).toBe(true);
    click(button(container, "open"));
    expect(rows_of(container).length).toBeGreaterThan(first + 900);
  });

  it("writes the opened states of the rows it opens", () => {
    const a = state.ok_w(false);
    const b = state.ok_w(false);
    const container = make([
      {
        name: "a",
        opened: a,
        sub: [{ name: "b", opened: b, sub: [node("c")] }],
      },
      node("d"),
    ]);
    click(button(container, "open"));
    expect(names(container)).toEqual(["a", "b", "c", "d"]);
    expect(a.get().value).toBe(true);
    expect(b.get().value).toBe(true);
  });

  it("writes false to the opened states of every open row when closing all, sub rows included", () => {
    const a = state.ok_w(true);
    const b = state.ok_w(true);
    const container = make([
      {
        name: "a",
        opened: a,
        sub: [{ name: "b", opened: b, sub: [node("c")] }],
      },
      node("d"),
    ]);
    expect(names(container)).toEqual(["a", "b", "c", "d"]);
    click(button(container, "close"));
    expect(names(container)).toEqual(["a", "d"]);
    expect(a.get().value).toBe(false);
    //Otherwise b would open again with a
    expect(b.get().value).toBe(false);
  });

  it("leaves rows with a read only opened state as they are", () => {
    const a = state.ok(false);
    const d = state.ok(true);
    const container = make([
      { name: "a", opened: a.read_only, sub: [node("b")] },
      { name: "d", opened: d.read_only, sub: [node("e")] },
    ]);
    click(button(container, "open"));
    expect(names(container)).toEqual(["a", "d", "e"]);
    click(button(container, "close"));
    expect(names(container)).toEqual(["a", "d", "e"]);
  });

  it("does not warn when everything is open within the limit", () => {
    const container = make(tree());
    click(button(container, "open"));
    expect(warning(container)).toBe("");
  });
});
