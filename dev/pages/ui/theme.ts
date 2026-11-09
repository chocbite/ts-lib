import {
  ANIMATION_LEVEL,
  ANIMATION_SPEED,
  AnimationLevels,
  INPUT_MODE,
  InputModes,
  px_to_rem,
  rem_to_px,
  SCALE,
  SCROLLBAR_MODE,
  ScrollbarModes,
  THEME,
  theme_init_variable_root,
  Themes,
} from "@chocbite/ts-lib-ui/theme";
import { array_from_length } from "@chocbite/ts-lib/common";
import { box, controls, row, section } from "../../helpers";

/**Line of monospace text, that can be changed later*/
function status(parent: HTMLElement): HTMLElement {
  const line = parent.appendChild(document.createElement("div"));
  line.style.margin = "0.25rem 0 0.5rem";
  line.style.fontFamily = "monospace";
  return line;
}

/**Writes a value to a setting and shows the result, so a refused value is visible*/
function writer<T>(
  setting: { write(value: T): PromiseLike<{ ok: boolean; error?: string }> },
  line: HTMLElement,
) {
  return (value: T) => async () => {
    const result = await setting.write(value);
    if (result.ok) return;
    line.style.color = "#d33";
    line.textContent = `write ${JSON.stringify(value)} refused: ${result.error}`;
  };
}

/**Section for an enum setting with a button per value*/
function enum_setting<T extends string>(
  title: string,
  note: string,
  setting: {
    write(value: T): PromiseLike<{ ok: boolean; error?: string }>;
    sub(func: (value: { ok: boolean; value?: T }) => void, update?: boolean): unknown;
  },
  values: { [key: string]: T },
  extra: { [text: string]: T } = {},
) {
  const sec = section(title, note);
  const line = status(sec);
  const write = writer(setting, line);
  const buttons: { [text: string]: () => void } = {};
  for (const [name, value] of Object.entries(values))
    buttons[name] = write(value);
  for (const [name, value] of Object.entries(extra))
    buttons[name] = write(value);
  controls(sec, buttons);
  setting.sub((v) => {
    line.style.color = "";
    line.textContent = `${title}: ${v.ok ? v.value : "error"}`;
  }, true);
  return sec;
}

/**Section for a number setting with a button per value and steps*/
function number_setting(
  title: string,
  note: string,
  setting: {
    write(value: number): PromiseLike<{ ok: boolean; error?: string }>;
    sub(func: (value: { ok: boolean; value?: number }) => void, update?: boolean): unknown;
    ok(): number;
  },
  values: number[],
  step: number,
  unit: string,
) {
  const sec = section(title, note);
  const line = status(sec);
  const write = writer(setting, line);
  const buttons: { [text: string]: () => void } = {
    ["-" + step]: () => void write(setting.ok() - step)(),
    ["+" + step]: () => void write(setting.ok() + step)(),
  };
  for (const value of values) buttons[value + unit] = write(value);
  controls(sec, buttons);
  setting.sub((v) => {
    line.style.color = "";
    line.textContent = `${title}: ${v.ok ? v.value : "error"}${unit}`;
  }, true);
  return sec;
}

//      _______ _    _ ______ __  __ ______
//     |__   __| |  | |  ____|  \/  |  ____|
//        | |  | |__| | |__  | \  / | |__
//        | |  |  __  |  __| | |\/| |  __|
//        | |  | |  | | |____| |  | | |____
//        |_|  |_|  |_|______|_|  |_|______|
{
  enum_setting(
    "THEME",
    "Switches the theme variables. The page background is the app's job, the dev frame only follows the shell. System is refused, the dev frame calls theme_init without system",
    THEME,
    Themes,
  );
  const sec = section(
    "Theme variables",
    "A page defined variable group, and a few built in variables. The swatches should follow the theme",
  );
  const group = theme_init_variable_root(
    "devtheme",
    "Dev theme page",
    "Variables made by the dev page",
  );
  const sub = group.make_sub_group("demo", "Demo", "Demo variables");
  const vars = [
    sub.make_variable("background", "Background", "", "#ffffff", "#202020", "Color", undefined),
    sub.make_variable("text", "Text", "", "#202020", "#f0f0f0", "Color", undefined),
    sub.make_variable("accent", "Accent", "", "#1565c0", "#90caf9", "Color", undefined),
  ];
  const swatches = row(sec);
  const sample = box(swatches, "Made by page", {
    padding: "0.5rem 1rem",
    background: `var(${vars[0]})`,
    color: `var(${vars[1]})`,
    border: `2px solid var(${vars[2]})`,
    borderRadius: "0.5rem",
  });
  sample.textContent = vars.join(", ");
  for (const name of [
    "--common-colors-layer1",
    "--common-scrollbar-thumb-color",
    "--contextmenu-background",
    "--keyboard-colors-background",
  ])
    box(swatches, name, {
      width: "8rem",
      height: "2rem",
      background: `var(${name})`,
      border: "1px solid #8888",
    });
}

