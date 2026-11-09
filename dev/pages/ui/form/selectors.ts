import type { AccessTypes } from "@chocbite/ts-lib-ui/base";
import form, { type FormSelections } from "@chocbite/ts-lib-ui/form";
import {
  material_dark_mode_rounded,
  material_home_rounded,
  material_light_mode_rounded,
  material_lock_rounded,
  material_person_rounded,
  material_settings_rounded,
  material_star_rounded,
} from "@chocbite/ts-lib-ui/icons";
import { array_from_length } from "@chocbite/ts-lib/common";
import { err, ok } from "@chocbite/ts-lib/result";
import state, { type State } from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../../helpers";

/**Shows the current value of a state as text and follows it*/
function readout<T>(parent: HTMLElement, label: string, value: State<T>) {
  const line = parent.appendChild(document.createElement("div"));
  value.sub(
    (r) =>
      (line.textContent =
        label + ": " + (r.ok ? String(r.value) : "error, " + r.error)),
    true,
  );
  return line;
}

/**A row with some space below, so the labels of the next row do not touch it*/
function spaced_row(parent: HTMLElement) {
  const r = row(parent);
  r.style.marginBottom = "0.75rem";
  return r;
}

const WIDTH = { width: "18rem" };
const LONG =
  "A very long option text that explains the option in far more words than fit";
const ICONS = [
  material_home_rounded,
  material_person_rounded,
  material_settings_rounded,
  material_star_rounded,
  material_lock_rounded,
];

/**Numbered selections, with or without icons*/
const numbered = (count: number, icons: boolean): FormSelections<number> =>
  array_from_length(count, (i) => ({
    value: i,
    text: "Option " + (i + 1),
    icon: icons ? ICONS[i % ICONS.length] : undefined,
  }));

const MIXED: FormSelections<number> = [
  { value: 0, text: "Off" },
  { value: 1, text: LONG, icon: material_star_rounded },
  { value: 2, text: "Auto", icon: material_settings_rounded },
];

//      _______ ____   _____  _____ _      ______
//     |__   __/ __ \ / ____|/ ____| |    |  ____|
//        | | | |  | | |  __| |  __| |    | |__
//        | | | |  | | | |_ | | |_ | |    |  __|
//        | | | |__| | |__| | |__| | |____| |____
//        |_|  \____/ \_____|\_____|______|______|
{
  const sec = section(
    "Toggle buttons",
    "Two to twenty options, with and without icons. With icons the text goes below the icon. Click, or focus and use arrow left / right. How do many options and long texts fit",
  );
  for (const icons of [false, true]) {
    const r = spaced_row(sec);
    for (const count of [2, 3, 5])
      box(r, count + " options" + (icons ? ", icons" : ""), WIDTH).appendChild(
        form.toggle_button({ selections: numbered(count, icons), value: 1 }),
      );
  }
  const many = spaced_row(sec);
  box(many, "20 options, 18rem", WIDTH).appendChild(
    form.toggle_button({ selections: numbered(20, false), value: 7 }),
  );
  box(many, "8 options with icons, 36rem", { width: "36rem" }).appendChild(
    form.toggle_button({ selections: numbered(8, true), value: 3 }),
  );
  const long = spaced_row(sec);
  for (const width of ["10rem", "18rem", "36rem"])
    box(long, width + ", long text, mixed icons", { width }).appendChild(
      form.toggle_button({ selections: MIXED, value: 1 }),
    );
  box(long, "nothing selected", WIDTH).appendChild(
    form.toggle_button({ selections: numbered(3, false) }),
  );
  box(long, "no selections", WIDTH).appendChild(form.toggle_button());
}

//      _____  _____   ____  _____  _____   ______          ___   _
//     |  __ \|  __ \ / __ \|  __ \|  __ \ / __ \ \        / / \ | |
//     | |  | | |__) | |  | | |__) | |  | | |  | \ \  /\  / /|  \| |
//     | |  | |  _  /| |  | |  ___/| |  | | |  | |\ \/  \/ / | . ` |
//     | |__| | | \ \| |__| | |    | |__| | |__| | \  /\  /  | |\  |
//     |_____/|_|  \_\\____/|_|    |_____/ \____/   \/  \/   |_| \_|
{
  const sec = section(
    "Dropdown",
    "Click to open, arrow up / down changes the value without opening. With many options the list scrolls and gets a close line when it covers most of the page. Default text and icon show until something is selected",
  );
  const r = spaced_row(sec);
  box(r, "3 options", WIDTH).appendChild(
    form.dropdown({ selections: numbered(3, false), value: 0 }),
  );
  box(r, "3 options, icons", WIDTH).appendChild(
    form.dropdown({ selections: numbered(3, true), value: 1 }),
  );
  box(r, "long text, mixed icons", WIDTH).appendChild(
    form.dropdown({ selections: MIXED, value: 1 }),
  );
  box(r, "100 options", WIDTH).appendChild(
    form.dropdown({ selections: numbered(100, false), value: 50 }),
  );
  const d = spaced_row(sec);
  box(d, "nothing selected, built in default", WIDTH).appendChild(
    form.dropdown({ selections: numbered(3, false) }),
  );
  box(d, "custom default text", WIDTH).appendChild(
    form.dropdown({
      selections: numbered(3, false),
      default: "Pick a pump",
    }),
  );
  box(d, "default text and icon", WIDTH).appendChild(
    form.dropdown({
      selections: numbered(3, true),
      default: "Pick a pump",
      default_icon: material_settings_rounded,
    }),
  );
  box(d, "long default text", WIDTH).appendChild(
    form.dropdown({ selections: numbered(3, false), default: LONG }),
  );
  const w = spaced_row(sec);
  for (const width of ["6rem", "12rem", "36rem"])
    box(w, width + ", long", { width }).appendChild(
      form.dropdown({ selections: MIXED, value: 1 }),
    );
}

