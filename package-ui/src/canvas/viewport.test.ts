import { none, type Option } from "@chocbite/ts-lib/result";
import st, { type State } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { viewport as viewport_module, ViewportElement } from ".";
import { create_viewport, Viewport } from "./viewport";

type Call = [string, unknown, ...unknown[]];

/**True when every listener added was also removed again*/
const all_removed = (added: Call[], removed: Call[]) =>
  added.every(([type, listener]) =>
    removed.some(([t, l]) => t === type && l === listener),
  );

describe("Canvas viewport", () => {
  it("removes its document and window listeners when removed from the page", () => {
    const doc_add = vi.spyOn(document, "addEventListener");
    const doc_remove = vi.spyOn(document, "removeEventListener");
    const win_add = vi.spyOn(window, "addEventListener");
    const win_remove = vi.spyOn(window, "removeEventListener");
    try {
      const viewport = create_viewport(100, 100);
      document.body.appendChild(viewport);
      viewport.remove();
      expect(doc_add.mock.calls.length + win_add.mock.calls.length).toBeGreaterThan(0);
      expect(all_removed(doc_add.mock.calls as Call[], doc_remove.mock.calls as Call[])).toBe(true);
      expect(all_removed(win_add.mock.calls as Call[], win_remove.mock.calls as Call[])).toBe(true);
    } finally {
      vi.restoreAllMocks();
    }
  });
});

//      _    _ ______ _      _____  ______ _____   _____
//     | |  | |  ____| |    |  __ \|  ____|  __ \ / ____|
//     | |__| | |__  | |    | |__) | |__  | |__) | (___
//     |  __  |  __| | |    |  ___/|  __| |  _  / \___ \
//     | |  | | |____| |____| |    | |____| | \ \ ____) |
//     |_|  |_|______|______|_|    |______|_|  \_\_____/
class Box extends ViewportElement {
  protected element_name(): string {
    return "box";
  }
  protected element_name_space(): string {
    return "canvastest";
  }
  default_width(): number {
    return 40;
  }
  default_height(): number {
    return 20;
  }
}

/**Element without an optimal ratio, which re-lays out on resize*/
class FreeBox extends Box {
  resizes: [number, number][] = [];
  optimal_ratio(): Option<number> {
    return none();
  }
  protected on_resize(width: number, height: number): void {
    this.resizes.push([width, height]);
  }
}

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**Reads the value of one of the viewport states*/
const value = (state: State<number> | undefined) =>
  (state as unknown as { ok(): number }).ok();

/**Stubs pointer capture, synthetic pointers can not be captured*/
const stub_capture = (element: Element) => {
  const captured = new Set<number>();
  element.setPointerCapture = (id) => void captured.add(id);
  element.releasePointerCapture = (id) => void captured.delete(id);
  element.hasPointerCapture = (id) => captured.has(id);
};

const pointer = (
  target: Element,
  type: string,
  init: PointerEventInit = {},
) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerType: "mouse",
      pointerId: 1,
      ...init,
    }),
  );

const wheel = (target: Element, init: WheelEventInit) =>
  target.dispatchEvent(
    new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init }),
  );

/**400 by 200 pixel viewport of a 200 by 100 canvas, connected and sized*/
const make_viewport = async (infinite = false) => {
  const viewport = create_viewport(200, 100, infinite);
  viewport.style.cssText = "display:block;width:400px;height:200px;";
  document.body.appendChild(viewport);
  stub_capture(viewport);
  await frame();
  await frame();
  const root = viewport.firstElementChild as SVGSVGElement;
  const panner = root.querySelector(":scope > svg") as SVGSVGElement;
  const zoomer = panner.firstElementChild as SVGSVGElement;
  const canvas = zoomer.querySelector(":scope > svg") as SVGSVGElement;
  const elements = canvas.firstElementChild as SVGGElement;
  return { viewport, root, panner, zoomer, canvas, elements };
};