//      _____  _____          _      ______
//     / ____|/ ____|   /\   | |    |  ____|
//    | (___ | |       /  \  | |    | |__
//     \___ \| |      / /\ \ | |    | |__|
//     ____) | |____ / ____ \| |____| |____
//    |_____/ \_____/_/    \_\______|______|
{
  const sec = number_setting(
    "SCALE",
    "Sets the root font size, everything in rem grows. The box below is 10rem wide. Values outside 50 to 400 are refused",
    SCALE,
    [50, 75, 100, 125, 150, 200, 400, 500],
    10,
    "%",
  );
  const sample = box(sec, "10rem by 2rem", {
    width: "10rem",
    height: "2rem",
    background: "#8884",
  });
  const conv = status(sec);
  SCALE.sub(() => {
    sample.textContent = `${sample.getBoundingClientRect().width}px`;
    conv.textContent = `rem_to_px(1) = ${rem_to_px(1)}, px_to_rem(100) = ${px_to_rem(100).toFixed(3)}`;
  }, true);
}

//      _____  _____ _____   ____  _      _      ____          _____
//     / ____|/ ____|  __ \ / __ \| |    | |    |  _ \   /\   |  __ \
//    | (___ | |    | |__) | |  | | |    | |    | |_) | /  \  | |__) |
//     \___ \| |    |  _  /| |  | | |    | |    |  _ < / /\ \ |  _  /
//     ____) | |____| | \ \| |__| | |____| |____| |_) / ____ \| | \ \
//    |_____/ \_____|_|  \_\\____/|______|______|____/_/    \_\_|  \_\
{
  const sec = enum_setting(
    "SCROLLBAR_MODE",
    "Size of every scrollbar. Hover and drag the thumbs, try with the dark theme too",
    SCROLLBAR_MODE,
    ScrollbarModes,
  );
  const boxes = row(sec);
  const lines = (n: number, width = 1) =>
    array_from_length(n, (i) => `Line ${i} ` + "text ".repeat(width)).join("\n");
  const scroll = (label: string, style: Partial<CSSStyleDeclaration>, text: string) => {
    const element = box(boxes, label, {
      overflow: "auto",
      whiteSpace: "pre",
      border: "1px solid #8888",
      ...style,
    });
    element.textContent = text;
  };
  scroll("Vertical", { width: "12rem", height: "10rem" }, lines(40));
  scroll("Horizontal", { width: "12rem", height: "4rem" }, lines(2, 40));
  scroll("Both", { width: "12rem", height: "10rem" }, lines(40, 20));
  scroll("Small", { width: "6rem", height: "4rem" }, lines(40, 5));
}

//      _____ _   _ _____  _    _ _______
//     |_   _| \ | |  __ \| |  | |__   __|
//       | | |  \| | |__) | |  | |  | |
//       | | | . ` |  ___/| |  | |  | |
//      _| |_| |\  | |    | |__| |  | |
//     |_____|_| \_|_|     \____/   |_|
{
  const sec = enum_setting(
    "INPUT_MODE",
    "Sets the mouse, pen or touch class and the --mouse, --pen, --touch variables on html, for components to size themselves. The boxes below grow with them",
    INPUT_MODE,
    InputModes,
  );
  const vars = status(sec);
  INPUT_MODE.sub(() => {
    const style = document.documentElement.style;
    vars.textContent = `html class "${document.documentElement.className}", --mouse ${style.getPropertyValue("--mouse")}, --pen ${style.getPropertyValue("--pen")}, --touch ${style.getPropertyValue("--touch")}`;
  }, true);
  const boxes = row(sec);
  for (const mode of ["mouse", "pen", "touch"]) {
    const sample = box(boxes, `height 2rem + 2rem * --${mode}`, {
      width: "10rem",
      height: `calc(2rem + 2rem * var(--${mode}))`,
      background: "#8884",
    });
    sample.textContent = mode;
  }
}

