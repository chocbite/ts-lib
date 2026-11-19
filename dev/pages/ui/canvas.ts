import {
  define_element,
  input_key,
  type InputOptions,
} from "@chocbite/ts-lib-ui/base";
import canvas, {
  WidgetBase,
  type CanvasPage,
  type CanvasLink,
  type CanvasWidget,
  type WidgetBaseOptions,
  type WidgetOptionsInput,
} from "@chocbite/ts-lib-ui/canvas";
import form from "@chocbite/ts-lib-ui/form";
import depot from "@chocbite/ts-lib/depot";
import { settings_init } from "@chocbite/ts-lib-ui/settings";
import state, { type StateOrVal, type StateROSW } from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../helpers";

//      _____  ______ ______ _____ _   _ _____ _______ _____ ____  _   _  _____
//     |  __ \|  ____|  ____|_   _| \ | |_   _|__   __|_   _/ __ \| \ | |/ ____|
//     | |  | | |__  | |__    | | |  \| | | |    | |    | || |  | |  \| | (___
//     | |  | |  __| |  __|   | | | . ` | | |    | |    | || |  | | . ` |\___ \
//     | |__| | |____| |     _| |_| |\  |_| |_   | |   _| || |__| | |\  |____) |
//     |_____/|______|_|    |_____|_| \_|_____|  |_|  |_____\____/|_| \_|_____/

/**Inputs of the dev box*/
const DEV_BOX = {
  /**Background color*/
  color: input_key<StateOrVal<string>>(),
  /**Text in the box*/
  text: input_key<StateOrVal<string>>(),
};
type DevBoxOptions = WidgetBaseOptions & InputOptions<typeof DEV_BOX>;

/**Colored box with a label, does not stretch, so the text keeps its size when resized*/
class DevBox extends WidgetBase {
  static element_name() {
    return "devbox";
  }
  constructor() {
    super();
    this.style.display = "flex";
    this.style.alignItems = "center";
    this.style.justifyContent = "center";
    this.style.fontFamily = "sans-serif";
    this.style.color = "white";
  }
  set(options: DevBoxOptions): this {
    super.set(options);
    this.set_input(DEV_BOX.color, options.color, (color) => {
      this.style.background = color.ok ? color.value : "grey";
    });
    this.set_input(DEV_BOX.text, options.text, (text) => {
      this.textContent = text.ok ? text.value : "⚠";
    });
    return this;
  }
}
define_element(DevBox);

/**Inputs of the dev graphic*/
const DEV_GRAPHIC = {
  /**Fill of the circle*/
  color: input_key<StateOrVal<string>>(),
};
type DevGraphicOptions = WidgetBaseOptions & InputOptions<typeof DEV_GRAPHIC>;

/**64 x 64 graphic that stretches to the widget size*/
class DevGraphic extends WidgetBase {
  static element_name() {
    return "devgraphic";
  }
  #circle = this.appendChild(document.createElement("div"));
  constructor() {
    super();
    Object.assign(this.#circle.style, {
      boxSizing: "border-box",
      width: "64px",
      height: "64px",
      borderRadius: "50%",
      border: "4px solid black",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "sans-serif",
      fontSize: "24px",
      color: "black",
    });
    this.#circle.textContent = "A";
  }
  protected original_size() {
    return { width: 64, height: 64 };
  }
  set(options: DevGraphicOptions): this {
    super.set(options);
    this.set_input(DEV_GRAPHIC.color, options.color, (color) => {
      this.#circle.style.background = color.ok ? color.value : "grey";
    });
    return this;
  }
}
define_element(DevGraphic);

