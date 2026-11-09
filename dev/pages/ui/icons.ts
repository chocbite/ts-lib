import * as icons from "@chocbite/ts-lib-ui/icons";
import type { SVGFunc } from "@chocbite/ts-lib-ui/svg";
import { box, controls, row, section } from "../../helpers";

const ALL = Object.entries(icons).filter(
  (entry): entry is [string, SVGFunc] =>
    entry[0].startsWith("material_") && typeof entry[1] === "function",
);

/**Ligature name of an icon in the font, material_folder_rounded is folder*/
const font_name = (name: string) =>
  name.replace(/^material_/, "").replace(/_rounded$/, "");

/**Icon from the Material Symbols Rounded font, the font face is defined when the icons module is imported.
 * There is no TS helper for this in the library, only the scss mixin, so this copies the mixin as inline styles*/
const font_icon = (name: string, size: number) => {
  const span = document.createElement("span");
  span.textContent = font_name(name);
  Object.assign(span.style, {
    fontFamily: '"Material Symbols Rounded"',
    fontWeight: "normal",
    fontStyle: "normal",
    letterSpacing: "normal",
    textTransform: "none",
    whiteSpace: "nowrap",
    wordWrap: "normal",
    direction: "ltr",
    fontFeatureSettings: '"liga"',
    webkitFontSmoothing: "antialiased",
    fontSize: size + "px",
    lineHeight: "1",
    display: "inline-block",
  });
  return span;
};

/**Svg icon sized in px, colored with currentColor*/
const svg_icon = (func: SVGFunc, size: number) => {
  const icon = func();
  icon.style.width = size + "px";
  icon.style.height = size + "px";
  icon.style.fill = "currentColor";
  return icon;
};

const FEW = [
  "material_folder_rounded",
  "material_home_rounded",
  "material_settings_rounded",
  "material_delete_rounded",
  "material_warning_rounded",
  "material_check_circle_rounded",
  "material_search_rounded",
  "material_add_rounded",
] as const;
const SIZES = [12, 16, 24, 32, 48, 96];

//      _____ _____ ____________  _____
//     / ____|_   _|___  /  ____|/ ____|
//    | (___   | |    / /| |__  | (___
//     \___ \  | |   / / |  __|  \___ \
//     ____) |_| |_ / /__| |____ ____) |
//    |_____/|_____/_____|______|_____/
{
  const sec = section(
    "Sizes, svg against font",
    "The same icons as svg (top of each box) and font glyph (bottom) at the same size in px. Do they match, are small sizes crisp, do they line up?",
  );
  const sizes = row(sec);
  for (const size of SIZES) {
    const holder = box(sizes, size + "px");
    for (const kind of ["svg", "font"] as const) {
      const line = holder.appendChild(document.createElement("div"));
      line.style.display = "flex";
      line.style.gap = "2px";
      line.style.outline = "1px dashed #8886";
      for (const name of FEW)
        line.appendChild(
          kind === "svg"
            ? svg_icon(icons[name], size)
            : font_icon(name, size),
        );
    }
  }
}

//       _____ ____  _      ____  _____   _____
//      / ____/ __ \| |    / __ \|  __ \ / ____|
//     | |   | |  | | |   | |  | | |__) | (___
//     | |   | |  | | |   | |  | |  _  / \___ \
//     | |___| |__| | |___| |__| | | \ \ ____) |
//      \_____\____/|______\____/|_|  \_\_____/
{
  const sec = section(
    "Colors",
    "As returned the svg has no fill, so it is black in both themes unless the consumer styles it. Svg icons are colored with css fill, the font with color",
  );
  const items = row(sec);
  const variants: [string, (svg: SVGSVGElement, font: HTMLElement) => void][] = [
    [
      "as returned",
      (svg) => {
        svg.style.fill = "";
      },
    ],
    ["currentColor", () => {}],
    [
      "red",
      (svg, font) => {
        svg.style.fill = "#e53935";
        font.style.color = "#e53935";
      },
    ],
    [
      "blue",
      (svg, font) => {
        svg.style.fill = "#1e88e5";
        font.style.color = "#1e88e5";
      },
    ],
    [
      "opacity 0.4",
      (svg, font) => {
        svg.style.opacity = "0.4";
        font.style.opacity = "0.4";
      },
    ],
  ];
  for (const [label, apply] of variants) {
    const holder = box(items, label);
    for (const name of FEW.slice(0, 4)) {
      const line = holder.appendChild(document.createElement("div"));
      line.style.display = "flex";
      line.style.gap = "4px";
      const svg = line.appendChild(svg_icon(icons[name], 32));
      const font = line.appendChild(font_icon(name, 32));
      apply(svg, font);
    }
  }
}

