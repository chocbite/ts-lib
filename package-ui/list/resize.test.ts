import { INPUT_MODE, InputModes, px_to_rem, theme_init } from "#theme";
import { ok } from "@chocbite/ts-lib/result";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import list from ".";

//The input mode is applied by the theme
theme_init();

afterEach(() => {
  document.body.replaceChildren();
});

function name_list() {
  const container = list.container(
    { name: list.column_string("Name"), id: list.column_string("Id") },
    (item: number) => ok({ values: { name: "n" + item, id: String(item) } }),
    [1, 2],
  );
  document.body.append(container);
  const field = container.querySelector<HTMLElement>("list-headerfield")!;
  const field_box = field.firstElementChild as HTMLElement;
  const sizer = field_box.lastElementChild as HTMLElement;
  const columns = () =>
    (container.firstElementChild as HTMLElement).style.gridTemplateColumns;
  return { field, field_box, sizer, columns };
}

function pointer(target: HTMLElement, type: string, x: number) {
  target.dispatchEvent(
    new PointerEvent(type, { clientX: x, pointerId: 1, bubbles: true }),
  );
}

describe("List column resizing", () => {
  it("does not pan the list when dragging the handle", () => {
    const { sizer } = name_list();
    expect(getComputedStyle(sizer).touchAction).toBe("none");
  });

  it("shows the handle as active while resizing", () => {
    const { field, sizer } = name_list();
    field.setPointerCapture = () => {};
    pointer(sizer, "pointerdown", 100);
    expect(sizer.classList.contains("active")).toBe(true);
    pointer(field, "pointerup", 100);
    expect(sizer.classList.contains("active")).toBe(false);
  });

  it("ends the resize when the browser cancels the pointer", () => {
    const { field, field_box, sizer, columns } = name_list();
    field.setPointerCapture = () => {};
    const start = field_box.offsetWidth;
    pointer(sizer, "pointerdown", 100);
    pointer(field, "pointermove", 140);
    const width = Math.max(px_to_rem(start + 40), 1);
    expect(parseFloat(columns())).toBeCloseTo(width);
    pointer(field, "pointercancel", 140);
    expect(sizer.classList.contains("active")).toBe(false);
    //Moving after the cancel does nothing
    pointer(field, "pointermove", 400);
    expect(parseFloat(columns())).toBeCloseTo(width);
  });

  it("gives the auto width columns their width on the first resize", () => {
    const { field, sizer, columns } = name_list();
    field.setPointerCapture = () => {};
    const other = field.nextElementSibling as HTMLElement;
    const other_width = other.offsetWidth;
    expect(columns()).toBe("auto auto");
    pointer(sizer, "pointerdown", 100);
    pointer(field, "pointermove", 140);
    pointer(field, "pointerup", 140);
    const [, second] = columns().split(" ");
    expect(second).toMatch(/rem$/);
    expect(parseFloat(second)).toBeCloseTo(px_to_rem(other_width));
    expect(other.offsetWidth).toBeCloseTo(other_width, 0);
  });

  it("keeps the other columns auto when a double click resets one", () => {
    const { field, sizer, columns } = name_list();
    field.setPointerCapture = () => {};
    pointer(sizer, "pointerdown", 100);
    pointer(field, "pointerup", 100);
    pointer(sizer, "pointerdown", 100);
    expect(columns()).toBe("auto auto");
  });
});

describe("List column resizing in touch mode", () => {
  let initial: InputModes;
  beforeAll(async () => {
    initial = INPUT_MODE.ok();
    await INPUT_MODE.write(InputModes.Touch);
  });
  afterAll(async () => {
    await INPUT_MODE.write(initial);
  });

  it("has a handle wide enough for a finger, with a two line grip", () => {
    const { sizer } = name_list();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(sizer.getBoundingClientRect().width).toBeCloseTo(1.5 * rem, 0);
    expect(getComputedStyle(sizer, "::after").boxShadow).not.toBe("none");
  });

  it("keeps the small handle with the mouse", async () => {
    await INPUT_MODE.write(InputModes.Mouse);
    const { sizer } = name_list();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(sizer.getBoundingClientRect().width).toBeCloseTo(0.5 * rem, 0);
    await INPUT_MODE.write(InputModes.Touch);
  });
});