/**Center of the viewport in client coordinates*/
const center = (viewport: Viewport) => {
  const box = viewport.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

//      _______ ______  _____ _______ _____
//     |__   __|  ____|/ ____|__   __/ ____|
//        | |  | |__  | (___    | | | (___
//        | |  |  __|  \___ \   | |  \___ \
//        | |  | |____ ____) |  | |  ____) |
//        |_|  |______|_____/   |_| |_____/
describe("Canvas viewport structure", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("module exports create_viewport", () => {
    expect(viewport_module.create_viewport(10, 10)).toBeInstanceOf(Viewport);
  });

  it("builds a canvas of the given size", async () => {
    const { canvas, zoomer } = await make_viewport();
    expect(canvas.getAttribute("width")).toBe("200");
    expect(canvas.getAttribute("height")).toBe("100");
    expect(canvas.getAttribute("viewBox")).toBe("0 0 200 100");
    expect(zoomer.querySelector(":scope > rect")).not.toBeNull();
  });

  it("puts the background behind everything for an infinite canvas", async () => {
    const { root, zoomer } = await make_viewport(true);
    expect(root.querySelector(":scope > rect")).not.toBeNull();
    expect(zoomer.querySelector(":scope > rect")).toBeNull();
  });

  it("sizes the root view box to the element", async () => {
    const { root } = await make_viewport();
    expect(root.getAttribute("viewBox")).toBe("0 0 400 200");
  });

  it("canvas_width and canvas_height resize the canvas", async () => {
    const { viewport, canvas, zoomer } = await make_viewport();
    viewport.canvas_width = 300;
    viewport.canvas_height = 150;
    expect(viewport.canvas_width).toBe(300);
    expect(viewport.canvas_height).toBe(150);
    expect(canvas.getAttribute("width")).toBe("300");
    expect(canvas.getAttribute("height")).toBe("150");
    expect(canvas.getAttribute("viewBox")).toBe("0 0 300 150");
    expect(zoomer.getAttribute("width")).toBe("300");
    expect(zoomer.getAttribute("height")).toBe("150");
  });
});