//     _____  ______ _____  ______ ____  _____  __  __          _   _  _____ ______
//    |  __ \|  ____|  __ \|  ____/ __ \|  __ \|  \/  |   /\   | \ | |/ ____|  ____|
//    | |__) | |__  | |__) | |__ | |  | | |__) | \  / |  /  \  |  \| | |    | |__
//    |  ___/|  __| |  _  /|  __|| |  | |  _  /| |\/| | / /\ \ | . ` | |    |  __|
//    | |    | |____| | \ \| |   | |__| | | \ \| |  | |/ ____ \| |\  | |____| |____
//    |_|    |______|_|  \_\_|    \____/|_|  \_\_|  |_/_/    \_\_| \_|\_____|______|
{
  const sec = section(
    "Performance",
    "Renders the first 2000 icons as svg or as font glyphs and shows the time to create and lay them out, the reason lists use the font",
  );
  const status = sec.appendChild(document.createElement("div"));
  status.style.fontFamily = "monospace";
  const target = document.createElement("div");
  const render = (kind: "svg" | "font") => {
    target.replaceChildren();
    const start = performance.now();
    const nodes = ALL.slice(0, 2000).map(([name, func]) =>
      kind === "svg" ? svg_icon(func, 24) : font_icon(name, 24),
    );
    target.append(...nodes);
    void target.offsetHeight;
    const created = performance.now();
    requestAnimationFrame(() =>
      setTimeout(() => {
        status.textContent = `${nodes.length} ${kind} icons: create and layout ${(created - start).toFixed(1)} ms, until next frame painted ${(performance.now() - start).toFixed(1)} ms`;
      }),
    );
  };
  controls(sec, {
    "Render 2000 svg": () => render("svg"),
    "Render 2000 font": () => render("font"),
    Clear: () => {
      target.replaceChildren();
      status.textContent = "";
    },
  });
  sec.appendChild(target);
  target.style.maxHeight = "16rem";
  target.style.overflow = "auto";
}

//              _      _
//        /\   | |    | |
//       /  \  | |    | |
//      / /\ \ | |    | |
//     / ____ \| |____| |____
//    /_/    \_\______|______|
{
  const sec = section(
    "All icons",
    `All ${ALL.length} icons, svg on the left and the font glyph on the right of each cell. A blank or text glyph on the right means the font is missing that icon. The filter matches names`,
  );
  const filter = document.createElement("input");
  filter.placeholder = "Filter, e.g. arrow";
  const count = document.createElement("span");
  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(11rem, 1fr))";
  grid.style.gap = "2px";
  let cells: [string, HTMLElement][] = [];
  const apply_filter = () => {
    const text = filter.value.trim().toLowerCase();
    let shown = 0;
    for (const [name, cell] of cells) {
      const show = name.includes(text);
      cell.hidden = !show;
      if (show) shown++;
    }
    count.textContent = cells.length
      ? ` ${shown} of ${cells.length} shown`
      : " not rendered yet";
  };
  filter.oninput = apply_filter;
  controls(sec, {
    "Show all": () => {
      if (cells.length) return;
      cells = ALL.map(([name, func]) => {
        const cell = document.createElement("div");
        cell.style.display = "flex";
        cell.style.alignItems = "center";
        cell.style.gap = "4px";
        cell.style.fontSize = "0.7rem";
        cell.style.overflow = "hidden";
        cell.title = name;
        const label = document.createElement("span");
        label.textContent = font_name(name);
        label.style.overflow = "hidden";
        label.style.textOverflow = "ellipsis";
        cell.append(svg_icon(func, 24), font_icon(name, 24), label);
        return [font_name(name), cell];
      });
      grid.replaceChildren(...cells.map(([, cell]) => cell));
      apply_filter();
    },
    Hide: () => {
      cells = [];
      grid.replaceChildren();
      apply_filter();
    },
  }).append(filter, count);
  sec.appendChild(grid);
  apply_filter();
}
