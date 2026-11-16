import { comp } from "@chocbite/ts-lib-ui/composition";
import {
  material_brightness_medium_rounded,
  material_menu_rounded,
  material_save_rounded,
  material_settings_rounded,
} from "@chocbite/ts-lib-ui/icons";
import type { SVGFunc } from "@chocbite/ts-lib-ui/svg";
import state from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../../helpers";

const FULL = { width: "48rem" };

//      _                 __     ______  _    _ _______
//     | |         /\     \ \   / / __ \| |  | |__   __|
//     | |        /  \     \ \_/ / |  | | |  | |  | |
//     | |       / /\ \     \   /| |  | | |  | |  | |
//     | |____  / ____ \     | | | |__| | |__| |  | |
//     |______|/_/    \_\    |_|  \____/ \____/   |_|
{
  const sec = section(
    "Layout",
    "Items at the left, in the middle and at the right, each side given as a fixed array. Left must be at the left. Is the bar height right, and does the middle stay centered when the sides differ in width",
  );
  const r = row(sec);
  box(r, "Three sides", FULL).appendChild(
    comp.topbar({
      left: [comp.topbar_button({ icon: material_menu_rounded })],
      mid: [comp.topbar_label({ text: "Page title" })],
      right: [
        comp.topbar_button({ icon: material_save_rounded }),
        comp.topbar_button({ icon: material_settings_rounded }),
      ],
    }),
  );
  box(r, "Wide left side", FULL).appendChild(
    comp.topbar({
      left: [
        comp.topbar_button({ icon: material_menu_rounded, text: "Menu" }),
        comp.topbar_label({ text: "Machine 4, line 2" }),
      ],
      mid: [comp.topbar_label({ text: "Page title" })],
      right: [comp.topbar_button({ icon: material_settings_rounded })],
    }),
  );
  box(r, "Empty bar", FULL).appendChild(comp.topbar());
}

//      ____  _    _ _______ _______ ____  _   _  _____
//     |  _ \| |  | |__   __|__   __/ __ \| \ | |/ ____|
//     | |_) | |  | |  | |     | | | |  | |  \| | (___
//     |  _ <| |  | |  | |     | | | |  | | . ` |\___ \
//     | |_) | |__| |  | |     | | | |__| | |\  |____) |
//     |____/ \____/   |_|     |_|  \____/|_| \_|_____/
{
  const sec = section(
    "Buttons",
    "Icon only, text only, icon and text. Hover each, do icon and text line up and is the hover area the full bar height. Clicks are counted in the label",
  );
  let clicks = 0;
  const count = state.ok_w("0 clicks");
  const click = () => count.set_ok(`${++clicks} clicks`);
  box(row(sec), "Buttons", FULL).appendChild(
    comp.topbar({
      left: [
        comp.topbar_button({ icon: material_save_rounded, on_click: click }),
        comp.topbar_button({ text: "Text", on_click: click }),
        comp.topbar_button({
          icon: material_settings_rounded,
          text: "Icon and text",
          on_click: click,
        }),
      ],
      right: [comp.topbar_label({ text: count })],
    }),
  );
}

//       _____ _______    _______ ______  _____
//      / ____|__   __|/\|__   __|  ____|/ ____|
//     | (___    | |  /  \  | |  | |__  | (___
//      \___ \   | | / /\ \ | |  |  __|  \___ \
//      ____) |  | |/ ____ \| |  | |____ ____) |
//     |_____/   |_/_/    \_\_|  |______|_____/
{
  const sec = section(
    "States",
    "The right side, the title and the button are states. Add and remove items, change the title, swap the icon, and put each into an error: a side in error is empty, a text shows the error, an icon disappears",
  );
  const items = state.from_w<Element[]>([]);
  const title = state.from_w("Title");
  const icons: SVGFunc[] = [
    material_settings_rounded,
    material_save_rounded,
    material_brightness_medium_rounded,
  ];
  let icon_index = 0;
  const icon = state.from_w<SVGFunc | undefined>(icons[0]);
  let added = 0;
  box(row(sec), "Bound to states", FULL).appendChild(
    comp.topbar({
      left: [comp.topbar_button({ icon, text: title })],
      mid: [comp.topbar_label({ text: title })],
      right: items,
    }),
  );
  controls(sec, {
    "Add item right": () =>
      items.set_ok([
        ...(items.get().unwrap_or([]) as Element[]),
        comp.topbar_label({ text: `item ${++added}` }),
      ]),
    "Remove last right": () =>
      items.set_ok((items.get().unwrap_or([]) as Element[]).slice(0, -1)),
    "Change title": () => title.set_ok(`Title ${++added}`),
    "Next icon": () => icon.set_ok(icons[++icon_index % icons.length]),
    "No icon": () => icon.set_ok(undefined),
    Errors: () => {
      items.set_err("no items");
      title.set_err("no title");
      icon.set_err("no icon");
    },
  });
}

//      _   _          _____  _____   ______          __
//     | \ | |   /\   |  __ \|  __ \ / __ \ \        / /
//     |  \| |  /  \  | |__) | |__) | |  | \ \  /\  / /
//     | . ` | / /\ \ |  _  /|  _  /| |  | |\ \/  \/ /
//     | |\  |/ ____ \| | \ \| | \ \| |__| | \  /\  /
//     |_| \_/_/    \_\_|  \_\_|  \_\\____/   \/  \/
{
  const sec = section(
    "Narrow",
    "The same bar in less space. What gives way first, and does anything overlap",
  );
  const r = row(sec);
  for (const width of ["24rem", "16rem"])
    box(r, width, { width }).appendChild(
      comp.topbar({
        left: [
          comp.topbar_button({ icon: material_menu_rounded, text: "Menu" }),
        ],
        mid: [comp.topbar_label({ text: "A rather long page title" })],
        right: [
          comp.topbar_button({ icon: material_save_rounded }),
          comp.topbar_button({ icon: material_settings_rounded }),
        ],
      }),
    );
}
