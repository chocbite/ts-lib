import { define_element } from "#base";
import depot from "@chocbite/ts-lib/depot";
import { NiceError } from "@chocbite/ts-lib/result";
import state, { type State } from "@chocbite/ts-lib/state";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  CanvasGroup,
  canvas_page,
  canvas_widget,
  WIDGETS,
  type CanvasPage,
  CanvasWidget,
  type CanvasWidgetData,
} from "../data";
import {
  selected_widgets,
  selection_of,
  type CanvasSelection,
} from "../selection";
import { group_widgets } from "../group_widget";
import { canvas_link, type CanvasLink } from "../link";
import { reorder_widget as canvas_reorder } from "../order";
import { WidgetSlot } from "../slot";
import { Transformer } from "../transformer";
import { canvas_viewport, type Viewport } from "../viewport";
import { change_geometry, geometry_now } from "../geometry";
import { WidgetBase, type WidgetBaseOptions } from "../widget";
import { made_one } from "./made";

class TestWidget extends WidgetBase {
  static element_name() {
    return "testwidget";
  }
  /**Size the content is laid out at, undefined to not stretch*/
  layout: [number, number] | undefined;
  connects = 0;
  /**Times it was laid out for a new geometry*/
  layouts = 0;
  protected on_geometry(): void {
    this.layouts++;
  }
  protected connectedCallback(): void {
    super.connectedCallback();
    this.connects++;
  }
  protected original_size() {
    return this.layout
      ? { width: this.layout[0], height: this.layout[1] }
      : undefined;
  }
  /**Lays out again after layout changed*/
  layout_at(width: number, height: number) {
    this.layout = [width, height];
    this.relayout();
  }
}
define_element(TestWidget);

const nice_err = (text: string) => new NiceError(Symbol(text), text);

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const frames = async () => {
  await frame();
  await frame();
};

const widget = (x: number, y: number, width: number, height: number) =>
  TestWidget.create({ x, y, width, height });

/**Stubs pointer capture, synthetic pointers can not be captured*/
const stub_capture = (element: Element) => {
  element.setPointerCapture = () => {};
  element.releasePointerCapture = () => {};
  element.hasPointerCapture = () => false;
};

const pointer = (
  target: EventTarget,
  type: string,
  init: PointerEventInit = {},
) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerType: "mouse",
      pointerId: 1,
      button: 0,
      ...init,
    }),
  );

/**The test widget registered in the depot*/
const test_group = WIDGETS.group("canvastest", "Canvas test", "");
const test_definition = test_group.add("testwidget", "Test widget", "", {
  create: (options) => TestWidget.create(options),
});
afterAll(() => test_group.remove());

/**Page data with writable states*/
const page_data = (width = 200, height = 100) => ({
  width: state.ok_w(width),
  height: state.ok_w(height),
  widgets: state.ok_w<CanvasWidgetData[]>([]),
});
type PageData = ReturnType<typeof page_data>;

/**A test widget for a page*/
const item = (x: number, y: number, width: number, height: number) =>
  canvas_widget(test_definition, { x, y, width, height });

/**The widget data of a widget element*/
const item_of = (element: WidgetBase) =>
  (element.parentElement as WidgetSlot).widget;

/**The geometry of the widget of a widget element, as the states of the widget give it*/
const geometry = (element: WidgetBase) => geometry_now(item_of(element))!;

/**Sets options of the widget of a widget element, made with writable states by canvas_widget*/
const set_options = (element: WidgetBase, values: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(values))
    (
      item_of(element).option(key) as ReturnType<typeof state.ok_w<unknown>>
    ).set_ok(value);
};

/**Expects the same element objects in the same order, toEqual compares elements by their content*/
const expect_same = (
  actual: readonly unknown[],
  expected: readonly unknown[],
) => {
  expect(actual.length).toBe(expected.length);
  actual.forEach((element, i) => expect(element).toBe(expected[i]));
};

/**The widget elements a viewport shows*/
const elements = (viewport: Viewport) =>
  [...viewport.querySelectorAll("canvas-slot")].map(
    (slot) => (slot as WidgetSlot).element,
  );

/**The page of the page data, the same page for the same data, so viewports given one data show one page*/
const pages = new WeakMap<PageData, CanvasPage>();
const page_of = (data: PageData): CanvasPage => {
  let page = pages.get(data);
  if (!page) pages.set(data, (page = canvas_page(data)));
  return page;
};

/**400 by 300 pixel viewport showing a 200 by 100 page, so the page is scaled by 2 and centered vertically*/
const make_viewport = async (page: PageData = page_data()) => {
  //The page the viewport shows, it can be selected, with the states of the page data
  const selectable = page_of(page);
  const viewport = canvas_viewport({ page: selectable });
  viewport.style.cssText = "width:400px;height:300px;";
  stub_capture(viewport);
  document.body.appendChild(viewport);
  await frames();
  const container = viewport.querySelector(
    ":scope > .container",
  ) as HTMLDivElement;
  const transformer = viewport.querySelector(
    ":scope > canvas-transformer",
  ) as Transformer;
  const box = viewport.getBoundingClientRect();
  /**Client coordinates of a point on the page*/
  const client = (x: number, y: number) => ({
    clientX: box.left + x * 2,
    clientY: box.top + 50 + y * 2,
  });
  /**Adds a test widget to the page and gives the element the viewport made for it*/
  const place_with = (options: WidgetBaseOptions) => {
    page.widgets.set_ok([
      ...page.widgets.ok(),
      canvas_widget(test_definition, options),
    ]);
    return elements(viewport).at(-1) as TestWidget;
  };
  const place = (x: number, y: number, width: number, height: number) =>
    place_with({ x, y, width, height });
  return {
    viewport,
    page,
    selectable,
    container,
    transformer,
    client,
    box,
    place,
    place_with,
  };
};

describe("Page", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("defaults to full HD", async () => {
    const { viewport } = await make_viewport({} as PageData);
    const page = viewport.querySelector("canvas-page") as HTMLElement;
    expect(page.style.width).toBe("1920px");
    expect(page.style.height).toBe("1080px");
  });

  it("paints the background of the page, the theme color without one", async () => {
    const background = state.ok_w("#ff0000");
    const { viewport } = await make_viewport({
      ...page_data(),
      background,
    } as PageData);
    const element = viewport.querySelector("canvas-page") as HTMLElement;
    expect(getComputedStyle(element).backgroundColor).toBe("rgb(255, 0, 0)");
    background.set_ok("#00ff00");
    expect(getComputedStyle(element).backgroundColor).toBe("rgb(0, 255, 0)");
    const themed = (await make_viewport()).viewport.querySelector(
      "canvas-page",
    ) as HTMLElement;
    expect(themed.style.background).toBe("");
  });

  it("width and height size the page element and follow their states", async () => {
    const { viewport, page } = await make_viewport();
    const element = viewport.querySelector("canvas-page") as HTMLElement;
    expect(element.style.width).toBe("200px");
    page.width.set_ok(300);
    expect(element.style.width).toBe("300px");
  });

  it("makes the widgets in drawing order", async () => {
    const { viewport, page } = await make_viewport();
    const [a, b, c] = [item(1, 0, 1, 1), item(2, 0, 1, 1), item(3, 0, 1, 1)];
    page.widgets.set_ok([a, b, c]);
    expect(elements(viewport).map((e) => geometry(e!).x)).toEqual([1, 2, 3]);
  });

  it("only touches the widgets the state says were added or removed, the others stay connected", async () => {
    const { viewport, page } = await make_viewport();
    const [a, b, c] = [item(1, 0, 1, 1), item(2, 0, 1, 1), item(3, 0, 1, 1)];
    page.widgets.set_ok([a, b, c]);
    const [ea, eb, ec] = elements(viewport) as TestWidget[];
    page.widgets.array.delete(b);
    expect_same(elements(viewport), [ea, ec]);
    expect(eb.isConnected).toBe(false);
    page.widgets.array.push(item(4, 0, 1, 1));
    expect_same(elements(viewport).slice(0, 2), [ea, ec]);
    expect(ea.connects).toBe(1);
    expect(ec.connects).toBe(1);
  });

  it("moves only the moved widget, the elements stay the same", async () => {
    const { viewport, page } = await make_viewport();
    const [a, b, c] = [item(1, 0, 1, 1), item(2, 0, 1, 1), item(3, 0, 1, 1)];
    page.widgets.set_ok([a, b, c]);
    const [ea, eb, ec] = elements(viewport) as TestWidget[];
    page.widgets.array.move(2, 0);
    expect_same(elements(viewport), [ec, ea, eb]);
    expect([ea, eb].map((e) => e.connects)).toEqual([1, 1]);
  });

  it("shows a whole new array of widgets in its order, reusing the slots by place", async () => {
    const { viewport, page } = await make_viewport();
    const [a, b, c] = [item(1, 0, 1, 1), item(2, 0, 1, 1), item(3, 0, 1, 1)];
    page.widgets.set_ok([a, b, c]);
    const slots = [...viewport.querySelectorAll("canvas-slot")];
    page.widgets.set_ok([c, a]);
    expect(elements(viewport).map((e) => geometry(e!).x)).toEqual([3, 1]);
    expect_same(
      [...viewport.querySelectorAll("canvas-slot")],
      slots.slice(0, 2),
    );
  });

  it("keeps the slots and widget elements when put back in the document unchanged", async () => {
    const { viewport, page } = await make_viewport();
    page.widgets.set_ok([item(1, 0, 1, 1), item(2, 0, 1, 1)]);
    const before = elements(viewport);
    viewport.remove();
    document.body.appendChild(viewport);
    expect_same(elements(viewport), before);
  });

  it("moves only the element of a widget ordered with canvas.reorder", async () => {
    const { viewport, page, selectable } = await make_viewport();
    const [a, b, c] = [item(1, 0, 1, 1), item(2, 0, 1, 1), item(3, 0, 1, 1)];
    page.widgets.set_ok([a, b, c]);
    const [ea, eb, ec] = elements(viewport) as TestWidget[];
    expect(
      await canvas_reorder(selectable, [selectable.widget_of(a)], "front"),
    ).toBe(true);
    expect_same(elements(viewport), [eb, ec, ea]);
    expect([eb, ec].map((e) => e.connects)).toEqual([1, 1]);
  });

  it("shows a widget given twice twice, one slot per value", async () => {
    const { viewport, page } = await make_viewport();
    const a = item(1, 0, 1, 1);
    page.widgets.set_ok([a, a]);
    expect(elements(viewport).length).toBe(2);
  });

  it("follows changes made while the viewport was not in the document", async () => {
    const { viewport, page } = await make_viewport();
    const [a, b, c] = [item(1, 0, 1, 1), item(2, 0, 1, 1), item(3, 0, 1, 1)];
    page.widgets.set_ok([a]);
    viewport.remove();
    page.widgets.set_ok([a, b]);
    page.widgets.set_ok([c, a, b]);
    document.body.appendChild(viewport);
    expect(elements(viewport).map((e) => geometry(e!).x)).toEqual([3, 1, 2]);
  });

  it("shows the same page in two viewports, a drag in one moves the widget in both", async () => {
    const page = page_data();
    const first = await make_viewport(page);
    const second = await make_viewport(page);
    const x = state.ok_w(50);
    page.widgets.set_ok([
      canvas_widget(test_definition, { x, y: 25, width: 40, height: 20 }),
    ]);
    const [a] = elements(first.viewport) as TestWidget[];
    const [b] = elements(second.viewport) as TestWidget[];
    expect(a).not.toBe(b);
    change_geometry(item_of(a), { x: 70 });
    expect(x.ok()).toBe(70);
    expect(a.style.left).toBe("70px");
    expect(b.style.left).toBe("70px");
  });

  it("shows an error in the place of a widget until its definition is registered", async () => {
    const { viewport, page } = await make_viewport();
    page.widgets.set_ok([
      {
        widget: "/widgets/canvastest/late",
        options: {
          x: state.ok_w(5),
          width: state.ok_w(10),
        },
      },
    ]);
    const [error] = elements(viewport);
    expect(error!.localName).toBe("canvas-errorwidget");
    expect(error!.style.left).toBe("5px");
    const late = test_group.add("late", "Late", "", {
      create: (options) => TestWidget.create(options),
    });
    try {
      const [widget] = elements(viewport);
      expect(widget!.localName).toBe("canvas-testwidget");
      expect(widget!.style.left).toBe("5px");
    } finally {
      late.remove();
    }
    expect(elements(viewport)[0]!.localName).toBe("canvas-errorwidget");
  });

  it("shows an error for a path that is not a widget", async () => {
    const { viewport, page } = await make_viewport();
    page.widgets.set_ok([{ widget: "/widgets/canvastest", options: {} }]);
    const [error] = elements(viewport);
    expect(error!.localName).toBe("canvas-errorwidget");
    expect(error!.textContent).toContain("is not a widget");
  });
});