describe("Canvas viewport panning and zooming", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("pan states move the canvas relative to the center", async () => {
    const { viewport, panner } = await make_viewport();
    await viewport.pan_x.write(10);
    await viewport.pan_y.write(-20);
    expect(value(viewport.pan_x)).toBe(10);
    expect(value(viewport.pan_y)).toBe(-20);
    expect(panner.getAttribute("x")).toBe("210");
    expect(panner.getAttribute("y")).toBe("80");
  });

  it("starts without pan, the canvas at the center", async () => {
    const { viewport, panner } = await make_viewport();
    expect(value(viewport.pan_x)).toBe(0);
    expect(value(viewport.pan_y)).toBe(0);
    expect(panner.getAttribute("x")).toBe("200");
    expect(panner.getAttribute("y")).toBe("100");
  });

  it("keeps the pan relative to the center when the element resizes", async () => {
    const { viewport, panner } = await make_viewport();
    await viewport.pan_x.write(10);
    viewport.style.width = "600px";
    await frame();
    await frame();
    expect(value(viewport.pan_x)).toBe(10);
    expect(panner.getAttribute("x")).toBe("310");
  });

  it("zoom state scales the canvas around the center", async () => {
    const { viewport, zoomer } = await make_viewport();
    await viewport.pan_x.write(10);
    await viewport.pan_y.write(4);
    await viewport.zoom.write(2);
    expect(value(viewport.zoom)).toBe(2);
    expect(zoomer.style.scale).toBe("2");
    expect(value(viewport.pan_x)).toBe(20);
    expect(value(viewport.pan_y)).toBe(8);
  });

  it("zoom is limited", async () => {
    const { viewport } = await make_viewport();
    await viewport.zoom.write(0);
    expect(value(viewport.zoom)).toBe(0.001);
    await viewport.zoom.write(1e9);
    expect(value(viewport.zoom)).toBe(10000);
  });

  it("wheel zooms out around the pointer", async () => {
    const { viewport } = await make_viewport();
    await viewport.pan_x.write(0);
    await viewport.pan_y.write(0);
    const c = center(viewport);
    wheel(viewport, { deltaY: 100, clientX: c.x + 100, clientY: c.y });
    expect(value(viewport.zoom)).toBeCloseTo(0.9);
    //The point under the pointer, 100px right of center, stays in place
    expect(value(viewport.pan_x)).toBeCloseTo(100 * (1 - 0.9));
    expect(value(viewport.pan_y)).toBeCloseTo(0);
  });

  it("wheel prevents the page from scrolling", async () => {
    const { viewport } = await make_viewport();
    expect(wheel(viewport, { deltaY: 10 })).toBe(false);
  });

  it("ctrl wheel pans vertically without zooming", async () => {
    const { viewport } = await make_viewport();
    await viewport.pan_y.write(0);
    wheel(viewport, { deltaY: 100, ctrlKey: true });
    expect(value(viewport.zoom)).toBe(1);
    expect(value(viewport.pan_y)).toBe(-50);
  });

  it("horizontal wheel pans horizontally", async () => {
    const { viewport } = await make_viewport();
    await viewport.pan_x.write(0);
    wheel(viewport, { deltaX: 100 });
    expect(value(viewport.pan_x)).toBe(-50);
    wheel(viewport, { deltaX: 100, shiftKey: true });
    expect(value(viewport.pan_x)).toBe(-55);
  });

  it("dragging with the mouse pans", async () => {
    const { viewport } = await make_viewport();
    await viewport.pan_x.write(0);
    await viewport.pan_y.write(0);
    const c = center(viewport);
    pointer(viewport, "pointerdown", { clientX: c.x, clientY: c.y });
    pointer(viewport, "pointermove", { clientX: c.x + 30, clientY: c.y - 10 });
    expect(value(viewport.pan_x)).toBe(30);
    expect(value(viewport.pan_y)).toBe(-10);
    pointer(viewport, "pointerup", { clientX: c.x + 30, clientY: c.y - 10 });
    pointer(viewport, "pointermove", { clientX: c.x + 60, clientY: c.y });
    expect(value(viewport.pan_x)).toBe(30);
  });

  it("ignores pen input", async () => {
    const { viewport } = await make_viewport();
    await viewport.pan_x.write(0);
    const c = center(viewport);
    pointer(viewport, "pointerdown", { clientX: c.x, clientY: c.y, pointerType: "pen" });
    pointer(viewport, "pointermove", { clientX: c.x + 30, clientY: c.y, pointerType: "pen" });
    expect(value(viewport.pan_x)).toBe(0);
  });

  it("a cancelled drag does not affect the next drag", async () => {
    const { viewport } = await make_viewport();
    await viewport.pan_x.write(0);
    const c = center(viewport);
    pointer(viewport, "pointerdown", { clientX: c.x, clientY: c.y, pointerType: "touch", pointerId: 1 });
    //The browser takes over the touch, for example for a system gesture, no pointerup follows
    pointer(viewport, "pointercancel", { clientX: c.x, clientY: c.y, pointerType: "touch", pointerId: 1 });
    viewport.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 1 }));
    //Outside the double press time
    await wait(350);
    const start = value(viewport.pan_x);
    pointer(viewport, "pointerdown", { clientX: c.x, clientY: c.y, pointerType: "touch", pointerId: 2 });
    pointer(viewport, "pointermove", { clientX: c.x + 40, clientY: c.y, pointerType: "touch", pointerId: 2 });
    expect(value(viewport.pan_x)).toBe(start + 40);
  });

  it("a double press resets pan and fits the canvas", async () => {
    const { viewport } = await make_viewport();
    await viewport.pan_x.write(50);
    await viewport.zoom.write(3);
    const c = center(viewport);
    pointer(viewport, "pointerdown", { clientX: c.x, clientY: c.y });
    pointer(viewport, "pointerup", { clientX: c.x, clientY: c.y });
    pointer(viewport, "pointerdown", { clientX: c.x, clientY: c.y });
    expect(value(viewport.pan_x)).toBe(0);
    expect(value(viewport.pan_y)).toBe(0);
    //400x200 element showing a 200x100 canvas
    expect(value(viewport.zoom)).toBe(2);
  });
});

