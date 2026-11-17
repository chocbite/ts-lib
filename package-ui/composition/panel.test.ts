import { NiceError } from "@chocbite/ts-lib/result";
import { material_save_rounded } from "#icons";
import { SCALE, theme_init } from "#theme";
import state from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import { panel_container } from "./container";
import { content, type ContentCreateOptions } from "./content";
import type { Panel, PanelOptions } from "./panel";
import { CompAnchor } from "./shared";

/**A test error whose nice text is its message, so shown texts read as before*/
const nice_err = (text: string) => new NiceError(Symbol(text), text);

const panels: Panel[] = [];
const panel_with = (
  content_options: ContentCreateOptions = {},
  options: PanelOptions = {},
) => {
  const panel = panel_container().panel(content(content_options), options);
  panels.push(panel);
  return panel;
};
const title_of = (panel: Panel) => panel.querySelector(".title")!;
const titlebar_of = (panel: Panel) => panel.children[1] as HTMLElement;
const sizer_of = (panel: Panel) => panel.children[0];
const left_of = (panel: Panel) => parseFloat(panel.style.left);
const top_of = (panel: Panel) => parseFloat(panel.style.top);
const press = (panel: Panel, key: string) =>
  titlebar_of(panel).dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true }),
  );

//The scale test needs the scale applied to the page
theme_init();

afterEach(() => {
  for (const panel of panels.splice(0)) if (panel.isConnected) panel.close();
});

describe("Panel container", () => {
  it("is one per document, made when first asked for", () => {
    const container = panel_container();
    expect(container.isConnected).toBe(true);
    expect(panel_container(document.body)).toBe(container);
    expect(panel_container(document)).toBe(container);
  });

  it("knows the panel the user worked in last", () => {
    const a = panel_with();
    const b = panel_with();
    expect(panel_container().active_panel).toBe(b);
    a.focus();
    expect(panel_container().active_panel).toBe(a);
  });
});

describe("Panel content", () => {
  it("releases the states of the content when closed", () => {
    const title = state.ok_w("a");
    const panel = panel_with({ title });
    expect(title.amount()).toBe(1);
    panel.close();
    expect(title.amount()).toBe(0);
  });

  it("shows the title of the content, fixed, as a state and its error", () => {
    expect(title_of(panel_with({ title: "Fixed" })).textContent).toBe("Fixed");
    const title = state.from_w("a");
    const panel = panel_with({ title });
    expect(title_of(panel).textContent).toBe("a");
    title.set_ok("b");
    expect(title_of(panel).textContent).toBe("b");
    title.set_err(nice_err("gone"));
    expect(title_of(panel).textContent).toBe("⚠ gone");
  });

  it("shows the icon and a close button when the content says so", () => {
    const closable = state.ok_w(false);
    const panel = panel_with({ icon: material_save_rounded, closable });
    expect(panel.querySelector(".icon svg")).not.toBeNull();
    expect(panel.querySelector(".close-button")).toBeNull();
    closable.set_ok(true);
    expect(panel.querySelector(".close-button")).not.toBeNull();
  });

  it("does not get smaller than the minimum width of the content", () => {
    const panel = panel_with({ min_width: 12 }, { width: 5 });
    expect(panel.getBoundingClientRect().width).toBeCloseTo(12 * 16, 0);
  });
});

describe("Panel closing", () => {
  it("closing the panel resolves content_on_close and on_close", async () => {
    const panel = panel_with();
    const content_closed = panel.content.content_on_close();
    const closed = panel.on_close();
    panel.close();
    await content_closed;
    await closed;
    expect(panel.isConnected).toBe(false);
  });

  it("content_close closes the panel", () => {
    const panel = panel_with();
    panel.content.content_close();
    expect(panel.isConnected).toBe(false);
  });
});