describe("Widget", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("positions and sizes itself", () => {
    const w = document.body.appendChild(widget(10, 20, 30, 40));
    expect(w.style.left).toBe("10px");
    expect(w.style.top).toBe("20px");
    expect(w.style.width).toBe("30px");
    expect(w.style.height).toBe("40px");
    expect(w.getBoundingClientRect().width).toBeCloseTo(30);
    expect(w.getBoundingClientRect().height).toBeCloseTo(40);
  });

  it("stretches content laid out at the original size", () => {
    const w = widget(0, 0, 100, 20);
    w.layout_at(50, 10);
    document.body.appendChild(w);
    expect(w.style.width).toBe("50px");
    expect(w.getBoundingClientRect().width).toBeCloseTo(100);
    expect(w.getBoundingClientRect().height).toBeCloseTo(20);
  });

  it("rotates around its center", () => {
    const w = widget(0, 0, 100, 20);
    w.set({ rotation: 90 });
    document.body.appendChild(w);
    const box = w.getBoundingClientRect();
    const body = document.body.getBoundingClientRect();
    expect(box.width).toBeCloseTo(20);
    expect(box.height).toBeCloseTo(100);
    expect(box.left - body.left + box.width / 2).toBeCloseTo(50);
    expect(box.top - body.top + box.height / 2).toBeCloseTo(10);
  });

  it("lays out again for every change of its geometry", () => {
    const w = widget(0, 0, 1, 1);
    const before = w.layouts;
    w.set({ x: 1 });
    w.set({ y: 1 });
    w.set({ width: 2 });
    w.set({ height: 2 });
    w.set({ rotation: 5 });
    expect(w.layouts - before).toBe(5);
    expect(w.style.left).toBe("1px");
    expect(w.style.top).toBe("1px");
    expect(w.style.width).toBe("2px");
  });

  it("follows states, keeping the last good value on errors", () => {
    const x = state.from_w(5);
    const w = document.body.appendChild(TestWidget.create({ x, width: 1 }));
    expect(w.style.left).toBe("5px");
    x.set_ok(7);
    expect(w.style.left).toBe("7px");
    x.set_err(nice_err("gone"));
    expect(w.style.left).toBe("7px");
  });
});

describe("Geometry of widgets", () => {
  it("is read from the states of the widget, a part without a state is 0, a part without a value now is unknown", () => {
    expect(
      geometry_now(
        made_one({
          widget: test_definition.path,
          options: {
            x: state.ok_w(3),
            rotation: state.ok(45),
          },
        }),
      ),
    ).toEqual({ x: 3, y: 0, width: 0, height: 0, rotation: 45 });
    expect(
      geometry_now(
        made_one({
          widget: test_definition.path,
          options: {
            x: state.err_w<number>(nice_err("gone")),
          },
        }),
      ),
    ).toBeUndefined();
  });

  it("is changed by writing writable states, so every element of the widget follows", async () => {
    const x = state.ok_w(5);
    const data = canvas_widget(test_definition, { x, width: 1, height: 1 });
    const { page, viewport } = await make_viewport();
    const second = await make_viewport(page);
    page.widgets.set_ok([data]);
    change_geometry(item_of(elements(viewport)[0]!), { x: 30 });
    expect(x.ok()).toBe(30);
    expect(elements(viewport)[0]!.style.left).toBe("30px");
    expect(elements(second.viewport)[0]!.style.left).toBe("30px");
    document.body.replaceChildren();
  });

  it("leaves parts given as read only states unchanged", () => {
    const x = state.ok_w(5);
    const widget = made_one(
      canvas_widget(test_definition, { x: x.read_only, y: 5 }),
    );
    change_geometry(widget, { x: 30, y: 40 });
    expect(x.ok()).toBe(5);
    expect(geometry_now(widget)).toMatchObject({ x: 5, y: 40 });
  });
});

describe("Widget elements", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("shows its opacity, fully opaque until given", () => {
    const opacity = state.ok_w(0.5);
    const w = document.body.appendChild(TestWidget.create({ opacity }));
    expect(getComputedStyle(w).opacity).toBe("0.5");
    opacity.set_ok(0.25);
    expect(getComputedStyle(w).opacity).toBe("0.25");
    expect(
      getComputedStyle(document.body.appendChild(widget(0, 0, 1, 1))).opacity,
    ).toBe("1");
  });

  it("hides when not visible, visible until given", () => {
    const visible = state.ok_w(false);
    const w = document.body.appendChild(TestWidget.create({ visible }));
    expect(getComputedStyle(w).visibility).toBe("hidden");
    visible.set_ok(true);
    expect(getComputedStyle(w).visibility).toBe("visible");
    expect(
      getComputedStyle(document.body.appendChild(widget(0, 0, 1, 1)))
        .visibility,
    ).toBe("visible");
  });

  it("shows faintly when not visible in an editing viewport, so it can still be selected", async () => {
    const { viewport, place_with } = await make_viewport();
    const w = place_with({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      visible: false,
      opacity: 0.8,
    });
    expect(getComputedStyle(w).visibility).toBe("hidden");
    viewport.set({ edit: true });
    expect(getComputedStyle(w).visibility).toBe("visible");
    expect(Number(getComputedStyle(w).opacity)).toBeLessThan(0.5);
  });
});

