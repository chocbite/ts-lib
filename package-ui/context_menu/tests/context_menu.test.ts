import { DOCUMENT_HANDLER } from "#document";
import { none, some } from "@chocbite/ts-lib/result";
import { afterEach, describe, expect, it, vi } from "vitest";
import ctm, { type ContextMenu } from "..";
import { AccessTypes } from "#base";
import { NiceError } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { material_close_rounded } from "#icons";
import type { SVGFunc } from "#svg";

/**Removes the vibrate function like browsers without the Vibration API, Safari for example*/
const without_vibrate = (run: () => void) => {
  Object.defineProperty(navigator, "vibrate", {
    value: undefined,
    configurable: true,
  });
  try {
    run();
  } finally {
    delete (navigator as { vibrate?: unknown }).vibrate;
  }
};

describe("Context menu without the Vibration API", () => {
  afterEach(() => close_all());
  it("an option runs and closes the menu", () => {
    without_vibrate(() => {
      const func = vi.fn();
      const line = ctm.line({ text: "Do", on_click: func });
      const menu = ctm.menu([line]);
      ctm.summon(menu);
      const close = vi.spyOn(menu, "close_up");
      (line as unknown as HTMLElement).click();
      expect(func).toHaveBeenCalledOnce();
      expect(close).toHaveBeenCalled();
    });
  });

  it("a submenu opens", () => {
    without_vibrate(() => {
      const sub_menu: ContextMenu = ctm.menu([
        ctm.line({ text: "Inner", on_click: () => {} }),
      ]);
      const sub = ctm.sub({ text: "More", menu: sub_menu });
      ctm.summon(ctm.menu([sub]));
      (sub as unknown as HTMLElement).click();
      expect(sub_menu.isConnected).toBe(true);
    });
  });
});

describe("Default context menu", () => {
  afterEach(() => {
    ctm.default(undefined);
    close_all();
  });

  const contextmenu = (target: Element) => {
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  };

  it("false removes the default menu and blocks the OS menu", () => {
    const lines = vi.fn(() => none());
    ctm.default(lines);
    ctm.default(false);
    expect(contextmenu(document.body).defaultPrevented).toBe(true);
    expect(lines).not.toHaveBeenCalled();
  });

  it("false also applies to documents added later", () => {
    const lines = vi.fn(() => none());
    ctm.default(lines);
    ctm.default(false);
    const frame = document.body.appendChild(document.createElement("iframe"));
    const frame_document = frame.contentDocument!;
    DOCUMENT_HANDLER.register_document(frame_document);
    try {
      expect(contextmenu(frame_document.body).defaultPrevented).toBe(true);
      expect(lines).not.toHaveBeenCalled();
    } finally {
      DOCUMENT_HANDLER.deregister_document(frame_document);
    }
  });

  it("undefined gives the OS menu back", () => {
    ctm.default(false);
    ctm.default(undefined);
    expect(contextmenu(document.body).defaultPrevented).toBe(false);
  });

  it("a default menu opens on a right click anywhere", () => {
    const menu = ctm.menu([ctm.line({ text: "Default", on_click: () => {} })]);
    ctm.default(menu);
    try {
      expect(contextmenu(document.body).defaultPrevented).toBe(true);
      expect(menu.isConnected).toBe(true);
    } finally {
      menu.close_up();
    }
  });

  it("an element menu takes precedence over the default menu", () => {
    const default_menu = ctm.menu([
      ctm.line({ text: "Default", on_click: () => {} }),
    ]);
    const element_menu = ctm.menu([
      ctm.line({ text: "Element", on_click: () => {} }),
    ]);
    ctm.default(default_menu);
    const element = document.body.appendChild(document.createElement("div"));
    ctm.attach(element, element_menu);
    try {
      contextmenu(element);
      expect(element_menu.isConnected).toBe(true);
      expect(default_menu.isConnected).toBe(false);
    } finally {
      element_menu.close_up();
    }
  });
});

//      _    _ ______ _      _____  ______ _____   _____
//     | |  | |  ____| |    |  __ \|  ____|  __ \ / ____|
//     | |__| | |__  | |    | |__) | |__  | |__) | (___
//     |  __  |  __| | |    |  ___/|  __| |  _  / \___ \
//     | |  | | |____| |____| |    | |____| | \ \ ____) |
//     |_|  |_|______|______|_|    |______|_|  \_\_____/
const container = () =>
  document.documentElement.querySelector("contextmenu-container")!;

/**Lines are elements, kept for readability of the older tests*/
const as_element = <T extends HTMLElement>(line: T) => line;

const key = (code: string, init: KeyboardEventInit = {}) => {
  const target = document.activeElement ?? document.body;
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      code,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
};