describe("Canvas viewport elements", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  /**Index in the boxes of every shown canvas, compared by identity as all canvases look the same*/
  const canvases = (elements: SVGGElement, boxes: ViewportElement[]) =>
    [...elements.children].map((canvas) =>
      boxes.findIndex((box) => box.canvas === canvas),
    );

  it("shows the canvases of an element array", async () => {
    const { viewport, elements } = await make_viewport();
    const boxes = [new Box(), new Box()];
    viewport.elements = boxes;
    expect(canvases(elements, boxes)).toEqual([0, 1]);
    viewport.elements = [];
    expect(elements.children.length).toBe(0);
  });

  it("follows an array state", async () => {
    const { viewport, elements } = await make_viewport();
    const boxes = [new Box(), new Box(), new Box(), new Box()];
    const [a, b, c, d] = boxes;
    const state = st.ok_w<ViewportElement[]>([a, b]);
    viewport.elements = state;
    expect(canvases(elements, boxes)).toEqual([0, 1]);
    state.array.push(c);
    state.array.unshift(d);
    expect(canvases(elements, boxes)).toEqual([3, 0, 1, 2]);
    state.array.splice(1, 2);
    expect(canvases(elements, boxes)).toEqual([3, 2]);
    state.array.change(0, a);
    expect(canvases(elements, boxes)).toEqual([0, 2]);
    state.array.move(0, 1);
    expect(canvases(elements, boxes)).toEqual([2, 0]);
  });

  it("follows moves of several elements", async () => {
    const { viewport, elements } = await make_viewport();
    const boxes = [new Box(), new Box(), new Box(), new Box()];
    const state = st.ok_w<ViewportElement[]>([...boxes]);
    viewport.elements = state;
    state.array.move(0, 2, 2);
    expect(canvases(elements, boxes)).toEqual([2, 3, 0, 1]);
  });

  it("replacing a state unsubscribes the old one", async () => {
    const { viewport, elements } = await make_viewport();
    const first = st.ok_w<ViewportElement[]>([new Box()]);
    const second = st.ok_w<ViewportElement[]>([new Box(), new Box()]);
    viewport.elements = first;
    viewport.elements = second;
    expect(first.amount()).toBe(0);
    expect(elements.children.length).toBe(2);
    viewport.elements = [];
    expect(second.amount()).toBe(0);
  });

  it("pressing an element attaches the mover, pressing outside removes it", async () => {
    const { viewport, canvas } = await make_viewport();
    const box = new Box();
    viewport.elements = [box];
    pointer(box.canvas, "pointerdown");
    const mover = canvas.querySelector(".viewport-mover");
    expect(mover).not.toBeNull();
    pointer(document.body, "pointerdown");
    expect(mover!.isConnected).toBe(false);
  });

  it("pressing the empty canvas removes the mover", async () => {
    const { viewport, canvas } = await make_viewport();
    const box = new Box();
    viewport.elements = [box];
    viewport.attach_mover(box);
    pointer(viewport, "pointerdown");
    expect(canvas.querySelector(".viewport-mover")).toBeNull();
  });

  it("the window losing focus removes the mover", async () => {
    const { viewport, canvas } = await make_viewport();
    const box = new Box();
    viewport.elements = [box];
    viewport.attach_mover(box);
    window.dispatchEvent(new Event("blur"));
    expect(canvas.querySelector(".viewport-mover")).toBeNull();
  });
});