//      ____   ____  _    _ _   _ _____
//     |  _ \ / __ \| |  | | \ | |  __ \
//     | |_) | |  | | |  | |  \| | |  | |
//     |  _ <| |  | | |  | | . ` | |  | |
//     | |_) | |__| | |__| | |\  | |__| |
//     |____/ \____/ \____/|_| \_|_____/
{
  const sec = section(
    "Bound to states",
    "Toggle and dropdown share one state, the buttons set it from outside (Set 9 is not an option, both should show nothing selected). The rejecting pair refuses option 3, it should warn and stay",
  );
  const shared = state.ok_w(1);
  const rejecting = state.rosw(ok(0), async (v, s) =>
    v === 2 ? err("Option 3 is not allowed") : (s.set_ok(v), ok(undefined)),
  );
  const access = state.ok_w<AccessTypes>("w");
  controls(sec, {
    "Set 0": () => shared.set_ok(0),
    "Set 3": () => shared.set_ok(3),
    "Set 9": () => shared.set_ok(9),
    "Access write": () => access.set_ok("w"),
    "Access read": () => access.set_ok("r"),
    "Access none": () => access.set_ok("n"),
  });
  const r = spaced_row(sec);
  const t = box(r, "toggle, access from state", WIDTH);
  t.appendChild(
    form
      .toggle_button({ selections: numbered(5, true) })
      .opts({ access })
      .bind({ value: shared }),
  );
  readout(t, "state", shared);
  box(r, "dropdown, access from state", WIDTH).appendChild(
    form
      .dropdown({ selections: numbered(5, true) })
      .opts({ access })
      .bind({ value: shared }),
  );
  const j = spaced_row(sec);
  const jt = box(j, "toggle, rejects option 3", WIDTH);
  jt.appendChild(
    form
      .toggle_button({ selections: numbered(4, false) })
      .bind({ value: rejecting }),
  );
  readout(jt, "state", rejecting);
  box(j, "dropdown, rejects option 3", WIDTH).appendChild(
    form
      .dropdown({ selections: numbered(4, false) })
      .bind({ value: rejecting }),
  );
  const changes = box(j, "unbound, change listener", WIDTH);
  const line = document.createElement("div");
  line.textContent = "change: -";
  changes.appendChild(
    form.toggle_button({
      selections: numbered(3, false),
      change: (v) => (line.textContent = "change: " + v),
    }),
  );
  changes.appendChild(line);
}

//      ______ _   _ _    _ __  __
//     |  ____| \ | | |  | |  \/  |
//     | |__  |  \| | |  | | \  / |
//     |  __| | . ` | |  | | |\/| |
//     | |____| |\  | |__| | |  | |
//     |______|_| \_|\____/|_|  |_|
{
  const sec = section(
    "Selections from an enum state",
    "No selections are given, they come from the enum helper list of the state, names and icons included. The buttons swap the list while the elements show it",
  );
  type Mode = "light" | "dark" | "auto";
  const full = state.e.list<Mode>({
    light: { name: "Light", icon: material_light_mode_rounded },
    dark: { name: "Dark", icon: material_dark_mode_rounded },
    auto: { name: "Follow the operating system", icon: material_settings_rounded },
  });
  const list = state.ok_w(full);
  const mode = state.rosw(state.e.help(ok<Mode>("dark"), { list }), true);
  controls(sec, {
    "Full list": () => list.set_ok(full),
    "Renamed, no icons": () =>
      list.set_ok({
        light: { name: "Day" },
        dark: { name: "Night" },
        auto: { name: "Auto" },
      }),
    "Set light": () => mode.set_ok("light"),
    "Set auto": () => mode.set_ok("auto"),
  });
  const r = spaced_row(sec);
  const t = box(r, "toggle", WIDTH);
  t.appendChild(form.toggle_button().bind({ value: mode }));
  readout(t, "state", mode);
  box(r, "dropdown", WIDTH).appendChild(form.dropdown().bind({ value: mode }));
}

{
  const sec = section(
    "Dropdown near the bottom",
    "Below the middle of the window the list should open upwards. Scroll so this sits low in the window and open it",
  );
  const r = spaced_row(sec);
  box(r, "10 options", WIDTH).appendChild(
    form.dropdown({ selections: numbered(10, true), value: 4 }),
  );
  box(r, "100 options", WIDTH).appendChild(
    form.dropdown({ selections: numbered(100, false), value: 99 }),
  );
}