describe("Viewport", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("fits and centers the page", async () => {
    const { viewport, container } = await make_viewport();
    expect(viewport.scale).toBe(2);
    expect(container.style.transform).toBe("translate(0px, 50px) scale(2)");
  });

  it("refits when the viewport resizes", async () => {
    const { viewport, container } = await make_viewport();
    viewport.style.width = "200px";
    await frames();
    expect(viewport.scale).toBe(1);
    expect(container.style.transform).toBe("translate(0px, 100px) scale(1)");
  });

  it("refits when the page resizes", async () => {
    const { viewport, page } = await make_viewport();
    page.width.set_ok(400);
    page.height.set_ok(300);
    await frames();
    expect(viewport.scale).toBe(1);
  });

  it("replacing the page removes the old one, the transformer hides as the selected widget is not on the new page", async () => {
    const { viewport, transformer, place } = await make_viewport();
    const old = viewport.querySelector("canvas-page");
    const selected = state.ok_w<CanvasSelection>(undefined);
    viewport.set({ edit: true, selected });
    const placed = item_of(place(0, 0, 10, 10));
    selected.set_ok(placed);
    expect(transformer.hidden).toBe(false);
    viewport.set({ page: canvas_page(page_data()) });
    expect(old!.isConnected).toBe(false);
    expect(viewport.querySelectorAll("canvas-page").length).toBe(1);
    expect(transformer.hidden).toBe(true);
    //The viewport never changes the selection on its own
    expect(selected.ok()).toBe(placed);
  });

  it("follows a state of the page", async () => {
    const { viewport } = await make_viewport();
    const first = canvas_page(page_data(200, 100));
    const second = canvas_page(page_data(400, 100));
    const page = state.ok_w<CanvasPage | undefined>(first);
    viewport.set({ page });
    const element = () => viewport.querySelector("canvas-page") as HTMLElement;
    expect(element().style.width).toBe("200px");
    page.set_ok(second);
    expect(element().style.width).toBe("400px");
    page.set_ok(undefined);
    expect(element()).toBeNull();
  });

  it("does not pan or zoom outside edit mode", async () => {
    const { viewport, container } = await make_viewport();
    const before = container.style.transform;
    const event = new WheelEvent("wheel", {
      deltaY: 100,
      cancelable: true,
      bubbles: true,
    });
    viewport.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(container.style.transform).toBe(before);
  });

  it("edit sets the edit attribute", async () => {
    const { viewport } = await make_viewport();
    viewport.set({ edit: true });
    expect(viewport.hasAttribute("edit")).toBe(true);
    viewport.set({ edit: false });
    expect(viewport.hasAttribute("edit")).toBe(false);
  });

  it("wheel pans in edit mode, shift pans horizontally", async () => {
    const { viewport, container } = await make_viewport();
    viewport.set({ edit: true });
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaX: 10, deltaY: 20, cancelable: true }),
    );
    expect(container.style.transform).toBe("translate(-5px, 40px) scale(2)");
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 20, shiftKey: true, cancelable: true }),
    );
    expect(container.style.transform).toBe("translate(-15px, 40px) scale(2)");
  });

  it("wheel in lines pans by line height", async () => {
    const { viewport, container } = await make_viewport();
    viewport.set({ edit: true });
    viewport.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: 1,
        deltaMode: WheelEvent.DOM_DELTA_LINE,
        cancelable: true,
      }),
    );
    expect(container.style.transform).toBe("translate(0px, 42px) scale(2)");
  });

  it("alt makes the wheel slower", async () => {
    const { viewport, container } = await make_viewport();
    viewport.set({ edit: true });
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 20, altKey: true, cancelable: true }),
    );
    expect(container.style.transform).toBe("translate(0px, 49px) scale(2)");
  });

  it("ctrl wheel zooms keeping the point under the cursor in place", async () => {
    const { viewport, client } = await make_viewport();
    viewport.set({ edit: true });
    window.dispatchEvent(new KeyboardEvent("keydown", { ctrlKey: true }));
    const point = client(50, 25);
    viewport.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -100,
        ctrlKey: true,
        cancelable: true,
        ...point,
      }),
    );
    expect(viewport.scale).toBeCloseTo(2 * Math.exp(0.2));
    //The page point 50,25 stays at the same client position
    const container = viewport.querySelector(
      ":scope > .container",
    ) as HTMLElement;
    const box = viewport.getBoundingClientRect();
    const match = /translate\((.+)px, (.+)px\)/.exec(
      container.style.transform,
    )!;
    expect(box.left + Number(match[1]) + 50 * viewport.scale).toBeCloseTo(
      point.clientX,
    );
    expect(box.top + Number(match[2]) + 25 * viewport.scale).toBeCloseTo(
      point.clientY,
    );
  });

  it("zoom is limited", async () => {
    const { viewport } = await make_viewport();
    viewport.set({ edit: true });
    for (let i = 0; i < 20; i++)
      viewport.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: -1000,
          ctrlKey: true,
          cancelable: true,
        }),
      );
    expect(viewport.scale).toBeCloseTo(2 * 20);
    for (let i = 0; i < 40; i++)
      viewport.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: 1000,
          ctrlKey: true,
          cancelable: true,
        }),
      );
    expect(viewport.scale).toBeCloseTo(2 * 0.1);
  });

  it("leaving edit mode resets the view and hides the transformer, the selection stays", async () => {
    const { viewport, container, transformer, place } = await make_viewport();
    const w = place(0, 0, 10, 10);
    viewport.set({ edit: true, selected: item_of(w) });
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 100, ctrlKey: true, cancelable: true }),
    );
    viewport.set({ edit: false });
    expect(viewport.scale).toBe(2);
    expect(container.style.transform).toBe("translate(0px, 50px) scale(2)");
    expect(transformer.hidden).toBe(true);
    viewport.set({ edit: true });
    expect_same(transformer.widgets, [w].map(item_of));
  });

  it("middle and right mouse drag pan", async () => {
    const { viewport, container } = await make_viewport();
    viewport.set({ edit: true });
    for (const button of [1, 2]) {
      pointer(viewport, "pointerdown", { button, clientX: 100, clientY: 100 });
      pointer(viewport, "pointermove", { clientX: 110, clientY: 90 });
      pointer(viewport, "pointerup", { button, clientX: 110, clientY: 90 });
      pointer(viewport, "pointermove", { clientX: 200, clientY: 200 });
    }
    expect(container.style.transform).toBe("translate(20px, 30px) scale(2)");
  });

  it("shows widgets outside the page in edit mode only", async () => {
    const { viewport } = await make_viewport();
    const page = viewport.querySelector("canvas-page")!;
    expect(getComputedStyle(page).overflow).toBe("hidden");
    viewport.set({ edit: true });
    expect(getComputedStyle(page).overflow).toBe("visible");
  });

  it("prevents the context menu in edit mode only", async () => {
    const { viewport } = await make_viewport();
    const menu = () => {
      const event = new MouseEvent("contextmenu", { cancelable: true });
      viewport.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(menu()).toBe(false);
    viewport.set({ edit: true });
    expect(menu()).toBe(true);
  });

  it("two finger touch pinch zooms around the fingers", async () => {
    const { viewport, client } = await make_viewport();
    viewport.set({ edit: true });
    const touch = (type: string, id: number, x: number, y: number) =>
      pointer(viewport, type, {
        pointerType: "touch",
        pointerId: id,
        ...client(x, y),
      });
    touch("pointerdown", 1, 40, 50);
    touch("pointerdown", 2, 60, 50);
    touch("pointermove", 2, 80, 50);
    expect(viewport.scale).toBeCloseTo(4);
    touch("pointerup", 1, 40, 50);
    touch("pointerup", 2, 80, 50);
    touch("pointermove", 2, 100, 50);
    expect(viewport.scale).toBeCloseTo(4);
  });

  it("one finger touch does not pan", async () => {
    const { viewport, container, client } = await make_viewport();
    viewport.set({ edit: true });
    const before = container.style.transform;
    pointer(viewport, "pointerdown", {
      pointerType: "touch",
      ...client(40, 50),
    });
    pointer(viewport, "pointermove", {
      pointerType: "touch",
      ...client(80, 50),
    });
    expect(container.style.transform).toBe(before);
  });

  it("pressing a widget selects it, pressing the page clears the selection", async () => {
    const { viewport, transformer, place } = await make_viewport();
    const w = place(10, 10, 20, 20);
    const inner = w.appendChild(document.createElement("span"));
    viewport.set({ edit: true });
    pointer(inner, "pointerdown");
    expect_same(transformer.widgets, [w].map(item_of));
    expect(transformer.hidden).toBe(false);
    pointer(viewport.querySelector("canvas-page")!, "pointerdown");
    expect(transformer.widgets).toHaveLength(0);
    expect(transformer.hidden).toBe(true);
  });

  it("does not select outside edit mode", async () => {
    const { viewport, place } = await make_viewport();
    const selected = state.ok_w<CanvasSelection>(undefined);
    viewport.set({ selected });
    const w = place(10, 10, 20, 20);
    pointer(w, "pointerdown");
    expect(selected.ok()).toBeUndefined();
  });

  it("writes a writable selection state, so viewports share the selection", async () => {
    const page = page_data();
    const first = await make_viewport(page);
    const second = await make_viewport(page);
    const selected = state.ok_w<CanvasSelection>(undefined);
    first.viewport.set({ edit: true, selected });
    second.viewport.set({ edit: true, selected });
    const a = first.place(10, 10, 20, 20);
    pointer(a, "pointerdown");
    expect(selected.ok()).toBe(item_of(a));
    expect_same(first.transformer.widgets, [a].map(item_of));
    const b = elements(second.viewport)[0]!;
    expect_same(second.transformer.widgets, [b].map(item_of));
  });

  it("does not change a read only selection state", async () => {
    const { viewport, transformer, place } = await make_viewport();
    const w = place(10, 10, 20, 20);
    const selected = state.ok_w<CanvasSelection>(undefined);
    viewport.set({ edit: true, selected: selected.read_only });
    pointer(w, "pointerdown");
    expect(transformer.widgets).toHaveLength(0);
    selected.set_ok(item_of(w));
    expect_same(transformer.widgets, [w].map(item_of));
  });

  it("listens to the keyboard only while connected in edit mode", async () => {
    const { viewport } = await make_viewport();
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    try {
      viewport.set({ edit: true });
      viewport.remove();
      const added = add.mock.calls.map(([type, l]) => [type, l]);
      const removed = remove.mock.calls.map(([type, l]) => [type, l]);
      expect(added.length).toBeGreaterThan(0);
      for (const call of added) expect(removed).toContainEqual(call);
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe("Selecting several widgets", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  /**Three widgets in an editing viewport sharing a selection state*/
  const three = async () => {
    const made = await make_viewport();
    const selected = state.ok_w<CanvasSelection>(undefined);
    made.viewport.set({ edit: true, selected });
    const a = made.place(10, 10, 20, 20);
    const b = made.place(50, 10, 20, 20);
    const c = made.place(120, 60, 20, 20);
    return { ...made, selected, a, b, c };
  };

  it("ctrl or shift click toggles a widget, a plain click selects only it", async () => {
    const { selected, a, b, c } = await three();
    pointer(a, "pointerdown");
    pointer(b, "pointerdown", { ctrlKey: true });
    pointer(c, "pointerdown", { shiftKey: true });
    expect(selected_widgets(selected.ok())).toEqual([a, b, c].map(item_of));
    pointer(b, "pointerdown", { ctrlKey: true });
    expect(selected_widgets(selected.ok())).toEqual([a, c].map(item_of));
    pointer(c, "pointerdown");
    expect(selected.ok()).toBe(item_of(c));
  });

  it("ctrl+a selects all widgets while the viewport has focus, which pressing it gives", async () => {
    const { viewport, selected, a, b, c } = await three();
    const ctrl_a = (target: EventTarget) =>
      target.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "a",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    //Elsewhere, like in a text field, ctrl+a is left alone
    expect(ctrl_a(document.body)).toBe(true);
    expect(selected.ok()).toBeUndefined();
    pointer(viewport.querySelector("canvas-page")!, "pointerdown");
    expect(document.activeElement).toBe(viewport);
    expect(ctrl_a(viewport)).toBe(false);
    expect(selected_widgets(selected.ok())).toEqual([a, b, c].map(item_of));
    viewport.set({ edit: false });
    selected.set_ok(undefined);
    ctrl_a(viewport);
    expect(selected.ok()).toBeUndefined();
  });

  it("delete removes the selected widgets while the viewport has focus", async () => {
    const { viewport, page, selected, a, b, c } = await three();
    pointer(a, "pointerdown");
    pointer(c, "pointerdown", { ctrlKey: true });
    const key = (key: string) =>
      viewport.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
    expect(key("Delete")).toBe(false);
    await new Promise((resolve) => setTimeout(resolve));
    expect(page.widgets.ok()).toEqual([item_of(b).data]);
    expect(selected.ok()).toBeUndefined();
    pointer(elements(viewport)[0]!, "pointerdown");
    key("Backspace");
    await new Promise((resolve) => setTimeout(resolve));
    expect(page.widgets.ok()).toEqual([]);
  });

  it("copy and paste of the system paste copies of the selected widgets and select them, cut removes them", async () => {
    const { viewport, page, selected, a, b } = await three();
    pointer(a, "pointerdown");
    pointer(b, "pointerdown", { ctrlKey: true });
    //Ctrl+x, ctrl+c and ctrl+v give these events on the focused viewport, with the clipboard of the system
    const clipboard = new DataTransfer();
    const event = (type: "copy" | "cut" | "paste") =>
      viewport.dispatchEvent(
        new ClipboardEvent(type, {
          clipboardData: clipboard,
          bubbles: true,
          cancelable: true,
        }),
      );
    expect(event("copy")).toBe(false);
    const copied = JSON.parse(clipboard.getData("text/plain")) as {
      widgets: unknown[];
    };
    expect(copied.widgets).toHaveLength(2);
    event("paste");
    await new Promise((resolve) => setTimeout(resolve));
    const widgets = page.widgets.ok();
    expect(widgets).toHaveLength(5);
    expect(selected_widgets(selected.ok())).toEqual(
      widgets.slice(3).map((data) => page_of(page).widget_of(data)),
    );
    event("cut");
    await new Promise((resolve) => setTimeout(resolve));
    expect(page.widgets.ok()).toEqual(widgets.slice(0, 3));
    expect(selected.ok()).toBeUndefined();
  });

  it("with the page selected, a ctrl click selects only the widget and a press on the empty page clears it", async () => {
    const { viewport, selectable, selected, transformer, a } = await three();
    selected.set_ok(selectable);
    expect(transformer.widgets).toHaveLength(0);
    //The page and its widgets are not selected together
    pointer(a, "pointerdown", { ctrlKey: true });
    expect(selected.ok()).toBe(item_of(a));
    selected.set_ok(selectable);
    pointer(viewport.querySelector("canvas-page")!, "pointerdown");
    expect(selected.ok()).toBeUndefined();
  });

  it("a ctrl click on the empty page keeps the selection", async () => {
    const { viewport, selected, a } = await three();
    pointer(a, "pointerdown");
    pointer(viewport.querySelector("canvas-page")!, "pointerdown", {
      ctrlKey: true,
    });
    expect(selected.ok()).toBe(item_of(a));
  });

  it("a drag on the empty page selects the widgets fully inside the rectangle", async () => {
    const { viewport, selected, client, a, b, c } = await three();
    const page = viewport.querySelector("canvas-page")!;
    const rectangle = (
      from: [number, number],
      to: [number, number],
      keys: { ctrlKey?: boolean } = {},
    ) => {
      pointer(page, "pointerdown", { ...client(...from), ...keys });
      pointer(viewport, "pointermove", { ...client(...to), ...keys });
      expect(viewport.querySelector(".marquee")).not.toBeNull();
      pointer(viewport, "pointerup", { ...client(...to), ...keys });
      expect(viewport.querySelector(".marquee")).toBeNull();
    };
    //b is only partly inside
    rectangle([5, 5], [60, 40]);
    expect(selected.ok()).toBe(item_of(a));
    rectangle([100, 50], [150, 90], { ctrlKey: true });
    expect(selected_widgets(selected.ok())).toEqual([a, c].map(item_of));
    rectangle([5, 5], [150, 90]);
    expect(selected_widgets(selected.ok())).toEqual([a, b, c].map(item_of));
  });

  it("keeps the selection on a right click on a selected widget, the menu orders them all", async () => {
    const { page, selected, client, viewport, a, b, c } = await three();
    pointer(a, "pointerdown");
    pointer(c, "pointerdown", { ctrlKey: true });
    const at = client(15, 15);
    pointer(viewport, "pointerdown", { button: 2, ...at });
    pointer(viewport, "pointerup", { button: 2, ...at });
    expect(selected_widgets(selected.ok())).toEqual([a, c].map(item_of));
    [
      ...document.querySelectorAll<HTMLElement>(
        "contextmenu-container contextmenu-option",
      ),
    ]
      .find((option) => option.textContent === "Send to back")!
      .click();
    await new Promise((resolve) => setTimeout(resolve));
    expect(page.widgets.ok()).toEqual([a, c, b].map((e) => item_of(e).data));
    (document.activeElement as HTMLElement | null)?.blur();
    document.querySelector("contextmenu-container")?.replaceChildren();
  });
});

describe("Viewport menu", () => {
  afterEach(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.querySelector("contextmenu-container")?.replaceChildren();
    //Viewports left behind move the next one, which the client points of a test are taken from
    document.body.replaceChildren();
  });

  const options = () =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "contextmenu-container contextmenu-option, contextmenu-container contextmenu-submenu",
      ),
    ].map((option) => option.textContent);
  const option = (text: string) =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "contextmenu-container contextmenu-option, contextmenu-container contextmenu-submenu",
      ),
    ].find((option) => option.textContent === text)!;

  /**Two overlapping widgets in an editing viewport sharing a selection state*/
  const overlapping = async () => {
    const made = await make_viewport();
    const selected = state.ok_w<CanvasSelection>(undefined);
    made.viewport.set({ edit: true, selected });
    const under = made.place_with({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      id: "Under",
    });
    const over = made.place_with({
      x: 20,
      y: 20,
      width: 50,
      height: 50,
      id: "Over",
    });
    const right_click = (x: number, y: number, move = 0) => {
      const at = made.client(x, y);
      pointer(made.viewport, "pointerdown", { button: 2, ...at });
      const to = { clientX: at.clientX + move, clientY: at.clientY };
      pointer(made.viewport, "pointermove", to);
      pointer(made.viewport, "pointerup", { button: 2, ...to });
    };
    return { ...made, selected, under, over, right_click };
  };

  it("opens on a right click without moving, selecting the widget in front at the point", async () => {
    const { selected, over, right_click } = await overlapping();
    right_click(30, 30);
    expect(selected.ok()).toBe(item_of(over));
    expect(options()).toEqual([
      "CutCtrl+X",
      "CopyCtrl+C",
      "PasteCtrl+V",
      "DeleteDel",
      "GroupCtrl+G",
      "UngroupCtrl+Shift+G",
      "Bring to front",
      "Move forward",
      "Move backward",
      "Send to back",
      "Select covered",
    ]);
  });

  it("does not open on a right drag, which pans", async () => {
    const { right_click, container } = await overlapping();
    const before = container.style.transform;
    right_click(30, 30, 40);
    expect(options()).toEqual([]);
    expect(container.style.transform).not.toBe(before);
  });

  it("opens a menu of the viewport where there is no widget, keeping the selection", async () => {
    const { selected, right_click, under, over } = await overlapping();
    right_click(10, 10);
    (document.activeElement as HTMLElement | null)?.blur();
    document.querySelector("contextmenu-container")?.replaceChildren();
    right_click(150, 80);
    expect(options()).toEqual([
      "PasteCtrl+V",
      "Add widget",
      "Select allCtrl+A",
      "Center view",
    ]);
    expect(selected.ok()).toBe(item_of(under));
    option("Select allCtrl+A").click();
    expect(selected_widgets(selected.ok())).toEqual([under, over].map(item_of));
  });

  it("opens on a long press on touch", async () => {
    const { viewport, selected, under, client } = await overlapping();
    viewport.dispatchEvent(
      new PointerEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        pointerType: "touch",
        ...client(10, 10),
      }),
    );
    expect(selected.ok()).toBe(item_of(under));
    expect(options()).toContain("Bring to front");
  });

  it("deletes the selected widgets, or the one clicked when it is not selected", async () => {
    const { page, selected, under, over, right_click } = await overlapping();
    right_click(10, 10);
    expect(options()).toContain("DeleteDel");
    option("DeleteDel").click();
    await new Promise((resolve) => setTimeout(resolve));
    expect(page.widgets.ok()).toEqual([item_of(over).data]);
    expect(selected.ok()).toBeUndefined();
    void under;
  });

  it("pastes copied widgets at the point of the menu of the viewport, and selects them", async () => {
    const { page, selected, under, right_click } = await overlapping();
    right_click(10, 10);
    option("CopyCtrl+C").click();
    await new Promise((resolve) => setTimeout(resolve));
    (document.activeElement as HTMLElement | null)?.blur();
    document.querySelector("contextmenu-container")?.replaceChildren();
    right_click(150, 80);
    option("PasteCtrl+V").click();
    //The menu asks the browser whether the clipboard of the system may be read first
    await vi.waitFor(() => expect(page.widgets.ok()).toHaveLength(3));
    const widgets = page.widgets.ok();
    const copy = widgets[2];
    expect(copy.widget).toBe(item_of(under).widget);
    //At the point, pulled up to stay in view, the 50 high widget would reach 130 and the viewport shows down to 125
    expect(
      ["x", "y"].map((key) =>
        (copy.options as Record<string, { ok(): unknown }>)[key].ok(),
      ),
    ).toEqual([150, 75]);
    expect(selected.ok()).toBe(page_of(page).widget_of(copy));
  });

  it("keeps pasted widgets inside the area the viewport shows", async () => {
    const { viewport, page, client } = await overlapping();
    //A widget copied far off in another browser
    const clipboard = new DataTransfer();
    clipboard.setData(
      "text/plain",
      JSON.stringify({
        format: "chocbite-canvas-widgets",
        widgets: [
          {
            widget: "/widgets/canvastest/testwidget",
            options: { x: 1000, y: 1000, width: 10, height: 10 },
          },
        ],
      }),
    );
    pointer(
      viewport.querySelector("canvas-page")!,
      "pointerdown",
      client(150, 80),
    );
    viewport.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: clipboard,
        bubbles: true,
        cancelable: true,
      }),
    );
    await vi.waitFor(() => expect(page.widgets.ok()).toHaveLength(3));
    const pasted = page.widgets.ok()[2];
    //The 200 by 100 page fills the 400 wide viewport at scale 2, 25 units show above and below it
    expect(
      ["x", "y"].map((key) =>
        (pasted.options as Record<string, { ok(): unknown }>)[key].ok(),
      ),
    ).toEqual([190, 115]);
  });

  it("adds widgets picked in the widget selector at the point of the menu, and selects them", async () => {
    const { page, selected, right_click } = await overlapping();
    right_click(150, 80);
    option("Add widget").click();
    await new Promise((resolve) => setTimeout(resolve));
    const panel = document.querySelector("depot-selector")!;
    const input = panel.querySelector("input")!;
    input.value = "Test widget";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    //Enter searches without the delay of the list
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    [...panel.querySelectorAll<HTMLElement>("list-row")]
      .find(
        (row) =>
          row.querySelector("list-keyfield")!.textContent === "Test widget",
      )!
      .querySelector<HTMLElement>("list-keyfield")!
      .click();
    [...panel.querySelectorAll<HTMLElement>("form-button")]
      .find((button) => button.textContent === "Select")!
      .click();
    await vi.waitFor(() => expect(page.widgets.ok()).toHaveLength(3));
    const added = page.widgets.ok()[2];
    expect(added.widget).toBe(test_definition.path);
    expect(
      ["x", "y"].map((key) =>
        (added.options as Record<string, { ok(): unknown }>)[key].ok(),
      ),
    ).toEqual([150, 80]);
    expect(selected.ok()).toBe(page_of(page).widget_of(added));
  });

  it("center view resets zoom and pan to the view the viewport starts with", async () => {
    const { viewport, container, client, box } = await overlapping();
    const start = container.style.transform;
    viewport.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -200,
        ctrlKey: true,
        cancelable: true,
        bubbles: true,
        ...client(50, 50),
      }),
    );
    expect(container.style.transform).not.toBe(start);
    (document.activeElement as HTMLElement | null)?.blur();
    document.querySelector("contextmenu-container")?.replaceChildren();
    //The bottom right corner, empty after zooming in at the top left
    const corner = {
      clientX: box.right - 2,
      clientY: box.bottom - 2,
    };
    pointer(viewport, "pointerdown", { button: 2, ...corner });
    pointer(viewport, "pointerup", { button: 2, ...corner });
    option("Center view").click();
    expect(container.style.transform).toBe(start);
  });

  it("orders the widget", async () => {
    const { page, selected, under, over, right_click } = await overlapping();
    right_click(10, 10);
    expect(selected.ok()).toBe(item_of(under));
    option("Bring to front").click();
    await new Promise((resolve) => setTimeout(resolve));
    expect(page.widgets.ok()).toEqual([
      item_of(over).data,
      item_of(under).data,
    ]);
  });

  it("selects a covered widget, from the widgets at the point front first by id", async () => {
    const { selected, under, right_click } = await overlapping();
    right_click(30, 30);
    option("Select covered").click();
    await new Promise((resolve) => setTimeout(resolve));
    //The selected widget has a checkmark
    expect(options().slice(11)).toEqual(["Over✓", "Under"]);
    option("Under").click();
    expect(selected.ok()).toBe(item_of(under));
  });

  it("finds rotated widgets by their outline", async () => {
    const { selected, place_with, right_click } = await overlapping();
    //A 100 by 10 bar turned upright, centered on 150,50
    const bar = place_with({
      x: 100,
      y: 45,
      width: 100,
      height: 10,
      rotation: 90,
      id: "Bar",
    });
    right_click(150, 20);
    expect(selected.ok()).toBe(item_of(bar));
    (document.activeElement as HTMLElement | null)?.blur();
    document.querySelector("contextmenu-container")?.replaceChildren();
    //Beside the upright bar, inside where it was before turning, only the menu of the viewport
    right_click(120, 50);
    expect(options()).toContain("Select allCtrl+A");
    expect(options()).not.toContain("DeleteDel");
  });
});