describe("Canvas viewport mover", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  /**Viewport with one box at 20,10 and the mover attached*/
  const with_mover = async () => {
    const parts = await make_viewport();
    const box = new Box();
    box.position_x = 20;
    box.position_y = 10;
    parts.viewport.elements = [box];
    parts.viewport.attach_mover(box);
    const mover = parts.canvas.querySelector(".viewport-mover") as SVGSVGElement;
    const handle = (name: string) => {
      const element = mover.querySelector(":scope > svg." + name) as SVGSVGElement;
      stub_capture(element);
      return element;
    };
    return { ...parts, box, mover, handle };
  };

  it("is placed on the element", async () => {
    const { mover } = await with_mover();
    expect(mover.getAttribute("x")).toBe("20");
    expect(mover.getAttribute("y")).toBe("10");
    expect(mover.querySelector(":scope > svg.se")!.getAttribute("x")).toBe("40");
    expect(mover.querySelector(":scope > svg.se")!.getAttribute("y")).toBe("20");
  });

  it("dragging the move handle moves the element on the grid", async () => {
    const { box, handle } = await with_mover();
    const move = handle("move");
    const start = move.getBoundingClientRect();
    const x = start.left + 2;
    const y = start.top + 2;
    pointer(move, "pointerdown", { clientX: x, clientY: y });
    pointer(move, "pointermove", { clientX: x + 12, clientY: y + 9 });
    expect(box.position_x).toBe(30);
    expect(box.position_y).toBe(20);
    pointer(move, "pointermove", { clientX: x + 21, clientY: y + 19 });
    expect(box.position_x).toBe(40);
    expect(box.position_y).toBe(30);
    pointer(move, "pointerup", { clientX: x + 21, clientY: y + 19 });
  });

  it("dragging the move handle with shift does not snap", async () => {
    const { box, handle } = await with_mover();
    const move = handle("move");
    const start = move.getBoundingClientRect();
    const x = start.left + 2;
    const y = start.top + 2;
    pointer(move, "pointerdown", { clientX: x, clientY: y });
    pointer(move, "pointermove", { clientX: x + 3, clientY: y + 4, shiftKey: true });
    expect(box.position_x).toBe(23);
    expect(box.position_y).toBe(14);
  });

  it("dragging the south east corner resizes the element", async () => {
    const { box, handle, mover } = await with_mover();
    const se = handle("se");
    pointer(se, "pointerdown", { clientX: 100, clientY: 100 });
    pointer(se, "pointermove", { clientX: 120, clientY: 105 });
    expect(box.width).toBe(60);
    expect(box.height).toBe(25);
    expect(box.position_x).toBe(20);
    expect(box.position_y).toBe(10);
    expect(box.canvas.getAttribute("width")).toBe("60");
    expect(mover.querySelector(":scope > rect")!.getAttribute("width")).toBe("62");
    pointer(se, "pointerup", { clientX: 120, clientY: 105 });
    pointer(se, "pointermove", { clientX: 200, clientY: 200 });
    expect(box.width).toBe(60);
  });

  it("dragging the north west corner resizes and keeps the opposite corner", async () => {
    const { box, handle } = await with_mover();
    const nw = handle("nw");
    pointer(nw, "pointerdown", { clientX: 100, clientY: 100 });
    pointer(nw, "pointermove", { clientX: 90, clientY: 95 });
    expect(box.width).toBe(50);
    expect(box.height).toBe(25);
    expect(box.position_x).toBe(10);
    expect(box.position_y).toBe(5);
  });

  it("does not resize below one unit", async () => {
    const { box, handle } = await with_mover();
    const se = handle("se");
    pointer(se, "pointerdown", { clientX: 100, clientY: 100 });
    pointer(se, "pointermove", { clientX: 0, clientY: 0 });
    expect(box.width).toBe(1);
    expect(box.height).toBe(1);
  });

  it("resizing follows the zoom", async () => {
    const { viewport, box, handle } = await with_mover();
    await viewport.zoom.write(2);
    const se = handle("se");
    pointer(se, "pointerdown", { clientX: 100, clientY: 100 });
    pointer(se, "pointermove", { clientX: 120, clientY: 100 });
    expect(box.width).toBe(50);
  });

  it("after detaching, dragging does not change the element", async () => {
    const { viewport, box, handle } = await with_mover();
    const se = handle("se");
    pointer(viewport, "pointerdown");
    pointer(se, "pointerdown", { clientX: 100, clientY: 100 });
    pointer(se, "pointermove", { clientX: 150, clientY: 150 });
    expect(box.width).toBe(40);
  });

  it("attaching to another element does not change the first element", async () => {
    const { viewport, box } = await with_mover();
    const other = new Box();
    other.width = 80;
    other.position_x = 100;
    viewport.elements = [box, other];
    viewport.attach_mover(other);
    expect(box.width).toBe(40);
    expect(box.position_x).toBe(20);
  });

  it("a grid of 0 does not snap, instead of giving NaN", async () => {
    const { viewport, box, handle } = await with_mover();
    await viewport.grid_x.write(0);
    await viewport.grid_y.write(0);
    const move = handle("move");
    const start = move.getBoundingClientRect();
    const x = start.left + 2;
    const y = start.top + 2;
    pointer(move, "pointerdown", { clientX: x, clientY: y });
    pointer(move, "pointermove", { clientX: x + 3, clientY: y + 4 });
    expect(box.position_x).toBe(23);
    expect(box.position_y).toBe(14);
  });

  it("a rotation grid of 0 does not snap, instead of giving NaN", async () => {
    const { viewport, box, handle } = await with_mover();
    await viewport.grid_rotate.write(0);
    const rotate = handle("rotate");
    const start = rotate.getBoundingClientRect();
    const x = start.left + start.width / 2;
    const y = start.top + start.height / 2;
    pointer(rotate, "pointerdown", { clientX: x, clientY: y });
    pointer(rotate, "pointermove", { clientX: x + 7, clientY: y + 3 });
    expect(Number.isNaN(box.rotation)).toBe(false);
    expect(box.rotation).not.toBe(0);
  });

  it("handles stop following the pointer after a pointercancel", async () => {
    for (const name of ["move", "se", "rotate"]) {
      const { box, handle } = await with_mover();
      const element = handle(name);
      const start = element.getBoundingClientRect();
      const x = start.left + 2;
      const y = start.top + 2;
      pointer(element, "pointerdown", { clientX: x, clientY: y });
      pointer(element, "pointercancel", { clientX: x, clientY: y });
      pointer(element, "pointermove", { clientX: x + 50, clientY: y + 50 });
      expect([name, box.position_x, box.position_y]).toEqual([name, 20, 10]);
      expect([name, box.width, box.height]).toEqual([name, 40, 20]);
      expect([name, box.rotation]).toEqual([name, 0]);
      document.body.replaceChildren();
    }
  });

  it("is removed when its element is removed from the viewport", async () => {
    const { viewport, box, canvas } = await with_mover();
    const other = new Box();
    viewport.elements = [box, other];
    expect(canvas.querySelector(".viewport-mover")).not.toBeNull();
    viewport.elements = [other];
    expect(canvas.querySelector(".viewport-mover")).toBeNull();
  });

  it("is removed when its element is removed from an element state", async () => {
    const { viewport, box, canvas } = await with_mover();
    const state = st.ok_w<ViewportElement[]>([box, new Box()]);
    viewport.elements = state;
    viewport.attach_mover(box);
    state.array.splice(1, 1);
    expect(canvas.querySelector(".viewport-mover")).not.toBeNull();
    state.array.splice(0, 1);
    expect(canvas.querySelector(".viewport-mover")).toBeNull();
  });
});

