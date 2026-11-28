import { DOCUMENT_HANDLER } from "#document";
import { px_to_rem } from "#theme";
import { material_description_rounded } from "#icons";
import state from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { panel_container } from "../container";
import { content, type ContentBase } from "../content";
import type { Panel, PanelOptions } from "../panel";
import { page_on_screen } from "../window";

const panels: Panel[] = [];
const show = (c: ContentBase, options: PanelOptions = {}) => {
  const made = panel_container().panel(c, options);
  panels.push(made);
  return made;
};
/**Window properties of the browser the tests give values, put back after each test*/
const replaced: [object, string][] = [];
const replace = (target: object, values: Record<string, unknown>) => {
  for (const [name, value] of Object.entries(values)) {
    replaced.push([target, name]);
    Object.defineProperty(target, name, { value, configurable: true });
  }
};
afterEach(() => {
  for (const made of panels.splice(0)) made.close();
  for (const [target, name] of replaced.splice(0))
    delete (target as Record<string, unknown>)[name];
  vi.restoreAllMocks();
  document.dispatchEvent(
    new KeyboardEvent("keydown", { code: "Escape", bubbles: true }),
  );
});

const popup_of = (c: ContentBase) => c.ownerDocument.defaultView!;
const in_window = (c: ContentBase) => c.ownerDocument !== document;
/**Waits for the content to come back from its window, the browser closes a window after the current task*/
const back = (c: ContentBase) =>
  vi.waitFor(() => expect(in_window(c)).toBe(false));
const open_menu = (target: Element) => {
  target.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10,
    }),
  );
  return document.documentElement.querySelector("contextmenu-container")!;
};
const titlebar_of = (made: Panel) => made.children[1] as HTMLElement;

describe("Opening a window", () => {
  it("shows the content in a browser window titled after the content, instead of the panel", () => {
    const c = content({ title: "Report", icon: material_description_rounded });
    const windowed = state.ok_w(false);
    const made = show(c, { window: windowed });
    windowed.write_sync(true);
    expect(in_window(c)).toBe(true);
    expect(c.ownerDocument.title).toBe("Report");
    expect(document.title).not.toBe("Report");
    expect(
      c.ownerDocument.querySelector<HTMLLinkElement>("link[rel=icon]")?.href,
    ).toMatch(/^data:image\/svg\+xml,/);
    expect(DOCUMENT_HANDLER.documents).toContain(c.ownerDocument);
    expect(getComputedStyle(made).display).toBe("none");
  });

  it("opens the window from the menu of the title bar, writing the state", () => {
    const c = content({ title: "Menu" });
    const windowed = state.ok_w(false);
    const made = show(c, { window: windowed });
    const line = [
      ...open_menu(titlebar_of(made)).querySelectorAll("contextmenu-option"),
    ].find((o) => o.textContent?.includes("Open in window")) as HTMLElement;
    line.click();
    expect(windowed.ok()).toBe(true);
    expect(in_window(c)).toBe(true);
  });

  it("has no line in the menu for a read only state", () => {
    const made = show(content({ title: "Locked" }), {
      window: state.ok(false),
    });
    expect(open_menu(titlebar_of(made)).textContent).not.toContain(
      "Open in window",
    );
  });

  it("opens a window for an initial value once the panel is shown, the page of the window has the size of the content box", () => {
    const open = vi.spyOn(window, "open");
    const c = content({ title: "Initial" });
    show(c, { window: true, width: 30, height: 20 });
    expect(in_window(c)).toBe(true);
    const features = String(open.mock.calls[0][2]);
    expect(features).toContain("popup");
    expect(features).toMatch(/width=\d+/);
  });

  it("places the frame of the window where the panel is on the screen", () => {
    replace(window, {
      screenX: 100,
      screenY: 50,
      outerWidth: window.innerWidth,
      outerHeight: window.innerHeight + 80,
    });
    const open = vi.spyOn(window, "open");
    const c = content({ title: "Placed" });
    const made = show(c, { x: 10, y: 5, width: 30, height: 20 });
    const rect = made.getBoundingClientRect();
    made.set({ window: true });
    const features = String(open.mock.calls[0][2]);
    expect(features).toContain(`left=${Math.round(100 + rect.left)}`);
    expect(features).toContain(`top=${Math.round(130 + rect.top)}`);
  });

  it("stays a panel and writes false when the browser blocks the window during a click, it does not let the page open windows", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    replace(navigator.userActivation, { isActive: true });
    const c = content({ title: "Blocked" });
    const windowed = state.ok_w(false);
    const made = show(c, { window: windowed });
    windowed.write_sync(true);
    expect(windowed.ok()).toBe(false);
    expect(in_window(c)).toBe(false);
    expect(getComputedStyle(made).display).not.toBe("none");
  });
});

