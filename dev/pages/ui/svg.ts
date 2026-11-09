import { svg, SVGAnchorPoint } from "@chocbite/ts-lib-ui/svg";
import { box, row, section } from "../../helpers";

/**Svg canvas of the given display size showing a 100 x 100 view box, with a faint frame*/
const canvas = (size: number, view = 100) => {
  const elem = svg.svg(size, size, `0 0 ${view} ${view}`).elem;
  elem.style.color = "inherit";
  elem.style.overflow = "visible";
  elem.appendChild(
    svg
      .rectangle_from_corner(0, 0, view, view, 0)
      .f("none")
      .s("#8886")
      .sw(view / 100).elem,
  );
  return elem;
};

/**Small cross marking a point, for seeing where anchors and centers are*/
const marker = (x: number, y: number, size = 3) => {
  const g = svg.group().elem;
  g.append(
    svg.line(x - size, y, x + size, y).s("#e53935").sw(0.5).elem,
    svg.line(x, y - size, x, y + size).s("#e53935").sw(0.5).elem,
  );
  return g;
};

const ANCHORS = Object.entries(SVGAnchorPoint) as [string, SVGAnchorPoint][];

//     _____  _____  _____ __  __ _____ _______ _______      ________  _____
//    |  __ \|  __ \|_   _|  \/  |_   _|__   __|_   _\ \    / /  ____|/ ____|
//    | |__) | |__) | | | | \  / | | |    | |    | |  \ \  / /| |__  | (___
//    |  ___/|  _  /  | | | |\/| | | |    | |    | |   \ \/ / |  __|  \___ \
//    | |    | | \ \ _| |_| |  | |_| |_   | |   _| |_   \  /  | |____ ____) |
//    |_|    |_|  \_\_____|_|  |_|_____|  |_|  |_____|   \/   |______|_____/
{
  const primitives: [string, () => SVGElement[]][] = [
    ["circle", () => [svg.circle(50, 50, 40).f("#1e88e5").s("currentColor").sw(2).elem, marker(50, 50)]],
    ["ellipse", () => [svg.ellipse(50, 50, 45, 25).f("#43a047").s("currentColor").sw(2).elem, marker(50, 50)]],
    ["line", () => [svg.line(10, 90, 90, 10).s("currentColor").sw(4).elem, marker(10, 90), marker(90, 10)]],
    [
      "path",
      () => [svg.path("M 10 80 C 20 10, 50 10, 50 50 S 80 90, 90 20").f("none").s("currentColor").sw(3).elem],
    ],
    [
      "rectangle_from_center r=10",
      () => [svg.rectangle_from_center(50, 50, 70, 40, 10).f("#fb8c00").s("currentColor").sw(2).elem, marker(50, 50)],
    ],
    [
      "rectangle_from_corner r=0",
      () => [svg.rectangle_from_corner(15, 30, 70, 40, 0).f("#8e24aa").s("currentColor").sw(2).elem, marker(15, 30)],
    ],
    [
      "isosceles_triangle",
      () => [svg.isosceles_triangle(50, 50, 70, 60).f("#fdd835").s("currentColor").sw(2).elem, marker(50, 50)],
    ],
    [
      "group with translate",
      () => {
        const g = svg.group().translate(50, 50).elem;
        g.append(
          svg.circle(-20, 0, 15).f("#e53935").elem,
          svg.circle(20, 0, 15).f("#1e88e5").elem,
        );
        return [g, marker(50, 50)];
      },
    ],
  ];
  const sec = section(
    "Primitives",
    "Every primitive at 50, 100 and 200 px showing the same 100 x 100 view box, red crosses mark the given center or corner. Strokes use currentColor, check both themes",
  );
  for (const size of [50, 100, 200]) {
    const sizes = row(sec);
    for (const [name, make] of primitives) {
      const c = canvas(size);
      c.append(...make());
      box(sizes, `${name} ${size}px`).appendChild(c);
    }
  }
}

//                _____   _____  _____
//          /\   |  __ \ / ____|/ ____|
//         /  \  | |__) | |    | (___
//        / /\ \ |  _  /| |     \___ \
//       / ____ \| | \ \| |____ ____) |
//      /_/    \_\_|  \_\\_____|_____/
{
  const sec = section(
    "Arcs",
    "circle_arc and ellipse_arc with different start and end angles in degrees, 0 is to the right, positive turns clockwise. The red cross marks the start. 360 should be a full circle",
  );
  const arcs: [number, number][] = [
    [0, 45],
    [0, 90],
    [0, 180],
    [0, 270],
    [0, 359],
    [0, 360],
    [90, 180],
    [-90, 90],
    [0, -90],
    [0, -270],
  ];
  for (const ellipse of [false, true]) {
    const items = row(sec);
    for (const [start, end] of arcs) {
      const c = canvas(100);
      const ry = ellipse ? 20 : 40;
      c.appendChild(
        svg.ellipse(50, 50, 40, ry).f("none").s("#8884").sw(1).elem,
      );
      c.appendChild(
        (ellipse
          ? svg.ellipse_arc(50, 50, 40, ry, start, end)
          : svg.circle_arc(50, 50, 40, start, end)
        )
          .f("none")
          .s("#1e88e5")
          .sw(4).elem,
      );
      const rad = (start * Math.PI) / 180;
      c.appendChild(marker(50 + 40 * Math.cos(rad), 50 + ry * Math.sin(rad), 5));
      box(items, `${ellipse ? "ellipse_arc" : "circle_arc"} ${start} to ${end}`).appendChild(c);
    }
  }
}