describe("Canvas viewport element", () => {
  it("sizes its canvas to the default size and keeps the ratio by stretching", () => {
    const box = new Box();
    expect(box.width).toBe(40);
    expect(box.height).toBe(20);
    expect(box.canvas.getAttribute("viewBox")).toBe("0 0 40 20");
    expect(box.canvas.getAttribute("preserveAspectRatio")).toBe("none");
    expect(box.canvas.classList.contains("viewport-element")).toBe(true);
    expect(box.canvas.classList.contains("canvastest-box")).toBe(true);
    expect(box.optimal_ratio().unwrap()).toBe(2);
  });

  it("position sets the canvas coordinates", () => {
    const box = new Box();
    box.position_x = 5;
    box.position_y = 7;
    expect(box.canvas.getAttribute("x")).toBe("5");
    expect(box.canvas.getAttribute("y")).toBe("7");
    expect(box.canvas.hasAttribute("transform")).toBe(false);
  });

  it("rotation rotates around the center of the element", () => {
    const box = new Box();
    box.position_x = 10;
    box.position_y = 10;
    box.rotation = 45;
    expect(box.canvas.getAttribute("transform")).toBe("rotate(45 30 20)");
    box.rotation_center_x = 0;
    box.rotation_center_y = 0;
    expect(box.canvas.getAttribute("transform")).toBe("rotate(45 10 10)");
    box.rotation = 0;
    expect(box.canvas.hasAttribute("transform")).toBe(false);
  });

  it("resizing with an optimal ratio stretches and keeps the view box", () => {
    const box = new Box();
    box.width = 80;
    box.height = 80;
    expect(box.canvas.getAttribute("width")).toBe("80");
    expect(box.canvas.getAttribute("height")).toBe("80");
    expect(box.canvas.getAttribute("viewBox")).toBe("0 0 40 20");
  });

  it("resizing without an optimal ratio changes the view box and calls on_resize", () => {
    const box = new FreeBox();
    expect(box.canvas.hasAttribute("preserveAspectRatio")).toBe(false);
    box.width = 80;
    expect(box.canvas.getAttribute("viewBox")).toBe("0 0 80 20");
    expect(box.resizes).toEqual([[80, 20]]);
  });
});
