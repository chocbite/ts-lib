import { settings_init } from "#settings";
import depot from "@chocbite/ts-lib/depot";
import state, { type StateOrVal, type StateROSW } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import {
  canvas,
  type CanvasPage,
  type CanvasWidget,
  type WidgetBaseOptions,
  type WidgetDefinition,
} from ".";

describe("Canvas module", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("registers the widgets type in the depot", () => {
    expect(canvas.widgets.path).toBe("/widgets");
    const found = depot.get("/widgets").get();
    expect(found.ok && found.value).toBe(canvas.widgets);
  });

  it("creates a viewport with and without a page", () => {
    const empty = canvas.viewport();
    expect(empty.localName).toBe("canvas-viewport");
    expect(empty.querySelector("canvas-page")).toBeNull();
    const viewport = canvas.viewport({ page: {}, edit: true });
    expect(viewport.querySelector("canvas-page")).not.toBeNull();
    expect(viewport.hasAttribute("edit")).toBe(true);
  });

  it("makes widgets from definitions in the depot, typed by them", () => {
    const group = canvas.widgets.group("indextest", "Index test", "");
    try {
      const definition = group.add("box", "Box", "", {
        create: () => {
          throw new Error("not made in this test");
        },
      });
      const widget = canvas.widget(definition, { x: 1 });
      const typed = group.add("typed", "Typed", "", {
        create: (options: WidgetBaseOptions & { color?: string }) => {
          throw new Error(String(options.color));
        },
      });
      canvas.widget(typed, { color: "red" });
      // @ts-expect-error the options are checked against the definition
      canvas.widget(typed, { color: 1 });
      //An initial value is made a writable state, shared by every viewport
      expect(widget.widget).toBe("/widgets/indextest/box");
      const x = widget.options.x as StateROSW<number>;
      expect(x.ok()).toBe(1);
      expect(x.writable).toBe(true);
      const given = state.ok(2);
      expect(canvas.widget(definition, { x: given }).options.x).toBe(given);
    } finally {
      group.remove();
    }
  });

  it("gives every widget a writable state for every base property, at the default when not given", () => {
    const group = canvas.widgets.group("basetest", "Base test", "");
    try {
      const definition = group.add("box", "Box", "", {
        create: () => {
          throw new Error("not made in this test");
        },
        size: { width: 30, height: 40 },
      });
      const values = (widget: CanvasWidget) =>
        Object.fromEntries(
          ["x", "y", "width", "height", "rotation", "opacity", "visible"].map(
            (key) => {
              const option = (
                widget.options as Record<string, StateROSW<unknown> | undefined>
              )[key];
              return [
                key,
                option?.writable ? option.ok() : "no writable state",
              ];
            },
          ),
        );
      const defaults = {
        x: 0,
        y: 0,
        width: 30,
        height: 40,
        rotation: 0,
        opacity: 1,
        visible: true,
      };
      expect(values(canvas.widget(definition, {}))).toEqual(defaults);
      expect(values(canvas.widget(definition, { x: 5, opacity: 0.5 }))).toEqual(
        { ...defaults, x: 5, opacity: 0.5 },
      );
      //Loaded pages too, like pages stored before a base property was added
      const loaded = canvas.page_from_json({
        widgets: [{ widget: definition.path, options: { x: 5 } }],
      });
      if (!loaded.some) throw new Error("not loaded");
      const [widget] = (loaded.value.widgets as StateROSW<CanvasWidget[]>).ok();
      expect(values(widget)).toEqual({ ...defaults, x: 5 });
    } finally {
      group.remove();
    }
  });

  it("stores a page state with settings and loads it again", async () => {
    const group = settings_init("@test/canvas_page", "1.0.0", "Pages", "");
    const key = "@test/canvas_page/page";
    try {
      const x = state.ok_w(10);
      const page = state.ok_w<CanvasPage>({
        width: 800,
        widgets: state.ok_w<CanvasWidget[]>([
          {
            widget: "/widgets/basic/box",
            options: { x, width: state.ok_w(20) },
          },
        ]),
      });
      group.register_debounced("page", "Page", "", page, 5);
      x.set_ok(30);
      await new Promise((r) => setTimeout(r, 30));
      const loaded = group.get("page", {}, canvas.page_from_json).value;
      expect(await (loaded.width as StateROSW<number>)).toEqual(
        expect.objectContaining({ value: 800 }),
      );
      const widgets = (loaded.widgets as StateROSW<CanvasWidget[]>).ok();
      expect(widgets[0].widget).toBe("/widgets/basic/box");
      const loaded_x = widgets[0].options.x as StateROSW<number>;
      expect(loaded_x.ok()).toBe(30);
      expect(loaded_x.writable).toBe(true);
    } finally {
      localStorage.removeItem(key);
    }
  });

  it("loads the id and background of a page, an empty id and white when not saved", () => {
    const value = (page: CanvasPage, key: "id" | "background") =>
      (page[key] as StateROSW<string>).ok();
    const saved = canvas.page_from_json({ id: "Main", background: "#123456" });
    if (!saved.some) throw new Error("not loaded");
    expect([
      value(saved.value, "id"),
      value(saved.value, "background"),
    ]).toEqual(["Main", "#123456"]);
    const old = canvas.page_from_json({});
    if (!old.some) throw new Error("not loaded");
    expect([value(old.value, "id"), value(old.value, "background")]).toEqual([
      "",
      "#ffffff",
    ]);
    expect(canvas.page_from_json({ background: 5 }).some).toBe(false);
    expect(canvas.page_from_json({ id: 5 }).some).toBe(false);
  });

  it("gives none for JSON that is not a page", () => {
    for (const json of [
      null,
      3,
      { width: "wide" },
      { widgets: {} },
      { widgets: [{ options: {} }] },
      { widgets: [{ widget: "/a", options: [] }] },
    ])
      expect(canvas.page_from_json(json).some).toBe(false);
    expect(canvas.page_from_json({}).some).toBe(true);
  });

  describe("properties", () => {
    type Options = WidgetBaseOptions & {
      size?: StateOrVal<number>;
      label?: StateOrVal<string>;
      shown?: StateOrVal<boolean>;
      align?: StateOrVal<"left" | "right">;
    };

    it("types the properties by the options of the definition", () => {
      //Only type checked
      const check = (): WidgetDefinition<Options> => ({
        create: () => {
          throw new Error();
        },
        properties: {
          size: { kind: "number", name: "Size", default: 1, min: 0 },
          label: { kind: "color", name: "Label", default: "red" },
          shown: { kind: "boolean", name: "Shown", default: true },
          align: {
            kind: "enum",
            name: "Align",
            default: "left",
            list: { left: { name: "Left" }, right: { name: "Right" } },
          },
        },
      });
      const create = () => {
        throw new Error();
      };
      const wrong = [
        canvas.definition<Options>({
          create,
          // @ts-expect-error a number option needs a number property
          properties: { size: { kind: "text", name: "Size", default: "1" } },
        }),
        canvas.definition<Options>({
          create,
          properties: {
            align: {
              kind: "enum",
              name: "Align",
              // @ts-expect-error an enum default must be in the list
              default: "up",
              list: { left: { name: "L" }, right: { name: "R" } },
            },
          },
        }),
        canvas.definition<Options>({
          create,
          properties: {
            // @ts-expect-error position, size and rotation are added by canvas
            x: { kind: "number", name: "X", default: 0 },
          },
        }),
      ];
      expect([check, ...wrong]).toHaveLength(4);
    });

    it("lists position, size, rotation, opacity and visible first, then those of the definition", () => {
      const names = canvas
        .widget_properties({
          create: () => {
            throw new Error();
          },
          size: { width: 30, height: 40 },
          properties: { label: { kind: "text", name: "Label", default: "" } },
        })
        .map(([key, property]) => [key, property.default]);
      expect(names).toEqual([
        ["id", ""],
        ["x", 0],
        ["y", 0],
        ["width", 30],
        ["height", 40],
        ["rotation", 0],
        ["opacity", 1],
        ["visible", true],
        ["label", ""],
      ]);
    });

    it("puts the base properties in the General section", () => {
      const sections = canvas
        .widget_properties({
          create: () => {
            throw new Error();
          },
          properties: { label: { kind: "text", name: "Label", default: "" } },
        })
        .map(([key, property]) => [key, property.section]);
      expect(sections).toEqual([
        ["id", "General"],
        ["x", "General"],
        ["y", "General"],
        ["width", "General"],
        ["height", "General"],
        ["rotation", "General"],
        ["opacity", "General"],
        ["visible", "General"],
        ["label", undefined],
      ]);
    });

    it("has no limits on rotation, the transformer keeps it in a turn", () => {
      const [, rotation] = canvas
        .widget_properties({
          create: () => {
            throw new Error();
          },
          properties: {},
        })
        .find(([key]) => key === "rotation")!;
      expect(rotation).toMatchObject({ kind: "number", unit: "°" });
      expect(rotation).not.toHaveProperty("min");
      expect(rotation).not.toHaveProperty("max");
    });

    it("makes a new widget with writable states at the defaults", async () => {
      const group = canvas.widgets.group("proptest", "", "");
      try {
        const definition = group.add(
          "box",
          "Box",
          "",
          canvas.definition({
            create: (options: Options) => {
              throw new Error(`not made, ${Object.keys(options).length}`);
            },
            properties: {
              label: { kind: "text", name: "Label", default: "hi" },
            },
          }),
        );
        const made = await canvas.new_widget(definition, { x: 5, y: 6 });
        const widget = made.unwrap();
        expect(widget.widget).toBe("/widgets/proptest/box");
        const value = (key: keyof Options) =>
          (widget.options[key] as StateROSW<unknown>).ok();
        expect([
          value("x"),
          value("y"),
          value("width"),
          value("label"),
        ]).toEqual([5, 6, 100, "hi"]);
        expect((widget.options.label as StateROSW<string>).writable).toBe(true);
      } finally {
        group.remove();
      }
    });
  });

  describe("select_widget", () => {
    const panel = () => document.querySelector("depot-selector")!;
    const button = (text: string) =>
      [...panel().querySelectorAll<HTMLElement>("form-button")].find(
        (b) => b.textContent === text,
      )!;
    afterEach(() => {
      for (const p of document.querySelectorAll("composition-panel"))
        (p as HTMLElement & { close(): void }).close();
    });

    it("gives a new widget for the picked definition at the position", async () => {
      const group = canvas.widgets.group("seltest", "Select test", "");
      try {
        group.add(
          "box",
          "Selectable box",
          "",
          canvas.definition({
            create: (
              options: WidgetBaseOptions & { text?: StateOrVal<string> },
            ) => {
              throw new Error(`not made, ${Object.keys(options).length}`);
            },
            size: { width: 30, height: 40 },
            properties: { text: { kind: "text", name: "Text", default: "hi" } },
          }),
        );
        const result = canvas.select_widget({ at: { x: 10, y: 20 } });
        expect(
          document.querySelector("composition-panel .title")!.textContent,
        ).toBe("Add widget");
        const input = panel().querySelector("input")!;
        input.value = "Selectable";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        const row = [...panel().querySelectorAll<HTMLElement>("list-row")].find(
          (r) =>
            r.querySelector("list-keyfield")!.textContent === "Selectable box",
        )!;
        //The fields of a row take the click that selects it
        row.querySelector<HTMLElement>("list-keyfield")!.click();
        button("Select").click();
        const [widget] = await result;
        expect(widget.widget).toBe("/widgets/seltest/box");
        const value = (key: string) =>
          (
            widget.options[key as keyof WidgetBaseOptions] as StateROSW<unknown>
          ).ok();
        expect([
          value("x"),
          value("y"),
          value("width"),
          value("height"),
          value("text"),
        ]).toEqual([10, 20, 30, 40, "hi"]);
      } finally {
        group.remove();
      }
    });

    it("gives no widgets when cancelled", async () => {
      const result = canvas.select_widget();
      button("Cancel").click();
      expect(await result).toEqual([]);
    });
  });
});