//               _   _ _____ __  __       _______ _____ ____  _   _
//         /\   | \ | |_   _|  \/  |   /\|__   __|_   _/ __ \| \ | |
//        /  \  |  \| | | | | \  / |  /  \  | |    | || |  | |  \| |
//       / /\ \ | . ` | | | | |\/| | / /\ \ | |    | || |  | | . ` |
//      / ____ \| |\  |_| |_| |  | |/ ____ \| |   _| || |__| | |\  |
//     /_/    \_\_| \_|_____|_|  |_/_/    \_\_|  |_____\____/|_| \_|
{
  const style = document.head.appendChild(document.createElement("style"));
  style.textContent = `
    .dev-anim { width: 6rem; height: 2rem; background: #4a90d9; border-radius: 0.25rem; }
    .dev-anim.moved { transform: translateX(14rem); }
    html.anim-all .dev-anim.all, html.anim-some .dev-anim.some { transition: transform var(--animation-speed); }
  `;
  const sec = enum_setting(
    "ANIMATION_LEVEL",
    "Sets the anim-all / anim-some classes on html. The top bar animates only with All, the bottom with All or Functional. None jumps",
    ANIMATION_LEVEL,
    AnimationLevels,
  );
  const classes = status(sec);
  ANIMATION_LEVEL.sub(() => {
    classes.textContent = `html class "${document.documentElement.className}"`;
  }, true);
  const bars = [
    box(sec, "Decorative, .anim-all"),
    box(sec, "Functional, .anim-some"),
  ];
  bars[0].className = "dev-anim all";
  bars[1].className = "dev-anim some";
  controls(sec, {
    "Move bars": () => bars.forEach((bar) => bar.classList.toggle("moved")),
  });
  const speed = number_setting(
    "ANIMATION_SPEED",
    "Sets --animation-speed on html, used by the bars above. Values outside 50 to 1000 or off the 50ms step are refused",
    ANIMATION_SPEED,
    [50, 200, 500, 1000, 25, 1500],
    50,
    "ms",
  );
  const value = status(speed);
  ANIMATION_SPEED.sub(() => {
    value.textContent = `--animation-speed: ${document.documentElement.style.getPropertyValue("--animation-speed")}`;
  }, true);
}

//    __      __     _____  _____          ____  _      ______  _____
//    \ \    / /\   |  __ \|_   _|   /\   |  _ \| |    |  ____|/ ____|
//     \ \  / /  \  | |__) | | |    /  \  | |_) | |    | |__  | (___
//      \ \/ / /\ \ |  _  /  | |   / /\ \ |  _ <| |    |  __|  \___ \
//       \  / ____ \| | \ \ _| |_ / ____ \| |_) | |____| |____ ____) |
//        \/_/    \_\_|  \_\_____/_/    \_\____/|______|______|_____/
{
  const sec = section(
    "Applied variables",
    "Every variable the theme wrote to html, grouped by the first part of the name. Colors get a swatch. Only modules this page imports have registered their variables. There is no api to list the groups with their names and descriptions, so this reads the html style",
  );
  const list = sec.appendChild(document.createElement("div"));
  Object.assign(list.style, {
    columns: "22rem",
    fontFamily: "monospace",
    fontSize: "0.8rem",
  });
  const show = () => {
    const style = document.documentElement.style;
    const groups: { [group: string]: string[] } = {};
    for (let i = 0; i < style.length; i++) {
      const name = style[i];
      if (!name.startsWith("--")) continue;
      (groups[name.slice(2).split("-")[0]] ??= []).push(name);
    }
    list.replaceChildren();
    for (const [group, names] of Object.entries(groups).sort()) {
      const title = list.appendChild(document.createElement("div"));
      title.textContent = group;
      title.style.fontWeight = "bold";
      title.style.marginTop = "0.5rem";
      for (const name of names.sort()) {
        const value = style.getPropertyValue(name).trim();
        const line = list.appendChild(document.createElement("div"));
        line.style.display = "flex";
        line.style.gap = "0.5rem";
        line.style.alignItems = "center";
        const swatch = line.appendChild(document.createElement("span"));
        Object.assign(swatch.style, {
          flex: "none",
          width: "1rem",
          height: "1rem",
          background: CSS.supports("color", value) ? value : "transparent",
          border: CSS.supports("color", value) ? "1px solid #8888" : "none",
        });
        line.append(`${name}: ${value}`);
      }
    }
  };
  THEME.sub(show, true);
  SCALE.sub(show);
  SCROLLBAR_MODE.sub(show);
  INPUT_MODE.sub(show);
  ANIMATION_LEVEL.sub(show);
  ANIMATION_SPEED.sub(show);
  controls(sec, { Refresh: show });
}
