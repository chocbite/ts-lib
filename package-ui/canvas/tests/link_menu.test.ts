import { define_element, input_key, type InputOptions } from "#base";
import depot from "@chocbite/ts-lib/depot";
import state, {
  type StateOrVal,
  type StateROS,
  type StateROSW,
} from "@chocbite/ts-lib/state";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { canvas, type CanvasWidgetData } from "..";
import { made, made_one } from "./made";
import { CanvasLink } from "../link";
import type { WidgetSlot } from "../slot";
import { WidgetBase, type WidgetBaseOptions } from "../widget";

const MENU_WIDGET = {
  text: input_key<StateOrVal<string>>(),
  shown: input_key<StateOrVal<boolean>>(),
};
type MenuWidgetOptions = WidgetBaseOptions & InputOptions<typeof MENU_WIDGET>;

/**Shows its text, or the nice text of its error, and keeps shown*/
class MenuWidget extends WidgetBase {
  static element_name() {
    return "menuwidget";
  }
  shown: unknown;
  set(options: MenuWidgetOptions): this {
    super.set(options);
    this.set_input(MENU_WIDGET.text, options.text, (text) => {
      this.textContent = text.ok ? text.value : text.error.nice;
    });
    this.set_input(MENU_WIDGET.shown, options.shown, (shown) => {
      this.shown = shown.ok ? shown.value : shown.error.nice;
    });
    return this;
  }
}
define_element(MenuWidget);

const widgets = canvas.widgets.group("linkmenutest", "Link menu test", "");
const definition = widgets.add(
  "text",
  "Text",
  "",
  canvas.definition({
    create: (options: MenuWidgetOptions) => MenuWidget.create(options),
    properties: {
      text: { kind: "text", name: "Text", default: "" },
      shown: { kind: "boolean", name: "Shown", default: true },
    },
  }),
);
const states = depot.states.group("linkmenutest", "Link menu test", "");
afterAll(() => {
  widgets.remove();
  states.remove();
});

afterEach(() => {
  for (const panel of document.querySelectorAll("composition-panel"))
    (panel as HTMLElement & { close(): void }).close();
  document.body.replaceChildren();
  //A registered group always has a children state
  const children = states.children as StateROS<readonly { remove(): void }[]>;
  for (const child of [...children.ok()]) child.remove();
});

const PATH = (id: string) => "/states/linkmenutest/" + id;
const tick = () => new Promise((r) => setTimeout(r, 0));

/**Shows the widget in a viewport and gives its element*/
const show = (widget: CanvasWidgetData) =>
  (
    document.body
      .appendChild(
        canvas.viewport({ page: canvas.page({ widgets: [widget] }) }),
      )
      .querySelector("canvas-slot") as WidgetSlot
  ).element as MenuWidget;

describe("Linked values are converted to the type of the option", () => {
  it("numbers with Number, so a boolean maps through a linear transform", () => {
    const on = state.ok_w(true);
    states.add("on", "On", "", on);
    const widget = canvas.widget(definition, {
      x: canvas.link(PATH("on"), {
        transforms: [canvas.linear([0, 1], [10, 50])],
      }),
    });
    const element = show(widget);
    expect(element.style.left).toBe("50px");
    on.set_ok(false);
    expect(element.style.left).toBe("10px");
    //Written back as the type of the linked state
    void made_one(widget).value("x")!.write!(50);
    expect(on.ok()).toBe(true);
  });

  it("numbers from texts, a text that is no number faults the option", () => {
    const text = state.ok_w("12");
    states.add("text", "Text", "", text);
    const element = show(
      canvas.widget(definition, { x: canvas.link(PATH("text")) }),
    );
    expect(element.style.left).toBe("12px");
    text.set_ok("abc");
    expect(element.faults.map((fault) => fault.nice)).toContain(
      "Value can not be converted",
    );
  });

  it("texts with String and booleans with Boolean", () => {
    states.add("number", "Number", "", state.ok(5));
    const element = show(
      canvas.widget(definition, {
        text: canvas.link(PATH("number")),
        shown: canvas.link(PATH("number")),
      }),
    );
    expect(element.textContent).toBe("5");
    expect(element.shown).toBe(true);
  });
});

const row = (editor: HTMLElement, name: string) =>
  [...editor.querySelectorAll("list-row")].find(
    (row) => row.querySelector("list-keyfield")!.textContent === name,
  )!;
/**Opens the properties editor of the widgets, with the General section open*/
const editor_of = (...selected: CanvasWidgetData[]) => {
  const editor = document.body.appendChild(
    canvas.properties({ owner: canvas.selection_of(made(...selected)) }),
  );
  row(editor, "General")
    .querySelector<HTMLElement>("list-keyfield .opener > div")!
    .click();
  return editor;
};
const chain = (editor: HTMLElement, name: string) =>
  row(editor, name).querySelector("canvas-linkfield") as HTMLElement;
/**The link menu open now*/
const menu = () => {
  const panels = document.querySelectorAll("composition-panel");
  return panels[panels.length - 1] as HTMLElement | undefined;
};
const button = (text: string) =>
  [...menu()!.querySelectorAll<HTMLElement>("form-button")].find(
    (e) => e.textContent === text,
  )!;
