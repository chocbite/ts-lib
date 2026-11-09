import { viewport, ViewportElement } from "@chocbite/ts-lib-ui/canvas";
import { svg, SVGAnchorPoint } from "@chocbite/ts-lib-ui/svg";
import { array_from_length } from "@chocbite/ts-lib/common";
import { none, type Option } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../helpers";

const COLORS = ["#e53935", "#1e88e5", "#43a047", "#fb8c00", "#8e24aa"];
const color = (i: number) => COLORS[i % COLORS.length];

/**Element with an optimal ratio, its content stretches when resized*/
class DevStretch extends ViewportElement {
  protected element_name() {
    return "stretch";
  }
  protected element_name_space() {
    return "dev";
  }
  default_width() {
    return 64;
  }
  default_height() {
    return 64;
  }
  constructor(fill: string, label: string) {
    super();
    this.canvas.append(
      svg.rectangle_from_corner(2, 2, 60, 60, 8).f(fill).s("black").sw(2).elem,
      svg.circle(32, 32, 14).f("white").elem,
      svg.text(32, 32, label, 12, SVGAnchorPoint.middleCenter).f("black").elem,
    );
  }
}

/**Element without an optimal ratio, it lays its content out again when resized*/
class DevDynamic extends ViewportElement {
  protected element_name() {
    return "dynamic";
  }
  protected element_name_space() {
    return "dev";
  }
  default_width() {
    return 120;
  }
  default_height() {
    return 40;
  }
  optimal_ratio(): Option<number> {
    return none();
  }
  #rect = svg.rectangle_from_corner(1, 1, 118, 38, 4).f("#fdd835").s("black")
    .elem;
  #text = svg.text(60, 20, "", 12, SVGAnchorPoint.middleCenter).f("black")
    .elem;
  constructor() {
    super();
    this.canvas.append(this.#rect, this.#text);
    this.on_resize(this.default_width(), this.default_height());
  }
  protected on_resize(width: number, height: number): void {
    this.#rect.setAttribute("width", String(Math.max(0, width - 2)));
    this.#rect.setAttribute("height", String(Math.max(0, height - 2)));
    this.#text.setAttribute("x", String(width / 2));
    this.#text.setAttribute("y", String(height / 2));
    this.#text.textContent = `${width.toFixed(0)} x ${height.toFixed(0)}`;
  }
}

/**Places an element and returns it*/
const place = <T extends ViewportElement>(
  element: T,
  x: number,
  y: number,
  rotation = 0,
): T => {
  element.position_x = x;
  element.position_y = y;
  element.rotation = rotation;
  return element;
};

//      ____           _____ _____ _____
//     |  _ \   /\    / ____|_   _/ ____|
//     | |_) | /  \  | (___   | || |
//     |  _ < / /\ \  \___ \  | || |
//     | |_) / ____ \ ____) |_| || |____
//     |____/_/    \_\_____/|_____\_____|
{
  const sec = section(
    "Pan, zoom and move",
    "Drag the background to pan, wheel zooms toward the pointer (shift slower, alt faster), ctrl + wheel pans vertically, double click fits the canvas. Click an element for the mover, drag it, its corners and the rotate handle, it snaps to the grid. Does the mover scale sensibly with zoom?",
  );
  const vp = viewport.create_viewport(400, 300);
  const status = sec.appendChild(document.createElement("div"));
  status.style.fontFamily = "monospace";
  const update = () =>
    (status.textContent = `pan ${vp.pan_x.ok().toFixed(0)}, ${vp.pan_y.ok().toFixed(0)}  zoom ${vp.zoom.ok().toFixed(3)}  grid ${vp.grid_x.ok()} x ${vp.grid_y.ok()}, ${vp.grid_rotate.ok()} deg  canvas ${vp.canvas_width} x ${vp.canvas_height}`);
  vp.pan_x.sub(update);
  vp.pan_y.sub(update);
  vp.zoom.sub(update);
  vp.grid_x.sub(update);
  vp.grid_rotate.sub(update);
  update();
  const elements = state.ok<ViewportElement[]>([
    place(new DevStretch(color(0), "A"), 20, 20),
    place(new DevStretch(color(1), "B"), 120, 40, 30),
    place(new DevDynamic(), 40, 160),
    place(new DevStretch(color(2), "C"), 300, 200),
  ]);
  vp.elements = elements;
  let added = 0;
  controls(sec, {
    "Zoom 0.5": () => vp.zoom.write(0.5),
    "Zoom 1": () => vp.zoom.write(1),
    "Zoom 3": () => vp.zoom.write(3),
    "Pan 0, 0": () => {
      vp.pan_x.write(0);
      vp.pan_y.write(0);
    },
    "Grid 10": () => {
      vp.grid_x.write(10);
      vp.grid_y.write(10);
      update();
    },
    "Grid 50": () => {
      vp.grid_x.write(50);
      vp.grid_y.write(50);
      update();
    },
    "Canvas 400 x 300": () => {
      vp.canvas_width = 400;
      vp.canvas_height = 300;
      update();
    },
    "Canvas 800 x 200": () => {
      vp.canvas_width = 800;
      vp.canvas_height = 200;
      update();
    },
    "Add element": () => {
      added++;
      elements.array.push(
        place(
          new DevStretch(color(added + 2), String(added)),
          (added * 37) % 340,
          (added * 53) % 240,
        ),
      );
    },
    "Remove last": () => elements.array.pop(),
    "Grow first": () => {
      const first = elements.ok()[0];
      if (first) {
        first.width = first.width + 16;
        first.height = first.height + 8;
      }
    },
  });
  box(sec, "600 x 400 box, canvas 400 x 300", {
    width: "600px",
    height: "400px",
  }).appendChild(vp);
}

//      _____ _   _ ______ _____ _   _ _____ _______ ______
//     |_   _| \ | |  ____|_   _| \ | |_   _|__   __|  ____|
//       | | |  \| | |__    | | |  \| | | |    | |  | |__
//       | | | . ` |  __|   | | | . ` | | |    | |  |  __|
//      _| |_| |\  | |     _| |_| |\  |_| |_   | |  | |____
//     |_____|_| \_|_|    |_____|_| \_|_____|  |_|  |______|
{
  const sec = section(
    "Finite and infinite canvas, sizes",
    "A finite canvas only has a white background behind the canvas area, an infinite one fills the whole view. The background is hard coded white, check it against the dark theme. Small boxes, does panning still work well?",
  );
  const boxes = row(sec);
  for (const [label, width, height, infinite] of [
    ["finite, 300 x 200", 300, 200, false],
    ["infinite, 300 x 200", 300, 200, true],
    ["finite, 160 x 120", 160, 120, false],
  ] as const) {
    const vp = viewport.create_viewport(200, 150, infinite);
    vp.elements = [
      place(new DevStretch(color(0), "A"), 10, 10),
      place(new DevStretch(color(1), "B"), 120, 70, 45),
    ];
    box(boxes, label, {
      width: width + "px",
      height: height + "px",
    }).appendChild(vp);
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
    "Many elements",
    "Fills the canvas with elements and zooms out to 0.2, how does panning and zooming feel",
  );
  const vp = viewport.create_viewport(2000, 2000);
  const fill = (amount: number) => {
    const columns = Math.ceil(Math.sqrt(amount));
    const spacing = 2000 / columns;
    vp.elements = array_from_length(amount, (i) => {
      const element = place(
        new DevStretch(color(i), String(i)),
        (i % columns) * spacing,
        Math.floor(i / columns) * spacing,
        (i * 15) % 90,
      );
      element.width = spacing * 0.8;
      element.height = spacing * 0.8;
      return element;
    });
    vp.pan_x.write(0);
    vp.pan_y.write(0);
    vp.zoom.write(0.2);
  };
  controls(sec, {
    "100 elements": () => fill(100),
    "1000 elements": () => fill(1000),
    "5000 elements": () => fill(5000),
    Clear: () => (vp.elements = []),
  });
  box(sec, "600 x 400 box, canvas 2000 x 2000", {
    width: "600px",
    height: "400px",
  }).appendChild(vp);
}