//The definitions are registered in the widgets type of the depot, pages refer to them by path
const dev = canvas.widgets.group("dev", "Dev page", "Widgets of the dev page");
const BOX = dev.add(
  "box",
  "Box",
  "Colored box with a text",
  canvas.definition({
    create: (options: DevBoxOptions) => DevBox.create(options),
    size: { width: 160, height: 80 },
    properties: {
      text: { kind: "text", name: "Text", default: "Box" },
      color: { kind: "color", name: "Color", default: "#2980b9" },
    },
  }),
);
const GRAPHIC = dev.add(
  "graphic",
  "Graphic",
  "Circle that stretches",
  canvas.definition({
    create: (options: DevGraphicOptions) => DevGraphic.create(options),
    size: { width: 64, height: 64 },
    properties: {
      color: { kind: "color", name: "Fill", default: "#f1c40f" },
    },
  }),
);

/**Inputs of the dev label, many properties in sections*/
const DEV_LABEL = {
  text: input_key<StateOrVal<string>>(),
  size: input_key<StateOrVal<number>>(),
  bold: input_key<StateOrVal<boolean>>(),
  color: input_key<StateOrVal<string>>(),
  background: input_key<StateOrVal<string>>(),
  border: input_key<StateOrVal<string>>(),
  border_width: input_key<StateOrVal<number>>(),
  radius: input_key<StateOrVal<number>>(),
};
type DevLabelOptions = WidgetBaseOptions & InputOptions<typeof DEV_LABEL>;

/**Label with a frame, to try the sections of the properties editor*/
class DevLabel extends WidgetBase {
  static element_name() {
    return "devlabel";
  }
  constructor() {
    super();
    this.style.display = "flex";
    this.style.alignItems = "center";
    this.style.justifyContent = "center";
    this.style.fontFamily = "sans-serif";
    this.style.borderStyle = "solid";
  }
  set(options: DevLabelOptions): this {
    super.set(options);
    const css =
      (
        property:
          | "fontSize"
          | "color"
          | "background"
          | "borderColor"
          | "borderWidth"
          | "borderRadius",
        unit = "",
      ) =>
      (value: { ok: boolean; value?: unknown }) => {
        this.style[property] = value.ok ? String(value.value) + unit : "";
      };
    this.set_input(DEV_LABEL.text, options.text, (text) => {
      this.textContent = text.ok ? text.value : "⚠";
    });
    this.set_input(DEV_LABEL.size, options.size, css("fontSize", "px"));
    this.set_input(DEV_LABEL.bold, options.bold, (bold) => {
      this.style.fontWeight = bold.ok && bold.value ? "bold" : "";
    });
    this.set_input(DEV_LABEL.color, options.color, css("color"));
    this.set_input(DEV_LABEL.background, options.background, css("background"));
    this.set_input(DEV_LABEL.border, options.border, css("borderColor"));
    this.set_input(
      DEV_LABEL.border_width,
      options.border_width,
      css("borderWidth", "px"),
    );
    this.set_input(DEV_LABEL.radius, options.radius, css("borderRadius", "px"));
    return this;
  }
}
define_element(DevLabel);

const LABEL = dev.add(
  "label",
  "Label",
  "Text with a frame, its properties are in sections",
  canvas.definition({
    create: (options: DevLabelOptions) => DevLabel.create(options),
    size: { width: 200, height: 60 },
    properties: {
      text: { kind: "text", name: "Text", default: "Label" },
      size: {
        kind: "number",
        name: "Size",
        default: 20,
        min: 1,
        unit: "px",
        section: "Font",
      },
      bold: { kind: "boolean", name: "Bold", default: false, section: "Font" },
      color: {
        kind: "color",
        name: "Color",
        default: "#000000",
        section: "Font",
      },
      background: {
        kind: "color",
        name: "Background",
        default: "#ecf0f1",
        section: "Frame",
      },
      border: {
        kind: "color",
        name: "Border",
        default: "#2c3e50",
        section: "Frame",
      },
      border_width: {
        kind: "number",
        name: "Border width",
        default: 2,
        min: 0,
        unit: "px",
        section: "Frame",
      },
      radius: {
        kind: "number",
        name: "Corner radius",
        default: 6,
        min: 0,
        unit: "px",
        section: "Frame",
      },
    },
  }),
);