/**Collects errors thrown in event handlers and timers, which the browser reports instead of throwing*/
const collect_errors = () => {
  const errors: unknown[] = [];
  const listener = (e: ErrorEvent) => {
    errors.push(e.error);
    e.preventDefault();
  };
  window.addEventListener("error", listener);
  return {
    errors,
    stop: () => window.removeEventListener("error", listener),
  };
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**Menu of three options, A B and C, with spies*/
const three = () => {
  const funcs = [vi.fn(), vi.fn(), vi.fn()];
  const lines = ["A", "B", "C"].map((text, i) =>
    ctm.line({ text, on_click: funcs[i] }),
  );
  return { funcs, lines: lines.map(as_element), menu: ctm.menu(lines) };
};

const close_all = () => {
  //Blurring lets an open menu close itself, removing a focused menu reports errors, see the test below
  (document.activeElement as HTMLElement | null)?.blur();
  container().replaceChildren();
  document.body.replaceChildren();
};

describe("Context menu summoning and positioning", () => {
  afterEach(close_all);

  it("opens in the container at the given position and takes focus", () => {
    const { menu } = three();
    ctm.summon(menu, { x: 10, y: 20 });
    expect(menu.parentElement).toBe(container());
    expect(menu.style.left).toBe("10px");
    expect(menu.style.top).toBe("20px");
    expect(document.activeElement).toBe(menu);
  });

  it("opens in the top left corner without element or position", () => {
    const { menu } = three();
    ctm.summon(menu);
    const box = menu.getBoundingClientRect();
    expect(box.left).toBe(0);
    expect(box.top).toBe(0);
  });

  it("opens at the center of the element without position", () => {
    const element = document.body.appendChild(document.createElement("div"));
    element.style.cssText =
      "position:fixed;left:40px;top:30px;width:20px;height:10px;";
    const { menu } = three();
    ctm.summon(menu, { element });
    expect(menu.style.left).toBe("50px");
    expect(menu.style.top).toBe("35px");
  });

  it("opens left of and above the position near the bottom right corner", () => {
    const { menu } = three();
    const x = window.innerWidth - 5;
    const y = window.innerHeight - 5;
    ctm.summon(menu, { x, y });
    const box = menu.getBoundingClientRect();
    expect(box.right).toBeCloseTo(x, 0);
    expect(box.bottom).toBeCloseTo(y, 0);
  });

  it("stays inside the window when it fits neither side of the position", () => {
    const lines = Array.from({ length: 6 }, (_, i) =>
      ctm.line({ text: "Line " + i, on_click: () => {} }),
    );
    const menu = ctm.menu(lines);
    ctm.summon(menu, { x: 0, y: 0 });
    const height = menu.getBoundingClientRect().height;
    menu.close_up();
    //Too low to fit below and too high to fit above
    const y = Math.min(height - 1, window.innerHeight - height / 2);
    ctm.summon(menu, { x: 10, y });
    const box = menu.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(window.innerHeight + 0.5);
  });

  it("dont_cover places the menu beside the element", () => {
    const element = document.body.appendChild(document.createElement("div"));
    element.style.cssText =
      "position:fixed;left:50px;top:40px;width:40px;height:20px;";
    const { menu } = three();
    ctm.summon(menu, { element, dont_cover: true });
    const box = menu.getBoundingClientRect();
    expect(box.left).toBeCloseTo(90, 0);
  });

  it("dont_cover keeps the menu inside the window for a tall element", () => {
    const { menu } = three();
    ctm.summon(menu, { x: 0, y: 0 });
    const height = menu.getBoundingClientRect().height;
    menu.close_up();
    const element = document.body.appendChild(document.createElement("div"));
    //Starts above the menu height, ends near the bottom of the window
    element.style.cssText = `position:fixed;left:50px;top:${height / 2}px;width:40px;height:${window.innerHeight - height}px;`;
    ctm.summon(menu, { element, dont_cover: true });
    const box = menu.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(window.innerHeight + 0.5);
  });

  it("a new menu replaces the open one", () => {
    const first = three().menu;
    const second = three().menu;
    ctm.summon(first);
    ctm.summon(second);
    expect(first.isConnected).toBe(false);
    expect([...container().children]).toEqual([second]);
  });

  it("summoning the open menu again keeps it open without errors", () => {
    const { menu, lines } = three();
    ctm.summon(menu);
    const collected = collect_errors();
    try {
      ctm.summon(menu);
    } finally {
      collected.stop();
    }
    expect(collected.errors).toEqual([]);
    expect(menu.isConnected).toBe(true);
    expect([...menu.children]).toEqual(lines);
  });

  it("a menu replacing an open menu does not focus the original element in between", () => {
    const button = document.body.appendChild(document.createElement("button"));
    button.focus();
    ctm.summon(three().menu);
    const focused = vi.fn();
    button.addEventListener("focus", focused);
    ctm.summon(three().menu);
    expect(focused).not.toHaveBeenCalled();
  });

  it("the same menu can be opened again after closing", () => {
    const { menu, lines } = three();
    ctm.summon(menu);
    menu.close_up();
    ctm.summon(menu);
    expect(menu.isConnected).toBe(true);
    expect([...menu.children]).toEqual(lines);
  });

  it("skips undefined lines", () => {
    const a = ctm.line({ text: "A", on_click: () => {} });
    const menu = ctm.menu([undefined, a, undefined]);
    ctm.summon(menu);
    expect([...menu.children]).toEqual([a]);
  });

  it("calls a line function on every open", () => {
    const lines = vi.fn(() => [ctm.line({ text: "A", on_click: () => {} })]);
    const menu = ctm.menu(lines);
    ctm.summon(menu);
    menu.close_up();
    ctm.summon(menu);
    expect(lines).toHaveBeenCalledTimes(2);
  });

  it("shows a spinner until promised lines arrive", async () => {
    let resolve: (lines: ReturnType<typeof ctm.line>[]) => void = () => {};
    const menu = ctm.menu(new Promise((r) => (resolve = r)));
    ctm.summon(menu, { x: 10, y: 10 });
    expect(menu.querySelector("contextmenu-buffer")).not.toBeNull();
    const a = ctm.line({ text: "A", on_click: () => {} });
    resolve([a]);
    await wait(0);
    expect(menu.querySelector("contextmenu-buffer")).toBeNull();
    expect([...menu.children]).toEqual([a]);
    expect(menu.style.left).toBe("10px");
  });

  it("a promise menu closed before its lines arrive stays closed", async () => {
    const button = document.body.appendChild(document.createElement("button"));
    button.focus();
    let resolve: (lines: ReturnType<typeof ctm.line>[]) => void = () => {};
    const menu = ctm.menu(new Promise((r) => (resolve = r)));
    ctm.summon(menu, { x: 10, y: 10 });
    menu.style.left = "";
    menu.close_up();
    expect(document.activeElement).toBe(button);
    const a = ctm.line({ text: "A", on_click: () => {} });
    resolve([a]);
    await wait(0);
    expect(menu.isConnected).toBe(false);
    expect(as_element(a).isConnected).toBe(false);
    expect(menu.style.left).toBe("");
    expect(document.activeElement).toBe(button);
  });

  it("a promise menu replaced before its lines arrive leaves the new menu alone", async () => {
    let resolve: (lines: ReturnType<typeof ctm.line>[]) => void = () => {};
    const first = ctm.menu(new Promise((r) => (resolve = r)));
    ctm.summon(first, { x: 10, y: 10 });
    const second = three().menu;
    ctm.summon(second);
    resolve([ctm.line({ text: "A", on_click: () => {} })]);
    await wait(0);
    expect(first.isConnected).toBe(false);
    expect([...container().children]).toEqual([second]);
    expect(document.activeElement).toBe(second);
  });

  it("lines of an earlier open do not replace the lines of a later open", async () => {
    const resolvers: ((lines: ReturnType<typeof ctm.line>[]) => void)[] = [];
    const menu = ctm.menu(() => new Promise((r) => resolvers.push(r)));
    ctm.summon(menu, { x: 10, y: 10 });
    menu.close_up();
    ctm.summon(menu, { x: 10, y: 10 });
    //One spinner, not one for every open
    expect(menu.querySelectorAll("contextmenu-buffer").length).toBe(1);
    const old_line = ctm.line({ text: "Old", on_click: () => {} });
    const new_line = ctm.line({ text: "New", on_click: () => {} });
    resolvers[0]([old_line]);
    await wait(0);
    expect(menu.querySelector("contextmenu-buffer")).not.toBeNull();
    resolvers[1]([new_line]);
    await wait(0);
    expect([...menu.children]).toEqual([new_line]);
  });

  it("a menu covering most of the window gets a close line at the top which closes it", () => {
    //Long lines make the menu as wide as allowed, many lines as high as allowed
    const lines = Array.from({ length: 80 }, (_, i) =>
      ctm.line({
        text: "Line " + i + " ".padEnd(300, "x"),
        on_click: () => {},
      }),
    );
    const menu = ctm.menu(lines);
    ctm.summon(menu);
    const box = menu.getBoundingClientRect();
    expect(box.width * box.height).toBeGreaterThan(
      window.innerWidth * window.innerHeight * 0.5,
    );
    expect(menu.classList.contains("closer")).toBe(true);
    const closer = menu.firstElementChild as HTMLElement;
    expect(closer.textContent).toContain("Close");
    closer.click();
    expect(menu.isConnected).toBe(false);
  });

  it("a small menu has no close line", () => {
    const { menu, lines } = three();
    ctm.summon(menu);
    expect(menu.classList.contains("closer")).toBe(false);
    expect(menu.firstElementChild).toBe(lines[0]);
  });

  it("summoning a menu while a submenu is open reports no error", () => {
    const inner = three();
    const sub = as_element(ctm.sub({ text: "More", menu: inner.menu }));
    ctm.summon(ctm.menu([sub]));
    sub.click();
    const next = three().menu;
    const collected = collect_errors();
    try {
      ctm.summon(next);
    } finally {
      collected.stop();
    }
    expect(next.isConnected).toBe(true);
    expect(collected.errors).toEqual([]);
  });

  it("repositions when the window resizes", () => {
    const { menu } = three();
    ctm.summon(menu, { x: 10, y: 20 });
    menu.style.left = "300px";
    window.dispatchEvent(new Event("resize"));
    expect(menu.style.left).toBe("10px");
  });

  it("stops listening to window resizes once closed", () => {
    const { menu } = three();
    ctm.summon(menu, { x: 10, y: 20 });
    menu.close_up();
    const set_position = vi.spyOn(menu, "set_position");
    window.dispatchEvent(new Event("resize"));
    expect(set_position).not.toHaveBeenCalled();
  });

  it("keeps pointer events inside the container", () => {
    const { menu, lines } = three();
    ctm.summon(menu);
    const listener = vi.fn();
    document.addEventListener("pointerdown", listener);
    try {
      lines[0].dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true }),
      );
      expect(listener).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("pointerdown", listener);
    }
  });
});

