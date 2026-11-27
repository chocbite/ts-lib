import { define_element } from "#base";
import state, { type StateROSW } from "@chocbite/ts-lib/state";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { canvas, type CanvasSelection, type CanvasWidgetData } from "..";
import { WidgetBase } from "../widget";

class OutlineWidget extends WidgetBase {
  static element_name() {
    return "outlinewidget";
  }
}
define_element(OutlineWidget);

const group = canvas.widgets.group("outlinetest", "Outline test", "");
const definition = group.add("box", "Box", "", {
  create: (options) => OutlineWidget.create(options),
});
afterAll(() => group.remove());

const close_menus = () => {
  (document.activeElement as HTMLElement | null)?.blur();
  document.querySelector("contextmenu-container")?.replaceChildren();
};
afterEach(() => {
  close_menus();
  document.body.replaceChildren();
});

/**A local writable state, which can be set directly*/
type StateOkW<T> = ReturnType<typeof state.ok_w<T>>;

const tick = () => new Promise((resolve) => setTimeout(resolve));

const make = (ids: string[]) => {
  const widgets = state.ok_w(
    ids.map((id) => canvas.widget(definition, { id })),
  );
  const page = canvas.page({ widgets });
  const selected = state.ok_w<CanvasSelection>(undefined);
  const outline = document.body.appendChild(canvas.outline({ page, selected }));
  /**The row of the page, the root*/
  const page_row = () => outline.querySelector<HTMLElement>("list-row")!;
  /**The rows of the widgets, below the row of the page*/
  const rows = () => [...outline.querySelectorAll("list-row")].slice(1);
  const texts = () =>
    rows().map((row) =>
      [...row.querySelectorAll("list-keyfield, list-textfield")].map(
        (field) => field.textContent,
      ),
    );
  const row_of = (id: string) =>
    rows().find(
      (row) => row.querySelector("list-keyfield")!.textContent === id,
    )! as HTMLElement;
  /**The widget the page makes of the data of a widget*/
  const w = (data: CanvasWidgetData) => page.widget_of(data);
  return { widgets, page, selected, outline, page_row, rows, texts, row_of, w };
};

