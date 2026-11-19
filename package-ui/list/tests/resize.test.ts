import { INPUT_MODE, InputModes, px_to_rem, theme_init } from "#theme";
import { NiceError, ok } from "@chocbite/ts-lib/result";
import { state } from "@chocbite/ts-lib/state";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import list from "..";

//The input mode is applied by the theme
theme_init();

/**A test error whose nice text is its message*/
const nice_err = (text: string) => new NiceError(Symbol(text), text);

afterEach(() => {
  document.body.replaceChildren();
});

function name_list() {
  const container = list.container(
    {
      transform: (item: number) =>
        ok({ values: { name: "n" + item, id: String(item) } }),
    },
    {
      columns: {
        name: list.column_string("Name"),
        id: list.column_string("Id"),
      },
      rows: [1, 2],
    },
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
        transform: () => ok({ values: { a: undefined, b: undefined } }),
        sub_rows: true,
        reorder: {},
        selection: { mode: "multi" },
      },
      {
        columns: {
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
        rows: [1, 2],
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
      {
        transform: (item: Item) =>
          ok({
            openable: Boolean(item.sub),
            key_field: { icon, text: "A long key text " + item.name },
            sub_rows: () => item.sub ?? [],
            values: { name: item.name },
          }),
        sub_rows: true,
      },
      {
        columns: { name: list.column_string("Name") },
        rows: [{ name: "a", sub: [{ name: "b" }] }],
      },
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

  it("does not get smaller than the icon and 4rem of the text", () => {
    const { header, resize, keys } = tree();
    const icon_width = keys()[0]
      .querySelector("svg")!
      .getBoundingClientRect().width;
    resize(-1000);
    expect(text_width(keys()[0])).toBeCloseTo(4 * rem(), 0);
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
    expect(text_width(keys()[1])).toBeCloseTo(4 * rem(), 0);
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

describe("Column widths without a header or value columns", () => {
  const value_column = (options: {
    init_width?: number;
    fixed_width?: number | "min" | "max";
  }) =>
    list.column({
      title: "Column",
      ...options,
      field_gen: () => list.text_field(),
      field_apply: () => {},
    });
  function widths_list(headless: boolean) {
    const container = list.container(
      {
        transform: () =>
          ok({ values: { init: undefined, fixed: undefined, min: undefined } }),
        headless,
      },
      {
        columns: {
          init: value_column({ init_width: 10 }),
          fixed: value_column({ fixed_width: 5 }),
          min: value_column({ fixed_width: "min" }),
        },
        rows: [1],
      },
    );
    document.body.append(container);
    return (container.firstElementChild as HTMLElement).style
      .gridTemplateColumns;
  }
  function key_only(headless: boolean, columns: boolean) {
    const container = list.container(
      {
        transform: (name: string) =>
          ok({ key_field: { text: name }, values: { name } }),
        headless,
        sub_rows: true,
      },
      {
        //Typed as with the column, values are given either way and ignored without it
        columns: (columns ? { name: list.column_string("Name") } : {}) as {
          name: ReturnType<typeof list.column_string>;
        },
        rows: ["Alpha", "Beta"],
      },
    );
    container.style.width = "30rem";
    document.body.append(container);
    const key = container.querySelector<HTMLElement>("list-row list-keyfield")!;
    return { container, key };
  }

  it("ignores init_width without a header, nothing can resize it", () => {
    expect(widths_list(true)).toBe("auto 5rem min-content");
  });

  it("keeps init_width with a header", () => {
    expect(widths_list(false)).toBe("10rem 5rem min-content");
  });

  it("fills the list with the key column when there are no value columns", () => {
    for (const headless of [true, false]) {
      const { container, key } = key_only(headless, false);
      expect(key.offsetWidth).toBeCloseTo(container.clientWidth, 0);
      container.remove();
    }
  });

  it("keeps the key column at its content with value columns", () => {
    const { container, key } = key_only(true, true);
    expect(key.offsetWidth).toBeLessThan(container.clientWidth / 2);
  });

  it("keeps the resized width of a key column without value columns", () => {
    const { container, key } = key_only(false, false);
    const header = container.querySelector<HTMLElement>(
      "list-headerrow > .key",
    )!;
    header.setPointerCapture = () => {};
    const sizer = header.firstElementChild!.lastElementChild as HTMLElement;
    const start = header.offsetWidth;
    pointer(sizer, "pointerdown", 500);
    pointer(header, "pointermove", 400);
    pointer(header, "pointerup", 400);
    expect(start).toBeCloseTo(container.clientWidth, 0);
    expect(key.offsetWidth).toBeCloseTo(start - 100, 0);
  });
});

describe("List scrolled sideways", () => {
  const wide = (title: string) =>
    list.column({
      title,
      init_width: 20,
      field_gen: () => list.text_field(),
      field_apply: (field, value: string) => (field.text = value),
    });

  it("scrolls the first header cell with its column without lead columns", async () => {
    const container = list.container(
      { transform: (item: string) => ok({ values: { a: item, b: item } }) },
      { columns: { a: wide("A"), b: wide("B") }, rows: ["x"] },
    );
    //Wider than the first column, so a sticky header cell has room to stay
    container.style.width = "30rem";
    document.body.append(container);
    container.scrollLeft = 150;
    //Sticky positions follow the scroll in the next frame
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const header = container.querySelector("list-headerrow > :first-child")!;
    const field = container.querySelector("list-row list-textfield")!;
    expect(header.getBoundingClientRect().left).toBeCloseTo(
      field.getBoundingClientRect().left,
      0,
    );
  });

  it("keeps the key field of add and error rows in place, the button and error text in the value columns", () => {
    const rows = state.from_w<string[]>(["x"]);
    const container = list.container(
      {
        transform: (item: string) =>
          ok({ key_field: { text: item }, values: { a: item, b: item } }),
        sub_rows: true,
      },
      {
        columns: { a: wide("A"), b: wide("B") },
        rows,
        add_row: { text: "Add", on_add: () => {} },
      },
    );
    container.style.width = "20rem";
    document.body.append(container);
    rows.set_err(nice_err("broken"));
    const box = container.getBoundingClientRect();
    container.scrollLeft = 200;
    for (const kind of ["list-addrow", "list-rowserror"]) {
      const key = container.querySelector(`${kind} > list-keyfield`)!;
      expect(key.getBoundingClientRect().left).toBeCloseTo(box.left, 0);
    }
    //After the key field, where the value columns are
    const column_a = container
      .querySelector("list-headerrow > list-headerfield:not(.key)")!
      .getBoundingClientRect().left;
    expect(
      container
        .querySelector("list-rowserror list-error")!
        .getBoundingClientRect().left,
    ).toBeCloseTo(column_a, 0);
    //The button has a small margin in its cell
    const button = container
      .querySelector("list-addrow span.add")!
      .getBoundingClientRect().left;
    expect(button).toBeGreaterThanOrEqual(column_a);
    expect(button).toBeLessThan(column_a + 8);
  });

  it("runs add and error rows from the key column without value columns", () => {
    const rows = state.from_w<string[]>(["x"]);
    const container = list.container(
      {
        transform: (item: string) =>
          ok({ key_field: { text: item }, values: {} }),
        sub_rows: true,
      },
      { columns: {}, rows, add_row: { text: "Add", on_add: () => {} } },
    );
    document.body.append(container);
    rows.set_err(nice_err("broken"));
    for (const kind of ["list-addrow", "list-rowserror"]) {
      const key = container.querySelector(`${kind} > list-keyfield`)!;
      expect(key.classList.contains("tail")).toBe(true);
    }
  });
});