describe("List header when scrolled sideways", () => {
  it("keeps the reorder, selection and key headers above the column headers", () => {
    const container = list.container(
      {
        a: list.column({
          title: "A",
          init_width: 20,
          field_gen: () => list.text_field(),
          field_apply: () => {},
        }),
        b: list.column({
          title: "B",
          init_width: 20,
          field_gen: () => list.text_field(),
          field_apply: () => {},
        }),
      },
      () => ok({ values: { a: undefined, b: undefined } }),
      [1, 2],
      {
        sub_rows: true,
        reorder: {},
        selection: { mode: "multi" },
      },
    );
    container.style.width = "20rem";
    document.body.append(container);
    container.scrollLeft = 200;
    const header = container.querySelector("list-headerrow")!;
    const lead = [
      header.querySelector("list-dragfield")!,
      header.querySelector("list-checkfield")!,
      header.querySelector(".key")!,
    ];
    for (const cell of lead) {
      const rect = cell.getBoundingClientRect();
      const top = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      expect(cell.contains(top)).toBe(true);
    }
  });
});

describe("Key column resizing", () => {
  interface Item {
    name: string;
    sub?: Item[];
  }
  const icon = () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 10 10");
    return svg;
  };
  function tree() {
    const container = list.container(
      { name: list.column_string("Name") },
      (item: Item) =>
        ok({
          openable: Boolean(item.sub),
          key_field: { icon, text: "A long key text " + item.name },
          sub_rows: () => item.sub ?? [],
          values: { name: item.name },
        }),
      [{ name: "a", sub: [{ name: "b" }] }],
      { sub_rows: true },
    );
    document.body.append(container);
    const header = container.querySelector<HTMLElement>(
      "list-headerrow > .key",
    )!;
    header.setPointerCapture = () => {};
    const sizer = header.firstElementChild!.lastElementChild as HTMLElement;
    const resize = (by: number) => {
      pointer(sizer, "pointerdown", 500);
      pointer(header, "pointermove", 500 + by);
      pointer(header, "pointerup", 500 + by);
    };
    const keys = () => [
      ...container.querySelectorAll<HTMLElement>("list-row list-keyfield"),
    ];
    return { container, header, resize, keys };
  }
  const rem = () =>
    parseFloat(getComputedStyle(document.documentElement).fontSize);
  const text_width = (key: HTMLElement) =>
    key.querySelector<HTMLElement>("span.text")!.getBoundingClientRect().width;

  it("does not get smaller than the icon and 3rem of the text", () => {
    const { header, resize, keys } = tree();
    const icon_width = keys()[0]
      .querySelector("svg")!
      .getBoundingClientRect().width;
    resize(-1000);
    expect(text_width(keys()[0])).toBeCloseTo(3 * rem(), 0);
    expect(
      keys()[0].querySelector("svg")!.getBoundingClientRect().width,
    ).toBeCloseTo(icon_width, 1);
    expect(header.offsetWidth).toBe(keys()[0].offsetWidth);
  });

  it("gets wider by the indent when a sub row opens", async () => {
    const { header, resize, keys } = tree();
    resize(-1000);
    const closed = header.offsetWidth;
    keys()[0]
      .querySelector<HTMLElement>(":scope > span:not(.text) > div")!
      .click();
    await new Promise((r) => setTimeout(r, 0));
    expect(keys()).toHaveLength(2);
    expect(text_width(keys()[1])).toBeCloseTo(3 * rem(), 0);
    expect(header.offsetWidth).toBeGreaterThan(closed);
    expect(keys()[0].offsetWidth).toBe(header.offsetWidth);
  });

  it("is the resized width when that is above the minimum", () => {
    const { header, resize, keys } = tree();
    const start = header.offsetWidth;
    resize(100);
    expect(header.offsetWidth).toBeCloseTo(start + 100, 0);
    expect(keys()[0].offsetWidth).toBe(header.offsetWidth);
  });
});