/**The element of a widget on the level a viewport edits, the content of a group, or the page*/
const element_of_level = (viewport: Viewport, widget: CanvasWidget) => {
  const page =
    viewport.querySelector(":scope > .level > canvas-page") ??
    viewport.querySelector(":scope > .container > canvas-page")!;
  return [...page.querySelectorAll(":scope > canvas-slot")].find(
    (slot) => (slot as WidgetSlot).widget === widget,
  )!.firstElementChild as WidgetBase;
};

describe("Editing inside groups", () => {
  afterEach(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.querySelector("contextmenu-container")?.replaceChildren();
    document.body.replaceChildren();
  });

  /**An editing viewport of a page of A, and G, a group of B and C, sharing a selection state*/
  const with_group = async () => {
    const made = await make_viewport();
    const selected = state.ok_w<CanvasSelection>(undefined);
    made.viewport.set({ edit: true, selected });
    const a = item_of(
      made.place_with({ x: 10, y: 10, width: 20, height: 20, id: "A" }),
    );
    const on_page = [
      made.place_with({ x: 100, y: 10, width: 20, height: 20, id: "B" }),
      made.place_with({ x: 140, y: 40, width: 20, height: 20, id: "C" }),
    ].map(item_of);
    const g = (await group_widgets(made.selectable, on_page))!;
    //Grouped, B and C are the widgets the content of the group makes
    const [b, c] = on_page.map((widget) => g.content.widget_of(widget.data));
    (g.data.options.id as ReturnType<typeof state.ok_w<string>>).set_ok("G");
    await frames();
    /**The widgets the viewport shows now*/
    /**The page the viewport edits on now, the content of a group in the level layer, or the page*/
    const level_page = () =>
      made.viewport.querySelector(":scope > .level > canvas-page") ??
      made.viewport.querySelector(":scope > .container > canvas-page")!;
    const shown = () =>
      [...level_page().querySelectorAll(":scope > canvas-slot")].map(
        (slot) => (slot as WidgetSlot).widget,
      );
    /**The element of a widget on the level edited now*/
    const element_of = (widget: CanvasWidget) =>
      [...level_page().querySelectorAll(":scope > canvas-slot")].find(
        (slot) => (slot as WidgetSlot).widget === widget,
      )!.firstElementChild as WidgetBase;
    /**The element of a widget inside the group on the page, as the group shows it*/
    const in_group = (widget: CanvasWidget) =>
      [
        ...made.viewport.querySelectorAll(
          ":scope > .container canvas-groupwidget canvas-slot",
        ),
      ].find((slot) => (slot as WidgetSlot).widget === widget)!
        .firstElementChild as WidgetBase;
    const bar = () =>
      made.viewport.querySelector<HTMLElement>(":scope > .path");
    const menu_option = (text: string) =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "contextmenu-container contextmenu-option",
        ),
      ].find((option) => option.textContent === text);
    const right_click = (x: number, y: number) => {
      const at = made.client(x, y);
      pointer(made.viewport, "pointerdown", { button: 2, ...at });
      pointer(made.viewport, "pointerup", { button: 2, ...at });
    };
    return {
      ...made,
      selected,
      a,
      b,
      c,
      g,
      shown,
      bar,
      menu_option,
      right_click,
      element_of,
      in_group,
      level_page,
    };
  };

  it("edit in the menu of a group shows its content, exit goes back up and selects the group", async () => {
    const { shown, bar, menu_option, right_click, selected, a, b, c, g } =
      await with_group();
    expect(shown()).toEqual([a, g]);
    expect(bar()).toBeNull();
    right_click(130, 30);
    expect(selected.ok()).toBe(g);
    menu_option("Edit")!.click();
    await frames();
    expect(shown()).toEqual([b, c]);
    expect(selected.ok()).toBeUndefined();
    expect(bar()!.textContent).toContain("G");
    //A round button with a door
    expect(bar()!.querySelector(".exit > svg")).not.toBeNull();
    bar()!.querySelector<HTMLElement>(".exit")!.click();
    await frames();
    expect(shown()).toEqual([a, g]);
    expect(bar()).toBeNull();
    expect(selected.ok()).toBe(g);
  });

  it("keeps the widgets where the group shows them, a turned and scaled group too", async () => {
    const { selected, g, b, c, viewport, element_of, in_group } =
      await with_group();
    const option = (key: string) =>
      (g.options as Record<string, ReturnType<typeof state.ok_w<number>>>)[key];
    //The group is turned and twice as big
    option("rotation").set_ok(30);
    option("width").set_ok(option("width").ok() * 2);
    option("height").set_ok(option("height").ok() * 2);
    await frames();
    const before = [b, c].map((w) => in_group(w).getBoundingClientRect());
    selected.set_ok(c);
    await frames();
    const after = [b, c].map((w) => element_of(w).getBoundingClientRect());
    after.forEach((rect, i) => {
      expect(rect.left).toBeCloseTo(before[i].left, 0);
      expect(rect.top).toBeCloseTo(before[i].top, 0);
      expect(rect.width).toBeCloseTo(before[i].width, 0);
      expect(rect.height).toBeCloseTo(before[i].height, 0);
    });
    //The transformer is turned with the group, around the widget
    const transformer = viewport.querySelector(
      ":scope > canvas-transformer",
    ) as HTMLElement;
    expect(transformer.style.transform).toBe("rotate(30deg)");
    const box = transformer.getBoundingClientRect();
    expect(box.left + box.width / 2).toBeCloseTo(
      after[1].left + after[1].width / 2,
      0,
    );
  });

  it("edits the content of a stretched group fitted evenly, so nothing is slanted", async () => {
    const { selected, g, c, element_of } = await with_group();
    const option = (key: string) =>
      (g.options as Record<string, ReturnType<typeof state.ok_w<unknown>>>)[
        key
      ];
    option("display").set_ok("stretch");
    //Four times as wide, as high as before
    option("width").set_ok((option("width").ok() as number) * 4);
    await frames();
    selected.set_ok(c);
    await frames();
    //The view scales by 2 and the content keeps its proportions, 20 by 20 stays square
    const rect = element_of(c).getBoundingClientRect();
    expect(rect.width).toBeCloseTo(rect.height, 0);
  });

  it("shows the page grayed behind the group edited, the group itself hidden", async () => {
    const { viewport, selected, c } = await with_group();
    const container = viewport.querySelector(
      ":scope > .container",
    ) as HTMLElement;
    const group_element = () =>
      container.querySelector("canvas-groupwidget") as HTMLElement;
    expect(getComputedStyle(container).filter).toBe("none");
    selected.set_ok(c);
    await frames();
    expect(getComputedStyle(container).filter).toContain("grayscale");
    expect(getComputedStyle(container).pointerEvents).toBe("none");
    expect(getComputedStyle(group_element()).visibility).toBe("hidden");
    viewport.set({ edit: false });
    await frames();
    expect(getComputedStyle(container).filter).toBe("none");
    expect(getComputedStyle(group_element()).visibility).toBe("visible");
  });

  it("shows the canvas of the group edited with a backdrop and an outline, following its size", async () => {
    const { viewport, selected, g, c } = await with_group();
    const back = () =>
      viewport.querySelector<HTMLElement>(":scope > .area-back");
    const line = () =>
      viewport.querySelector<SVGElement>(":scope > .area-line polygon.canvas");
    expect(back()).toBeNull();
    expect(line()).toBeNull();
    selected.set_ok(c);
    await frames();
    const group = viewport
      .querySelector(":scope > .container canvas-groupwidget")!
      .getBoundingClientRect();
    //Behind the content, the outline on top of it
    const children = [...viewport.children];
    const level = viewport.querySelector(":scope > .level")!;
    expect(children.indexOf(back()!)).toBeLessThan(children.indexOf(level));
    expect(children.indexOf(line()!.parentElement!)).toBeGreaterThan(
      children.indexOf(level),
    );
    //Grouped from the widgets, the canvas is the group
    const area = () => line()!.getBoundingClientRect();
    expect(area().left).toBeCloseTo(group.left, 0);
    expect(area().top).toBeCloseTo(group.top, 0);
    expect(area().width).toBeCloseTo(group.width, 0);
    expect(area().height).toBeCloseTo(group.height, 0);
    expect(getComputedStyle(back()!).clipPath).toContain("polygon");
    //Twice as wide, scaled to fit the group it is half as high and centered
    const width = (
      g.options as Record<string, ReturnType<typeof state.ok_w<number>>>
    ).content_width;
    width.set_ok(width.ok() * 2);
    await frames();
    expect(area().width).toBeCloseTo(group.width, 0);
    expect(area().height).toBeCloseTo(group.height / 2, 0);
    expect(area().top).toBeCloseTo(group.top + group.height / 4, 0);
    //Gone on the page
    viewport.set({ edit: false });
    await frames();
    expect(back()).toBeNull();
    expect(line()).toBeNull();
  });

  it("outlines the bounds of the group edited, which keep when the canvas changes", async () => {
    const { viewport, selected, g, c } = await with_group();
    selected.set_ok(c);
    await frames();
    const bounds = () =>
      viewport
        .querySelector<SVGElement>(":scope > .area-line polygon.bounds")!
        .getBoundingClientRect();
    const group = () =>
      viewport
        .querySelector(":scope > .container canvas-groupwidget")!
        .getBoundingClientRect();
    const same = () => {
      expect(bounds().left).toBeCloseTo(group().left, 0);
      expect(bounds().top).toBeCloseTo(group().top, 0);
      expect(bounds().width).toBeCloseTo(group().width, 0);
      expect(bounds().height).toBeCloseTo(group().height, 0);
    };
    same();
    const option = (key: string) =>
      (g.options as Record<string, ReturnType<typeof state.ok_w<number>>>)[key];
    //The canvas changes, the bounds of the widget stay
    option("content_width").set_ok(option("content_width").ok() * 2);
    await frames();
    same();
    //The widget changes, the bounds follow
    option("width").set_ok(option("width").ok() + 30);
    option("rotation").set_ok(90);
    await frames();
    same();
  });

  it("moves a widget in a scaled group by the movement of the pointer", async () => {
    const { selected, g, c, viewport } = await with_group();
    const option = (key: string) =>
      (g.options as Record<string, ReturnType<typeof state.ok_w<number>>>)[key];
    option("width").set_ok(option("width").ok() * 2);
    option("height").set_ok(option("height").ok() * 2);
    selected.set_ok(c);
    await frames();
    const before = (c.options.x as ReturnType<typeof state.ok_w<number>>).ok();
    const move = viewport.querySelector<HTMLElement>(
      ":scope > canvas-transformer > .handle.move",
    )!;
    const rect = move.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    pointer(move, "pointerdown", { clientX: x, clientY: y });
    //The view scales by 2 and the group by 2, 40 pixels are 10 units of the content
    pointer(window, "pointermove", { clientX: x + 40, clientY: y });
    pointer(window, "pointerup", { clientX: x + 40, clientY: y });
    expect(
      (c.options.x as ReturnType<typeof state.ok_w<number>>).ok(),
    ).toBeCloseTo(before + 10);
  });

  it("places the content again when the content size or display of a group of the path changes", async () => {
    const { selected, g, b, c, element_of, in_group } = await with_group();
    selected.set_ok(c);
    await frames();
    const option = (key: string) =>
      (g.options as Record<string, ReturnType<typeof state.ok_w<unknown>>>)[
        key
      ];
    //Made elsewhere, like in another editor, the group shows its content at half the size
    option("content_width").set_ok(
      (option("content_width").ok() as number) * 2,
    );
    option("content_height").set_ok(
      (option("content_height").ok() as number) * 2,
    );
    await frames();
    const placed = () =>
      [b, c].map((w) => [
        element_of(w).getBoundingClientRect(),
        in_group(w).getBoundingClientRect(),
      ]);
    for (const [edited, shown] of placed()) {
      expect(edited.left).toBeCloseTo(shown.left, 0);
      expect(edited.width).toBeCloseTo(shown.width, 0);
    }
    option("display").set_ok("clip");
    await frames();
    for (const [edited, shown] of placed()) {
      expect(edited.left).toBeCloseTo(shown.left, 0);
      expect(edited.width).toBeCloseTo(shown.width, 0);
    }
  });

  it("leaves a press on the scrollbar of a group to the scrollbar", async () => {
    const { viewport, selected, g } = await with_group();
    const option = (key: string) =>
      (g.options as Record<string, ReturnType<typeof state.ok_w<unknown>>>)[
        key
      ];
    option("display").set_ok("scroll");
    //Smaller than its content, so it scrolls
    option("width").set_ok(30);
    option("height").set_ok(20);
    await frames();
    const group_element = viewport.querySelector(
      ":scope > .container canvas-groupwidget",
    ) as HTMLElement;
    expect(group_element.scrollWidth).toBeGreaterThan(
      group_element.clientWidth,
    );
    //A press on the scrollbar has the scrolling element as its target
    const press = new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerType: "mouse",
      pointerId: 1,
      button: 0,
    });
    group_element.dispatchEvent(press);
    expect(selected.ok()).toBeUndefined();
    expect(press.defaultPrevented).toBe(false);
    //Selected, the edges of the transformer let presses through to the scrollbars
    selected.set_ok(g);
    await frames();
    const side = viewport.querySelector(
      ":scope > canvas-transformer > .side.right",
    ) as HTMLElement;
    expect(getComputedStyle(side).pointerEvents).toBe("none");
  });

  it("a double click on a group edits inside it", async () => {
    const { viewport, shown, b, c } = await with_group();
    //At the point of the group, a selected group has its transformer over it
    const box = viewport
      .querySelector(":scope > .container canvas-groupwidget")!
      .getBoundingClientRect();
    viewport.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
      }),
    );
    await frames();
    expect(shown()).toEqual([b, c]);
  });

  it("a double click where there is no widget of the level goes up one level", async () => {
    const { viewport, shown, selected, a, g, c } = await with_group();
    selected.set_ok(c);
    await frames();
    //On a widget of the level the level is kept
    const on = element_of_level(viewport, c).getBoundingClientRect();
    viewport.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        clientX: on.left + on.width / 2,
        clientY: on.top + on.height / 2,
      }),
    );
    await frames();
    expect(shown()).not.toEqual([a, g]);
    //Beside it, where only the grayed page is, it goes up
    const view = viewport.getBoundingClientRect();
    viewport.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        clientX: view.left + 2,
        clientY: view.bottom - 2,
      }),
    );
    await frames();
    expect(shown()).toEqual([a, g]);
    expect(selected.ok()).toBe(g);
  });

  it("ctrl click selects a widget pasted into a group after grouping and cutting", async () => {
    const made = await make_viewport();
    const selected = state.ok_w<CanvasSelection>(undefined);
    made.viewport.set({ edit: true, selected });
    const [ea, eb, ec] = [
      made.place_with({ x: 10, y: 10, width: 20, height: 20, id: "A" }),
      made.place_with({ x: 100, y: 10, width: 20, height: 20, id: "B" }),
      made.place_with({ x: 140, y: 40, width: 20, height: 20, id: "C" }),
    ];
    const key = (init: KeyboardEventInit) =>
      made.viewport.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          ...init,
        }),
      );
    const clipboard = new DataTransfer();
    const clip = (type: "cut" | "paste") =>
      made.viewport.dispatchEvent(
        new ClipboardEvent(type, {
          clipboardData: clipboard,
          bubbles: true,
          cancelable: true,
        }),
      );
    //Select two widgets and group them
    pointer(eb, "pointerdown");
    pointer(ec, "pointerdown", { ctrlKey: true });
    key({ key: "g", ctrlKey: true });
    await vi.waitFor(() => expect(made.page.widgets.ok()).toHaveLength(2));
    const g = made.page.widgets.ok()[1];
    await frames();
    //Cut a widget
    pointer(ea, "pointerdown");
    clip("cut");
    await vi.waitFor(() => expect(made.page.widgets.ok()).toEqual([g]));
    //Enter the group and paste
    const group_box = made.viewport
      .querySelector(":scope > .container canvas-groupwidget")!
      .getBoundingClientRect();
    made.viewport.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        clientX: group_box.left + group_box.width / 2,
        clientY: group_box.top + group_box.height / 2,
      }),
    );
    await frames();
    clip("paste");
    await vi.waitFor(() => expect(selected.ok()).toBeInstanceOf(CanvasWidget));
    const pasted = selected.ok() as CanvasWidget;
    await frames();
    //Ctrl click takes it out and puts it back
    const element = element_of_level(made.viewport, pasted);
    pointer(element, "pointerdown", { ctrlKey: true });
    expect(selected.ok()).toBeUndefined();
    pointer(element, "pointerdown", { ctrlKey: true });
    expect(selected.ok()).toBe(pasted);
    //And a widget of the group with it
    const group = made.selectable.widget_of(g) as CanvasGroup;
    const inside = group.content.widgets_now()[0];
    pointer(element_of_level(made.viewport, inside), "pointerdown", {
      shiftKey: true,
    });
    expect(selected_widgets(selected.ok())).toEqual([pasted, inside]);
  });

  it("shows the ids of the path as they change", async () => {
    const { bar, selected, g, c } = await with_group();
    selected.set_ok(c);
    await frames();
    (g.data.options.id as ReturnType<typeof state.ok_w<string>>).set_ok(
      "Renamed",
    );
    await frames();
    expect(
      [...bar()!.querySelectorAll(".crumb")].map((crumb) => crumb.textContent),
    ).toEqual(["Page", "Renamed"]);
  });

  it("follows the selection to the level of the selected widgets", async () => {
    const { shown, selected, a, b, c, g } = await with_group();
    selected.set_ok(c);
    await frames();
    expect(shown()).toEqual([b, c]);
    selected.set_ok(a);
    await frames();
    expect(shown()).toEqual([a, g]);
  });

  it("goes up to the page when the page is selected", async () => {
    const { selectable, shown, bar, selected, a, b, c, g } = await with_group();
    selected.set_ok(c);
    await frames();
    expect(shown()).toEqual([b, c]);
    selected.set_ok(selectable);
    await frames();
    expect(shown()).toEqual([a, g]);
    expect(bar()).toBeNull();
  });

  it("goes to any level of the path, groups in groups too", async () => {
    const { viewport, page, shown, bar, selected, a, b, c, g } =
      await with_group();
    //H is a group of C inside G
    const inner = (await group_widgets(g.content, [c]))!;
    //C is now the widget the content of H makes
    const in_inner = inner.content.widget_of(c.data);
    (inner.data.options.id as ReturnType<typeof state.ok_w<string>>).set_ok(
      "H",
    );
    selected.set_ok(in_inner);
    await frames();
    expect(shown()).toEqual([in_inner]);
    expect(
      [...bar()!.querySelectorAll(".crumb")].map((crumb) => crumb.textContent),
    ).toEqual(["Page", "G", "H"]);
    bar()!.querySelectorAll<HTMLElement>(".crumb")[1].click();
    await frames();
    expect(shown()).toEqual([b, inner]);
    expect(selected.ok()).toBe(inner);
    bar()!.querySelectorAll<HTMLElement>(".crumb")[0].click();
    await frames();
    expect(shown()).toEqual([a, g]);
    void viewport;
    void page;
  });

  it("goes up when a group of the path is removed", async () => {
    const { page, shown, bar, selected, a, b, c, g } = await with_group();
    const inner = (await group_widgets(g.content, [c]))!;
    //C is now the widget the content of H makes
    const in_inner = inner.content.widget_of(c.data);
    selected.set_ok(in_inner);
    await frames();
    expect(shown()).toEqual([in_inner]);
    //H is removed from G, the viewport shows G
    (
      (g.options as Record<string, unknown>).widgets as ReturnType<
        typeof state.ok_w<CanvasWidgetData[]>
      >
    ).array.delete(inner.data);
    await frames();
    expect(shown()).toEqual([b]);
    //G is removed from the page
    page.widgets.array.delete(g.data);
    await frames();
    expect(shown()).toEqual([a]);
    expect(bar()).toBeNull();
  });

  it("refuses an id for the content of a group that another widget of its level has", async () => {
    const { viewport, selected, c } = await with_group();
    selected.set_ok(c);
    await frames();
    const id = viewport.shown_page.ok()!.id as ReturnType<
      typeof state.ok_w<string>
    >;
    expect((await id.write("A")).ok).toBe(false);
    expect(id.ok()).toBe("G");
    expect((await id.write("Fresh")).ok).toBe(true);
    expect(id.ok()).toBe("Fresh");
  });

  it("shows the page again when leaving edit mode", async () => {
    const { viewport, shown, selected, a, c, g } = await with_group();
    selected.set_ok(c);
    await frames();
    viewport.set({ edit: false });
    await frames();
    expect(shown()).toEqual([a, g]);
  });

  it("gives the page of the level it shows", async () => {
    const { viewport, selectable, selected, c, g } = await with_group();
    expect(viewport.shown_page.ok()).toBe(selectable);
    selected.set_ok(c);
    await frames();
    expect(viewport.shown_page.ok()).toBe(g.content);
  });
});