describe("Panel layers", () => {
  it("moves to another layer and leaves the old one", () => {
    const layer = state.ok_w(0);
    const panel = panel_with({}, { layer });
    const old_box = panel.parentElement!;
    expect(old_box.style.zIndex).toBe("0");
    layer.set_ok(2);
    expect(panel.parentElement!.style.zIndex).toBe("2");
    expect(old_box.contains(panel)).toBe(false);
  });

  it("keeps the layers in order in the container", () => {
    panel_with({}, { layer: 3 });
    panel_with({}, { layer: 1 });
    const order = [...panel_container().children].map((box) =>
      Number((box as HTMLElement).style.zIndex),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("comes above the other panels of its layer when focused", () => {
    const a = panel_with();
    const b = panel_with();
    expect(Number(b.style.zIndex)).toBeGreaterThan(Number(a.style.zIndex));
    a.focus();
    expect(Number(a.style.zIndex)).toBeGreaterThan(Number(b.style.zIndex));
  });
});

describe("Panel position", () => {
  it("places the anchor of the panel at x and y, zero included", () => {
    const panel = panel_with({}, { x: 0, y: 0, width: 10, height: 6 });
    expect(left_of(panel)).toBe(0);
    expect(top_of(panel)).toBe(0);
    const right = panel_with(
      {},
      { x: 30, y: 20, width: 10, height: 6, anchor: CompAnchor.BOT_RIGHT },
    );
    expect(left_of(right)).toBeCloseTo(20);
    expect(top_of(right)).toBeCloseTo(14);
  });

  it("is centered when no position is given", () => {
    const panel = panel_with({}, { width: 10, height: 6 });
    const container = panel_container();
    expect(left_of(panel)).toBeCloseTo((container.width - 10) / 2);
    expect(top_of(panel)).toBeCloseTo((container.height - 6) / 2);
  });

  it("follows a state, and shows a position outside the container clamped without changing it", () => {
    const x = state.ok_w(5);
    const panel = panel_with({}, { x, y: 5, width: 10, height: 6 });
    expect(left_of(panel)).toBe(5);
    x.set_ok(100000);
    expect(left_of(panel)).toBeLessThan(panel_container().width);
    expect(x.ok()).toBe(100000);
  });

  it("moves when the position is a writable state, and writes it", () => {
    const x = state.ok_w(5);
    const y = state.ok_w(5);
    const panel = panel_with({}, { x, y, width: 10, height: 6 });
    press(panel, "ArrowRight");
    press(panel, "ArrowDown");
    expect(x.ok()).toBe(6);
    expect(y.ok()).toBe(6);
    expect(left_of(panel)).toBe(6);
  });

  it("does not move along an axis with a fixed position", () => {
    const y = state.ok_w(5);
    const panel = panel_with({}, { x: 5, y, width: 10, height: 6 });
    press(panel, "ArrowRight");
    press(panel, "ArrowDown");
    expect(left_of(panel)).toBe(5);
    expect(y.ok()).toBe(6);
  });

  it("moves by itself when no position is given", () => {
    const panel = panel_with({}, { width: 10, height: 6 });
    const left = left_of(panel);
    press(panel, "ArrowLeft");
    expect(left_of(panel)).toBeCloseTo(left - 1);
  });

  it("is laid out again when the scale changes", async () => {
    const scale = SCALE.ok();
    const panel = panel_with({}, { x: 10000, y: 5, width: 10, height: 6 });
    const left = left_of(panel);
    await SCALE.write(scale * 2);
    try {
      //The container is half as many rem wide, the clamp follows
      expect(left_of(panel)).toBeCloseTo(left - panel_container().width, 0);
    } finally {
      await SCALE.write(scale);
    }
  });
});

describe("Panel sizing", () => {
  it("has sizers where the size can be changed", () => {
    expect(sizer_of(panel_with()).className).toBe("x y");
    const width = state.ok_w(10);
    expect(sizer_of(panel_with({}, { width, height: 6 })).className).toBe("x");
  });

  it("has no sizers when not sizeable", () => {
    expect(sizer_of(panel_with({}, { sizeable: false })).className).toBe("");
  });
});

describe("Panel hiding", () => {
  const press_outside = () =>
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );

  it("auto_hide writes hidden when the user presses outside", () => {
    const hidden = state.ok_w(false);
    const panel = panel_with({}, { hidden, auto_hide: true });
    panel.content.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    expect(hidden.ok()).toBe(false);
    press_outside();
    expect(hidden.ok()).toBe(true);
    expect(panel.classList.contains("hidden")).toBe(true);
    hidden.set_ok(false);
    expect(panel.classList.contains("hidden")).toBe(false);
  });

  it("auto_hide can not hide a panel with a fixed hidden", () => {
    const panel = panel_with({}, { hidden: false, auto_hide: true });
    press_outside();
    expect(panel.classList.contains("hidden")).toBe(false);
  });

  it("auto_close closes when the user presses outside", () => {
    const panel = panel_with({}, { auto_close: true });
    press_outside();
    expect(panel.isConnected).toBe(false);
  });
});

describe("Panel title bar and modal", () => {
  it("hides the title bar", () => {
    const titlebar = state.ok_w(true);
    const panel = panel_with({}, { titlebar });
    expect(panel.classList.contains("no-titlebar")).toBe(false);
    titlebar.set_ok(false);
    expect(panel.classList.contains("no-titlebar")).toBe(true);
  });

  it("modal adds a focus catcher, which gives the focus to the content", () => {
    const modal = state.ok_w(true);
    const panel = panel_with({}, { modal });
    expect(panel.classList.contains("modal")).toBe(true);
    (panel.children[3] as HTMLElement).focus();
    expect(document.activeElement).toBe(panel.content);
    modal.set_ok(false);
    expect(panel.children.length).toBe(3);
  });
});
