import state, { type StateOrVal } from "@chocbite/ts-lib/state";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { canvas, type CanvasWidget, type WidgetBaseOptions } from ".";

type Options = WidgetBaseOptions & {
  text?: StateOrVal<string>;
  shown?: StateOrVal<boolean>;
};

const group = canvas.widgets.group("editortest", "Editor test", "");
const definition = group.add(
  "box",
  "Editor box",
  "",
  canvas.definition({
    create: (options: Options) => {
      throw new Error(`not made, ${Object.keys(options).length}`);
    },
    properties: {
      text: { kind: "text", name: "Text", default: "" },
      shown: { kind: "boolean", name: "Shown", default: true },
    },
  }),
);
afterAll(() => group.remove());

afterEach(() => {
  document.body.replaceChildren();
});

const editor_with = (selected: StateOrVal<CanvasWidget | undefined>) =>
  document.body.appendChild(canvas.properties({ selected }));
const title = (editor: HTMLElement) =>
  editor.querySelector(":scope > .title")!.textContent;
const names = (editor: HTMLElement) =>
  [...editor.querySelectorAll("list-row")].map(
    (row) => row.querySelector("list-textfield")!.textContent,
  );
/**The form element of the field in the row of the property*/
const field = (editor: HTMLElement, name: string) =>
  [...editor.querySelectorAll("list-row")]
    .find((row) => row.querySelector("list-textfield")!.textContent === name)!
    .querySelector("list-nodefield")!.firstElementChild!;
/**The value a number field shows, in its value box*/
const number_of = (editor: HTMLElement, name: string) =>
  field(editor, name).querySelector(":scope > span")!.textContent;
/**The value a text field shows, in its input*/
const text_of = (editor: HTMLElement, name: string) =>
  field(editor, name).querySelector("input")!.value;

describe("Properties editor", () => {
  it("shows that nothing is selected", () => {
    const editor = editor_with(undefined as CanvasWidget | undefined);
    expect(title(editor)).toBe("Nothing selected");
    expect(names(editor)).toEqual([]);
  });

  it("shows a row per property of the selected widget, position and size first", () => {
    const widget = canvas.widget(definition, { x: state.ok_w(5) });
    const editor = editor_with(widget);
    expect(title(editor)).toBe("Editor box");
    expect(names(editor)).toEqual([
      "X",
      "Y",
      "Width",
      "Height",
      "Rotation",
      "Text",
      "Shown",
    ]);
  });

  it("binds the fields to the options of the widget", () => {
    const x = state.ok_w(5);
    const text = state.ok_w("hello");
    const editor = editor_with(canvas.widget(definition, { x, text }));
    expect(number_of(editor, "X")).toBe("5");
    expect(text_of(editor, "Text")).toBe("hello");
    x.set_ok(12);
    expect(number_of(editor, "X")).toBe("12");
  });

  it("follows the selection state", () => {
    const first = canvas.widget(definition, { x: state.ok_w(1) });
    const selected = state.ok_w<CanvasWidget | undefined>(first);
    const editor = editor_with(selected);
    expect(number_of(editor, "X")).toBe("1");
    selected.set_ok(canvas.widget(definition, { x: state.ok_w(2) }));
    expect(number_of(editor, "X")).toBe("2");
    selected.set_ok(undefined);
    expect(title(editor)).toBe("Nothing selected");
    expect(names(editor)).toEqual([]);
  });

  it("tells when the widget is not registered", () => {
    const editor = editor_with({
      widget: "/widgets/editortest/none",
      options: {},
    });
    expect(title(editor)).toBe(
      '"/widgets/editortest/none" is not a registered widget',
    );
    expect(names(editor)).toEqual([]);
  });
});
