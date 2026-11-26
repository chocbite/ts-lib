import { define_element } from "#base";
import state, { type StateROSW } from "@chocbite/ts-lib/state";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  canvas,
  WidgetBase,
  type CanvasSelection,
  type CanvasWidgetData,
} from "..";
import { copy_widgets, paste_widgets } from "../clipboard";
import { CanvasGroup } from "../data";
import { GROUP } from "../group_widget";

class GroupTestWidget extends WidgetBase {
  static element_name() {
    return "grouptestwidget";
  }
}
define_element(GroupTestWidget);

const group = canvas.widgets.group("grouptest", "Group test", "");
const definition = group.add("box", "Box", "", {
  create: (options) => GroupTestWidget.create(options),
});
afterAll(() => group.remove());

afterEach(() => {
  (document.activeElement as HTMLElement | null)?.blur();
  document.body.replaceChildren();
});

const tick = () => new Promise((resolve) => setTimeout(resolve));
type StateOkW<T> = ReturnType<typeof state.ok_w<T>>;

const box = (x: number, y: number, width = 10, height = 10, rotation = 0) =>
  canvas.widget(definition, { x, y, width, height, rotation });
/**An option state of a widget or of its data, groups have options other widgets do not*/
const option = (widget: { options: object }, key: string) =>
  (widget.options as Record<string, unknown>)[key];
const value = (widget: { options: object }, key: string) =>
  (widget.options as Record<string, StateROSW<unknown>>)[key].ok();
const place = (widget: { options: object }) =>
  ["x", "y", "width", "height", "rotation"].map(
    (key) => Math.round(value(widget, key) as number) + 0,
  );
/**The data of the widgets of a group*/
const children = (group: { options: object }) =>
  (value(group, "widgets") as CanvasWidgetData[]).slice();