//     _______ ________   _________
//    |__   __|  ____\ \ / /__   __|
//       | |  | |__   \ V /   | |
//       | |  |  __|   > <    | |
//       | |  | |____ / . \   | |
//       |_|  |______/_/ \_\  |_|
{
  const sec = section(
    "Text anchors",
    "Single line text placed at the red cross with every anchor point, at a few font sizes. The text should sit on the matching side of the cross",
  );
  for (const size of [8, 12, 16, 24]) {
    const items = row(sec);
    for (const [name, anchor] of ANCHORS) {
      const c = svg.svg(150, 70).elem;
      c.style.overflow = "visible";
      c.append(
        svg.rectangle_from_corner(0, 0, 150, 70, 0).f("none").s("#8886").elem,
        marker(75, 35, 6),
        svg.text(75, 35, "Text " + size, size, anchor).f("currentColor").elem,
      );
      box(items, `${name} ${size}px`).appendChild(c);
    }
  }
}

//     __  __ _    _ _   _______ _____   _      _____ _   _ ______
//    |  \/  | |  | | | |__   __|_   _| | |    |_   _| \ | |  ____|
//    | \  / | |  | | |    | |    | |   | |      | | |  \| | |__
//    | |\/| | |  | | |    | |    | |   | |      | | | . ` |  __|
//    | |  | | |__| | |____| |   _| |_  | |____ _| |_| |\  | |____
//    |_|  |_|\____/|______|_|  |_____| |______|_____|_| \_|______|
{
  const TEXT =
    "Multi line text wraps inside its box and is aligned by the anchor point";
  const sec = section(
    "Multi line text",
    "multi_line_text in a dashed 90 x 70 box with every anchor point, at two font sizes. Long text overflows at the larger size, how does it clip?",
  );
  for (const size of [10, 16]) {
    const items = row(sec);
    for (const [name, anchor] of ANCHORS) {
      const c = canvas(110, 110);
      c.append(
        svg
          .rectangle_from_corner(10, 20, 90, 70, 0)
          .f("none")
          .s("#e53935")
          .sw(0.5)
          .a("stroke-dasharray", "2 2").elem,
        svg.multi_line_text(10, 20, 90, 70, TEXT, size, anchor).elem,
      );
      box(items, `${name} ${size}px`).appendChild(c);
    }
  }
}

//                _   _  _____ _      ______
//          /\   | \ | |/ ____| |    |  ____|
//         /  \  |  \| | |  __| |    | |__
//        / /\ \ | . ` | | |_ | |    |  __|
//       / ____ \| |\  | |__| | |____| |____
//      /_/    \_\_| \_|\_____|______|______|
{
  const sec = section(
    "angle_to_anchor_point",
    "Labels around a dial every 15 degrees, each anchored with the anchor point for its angle (radians), so labels sit outside the ring without overlapping it",
  );
  const items = row(sec);
  for (const [size, radius, font] of [
    [200, 70, 10],
    [300, 110, 14],
  ]) {
    const c = canvas(size, size);
    const center = size / 2;
    c.appendChild(
      svg.circle(center, center, radius).f("none").s("currentColor").sw(1).elem,
    );
    for (let degrees = 0; degrees < 360; degrees += 15) {
      const angle = (degrees * Math.PI) / 180;
      const x = center + (radius + 4) * Math.cos(angle);
      const y = center + (radius + 4) * Math.sin(angle);
      c.append(
        svg.line(center + (radius - 6) * Math.cos(angle), center + (radius - 6) * Math.sin(angle), x - 4 * Math.cos(angle), y - 4 * Math.sin(angle)).s("currentColor").sw(1).elem,
        svg.text(x, y, String(degrees), font, svg.angle_to_anchor_point(angle)).f("currentColor").elem,
      );
    }
    box(items, `${size}px dial`).appendChild(c);
  }
}

//     _______ _____            _   _  _____ ______ ____  _____  __  __  _____
//    |__   __|  __ \     /\   | \ | |/ ____|  ____/ __ \|  __ \|  \/  |/ ____|
//       | |  | |__) |   /  \  |  \| | (___ | |__ | |  | | |__) | \  / | (___
//       | |  |  _  /   / /\ \ | . ` |\___ \|  __|| |  | |  _  /| |\/| |\___ \
//       | |  | | \ \  / ____ \| |\  |____) | |   | |__| | | \ \| |  | |____) |
//       |_|  |_|  \_\/_/    \_\_| \_|_____/|_|    \____/|_|  \_\_|  |_|_____/
{
  const sec = section(
    "Transforms",
    "The same 30 x 30 square with chained transforms, the faint square is untransformed. Transforms apply in the order they are chained",
  );
  const items = row(sec);
  const variants: [string, (a: ReturnType<typeof svg.rectangle_from_center>) => void][] = [
    ["none", () => {}],
    ["rotate(30)", (a) => a.rotate(30, 50, 50)],
    ["scale(1.5)", (a) => a.translate(50, 50).scale(1.5).translate(-50, -50)],
    ["skewX(20)", (a) => a.skewX(20)],
    ["skewY(20)", (a) => a.skewY(20)],
    ["translate then rotate", (a) => a.translate(20, 0).rotate(45, 50, 50)],
    ["rotate then translate", (a) => a.rotate(45, 50, 50).translate(20, 0)],
  ];
  for (const [name, apply] of variants) {
    const c = canvas(100);
    c.appendChild(
      svg.rectangle_from_center(50, 50, 30, 30, 0).f("none").s("#8888").elem,
    );
    const rect = svg.rectangle_from_center(50, 50, 30, 30, 0).f("#1e88e588").s("#1e88e5");
    apply(rect);
    c.appendChild(rect.elem);
    box(items, name).appendChild(c);
  }
}