describe("Outline", () => {
  it("lists the widgets of the page front first, with their id and the name of their widget", () => {
    const { texts } = make(["Back", "Middle", "Front"]);
    expect(texts()).toEqual([
      ["Front", "Box"],
      ["Middle", "Box"],
      ["Back", "Box"],
    ]);
  });

  it("follows the name the widget is registered with", () => {
    const name = state.ok_w("Named");
    const named = group.add("named", name, "", {
      create: (options) => OutlineWidget.create(options),
    });
    const widgets = state.ok_w([canvas.widget(named, { id: "a" })]);
    const outline = document.body.appendChild(
      canvas.outline({ page: canvas.page({ widgets }) }),
    );
    //The first text field is the name of the page row
    const shown = () =>
      outline.querySelectorAll("list-textfield")[1].textContent;
    expect(shown()).toBe("Named");
    name.set_ok("Renamed");
    expect(shown()).toBe("Renamed");
    named.remove();
    expect(shown()).toBe("named");
  });

  it("follows the widgets and their ids", () => {
    const { widgets, texts } = make(["A", "B"]);
    const [a, b] = widgets.ok();
    widgets.set_ok([b, a]);
    expect(texts().map(([id]) => id)).toEqual(["A", "B"]);
    (b.options.id as StateOkW<string>).set_ok("Renamed");
    expect(texts().map(([id]) => id)).toEqual(["A", "Renamed"]);
    widgets.set_ok([a]);
    expect(texts().map(([id]) => id)).toEqual(["A"]);
  });

  it("applies the changes the widgets state gives, a move moves the one row", () => {
    const { widgets, rows, texts } = make(["A", "B", "C"]);
    const [ra, rb, rc] = rows().reverse();
    widgets.array.move(0, 2);
    expect(texts().map(([id]) => id)).toEqual(["A", "C", "B"]);
    const after = rows();
    [ra, rc, rb].forEach((row, i) => expect(after[i]).toBe(row));
    widgets.array.push(canvas.widget(definition, { id: "D" }));
    widgets.array.delete(widgets.ok()[0]);
    expect(texts().map(([id]) => id)).toEqual(["D", "A", "C"]);
    expect(rows()[1]).toBe(ra);
  });

  it("shows the page as the root row, opened to its widgets, with its id", () => {
    const widgets = state.ok_w([canvas.widget(definition, { id: "A" })]);
    const id = state.ok_w("Main");
    const outline = document.body.appendChild(
      canvas.outline({ page: canvas.page({ id, widgets }) }),
    );
    const row = outline.querySelector("list-row")!;
    const own = (selector: string) =>
      row.querySelector(`:scope > div > ${selector}`)!.textContent;
    expect(own("list-keyfield")).toBe("Main");
    expect(own("list-textfield")).toBe("Page");
    expect(row.querySelectorAll("list-row")).toHaveLength(1);
    id.set_ok("Other");
    expect(own("list-keyfield")).toBe("Other");
  });

  it("selects the page with a click on its row, a ctrl click on a widget then selects only the widget", async () => {
    const { widgets, page, selected, page_row, row_of, w } = make(["A", "B"]);
    const [a] = widgets.ok();
    const click = (row: HTMLElement, ctrlKey = false) =>
      row
        .querySelector(":scope > div > list-keyfield")!
        .dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey }),
        );
    click(page_row());
    await tick();
    expect(selected.ok()).toBe(page);
    expect(page_row().classList).toContain("selected");
    //The page is the level above its widgets, the selection is of one level
    click(row_of("A"), true);
    await tick();
    expect(selected.ok()).toBe(w(a));
    click(page_row(), true);
    await tick();
    expect(selected.ok()).toBe(page);
  });

  it("leaves a selected page with the delete key", async () => {
    const { widgets, page, selected, outline } = make(["A"]);
    selected.set_ok(page);
    outline.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Delete",
        bubbles: true,
        cancelable: true,
      }),
    );
    await tick();
    expect(widgets.ok()).toHaveLength(1);
    expect(selected.ok()).toBe(page);
  });

  it("shares the selection, a click on a row selects its widget", async () => {
    const { widgets, selected, row_of, w } = make(["A", "B"]);
    const [a, b] = widgets.ok();
    row_of("B")
      .querySelector("list-keyfield")!
      .dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    await tick();
    expect(selected.ok()).toBe(w(b));
    selected.set_ok(w(a));
    expect(row_of("A").classList).toContain("selected");
    expect(row_of("B").classList).not.toContain("selected");
    selected.set_ok(undefined);
    expect(row_of("A").classList).not.toContain("selected");
  });

  it("deletes the selected widgets with the menu of a row or the delete key", async () => {
    const { widgets, selected, outline, row_of, w } = make(["A", "B", "C"]);
    const [a, b, c] = widgets.ok();
    selected.set_ok(canvas.selection_of([w(a), w(c)]));
    row_of("A").dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    [
      ...document.querySelectorAll<HTMLElement>(
        "contextmenu-container contextmenu-option",
      ),
    ]
      .find((option) => option.textContent === "DeleteDel")!
      .click();
    await tick();
    expect(widgets.ok()).toEqual([b]);
    expect(selected.ok()).toBeUndefined();
    selected.set_ok(w(b));
    outline.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Delete",
        bubbles: true,
        cancelable: true,
      }),
    );
    await tick();
    expect(widgets.ok()).toEqual([]);
  });

  it("adds widgets picked in the widget selector, at the center of the page, and selects them", async () => {
    const { widgets, selected, outline, w } = make(["A"]);
    const add = outline.querySelector<HTMLElement>("list-addrow .add")!;
    expect(add.textContent).toBe("Add widget");
    add.click();
    await tick();
    const panel = document.querySelector("depot-selector")!;
    const input = panel.querySelector("input")!;
    input.value = "Box";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    //Enter searches without the delay of the list
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    [...panel.querySelectorAll<HTMLElement>("list-row")]
      .find((r) => r.querySelector("list-keyfield")!.textContent === "Box")!
      .querySelector<HTMLElement>("list-keyfield")!
      .click();
    [...panel.querySelectorAll<HTMLElement>("form-button")]
      .find((button) => button.textContent === "Select")!
      .click();
    await tick();
    await tick();
    expect(widgets.ok()).toHaveLength(2);
    const added = widgets.ok()[1];
    expect(selected.ok()).toBe(w(added));
    //A 100 by 100 widget centered on a 1920 by 1080 page
    const value = (key: string) =>
      (added.options as Record<string, StateROSW<unknown>>)[key].ok();
    expect([value("x"), value("y")]).toEqual([910, 490]);
  });

  it("copy and paste of the system paste copies of the selected widgets and select them", async () => {
    const { widgets, selected, outline, w } = make(["A", "B"]);
    selected.set_ok(w(widgets.ok()[0]));
    const clipboard = new DataTransfer();
    const event = (type: "copy" | "paste") =>
      outline.dispatchEvent(
        new ClipboardEvent(type, {
          clipboardData: clipboard,
          bubbles: true,
          cancelable: true,
        }),
      );
    event("copy");
    event("paste");
    await tick();
    expect(widgets.ok()).toHaveLength(3);
    expect(selected.ok()).toBe(w(widgets.ok()[2]));
  });

  it("orders the widget of a row with its menu", async () => {
    const { widgets, row_of } = make(["A", "B", "C"]);
    const [a, b, c] = widgets.ok();
    const menu = (id: string) => {
      row_of(id).dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
      );
      return [
        ...document.querySelectorAll<HTMLElement>(
          "contextmenu-container contextmenu-option",
        ),
      ];
    };
    const line = (id: string, text: string) =>
      menu(id).find((option) => option.textContent === text)!;
    expect(menu("A").map((option) => option.textContent)).toEqual(
      expect.arrayContaining([
        "Bring to front",
        "Move forward",
        "Move backward",
        "Send to back",
      ]),
    );
    close_menus();
    line("A", "Bring to front").click();
    await tick();
    expect(widgets.ok()).toEqual([b, c, a]);
    line("A", "Send to back").click();
    await tick();
    expect(widgets.ok()).toEqual([a, b, c]);
    line("B", "Move forward").click();
    await tick();
    expect(widgets.ok()).toEqual([a, c, b]);
  });
});