describe("Context menu attach", () => {
  afterEach(close_all);

  const right_click = (element: Element, x = 15, y = 25) => {
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    });
    element.dispatchEvent(event);
    return event;
  };

  it("opens the menu at the click position", () => {
    const element = document.body.appendChild(document.createElement("div"));
    const { menu } = three();
    ctm.attach(element, menu);
    expect(ctm.has(element)).toBe(true);
    expect(right_click(element).defaultPrevented).toBe(true);
    expect(menu.isConnected).toBe(true);
    expect(menu.style.left).toBe("15px");
    expect(menu.style.top).toBe("25px");
  });

  it("block stops the menu from opening", () => {
    const element = document.body.appendChild(document.createElement("div"));
    const { menu } = three();
    ctm.attach(element, menu, () => true);
    right_click(element);
    expect(menu.isConnected).toBe(false);
  });

  it("a function returning none opens nothing, some opens the menu", () => {
    const element = document.body.appendChild(document.createElement("div"));
    const { menu } = three();
    let open = false;
    ctm.attach(element, () => (open ? some(menu) : none()));
    right_click(element);
    expect(menu.isConnected).toBe(false);
    open = true;
    right_click(element);
    expect(menu.isConnected).toBe(true);
  });

  it("attaching again replaces the menu", () => {
    const element = document.body.appendChild(document.createElement("div"));
    const first = three().menu;
    const second = three().menu;
    ctm.attach(element, first);
    ctm.attach(element, second);
    right_click(element);
    expect(first.isConnected).toBe(false);
    expect(second.isConnected).toBe(true);
  });

  it("detach removes the menu", () => {
    const element = document.body.appendChild(document.createElement("div"));
    const { menu } = three();
    ctm.attach(element, menu);
    ctm.detach(element);
    expect(ctm.has(element)).toBe(false);
    expect(right_click(element).defaultPrevented).toBe(false);
    expect(menu.isConnected).toBe(false);
    ctm.detach(element);
  });

  it("does not open the menu of a parent element", () => {
    const parent = document.body.appendChild(document.createElement("div"));
    const child = parent.appendChild(document.createElement("div"));
    const parent_menu = three().menu;
    const child_menu = three().menu;
    ctm.attach(parent, parent_menu);
    ctm.attach(child, child_menu);
    right_click(child);
    expect(child_menu.isConnected).toBe(true);
    expect(parent_menu.isConnected).toBe(false);
  });
});

