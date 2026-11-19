import { define_element } from "#base";
import state, { type StateOrVal, type StateROSW } from "@chocbite/ts-lib/state";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  canvas,
  WidgetBase,
  type CanvasLink,
  type CanvasPage,
  type CanvasWidget,
  type WidgetBaseOptions,
} from "..";

class EditorWidget extends WidgetBase {
  static element_name() {
    return "editorwidget";
  }
}
define_element(EditorWidget);

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
const sectioned = group.add(
  "sectioned",
  "Sectioned box",
  "",
  canvas.definition({
    create: (options: Options) => {
      throw new Error(`not made, ${Object.keys(options).length}`);
    },
    properties: {
      text: { kind: "text", name: "Text", default: "", section: "Style" },
      shown: { kind: "boolean", name: "Shown", default: true },
    },
  }),
);
/**Makes elements, for the box of several widgets in a viewport*/
const made = group.add(
  "made",
  "Made box",
  "",
  canvas.definition({
    create: (options: Options) => EditorWidget.create(options),
    properties: {
      text: { kind: "text", name: "Text", default: "" },
    },
  }),
);
afterAll(() => group.remove());

const tick = () => new Promise((resolve) => setTimeout(resolve));
/**A local writable state, which can be set directly*/
type StateOkW<T> = ReturnType<typeof state.ok_w<T>>;
/**The value of an option of a widget*/
const value_of = (widget: CanvasWidget, key: string) =>
  (widget.options as Record<string, StateROSW<unknown>>)[key].ok();

afterEach(() => {
  document.body.replaceChildren();
});

const editor_with = (selected: StateOrVal<readonly CanvasWidget[]>) =>
  document.body.appendChild(canvas.properties({ selected }));
const title = (editor: HTMLElement) =>
  editor.querySelector(":scope > .title")!.textContent;
/**The name in the key field of a row*/
const name_of = (row: Element) =>
  row.querySelector("list-keyfield")!.textContent;
/**Names of the rows shown, sub rows of open sections included*/
const names = (editor: HTMLElement) =>
  [...editor.querySelectorAll("list-row")].map(name_of);
const row_of = (editor: HTMLElement, name: string) =>
  [...editor.querySelectorAll("list-row")].find(
    (row) => name_of(row) === name,
  )!;
/**The form element of the field in the row of the property*/
const field = (editor: HTMLElement, name: string) =>
  row_of(editor, name).querySelector("list-nodefield")!.firstElementChild!;
/**Opens or closes the row of a section*/
const toggle = (editor: HTMLElement, name: string) =>
  row_of(editor, name)
    .querySelector<HTMLElement>("list-keyfield .opener > div")!
    .click();
/**The value a number field shows, in its value box*/
const number_of = (editor: HTMLElement, name: string) =>
  field(editor, name).querySelector(":scope > span")!.textContent;
/**The value a text field shows, in its input*/
const text_of = (editor: HTMLElement, name: string) =>
  field(editor, name).querySelector("input")!.value;
/**Types a text in the text field of the property*/
const type_text = async (editor: HTMLElement, name: string, text: string) => {
  const input = field(editor, name).querySelector("input")!;
  input.value = text;
  input.dispatchEvent(new Event("change"));
  await tick();
};
/**Types a number in the number field of the property*/
const type_number = async (
  editor: HTMLElement,
  name: string,
  number: number,
) => {
  const element = field(editor, name);
  const box = element.querySelector(":scope > span")!;
  box.textContent = String(number);
  box.dispatchEvent(new Event("input"));
  element.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  await tick();
};