describe("Outline of groups", () => {
  /**The id in the key field of a row itself, not of its sub rows*/
  const own = (row: Element) =>
    row.querySelector(":scope > div > list-keyfield")!.textContent;
  /**A page of A, and a group G of B and C*/
  const nested = async () => {
    const made = make(["A", "B", "C"]);
    const [a, b, c] = made.widgets.ok();
    const g = (await canvas.group(made.page, [made.w(b), made.w(c)]))!;
    (g.data.options.id as StateOkW<string>).set_ok("G");
    const ids = () => made.rows().map(own);
    const open = (id: string) =>
      made
        .row_of(id)
        .querySelector<HTMLElement>(
          ":scope > div > list-keyfield .opener > div",
        )!
        .click();
    return { ...made, a, b, c, g, ids, open };
  };

  it("shows a group as a row that opens to its widgets, front first", async () => {
    const { ids, open } = await nested();
    expect(ids()).toEqual(["G", "A"]);
    open("G");
    expect(ids()).toEqual(["G", "C", "B", "A"]);
  });

  it("follows the widgets in a group", async () => {
    const { ids, open, g } = await nested();
    open("G");
    (
      (g.options as Record<string, unknown>).widgets as StateOkW<
        CanvasWidgetData[]
      >
    ).array.push(canvas.widget(definition, { id: "D" }));
    expect(ids()).toEqual(["G", "D", "C", "B", "A"]);
  });

  it("keeps the selection to one level, a widget of another level replaces it", async () => {
    const { open, selected, row_of, a, c, g, w } = await nested();
    open("G");
    selected.set_ok(w(a));
    row_of("C")
      .querySelector(":scope > div > list-keyfield")!
      .dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
        }),
      );
    await tick();
    //The widget the content of the group makes
    expect(selected.ok()).toBe(g.content.widget_of(c));
  });

  it("keeps a selection of one level when widgets were grouped while their group is closed", async () => {
    //B is listed at the page from before it was grouped, the group is not opened
    const { selected, b, g } = await nested();
    //A widget pasted into the group, never listed
    const pasted = canvas.widget(definition, { id: "P" });
    (
      (g.options as Record<string, unknown>).widgets as StateOkW<
        CanvasWidgetData[]
      >
    ).array.push(pasted);
    const inside = [b, pasted].map((data) => g.content.widget_of(data));
    selected.set_ok(inside[0]);
    //Added like a ctrl click in a viewport does
    await selected.write(canvas.selection_of(inside));
    await tick();
    expect(canvas.selected_widgets(selected.ok())).toEqual(inside);
  });

  it("acts in the group of a row with its menu", async () => {
    const { open, row_of, widgets, a, b, c, g } = await nested();
    open("G");
    row_of("B").dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    [
      ...document.querySelectorAll<HTMLElement>(
        "contextmenu-container contextmenu-option",
      ),
    ]
      .find((option) => option.textContent === "DeleteDel")!
      .click();
    await tick();
    expect(
      (
        (g.options as Record<string, unknown>).widgets as StateROSW<
          CanvasWidgetData[]
        >
      ).ok(),
    ).toEqual([c]);
    expect(widgets.ok()).toEqual([a, g.data]);
    void b;
  });
});
