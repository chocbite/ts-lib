import type { AccessTypes } from "@chocbite/ts-lib-ui/base";
import form, { FormColors } from "@chocbite/ts-lib-ui/form";
import {
  material_bolt_rounded,
  material_lightbulb_rounded,
  material_power_settings_new_rounded,
  material_warning_rounded,
  material_wifi_rounded,
} from "@chocbite/ts-lib-ui/icons";
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

const COLORS = Object.entries(FormColors);
const WIDTH = { width: "14rem" };

//       _______          _______ _______ _____ _    _
//      / ____\ \        / /_   _|__   __/ ____| |  | |
//     | (___  \ \  /\  / /  | |    | | | |    | |__| |
//      \___ \  \ \/  \/ /   | |    | | | |    |  __  |
//      ____) |  \  /\  /   _| |_   | | | |____| |  | |
//     |_____/    \/  \/   |_____|  |_|  \_____|_|  |_|
{
  const sec = section(
    "Switch",
    "Off and on, with and without icon, in different widths. Click, drag the knob left and right, and use space / enter with focus. Does the switch keep its size when the box shrinks",
  );
  for (const width of ["4rem", "10rem", "20rem"]) {
    const r = spaced_row(sec);
    box(r, width + ", off", { width }).appendChild(form.switch());
    box(r, width + ", on", { width }).appendChild(form.switch({ value: true }));
    box(r, width + ", icon", { width }).appendChild(
      form.switch({ icon: material_wifi_rounded, value: true }),
    );
  }
  const free = spaced_row(sec);
  box(free, "no width").appendChild(form.switch({ value: true }));
  box(free, "no width, icon").appendChild(
    form.switch({ icon: material_lightbulb_rounded }),
  );
}

{
  const sec = section(
    "Switch colors",
    "Every FormColors value as on color (top, switched on) and as off color (bottom, switched off). Is the knob visible on each, can on and off be told apart (off Black looks like the default on)",
  );
  const on = spaced_row(sec);
  const off = spaced_row(sec);
  for (const [name, color] of COLORS) {
    box(on, "on_color " + name, { width: "9rem" }).appendChild(
      form.switch({ on_color: color, value: true, icon: material_bolt_rounded }),
    );
    box(off, "off_color " + name, { width: "9rem" }).appendChild(
      form.switch({ off_color: color, value: false, icon: material_bolt_rounded }),
    );
  }
  const both = spaced_row(sec);
  box(both, "off red, on green", WIDTH).appendChild(
    form.switch({
      off_color: FormColors.Red,
      on_color: FormColors.Green,
      icon: material_power_settings_new_rounded,
    }),
  );
  box(both, "off red, on green, on", WIDTH).appendChild(
    form.switch({
      off_color: FormColors.Red,
      on_color: FormColors.Green,
      icon: material_power_settings_new_rounded,
      value: true,
    }),
  );
}

{
  const sec = section(
    "Switch bound to states, errors and access",
    "All switches share one state. Set error puts it in error, the switch shows its error look, the error_color one (yellow) is only settable through opts. The rejecting one writes to a state that refuses every write",
  );
  const shared = state.from_w(false);
  const access = state.ok_w<AccessTypes>("w");
  controls(sec, {
    "Set on": () => shared.set_ok(true),
    "Set off": () => shared.set_ok(false),
    "Set error": () => shared.set_err("Sensor offline"),
    "Access write": () => access.set_ok("w"),
    "Access read": () => access.set_ok("r"),
    "Access none": () => access.set_ok("n"),
  });
  const r = spaced_row(sec);
  const a = box(r, "bound", WIDTH);
  a.appendChild(form.switch({ icon: material_wifi_rounded }).bind({ value: shared }));
  readout(a, "state", shared);
  box(r, "bound, error_color yellow", WIDTH).appendChild(
    form
      .switch({ icon: material_wifi_rounded })
      .opts({ error_color: FormColors.Yellow })
      .bind({ value: shared }),
  );
  const s = box(r, "bound, access from state", WIDTH);
  s.appendChild(
    form
      .switch({ icon: material_wifi_rounded })
      .opts({ access })
      .bind({ value: shared }),
  );
  readout(s, "access", access);
  box(r, "starts in error", WIDTH).appendChild(
    form
      .switch({ icon: material_warning_rounded })
      .bind({ value: state.err_w<boolean>("Never had a value") }),
  );
  const rejecting = state.rosw(ok(false), async () => err("Not allowed"));
  box(r, "state rejects writes", WIDTH).appendChild(
    form.switch().bind({ value: rejecting }),
  );
  const fixed = spaced_row(sec);
  box(fixed, "read, on", WIDTH).appendChild(
    form.switch({ value: true }).opts({ access: "r" }),
  );
  box(fixed, "read, off", WIDTH).appendChild(
    form.switch({ value: false }).opts({ access: "r" }),
  );
  box(fixed, "description (hover)", WIDTH).appendChild(
    form.switch({ description: "Turns the radio on and off" }),
  );
}