/**Writable states for the place of a widget, so every viewport follows a change*/
const place = (
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
) => ({
  x: state.ok_w(x),
  y: state.ok_w(y),
  width: state.ok_w(width),
  height: state.ok_w(height),
  rotation: state.ok_w(rotation),
});
type Place = ReturnType<typeof place>;

//canvas.widget makes initial values writable states, so every viewport shares them and the properties editor changes them
const box_widget = (options: WidgetOptionsInput<DevBoxOptions>) =>
  canvas.widget(BOX, options);
const graphic_widget = (options: WidgetOptionsInput<DevGraphicOptions>) =>
  canvas.widget(GRAPHIC, options);

/**The widgets of the old trial, for an 800 x 600 page, with writable states*/
const trial_widgets = (): CanvasWidget[] => [
  box_widget({
    color: "#2980b9",
    text: "Small box",
    ...place(20, 20, 160, 80),
  }),
  box_widget({
    color: "#27ae60",
    text: "Wide box, text not stretched",
    ...place(20, 120, 400, 40),
  }),
  box_widget({
    color: "#8e44ad",
    text: "Rotated 45",
    ...place(20, 220, 160, 80, 45),
  }),
  graphic_widget({ color: "#f1c40f", ...place(300, 300, 64, 64) }),
  graphic_widget({ color: "#f1c40f", ...place(400, 300, 128, 64) }),
  graphic_widget({ color: "#f1c40f", ...place(560, 300, 64, 128) }),
  graphic_widget({ color: "#f1c40f", ...place(300, 450, 256, 64, 30) }),
];

/**Number inputs bound to the states of a place, like a properties editor will be*/
const place_inputs = (parent: HTMLElement, name: string, p: Place) => {
  const line = row(parent);
  line.append(name + ":");
  for (const key of ["x", "y", "width", "height", "rotation"] as const) {
    const input = form.number_input({ value: p[key] });
    input.style.width = "6rem";
    line.append(key, input);
  }
};

/**A viewport filling a box*/
const viewport_in = (
  parent: HTMLElement,
  label: string,
  size: { width: string; height: string },
  page: StateOrVal<CanvasPage | undefined>,
  edit = false,
  selected?: StateROSW<CanvasWidget[]>,
) => {
  const vp = canvas.viewport({ page, edit, selected });
  vp.style.width = "100%";
  vp.style.height = "100%";
  box(parent, label, size).appendChild(vp);
  return vp;
};

//     _________          ______
//    |__   __\ \        / / __ \
//       | |   \ \  /\  / / |  | |
//       | |    \ \/  \/ /| |  | |
//       | |     \  /\  / | |__| |
//       |_|      \/  \/   \____/
{
  const sec = section(
    "One page, two viewports",
    "Two editors, an outline and a properties editor on one page and selection. Click, ctrl or shift click, or drag a rectangle on the page to select. Drag the box to move, resize and rotate. Right click for menus. In a focused editor or outline: Ctrl+A, Ctrl+X, Ctrl+C, Ctrl+V and Delete. The buttons change the widgets and page size, see the canvas README for the details",
  );
  const width = state.ok_w(800);
  const height = state.ok_w(600);
  const widgets = state.ok_w<CanvasWidget[]>(trial_widgets());
  const page: CanvasPage = { width, height, widgets };
  const selected = state.ok_w<CanvasWidget[]>([]);
  const shown = sec.appendChild(document.createElement("div"));
  shown.style.fontFamily = "monospace";
  selected.sub((s) => {
    shown.textContent =
      s.ok && s.value.length
        ? "selected " + s.value.map((w) => w.widget).join(", ")
        : "nothing selected";
  }, true);
  const boxes = row(sec);
  viewport_in(
    boxes,
    "Editor",
    { width: "36rem", height: "27rem" },
    page,
    true,
    selected,
  );
  viewport_in(
    boxes,
    "Second editor",
    { width: "20rem", height: "15rem" },
    page,
    true,
    selected,
  );
  box(boxes, "Outline", {
    width: "14rem",
    height: "27rem",
    display: "flex",
  }).appendChild(canvas.outline({ page, selected })).style.flexGrow = "1";
  box(boxes, "Properties of the selected widget", {
    width: "22rem",
    height: "27rem",
    display: "flex",
  }).appendChild(canvas.properties({ selected })).style.flexGrow = "1";
  let added = 0;
  controls(sec, {
    "Add box": () => {
      added++;
      //Array instructions, so the viewports and the outline add one slot and one row
      widgets.array.push(
        box_widget({
          color: "#d35400",
          text: "Added " + added,
          ...place(40 + ((added * 30) % 400), 380, 120, 60),
        }),
      );
    },
    "Add with selector": async () => {
      const picked = await canvas.select_widget({
        mode: "multi",
        at: { x: 320, y: 260 },
      });
      widgets.array.push(...picked);
    },
    "Remove last": () => widgets.array.pop(),
    //A whole new array, the slots are reused by place
    "Reverse order": () => widgets.set_ok([...widgets.ok()].reverse()),
    "Page 800 x 600": () => {
      width.set_ok(800);
      height.set_ok(600);
    },
    "Page 400 x 800": () => {
      width.set_ok(400);
      height.set_ok(800);
    },
  });
}

