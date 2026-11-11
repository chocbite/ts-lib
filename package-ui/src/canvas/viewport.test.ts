import { define_element } from "#base";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Page } from "./page";
import { Transformer } from "./transformer";
import { Viewport } from "./viewport";
import { WIDGET_TRANSFORM_EVENT, WidgetBase } from "./widget";

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
  get original_width(): number {
    return this.layout ? this.layout[0] : this.width;
  }
  get original_height(): number {
    return this.layout ? this.layout[1] : this.height;
  }
}
define_element(TestWidget);

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const frames = async () => {
  await frame();
  await frame();
};

const widget = (x: number, y: number, width: number, height: number) => {
  const w = new TestWidget();
  w.x = x;
  w.y = y;
  w.width = width;
  w.height = height;
  return w;
};

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

/**400 by 300 pixel viewport showing a 200 by 100 page, so the page is scaled by 2 and centered vertically*/
const make_viewport = async () => {
  const viewport = new Viewport();
  viewport.style.cssText = "width:400px;height:300px;";
  stub_capture(viewport);
  const page = new Page();
  page.width = 200;
  page.height = 100;
  viewport.page = page;
  document.body.appendChild(viewport);
  await frames();
  const container = viewport.querySelector(":scope > .container") as HTMLDivElement;
  const transformer = viewport.querySelector(
    ":scope > canvas-transformer",
  ) as Transformer;
  const box = viewport.getBoundingClientRect();
  /**Client coordinates of a point on the page*/
  const client = (x: number, y: number) => ({
    clientX: box.left + x * 2,
    clientY: box.top + 50 + y * 2,
  });
  return { viewport, page, container, transformer, client, box };
};