//      _                __  __ _____
//     | |        /\    |  \/  |  __ \
//     | |       /  \   | \  / | |__) |
//     | |      / /\ \  | |\/| |  ___/
//     | |____ / ____ \ | |  | | |
//     |______/_/    \_\|_|  |_|_|
{
  const sec = section(
    "Lamp content",
    "Text, icon, both, centered, and nothing. Lamps are read only, they should not look clickable on hover",
  );
  const colors: [FormColors, FormColors] = [FormColors.Black, FormColors.Green];
  const r = spaced_row(sec);
  box(r, "text", WIDTH).appendChild(
    form.lamp({ text: "Running", colors, value: true }),
  );
  box(r, "icon", WIDTH).appendChild(
    form.lamp({ icon: material_bolt_rounded, colors, value: true }),
  );
  box(r, "icon + text", WIDTH).appendChild(
    form.lamp({ text: "Running", icon: material_bolt_rounded, colors, value: true }),
  );
  box(r, "nothing", WIDTH).appendChild(form.lamp({ colors, value: true }));
  const c = spaced_row(sec);
  box(c, "center, text", WIDTH).appendChild(
    form.lamp({ text: "Running", colors, value: true, center: true }),
  );
  box(c, "center, icon", WIDTH).appendChild(
    form.lamp({ icon: material_bolt_rounded, colors, value: true, center: true }),
  );
  box(c, "center, icon + text", WIDTH).appendChild(
    form.lamp({
      text: "Running",
      icon: material_bolt_rounded,
      colors,
      value: true,
      center: true,
    }),
  );
  box(c, "no value yet", WIDTH).appendChild(
    form.lamp({ text: "No value", icon: material_bolt_rounded, colors }),
  );
  const long =
    "A long status text that describes the state of the machine in detail";
  const w = spaced_row(sec);
  for (const width of ["6rem", "14rem", "28rem"])
    box(w, width + ", long", { width }).appendChild(
      form.lamp({
        text: long,
        icon: material_warning_rounded,
        colors: [FormColors.None, FormColors.Yellow],
        value: true,
      }),
    );
}

{
  const sec = section(
    "Lamp colors",
    "Every FormColors value as the lit color. Is the text and icon readable on each",
  );
  const r = spaced_row(sec);
  for (const [name, color] of COLORS)
    box(r, name, { width: "9rem" }).appendChild(
      form.lamp({
        text: name,
        icon: material_lightbulb_rounded,
        colors: [FormColors.None, color],
        value: true,
      }),
    );
}

{
  const sec = section(
    "Lamps bound to states",
    "A boolean lamp follows the switch, a number lamp has one color per value (0 none, 1 green, 2 yellow, 3 red, 4 has no color). Set error puts the number state in error, lamps only log it",
  );
  const on = state.ok_w(false);
  const level = state.from_w(0);
  controls(sec, {
    "Level 0": () => level.set_ok(0),
    "Level 1": () => level.set_ok(1),
    "Level 2": () => level.set_ok(2),
    "Level 3": () => level.set_ok(3),
    "Level 4": () => level.set_ok(4),
    "Level error": () => level.set_err("Unknown level"),
  });
  const r = spaced_row(sec);
  const b = box(r, "boolean, switch drives it", WIDTH);
  b.appendChild(form.switch({ icon: material_power_settings_new_rounded }).bind({ value: on }));
  b.appendChild(
    form
      .lamp({
        text: "Power",
        icon: material_power_settings_new_rounded,
        colors: [FormColors.Red, FormColors.Green],
      })
      .bind({ value: on }),
  );
  const n = box(r, "number, 4 colors", WIDTH);
  n.appendChild(
    form
      .lamp({
        text: "Alarm level",
        icon: material_warning_rounded,
        colors: [
          FormColors.None,
          FormColors.Green,
          FormColors.Yellow,
          FormColors.Red,
        ],
      })
      .bind({ value: level }),
  );
  readout(n, "level", level);
  box(r, "read access", WIDTH).appendChild(
    form
      .lamp({ text: "Read access", colors: [FormColors.None, FormColors.Blue] })
      .opts({ access: "r" })
      .bind({ value: on }),
  );
}
