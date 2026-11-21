import state, { type StateROSW } from "@chocbite/ts-lib/state";
import { describe, expect, it } from "vitest";
import type { CanvasLink, CanvasPage, CanvasWidget } from "..";
import { canvas } from "..";
import { copy_widgets, has_copied, paste_widgets } from "../clipboard";

const widget = (x: number, y: number, extra: object = {}): CanvasWidget => ({
  widget: "/widgets/clipboardtest/box",
  options: {
    x: state.ok_w(x),
    y: state.ok_w(y),
    width: state.ok_w(10),
    height: state.ok_w(10),
    ...extra,
  },
});
const value = (widget: CanvasWidget, key: string) =>
  (widget.options as Record<string, StateROSW<unknown>>)[key].ok();
const place = (widget: CanvasWidget) => [
  value(widget, "x"),
  value(widget, "y"),
];

describe("Clipboard of widgets", () => {
  it("pastes copies with states of their own, in front, each paste 20 further", async () => {
    const a = widget(0, 0, { text: state.ok_w("hello") });
    const b = widget(30, 10);
    const widgets = state.ok_w([a, b]);
    const page: CanvasPage = { widgets };
    copy_widgets([a, b]);
    expect(has_copied()).toBe(true);
    const first = await paste_widgets(page);
    expect(widgets.ok()).toEqual([a, b, ...first]);
    expect(first.map(place)).toEqual([
      [20, 20],
      [50, 30],
    ]);
    expect(value(first[0], "text")).toBe("hello");
    expect(first[0].options.x).not.toBe(a.options.x);
    const second = await paste_widgets(page);
    expect(second.map(place)).toEqual([
      [40, 40],
      [70, 50],
    ]);
  });

  it("copies to a JSON text of the widgets, for the clipboard of the system", () => {
    const text = copy_widgets([widget(1, 2, { text: state.ok_w("hi") })]);
    expect(JSON.parse(text)).toEqual({
      format: "chocbite-canvas-widgets",
      widgets: [
        {
          widget: "/widgets/clipboardtest/box",
          options: { x: 1, y: 2, width: 10, height: 10, text: "hi" },
        },
      ],
    });
  });

  it("pastes widgets of a text copied elsewhere, where they were first, then 20 further", async () => {
    copy_widgets([widget(0, 0)]);
    const widgets = state.ok_w<CanvasWidget[]>([]);
    const text = JSON.stringify({
      format: "chocbite-canvas-widgets",
      widgets: [
        {
          widget: "/widgets/clipboardtest/box",
          options: { x: 7, y: 8, width: 10, height: 10 },
        },
      ],
    });
    expect((await paste_widgets({ widgets }, { text })).map(place)).toEqual([
      [7, 8],
    ]);
    expect((await paste_widgets({ widgets }, { text })).map(place)).toEqual([
      [27, 28],
    ]);
  });

  it("pastes the widgets copied in the app for a text that is not copied widgets", async () => {
    copy_widgets([widget(0, 0)]);
    const widgets = state.ok_w<CanvasWidget[]>([]);
    for (const text of ["hello", "{}", '{"format":"other","widgets":[]}'])
      expect(await paste_widgets({ widgets }, { text })).toHaveLength(1);
  });

  it("keeps pasted widgets inside the area given, the top left when they do not fit", async () => {
    const widgets = state.ok_w<CanvasWidget[]>([]);
    const area = { x: 0, y: 0, width: 100, height: 100 };
    copy_widgets([widget(500, -50)]);
    expect(
      (await paste_widgets({ widgets }, { within: area })).map(place),
    ).toEqual([[90, 0]]);
    copy_widgets([widget(0, 0), widget(200, 200)]);
    expect(
      (await paste_widgets({ widgets }, { within: { ...area, x: 50 } })).map(
        place,
      ),
    ).toEqual([
      [50, 20],
      [250, 220],
    ]);
  });

  it("pastes at the point given, the top left of the box around them", async () => {
    const widgets = state.ok_w<CanvasWidget[]>([]);
    copy_widgets([widget(10, 20), widget(40, 30)]);
    const pasted = await paste_widgets({ widgets }, { at: { x: 100, y: 200 } });
    expect(pasted.map(place)).toEqual([
      [100, 200],
      [130, 210],
    ]);
  });

  it("keeps links of the copies", async () => {
    const link = canvas.link<number>("/states/clipboardtest/x");
    const widgets = state.ok_w<CanvasWidget[]>([]);
    copy_widgets([widget(0, 0, { text: state.ok_w(link) })]);
    const [pasted] = await paste_widgets({ widgets });
    expect((value(pasted, "text") as CanvasLink).path).toBe(
      "/states/clipboardtest/x",
    );
  });

  it("pastes cut widgets where they were, then 20 further", async () => {
    const a = widget(5, 5);
    const widgets = state.ok_w([a]);
    const page: CanvasPage = { widgets };
    expect(await canvas.cut(page, [a])).toBe(true);
    expect(widgets.ok()).toEqual([]);
    expect((await paste_widgets(page)).map(place)).toEqual([[5, 5]]);
    expect((await paste_widgets(page)).map(place)).toEqual([[25, 25]]);
  });

  it("pastes nothing into widgets it can not write", async () => {
    copy_widgets([widget(0, 0)]);
    expect(await paste_widgets({ widgets: [] })).toEqual([]);
    expect(await paste_widgets({ widgets: state.ok([]) })).toEqual([]);
  });
});