describe("Transformer", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  /**Viewport in edit mode with a 40 by 20 widget at 50,25 selected*/
  const with_selection = async () => {
    const parts = await make_viewport();
    const w = parts.place(50, 25, 40, 20);
    const selected = state.ok_w<CanvasSelection>(item_of(w));
    parts.viewport.set({ edit: true, selected });
    const handle = (name: string) =>
      parts.transformer.querySelector(
        ":scope > ." + name.split(" ").join("."),
      ) as HTMLElement;
    /**Drags the handle by the given amount of client pixels*/
    const drag = (
      name: string,
      dx: number,
      dy: number,
      keys: { shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean } = {},
    ) => {
      const element = handle(name);
      const box = element.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      pointer(element, "pointerdown", { clientX: x, clientY: y });
      pointer(window, "pointermove", {
        clientX: x + dx,
        clientY: y + dy,
        ...keys,
      });
      pointer(window, "pointerup", { clientX: x + dx, clientY: y + dy });
    };
    return { ...parts, w, handle, drag, selected };
  };

  it("is hidden without a widget", () => {
    const transformer = document.body.appendChild(new Transformer());
    expect(transformer.hidden).toBe(true);
    expect(getComputedStyle(transformer).display).toBe("none");
  });

  it("covers the selected widget in viewport pixels", async () => {
    const { transformer } = await with_selection();
    expect(transformer.style.left).toBe("100px");
    expect(transformer.style.top).toBe("100px");
    expect(transformer.style.width).toBe("80px");
    expect(transformer.style.height).toBe("40px");
  });

  it("follows changes of the widget", async () => {
    const { transformer, w } = await with_selection();
    set_options(w, { x: 0 });
    set_options(w, { rotation: 90 });
    expect(transformer.style.left).toBe("0px");
    expect(transformer.style.transform).toBe("rotate(90deg)");
    expect(transformer.getAttribute("cursor-step")).toBe("2");
  });

  it("stops following a widget it is no longer attached to", async () => {
    const { transformer, w, selected } = await with_selection();
    selected.set_ok(undefined);
    set_options(w, { x: 0 });
    expect(transformer.hidden).toBe(true);
    expect(transformer.style.left).toBe("100px");
  });

  /**Viewport in edit mode with a 40 by 20 widget at 50,25 and a 20 by 30 widget at 110,45 selected,
   * so the box is 80 by 50 at 50,25*/
  const with_two = async () => {
    const parts = await with_selection();
    const v = parts.place(110, 45, 20, 30);
    parts.selected.set_ok(selection_of([item_of(parts.w), item_of(v)]));
    return { ...parts, v };
  };
  const place_of = (w: WidgetBase) => {
    const { x, y, width, height, rotation } = geometry(w);
    return [x, y, width, height, rotation].map((n) => Math.round(n) + 0);
  };

  it("bounds several selected widgets, without rotation", async () => {
    const { transformer, w, v } = await with_two();
    expect_same(transformer.widgets, [w, v].map(item_of));
    expect(transformer.style.left).toBe("100px");
    expect(transformer.style.top).toBe("100px");
    expect(transformer.style.width).toBe("160px");
    expect(transformer.style.height).toBe("100px");
    expect(transformer.style.transform).toBe("rotate(0deg)");
    set_options(v, { x: 140 });
    expect(transformer.style.width).toBe("220px");
  });

  it("moves several widgets by the same amount", async () => {
    const { w, v, drag } = await with_two();
    drag("handle move", 26, -8);
    expect(place_of(w)).toEqual([65, 20, 40, 20, 0]);
    expect(place_of(v)).toEqual([125, 40, 20, 30, 0]);
  });

  it("scales several widgets relative to the box", async () => {
    const { w, v, drag } = await with_two();
    //40 page units wider, the box is 1.5 times as wide
    drag("handle resize e", 80, 0);
    expect(place_of(w)).toEqual([50, 25, 60, 20, 0]);
    expect(place_of(v)).toEqual([140, 45, 30, 30, 0]);
  });

  it("rotates several widgets around the center of the box", async () => {
    const { w, transformer, handle } = await with_two();
    const rotate = handle("handle rotate");
    const box = transformer.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const start = rotate.getBoundingClientRect();
    const x = start.left + start.width / 2;
    const y = start.top + start.height / 2;
    pointer(rotate, "pointerdown", { clientX: x, clientY: y });
    pointer(window, "pointermove", {
      clientX: cx + (cy - y),
      clientY: cy + (x - cx),
    });
    //The box turns with the drag
    expect(transformer.style.transform).toBe("rotate(90deg)");
    pointer(window, "pointerup", { clientX: x, clientY: y });
    //Center 70,35 turned a quarter around 90,50
    expect(place_of(w)).toEqual([85, 20, 40, 20, 90]);
    //The box keeps its rotation, while the same widgets are selected
    expect(transformer.style.transform).toBe("rotate(90deg)");
    expect(transformer.style.width).toBe("160px");
    expect(transformer.style.height).toBe("100px");
  });

  it("turns the box of widgets with the rotation they share", async () => {
    const parts = await with_selection();
    const turned = [
      parts.place_with({ x: 10, y: 10, width: 20, height: 10, rotation: 30 }),
      parts.place_with({ x: 60, y: 40, width: 20, height: 30, rotation: 30 }),
    ];
    parts.selected.set_ok(selection_of(turned.map(item_of)));
    expect(parts.transformer.style.transform).toBe("rotate(30deg)");
  });

  it("hides the handles of a part that any selected widget locks", async () => {
    const parts = await with_selection();
    const v = parts.place_with({
      x: state.ok(110),
      y: 45,
      width: 20,
      height: 30,
    });
    parts.selected.set_ok(selection_of([item_of(parts.w), item_of(v)]));
    expect(parts.transformer.classList).toContain("no-move");
    expect(parts.transformer.classList).toContain("no-resize");
    expect(parts.transformer.classList).toContain("no-rotate");
  });

  it("the move handle moves the widget on a 5 unit grid", async () => {
    const { w, drag } = await with_selection();
    //13 page units
    drag("handle move", 26, -8);
    expect(geometry(w).x).toBe(65);
    expect(geometry(w).y).toBe(20);
  });

  it("only alt turns snapping off", async () => {
    const { w, drag } = await with_selection();
    drag("handle move", 3, 0, { altKey: true });
    expect(geometry(w).x).toBe(51.5);
    drag("handle move", 3, 0, { shiftKey: true, ctrlKey: true });
    expect(geometry(w).x).toBe(55);
  });

  it("ctrl keeps the ratio when resizing, by the axis that changed most", async () => {
    const { w, drag } = await with_selection();
    //20 units wider, 1.5 times as wide
    drag("handle resize se", 40, 0, { ctrlKey: true });
    expect(place_of(w)).toEqual([50, 25, 60, 30, 0]);
    //A side handle scales the other axis around its middle
    drag("handle resize s", 0, 60, { ctrlKey: true });
    expect(place_of(w)).toEqual([20, 25, 120, 60, 0]);
  });

  it("shift resizes around the center", async () => {
    const { w, drag } = await with_selection();
    drag("handle resize e", 20, 0, { shiftKey: true });
    expect(place_of(w)).toEqual([40, 25, 60, 20, 0]);
  });

  it("ctrl and shift resize around the center keeping the ratio", async () => {
    const { w, drag } = await with_selection();
    drag("handle resize se", 40, 0, { ctrlKey: true, shiftKey: true });
    expect(place_of(w)).toEqual([30, 15, 80, 40, 0]);
  });

  it("the sides move the widget", async () => {
    const { w, drag } = await with_selection();
    drag("side top", 20, 20);
    expect(geometry(w).x).toBe(60);
    expect(geometry(w).y).toBe(35);
  });

  it("the east handle resizes the width only", async () => {
    const { w, drag } = await with_selection();
    drag("handle e", 20, 30);
    expect([
      geometry(w).x,
      geometry(w).y,
      geometry(w).width,
      geometry(w).height,
    ]).toEqual([50, 25, 50, 20]);
  });

  it("the north west handle keeps the south east corner in place", async () => {
    const { w, drag } = await with_selection();
    drag("handle nw", -20, -10);
    expect([
      geometry(w).x,
      geometry(w).y,
      geometry(w).width,
      geometry(w).height,
    ]).toEqual([40, 20, 50, 25]);
  });

  it("does not resize below 1 unit", async () => {
    const { w, drag } = await with_selection();
    drag("handle se", -500, -500);
    expect(geometry(w).width).toBe(1);
    expect(geometry(w).height).toBe(1);
  });

  it("resizing a rotated widget keeps the opposite side in place", async () => {
    const { w, drag } = await with_selection();
    set_options(w, { rotation: 90 });
    //The east handle points down when rotated 90 degrees clockwise
    drag("handle e", 0, 20);
    expect(geometry(w).width).toBe(50);
    expect(geometry(w).height).toBe(20);
    //The west edge center, rotated around the center, stays at 70,15
    const cx = geometry(w).x + geometry(w).width / 2;
    const cy = geometry(w).y + geometry(w).height / 2;
    expect(cx).toBeCloseTo(70);
    expect(cy - geometry(w).width / 2).toBeCloseTo(15);
  });

  it("the rotate handle rotates in 15 degree steps", async () => {
    const { w, transformer, handle } = await with_selection();
    const rotate = handle("handle rotate");
    const box = transformer.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const start = rotate.getBoundingClientRect();
    const x = start.left + start.width / 2;
    const y = start.top + start.height / 2;
    pointer(rotate, "pointerdown", { clientX: x, clientY: y });
    //A quarter turn clockwise around the center
    pointer(window, "pointermove", {
      clientX: cx + (cy - y),
      clientY: cy + (x - cx),
    });
    expect(geometry(w).rotation).toBe(90);
    //A quarter turn counter clockwise from the start wraps to 270
    pointer(window, "pointermove", {
      clientX: cx - (cy - y),
      clientY: cy - (x - cx),
    });
    expect(geometry(w).rotation).toBe(270);
    pointer(window, "pointerup", { clientX: x, clientY: y });
    expect(geometry(w).rotation).toBe(270);
  });

  it("keeps the grabbed point under the pointer when panning during a drag", async () => {
    const { viewport, w, handle } = await with_selection();
    const move = handle("handle move");
    pointer(move, "pointerdown", { clientX: 200, clientY: 200 });
    pointer(window, "pointermove", { clientX: 220, clientY: 200 });
    expect(geometry(w).x).toBe(60);
    //Panning 40 pixels left is 20 page units at a scale of 2
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaX: 80, cancelable: true }),
    );
    expect(geometry(w).x).toBe(80);
    expect(geometry(w).y).toBe(25);
    pointer(window, "pointerup", { clientX: 220, clientY: 200 });
  });

  it("keeps the grabbed point under the pointer when zooming during a drag", async () => {
    const { viewport, w, handle, client } = await with_selection();
    const move = handle("handle move");
    const start = client(70, 35);
    pointer(move, "pointerdown", start);
    pointer(window, "pointermove", { ...client(100, 35) });
    expect(geometry(w).x).toBe(80);
    //Zooming toward the pointer leaves the page point under it unchanged
    viewport.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -100,
        ctrlKey: true,
        cancelable: true,
        ...client(100, 35),
      }),
    );
    expect(viewport.scale).toBeGreaterThan(2);
    expect(geometry(w).x).toBe(80);
    expect(geometry(w).y).toBe(25);
    pointer(window, "pointerup", client(100, 35));
  });

  it("does not move a pressed widget when the view changes before the pointer moved", async () => {
    const { viewport, w, handle } = await with_selection();
    set_options(w, { x: 51 });
    pointer(handle("handle move"), "pointerdown", {
      clientX: 200,
      clientY: 200,
    });
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaX: 80, cancelable: true }),
    );
    expect(geometry(w).x).toBe(51);
    pointer(window, "pointerup", { clientX: 200, clientY: 200 });
  });

  it("rotates around the current position of the widget after the view changed", async () => {
    const { viewport, w, handle, client } = await with_selection();
    const rotate = handle("handle rotate");
    const box = rotate.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    pointer(rotate, "pointerdown", { clientX: x, clientY: y });
    //Pans the widget center 100 pixels down, on top of where the pointer is about to be
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -200, cancelable: true }),
    );
    const center = client(70, 85);
    pointer(window, "pointermove", {
      clientX: center.clientX + 100,
      clientY: center.clientY,
    });
    expect(geometry(w).rotation).toBe(90);
    pointer(window, "pointerup", { clientX: x, clientY: y });
  });

  it("is dragging between press and release only", async () => {
    const { transformer, handle } = await with_selection();
    const move = handle("handle move");
    expect(transformer.dragging).toBe(false);
    pointer(move, "pointerdown", { clientX: 0, clientY: 0 });
    expect(transformer.dragging).toBe(true);
    pointer(window, "pointerup", { pointerId: 2 });
    expect(transformer.dragging).toBe(true);
    pointer(window, "pointercancel");
    expect(transformer.dragging).toBe(false);
  });

  it("ignores other pointers and buttons", async () => {
    const { w, transformer, handle } = await with_selection();
    const move = handle("handle move");
    pointer(move, "pointerdown", { button: 1, clientX: 0, clientY: 0 });
    expect(transformer.dragging).toBe(false);
    pointer(move, "pointerdown", { clientX: 0, clientY: 0 });
    pointer(window, "pointermove", {
      pointerId: 2,
      clientX: 100,
      clientY: 100,
    });
    expect(geometry(w).x).toBe(50);
  });

  it("stops dragging when removed or when the widget changes", async () => {
    const { viewport, transformer, handle, place, selected } =
      await with_selection();
    pointer(handle("handle move"), "pointerdown", { clientX: 0, clientY: 0 });
    selected.set_ok(item_of(place(0, 0, 10, 10)));
    expect(transformer.dragging).toBe(false);
    pointer(handle("handle move"), "pointerdown", { clientX: 0, clientY: 0 });
    viewport.remove();
    expect(transformer.dragging).toBe(false);
  });

  it("writes a drag to the writable states of the widget", async () => {
    const parts = await make_viewport();
    const x = state.ok_w(50);
    const y = state.ok_w(25);
    const w = parts.place_with({ x, y, width: 40, height: 20 });
    parts.viewport.set({ edit: true, selected: item_of(w) });
    const move = parts.transformer.querySelector(
      ":scope > .handle.move",
    ) as HTMLElement;
    const box = move.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    pointer(move, "pointerdown", { clientX: cx, clientY: cy });
    pointer(window, "pointermove", { clientX: cx + 20, clientY: cy + 10 });
    pointer(window, "pointerup", { clientX: cx + 20, clientY: cy + 10 });
    expect([x.ok(), y.ok()]).toEqual([60, 30]);
  });

  it("hides the handles of parts that are read only, following a switch from a link to a value", async () => {
    const parts = await make_viewport();
    const states = depot.states.group("viewporttest", "", "");
    states.add("x", "X", "", state.ok(50));
    try {
      //Linked to a read only state, then unlinked to the same value, the value does not change
      const x = state.ok_w<number | CanvasLink<number>>(
        canvas_link<number>("/states/viewporttest/x"),
      );
      const w = parts.place_with({
        x: x as unknown as State<number>,
        y: 25,
        width: 40,
        height: 20,
        rotation: state.ok(0),
      });
      parts.viewport.set({ edit: true, selected: item_of(w) });
      const shown = (name: string) =>
        getComputedStyle(
          parts.transformer.querySelector(
            ":scope > ." + name.split(" ").join("."),
          )!,
        ).display !== "none";
      expect(shown("handle move")).toBe(false);
      expect(shown("side top")).toBe(false);
      expect(shown("handle se")).toBe(false);
      expect(shown("handle rotate")).toBe(false);
      x.set_ok(50);
      expect(shown("handle move")).toBe(true);
      expect(shown("handle se")).toBe(true);
      expect(shown("handle rotate")).toBe(false);
    } finally {
      states.remove();
    }
  });

  it("follows the widget when its element is made again, like a placeholder replaced by its widget", async () => {
    const parts = await make_viewport();
    const x = state.ok_w(50);
    parts.page.widgets.set_ok([
      {
        widget: "/widgets/canvastest/registered_later",
        options: {
          x,
          y: state.ok_w(25),
          width: state.ok_w(40),
          height: state.ok_w(20),
        },
      },
    ]);
    parts.viewport.set({ edit: true });
    const placeholder = elements(parts.viewport)[0]!;
    pointer(placeholder, "pointerdown");
    const later = test_group.add("registered_later", "", "", {
      create: (options) => TestWidget.create(options),
    });
    try {
      x.set_ok(60);
      //60 page units at a scale of 2
      expect(parts.transformer.style.left).toBe("120px");
      expect(parts.transformer.hidden).toBe(false);
    } finally {
      later.remove();
    }
  });

  it("a press on a handle does not change the selection", async () => {
    const { transformer, w, handle } = await with_selection();
    pointer(handle("handle se"), "pointerdown", { clientX: 0, clientY: 0 });
    pointer(window, "pointerup");
    expect_same(transformer.widgets, [w].map(item_of));
  });
});
