import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import { panel } from "../container";
import { content, type ContentBase } from "../content";
import {
  layout,
  layout_split,
  layout_tabs,
  type Layout,
  type LayoutNode,
  type LayoutTabs,
} from "../layout/index";
import { workspace, workspace_panel, type Workspace } from "../workspace";

const shown: (Layout | Workspace)[] = [];
/**Puts the element in a sized box in the page, so its elements are connected and follow their states*/
const show = <T extends Layout | Workspace>(element: T): T => {
  const box = document.body.appendChild(document.createElement("div"));
  box.style.cssText = "width:600px;height:400px";
  box.appendChild(element);
  shown.push(element);
  return element;
};
afterEach(() => {
  for (const element of shown.splice(0)) element.parentElement?.remove();
});

const closable = (title: string) => content({ title, closable: true });
const tab_of = (c: ContentBase) =>
  [...document.querySelectorAll("composition-layouttab")].find(
    (t) => (t as HTMLElement).title === c.content_title,
  ) as HTMLElement;
/**Whether the tab of the content shows a close button*/
const has_close = (c: ContentBase) => {
  const close = tab_of(c).querySelector<HTMLElement>(".close")!;
  return !close.hidden && getComputedStyle(close).display !== "none";
};
const tabs_of = (group: LayoutTabs) => group.tabs.ok();

describe("Overflow", () => {
  /**Waits for the collected min sizes, they are worked out in a microtask, and a frame for the layout*/
  const settle = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

  it("scrolls when the smallest size of its root is bigger than the layout, the groups keep their smallest size", async () => {
    const wide = (title: string) => content({ title, min_width: 30 });
    const a = wide("A");
    const b = wide("B");
    const element = show(
      layout({
        root: layout_split("row", [layout_tabs([a]), layout_tabs([b])]),
      }),
    );
    await settle();
    //Two groups of 30rem and a sizer, in a 600px box, overflowing, and the user can scroll to it, not clipped
    expect(element.scrollWidth).toBeGreaterThan(element.clientWidth);
    expect(["auto", "scroll"]).toContain(getComputedStyle(element).overflowX);
    expect(["auto", "scroll"]).toContain(getComputedStyle(element).overflowY);
    for (const group of element.querySelectorAll("composition-layouttabs"))
      expect(group.getBoundingClientRect().width).toBeGreaterThanOrEqual(
        30 * 16,
      );
  });

  it("does not scroll when the layout is big enough", async () => {
    const element = show(
      layout({
        root: layout_split("row", [
          layout_tabs([content({ title: "A" })]),
          layout_tabs([content({ title: "B" })]),
        ]),
      }),
    );
    await settle();
    expect(element.scrollWidth).toBe(element.clientWidth);
    expect(element.scrollHeight).toBe(element.clientHeight);
  });
});

describe("Crossing sizers", () => {
  it("marks the sizers lining up across the hovered sizer only where they meet it", () => {
    const cell = (name: string) => layout_tabs([content({ title: name })]);
    const row = (name: string) =>
      layout_split("row", [cell(name + " left"), cell(name + " right")]);
    const element = show(
      layout({ root: layout_split("column", [row("Top"), row("Bottom")]) }),
    );
    const sizers = [...element.querySelectorAll<HTMLElement>(".sizer")];
    const middle = sizers.find((s) => s.parentElement?.matches(".column"))!;
    const upright = sizers.filter((s) => s !== middle);
    expect(upright.length).toBe(2);
    const move = (x: number, y: number) =>
      middle.dispatchEvent(
        new PointerEvent("pointermove", { clientX: x, clientY: y }),
      );
    const crossing = upright[0].getBoundingClientRect();
    const y = middle.getBoundingClientRect().top + 2;
    move(crossing.left + crossing.width / 2, y);
    expect(upright.every((s) => s.classList.contains("joined"))).toBe(true);
    expect(middle.classList.contains("crossing")).toBe(true);
    //Along the same sizer, away from where the others meet it
    move(middle.getBoundingClientRect().left + 5, y);
    expect(upright.some((s) => s.classList.contains("joined"))).toBe(false);
    expect(middle.classList.contains("crossing")).toBe(false);
    middle.dispatchEvent(new PointerEvent("pointerleave"));
    expect(middle.classList.contains("crossing")).toBe(false);
  });
});

