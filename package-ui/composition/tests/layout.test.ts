import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import { panel } from "../container";
import type { Panel } from "../panel";
import { content, type ContentBase } from "../content";
import {
  layout,
  layout_split,
  layout_tabs,
  LayoutSide,
  type Layout,
  type LayoutNode,
  type LayoutSplit,
  type LayoutTabs,
} from "../layout/index";
import { group_of, move_content, popout } from "../layout/actions";
import { TABS } from "../layout/tab";
import { DOCUMENT_HANDLER } from "#document";
import {
  workspace,
  workspace_panel,
  workspace_window,
  type Workspace,
} from "../workspace";
import { guarded, later } from "./guarded";

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
const tabs = (...contents: ContentBase[]) => layout_tabs({ content: contents });
const split = (direction: "row" | "column", ...children: LayoutNode[]) =>
  layout_split({ direction, children });
const tab_of = (c: ContentBase) =>
  [...document.querySelectorAll("composition-layouttab")].find(
    (t) => (t as HTMLElement).title === c.content_title,
  ) as HTMLElement;
/**Whether the tab of the content shows a close button*/
const has_close = (c: ContentBase) => {
  const close = tab_of(c).querySelector<HTMLElement>(".close")!;
  return !close.hidden && getComputedStyle(close).display !== "none";
};
const tabs_of = (group: LayoutTabs) => group.contents();
/**Titles of the tabs of the group holding the content*/
const titles_with = (element: Layout, c: ContentBase) =>
  group_of(element.root_node()!, c)
    ?.contents()
    .map((t) => t.content_title);

describe("Overflow", () => {
  /**Waits for the collected min sizes, they are worked out in a microtask, and a frame for the layout*/
  const settle = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

  it("scrolls when the smallest size of its root is bigger than the layout, the groups keep their smallest size", async () => {
    const wide = (title: string) => content({ title, min_width: 30 });
    const element = show(
      layout({ root: split("row", tabs(wide("A")), tabs(wide("B"))) }),
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
        root: split(
          "row",
          tabs(content({ title: "A" })),
          tabs(content({ title: "B" })),
        ),
      }),
    );
    await settle();
    expect(element.scrollWidth).toBe(element.clientWidth);
    expect(element.scrollHeight).toBe(element.clientHeight);
  });
});