describe("Groups", () => {
  it("are a CanvasGroup whose content is a page, which makes the widgets in it", async () => {
    const [a, b, c] = [box(0, 0), box(20, 0), box(40, 0)];
    const page = canvas.page({ widgets: state.ok_w([a, b, c]) });
    const [wa, wb, wc] = [a, b, c].map((data) => page.widget_of(data));
    expect([wa, wb, wc].map((w) => w.page)).toEqual([page, page, page]);
    //A page gives the same widget for the same data
    expect(page.widget_of(a)).toBe(wa);
    const made = (await canvas.group(page, [wb, wc]))!;
    expect(made).toBeInstanceOf(CanvasGroup);
    expect(made.page).toBe(page);
    expect(made.content.group).toBe(made);
    expect(made.content.widgets).toBe(option(made, "widgets"));
    //The content makes widgets of its own for the data, on it
    const inside = made.content.widgets_now();
    expect(inside.map((w) => w.data)).toEqual([b, c]);
    expect(inside.map((w) => w.page)).toEqual([made.content, made.content]);
    const ungrouped = await canvas.ungroup(page, [made]);
    expect(ungrouped.map((w) => w.data)).toEqual([b, c]);
    expect(ungrouped.map((w) => w.page)).toEqual([page, page]);
  });

  it("groups widgets into a group in the place of the front one, their positions relative to it", async () => {
    const [a, b, c] = [box(10, 20), box(50, 0), box(30, 40, 20, 10)];
    const widgets = state.ok_w([a, b, c]);
    const page = canvas.page({ widgets });
    const made = await canvas.group(page, [
      page.widget_of(c),
      page.widget_of(a),
    ]);
    expect(made).toBeDefined();
    const g = made!;
    expect(g.widget).toBe(GROUP);
    expect(widgets.ok()).toEqual([b, g.data]);
    //In drawing order
    expect(children(g)).toEqual([a, c]);
    //The box of a and c, 10,20 to 50,50
    expect(place(g)).toEqual([10, 20, 40, 30, 0]);
    expect([
      value(g, "content_width"),
      value(g, "content_height"),
      value(g, "display"),
    ]).toEqual([40, 30, "scale"]);
    expect(place(a)).toEqual([0, 0, 10, 10, 0]);
    expect(place(c)).toEqual([20, 20, 20, 10, 0]);
  });

  it("ungroups back to where the widgets were, in the place of the group", async () => {
    const [a, b, c] = [box(10, 20), box(50, 0), box(30, 40, 20, 10, 30)];
    const widgets = state.ok_w([a, b, c]);
    const page = canvas.page({ widgets });
    const before = [a, c].map(place);
    const g = (await canvas.group(
      page,
      [page.widget_of(a), page.widget_of(c)],
      15,
    ))!;
    expect(value(g, "rotation")).toBe(15);
    //The group moved 5 to the right
    (g.options.x as StateOkW<number>).set_ok((value(g, "x") as number) + 5);
    const ungrouped = await canvas.ungroup(page, [g]);
    expect(ungrouped.map((w) => w.data)).toEqual([a, c]);
    expect(widgets.ok()).toEqual([b, a, c]);
    expect([a, c].map(place)).toEqual(
      before.map(([x, y, ...rest]) => [x + 5, y, ...rest]),
    );
  });

  it("scales the content to the group, or shows it at its own size, clipped or with scrollbars", async () => {
    const child = box(0, 0, 20, 10);
    const widgets = state.ok_w<CanvasWidgetData[]>([child]);
    const page = canvas.page({ width: 200, height: 100, widgets });
    const g = (await canvas.group(page, [page.widget_of(child)]))!;
    (g.options.width as StateOkW<number>).set_ok(40);
    (g.options.height as StateOkW<number>).set_ok(20);
    const viewport = document.body.appendChild(canvas.viewport({ page }));
    viewport.style.cssText = "width:200px;height:100px;";
    await tick();
    const element = () =>
      viewport.querySelector("canvas-grouptestwidget") as HTMLElement;
    const group_element = viewport.querySelector(
      "canvas-groupwidget",
    ) as HTMLElement;
    //Once the viewport has fitted the page, at a scale of 1
    await vi.waitFor(() =>
      expect(element().getBoundingClientRect().width).toBeCloseTo(40),
    );
    (option(g, "display") as StateOkW<string>).set_ok("clip");
    expect(element().getBoundingClientRect().width).toBeCloseTo(20);
    expect(getComputedStyle(group_element).overflow).toBe("hidden");
    (option(g, "display") as StateOkW<string>).set_ok("scroll");
    expect(getComputedStyle(group_element).overflow).toBe("auto");
  });

  it("scale their content evenly, centered, so it keeps its proportions", async () => {
    const child = box(0, 0, 20, 10);
    const widgets = state.ok_w<CanvasWidgetData[]>([child]);
    const page = canvas.page({ width: 200, height: 100, widgets });
    const g = (await canvas.group(page, [page.widget_of(child)]))!;
    //Four times as wide, twice as high, the content is scaled twice and centered
    (g.options.width as StateOkW<number>).set_ok(80);
    (g.options.height as StateOkW<number>).set_ok(20);
    const viewport = document.body.appendChild(canvas.viewport({ page }));
    viewport.style.cssText = "width:200px;height:100px;";
    const element = () =>
      viewport.querySelector("canvas-grouptestwidget") as HTMLElement;
    const group_element = () =>
      viewport.querySelector("canvas-groupwidget") as HTMLElement;
    await vi.waitFor(() =>
      expect(element().getBoundingClientRect().width).toBeCloseTo(40),
    );
    expect(element().getBoundingClientRect().height).toBeCloseTo(20);
    expect(
      element().getBoundingClientRect().left -
        group_element().getBoundingClientRect().left,
    ).toBeCloseTo(20);
    //Ungrouped where the group shows it
    const x = value(g, "x") as number;
    await canvas.ungroup(page, [g]);
    expect(place(child)).toEqual([Math.round(x + 20), 0, 40, 20, 0]);
  });

  it("stretch their content to fill them, each axis on its own", async () => {
    const child = box(0, 0, 20, 10);
    const widgets = state.ok_w<CanvasWidgetData[]>([child]);
    const page = canvas.page({ width: 200, height: 100, widgets });
    const g = (await canvas.group(page, [page.widget_of(child)]))!;
    (option(g, "display") as StateOkW<string>).set_ok("stretch");
    //Four times as wide, twice as high
    (g.options.width as StateOkW<number>).set_ok(80);
    (g.options.height as StateOkW<number>).set_ok(20);
    const viewport = document.body.appendChild(canvas.viewport({ page }));
    viewport.style.cssText = "width:200px;height:100px;";
    const element = () =>
      viewport.querySelector("canvas-grouptestwidget") as HTMLElement;
    const group_element = () =>
      viewport.querySelector("canvas-groupwidget") as HTMLElement;
    await vi.waitFor(() =>
      expect(element().getBoundingClientRect().width).toBeCloseTo(80),
    );
    expect(element().getBoundingClientRect().height).toBeCloseTo(20);
    expect(
      element().getBoundingClientRect().left -
        group_element().getBoundingClientRect().left,
    ).toBeCloseTo(0);
    //Ungrouped where the group shows it, stretched
    const x = value(g, "x") as number;
    await canvas.ungroup(page, [g]);
    expect(place(child)).toEqual([Math.round(x), 0, 80, 20, 0]);
  });

  it("paint the background of their content, transparent until given one", async () => {
    const child = box(0, 0);
    const widgets = state.ok_w<CanvasWidgetData[]>([child]);
    const page = canvas.page({ width: 200, height: 100, widgets });
    const g = (await canvas.group(page, [page.widget_of(child)]))!;
    expect(value(g, "background")).toBe("transparent");
    document.body.appendChild(canvas.viewport({ page }));
    await tick();
    const content = document.querySelector(
      "canvas-groupwidget > canvas-page",
    ) as HTMLElement;
    expect(getComputedStyle(content).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    (option(g, "background") as StateOkW<string>).set_ok("#ff0000");
    expect(getComputedStyle(content).backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it("are saved, loaded and copied with their widgets", async () => {
    const [a, b] = [box(0, 0), box(20, 0)];
    const widgets = state.ok_w([a, b]);
    const page = canvas.page({ widgets });
    const g = (await canvas.group(page, [
      page.widget_of(a),
      page.widget_of(b),
    ]))!;
    const json: unknown = JSON.parse(await state.ok(page).to_json());
    const loaded = canvas.page_from_json(json);
    if (!loaded.some) throw new Error("not loaded");
    const [loaded_group] = (
      loaded.value.widgets as StateROSW<CanvasWidgetData[]>
    ).ok();
    const inside = children(loaded_group);
    expect(inside).toHaveLength(2);
    expect(place(inside[1])).toEqual(place(b));
    expect((inside[1].options.x as StateROSW<number>).writable).toBe(true);
    copy_widgets([g]);
    const [pasted] = await paste_widgets(page);
    expect(children(pasted)).toHaveLength(2);
    expect(children(pasted)[0]).not.toBe(a);
    expect(children(pasted)[0].options.x).not.toBe(a.options.x);
  });

  it("keeps ids unique per level", async () => {
    const [a, b, c] = [box(0, 0), box(20, 0), box(40, 0)];
    const widgets = state.ok_w([a, b, c]);
    const page = canvas.page({ widgets });
    document.body.appendChild(canvas.viewport({ page }));
    await tick();
    expect([a, b, c].map((w) => value(w, "id"))).toEqual([
      "box-1",
      "box-2",
      "box-3",
    ]);
    const g = (await canvas.group(page, [
      page.widget_of(b),
      page.widget_of(c),
    ]))!;
    await tick();
    expect(value(g, "id")).toBe("group-1");
    //The widgets inside keep their ids, and a new one inside starts again at 1
    expect([b, c].map((w) => value(w, "id"))).toEqual(["box-2", "box-3"]);
    (option(g, "widgets") as StateOkW<CanvasWidgetData[]>).array.push(
      box(0, 0),
    );
    await tick();
    expect(value(children(g)[2], "id")).toBe("box-1");
  });

  it("ctrl+g groups the selected widgets and selects the group, ctrl+shift+g ungroups it", async () => {
    const [a, b] = [box(10, 10), box(40, 10)];
    const widgets = state.ok_w([a, b]);
    const page = canvas.page({ width: 200, height: 100, widgets });
    const selected = state.ok_w<CanvasSelection>(
      canvas.selection_of([page.widget_of(a), page.widget_of(b)]),
    );
    const viewport = document.body.appendChild(
      canvas.viewport({ page, edit: true, selected }),
    );
    const key = (shiftKey = false) =>
      viewport.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "g",
          ctrlKey: true,
          shiftKey,
          bubbles: true,
          cancelable: true,
        }),
      );
    expect(key()).toBe(false);
    await vi.waitFor(() => expect(widgets.ok()).toHaveLength(1));
    const [g] = widgets.ok();
    expect(selected.ok()).toBe(page.widget_of(g));
    key(true);
    await vi.waitFor(() => expect(widgets.ok()).toEqual([a, b]));
    expect(canvas.selected_widgets(selected.ok())).toEqual([
      page.widget_of(a),
      page.widget_of(b),
    ]);
    expect(
      (viewport.querySelectorAll("canvas-grouptestwidget")[1] as WidgetBase)
        .style.left,
    ).toBe("40px");
  });
});
