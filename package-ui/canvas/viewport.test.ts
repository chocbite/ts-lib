import { define_element } from "#base";
import { NiceError } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  canvas_widget,
  WIDGETS,
  type CanvasPage,
  type CanvasWidget,
} from "./data";
import { WidgetSlot } from "./slot";
import { Transformer } from "./transformer";
import { canvas_viewport, type Viewport } from "./viewport";
import {
  WIDGET_CHANGE,
  WIDGET_GEOMETRY,
  WIDGET_TRANSFORM_EVENT,
  WidgetBase,
  type WidgetBaseOptions,
} from "./widget";

class TestWidget extends WidgetBase {
  static element_name() {
    return "testwidget";
  }
  /**Size the content is laid out at, undefined to not stretch*/
  layout: [number, number] | undefined;
  connects = 0;
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
  widgets: state.ok_w<CanvasWidget[]>([]),
});
type PageData = ReturnType<typeof page_data>;

/**A test widget for a page*/
const item = (x: number, y: number, width: number, height: number) =>
  canvas_widget(test_definition, { x, y, width, height });

/**The widget data of a widget element*/
const item_of = (element: WidgetBase) =>
  (element.parentElement as WidgetSlot).widget;

/**The widget elements a viewport shows*/
const elements = (viewport: Viewport) =>
  [...viewport.querySelectorAll("canvas-slot")].map(
    (slot) => (slot as WidgetSlot).element,
  );

