import { define_element, input_key, type InputOptions } from "#base";
import depot from "@chocbite/ts-lib/depot";
import state, {
  type StateOrVal,
  type StateROS,
  type StateROSW,
} from "@chocbite/ts-lib/state";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  canvas,
  type CanvasPageData,
  type CanvasWidget,
  type CanvasWidgetData,
} from "..";
import { made_one } from "./made";
import { CanvasLink } from "../link";
import type { WidgetSlot } from "../slot";
import { WidgetBase, type WidgetBaseOptions } from "../widget";

const LINK_WIDGET = {
  text: input_key<StateOrVal<string>>(),
};
type LinkWidgetOptions = WidgetBaseOptions & InputOptions<typeof LINK_WIDGET>;

/**Shows its text, or the nice text of its error*/
class LinkWidget extends WidgetBase {
  static element_name() {
    return "linkwidget";
  }
  set(options: LinkWidgetOptions): this {
    super.set(options);
    this.set_input(LINK_WIDGET.text, options.text, (text) => {
      this.textContent = text.ok ? text.value : text.error.nice;
    });
    return this;
  }
}
define_element(LinkWidget);

const widgets = canvas.widgets.group("linktest", "Link test", "");
const definition = widgets.add(
  "text",
  "Text",
  "",
  canvas.definition({
    create: (options: LinkWidgetOptions) => LinkWidget.create(options),
    properties: { text: { kind: "text", name: "Text", default: "" } },
  }),
);
const states = depot.states.group("canvaslinktest", "Canvas link test", "");
afterAll(() => {
  widgets.remove();
  states.remove();
});

afterEach(() => {
  document.body.replaceChildren();
  //A registered group always has a children state
  const children = states.children as StateROS<readonly { remove(): void }[]>;
  for (const child of [...children.ok()]) child.remove();
});

const TEXT = "/states/canvaslinktest/text";
const X = "/states/canvaslinktest/x";

/**Shows the widget in a viewport and gives its slot*/
const show = (widget: CanvasWidgetData) => {
  const viewport = document.body.appendChild(
    canvas.viewport({ page: canvas.page({ widgets: [widget] }) }),
  );
  return viewport.querySelector("canvas-slot") as WidgetSlot;
};
const element = (slot: WidgetSlot) => slot.element as LinkWidget;
/**The value of an option as the widget gets it now, undefined while it has none*/
const value_of = (widget: CanvasWidget, key: string): unknown => {
  const value = widget.value(key)!.get!();
  return value.ok ? value.value : undefined;
};