describe("Waiting for a click", () => {
  const click = () =>
    document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  const key = () =>
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));

  it("waits hidden when the browser blocks the window without a click or key press, and opens it on the next one", () => {
    const open = vi.spyOn(window, "open").mockReturnValueOnce(null);
    const c = content({ title: "Waits" });
    const windowed = state.ok_w(true);
    const made = show(c, { window: windowed });
    expect(in_window(c)).toBe(false);
    expect(windowed.ok()).toBe(true);
    expect(getComputedStyle(made).display).toBe("none");
    click();
    expect(in_window(c)).toBe(true);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("opens one waiting window on each click or key press, in the order they waited", () => {
    vi.spyOn(window, "open")
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null);
    const first = content({ title: "First" });
    const second = content({ title: "Second" });
    show(first, { window: true });
    show(second, { window: true });
    key();
    expect(in_window(first)).toBe(true);
    expect(in_window(second)).toBe(false);
    click();
    expect(in_window(second)).toBe(true);
  });

  it("stops waiting when false is written or the panel closes", () => {
    const open = vi
      .spyOn(window, "open")
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null);
    const windowed = state.ok_w(true);
    const c = content({ title: "Stopped" });
    const made = show(c, { window: windowed });
    const closed = show(content({ title: "Closed" }), { window: true });
    windowed.write_sync(false);
    expect(getComputedStyle(made).display).not.toBe("none");
    closed.close();
    click();
    expect(open).toHaveBeenCalledTimes(2);
    expect(in_window(c)).toBe(false);
  });
});

describe("Closing a window", () => {
  it("puts the content back in the panel when the user closes the window, with the size of the window", async () => {
    const c = content({ title: "Back" });
    const windowed = state.ok_w(true);
    const width = state.ok_w(30);
    const height = state.ok_w(20);
    const made = show(c, { window: windowed, width, height });
    const doc = c.ownerDocument;
    const popup = popup_of(c);
    const page = { width: popup.innerWidth, height: popup.innerHeight };
    popup.close();
    await back(c);
    expect(windowed.ok()).toBe(false);
    expect(DOCUMENT_HANDLER.documents).not.toContain(doc);
    expect(getComputedStyle(made).display).not.toBe("none");
    expect(width.ok()).toBeCloseTo(px_to_rem(page.width));
    const titlebar = px_to_rem(
      titlebar_of(made).getBoundingClientRect().height,
    );
    expect(height.ok()).toBeCloseTo(px_to_rem(page.height) + titlebar);
  });

  it("puts the panel where the window was, when the browser tells", async () => {
    replace(window, {
      screenX: 100,
      screenY: 50,
      outerWidth: window.innerWidth,
      outerHeight: window.innerHeight + 80,
    });
    const c = content({ title: "Moved" });
    const x = state.ok_w(1);
    const y = state.ok_w(1);
    show(c, { window: true, x, y, width: 20, height: 10 });
    const popup = popup_of(c);
    //The page of the main window starts at 100, 130 on the screen
    replace(popup, { screenX: 100 + 32, screenY: 130 + 48 });
    popup.close();
    await back(c);
    expect(x.ok()).toBeCloseTo(px_to_rem(32));
    expect(y.ok()).toBeCloseTo(px_to_rem(48));
  });

  it("keeps the position of the panel where the browser does not tell where windows are", async () => {
    replace(window, { screenX: 0, screenY: 0 });
    const c = content({ title: "Unknown" });
    const x = state.ok_w(3);
    show(c, { window: true, x, y: 2, width: 20, height: 10 });
    const popup = popup_of(c);
    replace(popup, { screenX: 0, screenY: 0 });
    popup.close();
    await back(c);
    expect(x.ok()).toBe(3);
  });

  it("closes the window and puts the content back when false is written", () => {
    const c = content({ title: "Written" });
    const windowed = state.ok_w(true);
    const made = show(c, { window: windowed });
    const popup = popup_of(c);
    windowed.write_sync(false);
    expect(in_window(c)).toBe(false);
    expect(c.parentElement?.parentElement).toBe(made);
    expect(popup.closed).toBe(true);
  });

  it("closes the window with the panel", () => {
    const c = content({ title: "Closed" });
    const made = show(c, { window: true });
    const popup = popup_of(c);
    made.close();
    expect(popup.closed).toBe(true);
  });

  it("closes the panel when the content in the window closes", async () => {
    const c = content({ title: "Self", closable: true });
    const made = show(c, { window: true });
    const popup = popup_of(c);
    expect(await c.content_close()).toBe(true);
    expect(made.isConnected).toBe(false);
    expect(popup.closed).toBe(true);
  });

  it("closes the windows when the page goes away, without writing the state, so they are saved as windows", () => {
    const c = content({ title: "Leaving" });
    const windowed = state.ok_w(true);
    show(c, { window: windowed });
    const popup = popup_of(c);
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
    expect(popup.closed).toBe(true);
    expect(windowed.ok()).toBe(true);
  });

  it("writes where the window is when the page goes away, so it opens there again", () => {
    const c = content({ title: "Remembered" });
    const width = state.ok_w(20);
    show(c, { window: true, width, height: 10 });
    const popup = popup_of(c);
    const page = popup.innerWidth;
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
    expect(width.ok()).toBeCloseTo(px_to_rem(page));
  });
});

