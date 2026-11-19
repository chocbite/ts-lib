import { state_ui } from "#state_ui";
import { CREATE, define_element, input_key, type InputOptions } from "#base";
import ctm from "#context_menu";
import state from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  content,
  content_context_lines,
  ContentBase,
  type ContentCreateOptions,
} from "./content";

const attach = <T extends HTMLElement>(element: T): T =>
  document.body.appendChild(element);

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

afterEach(() => {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { code: "Escape", bubbles: true }),
  );
  document.body.replaceChildren();
});

describe("Content", () => {
  it("has defaults when nothing is given", () => {
    const c = content();
    expect(c.content_title).toBe("");
    expect(c.content_icon).toBeUndefined();
    expect(c.content_closable).toBe(false);
    expect(c.content_min_width).toBe(0);
    expect(c.content_min_height).toBe(0);
    expect(c.content_context_menu).toBeUndefined();
  });

  it("hands out the creation inputs it was given, unchanged", () => {
    const title = state.ok_w("a");
    const closable = state.ok_w(true);
    const c = content({ title, closable, min_width: 10 });
    expect(c.content_title).toBe(title);
    expect(c.content_closable).toBe(closable);
    expect(c.content_min_width).toBe(10);
  });

  it("set can not replace the creation inputs", () => {
    const title = state.ok_w("a");
    const c = content({ title });
    // @ts-expect-error the title is followed by the container, so it is given at creation
    c.set({ title: "b" });
    expect(c.content_title).toBe(title);
  });

  it("is filled with children by the user", () => {
    const c = attach(content());
    c.append("text");
    expect(c.textContent).toBe("text");
  });
});

describe("Content context menu", () => {
  it("gives lines, a function or nothing as lines", () => {
    const line = ctm.line({ text: "A", on_click: () => {} });
    expect(content_context_lines(content({ context_menu: [line] }))).toEqual([
      line,
    ]);
    const fn = vi.fn(() => [line]);
    const c = content({ context_menu: fn });
    expect(content_context_lines(c)).toEqual([line]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(content_context_lines(content())).toEqual([]);
  });

  it("opens its own menu, and set replaces it", () => {
    const c = attach(content({ context_menu: [ctm.line({ text: "First", on_click: () => {} })] }));
    expect(open_menu(c).textContent).toContain("First");
    c.set({ context_menu: () => [ctm.line({ text: "Second", on_click: () => {} })] });
    expect(open_menu(c).textContent).toContain("Second");
  });
});

describe("Content closing", () => {
  it("content_close resolves content_on_close and tells the container", async () => {
    const c = attach(content());
    const closed = c.content_on_close();
    const listener = vi.fn();
    document.body.addEventListener("content_closed", listener);
    c.content_close();
    await closed;
    expect(listener).toHaveBeenCalledTimes(1);
    document.body.removeEventListener("content_closed", listener);
  });
});

//A user subclass with a creation input of its own
const NOTE = {
  /**Text of the note, given at creation*/
  text: input_key<string>(),
};
type NoteCreateOptions = ContentCreateOptions & InputOptions<typeof NOTE>;

class Note extends ContentBase {
  static element_name() {
    return "note";
  }
  static element_name_space() {
    return "contenttest";
  }
  #text = this.appendChild(document.createElement("p"));
  [CREATE](options: NoteCreateOptions): void {
    super[CREATE](options);
    this.set_input(NOTE.text, options.text, (text) => {
      this.#text.textContent = text.value;
    });
  }
}
define_element(Note);

describe("Content subclass", () => {
  it("is created with create, with its own and the content creation inputs", () => {
    const note = Note.create({ text: "hello", title: "Note", closable: true });
    expect(note).toBeInstanceOf(Note);
    expect(note.textContent).toBe("hello");
    expect(note.content_title).toBe("Note");
    expect(note.content_closable).toBe(true);
  });
});

describe("Content size", () => {
  it("gives its own size as states, like a canvas scaled to fit its panel", async () => {
    const element = attach(content());
    element.style.cssText = "display:block;width:140px;height:60px";
    const { width, height } = element.content_size();
    width.sub(() => {});
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    expect(width.ok()).toBe(140);
    expect(height.ok()).toBe(60);
    expect(element.content_size()).toBe(state_ui.size(element));
  });
});