/**400 by 300 pixel viewport showing a 200 by 100 page, so the page is scaled by 2 and centered vertically*/
const make_viewport = async (page: PageData = page_data()) => {
  const viewport = canvas_viewport({ page });
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
    expect(elements(viewport).map((e) => e![WIDGET_GEOMETRY].x)).toEqual([
      1, 2, 3,
    ]);
  });

  it("only touches added and removed widgets, the others stay connected", async () => {
    const { viewport, page } = await make_viewport();
    const [a, b, c] = [item(1, 0, 1, 1), item(2, 0, 1, 1), item(3, 0, 1, 1)];
    page.widgets.set_ok([a, b, c]);
    const [ea, eb, ec] = elements(viewport) as TestWidget[];
    page.widgets.set_ok([a, c]);
    expect(elements(viewport)).toEqual([ea, ec]);
    expect(eb.isConnected).toBe(false);
    page.widgets.set_ok([a, c, item(4, 0, 1, 1)]);
    expect(elements(viewport).slice(0, 2)).toEqual([ea, ec]);
    expect(ea.connects).toBe(1);
    expect(ec.connects).toBe(1);
  });

  it("reorders widgets", async () => {
    const { viewport, page } = await make_viewport();
    const [a, b, c] = [item(1, 0, 1, 1), item(2, 0, 1, 1), item(3, 0, 1, 1)];
    page.widgets.set_ok([a, b, c]);
    const [ea, eb, ec] = elements(viewport);
    page.widgets.set_ok([c, a, b]);
    expect(elements(viewport)).toEqual([ec, ea, eb]);
  });

  it("shows a widget given twice once", async () => {
    const { viewport, page } = await make_viewport();
    const a = item(1, 0, 1, 1);
    page.widgets.set_ok([a, a]);
    expect(elements(viewport).length).toBe(1);
  });

  it("follows changes made while the viewport was not in the document", async () => {
    const { viewport, page } = await make_viewport();
    const [a, b, c] = [item(1, 0, 1, 1), item(2, 0, 1, 1), item(3, 0, 1, 1)];
    page.widgets.set_ok([a]);
    viewport.remove();
    page.widgets.set_ok([a, b]);
    page.widgets.set_ok([c, a, b]);
    document.body.appendChild(viewport);
    expect(elements(viewport).map((e) => e![WIDGET_GEOMETRY].x)).toEqual([
      3, 1, 2,
    ]);
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
    a[WIDGET_CHANGE]({ x: 70 });
    expect(x.ok()).toBe(70);
    expect(b[WIDGET_GEOMETRY].x).toBe(70);
  });

  it("shows an error in the place of a widget until its definition is registered", async () => {
    const { viewport, page } = await make_viewport();
    page.widgets.set_ok([
      {
        widget: "/widgets/canvastest/late",
        options: { x: state.ok_w(5), width: state.ok_w(10) },
      },
    ]);
    const [error] = elements(viewport);
    expect(error!.localName).toBe("canvas-errorwidget");
    expect(error![WIDGET_GEOMETRY].x).toBe(5);
    const late = test_group.add("late", "Late", "", {
      create: (options) => TestWidget.create(options),
    });
    try {
      const [widget] = elements(viewport);
      expect(widget!.localName).toBe("canvas-testwidget");
      expect(widget![WIDGET_GEOMETRY].x).toBe(5);
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

  it("dispatches the transform event for every change", () => {
    const w = widget(0, 0, 1, 1);
    const listener = vi.fn();
    w.addEventListener(WIDGET_TRANSFORM_EVENT, listener);
    w.set({ x: 1 });
    w.set({ y: 1 });
    w.set({ width: 2 });
    w.set({ height: 2 });
    w.set({ rotation: 5 });
    expect(listener).toHaveBeenCalledTimes(5);
    expect({ ...w[WIDGET_GEOMETRY] }).toEqual({
      x: 1,
      y: 1,
      width: 2,
      height: 2,
      rotation: 5,
    });
  });

  it("follows states, keeping the last good value on errors", () => {
    const x = state.from_w(5);
    const w = document.body.appendChild(TestWidget.create({ x, width: 1 }));
    expect(w[WIDGET_GEOMETRY].x).toBe(5);
    x.set_ok(7);
    expect(w.style.left).toBe("7px");
    x.set_err(nice_err("gone"));
    expect(w[WIDGET_GEOMETRY].x).toBe(7);
  });

  it("writes changes to writable states, so widgets sharing them follow", () => {
    const x = state.ok_w(5);
    const a = document.body.appendChild(TestWidget.create({ x }));
    const b = document.body.appendChild(TestWidget.create({ x }));
    a[WIDGET_CHANGE]({ x: 30 });
    expect(x.ok()).toBe(30);
    expect(b[WIDGET_GEOMETRY].x).toBe(30);
  });

  it("keeps changes of initial values and of values not given itself", () => {
    const w = TestWidget.create({ x: 5 });
    w[WIDGET_CHANGE]({ x: 30, y: 40 });
    expect(w[WIDGET_GEOMETRY].x).toBe(30);
    expect(w[WIDGET_GEOMETRY].y).toBe(40);
  });

  it("leaves parts given as read only states unchanged", () => {
    const x = state.ok_w(5);
    const w = document.body.appendChild(
      TestWidget.create({ x: x.read_only, y: 5 }),
    );
    w[WIDGET_CHANGE]({ x: 30, y: 40 });
    expect(x.ok()).toBe(5);
    expect(w[WIDGET_GEOMETRY].x).toBe(5);
    expect(w[WIDGET_GEOMETRY].y).toBe(40);
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
    const selected = state.ok_w<CanvasWidget | undefined>(undefined);
    viewport.set({ edit: true, selected });
    selected.set_ok(item_of(place(0, 0, 10, 10)));
    expect(transformer.hidden).toBe(false);
    viewport.set({ page: page_data() });
    expect(old!.isConnected).toBe(false);
    expect(viewport.querySelectorAll("canvas-page").length).toBe(1);
    expect(transformer.hidden).toBe(true);
    //The viewport never changes the selection on its own
    expect(selected.ok()).toBeDefined();
  });

  it("follows a state of the page", async () => {
    const { viewport } = await make_viewport();
    const first = page_data(200, 100);
    const second = page_data(400, 100);
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
    expect(transformer.widget).toBe(w);
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
    expect(transformer.widget).toBe(w);
    expect(transformer.hidden).toBe(false);
    pointer(viewport.querySelector("canvas-page")!, "pointerdown");
    expect(transformer.widget).toBeUndefined();
    expect(transformer.hidden).toBe(true);
  });

  it("does not select outside edit mode", async () => {
    const { viewport, place } = await make_viewport();
    const selected = state.ok_w<CanvasWidget | undefined>(undefined);
    viewport.set({ selected });
    const w = place(10, 10, 20, 20);
    pointer(w, "pointerdown");
    expect(selected.ok()).toBeUndefined();
  });

  it("writes a writable selection state, so viewports share the selection", async () => {
    const page = page_data();
    const first = await make_viewport(page);
    const second = await make_viewport(page);
    const selected = state.ok_w<CanvasWidget | undefined>(undefined);
    first.viewport.set({ edit: true, selected });
    second.viewport.set({ edit: true, selected });
    const a = first.place(10, 10, 20, 20);
    pointer(a, "pointerdown");
    expect(selected.ok()).toBe(item_of(a));
    expect(first.transformer.widget).toBe(a);
    const b = elements(second.viewport)[0]!;
    expect(second.transformer.widget).toBe(b);
  });

  it("does not change a read only selection state", async () => {
    const { viewport, transformer, place } = await make_viewport();
    const w = place(10, 10, 20, 20);
    const selected = state.ok_w<CanvasWidget | undefined>(undefined);
    viewport.set({ edit: true, selected: selected.read_only });
    pointer(w, "pointerdown");
    expect(transformer.widget).toBeUndefined();
    selected.set_ok(item_of(w));
    expect(transformer.widget).toBe(w);
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

describe("Transformer", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  /**Viewport in edit mode with a 40 by 20 widget at 50,25 selected*/
  const with_selection = async () => {
    const parts = await make_viewport();
    const w = parts.place(50, 25, 40, 20);
    const selected = state.ok_w<CanvasWidget | undefined>(item_of(w));
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
      keys: { shiftKey?: boolean; altKey?: boolean } = {},
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
    w.set({ x: 0 });
    w.set({ rotation: 90 });
    expect(transformer.style.left).toBe("0px");
    expect(transformer.style.transform).toBe("rotate(90deg)");
    expect(transformer.getAttribute("cursor-step")).toBe("2");
  });

  it("stops following a widget it is no longer attached to", async () => {
    const { transformer, w, selected } = await with_selection();
    selected.set_ok(undefined);
    w.set({ x: 0 });
    expect(transformer.hidden).toBe(true);
    expect(transformer.style.left).toBe("100px");
  });

  it("the move handle moves the widget on a 5 unit grid", async () => {
    const { w, drag } = await with_selection();
    //13 page units
    drag("handle move", 26, -8);
    expect(w[WIDGET_GEOMETRY].x).toBe(65);
    expect(w[WIDGET_GEOMETRY].y).toBe(20);
  });

  it("alt snaps to 1 unit and shift does not snap", async () => {
    const { w, drag } = await with_selection();
    drag("handle move", 3, 0, { altKey: true });
    expect(w[WIDGET_GEOMETRY].x).toBe(52);
    drag("handle move", 3, 0, { shiftKey: true });
    expect(w[WIDGET_GEOMETRY].x).toBe(53.5);
  });

  it("the sides move the widget", async () => {
    const { w, drag } = await with_selection();
    drag("side top", 20, 20);
    expect(w[WIDGET_GEOMETRY].x).toBe(60);
    expect(w[WIDGET_GEOMETRY].y).toBe(35);
  });

  it("the east handle resizes the width only", async () => {
    const { w, drag } = await with_selection();
    drag("handle e", 20, 30);
    expect([
      w[WIDGET_GEOMETRY].x,
      w[WIDGET_GEOMETRY].y,
      w[WIDGET_GEOMETRY].width,
      w[WIDGET_GEOMETRY].height,
    ]).toEqual([50, 25, 50, 20]);
  });

  it("the north west handle keeps the south east corner in place", async () => {
    const { w, drag } = await with_selection();
    drag("handle nw", -20, -10);
    expect([
      w[WIDGET_GEOMETRY].x,
      w[WIDGET_GEOMETRY].y,
      w[WIDGET_GEOMETRY].width,
      w[WIDGET_GEOMETRY].height,
    ]).toEqual([40, 20, 50, 25]);
  });

  it("does not resize below 1 unit", async () => {
    const { w, drag } = await with_selection();
    drag("handle se", -500, -500);
    expect(w[WIDGET_GEOMETRY].width).toBe(1);
    expect(w[WIDGET_GEOMETRY].height).toBe(1);
  });

  it("resizing a rotated widget keeps the opposite side in place", async () => {
    const { w, drag } = await with_selection();
    w.set({ rotation: 90 });
    //The east handle points down when rotated 90 degrees clockwise
    drag("handle e", 0, 20);
    expect(w[WIDGET_GEOMETRY].width).toBe(50);
    expect(w[WIDGET_GEOMETRY].height).toBe(20);
    //The west edge center, rotated around the center, stays at 70,15
    const cx = w[WIDGET_GEOMETRY].x + w[WIDGET_GEOMETRY].width / 2;
    const cy = w[WIDGET_GEOMETRY].y + w[WIDGET_GEOMETRY].height / 2;
    expect(cx).toBeCloseTo(70);
    expect(cy - w[WIDGET_GEOMETRY].width / 2).toBeCloseTo(15);
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
    expect(w[WIDGET_GEOMETRY].rotation).toBe(90);
    //A quarter turn counter clockwise from the start wraps to 270
    pointer(window, "pointermove", {
      clientX: cx - (cy - y),
      clientY: cy - (x - cx),
    });
    expect(w[WIDGET_GEOMETRY].rotation).toBe(270);
    pointer(window, "pointerup", { clientX: x, clientY: y });
    expect(w[WIDGET_GEOMETRY].rotation).toBe(270);
  });

  it("keeps the grabbed point under the pointer when panning during a drag", async () => {
    const { viewport, w, handle } = await with_selection();
    const move = handle("handle move");
    pointer(move, "pointerdown", { clientX: 200, clientY: 200 });
    pointer(window, "pointermove", { clientX: 220, clientY: 200 });
    expect(w[WIDGET_GEOMETRY].x).toBe(60);
    //Panning 40 pixels left is 20 page units at a scale of 2
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaX: 80, cancelable: true }),
    );
    expect(w[WIDGET_GEOMETRY].x).toBe(80);
    expect(w[WIDGET_GEOMETRY].y).toBe(25);
    pointer(window, "pointerup", { clientX: 220, clientY: 200 });
  });

  it("keeps the grabbed point under the pointer when zooming during a drag", async () => {
    const { viewport, w, handle, client } = await with_selection();
    const move = handle("handle move");
    const start = client(70, 35);
    pointer(move, "pointerdown", start);
    pointer(window, "pointermove", { ...client(100, 35) });
    expect(w[WIDGET_GEOMETRY].x).toBe(80);
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
    expect(w[WIDGET_GEOMETRY].x).toBe(80);
    expect(w[WIDGET_GEOMETRY].y).toBe(25);
    pointer(window, "pointerup", client(100, 35));
  });

  it("does not move a pressed widget when the view changes before the pointer moved", async () => {
    const { viewport, w, handle } = await with_selection();
    w.set({ x: 51 });
    pointer(handle("handle move"), "pointerdown", {
      clientX: 200,
      clientY: 200,
    });
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaX: 80, cancelable: true }),
    );
    expect(w[WIDGET_GEOMETRY].x).toBe(51);
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
    expect(w[WIDGET_GEOMETRY].rotation).toBe(90);
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
    expect(w[WIDGET_GEOMETRY].x).toBe(50);
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

  it("hides the handles of parts given as read only states", async () => {
    const parts = await make_viewport();
    const w = parts.place_with({
      x: state.ok(50),
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
    w.set({ x: 50, rotation: 0 });
    expect(shown("handle move")).toBe(true);
    expect(shown("handle se")).toBe(true);
    expect(shown("handle rotate")).toBe(true);
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
    expect(transformer.widget).toBe(w);
  });
});