describe("Screen positions", () => {
  it("takes the frame of a window as a border at the sides and the bottom, and the rest at the top", () => {
    const view = {
      screenX: 100,
      screenY: 50,
      outerWidth: 1010,
      innerWidth: 1000,
      outerHeight: 800,
      innerHeight: 700,
    } as Window;
    expect(page_on_screen(view)).toEqual({ left: 105, top: 145 });
  });
});

describe("Panels in a window", () => {
  /**A panel shown in a window, and a panel opened from its content in that window*/
  const with_inner = () => {
    const c = content({ title: "Host" });
    const windowed = state.ok_w(true);
    const made = show(c, { window: windowed, width: 30, height: 20 });
    const x = state.ok_w(2);
    const y = state.ok_w(3);
    const inner = panel_container(c).panel(content({ title: "Inner" }), {
      x,
      y,
      width: 10,
      height: 6,
    });
    panels.push(inner);
    const closed = { inner: false, content: false };
    void inner.on_close().then(() => (closed.inner = true));
    void inner.content.content_on_close().then(() => (closed.content = true));
    expect(inner.ownerDocument).toBe(c.ownerDocument);
    return { c, made, windowed, inner, x, y, closed };
  };
  /**Where the content box of the panel is in the page, in rem*/
  const box_of = (made: Panel) => {
    const box = made.children[2].getBoundingClientRect();
    return { left: px_to_rem(box.left), top: px_to_rem(box.top) };
  };

  it("moves them into the page when the user closes the window, over the content where they were, none closes", async () => {
    const { c, made, inner, x, y, closed } = with_inner();
    popup_of(c).close();
    await back(c);
    expect(inner.ownerDocument).toBe(document);
    expect(inner.isConnected).toBe(true);
    const box = box_of(made);
    expect(x.ok()).toBeCloseTo(2 + box.left);
    expect(y.ok()).toBeCloseTo(3 + box.top);
    await new Promise((resolve) => setTimeout(resolve));
    expect(closed).toEqual({ inner: false, content: false });
  });

  it("keeps the content and the panels in a refreshed window, nothing comes to the page", async () => {
    const { c, made, windowed, inner, closed } = with_inner();
    const popup = popup_of(c);
    const old = c.ownerDocument;
    popup.location.reload();
    await vi.waitFor(() => expect(c.ownerDocument).not.toBe(old));
    expect(c.ownerDocument).toBe(popup.document);
    expect(inner.ownerDocument).toBe(popup.document);
    expect(popup.document.title).toBe("Host");
    expect(windowed.ok()).toBe(true);
    expect(getComputedStyle(made).display).toBe("none");
    expect(closed).toEqual({ inner: false, content: false });
  });

  it("moves them into the page when false is written, and when the panel closes", () => {
    const first = with_inner();
    first.windowed.write_sync(false);
    expect(first.inner.ownerDocument).toBe(document);
    const second = with_inner();
    second.made.close();
    expect(second.inner.ownerDocument).toBe(document);
    expect(second.inner.isConnected).toBe(true);
  });

  it("moves the panels of any document that goes away into the main document", () => {
    const frame = document.body.appendChild(document.createElement("iframe"));
    const doc = frame.contentDocument!;
    DOCUMENT_HANDLER.register_document(doc, true);
    const inner = panel_container(doc.body).panel(content({ title: "Frame" }));
    panels.push(inner);
    DOCUMENT_HANDLER.deregister_document(doc);
    frame.remove();
    expect(inner.ownerDocument).toBe(document);
    expect(inner.isConnected).toBe(true);
  });
});
