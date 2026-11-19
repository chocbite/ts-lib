import state, { type StateROSW } from "@chocbite/ts-lib/state";
import { describe, expect, it } from "vitest";
import { canvas, type CanvasPage, type CanvasWidget } from "..";
import { order_moves, type WidgetOrder } from "../order";

//Distinct paths, so toEqual tells the widgets apart
const widget = (name: string): CanvasWidget => ({
  widget: "/widgets/" + name,
  options: {},
});
const [a, b, c, d, e] = ["a", "b", "c", "d", "e"].map(widget);
const name = (w: CanvasWidget) => w.widget.split("/").at(-1);

/**The names of the widgets after the moves for the order of the selected ones*/
const ordered = (
  widgets: CanvasWidget[],
  selected: CanvasWidget[],
  order: WidgetOrder,
) => {
  const result = [...widgets];
  for (const [from, to] of order_moves(widgets, selected, order))
    result.splice(to, 0, ...result.splice(from, 1));
  return result.map(name).join("");
};

describe("Ordering widgets", () => {
  it("moves a widget to the front or back, or one step, the last is drawn on top", () => {
    expect(ordered([a, b, c], [a], "front")).toBe("bca");
    expect(ordered([a, b, c], [c], "back")).toBe("cab");
    expect(ordered([a, b, c], [a], "forward")).toBe("bac");
    expect(ordered([a, b, c], [c], "backward")).toBe("acb");
  });

  it("moves several widgets together, keeping their order", () => {
    expect(ordered([a, b, c, d, e], [a, c], "front")).toBe("bdeac");
    expect(ordered([a, b, c, d, e], [b, d], "back")).toBe("bdace");
    expect(ordered([a, b, c, d, e], [a, c], "forward")).toBe("badce");
    expect(ordered([a, b, c, d, e], [b, d], "backward")).toBe("badce");
    //Widgets at the end stay, the others close up behind them
    expect(ordered([a, b, c, d, e], [b, d, e], "forward")).toBe("acbde");
  });

  it("gives no moves when nothing can move that way, or the widgets are not on the page", () => {
    expect(order_moves([a, b, c], [c], "front")).toEqual([]);
    expect(order_moves([a, b, c], [b, c], "forward")).toEqual([]);
    expect(order_moves([a, b, c], [a], "back")).toEqual([]);
    expect(order_moves([a, b, c], [a, b], "backward")).toEqual([]);
    expect(order_moves([a, b], [c], "front")).toEqual([]);
  });

  it("removes widgets from the page, and tells when it can not", async () => {
    const widgets = state.ok_w([a, b, c, d]);
    const page: CanvasPage = { widgets };
    expect(await canvas.remove(page, [b, d])).toBe(true);
    expect(widgets.ok().map(name)).toEqual(["a", "c"]);
    expect(await canvas.remove(page, [e])).toBe(false);
    expect(await canvas.remove({ widgets: [a, b] }, [a])).toBe(false);
    expect(await canvas.remove({ widgets: state.ok([a, b]) }, [a])).toBe(false);
  });

  it("writes the widgets state of the page, and tells when it can not", async () => {
    const widgets = state.ok_w([a, b, c]);
    const page: CanvasPage = { widgets };
    expect(await canvas.reorder(page, [a], "front")).toBe(true);
    expect(widgets.ok().map(name)).toEqual(["b", "c", "a"]);
    expect(await canvas.reorder(page, [a], "front")).toBe(false);
    const fixed: CanvasPage = { widgets: [a, b, c] };
    expect(await canvas.reorder(fixed, [a], "front")).toBe(false);
    const read_only: CanvasPage = { widgets: state.ok([a, b, c]) };
    expect(await canvas.reorder(read_only, [a], "front")).toBe(false);
    expect(
      (read_only.widgets as StateROSW<CanvasWidget[]>).ok().map(name),
    ).toEqual(["a", "b", "c"]);
  });
});
