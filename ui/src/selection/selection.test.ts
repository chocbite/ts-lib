import { afterEach, describe, expect, it } from "vitest";
import {
  get_cursor_position,
  set_cursor_end,
  set_cursor_position,
  set_selection_all,
} from "./selection";

const text = "Hello, world!";

function create_contenteditable(): HTMLDivElement {
  const element = document.createElement("div");
  element.contentEditable = "true";
  element.textContent = text;
  document.body.append(element);
  return element;
}

function create_input(): HTMLInputElement {
  const element = document.createElement("input");
  element.value = text;
  document.body.append(element);
  return element;
}

function create_textarea(): HTMLTextAreaElement {
  const element = document.createElement("textarea");
  element.value = text;
  document.body.append(element);
  return element;
}

const editable_elements = [
  ["contenteditable", create_contenteditable],
  ["input", create_input],
  ["textarea", create_textarea],
] as const;

afterEach(() => {
  document.body.replaceChildren();
  window.getSelection()?.removeAllRanges();
});

describe("selection", () => {
  it.each(editable_elements)("gets the cursor position for %s", (_, create_element) => {
    const element = create_element();

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.focus();
      element.setSelectionRange(5, 8);
    } else {
      const range = document.createRange();
      range.setStart(element.firstChild as Text, 5);
      range.setEnd(element.firstChild as Text, 8);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }

    expect(get_cursor_position(element)).toBe(5);
  });

  it("gets the cursor position at the end of nested contenteditable text", () => {
    const element = create_contenteditable();
    element.replaceChildren(...text.split("").map((character) => {
      const span = document.createElement("span");
      span.textContent = character;
      return span;
    }));
    const last_text_node = element.lastChild?.firstChild as Text;
    const range = document.createRange();
    range.setStart(last_text_node, last_text_node.length);
    range.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    expect(get_cursor_position(element)).toBe(text.length);
  });

  it.each(editable_elements)("sets the cursor position for %s", (_, create_element) => {
    const element = create_element();

    set_cursor_position(element, 5);

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      expect(element.selectionStart).toBe(5);
      expect(element.selectionEnd).toBe(5);
    } else {
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(element.firstChild);
      expect(range?.startOffset).toBe(5);
      expect(range?.collapsed).toBe(true);
    }
    expect(document.activeElement).toBe(element);
  });

  it.each(editable_elements)("sets the cursor at the end for %s", (_, create_element) => {
    const element = create_element();

    set_cursor_end(element);

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      expect(element.selectionStart).toBe(text.length);
      expect(element.selectionEnd).toBe(text.length);
    } else {
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(element.firstChild);
      expect(range?.startOffset).toBe(text.length);
      expect(range?.collapsed).toBe(true);
    }
    expect(document.activeElement).toBe(element);
  });

  it.each(editable_elements)("selects all content for %s", (_, create_element) => {
    const element = create_element();

    set_selection_all(element);

    expect(get_cursor_position(element)).toBe(0);
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      expect(element.selectionEnd).toBe(text.length);
    } else {
      expect(window.getSelection()?.toString()).toBe(text);
    }
    expect(document.activeElement).toBe(element);
  });
});

/**Contenteditable with "Hello" in a bold element followed by ", world!" */
function create_nested(): HTMLDivElement {
  const element = create_contenteditable();
  const bold = document.createElement("b");
  bold.textContent = "Hello";
  element.replaceChildren(bold, ", world!");
  return element;
}

describe("selection edge cases", () => {
  it("returns -1 when there is no selection", () => {
    const element = create_contenteditable();
    window.getSelection()?.removeAllRanges();
    expect(get_cursor_position(element)).toBe(-1);
  });

  it("returns -1 when the selection is in another element", () => {
    const element = create_contenteditable();
    const other = create_contenteditable();
    const range = document.createRange();
    range.setStart(other.firstChild as Text, 2);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    expect(get_cursor_position(element)).toBe(-1);
  });

  it("returns the start of a backwards selection", () => {
    const element = create_contenteditable();
    const node = element.firstChild as Text;
    window.getSelection()?.setBaseAndExtent(node, 8, node, 3);
    expect(get_cursor_position(element)).toBe(3);
  });

  it("counts text in nested elements before the cursor", () => {
    const element = create_nested();
    const range = document.createRange();
    range.setStart(element.lastChild as Text, 2);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    expect(get_cursor_position(element)).toBe(7);
  });

  it("sets the cursor inside nested text nodes", () => {
    const element = create_nested();
    set_cursor_position(element, 7);
    const range = window.getSelection()!.getRangeAt(0);
    expect(range.startContainer).toBe(element.lastChild);
    expect(range.startOffset).toBe(2);
    expect(get_cursor_position(element)).toBe(7);
  });

  it("sets the cursor at a text node boundary to the end of the first node", () => {
    const element = create_nested();
    set_cursor_position(element, 5);
    const range = window.getSelection()!.getRangeAt(0);
    expect(range.startContainer).toBe(element.firstChild!.firstChild);
    expect(range.startOffset).toBe(5);
  });

  it("sets the cursor at the start with offset 0", () => {
    const element = create_contenteditable();
    set_cursor_position(element, 0);
    expect(get_cursor_position(element)).toBe(0);
    expect(document.activeElement).toBe(element);
  });

  it("clamps an offset past the end of a contenteditable to the end", () => {
    const element = create_contenteditable();
    set_cursor_position(element, 100);
    expect(document.activeElement).toBe(element);
    expect(get_cursor_position(element)).toBe(text.length);
  });

  it("clamps an offset past the end of an input to the end", () => {
    const element = create_input();
    set_cursor_position(element, 100);
    expect(element.selectionStart).toBe(text.length);
  });

  it("focuses an empty contenteditable when setting the cursor position", () => {
    const element = create_contenteditable();
    element.replaceChildren();
    set_cursor_position(element, 0);
    expect(document.activeElement).toBe(element);
  });

  it("sets the cursor at the end when the last child is an element", () => {
    const element = create_contenteditable();
    const bold = document.createElement("b");
    bold.textContent = "!!";
    element.append(bold);
    set_cursor_end(element);
    expect(get_cursor_position(element)).toBe(text.length + 2);
    expect(window.getSelection()?.getRangeAt(0).collapsed).toBe(true);
  });

  it("focuses an empty contenteditable when setting the cursor at the end", () => {
    const element = create_contenteditable();
    element.replaceChildren();
    set_cursor_end(element);
    expect(document.activeElement).toBe(element);
  });

  it("selects all nested content", () => {
    const element = create_nested();
    set_selection_all(element);
    expect(window.getSelection()?.toString()).toBe(text);
    expect(get_cursor_position(element)).toBe(0);
  });

  it("replaces an existing selection elsewhere", () => {
    const other = create_input();
    const element = create_contenteditable();
    set_selection_all(other);
    set_cursor_position(element, 3);
    expect(document.activeElement).toBe(element);
    expect(get_cursor_position(element)).toBe(3);
  });
});
