import state, { type StateROSW } from "@chocbite/ts-lib/state";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { canvas, type CanvasPage, type CanvasWidget } from "..";
import { WidgetBase } from "../widget";
import { define_element } from "#base";

class IdWidget extends WidgetBase {
  static element_name() {
    return "idwidget";
  }
}
define_element(IdWidget);

const group = canvas.widgets.group("idtest", "Id test", "");
const definition = group.add("box", "Box", "", {
  create: (options) => IdWidget.create(options),
});
afterAll(() => group.remove());

afterEach(() => {
  document.body.replaceChildren();
});

/**A local writable state, which can be set directly*/
type StateOkW<T> = ReturnType<typeof state.ok_w<T>>;

const tick = () => new Promise((resolve) => setTimeout(resolve));

const id_of = (widget: CanvasWidget) =>
  (widget.options as Record<string, StateROSW<unknown>>).id.ok();

/**Shows the widgets in a viewport, which gives them their ids*/
const show = async (widgets: CanvasWidget[]) => {
  const page: CanvasPage = { widgets: state.ok_w(widgets) };
  document.body.appendChild(canvas.viewport({ page, edit: true }));
  await tick();
  return page;
};

describe("Widget ids", () => {
  it("are a base property in General, a text without a link", () => {
    const [key, property] = canvas.widget_properties({
      create: () => {
        throw new Error();
      },
    })[0];
    expect(key).toBe("id");
    expect(property).toMatchObject({
      kind: "text",
      name: "ID",
      default: "",
      section: "General",
      linkable: false,
    });
  });

  it("are given by the page as the name of the widget and the first free number", async () => {
    const widgets = [
      canvas.widget(definition, {}),
      canvas.widget(definition, {}),
      canvas.widget(definition, { id: "Box-1" }),
    ];
    await show(widgets);
    expect(widgets.map(id_of)).toEqual(["Box-2", "Box-3", "Box-1"]);
  });

  it("are unique on the page, a later widget with a taken id gets a new one", async () => {
    const widgets = [
      canvas.widget(definition, { id: "Pump" }),
      canvas.widget(definition, { id: "Pump" }),
    ];
    const page = await show(widgets);
    expect(widgets.map(id_of)).toEqual(["Pump", "Box-1"]);
    //An id taken by a change in code or a widget added later is given a new one too
    (widgets[1].options.id as StateOkW<string>).set_ok("Pump");
    const added = canvas.widget(definition, { id: "Pump" });
    (page.widgets as StateOkW<CanvasWidget[]>).set_ok([...widgets, added]);
    await tick();
    expect([...widgets, added].map(id_of)).toEqual(["Pump", "Box-1", "Box-2"]);
  });

  it("are refused by the properties editor when taken by another widget of the page", async () => {
    const widgets = [
      canvas.widget(definition, { id: "Pump" }),
      canvas.widget(definition, { id: "Valve" }),
    ];
    await show(widgets);
    const editor = document.body.appendChild(
      canvas.properties({ selected: [widgets[1]] }),
    );
    const general = [...editor.querySelectorAll("list-row")].find(
      (row) => row.querySelector("list-keyfield")!.textContent === "General",
    )!;
    general.querySelector<HTMLElement>("list-keyfield .opener > div")!.click();
    const row = [...editor.querySelectorAll("list-row")].find(
      (row) => row.querySelector("list-keyfield")!.textContent === "ID",
    )!;
    expect(row.querySelector("canvas-linkfield")!.classList).toContain("none");
    const input = row.querySelector("input")!;
    const type = async (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event("change"));
      await tick();
    };
    await type("Pump");
    expect(id_of(widgets[1])).toBe("Valve");
    await type("Tank");
    expect(id_of(widgets[1])).toBe("Tank");
  });
});