const type_path = (path: string) => {
  const input = menu()!.querySelector(
    "form-textinput input",
  ) as HTMLInputElement;
  input.value = path;
  input.dispatchEvent(new Event("change"));
};

describe("The link column of the properties editor", () => {
  it("shows a chain for options that can be written, filled when linked", () => {
    const editor = editor_of(
      canvas.widget(definition, {
        text: canvas.link(PATH("text")),
        x: state.ok(5),
        y: 3,
      }),
    );
    expect(chain(editor, "Text").classList.contains("linked")).toBe(true);
    expect(chain(editor, "Y").classList.contains("linked")).toBe(false);
    expect(chain(editor, "Y").classList.contains("none")).toBe(false);
    expect(chain(editor, "X").classList.contains("none")).toBe(true);
    //Base properties not given have a writable state too, so they can be linked
    expect(chain(editor, "Opacity").classList.contains("none")).toBe(false);
    expect(chain(editor, "Visible").classList.contains("none")).toBe(false);
  });

  it("shows the path and the value of a linked option", () => {
    states.add("text", "Text", "", state.ok("from state"));
    const editor = editor_of(
      canvas.widget(definition, { text: canvas.link(PATH("text")) }),
    );
    const field = row(editor, "Text").querySelector("canvas-linkedvalue")!;
    expect(field.textContent).toBe(PATH("text") + "from state");
  });

  it("links an option to the path given in the menu", async () => {
    const widget = canvas.widget(definition, { text: "plain" });
    const editor = editor_of(widget);
    chain(editor, "Text").click();
    await tick();
    expect(menu()).toBeDefined();
    type_path(PATH("text"));
    await tick();
    button("Link").click();
    await tick();
    const value = (widget.options.text as StateROSW<unknown>).ok();
    expect(value).toBeInstanceOf(CanvasLink);
    expect((value as CanvasLink).path).toBe(PATH("text"));
    expect((value as CanvasLink).transforms).toEqual([]);
    expect(
      row(editor, "Text").querySelector("canvas-linkedvalue"),
    ).not.toBeNull();
  });

  it("keeps the menu open without a path", async () => {
    const editor = editor_of(canvas.widget(definition, { text: "plain" }));
    chain(editor, "Text").click();
    await tick();
    button("Link").click();
    await tick();
    expect(menu()).toBeDefined();
  });

  it("shows the transforms of the link, and turns them off", async () => {
    const transforms = [canvas.linear([0, 1], [10, 50])];
    const widget = canvas.widget(definition, {
      x: canvas.link(PATH("x"), { transforms }),
    });
    const option = widget.options.x as StateROSW<unknown>;
    const editor = editor_of(widget);
    chain(editor, "X").click();
    await tick();
    button("Link").click();
    await tick();
    expect((option.ok() as CanvasLink).transforms).toEqual(transforms);
    chain(editor, "X").click();
    await tick();
    (menu()!.querySelector("form-switch") as HTMLElement).click();
    await tick();
    button("Link").click();
    await tick();
    expect((option.ok() as CanvasLink).transforms).toEqual([]);
  });

  it("unlinks keeping the value the link gives now", async () => {
    states.add("x", "X", "", state.ok(true));
    const widget = canvas.widget(definition, {
      x: canvas.link(PATH("x"), {
        transforms: [canvas.linear([0, 1], [10, 50])],
      }),
    });
    const editor = editor_of(widget);
    chain(editor, "X").click();
    await tick();
    button("Unlink").click();
    await tick();
    await tick();
    expect((widget.options.x as StateROSW<unknown>).ok()).toBe(50);
  });

  it("unlinks to the default when the link gives nothing", async () => {
    const widget = canvas.widget(definition, {
      text: canvas.link(PATH("missing")),
    });
    const editor = editor_of(widget);
    chain(editor, "Text").click();
    await tick();
    button("Unlink").click();
    await tick();
    await tick();
    expect((widget.options.text as StateROSW<unknown>).ok()).toBe("");
  });

  it("links the option of every selected widget to the same state", async () => {
    states.add("text", "Text", "", state.ok("linked"));
    const both = [
      canvas.widget(definition, { text: "one" }),
      canvas.widget(definition, { text: "two" }),
    ];
    const editor = editor_of(...both);
    chain(editor, "Text").click();
    await tick();
    type_path(PATH("text"));
    await tick();
    button("Link").click();
    await tick();
    for (const widget of both) {
      const value = (widget.options.text as StateROSW<unknown>).ok();
      expect(value).toBeInstanceOf(CanvasLink);
      expect((value as CanvasLink).path).toBe(PATH("text"));
    }
    expect(
      row(editor, "Text").querySelector("canvas-linkedvalue")!.textContent,
    ).toBe(PATH("text") + "linked");
  });

  it("unlinks every selected widget, each keeping the value its own link gives", async () => {
    states.add("a", "A", "", state.ok("from a"));
    states.add("b", "B", "", state.ok("from b"));
    const both = [
      canvas.widget(definition, { text: canvas.link(PATH("a")) }),
      canvas.widget(definition, { text: canvas.link(PATH("b")) }),
    ];
    const editor = editor_of(...both);
    chain(editor, "Text").click();
    await tick();
    button("Unlink").click();
    await tick();
    await tick();
    expect(
      both.map((widget) => (widget.options.text as StateROSW<unknown>).ok()),
    ).toEqual(["from a", "from b"]);
  });
});