describe("Page", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("defaults to full HD", () => {
    const page = new Page();
    expect(page.width).toBe(1920);
    expect(page.height).toBe(1080);
    expect(page.style.width).toBe("1920px");
    expect(page.style.height).toBe("1080px");
  });

  it("width and height size the element", () => {
    const page = new Page();
    page.width = 300;
    page.height = 200;
    expect(page.style.width).toBe("300px");
    expect(page.style.height).toBe("200px");
  });

  it("widgets are children in drawing order", () => {
    const page = document.body.appendChild(new Page());
    const [a, b, c] = [widget(0, 0, 1, 1), widget(0, 0, 1, 1), widget(0, 0, 1, 1)];
    page.widgets = [a, b, c];
    expect([...page.children]).toEqual([a, b, c]);
    expect(page.widgets).toEqual([a, b, c]);
  });

  it("removes widgets no longer listed and keeps the others connected", () => {
    const page = document.body.appendChild(new Page());
    const [a, b, c] = [widget(0, 0, 1, 1), widget(0, 0, 1, 1), widget(0, 0, 1, 1)];
    page.widgets = [a, b, c];
    page.widgets = [a, c];
    expect([...page.children]).toEqual([a, c]);
    expect(b.isConnected).toBe(false);
    expect(a.connects).toBe(1);
    expect(c.connects).toBe(1);
  });

  it("reorders widgets", () => {
    const page = document.body.appendChild(new Page());
    const [a, b, c] = [widget(0, 0, 1, 1), widget(0, 0, 1, 1), widget(0, 0, 1, 1)];
    page.widgets = [a, b, c];
    page.widgets = [c, a, b];
    expect([...page.children]).toEqual([c, a, b]);
    page.widgets = [b, c, a, widget(0, 0, 1, 1)];
    expect(page.children.length).toBe(4);
    expect(page.children[0]).toBe(b);
    expect(page.children[1]).toBe(c);
    expect(page.children[2]).toBe(a);
  });

  it("does not remove a widget that moved to another page", () => {
    const first = document.body.appendChild(new Page());
    const second = document.body.appendChild(new Page());
    const a = widget(0, 0, 1, 1);
    first.widgets = [a];
    second.widgets = [a];
    first.widgets = [];
    expect(a.parentElement).toBe(second);
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
    w.layout = [50, 10];
    document.body.appendChild(w);
    expect(w.style.width).toBe("50px");
    expect(w.getBoundingClientRect().width).toBeCloseTo(100);
    expect(w.getBoundingClientRect().height).toBeCloseTo(20);
  });

  it("rotates around its center", () => {
    const w = widget(0, 0, 100, 20);
    w.rotation = 90;
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
    w.x = 1;
    w.y = 1;
    w.width = 2;
    w.height = 2;
    w.rotation = 5;
    expect(listener).toHaveBeenCalledTimes(5);
    expect([w.x, w.y, w.width, w.height, w.rotation]).toEqual([1, 1, 2, 2, 5]);
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
    page.width = 400;
    page.height = 300;
    await frames();
    expect(viewport.scale).toBe(1);
  });

  it("replacing the page removes the old one and clears the selection", async () => {
    const { viewport, page } = await make_viewport();
    const w = widget(0, 0, 10, 10);
    page.widgets = [w];
    viewport.selected = w;
    const next = new Page();
    viewport.page = next;
    expect(page.isConnected).toBe(false);
    expect(next.isConnected).toBe(true);
    expect(viewport.selected).toBeUndefined();
    viewport.page = undefined;
    expect(viewport.page).toBeUndefined();
    expect(next.isConnected).toBe(false);
  });

  it("does not pan or zoom outside edit mode", async () => {
    const { viewport, container } = await make_viewport();
    const before = container.style.transform;
    const event = new WheelEvent("wheel", { deltaY: 100, cancelable: true, bubbles: true });
    viewport.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(container.style.transform).toBe(before);
  });

  it("edit sets the edit attribute", async () => {
    const { viewport } = await make_viewport();
    viewport.edit = true;
    expect(viewport.edit).toBe(true);
    expect(viewport.hasAttribute("edit")).toBe(true);
    viewport.edit = false;
    expect(viewport.hasAttribute("edit")).toBe(false);
  });

  it("wheel pans in edit mode, shift pans horizontally", async () => {
    const { viewport, container } = await make_viewport();
    viewport.edit = true;
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaX: 10, deltaY: 20, cancelable: true }));
    expect(container.style.transform).toBe("translate(-5px, 40px) scale(2)");
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 20, shiftKey: true, cancelable: true }));
    expect(container.style.transform).toBe("translate(-15px, 40px) scale(2)");
  });

  it("wheel in lines pans by line height", async () => {
    const { viewport, container } = await make_viewport();
    viewport.edit = true;
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 1, deltaMode: WheelEvent.DOM_DELTA_LINE, cancelable: true }),
    );
    expect(container.style.transform).toBe("translate(0px, 42px) scale(2)");
  });

  it("alt makes the wheel slower", async () => {
    const { viewport, container } = await make_viewport();
    viewport.edit = true;
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 20, altKey: true, cancelable: true }));
    expect(container.style.transform).toBe("translate(0px, 49px) scale(2)");
  });

  it("ctrl wheel zooms keeping the point under the cursor in place", async () => {
    const { viewport, client } = await make_viewport();
    viewport.edit = true;
    window.dispatchEvent(new KeyboardEvent("keydown", { ctrlKey: true }));
    const point = client(50, 25);
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -100, ctrlKey: true, cancelable: true, ...point }),
    );
    expect(viewport.scale).toBeCloseTo(2 * Math.exp(0.2));
    //The page point 50,25 stays at the same client position
    const container = viewport.querySelector(":scope > .container") as HTMLElement;
    const box = viewport.getBoundingClientRect();
    const match = /translate\((.+)px, (.+)px\)/.exec(container.style.transform)!;
    expect(box.left + Number(match[1]) + 50 * viewport.scale).toBeCloseTo(point.clientX);
    expect(box.top + Number(match[2]) + 25 * viewport.scale).toBeCloseTo(point.clientY);
  });

  it("zoom is limited", async () => {
    const { viewport } = await make_viewport();
    viewport.edit = true;
    for (let i = 0; i < 20; i++)
      viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -1000, ctrlKey: true, cancelable: true }));
    expect(viewport.scale).toBeCloseTo(2 * 20);
    for (let i = 0; i < 40; i++)
      viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 1000, ctrlKey: true, cancelable: true }));
    expect(viewport.scale).toBeCloseTo(2 * 0.1);
  });

  it("leaving edit mode resets the view and the selection", async () => {
    const { viewport, page, container } = await make_viewport();
    const w = widget(0, 0, 10, 10);
    page.widgets = [w];
    viewport.edit = true;
    viewport.selected = w;
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, ctrlKey: true, cancelable: true }));
    viewport.edit = false;
    expect(viewport.scale).toBe(2);
    expect(container.style.transform).toBe("translate(0px, 50px) scale(2)");
    expect(viewport.selected).toBeUndefined();
  });

  it("middle and right mouse drag pan", async () => {
    const { viewport, container } = await make_viewport();
    viewport.edit = true;
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
    viewport.edit = true;
    expect(menu()).toBe(true);
  });

  it("two finger touch pinch zooms around the fingers", async () => {
    const { viewport, client } = await make_viewport();
    viewport.edit = true;
    const touch = (type: string, id: number, x: number, y: number) =>
      pointer(viewport, type, { pointerType: "touch", pointerId: id, ...client(x, y) });
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
    viewport.edit = true;
    const before = container.style.transform;
    pointer(viewport, "pointerdown", { pointerType: "touch", ...client(40, 50) });
    pointer(viewport, "pointermove", { pointerType: "touch", ...client(80, 50) });
    expect(container.style.transform).toBe(before);
  });

  it("pressing a widget selects it, pressing the page clears the selection", async () => {
    const { viewport, page, transformer } = await make_viewport();
    const w = widget(10, 10, 20, 20);
    const inner = w.appendChild(document.createElement("span"));
    page.widgets = [w];
    viewport.edit = true;
    pointer(inner, "pointerdown");
    expect(viewport.selected).toBe(w);
    expect(transformer.hidden).toBe(false);
    pointer(page, "pointerdown");
    expect(viewport.selected).toBeUndefined();
    expect(transformer.hidden).toBe(true);
  });

  it("does not select outside edit mode", async () => {
    const { viewport, page } = await make_viewport();
    const w = widget(10, 10, 20, 20);
    page.widgets = [w];
    pointer(w, "pointerdown");
    expect(viewport.selected).toBeUndefined();
  });

  it("listens to the keyboard only while connected in edit mode", async () => {
    const { viewport } = await make_viewport();
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    try {
      viewport.edit = true;
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
    const w = widget(50, 25, 40, 20);
    parts.page.widgets = [w];
    parts.viewport.edit = true;
    parts.viewport.selected = w;
    const handle = (name: string) =>
      parts.transformer.querySelector(":scope > ." + name.split(" ").join(".")) as HTMLElement;
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
      pointer(window, "pointermove", { clientX: x + dx, clientY: y + dy, ...keys });
      pointer(window, "pointerup", { clientX: x + dx, clientY: y + dy });
    };
    return { ...parts, w, handle, drag };
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
    w.x = 0;
    w.rotation = 90;
    expect(transformer.style.left).toBe("0px");
    expect(transformer.style.transform).toBe("rotate(90deg)");
    expect(transformer.getAttribute("cursor-step")).toBe("2");
  });

  it("stops following a widget it is no longer attached to", async () => {
    const { transformer, w, viewport } = await with_selection();
    viewport.selected = undefined;
    w.x = 0;
    expect(transformer.hidden).toBe(true);
    expect(transformer.style.left).toBe("100px");
  });

  it("the move handle moves the widget on a 5 unit grid", async () => {
    const { w, drag } = await with_selection();
    //13 page units
    drag("handle move", 26, -8);
    expect(w.x).toBe(65);
    expect(w.y).toBe(20);
  });

  it("alt snaps to 1 unit and shift does not snap", async () => {
    const { w, drag } = await with_selection();
    drag("handle move", 3, 0, { altKey: true });
    expect(w.x).toBe(52);
    drag("handle move", 3, 0, { shiftKey: true });
    expect(w.x).toBe(53.5);
  });

  it("the sides move the widget", async () => {
    const { w, drag } = await with_selection();
    drag("side top", 20, 20);
    expect(w.x).toBe(60);
    expect(w.y).toBe(35);
  });

  it("the east handle resizes the width only", async () => {
    const { w, drag } = await with_selection();
    drag("handle e", 20, 30);
    expect([w.x, w.y, w.width, w.height]).toEqual([50, 25, 50, 20]);
  });

  it("the north west handle keeps the south east corner in place", async () => {
    const { w, drag } = await with_selection();
    drag("handle nw", -20, -10);
    expect([w.x, w.y, w.width, w.height]).toEqual([40, 20, 50, 25]);
  });

  it("does not resize below 1 unit", async () => {
    const { w, drag } = await with_selection();
    drag("handle se", -500, -500);
    expect(w.width).toBe(1);
    expect(w.height).toBe(1);
  });

  it("resizing a rotated widget keeps the opposite side in place", async () => {
    const { w, drag } = await with_selection();
    w.rotation = 90;
    //The east handle points down when rotated 90 degrees clockwise
    drag("handle e", 0, 20);
    expect(w.width).toBe(50);
    expect(w.height).toBe(20);
    //The west edge center, rotated around the center, stays at 70,15
    const cx = w.x + w.width / 2;
    const cy = w.y + w.height / 2;
    expect(cx).toBeCloseTo(70);
    expect(cy - w.width / 2).toBeCloseTo(15);
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
    pointer(window, "pointermove", { clientX: cx + (cy - y), clientY: cy + (x - cx) });
    expect(w.rotation).toBe(90);
    //A quarter turn counter clockwise from the start wraps to 270
    pointer(window, "pointermove", { clientX: cx - (cy - y), clientY: cy - (x - cx) });
    expect(w.rotation).toBe(270);
    pointer(window, "pointerup", { clientX: x, clientY: y });
    expect(w.rotation).toBe(270);
  });

  it("keeps the grabbed point under the pointer when panning during a drag", async () => {
    const { viewport, w, handle } = await with_selection();
    const move = handle("handle move");
    pointer(move, "pointerdown", { clientX: 200, clientY: 200 });
    pointer(window, "pointermove", { clientX: 220, clientY: 200 });
    expect(w.x).toBe(60);
    //Panning 40 pixels left is 20 page units at a scale of 2
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaX: 80, cancelable: true }));
    expect(w.x).toBe(80);
    expect(w.y).toBe(25);
    pointer(window, "pointerup", { clientX: 220, clientY: 200 });
  });

  it("keeps the grabbed point under the pointer when zooming during a drag", async () => {
    const { viewport, w, handle, client } = await with_selection();
    const move = handle("handle move");
    const start = client(70, 35);
    pointer(move, "pointerdown", start);
    pointer(window, "pointermove", { ...client(100, 35) });
    expect(w.x).toBe(80);
    //Zooming toward the pointer leaves the page point under it unchanged
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -100, ctrlKey: true, cancelable: true, ...client(100, 35) }),
    );
    expect(viewport.scale).toBeGreaterThan(2);
    expect(w.x).toBe(80);
    expect(w.y).toBe(25);
    pointer(window, "pointerup", client(100, 35));
  });

  it("does not move a pressed widget when the view changes before the pointer moved", async () => {
    const { viewport, w, handle } = await with_selection();
    w.x = 51;
    pointer(handle("handle move"), "pointerdown", { clientX: 200, clientY: 200 });
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaX: 80, cancelable: true }));
    expect(w.x).toBe(51);
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
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -200, cancelable: true }));
    const center = client(70, 85);
    pointer(window, "pointermove", { clientX: center.clientX + 100, clientY: center.clientY });
    expect(w.rotation).toBe(90);
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
    pointer(window, "pointermove", { pointerId: 2, clientX: 100, clientY: 100 });
    expect(w.x).toBe(50);
  });

  it("stops dragging when removed or when the widget changes", async () => {
    const { viewport, transformer, handle, page } = await with_selection();
    pointer(handle("handle move"), "pointerdown", { clientX: 0, clientY: 0 });
    const other = widget(0, 0, 10, 10);
    page.widgets = [...page.widgets, other];
    viewport.selected = other;
    expect(transformer.dragging).toBe(false);
    pointer(handle("handle move"), "pointerdown", { clientX: 0, clientY: 0 });
    viewport.remove();
    expect(transformer.dragging).toBe(false);
  });

  it("a press on a handle does not change the selection", async () => {
    const { viewport, w, handle } = await with_selection();
    pointer(handle("handle se"), "pointerdown", { clientX: 0, clientY: 0 });
    pointer(window, "pointerup");
    expect(viewport.selected).toBe(w);
  });
});
