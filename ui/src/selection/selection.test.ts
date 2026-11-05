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