//Sections, opacity and visible
{
  const sec = section(
    "Property sections, opacity and visible",
    "Select the label: its text is at the root, the rest is in the Font and Frame sections, open them with the arrow. Link an option in an open section, the section stays open. Position, size, rotation, opacity (0 to 1) and visible are the base properties of every widget, in the General section, select another widget and the open sections stay open. Every widget has a state for them, so they can be linked too. The half transparent box has opacity 0.5. The hidden box is not visible: the view shows nothing, the editor shows it faintly so it can still be selected, turn visible on in the editor and it shows in both",
  );
  const page: CanvasPage = {
    width: state.ok_w(600),
    height: state.ok_w(300),
    widgets: state.ok_w<CanvasWidget[]>([
      canvas.widget(LABEL, {
        ...place(20, 20, 240, 70),
        text: "Sectioned label",
        size: 22,
        bold: true,
        color: "#c0392b",
        background: "#fdebd0",
        border: "#c0392b",
        border_width: 3,
        radius: 12,
      }),
      box_widget({
        color: "#2980b9",
        text: "Opacity 0.5",
        opacity: 0.5,
        ...place(300, 20, 160, 80),
      }),
      box_widget({
        color: "#8e44ad",
        text: "Hidden",
        visible: false,
        ...place(300, 150, 160, 80),
      }),
    ]),
  };
  const selected = state.ok_w<CanvasWidget[]>([]);
  const boxes = row(sec);
  viewport_in(
    boxes,
    "Editor",
    { width: "30rem", height: "15rem" },
    page,
    true,
    selected,
  );
  viewport_in(boxes, "View", { width: "20rem", height: "10rem" }, page);
  box(boxes, "Properties of the selected widget", {
    width: "22rem",
    height: "27rem",
    display: "flex",
  }).appendChild(canvas.properties({ selected })).style.flexGrow = "1";
}