describe("Crossing sizers", () => {
  it("marks the sizers lining up across the hovered sizer only where they meet it", () => {
    const cell = (name: string) =>
      layout_tabs({ content: [content({ title: name })] });
    const row = (name: string) =>
      layout_split({
        direction: "row",
        children: [cell(name + " left"), cell(name + " right")],
      });
    const element = show(
      layout({
        root: layout_split({
          direction: "column",
          children: [row("Top"), row("Bottom")],
        }),
      }),
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
        windows: [
          workspace_window(layout_tabs({ content: [closable("Main")] }), [
            workspace_panel(layout_tabs({ content: [c] }), {
              x: 1,
              y: 1,
              width: 20,
              height: 10,
            }),
          ]),
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
    const first = tabs(a);
    const second = tabs(b1, b2);
    show(
      layout({
        root: layout_split({
          direction: "row",
          children: state.ros(ok<LayoutNode[]>([first, second])),
        }),
      }),
    );
    return { a, b1, b2, first, second };
  };

  it("keeps the last tab of a group in a read only split when it is closed", async () => {
    const { a, first } = locked_split();
    expect(await a.content_close()).toBe(false);
    expect(tabs_of(first)).toEqual([a]);
  });

  it("shows no close button on the last tab of a group in a read only split", () => {
    const { a, b1, b2 } = locked_split();
    expect(has_close(a)).toBe(false);
    expect(has_close(b1)).toBe(true);
    expect(has_close(b2)).toBe(true);
  });

  it("closes a tab of a group in a read only split that has more, then keeps the last", async () => {
    const { b1, b2, second } = locked_split();
    expect(await b1.content_close()).toBe(true);
    expect(tabs_of(second)).toEqual([b2]);
    expect(has_close(b2)).toBe(false);
    await b2.content_close();
    expect(tabs_of(second)).toEqual([b2]);
  });

  it("shows no close buttons in a group with read only contents, and keeps them", async () => {
    const a = closable("A");
    const b = closable("B");
    const group = layout_tabs({ content: state.ros(ok([a, b])) });
    show(layout({ root: group }));
    expect(has_close(a)).toBe(false);
    expect(await a.content_close()).toBe(false);
    expect(tabs_of(group)).toEqual([a, b]);
  });

  it("treats a state that does not write synchronously as read only", async () => {
    const a = closable("A");
    const b = closable("B");
    const group = layout_tabs({ content: state.rosw(ok([a, b])) });
    show(layout({ root: group }));
    expect(has_close(a)).toBe(false);
    expect(await a.content_close()).toBe(false);
  });

  it("closes the last tab of a writable split, the group goes", () => {
    const a = closable("A");
    const b = closable("B");
    const root = state.ok_w<LayoutNode>(split("row", tabs(a), tabs(b)));
    show(layout({ root }));
    expect(has_close(a)).toBe(true);
    a.content_close();
    const after = root.ok() as LayoutTabs;
    expect(after.contents()).toEqual([b]);
  });

  it("closes the panel of content the app took out of a layout", async () => {
    const a = closable("A");
    const b = closable("B");
    const contents = state.ok_w<ContentBase[]>([a, b]);
    show(layout({ root: layout_tabs({ content: contents, active: a }) }));
    //The app takes the content out of the layout by writing the state, and shows it in a panel
    contents.write_sync([b]);
    const shown = panel(a);
    let closed = false;
    void shown.on_close().then(() => (closed = true));
    expect(await a.content_close()).toBe(true);
    expect(closed).toBe(true);
    expect(shown.isConnected).toBe(false);
  });

  it("keeps the panel of a layout open while a content in it can not leave its group", async () => {
    const a = closable("A");
    const b1 = closable("B1");
    const b2 = closable("B2");
    const locked = layout_tabs({ content: state.ros(ok([b1, b2])) });
    const element = layout({ root: split("row", tabs(a), locked) });
    const shown = panel(element);
    expect(await element.content_close()).toBe(false);
    expect(tabs_of(locked)).toEqual([b1, b2]);
    expect(shown.isConnected).toBe(true);
    shown.close();
  });

  it("closes the panel of a layout when every content in it closes", async () => {
    const group = tabs(closable("A"), closable("B"));
    const element = layout({ root: group });
    const shown = panel(element);
    expect(await element.content_close()).toBe(true);
    expect(tabs_of(group)).toEqual([]);
    expect(shown.isConnected).toBe(false);
  });

  it("keeps the last tab of a panel of read only panels when it is closed", async () => {
    const fixed = closable("Fixed");
    const group = tabs(fixed);
    show(
      workspace({
        windows: [
          {
            root: state.ok_w<LayoutNode>(tabs(closable("Main"))),
            panels: state.ros(
              ok([
                workspace_panel(group, { x: 1, y: 1, width: 20, height: 10 }),
              ]),
            ),
          },
        ],
      }),
    );
    expect(has_close(fixed)).toBe(false);
    expect(await fixed.content_close()).toBe(false);
    expect(tabs_of(group)).toEqual([fixed]);
  });
});

describe("Contents that ask before closing", () => {
  it("keeps the tab of a content that refuses to close", async () => {
    const a = guarded(false, { title: "A", closable: true });
    const b = closable("B");
    const group = tabs(a, b);
    show(layout({ root: group }));
    expect(await a.content_close()).toBe(false);
    expect(tabs_of(group)).toEqual([a, b]);
  });

  it("takes the tab out once the content agrees", async () => {
    const answer = later<boolean>();
    const a = guarded(answer.promise, { title: "A", closable: true });
    const b = closable("B");
    const group = tabs(a, b);
    show(layout({ root: group }));
    const closing = a.content_close();
    await Promise.resolve();
    expect(tabs_of(group)).toEqual([a, b]);
    answer.resolve(true);
    expect(await closing).toBe(true);
    expect(tabs_of(group)).toEqual([b]);
  });

  it("does not ask a content whose tab can not leave its group", async () => {
    const a = guarded(true, { title: "A", closable: true });
    const locked = layout_tabs({ content: state.ros(ok<ContentBase[]>([a])) });
    show(layout({ root: split("row", tabs(closable("B")), locked) }));
    expect(await a.content_close()).toBe(false);
    expect(a.asked).toBe(0);
  });

  it("closing a layout closes the contents that agree, its panel stays while one refuses", async () => {
    const keep = guarded(false, { title: "Keep", closable: true });
    const go = guarded(true, { title: "Go", closable: true });
    const group = tabs(keep, go);
    const element = layout({ root: group });
    const shown = panel(element);
    expect(await element.content_close()).toBe(false);
    expect(keep.asked).toBe(1);
    expect(go.asked).toBe(1);
    expect(tabs_of(group)).toEqual([keep]);
    expect(shown.isConnected).toBe(true);
    keep.answer = true;
    expect(await element.content_close()).toBe(true);
    expect(shown.isConnected).toBe(false);
  });
});

describe("Inputs of the nodes", () => {
  it("writes a state given for the contents, the app follows and changes it", () => {
    const a = closable("A");
    const b = closable("B");
    const contents = state.ok_w<ContentBase[]>([a]);
    const element = show(layout({ root: layout_tabs({ content: contents }) }));
    contents.write_sync(state.a.write.push(b));
    expect(element.querySelectorAll("composition-layouttab").length).toBe(2);
    a.content_close();
    expect(contents.ok()).toEqual([b]);
  });

  it("keeps the changes itself for initial values", () => {
    const a = closable("A");
    const group = tabs(a, closable("B"));
    show(layout({ root: group }));
    a.content_close();
    expect(tabs_of(group).map((c) => c.content_title)).toEqual(["B"]);
  });

  it("shows the active content, the user writes it", () => {
    const a = closable("A");
    const b = closable("B");
    const active = state.ok_w<ContentBase | undefined>(a);
    const group = layout_tabs({ content: [a, b], active });
    show(layout({ root: group }));
    expect(group.body.firstChild).toBe(a);
    tab_of(a).dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(active.ok()).toBe(b);
    expect(group.body.firstChild).toBe(b);
    active.write_sync(a);
    expect(group.body.firstChild).toBe(a);
  });

  it("sets the side and compact again with set", () => {
    const group = tabs(closable("A"));
    show(layout({ root: group }));
    group.set({ side: "left", compact: true });
    expect(group.classList.contains("side-left")).toBe(true);
    expect(group.classList.contains("compact")).toBe(true);
  });
});

describe("Opening", () => {
  it("opens in the first group, and shows content already in the layout", () => {
    const a = closable("A");
    const n = closable("N");
    const element = show(
      layout({ root: split("row", tabs(a), tabs(closable("B"))) }),
    );
    expect(element.open(n)).toBe(true);
    expect(titles_with(element, n)).toEqual(["A", "N"]);
    expect(group_of(element.root_node()!, n)?.active()).toBe(n);
    element.open(a);
    expect(group_of(element.root_node()!, a)?.active()).toBe(a);
  });

  it("opens in the group the user worked in last", () => {
    const b = closable("B");
    const element = show(
      layout({ root: split("row", tabs(closable("A")), tabs(b)) }),
    );
    tab_of(b).focus();
    const n = closable("N");
    element.open(n);
    expect(titles_with(element, n)).toEqual(["B", "N"]);
  });

  it("opens beside the group of a content", () => {
    const a = closable("A");
    const n = closable("N");
    const element = show(layout({ root: tabs(a) }));
    element.open(n, { beside: a, side: LayoutSide.BOTTOM });
    expect((element.root_node() as LayoutSplit).direction()).toBe("column");
    expect(titles_with(element, n)).toEqual(["N"]);
  });

  it("does not open in a group with read only contents", () => {
    const element = show(
      layout({
        root: layout_tabs({ content: state.ros(ok([closable("A")])) }),
      }),
    );
    expect(element.open(closable("N"))).toBe(false);
    expect(element.contents().length).toBe(1);
  });
});

describe("Moving tabs", () => {
  const two_groups = () => {
    const [a1, a2, b] = [closable("A1"), closable("A2"), closable("B")];
    const left = tabs(a1, a2);
    const right = tabs(b);
    const element = show(layout({ root: split("row", left, right) }));
    return { element, a1, a2, b, left, right };
  };

  it("moves a tab into another group at an index", () => {
    const { element, a1, right } = two_groups();
    move_content(a1, { layout: element, group: right, index: 0 });
    expect(titles_with(element, a1)).toEqual(["A1", "B"]);
    expect(right.active()).toBe(a1);
  });

  it("moves a tab in its group", () => {
    const { element, a1, left } = two_groups();
    move_content(a1, { layout: element, group: left, index: 2 });
    expect(titles_with(element, a1)).toEqual(["A2", "A1"]);
  });

  it("removes a group its last tab leaves, the split gives its space back", () => {
    const { element, b, left } = two_groups();
    move_content(b, { layout: element, node: left, side: LayoutSide.CENTER });
    expect(element.root_node()).toBe(left);
    expect(titles_with(element, b)).toEqual(["A1", "A2", "B"]);
    expect(element.querySelectorAll("composition-layouttabs").length).toBe(1);
  });

  it("splits a group at a side, and the whole layout at its edge", () => {
    const { element, a1, a2, right } = two_groups();
    move_content(a1, { layout: element, node: right, side: LayoutSide.BOTTOM });
    const root = element.root_node() as LayoutSplit;
    expect(root.direction()).toBe("row");
    expect((root.nodes()[1] as LayoutSplit).direction()).toBe("column");
    move_content(a2, { layout: element, root: true, side: LayoutSide.TOP });
    expect((element.root_node() as LayoutSplit).direction()).toBe("column");
    expect(titles_with(element, a2)).toEqual(["A2"]);
  });

  it("moves a tab to another layout", () => {
    const a = closable("A");
    const from = show(layout({ root: tabs(a, closable("A2")) }));
    const into = tabs(closable("B"));
    const to = show(layout({ root: into }));
    move_content(a, { layout: to, group: into, index: 1 });
    expect(from.contents().map((c) => c.content_title)).toEqual(["A2"]);
    expect(titles_with(to, a)).toEqual(["B", "A"]);
  });

  it("puts back what it changed when a later write is refused, nothing is moved", () => {
    const a = closable("A");
    const b = closable("B");
    const left = tabs(a);
    //The contents of the group it goes into refuse every write, its gate is closed
    const refusing = state.ok_w<ContentBase[]>([b]);
    refusing.set_write_enabled(state.ok(false));
    const right = layout_tabs({ content: refusing });
    const children = state.ok_w<LayoutNode[]>([left, right]);
    const element = show(
      layout({ root: layout_split({ direction: "row", children }) }),
    );
    move_content(a, { layout: element, group: right, index: 1 });
    expect(left.contents()).toEqual([a]);
    expect(children.ok()).toEqual([left, right]);
    expect(right.contents()).toEqual([b]);
    expect(tab_of(a).isConnected).toBe(true);
  });
});

describe("Popping out", () => {
  it("takes the tab out into a new panel of the workspace, which goes when its last tab leaves", async () => {
    const a = closable("A");
    const main = tabs(a, closable("Main"));
    const page = workspace_window(main);
    const panels = page.panels;
    const ws = show(workspace({ windows: [page] }));
    const main_layout = ws.querySelector<Layout>("composition-layout")!;
    popout(main_layout, main, a);
    await Promise.resolve();
    expect(panels.ok().length).toBe(1);
    expect((panels.ok()[0].root.ok() as LayoutTabs).contents()).toEqual([a]);
    expect(titles_with(main_layout, a)).toBeUndefined();
    //Dragged back into the main layout, the panel is removed
    move_content(a, { layout: main_layout, group: main, index: 0 });
    await Promise.resolve();
    await Promise.resolve();
    expect(panels.ok().length).toBe(0);
    expect(titles_with(main_layout, a)).toEqual(["A", "Main"]);
  });

  /**The panel and layout of a content popped out of a layout without an owner*/
  const popped_out = (c: ContentBase) => {
    const shown_in = c.closest<Panel>("composition-panel")!;
    return { shown_in, popped: shown_in.content as Layout };
  };

  it("takes the tab of a layout without an owner out into a layout in a new panel in layer 0, which goes when its last tab leaves", async () => {
    const a = closable("A");
    const main = tabs(a, closable("Main"));
    const element = show(layout({ root: main }));
    popout(element, main, a);
    const { shown_in, popped } = popped_out(a);
    expect(popped).not.toBe(element);
    expect(popped.owner).toBeUndefined();
    expect(popped.contents()).toEqual([a]);
    expect(shown_in.parentElement?.style.zIndex).toBe("0");
    expect(titles_with(element, a)).toBeUndefined();
    //Dragged back into the layout, the panel closes
    move_content(a, { layout: element, group: main, index: 0 });
    await Promise.resolve();
    expect(shown_in.isConnected).toBe(false);
    expect(titles_with(element, a)).toEqual(["A", "Main"]);
  });

  it("closes the panel when the last tab of the popped out layout is closed, other tabs can join it", async () => {
    const a = closable("A");
    const b = closable("B");
    const main = tabs(a, b, closable("Main"));
    const element = show(layout({ root: main }));
    popout(element, main, a);
    const { shown_in, popped } = popped_out(a);
    move_content(b, {
      layout: popped,
      group: popped.root_node() as LayoutTabs,
      index: 1,
    });
    expect(popped.contents()).toEqual([a, b]);
    expect(await a.content_close()).toBe(true);
    await Promise.resolve();
    expect(shown_in.isConnected).toBe(true);
    expect(await b.content_close()).toBe(true);
    await Promise.resolve();
    expect(shown_in.isConnected).toBe(false);
    expect(element.contents().map((c) => c.content_title)).toEqual(["Main"]);
  });

  it("pops out into the layer of the panel the layout is in", () => {
    const a = closable("A");
    const main = tabs(a, closable("Main"));
    const element = layout({ root: main });
    const own = panel(element, { layer: 3 });
    popout(element, main, a);
    const { shown_in } = popped_out(a);
    expect(shown_in).not.toBe(own);
    expect(shown_in.parentElement?.style.zIndex).toBe("3");
    shown_in.close();
    own.close();
  });

  it("pops out with the layer state of the panel the layout is in, both follow it", () => {
    const a = closable("A");
    const main = tabs(a, closable("Main"));
    const element = layout({ root: main });
    const layer = state.ok_w(2);
    const own = panel(element, { layer });
    popout(element, main, a);
    const { shown_in } = popped_out(a);
    expect(shown_in.parentElement?.style.zIndex).toBe("2");
    layer.set_ok(6);
    expect(shown_in.parentElement?.style.zIndex).toBe("6");
    expect(own.parentElement?.style.zIndex).toBe("6");
    shown_in.close();
    own.close();
  });

  it("keeps a panel the app made for a layout without an owner open when it is emptied", async () => {
    const a = closable("A");
    const main = tabs(closable("Main"));
    const element = show(layout({ root: main }));
    const own = layout({ root: tabs(a) });
    const shown_in = panel(own);
    move_content(a, { layout: element, group: main, index: 0 });
    await Promise.resolve();
    expect(own.contents()).toEqual([]);
    expect(shown_in.isConnected).toBe(true);
    shown_in.close();
  });
});

describe("Dragging with the mouse", () => {
  /**Drags the tab of the content with the drag and drop of the browser to the point of the document, like the browser does,
   * it drops only where the dragover was taken, gives whether it was*/
  const drag = (c: ContentBase, x: number, y: number, doc = document) => {
    const tab = TABS.get(c)!;
    tab.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerType: "mouse",
      }),
    );
    expect(tab.draggable).toBe(true);
    const data = new DataTransfer();
    const init = { bubbles: true, cancelable: true, dataTransfer: data };
    tab.dispatchEvent(new DragEvent("dragstart", init));
    const over = doc.elementFromPoint(x, y)!;
    const event = new DragEvent("dragover", {
      ...init,
      clientX: x,
      clientY: y,
    });
    over.dispatchEvent(event);
    const indicated = doc.querySelector(".indicator.shown") !== null;
    if (event.defaultPrevented)
      over.dispatchEvent(
        new DragEvent("drop", { ...init, clientX: x, clientY: y }),
      );
    tab.dispatchEvent(new DragEvent("dragend", init));
    return { taken: event.defaultPrevented, indicated };
  };
  const center = (element: Element) => {
    const r = element.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2] as const;
  };

  it("drags only tabs of a group whose contents can be written", () => {
    const locked = layout_tabs({ content: state.ok([closable("Locked")]) });
    const free = tabs(closable("Free"));
    show(layout({ root: split("row", locked, free) }));
    const press = (c: ContentBase) => {
      TABS.get(c)!.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "mouse",
        }),
      );
      return TABS.get(c)!.draggable;
    };
    expect(press(locked.contents()[0])).toBe(false);
    expect(press(free.contents()[0])).toBe(true);
  });

  it("moves the tab to where it is dropped, showing where while dragging", () => {
    const a = closable("A");
    const c = closable("C");
    const target = tabs(c);
    const element = show(
      layout({ root: split("column", tabs(a, closable("B")), target) }),
    );
    const result = drag(a, ...center(target.body));
    expect(result).toEqual({ taken: true, indicated: true });
    expect(titles_with(element, a)).toEqual(["C", "A"]);
    expect(element.querySelector(".indicator.shown")).toBeNull();
    expect(TABS.get(a)!.classList.contains("dragging")).toBe(false);
  });

  it("takes no drop where the tab can not go, nothing moves", () => {
    const a = closable("A");
    const locked = layout_tabs({ content: state.ok([closable("L")]) });
    const element = show(
      layout({ root: split("column", tabs(a, closable("B")), locked) }),
    );
    expect(drag(a, ...center(locked.body)).taken).toBe(false);
    expect(titles_with(element, a)).toEqual(["A", "B"]);
  });

  it("ends the drag dropped outside the layouts, nothing moves", () => {
    const a = closable("A");
    const element = show(layout({ root: tabs(a, closable("B")) }));
    const below = element.getBoundingClientRect().bottom + 20;
    expect(drag(a, 10, below).taken).toBe(false);
    expect(titles_with(element, a)).toEqual(["A", "B"]);
    expect(TABS.get(a)!.classList.contains("dragging")).toBe(false);
  });

  it("moves the tab to a layout in another document, like a window of the page", () => {
    const frame = document.body.appendChild(document.createElement("iframe"));
    frame.style.cssText = "width:600px;height:400px;border:0";
    const doc = frame.contentDocument!;
    DOCUMENT_HANDLER.register_document(doc, true);
    try {
      doc.body.style.margin = "0";
      const x = closable("X");
      const there = layout({ root: tabs(x) });
      there.style.cssText = "display:block;width:600px;height:400px";
      doc.body.appendChild(there);
      const a = closable("A");
      const here = show(layout({ root: tabs(a, closable("B")) }));
      const group = group_of(there.root_node()!, x)!;
      expect(drag(a, ...center(group.body), doc).taken).toBe(true);
      expect(there.contents()).toEqual([x, a]);
      expect(a.ownerDocument).toBe(doc);
      expect(here.contents().map((t) => t.content_title)).toEqual(["B"]);
    } finally {
      DOCUMENT_HANDLER.deregister_document(doc);
      frame.remove();
    }
  });
});