describe("Context menu options", () => {
  afterEach(close_all);

  it("enter and space run the option and close the menu", () => {
    for (const code of ["Enter", "Space"]) {
      const { menu, lines, funcs } = three();
      ctm.summon(menu);
      lines[1].focus();
      key(code);
      expect(funcs[1]).toHaveBeenCalledOnce();
      expect(funcs[0]).not.toHaveBeenCalled();
      expect(menu.isConnected).toBe(false);
    }
  });

  it("escape closes the menu and gives focus back", () => {
    const button = document.body.appendChild(document.createElement("button"));
    button.focus();
    const { menu, lines } = three();
    ctm.summon(menu);
    lines[0].focus();
    key("Escape");
    expect(menu.isConnected).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it("gives focus back after an option closes the menu", () => {
    const button = document.body.appendChild(document.createElement("button"));
    button.focus();
    const { menu, lines } = three();
    ctm.summon(menu);
    lines[2].click();
    expect(document.activeElement).toBe(button);
  });

  it("gives focus back to the original element when a menu replaces an open menu", () => {
    const button = document.body.appendChild(document.createElement("button"));
    button.focus();
    const first = three().menu;
    const second = three().menu;
    ctm.summon(first);
    ctm.summon(second);
    key("Escape");
    expect(document.activeElement).toBe(button);
  });

  it("focus leaving the menu closes it", () => {
    const button = document.body.appendChild(document.createElement("button"));
    const { menu, lines } = three();
    ctm.summon(menu);
    lines[0].focus();
    button.focus();
    expect(menu.isConnected).toBe(false);
  });

  it("focus moving between lines keeps the menu open", () => {
    const { menu, lines } = three();
    ctm.summon(menu);
    lines[0].focus();
    lines[1].focus();
    expect(menu.isConnected).toBe(true);
  });
});

describe("Context menu keyboard navigation", () => {
  afterEach(close_all);

  it("arrow down from the menu focuses the first line, arrow up the last", () => {
    const { menu, lines } = three();
    ctm.summon(menu);
    key("ArrowDown");
    expect(document.activeElement).toBe(lines[0]);
    menu.focus();
    key("ArrowUp");
    expect(document.activeElement).toBe(lines[2]);
  });

  it("arrows and tab move between lines and wrap around", () => {
    const { menu, lines } = three();
    ctm.summon(menu);
    lines[0].focus();
    key("ArrowDown");
    expect(document.activeElement).toBe(lines[1]);
    key("Tab");
    expect(document.activeElement).toBe(lines[2]);
    key("ArrowDown");
    expect(document.activeElement).toBe(lines[0]);
    key("ArrowUp");
    expect(document.activeElement).toBe(lines[2]);
    key("Tab", { shiftKey: true });
    expect(document.activeElement).toBe(lines[1]);
  });

  it("skips dividers", () => {
    const a = as_element(ctm.line({ text: "A", on_click: () => {} }));
    const b = as_element(ctm.line({ text: "B", on_click: () => {} }));
    const menu = ctm.menu([a, ctm.divider(), b]);
    ctm.summon(menu);
    a.focus();
    key("ArrowDown");
    expect(document.activeElement).toBe(b);
    key("ArrowUp");
    expect(document.activeElement).toBe(a);
  });

  it("arrow down from the menu skips a divider at the top to the first option", () => {
    const a = as_element(ctm.line({ text: "A", on_click: () => {} }));
    const b = as_element(ctm.line({ text: "B", on_click: () => {} }));
    const menu = ctm.menu([ctm.divider(), a, b]);
    ctm.summon(menu);
    key("ArrowDown");
    expect(document.activeElement).toBe(a);
  });

  it("arrow up from the menu skips a divider at the bottom to the last option", () => {
    const a = as_element(ctm.line({ text: "A", on_click: () => {} }));
    const b = as_element(ctm.line({ text: "B", on_click: () => {} }));
    const menu = ctm.menu([a, b, ctm.divider()]);
    ctm.summon(menu);
    key("ArrowUp");
    expect(document.activeElement).toBe(b);
  });

  it("wraps past a divider at the end", () => {
    const a = as_element(ctm.line({ text: "A", on_click: () => {} }));
    const b = as_element(ctm.line({ text: "B", on_click: () => {} }));
    const menu = ctm.menu([a, b, ctm.divider()]);
    ctm.summon(menu);
    b.focus();
    key("ArrowDown");
    expect(document.activeElement).toBe(a);
  });

  it("a menu of only dividers keeps focus on the menu", () => {
    const menu = ctm.menu([ctm.divider(), ctm.divider(), ctm.divider()]);
    ctm.summon(menu);
    const collected = collect_errors();
    try {
      key("ArrowDown");
      expect(document.activeElement).toBe(menu);
      key("ArrowUp");
      expect(document.activeElement).toBe(menu);
    } finally {
      collected.stop();
    }
    expect(collected.errors).toEqual([]);
  });

  it("an option between only dividers keeps focus when wrapping", () => {
    const a = as_element(ctm.line({ text: "A", on_click: () => {} }));
    const menu = ctm.menu([ctm.divider(), a, ctm.divider(), ctm.divider()]);
    ctm.summon(menu);
    const collected = collect_errors();
    try {
      key("ArrowDown");
      expect(document.activeElement).toBe(a);
      key("ArrowDown");
      expect(document.activeElement).toBe(a);
      key("ArrowUp");
      expect(document.activeElement).toBe(a);
    } finally {
      collected.stop();
    }
    expect(collected.errors).toEqual([]);
  });
});

describe("Context menu submenus", () => {
  afterEach(close_all);

  /**Menu with a line, a submenu of two lines and another line*/
  const nested = () => {
    const inner = three();
    const sub = as_element(ctm.sub({ text: "More", menu: inner.menu }));
    const before = as_element(ctm.line({ text: "Before", on_click: () => {} }));
    const after = as_element(ctm.line({ text: "After", on_click: () => {} }));
    const menu = ctm.menu([before, sub, after]);
    return { menu, sub, before, after, inner };
  };

  it("clicking the submenu line toggles the submenu", () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu);
    sub.click();
    expect(inner.menu.parentElement).toBe(sub);
    expect(menu.submenu).toBe(sub);
    sub.click();
    expect(inner.menu.isConnected).toBe(false);
    expect(menu.submenu).toBeUndefined();
    expect(menu.isConnected).toBe(true);
  });

  it("arrow right opens the submenu and focuses its first line", () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu);
    sub.focus();
    key("ArrowRight");
    expect(inner.menu.isConnected).toBe(true);
    expect(document.activeElement).toBe(inner.lines[0]);
  });

  it("an option in the submenu runs and closes the whole menu", () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu);
    sub.click();
    inner.lines[1].click();
    expect(inner.funcs[1]).toHaveBeenCalledOnce();
    expect(menu.isConnected).toBe(false);
    expect(inner.menu.isConnected).toBe(false);
  });

  it("escape in the submenu closes the whole menu", () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu);
    sub.focus();
    key("ArrowRight");
    key("Escape");
    expect(menu.isConnected).toBe(false);
    expect(inner.menu.isConnected).toBe(false);
  });

  it("arrow left in the submenu closes only the submenu and focuses its line", () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu);
    sub.focus();
    key("ArrowRight");
    const collected = collect_errors();
    try {
      key("ArrowLeft");
    } finally {
      collected.stop();
    }
    expect(inner.menu.isConnected).toBe(false);
    expect(menu.isConnected).toBe(true);
    expect(document.activeElement).toBe(sub);
    expect(collected.errors).toEqual([]);
  });

  it("opening another submenu closes the first and keeps the menu open", () => {
    const first = three();
    const second = three();
    const sub_first = as_element(ctm.sub({ text: "First", menu: first.menu }));
    const sub_second = as_element(
      ctm.sub({ text: "Second", menu: second.menu }),
    );
    const menu = ctm.menu([sub_first, sub_second]);
    ctm.summon(menu);
    sub_first.click();
    expect(first.menu.isConnected).toBe(true);
    const collected = collect_errors();
    try {
      sub_second.click();
    } finally {
      collected.stop();
    }
    expect(menu.isConnected).toBe(true);
    expect(first.menu.isConnected).toBe(false);
    expect(second.menu.isConnected).toBe(true);
    expect(collected.errors).toEqual([]);
  });

  it("hovering the submenu line opens it after a delay", async () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu);
    sub.dispatchEvent(
      new PointerEvent("pointerenter", { pointerType: "mouse" }),
    );
    await wait(100);
    expect(inner.menu.isConnected).toBe(false);
    await wait(300);
    expect(inner.menu.isConnected).toBe(true);
  });

  it("leaving the submenu line before the delay does not open it", async () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu);
    sub.dispatchEvent(
      new PointerEvent("pointerenter", { pointerType: "mouse" }),
    );
    await wait(100);
    sub.dispatchEvent(
      new PointerEvent("pointerleave", { pointerType: "mouse" }),
    );
    await wait(350);
    expect(inner.menu.isConnected).toBe(false);
  });

  it("touch does not open the submenu by hovering", async () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu);
    sub.dispatchEvent(
      new PointerEvent("pointerenter", { pointerType: "touch" }),
    );
    await wait(400);
    expect(inner.menu.isConnected).toBe(false);
  });

  it("a click right after a hover open does not close the submenu again", async () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu);
    sub.dispatchEvent(
      new PointerEvent("pointerenter", { pointerType: "mouse" }),
    );
    await wait(350);
    sub.click();
    expect(inner.menu.isConnected).toBe(true);
  });

  it("the submenu opens beside its line", () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu, { x: 10, y: 10 });
    sub.click();
    const line = sub.getBoundingClientRect();
    const box = inner.menu.getBoundingClientRect();
    expect(box.left).toBeGreaterThanOrEqual(line.right - 1);
  });

  it("scrolling the menu closes its submenu", () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu);
    sub.click();
    menu.dispatchEvent(new Event("scroll"));
    expect(inner.menu.isConnected).toBe(false);
    expect(menu.isConnected).toBe(true);
  });
});