//Kept across reloads
{
  const sec = section(
    "Kept across reloads",
    "The page is a state registered with register_debounced of settings, stored half a second after the last change, and loaded with get and canvas.page_from_json. Move, add or remove widgets, or change them in the properties editor, and reload the browser, the page comes back as it was. The line shows how much is stored. Reset puts the trial widgets back",
  );
  const SETTINGS = settings_init(
    "dev/canvas-page",
    "1.0.0",
    "Dev canvas page",
    "Pages stored by the canvas dev page",
  );
  const default_page = (): CanvasPage => ({
    width: state.ok_w(800),
    height: state.ok_w(600),
    widgets: state.ok_w<CanvasWidget[]>(trial_widgets()),
  });
  const page = state.ok_w<CanvasPage>(
    SETTINGS.get("page", default_page(), canvas.page_from_json).value,
  );
  SETTINGS.register_debounced(
    "page",
    "Page",
    "The page of the canvas dev page",
    page,
  );
  const stored = sec.appendChild(document.createElement("div"));
  stored.style.fontFamily = "monospace";
  const show_stored = () => {
    const json = localStorage.getItem("dev/canvas-page/page");
    stored.textContent = json
      ? `stored ${json.length} characters: ${json.slice(0, 120)}…`
      : "nothing stored yet";
  };
  show_stored();
  setInterval(show_stored, 500);
  /**The widgets state of the page shown now*/
  const widgets = () =>
    page.ok().widgets as ReturnType<typeof state.ok_w<CanvasWidget[]>>;
  let added = 0;
  controls(sec, {
    "Add box": () => {
      added++;
      widgets().set_ok([
        ...widgets().ok(),
        box_widget({
          color: "#16a085",
          text: "Stored " + added,
          ...place(500, 40 + ((added * 40) % 400), 140, 50),
        }),
      ]);
    },
    "Add with selector": async () => {
      const picked = await canvas.select_widget({ at: { x: 320, y: 260 } });
      widgets().set_ok([...widgets().ok(), ...picked]);
    },
    "Remove last": () => widgets().set_ok(widgets().ok().slice(0, -1)),
    Reset: () => {
      page.set_ok(default_page());
      selected.set_ok([]);
    },
  });
  const selected = state.ok_w<CanvasWidget[]>([]);
  const boxes = row(sec);
  viewport_in(
    boxes,
    "Editor",
    { width: "36rem", height: "27rem" },
    page,
    true,
    selected,
  );
  box(boxes, "Properties of the selected widget", {
    width: "22rem",
    height: "27rem",
    display: "flex",
  }).appendChild(canvas.properties({ selected })).style.flexGrow = "1";
}

//      _____ _______    _______ ______  _____
//     / ____|__   __|/\|__   __|  ____|/ ____|
//    | (___    | |  /  \  | |  | |__  | (___
//     \___ \   | | / /\ \ | |  |  __|  \___ \
//     ____) |  | |/ ____ \| |  | |____ ____) |
//    |_____/   |_/_/    \_\_|  |______|_____/
{
  const sec = section(
    "States",
    "The place of widgets as inputs. Blue and the dashed green outline share writable states: moving or resizing either changes both, and the number inputs follow and change them too. Red is locked by read only states for x and y: it can only be rotated, as moving and resizing both change the position. Yellow was given initial values, canvas.widget makes them writable states, so it moves in both viewports too",
  );
  const shared = place(40, 40, 160, 80);
  const locked = place(300, 40, 160, 80);
  const page: CanvasPage = {
    width: 800,
    height: 400,
    widgets: [
      box_widget({ color: "#2980b9", text: "Shared", ...shared }),
      box_widget({ color: "transparent", text: "- - - - -", ...shared }),
      box_widget({
        color: "#c0392b",
        text: "Locked position",
        ...locked,
        x: locked.x.read_only,
        y: locked.y.read_only,
      }),
      box_widget({
        color: "#f1c40f",
        text: "Initial values",
        x: 560,
        y: 40,
        width: 160,
        height: 80,
      }),
    ],
  };
  place_inputs(sec, "Shared", shared);
  place_inputs(sec, "Locked", locked);
  const boxes = row(sec);
  viewport_in(boxes, "Editor", { width: "36rem", height: "18rem" }, page, true);
  viewport_in(boxes, "Preview", { width: "20rem", height: "10rem" }, page);
}

