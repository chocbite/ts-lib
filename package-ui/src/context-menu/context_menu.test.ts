import { DOCUMENT_HANDLER } from "#document";
import { none, some } from "@chocbite/ts-lib/result";
import { afterEach, describe, expect, it, vi } from "vitest";
import ctm, { type ContextMenu } from ".";

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
      const line = ctm.line("Do", func);
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
      const sub_menu: ContextMenu = ctm.menu([ctm.line("Inner", () => {})]);
      const sub = ctm.sub("More", sub_menu);
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
    const menu = ctm.menu([ctm.line("Default", () => {})]);
    ctm.default(menu);
    try {
      expect(contextmenu(document.body).defaultPrevented).toBe(true);
      expect(menu.isConnected).toBe(true);
    } finally {
      menu.close_up();
    }
  });

  it("an element menu takes precedence over the default menu", () => {
    const default_menu = ctm.menu([ctm.line("Default", () => {})]);
    const element_menu = ctm.menu([ctm.line("Element", () => {})]);
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
const container = () => document.documentElement.querySelector("contextmenu-container")!;

const as_element = (line: unknown) => line as HTMLElement;

const key = (code: string, init: KeyboardEventInit = {}) => {
  const target = document.activeElement ?? document.body;
  target.dispatchEvent(
    new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true, ...init }),
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
  const lines = ["A", "B", "C"].map((text, i) => ctm.line(text, funcs[i]));
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
    ctm.summon(menu, undefined, 10, 20);
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
    element.style.cssText = "position:fixed;left:40px;top:30px;width:20px;height:10px;";
    const { menu } = three();
    ctm.summon(menu, element);
    expect(menu.style.left).toBe("50px");
    expect(menu.style.top).toBe("35px");
  });

  it("opens left of and above the position near the bottom right corner", () => {
    const { menu } = three();
    const x = window.innerWidth - 5;
    const y = window.innerHeight - 5;
    ctm.summon(menu, undefined, x, y);
    const box = menu.getBoundingClientRect();
    expect(box.right).toBeCloseTo(x, 0);
    expect(box.bottom).toBeCloseTo(y, 0);
  });

  it("stays inside the window when it fits neither side of the position", () => {
    const lines = Array.from({ length: 6 }, (_, i) => ctm.line("Line " + i, () => {}));
    const menu = ctm.menu(lines);
    ctm.summon(menu, undefined, 0, 0);
    const height = menu.getBoundingClientRect().height;
    menu.close_up();
    //Too low to fit below and too high to fit above
    const y = Math.min(height - 1, window.innerHeight - height / 2);
    ctm.summon(menu, undefined, 10, y);
    const box = menu.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(window.innerHeight + 0.5);
  });

  it("dont_cover places the menu beside the element", () => {
    const element = document.body.appendChild(document.createElement("div"));
    element.style.cssText = "position:fixed;left:50px;top:40px;width:40px;height:20px;";
    const { menu } = three();
    ctm.summon(menu, element, undefined, undefined, true);
    const box = menu.getBoundingClientRect();
    expect(box.left).toBeCloseTo(90, 0);
  });

  it("dont_cover keeps the menu inside the window for a tall element", () => {
    const { menu } = three();
    ctm.summon(menu, undefined, 0, 0);
    const height = menu.getBoundingClientRect().height;
    menu.close_up();
    const element = document.body.appendChild(document.createElement("div"));
    //Starts above the menu height, ends near the bottom of the window
    element.style.cssText = `position:fixed;left:50px;top:${height / 2}px;width:40px;height:${window.innerHeight - height}px;`;
    ctm.summon(menu, element, undefined, undefined, true);
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
    const a = ctm.line("A", () => {});
    const menu = ctm.menu([undefined, a, undefined]);
    ctm.summon(menu);
    expect([...menu.children]).toEqual([a]);
  });

  it("calls a line function on every open", () => {
    const lines = vi.fn(() => [ctm.line("A", () => {})]);
    const menu = ctm.menu(lines);
    ctm.summon(menu);
    menu.close_up();
    ctm.summon(menu);
    expect(lines).toHaveBeenCalledTimes(2);
  });

  it("shows a spinner until promised lines arrive", async () => {
    let resolve: (lines: ReturnType<typeof ctm.line>[]) => void = () => {};
    const menu = ctm.menu(new Promise((r) => (resolve = r)));
    ctm.summon(menu, undefined, 10, 10);
    expect(menu.querySelector("contextmenu-buffer")).not.toBeNull();
    const a = ctm.line("A", () => {});
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
    ctm.summon(menu, undefined, 10, 10);
    menu.style.left = "";
    menu.close_up();
    expect(document.activeElement).toBe(button);
    const a = ctm.line("A", () => {});
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
    ctm.summon(first, undefined, 10, 10);
    const second = three().menu;
    ctm.summon(second);
    resolve([ctm.line("A", () => {})]);
    await wait(0);
    expect(first.isConnected).toBe(false);
    expect([...container().children]).toEqual([second]);
    expect(document.activeElement).toBe(second);
  });

  it("lines of an earlier open do not replace the lines of a later open", async () => {
    const resolvers: ((lines: ReturnType<typeof ctm.line>[]) => void)[] = [];
    const menu = ctm.menu(() => new Promise((r) => resolvers.push(r)));
    ctm.summon(menu, undefined, 10, 10);
    menu.close_up();
    ctm.summon(menu, undefined, 10, 10);
    //One spinner, not one for every open
    expect(menu.querySelectorAll("contextmenu-buffer").length).toBe(1);
    const old_line = ctm.line("Old", () => {});
    const new_line = ctm.line("New", () => {});
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
      ctm.line("Line " + i + " ".padEnd(300, "x"), () => {}),
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
    const sub = as_element(ctm.sub("More", inner.menu));
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
    ctm.summon(menu, undefined, 10, 20);
    menu.style.left = "300px";
    window.dispatchEvent(new Event("resize"));
    expect(menu.style.left).toBe("10px");
  });

  it("stops listening to window resizes once closed", () => {
    const { menu } = three();
    ctm.summon(menu, undefined, 10, 20);
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
      lines[0].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
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

  it("shows text, shortcut, checkmark and icon", () => {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const line = as_element(ctm.line("Save", () => {}, icon, "Ctrl+S", true));
    expect(line.querySelector(".text")!.textContent).toBe("Save");
    expect(line.querySelector(".shortcut")!.textContent).toBe("Ctrl+S");
    expect(line.querySelector(".checkmark")!.textContent).toBe("✓");
    expect(line.querySelector(".icon > svg")).toBe(icon);
  });

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
    const a = as_element(ctm.line("A", () => {}));
    const b = as_element(ctm.line("B", () => {}));
    const menu = ctm.menu([a, ctm.devider(), b]);
    ctm.summon(menu);
    a.focus();
    key("ArrowDown");
    expect(document.activeElement).toBe(b);
    key("ArrowUp");
    expect(document.activeElement).toBe(a);
  });

  it("arrow down from the menu skips a divider at the top to the first option", () => {
    const a = as_element(ctm.line("A", () => {}));
    const b = as_element(ctm.line("B", () => {}));
    const menu = ctm.menu([ctm.devider(), a, b]);
    ctm.summon(menu);
    key("ArrowDown");
    expect(document.activeElement).toBe(a);
  });

  it("arrow up from the menu skips a divider at the bottom to the last option", () => {
    const a = as_element(ctm.line("A", () => {}));
    const b = as_element(ctm.line("B", () => {}));
    const menu = ctm.menu([a, b, ctm.devider()]);
    ctm.summon(menu);
    key("ArrowUp");
    expect(document.activeElement).toBe(b);
  });

  it("wraps past a divider at the end", () => {
    const a = as_element(ctm.line("A", () => {}));
    const b = as_element(ctm.line("B", () => {}));
    const menu = ctm.menu([a, b, ctm.devider()]);
    ctm.summon(menu);
    b.focus();
    key("ArrowDown");
    expect(document.activeElement).toBe(a);
  });

  it("a menu of only dividers keeps focus on the menu", () => {
    const menu = ctm.menu([ctm.devider(), ctm.devider(), ctm.devider()]);
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
    const a = as_element(ctm.line("A", () => {}));
    const menu = ctm.menu([ctm.devider(), a, ctm.devider(), ctm.devider()]);
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
    const sub = as_element(ctm.sub("More", inner.menu));
    const before = as_element(ctm.line("Before", () => {}));
    const after = as_element(ctm.line("After", () => {}));
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
    const sub_first = as_element(ctm.sub("First", first.menu));
    const sub_second = as_element(ctm.sub("Second", second.menu));
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
    sub.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    await wait(100);
    expect(inner.menu.isConnected).toBe(false);
    await wait(300);
    expect(inner.menu.isConnected).toBe(true);
  });

  it("leaving the submenu line before the delay does not open it", async () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu);
    sub.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    await wait(100);
    sub.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
    await wait(350);
    expect(inner.menu.isConnected).toBe(false);
  });

  it("touch does not open the submenu by hovering", async () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu);
    sub.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "touch" }));
    await wait(400);
    expect(inner.menu.isConnected).toBe(false);
  });

  it("a click right after a hover open does not close the submenu again", async () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu);
    sub.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    await wait(350);
    sub.click();
    expect(inner.menu.isConnected).toBe(true);
  });

  it("the submenu opens beside its line", () => {
    const { menu, sub, inner } = nested();
    ctm.summon(menu, undefined, 10, 10);
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