//       _____ ____  __  __ ____ _____ _   _ ______
//      / ____/ __ \|  \/  |  _ \_   _| \ | |  ____|
//     | |   | |  | | \  / | |_) || | |  \| | |__
//     | |   | |  | | |\/| |  _ < | | | . ` |  __|
//     | |___| |__| | |  | | |_) || |_| |\  | |____
//      \_____\____/|_|  |_|____/_____|_| \_|______|
describe("Combined menus", () => {
  afterEach(() => close_all());

  /**Opens the combined menu and gives its line elements, undefined without menu*/
  const open = (factory: ReturnType<typeof ctm.combine>) => {
    const menu = factory().unwrap_or(undefined);
    if (!menu) return undefined;
    ctm.summon(menu);
    return [
      ...menu.querySelectorAll("contextmenu-option, contextmenu-divider"),
    ].map((line) =>
      line.tagName === "CONTEXTMENU-DIVIDER" ? "|" : line.textContent,
    );
  };

  it("joins groups with a divider between them", () => {
    expect(
      open(
        ctm.combine(
          [
            ctm.line({ text: "A", on_click: () => {} }),
            ctm.line({ text: "B", on_click: () => {} }),
          ],
          [ctm.line({ text: "C", on_click: () => {} })],
          () => [ctm.line({ text: "D", on_click: () => {} })],
        ),
      ),
    ).toEqual(["A", "B", "|", "C", "|", "D"]);
  });

  it("leaves out empty and undefined groups and undefined lines, with their divider", () => {
    expect(
      open(
        ctm.combine(
          [],
          undefined,
          [undefined, ctm.line({ text: "A", on_click: () => {} })],
          () => [undefined],
          [ctm.line({ text: "B", on_click: () => {} })],
          [],
        ),
      ),
    ).toEqual(["A", "|", "B"]);
  });

  it("gives no menu when all groups are empty", () => {
    expect(ctm.combine()().none).toBe(true);
    expect(ctm.combine([], undefined, () => [undefined])().none).toBe(true);
  });

  it("calls group functions and builds a new menu on every open", () => {
    let count = 0;
    const factory = ctm.combine(() => [
      ctm.line({ text: "Open " + ++count, on_click: () => {} }),
    ]);
    const first = factory().unwrap_or(undefined);
    expect(open(factory)).toEqual(["Open 2"]);
    expect(open(factory)).toEqual(["Open 3"]);
    expect(first).not.toBe(factory().unwrap_or(undefined));
  });

  it("takes the lines of menus, and of functions giving a menu or an option of one", () => {
    const menu = ctm.menu([ctm.line({ text: "Menu", on_click: () => {} })]);
    const factory = ctm.combine(
      menu,
      () =>
        ctm.menu(() => [ctm.line({ text: "Function", on_click: () => {} })]),
      () => some(ctm.menu([ctm.line({ text: "Some", on_click: () => {} })])),
      () => none(),
    );
    expect(open(factory)).toEqual(["Menu", "|", "Function", "|", "Some"]);
    close_all();
    //The lines go back to their menu when it opens on its own
    ctm.summon(menu);
    expect(
      [...menu.querySelectorAll("contextmenu-option")].map(
        (o) => o.textContent,
      ),
    ).toEqual(["Menu"]);
    close_all();
    expect(open(factory)).toEqual(["Menu", "|", "Function", "|", "Some"]);
  });

  it("waits for promised lines of a menu with a spinner", async () => {
    let resolve!: (lines: ReturnType<typeof ctm.line>[]) => void;
    const factory = ctm.combine(
      [ctm.line({ text: "Now", on_click: () => {} })],
      ctm.menu(new Promise((r) => (resolve = r))),
    );
    const menu = factory().unwrap_or(undefined)!;
    ctm.summon(menu);
    expect(menu.querySelector("contextmenu-buffer")).not.toBeNull();
    resolve([ctm.line({ text: "Later", on_click: () => {} })]);
    await expect
      .poll(() =>
        [...menu.querySelectorAll("contextmenu-option")].map(
          (o) => o.textContent,
        ),
      )
      .toEqual(["Now", "Later"]);
  });

  it("works with attach", () => {
    const element = document.body.appendChild(document.createElement("div"));
    try {
      ctm.attach(
        element,
        ctm.combine([ctm.line({ text: "A", on_click: () => {} })]),
      );
      element.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
      );
      expect(
        document.documentElement.querySelector("contextmenu-option")
          ?.textContent,
      ).toBe("A");
    } finally {
      element.remove();
    }
  });
});