describe("Workspace layer", () => {
  /**Layer of the panel showing the content, the z-index of the layer box it is in*/
  const layer_of = (c: ContentBase) =>
    c.closest("composition-panel")?.parentElement?.style.zIndex;
  const make = (layer?: number | ReturnType<typeof state.ok_w<number>>) => {
    const c = closable("In panel");
    const ws = show(
      workspace({
        root: layout_tabs([closable("Main")]),
        panels: [
          workspace_panel(layout_tabs([c]), {
            x: 1,
            y: 1,
            width: 20,
            height: 10,
          }),
        ],
        layer,
      }),
    );
    return { c, ws };
  };

  it("puts the panels in layer 0 when not given", () => {
    expect(layer_of(make().c)).toBe("0");
  });

  it("puts the panels in the layer given as an initial value, and in the one set again", () => {
    const { c, ws } = make(3);
    expect(layer_of(c)).toBe("3");
    ws.set({ layer: 5 });
    expect(layer_of(c)).toBe("5");
  });

  it("puts the panels in the layer of a state, and follows it", async () => {
    const layer = state.ok_w(2);
    const { c } = make(layer);
    expect(layer_of(c)).toBe("2");
    await layer.write(4);
    expect(layer_of(c)).toBe("4");
  });
});

describe("Closing tabs that can not leave their group", () => {
  /**A read only split of two groups, the first with one tab, the second with two*/
  const locked_split = () => {
    const a = closable("A");
    const b1 = closable("B1");
    const b2 = closable("B2");
    const first = layout_tabs([a]);
    const second = layout_tabs([b1, b2]);
    const root: LayoutNode = {
      direction: "row",
      children: state.ros(ok<LayoutNode[]>([first, second])),
      size: state.ok_w(1),
    };
    show(layout({ root }));
    return { a, b1, b2, first, second };
  };

  it("keeps the last tab of a group in a read only split when it is closed", () => {
    const { a, first } = locked_split();
    a.content_close();
    expect(tabs_of(first)).toEqual([a]);
  });

  it("shows no close button on the last tab of a group in a read only split", () => {
    const { a, b1, b2 } = locked_split();
    expect(has_close(a)).toBe(false);
    expect(has_close(b1)).toBe(true);
    expect(has_close(b2)).toBe(true);
  });

  it("closes a tab of a group in a read only split that has more, then keeps the last", () => {
    const { b1, b2, second } = locked_split();
    b1.content_close();
    expect(tabs_of(second)).toEqual([b2]);
    expect(has_close(b2)).toBe(false);
    b2.content_close();
    expect(tabs_of(second)).toEqual([b2]);
  });

  it("closes the last tab of a writable split, the group goes", () => {
    const a = closable("A");
    const b = closable("B");
    const root = state.ok_w<LayoutNode>(
      layout_split("row", [layout_tabs([a]), layout_tabs([b])]),
    );
    show(layout({ root }));
    expect(has_close(a)).toBe(true);
    a.content_close();
    const after = root.ok();
    expect("tabs" in after && tabs_of(after)).toEqual([b]);
  });

  it("closes the panel of content the app took out of a layout", async () => {
    const a = closable("A");
    const b = closable("B");
    const tabs = state.ok_w<ContentBase[]>([a, b]);
    show(
      layout({
        root: {
          tabs,
          active: state.ok_w<ContentBase | undefined>(a),
          size: state.ok_w(1),
        },
      }),
    );
    //The app takes the content out of the layout by writing the state, and shows it in a panel
    await tabs.write([b]);
    const shown = panel(a);
    let closed = false;
    void shown.on_close().then(() => (closed = true));
    a.content_close();
    await Promise.resolve();
    expect(closed).toBe(true);
    expect(shown.isConnected).toBe(false);
  });

  it("keeps the panel of a layout open while a content in it can not leave its group", () => {
    const a = closable("A");
    const b1 = closable("B1");
    const b2 = closable("B2");
    const locked: LayoutTabs = {
      tabs: state.ros(ok<ContentBase[]>([b1, b2])),
      active: state.ok_w<ContentBase | undefined>(b1),
      size: state.ok_w(1),
    };
    const root = layout_split("row", [layout_tabs([a]), locked]);
    const element = layout({ root });
    const shown = panel(element);
    element.content_close();
    expect(tabs_of(locked)).toEqual([b1, b2]);
    expect(shown.isConnected).toBe(true);
    shown.close();
  });

  it("closes the panel of a layout when every content in it closes", () => {
    const group = layout_tabs([closable("A"), closable("B")]);
    const element = layout({ root: group });
    const shown = panel(element);
    element.content_close();
    expect(tabs_of(group)).toEqual([]);
    expect(shown.isConnected).toBe(false);
  });

  it("keeps the last tab of a panel of read only panels when it is closed", () => {
    const fixed = closable("Fixed");
    const group = layout_tabs([fixed]);
    show(
      workspace({
        root: layout_tabs([closable("Main")]),
        panels: state.ros(
          ok([workspace_panel(group, { x: 1, y: 1, width: 20, height: 10 })]),
        ),
      }),
    );
    expect(has_close(fixed)).toBe(false);
    fixed.content_close();
    expect(tabs_of(group)).toEqual([fixed]);
  });
});