//      _____ _____ ____________  _____
//     / ____|_   _|___  /  ____|/ ____|
//    | (___   | |    / /| |__  | (___
//     \___ \  | |   / / |  __|  \___ \
//     ____) |_| |_ / /__| |____ ____) |
//    |_____/|_____/_____|______|_____/
{
  const sec = section(
    "Fit",
    "One 800 x 600 page in three viewports of different shapes outside edit mode, it should scale to fit and center with the viewport background around it",
  );
  const page: CanvasPage = {
    width: 800,
    height: 600,
    widgets: trial_widgets(),
  };
  const boxes = row(sec);
  for (const [width, height] of [
    ["16rem", "12rem"],
    ["24rem", "8rem"],
    ["8rem", "16rem"],
  ])
    viewport_in(boxes, `${width} x ${height}`, { width, height }, page);
}

//     _      _______ ______
//    | |    |__   __|  ____|
//    | |       | |  | |__
//    | |       | |  |  __|
//    | |____   | |  | |____
//    |______|  |_|  |______|
{
  const sec = section(
    "Definitions registered late",
    "The page refers to /widgets/dev/late, which is not registered yet, so an error is shown in its place. Register makes the widget appear, unregister shows the error again. Pages refer to widgets by path, so a page can be loaded before the widgets it uses",
  );
  //Written as data, canvas.widget needs the registered entry
  const late_widget: CanvasWidget<DevBoxOptions> = {
    widget: "/widgets/dev/late",
    options: {
      color: state.ok_w("#16a085"),
      text: state.ok_w("Late widget"),
      ...place(100, 60, 200, 80),
    },
  };
  const page: CanvasPage = { width: 400, height: 200, widgets: [late_widget] };
  let late: ReturnType<typeof dev.add> | undefined;
  controls(sec, {
    Register: () => {
      late ??= dev.add("late", "Late", "Registered by a button", {
        create: (options: DevBoxOptions) => DevBox.create(options),
      });
    },
    Unregister: () => {
      late?.remove();
      late = undefined;
    },
  });
  viewport_in(
    row(sec),
    "Editor",
    { width: "24rem", height: "12rem" },
    page,
    true,
  );
}

//     _      _____ _   _ _  __ _____
//    | |    |_   _| \ | | |/ // ____|
//    | |      | | |  \| | ' /| (___
//    | |      | | | . ` |  <  \___ \
//    | |____ _| |_| |\  | . \ ____) |
//    |______|_____|_| \_|_|\_\_____/
{
  const sec = section(
    "Links to depot states",
    "Options linked to states registered in depot.states, made with canvas.link. The state of an option holds a value or a link, writing it switches. Blue shows a counter that only the app changes, Switch blue text writes a value or the link to its text. Its x is linked to a writable state: drag it sideways and the number input follows, change the input and it moves. Green links its x to the same state through a linear transform from 0 to 320 into 320 to 0, so it mirrors blue, and dragging green moves blue. Red links its text to /states/dev-canvas/missing, which is not registered, so only the text shows an error until Register missing. The properties editor has a chain per option: filled when linked, pressing it opens the link menu, where Choose state picks a state of the depot, the linear transform maps its range, and Unlink keeps the value shown. Linked values are converted to the type of the option, so linking the y of green to the On state with a linear transform from 0 to 1 into 110 to 20 makes the switch move it. The line shows the page as it is saved",
  );
  const states = depot.states.group(
    "dev-canvas",
    "Canvas dev page",
    "States of the canvas dev page",
  );
  const count = state.ok_w(0);
  setInterval(() => count.set_ok(count.ok() + 1), 1000);
  states.add("count", "Count", "Counts up every second", count.read_only);
  const x = state.ok_w(40);
  states.add("x", "X", "Position of the blue box", x);
  const on = state.ok_w(false);
  states.add("on", "On", "A switch, to link options to", on);
  const count_link = canvas.link<string>("/states/dev-canvas/count");
  const blue_text = state.ok_w<string | CanvasLink<string>>(count_link);
  const widgets: CanvasWidget[] = [
    box_widget({
      color: "#2980b9",
      text: blue_text,
      ...place(40, 20, 160, 70),
      x: canvas.link("/states/dev-canvas/x"),
    }),
    box_widget({
      color: "#27ae60",
      text: "Mirror",
      ...place(280, 110, 160, 70),
      x: canvas.link("/states/dev-canvas/x", {
        transforms: [canvas.linear([0, 320], [320, 0])],
      }),
    }),
    box_widget({
      color: "#c0392b",
      text: canvas.link("/states/dev-canvas/missing"),
      ...place(280, 20, 160, 70),
    }),
  ];
  const page: CanvasPage = { width: 480, height: 200, widgets };
  const selected = state.ok_w<CanvasWidget[]>([widgets[0]]);
  const line = row(sec);
  line.append("x state:");
  line.append(form.number_input({ value: x }));
  line.append("On state:", form.switch({ value: on }));
  let missing: ReturnType<typeof states.add> | undefined;
  controls(sec, {
    "Switch blue text": () =>
      blue_text.set_ok(
        blue_text.ok() === count_link ? "A plain value" : count_link,
      ),
    "Register missing": () => {
      missing ??= states.add(
        "missing",
        "Missing",
        "Registered by a button",
        state.ok("Registered"),
      );
    },
    "Unregister missing": () => {
      missing?.remove();
      missing = undefined;
    },
  });
  const saved = sec.appendChild(document.createElement("div"));
  saved.style.fontFamily = "monospace";
  const show_saved = () =>
    void state
      .ok(page)
      .to_json()
      .then((json) => (saved.textContent = json));
  show_saved();
  setInterval(show_saved, 500);
  const boxes = row(sec);
  viewport_in(
    boxes,
    "Editor",
    { width: "30rem", height: "12.5rem" },
    page,
    true,
    selected,
  );
  box(boxes, "Properties of the selected widget", {
    width: "22rem",
    height: "20rem",
    display: "flex",
  }).appendChild(canvas.properties({ selected })).style.flexGrow = "1";
}