describe("Context menu styles", () => {
  it("leave how the page scrolls alone, even when loaded late like with the fault prompt", () => {
    //Overflow on html moves scrolling from the window to a body that scrolls itself, jumping to the top
    expect(getComputedStyle(document.documentElement).overflow).toBe("visible");
  });
});

describe("Context menu lines on the element pattern", () => {
  afterEach(close_all);

  const cells = (line: HTMLElement) => ({
    text: line.querySelector(".text")!.textContent,
    shortcut: line.querySelector(".shortcut")!.textContent,
    checkmark: line.querySelector(".checkmark")!.textContent,
    icon: line.querySelector(".icon > svg"),
  });

  it("takes text, shortcut, checked and icon as initial values", () => {
    const line = ctm.line({
      text: "Save",
      shortcut: "Ctrl+S",
      checked: true,
      icon: material_close_rounded,
    });
    const shown = cells(line);
    expect(shown.text).toBe("Save");
    expect(shown.shortcut).toBe("Ctrl+S");
    expect(shown.checkmark).toBe("✓");
    expect(shown.icon).toBeInstanceOf(SVGSVGElement);
  });

  it("follows text, shortcut, checked and icon states while its menu is open", () => {
    const text = st.ok_w("Save");
    const shortcut = st.ok_w("Ctrl+S");
    const checked = st.ok_w(false);
    const icon = st.ok_w<SVGFunc | undefined>(undefined);
    const line = ctm.line({ text, shortcut, checked, icon });
    ctm.summon(ctm.menu([line]));
    expect(cells(line)).toEqual({
      text: "Save",
      shortcut: "Ctrl+S",
      checkmark: "",
      icon: null,
    });
    text.set_ok("Store");
    shortcut.set_ok("");
    checked.set_ok(true);
    icon.set_ok(material_close_rounded);
    const shown = cells(line);
    expect(shown.text).toBe("Store");
    expect(shown.shortcut).toBe("");
    expect(shown.checkmark).toBe("✓");
    expect(shown.icon).toBeInstanceOf(SVGSVGElement);
  });

  it("an error shows its nice text and no checkmark, with a fault", () => {
    const text = st.from_w("Save");
    const checked = st.from_w(true);
    const line = ctm.line({ text, checked });
    ctm.summon(ctm.menu([line]));
    text.set_err(new NiceError(Symbol("No name"), "Server down"));
    checked.set_err(new NiceError(Symbol("No state"), "Server down"));
    expect(cells(line).text).toBe("No name");
    expect(cells(line).checkmark).toBe("");
    expect(line.faults.length).toBe(2);
  });

  it("set again replaces the text and on_click", () => {
    const first = vi.fn();
    const second = vi.fn();
    const line = ctm.line({ text: "First", on_click: first });
    line.set({ text: "Second", on_click: second });
    ctm.summon(ctm.menu([line]));
    line.click();
    expect(cells(line).text).toBe("Second");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("a click runs on_click and leaves a checked state alone", () => {
    const checked = st.ok_w(false);
    const on_click = vi.fn();
    const line = ctm.line({ text: "Mute", checked, on_click });
    ctm.summon(ctm.menu([line]));
    line.click();
    expect(on_click).toHaveBeenCalledOnce();
    expect(checked.ok()).toBe(false);
  });

  it("read access greys the line out, it can not be clicked and the keyboard skips it", () => {
    const on_click = vi.fn();
    const a = ctm.line({ text: "A" });
    const b = ctm.line({ text: "B", on_click, access: AccessTypes.Read });
    const c = ctm.line({ text: "C" });
    const menu = ctm.menu([a, b, c]);
    ctm.summon(menu);
    expect(b.isConnected).toBe(true);
    expect(Number(getComputedStyle(b).opacity)).toBeLessThan(1);
    expect(b.inert).toBe(true);
    a.focus();
    key("ArrowDown");
    expect(document.activeElement).toBe(c);
    key("ArrowUp");
    expect(document.activeElement).toBe(a);
  });

  it("access as a state, none hides the line, write gives it back", () => {
    const access = st.ok_w<AccessTypes>(AccessTypes.None);
    const a = ctm.line({ text: "A" });
    const b = ctm.line({ text: "B", access });
    const c = ctm.line({ text: "C" });
    ctm.summon(ctm.menu([a, b, c]));
    expect(getComputedStyle(b).display).toBe("none");
    a.focus();
    key("ArrowDown");
    expect(document.activeElement).toBe(c);
    access.set_ok(AccessTypes.Write);
    expect(getComputedStyle(b).display).not.toBe("none");
    a.focus();
    key("ArrowDown");
    expect(document.activeElement).toBe(b);
  });

  it("a submenu takes text, icon and menu as inputs", () => {
    const text = st.ok_w("More");
    const inner = three().menu;
    const sub = ctm.sub({ text, icon: material_close_rounded, menu: inner });
    ctm.summon(ctm.menu([sub]));
    expect(sub.querySelector(".text")!.textContent).toBe("More");
    expect(sub.querySelector(".icon > svg")).toBeInstanceOf(SVGSVGElement);
    text.set_ok("Less");
    expect(sub.querySelector(".text")!.textContent).toBe("Less");
    sub.click();
    expect(inner.isConnected).toBe(true);
  });

  it("a submenu without a menu does not open", () => {
    const { errors, stop } = collect_errors();
    const sub = ctm.sub({ text: "Empty" });
    const menu = ctm.menu([sub]);
    ctm.summon(menu);
    sub.click();
    sub.focus();
    key("ArrowRight");
    stop();
    expect(errors).toEqual([]);
    expect(menu.submenu).toBeUndefined();
  });

  it("a submenu given another menu while open closes the old one", () => {
    const old_menu = three().menu;
    const new_menu = three().menu;
    const sub = ctm.sub({ text: "More", menu: old_menu });
    ctm.summon(ctm.menu([sub]));
    sub.click();
    sub.set({ menu: new_menu });
    expect(old_menu.isConnected).toBe(false);
    sub.click();
    expect(new_menu.isConnected).toBe(true);
  });
});