describe("Properties editor", () => {
  it("shows that nothing is selected", () => {
    const editor = editor_with([]);
    expect(title(editor)).toBe("Nothing selected");
    expect(names(editor)).toEqual([]);
  });

  it("shows a row per property of the selected widget, the base properties first in General", () => {
    const widget = canvas.widget(definition, { x: state.ok_w(5) });
    const editor = editor_with([widget]);
    expect(title(editor)).toBe("Editor box");
    expect(names(editor)).toEqual(["General", "Text", "Shown"]);
    toggle(editor, "General");
    expect(names(editor)).toEqual([
      "General",
      "ID",
      "X",
      "Y",
      "Width",
      "Height",
      "Rotation",
      "Opacity",
      "Visible",
      "Text",
      "Shown",
    ]);
  });

  it("shows the properties of a section in its sub rows, those without one at the root", () => {
    const editor = editor_with([canvas.widget(sectioned, { text: "hello" })]);
    expect(names(editor).slice(-2)).toEqual(["Style", "Shown"]);
    const section = row_of(editor, "Style");
    expect(section.querySelector("list-nodefield")!.childElementCount).toBe(0);
    expect(section.querySelector("canvas-linkfield")!.classList).toContain(
      "none",
    );
    toggle(editor, "Style");
    expect(names(editor).slice(-3)).toEqual(["Style", "Text", "Shown"]);
    expect(text_of(editor, "Text")).toBe("hello");
  });

  it("keeps a section open when an option in it is linked", () => {
    const text = state.ok_w<string | CanvasLink<string>>("hello");
    const editor = editor_with([canvas.widget(sectioned, { text })]);
    toggle(editor, "Style");
    text.set_ok(canvas.link("/states/editortest/none"));
    expect(names(editor).slice(-3)).toEqual(["Style", "Text", "Shown"]);
    expect(
      row_of(editor, "Text").querySelector("canvas-linkedvalue"),
    ).not.toBeNull();
  });

  it("binds the fields to the options of the widget", () => {
    const x = state.ok_w(5);
    const text = state.ok_w("hello");
    const editor = editor_with([canvas.widget(definition, { x, text })]);
    toggle(editor, "General");
    expect(number_of(editor, "X")).toBe("5");
    expect(text_of(editor, "Text")).toBe("hello");
    x.set_ok(12);
    expect(number_of(editor, "X")).toBe("12");
  });

  it("shows the default, read only, for a property the widget has no state for", async () => {
    const editor = editor_with([canvas.widget(definition, { x: 5 })]);
    const visible = field(editor, "Shown") as HTMLElement & {
      get_value: { ok: boolean; value?: unknown };
    };
    expect(visible.get_value).toMatchObject({ ok: true, value: true });
    //Space toggles a switch
    const knob = visible.querySelector(":scope > div")!;
    for (const type of ["keydown", "keyup"])
      knob.dispatchEvent(new KeyboardEvent(type, { key: " ", bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve));
    expect(visible.get_value).toMatchObject({ ok: true, value: true });
  });

  it("follows the selection state, keeping the open sections open", () => {
    const first = canvas.widget(definition, { x: state.ok_w(1) });
    const selected = state.ok_w<CanvasWidget[]>([first]);
    const editor = editor_with(selected);
    toggle(editor, "General");
    expect(number_of(editor, "X")).toBe("1");
    selected.set_ok([canvas.widget(definition, { x: state.ok_w(2) })]);
    expect(number_of(editor, "X")).toBe("2");
    selected.set_ok([]);
    expect(title(editor)).toBe("Nothing selected");
    expect(names(editor)).toEqual([]);
    selected.set_ok([first]);
    expect(number_of(editor, "X")).toBe("1");
    toggle(editor, "General");
    selected.set_ok([canvas.widget(definition, {})]);
    expect(names(editor)).toEqual(["General", "Text", "Shown"]);
  });

  describe("with several widgets", () => {
    it("tells how many, and of which widget when they are of one", () => {
      expect(
        title(
          editor_with([
            canvas.widget(definition, {}),
            canvas.widget(definition, {}),
          ]),
        ),
      ).toBe("2 × Editor box");
      expect(
        title(
          editor_with([
            canvas.widget(definition, {}),
            canvas.widget(sectioned, {}),
          ]),
        ),
      ).toBe("2 widgets");
    });

    it("shows the properties all of them have, without the ID", () => {
      const editor = editor_with([
        canvas.widget(definition, {}),
        canvas.widget(made, {}),
      ]);
      toggle(editor, "General");
      expect(names(editor)).toEqual([
        "General",
        "X",
        "Y",
        "Width",
        "Height",
        "Rotation",
        "Opacity",
        "Visible",
        "Text",
      ]);
    });

    it("shows a value they share, and sets it on all of them", async () => {
      const widgets = [
        canvas.widget(definition, { text: "same" }),
        canvas.widget(definition, { text: "same" }),
      ];
      const editor = editor_with(widgets);
      expect(text_of(editor, "Text")).toBe("same");
      await type_text(editor, "Text", "changed");
      expect(widgets.map((w) => value_of(w, "text"))).toEqual([
        "changed",
        "changed",
      ]);
    });

    it("is blank where the values differ, a change sets all of them and shows the value again", async () => {
      const widgets = [
        canvas.widget(definition, { text: "one" }),
        canvas.widget(definition, { text: "two" }),
      ];
      const editor = editor_with(widgets);
      expect(text_of(editor, "Text")).toBe("");
      await type_text(editor, "Text", "both");
      expect(widgets.map((w) => value_of(w, "text"))).toEqual(["both", "both"]);
      expect(text_of(editor, "Text")).toBe("both");
      //A change of one of them makes it blank again
      (widgets[0].options.text as StateOkW<string>).set_ok("apart");
      expect(text_of(editor, "Text")).toBe("");
    });

    it("turns the box and them with it to the rotation entered, like the rotate handle", async () => {
      const widgets = [
        canvas.widget(made, { x: 0, y: 0, width: 10, height: 10 }),
        canvas.widget(made, { x: 30, y: 10, width: 10, height: 10 }),
      ];
      const page: CanvasPage = { widgets: state.ok_w(widgets) };
      document.body.appendChild(canvas.viewport({ page }));
      const editor = editor_with(widgets);
      toggle(editor, "General");
      //The widgets are not rotated, so neither is the box
      expect(number_of(editor, "Rotation")).toBe("0");
      await type_number(editor, "Rotation", 90);
      //The box is 40 by 20 at 0,0, the centers turn a quarter around 20,10
      expect(
        widgets.map((w) =>
          ["x", "y", "rotation"].map(
            (key) => Math.round(value_of(w, key) as number) + 0,
          ),
        ),
      ).toEqual([
        [20, -10, 90],
        [10, 20, 90],
      ]);
      //The box keeps the rotation, like x keeps the position
      expect(number_of(editor, "Rotation")).toBe("90");
      expect(
        ["X", "Y", "Width", "Height"].map((name) => number_of(editor, name)),
      ).toEqual(["0", "0", "40", "20"]);
    });

    it("shows the box around them as X, Y, width and height, and moves and scales them with it", async () => {
      const widgets = [
        canvas.widget(made, { x: 0, y: 0, width: 10, height: 10 }),
        canvas.widget(made, { x: 30, y: 10, width: 10, height: 10 }),
      ];
      const page: CanvasPage = { widgets: state.ok_w(widgets) };
      document.body.appendChild(canvas.viewport({ page }));
      const editor = editor_with(widgets);
      toggle(editor, "General");
      expect(
        ["X", "Y", "Width", "Height"].map((name) => number_of(editor, name)),
      ).toEqual(["0", "0", "40", "20"]);
      await type_number(editor, "Width", 80);
      expect(widgets.map((w) => value_of(w, "x"))).toEqual([0, 60]);
      expect(widgets.map((w) => value_of(w, "width"))).toEqual([20, 20]);
      expect(number_of(editor, "Width")).toBe("80");
      await type_number(editor, "Y", 5);
      expect(widgets.map((w) => value_of(w, "y"))).toEqual([5, 15]);
      //A widget moved elsewhere changes the box
      (widgets[1].options.x as StateOkW<number>).set_ok(100);
      expect(number_of(editor, "Width")).toBe("120");
    });

    it("shows a link they share, a property linked in only some of them is blank and read only", () => {
      const link = canvas.link<string>("/states/editortest/none");
      const shared = editor_with([
        canvas.widget(definition, { text: link }),
        canvas.widget(definition, { text: link }),
      ]);
      expect(
        row_of(shared, "Text").querySelector("canvas-linkedvalue"),
      ).not.toBeNull();
      const mixed = editor_with([
        canvas.widget(definition, { text: link }),
        canvas.widget(definition, { text: "plain" }),
      ]);
      const text = row_of(mixed, "Text");
      expect(text.querySelector("canvas-linkedvalue")).toBeNull();
      expect(text.querySelector("input")!.value).toBe("");
      expect(text.querySelector("canvas-linkfield")!.classList).toContain(
        "linked",
      );
    });
  });

  it("tells when the widget is not registered", () => {
    const editor = editor_with([
      {
        widget: "/widgets/editortest/none",
        options: {},
      },
    ]);
    expect(title(editor)).toBe(
      '"/widgets/editortest/none" is not a registered widget',
    );
    expect(names(editor)).toEqual([]);
  });
});