describe("Links to depot states", () => {
  it("are typed by the option they are given to", () => {
    canvas.widget(definition, {
      text: canvas.link(TEXT),
      x: canvas.link(X),
    });
    canvas.widget(definition, {
      // @ts-expect-error a link to a number state for a text option
      text: canvas.link<number>(X),
    });
    const entry = states.add("text", "Text", "", state.ok("from entry"));
    expect(canvas.link(entry).path).toBe(TEXT);
  });

  it("give the widget the registered state", () => {
    const text = state.ok_w("linked");
    states.add("text", "Text", "", text);
    const slot = show(canvas.widget(definition, { text: canvas.link(TEXT) }));
    expect(element(slot).textContent).toBe("linked");
    text.set_ok("changed");
    expect(element(slot).textContent).toBe("changed");
  });

  it("fault only their option until the state is registered, without making the widget again", () => {
    const slot = show(
      canvas.widget(definition, { text: canvas.link(TEXT), x: 7 }),
    );
    const made = element(slot);
    expect(made).toBeInstanceOf(LinkWidget);
    expect(made.textContent).toBe(depot.errors.NOT_REGISTERED.description);
    expect(made.style.left).toBe("7px");
    const first = states.add("text", "Text", "", state.ok("first"));
    expect(made.textContent).toBe("first");
    first.remove();
    expect(made.textContent).toBe(depot.errors.NOT_REGISTERED.description);
    states.add("text", "Text", "", state.ok("second"));
    expect(made.textContent).toBe("second");
    expect(element(slot)).toBe(made);
  });

  it("only link to the states type", () => {
    const slot = show(
      canvas.widget(definition, { text: canvas.link(definition.path) }),
    );
    expect(element(slot).textContent).toBe("Not a state");
  });

  it("switch with the state of the option, between a value and a link", () => {
    states.add("text", "Text", "", state.ok("linked"));
    const text = state.ok_w<string | CanvasLink<string>>("value");
    const slot = show(canvas.widget(definition, { text }));
    const made = element(slot);
    expect(made.textContent).toBe("value");
    text.set_ok(canvas.link(TEXT));
    expect(made.textContent).toBe("linked");
    text.set_ok("again a value");
    expect(made.textContent).toBe("again a value");
    expect(element(slot)).toBe(made);
  });

  it("write a linked writable state and lock for a read only one", () => {
    const x = state.ok_w(5);
    states.add("x", "X", "", x);
    states.add("y", "Y", "", state.ok(7));
    const slot = show(canvas.widget(definition, {
      x: canvas.link(X),
      y: canvas.link("/states/canvaslinktest/y"),
    }));
    const widget = slot.widget;
    expect(widget.value("x")!.writable).toBe(true);
    expect(widget.value("y")!.writable).toBe(false);
    void widget.value("x")!.write!(40);
    expect(x.ok()).toBe(40);
    expect(element(slot).style.left).toBe("40px");
  });

  describe("linear transform", () => {
    const linear = canvas.linear([50, 100], [150, 200]);

    it("maps the value, and maps a write back", () => {
      const x = state.ok_w(75);
      states.add("x", "X", "", x);
      const slot = show(canvas.widget(definition, {
        x: canvas.link(X, { transforms: [linear] }),
      }));
      const widget = slot.widget;
      expect(element(slot).style.left).toBe("175px");
      expect(value_of(widget, "x")).toBe(175);
      x.set_ok(100);
      expect(element(slot).style.left).toBe("200px");
      void widget.value("x")!.write!(160);
      expect(x.ok()).toBe(60);
    });

    it("locks when it can not be reversed, or the linked state is read only", () => {
      states.add("x", "X", "", state.ok_w(75));
      states.add("y", "Y", "", state.ok(75));
      const slot = show(canvas.widget(definition, {
        x: canvas.link(X, {
          transforms: [canvas.linear([50, 100], [150, 150])],
        }),
        y: canvas.link("/states/canvaslinktest/y", { transforms: [linear] }),
      }));
      const widget = slot.widget;
      expect(element(slot).style.left).toBe("150px");
      expect(widget.value("x")!.writable).toBe(false);
      expect(widget.value("y")!.writable).toBe(false);
    });

    it("faults the option for a value that is not a number", () => {
      states.add("text", "Text", "", state.ok("words"));
      const slot = show(
        canvas.widget(definition, {
          text: canvas.link(TEXT, { transforms: [linear] }),
        }),
      );
      expect(element(slot).textContent).toBe("Value can not be transformed");
    });
  });

  describe("saving", () => {
    it("saves a link as a $link object and loads it again", async () => {
      const transforms = [canvas.linear([0, 10], [0, 100])];
      const page: CanvasPageData = {
        widgets: [
          canvas.widget(definition, {
            x: canvas.link(X, { transforms }),
            text: canvas.link(TEXT),
            y: 3,
          }),
        ],
      };
      const json: unknown = JSON.parse(await state.ok(page).to_json());
      //The other base properties are saved too, at their defaults
      expect(json).toEqual({
        widgets: [
          {
            widget: definition.path,
            options: {
              x: { $link: { kind: "depot", path: X, transforms } },
              text: { $link: { kind: "depot", path: TEXT } },
              y: 3,
              id: "",
              width: 100,
              height: 100,
              rotation: 0,
              opacity: 1,
              visible: true,
            },
          },
        ],
      });
      const loaded = canvas.page_from_json(json);
      if (!loaded.some) throw new Error("not loaded");
      const options = (
        loaded.value.widgets as StateROSW<CanvasWidget[]>
      ).ok()[0].options as Record<string, StateROSW<unknown>>;
      const x = options.x.ok() as CanvasLink;
      expect(x).toBeInstanceOf(CanvasLink);
      expect(x.path).toBe(X);
      expect(x.transforms).toEqual(transforms);
      expect(options.x.writable).toBe(true);
      expect(options.y.ok()).toBe(3);
    });

    it("gives none for a broken link", () => {
      for (const link of [
        "/states/a",
        { kind: "other", path: "/states/a" },
        { kind: "depot" },
        { kind: "depot", path: "/states/a", transforms: {} },
        { kind: "depot", path: "/states/a", transforms: [{ kind: "linear" }] },
      ])
        expect(
          canvas.page_from_json({
            widgets: [{ widget: "/a", options: { x: { $link: link } } }],
          }).some,
        ).toBe(false);
    });

    it("keeps a transform of an unknown kind, it faults the option", () => {
      states.add("text", "Text", "", state.ok("words"));
      const loaded = canvas.page_from_json({
        widgets: [
          {
            widget: definition.path,
            options: {
              text: {
                $link: {
                  kind: "depot",
                  path: TEXT,
                  transforms: [{ kind: "new" }],
                },
              },
            },
          },
        ],
      });
      if (!loaded.some) throw new Error("not loaded");
      const slot = show(
        (loaded.value.widgets as StateROSW<CanvasWidget[]>).ok()[0],
      );
      expect(element(slot).textContent).toBe("Value can not be transformed");
    });
  });

  it("show their path in the properties editor, and follow switching", () => {
    const text = state.ok_w<string | CanvasLink<string>>(canvas.link(TEXT));
    const editor = document.body.appendChild(
      canvas.properties({
        owner: made_one(canvas.widget(definition, { text })),
      }),
    );
    const field = () =>
      [...editor.querySelectorAll("list-row")]
        .find(
          (row) => row.querySelector("list-keyfield")!.textContent === "Text",
        )!
        .querySelector("list-nodefield")!;
    expect(field().querySelector("canvas-linkedvalue")!.textContent).toContain(
      TEXT,
    );
    text.set_ok("plain");
    expect(field().querySelector("canvas-linkedvalue")).toBeNull();
    expect(field().querySelector("input")!.value).toBe("plain");
  });
});
