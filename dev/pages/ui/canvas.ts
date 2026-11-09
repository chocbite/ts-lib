import { define_element } from "@chocbite/ts-lib-ui/base";
import canvas, { WidgetBase } from "@chocbite/ts-lib-ui/canvas";
import { box, controls, row, section } from "../../helpers";

/**Colored box with a label, does not stretch, so the text keeps its size when resized*/
class DevBox extends WidgetBase {
  static element_name() {
    return "devbox";
  }
  constructor(color: string, text: string) {
    super();
    this.style.background = color;
    this.style.display = "flex";
    this.style.alignItems = "center";
    this.style.justifyContent = "center";
    this.style.fontFamily = "sans-serif";
    this.style.color = "white";
    this.textContent = text;
  }
  get original_width(): number {
    return this.width;
  }
  get original_height(): number {
    return this.height;
  }
}
define_element(DevBox);

/**64 x 64 graphic that stretches to the widget size*/
class DevGraphic extends WidgetBase {
  static element_name() {
    return "devgraphic";
  }
  constructor(color: string) {
    super();
    const circle = this.appendChild(document.createElement("div"));
    Object.assign(circle.style, {
      boxSizing: "border-box",
      width: "64px",
      height: "64px",
      borderRadius: "50%",
      border: "4px solid black",
      background: color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "sans-serif",
      fontSize: "24px",
      color: "black",
    });
    circle.textContent = "A";
  }
  get original_width(): number {
    return 64;
  }
  get original_height(): number {
    return 64;
  }
}
define_element(DevGraphic);

/**The widgets of the old trial, on an 800 x 600 page*/
const trial_widgets = () => [
  new DevBox("#2980b9", "Small box").opts({ x: 20, y: 20, width: 160, height: 80 }),
  new DevBox("#27ae60", "Wide box, text not stretched").opts({
    x: 20,
    y: 120,
    width: 400,
    height: 40,
  }),
  new DevBox("#8e44ad", "Rotated 45").opts({
    x: 20,
    y: 220,
    width: 160,
    height: 80,
    rotation: 45,
  }),
  new DevGraphic("#f1c40f").opts({ x: 300, y: 300, width: 64, height: 64 }),
  new DevGraphic("#f1c40f").opts({ x: 400, y: 300, width: 128, height: 64 }),
  new DevGraphic("#f1c40f").opts({ x: 560, y: 300, width: 64, height: 128 }),
  new DevGraphic("#f1c40f").opts({
    x: 300,
    y: 450,
    width: 256,
    height: 64,
    rotation: 30,
  }),
];

//     ______ _____ _____ _______
//    |  ____|  __ \_   _|__   __|
//    | |__  | |  | || |    | |
//    |  __| | |  | || |    | |
//    | |____| |__| || |_   | |
//    |______|_____/_____|  |_|
{
  const sec = section(
    "Edit",
    "In edit mode: click a widget to select it, drag the outline to move, handles to resize, the top handle to rotate. Wheel pans, ctrl + wheel zooms toward the pointer, alt slows down, middle or right drag pans. Leaving edit resets the view. Switch input mode to touch in the shell for bigger handles",
  );
  const page = canvas.page({ width: 800, height: 600 });
  const vp = canvas.viewport({ page, edit: true });
  vp.style.width = "100%";
  vp.style.height = "100%";
  const spinning = new DevGraphic("#c0392b").opts({
    x: 600,
    y: 100,
    width: 128,
    height: 64,
  });
  const widgets = [...trial_widgets(), spinning];
  page.widgets = widgets;

  const status = sec.appendChild(document.createElement("div"));
  status.style.fontFamily = "monospace";
  const update = () => {
    const s = vp.selected;
    status.textContent =
      `edit ${vp.edit}, scale ${vp.scale.toFixed(3)}, page ${page.width} x ${page.height}, ` +
      (s
        ? `selected x ${s.x.toFixed(0)} y ${s.y.toFixed(0)} w ${s.width.toFixed(0)} h ${s.height.toFixed(0)} rotation ${s.rotation.toFixed(0)}`
        : "nothing selected");
  };
  for (const widget of widgets)
    widget.addEventListener(canvas.WIDGET_TRANSFORM_EVENT, update);
  vp.addEventListener("pointerup", update);
  vp.addEventListener("wheel", update);
  //The scale is known once the viewport has been laid out
  new ResizeObserver(() => requestAnimationFrame(update)).observe(vp);

  let spin_frame: number | undefined;
  const spin = (time: number) => {
    spinning.rotation = (time / 20) % 360;
    spin_frame = requestAnimationFrame(spin);
  };
  controls(sec, {
    "Toggle edit": () => {
      vp.edit = !vp.edit;
      update();
    },
    "Start / stop spinning": () => {
      if (spin_frame === undefined) spin_frame = requestAnimationFrame(spin);
      else {
        cancelAnimationFrame(spin_frame);
        spin_frame = undefined;
      }
    },
    "Select first": () => {
      vp.selected = widgets[0];
      update();
    },
    "Clear selection": () => {
      vp.selected = undefined;
      update();
    },
    "Page 800 x 600": () => {
      page.width = 800;
      page.height = 600;
      update();
    },
    "Page 1920 x 1080": () => {
      page.width = 1920;
      page.height = 1080;
      update();
    },
    "Page 400 x 800": () => {
      page.width = 400;
      page.height = 800;
      update();
    },
    "Reverse order": () => {
      page.widgets = [...page.widgets].reverse();
    },
  });
  box(sec, "100% x 32rem box", { width: "100%", height: "32rem" }).appendChild(
    vp,
  );
  update();
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
    "The same 800 x 600 page outside edit mode in different box shapes, it should scale to fit and center with the viewport background around it",
  );
  const boxes = row(sec);
  for (const [width, height] of [
    ["16rem", "12rem"],
    ["24rem", "8rem"],
    ["8rem", "16rem"],
  ]) {
    const page = canvas.page({ width: 800, height: 600 });
    page.widgets = trial_widgets();
    const vp = canvas.viewport({ page });
    vp.style.width = "100%";
    vp.style.height = "100%";
    box(boxes, `${width} x ${height}`, { width, height }).appendChild(vp);
  }
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
    "Fills a 1920 x 1080 page with widgets in edit mode, how do panning, zooming and dragging feel",
  );
  const page = canvas.page({ width: 1920, height: 1080 });
  const vp = canvas.viewport({ page, edit: true });
  vp.style.width = "100%";
  vp.style.height = "100%";
  const colors = ["#2980b9", "#27ae60", "#8e44ad", "#c0392b", "#d35400"];
  const fill = (amount: number) => {
    const columns = Math.ceil(Math.sqrt(amount * (1920 / 1080)));
    const size = 1920 / columns;
    const widgets: WidgetBase[] = [];
    for (let i = 0; i < amount; i++)
      widgets.push(
        new DevBox(colors[i % colors.length], String(i)).opts({
          x: (i % columns) * size,
          y: Math.floor(i / columns) * size,
          width: size * 0.8,
          height: size * 0.8,
          rotation: (i * 15) % 90,
        }),
      );
    page.widgets = widgets;
  };
  controls(sec, {
    "100 widgets": () => fill(100),
    "1000 widgets": () => fill(1000),
    "5000 widgets": () => fill(5000),
    Clear: () => (page.widgets = []),
  });
  box(sec, "100% x 32rem box", { width: "100%", height: "32rem" }).appendChild(
    vp,
  );
}