//     __  __          _   ___     __
//    |  \/  |   /\   | \ | \ \   / /
//    | \  / |  /  \  |  \| |\ \_/ /
//    | |\/| | / /\ \ | . ` | \   /
//    | |  | |/ ____ \| |\  |  | |
//    |_|  |_/_/    \_\_| \_|  |_|
{
  const sec = section(
    "Many widgets",
    "Fills a 1920 x 1080 page with widgets, each with five writable states, shown in an editor and a preview. Look at how long filling takes, and how panning, zooming and dragging feel",
  );
  const widgets = state.ok_w<CanvasWidget[]>([]);
  const page: CanvasPage = { width: 1920, height: 1080, widgets };
  const colors = ["#2980b9", "#27ae60", "#8e44ad", "#c0392b", "#d35400"];
  const status = sec.appendChild(document.createElement("div"));
  status.style.fontFamily = "monospace";
  status.textContent = "Not filled yet";
  const fill = (amount: number) => {
    const start = performance.now();
    const columns = Math.ceil(Math.sqrt(amount * (1920 / 1080)));
    const size = 1920 / columns;
    const list: CanvasWidget[] = [];
    for (let i = 0; i < amount; i++)
      list.push(
        box_widget({
          color: colors[i % colors.length],
          text: String(i),
          ...place(
            (i % columns) * size,
            Math.floor(i / columns) * size,
            size * 0.8,
            size * 0.8,
            (i * 15) % 90,
          ),
        }),
      );
    widgets.set_ok(list);
    requestAnimationFrame(() => {
      status.textContent = `${amount} widgets in two viewports, ${(performance.now() - start).toFixed(0)}ms to the next frame`;
    });
  };
  controls(sec, {
    "100 widgets": () => fill(100),
    "1000 widgets": () => fill(1000),
    "5000 widgets": () => fill(5000),
    Clear: () => widgets.set_ok([]),
  });
  const boxes = row(sec);
  viewport_in(boxes, "Editor", { width: "36rem", height: "20rem" }, page, true);
  viewport_in(boxes, "Preview", { width: "20rem", height: "11.25rem" }, page);
}
