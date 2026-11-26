import state, { type StateROSW } from "@chocbite/ts-lib/state";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { canvas, type CanvasWidget, type CanvasWidgetData } from "..";
import { GROUP_DEFINITION } from "../group_widget";
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

const id_of = (widget: CanvasWidgetData) =>
  (widget.options as Record<string, StateROSW<unknown>>).id.ok();

/**Shows the widgets in a viewport, the page makes their widgets, which gives them their ids*/
const show = async (widgets: CanvasWidgetData[]) => {
  const page = canvas.page({ widgets: state.ok_w(widgets) });
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

  it("are given by the page as the id the widget is registered with and the first free number", async () => {
    const widgets = [
      canvas.widget(definition, {}),
      canvas.widget(definition, {}),
      canvas.widget(definition, { id: "box-1" }),
    ];
    await show(widgets);
    expect(widgets.map(id_of)).toEqual(["box-2", "box-3", "box-1"]);
  });

  it("are unique on the page, a later widget with a taken id gets a new one", async () => {
    const widgets = [
      canvas.widget(definition, { id: "Pump" }),
      canvas.widget(definition, { id: "Pump" }),
    ];
    const page = await show(widgets);
    expect(widgets.map(id_of)).toEqual(["Pump", "box-1"]);
    //Writing a taken id to the id state of a widget is refused
    expect((await page.widget_of(widgets[1]).id!.write!("Pump")).ok).toBe(false);
    expect(id_of(widgets[1])).toBe("box-1");
    //A widget added later with a taken id is given a new one
    const added = canvas.widget(definition, { id: "Pump" });
    (page.widgets as StateOkW<CanvasWidgetData[]>).set_ok([...widgets, added]);
    await tick();
    expect([...widgets, added].map(id_of)).toEqual(["Pump", "box-1", "box-2"]);
  });

  /**The input of the ID field of a properties editor showing the widget of the page*/
  const id_input = (widget: CanvasWidget) => {
    const editor = document.body.appendChild(
      canvas.properties({
        owner: widget,
      }),
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
    return async (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event("change"));
      await tick();
    };
  };

  it("are refused by the properties editor when taken by another widget of the level, found in the page given", async () => {
    const group = canvas.widget(GROUP_DEFINITION, {
      id: "Group",
      widgets: [canvas.widget(definition, { id: "Inner" })],
    });
    const widgets = [
      canvas.widget(definition, { id: "Pump" }),
      canvas.widget(definition, { id: "Valve" }),
      group,
    ];
    //No viewport shows the page, the widget is made by its page, which it checks its id against
    const page = canvas.page({ widgets: state.ok_w(widgets) });
    const type = id_input(page.widget_of(widgets[1]));
    await type("Pump");
    expect(id_of(widgets[1])).toBe("Valve");
    await type("Tank");
    expect(id_of(widgets[1])).toBe("Tank");
    //The group is on the level, the widget in it is not
    await type("Group");
    expect(id_of(widgets[1])).toBe("Tank");
    await type("Inner");
    expect(id_of(widgets[1])).toBe("Inner");
  });

  it("are given anew by the properties editor when emptied", async () => {
    const widgets = [
      canvas.widget(definition, { id: "Pump" }),
      canvas.widget(definition, { id: "Valve" }),
    ];
    const page = canvas.page({ widgets: state.ok_w(widgets) });
    const type = id_input(page.widget_of(widgets[1]));
    await type("");
    expect(id_of(widgets[1])).toBe("box-1");
  });
});
