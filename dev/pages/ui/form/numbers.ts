import type { AccessTypes } from "@chocbite/ts-lib-ui/base";
import form from "@chocbite/ts-lib-ui/form";
import {
  material_arrow_downward_rounded,
  material_arrow_upward_rounded,
  material_volume_down_rounded,
  material_volume_up_rounded,
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

const WIDTH = { width: "16rem" };

/**Option sets shown for every number element, from bare to everything*/
const VARIANTS = [
  ["no options", {}],
  ["unit", { unit: "mA" }],
  ["min 0, max 100", { min: 0, max: 100, unit: "%" }],
  ["min -50, max 50, 1 decimal", { min: -50, max: 50, decimals: 1, unit: "°C" }],
  ["step 0.5, start 0.1, 2 dec", { step: 0.5, start: 0.1, decimals: 2, unit: "V" }],
  [
    "big range, long unit",
    { min: -1000000, max: 1000000, decimals: 3, unit: "kWh/month" },
  ],
] as const;

//      _____ _   _ _____  _    _ _______
//     |_   _| \ | |  __ \| |  | |__   __|
//       | | |  \| | |__) | |  | |  | |
//       | | | . ` |  ___/| |  | |  | |
//      _| |_| |\  | |    | |__| |  | |
//     |_____|_| \_|_|     \____/   |_|
{
  const sec = section(
    "Number input",
    "Type a value and press enter or leave, arrow up / down steps, escape reverts. Letters are blocked, a dot is blocked without decimals and minus is blocked with min >= 0. Check the min / max legend and unit placement",
  );
  const r = spaced_row(sec);
  for (const [label, opts] of VARIANTS)
    box(r, label, WIDTH).appendChild(
      form.number_input({ ...opts, value: 12 }),
    );
  const w = spaced_row(sec);
  for (const width of ["5rem", "10rem", "24rem"])
    box(w, width + ", limits and long unit", { width }).appendChild(
      form.number_input({
        min: -1000,
        max: 1000,
        decimals: 2,
        unit: "litres per hour",
        value: 999.99,
      }),
    );
  box(w, "no value yet", WIDTH).appendChild(
    form.number_input({ min: 0, max: 10, unit: "s" }),
  );
}

//       _____ _______ ______ _____  _____  ______ _____
//      / ____|__   __|  ____|  __ \|  __ \|  ____|  __ \
//     | (___    | |  | |__  | |__) | |__) | |__  | |__) |
//      \___ \   | |  |  __| |  ___/|  ___/|  __| |  _  /
//      ____) |  | |  | |____| |    | |    | |____| | \ \
//     |_____/   |_|  |______|_|    |_|    |______|_|  \_\
{
  const sec = section(
    "Stepper",
    "Click or hold the + and - icons (holding speeds up), drag the value sideways, click the value to type. Arrow left / right with focus. Live writes while dragging, the others only when released",
  );
  const r = spaced_row(sec);
  for (const [label, opts] of VARIANTS)
    box(r, label, WIDTH).appendChild(form.stepper({ ...opts, value: 12 }));
  const live = state.ok_w(0);
  const s = spaced_row(sec);
  const l = box(s, "live, min -10, max 10", WIDTH);
  l.appendChild(form.stepper({ min: -10, max: 10, live: true }).bind({ value: live }));
  readout(l, "state", live);
  const n = box(s, "not live, same state", WIDTH);
  n.appendChild(form.stepper({ min: -10, max: 10 }).bind({ value: live }));
  box(s, "custom icons", WIDTH).appendChild(
    form.stepper({
      icon_decrease: material_volume_down_rounded,
      icon_increase: material_volume_up_rounded,
      min: 0,
      max: 100,
      unit: "%",
      value: 50,
    }),
  );
  for (const width of ["6rem", "24rem"])
    box(s, width, { width }).appendChild(
      form.stepper({ min: 0, max: 1000, unit: "rpm", value: 250 }),
    );
  box(s, "no value yet", WIDTH).appendChild(form.stepper({ unit: "s" }));
}

//       _____ _      _____ _____  ______ _____
//      / ____| |    |_   _|  __ \|  ____|  __ \
//     | (___ | |      | | | |  | | |__  | |__) |
//      \___ \| |      | | | |  | |  __| |  _  /
//      ____) | |____ _| |_| |__| | |____| | \ \
//     |_____/|______|_____|_____/|______|_|  \_\
{
  const sec = section(
    "Slider",
    "With both min and max the knob is absolute, drag it or click the track. Without limits it is a jog wheel, drag away from the middle to keep changing the value, it springs back on release. Escape while dragging reverts",
  );
  const r = spaced_row(sec);
  for (const [label, opts] of VARIANTS)
    box(r, label, WIDTH).appendChild(form.slider({ ...opts, value: 12 }));
  const live = state.ok_w(25);
  const s = spaced_row(sec);
  const l = box(s, "live, 0 to 100", WIDTH);
  l.appendChild(
    form.slider({ min: 0, max: 100, unit: "%", live: true }).bind({ value: live }),
  );
  readout(l, "state", live);
  box(s, "not live, same state", WIDTH).appendChild(
    form.slider({ min: 0, max: 100, unit: "%" }).bind({ value: live }),
  );
  box(s, "step 10, same state", WIDTH).appendChild(
    form.slider({ min: 0, max: 100, step: 10, unit: "%" }).bind({ value: live }),
  );
  box(s, "custom icons", WIDTH).appendChild(
    form.slider({
      icon_decrease: material_arrow_downward_rounded,
      icon_increase: material_arrow_upward_rounded,
      min: 0,
      max: 10,
      value: 3,
    }),
  );
  for (const width of ["6rem", "32rem"])
    box(s, width, { width }).appendChild(
      form.slider({ min: -100, max: 100, decimals: 1, unit: "Nm", value: -33.3 }),
    );
  box(s, "no value yet", WIDTH).appendChild(
    form.slider({ min: 0, max: 10 }),
  );
}

//      _____  _____   ____   _____ _____  ______  _____ _____
//     |  __ \|  __ \ / __ \ / ____|  __ \|  ____|/ ____/ ____|
//     | |__) | |__) | |  | | |  __| |__) | |__  | (___| (___
//     |  ___/|  _  /| |  | | | |_ |  _  /|  __|  \___ \\___ \
//     | |    | | \ \| |__| | |__| | | \ \| |____ ____) |___) |
//     |_|    |_|  \_\\____/ \_____|_|  \_\______|_____/_____/
{
  const sec = section(
    "Progress",
    "Read only bar. The buttons move all bars, including past the ends (-20 and 130) which should clamp the bar but show the real number. The right ones have a range of -50 to 50 and 0 to 1000",
  );
  const value = state.ok_w(40);
  const values = [-20, 0, 1, 33.333, 50, 99.5, 100, 130];
  //Labels are not plain numbers, object keys that look like integers would be sorted first
  controls(
    sec,
    Object.fromEntries(
      values.map((v) => ["Set " + v, () => value.set_ok(v)] as const),
    ),
  );
  const r = spaced_row(sec);
  box(r, "default 0 - 100", WIDTH).appendChild(
    form.progress().bind({ value }),
  );
  box(r, "unit %, 1 decimal", WIDTH).appendChild(
    form.progress({ unit: "%", decimals: 1 }).bind({ value }),
  );
  box(r, "min -50, max 50", WIDTH).appendChild(
    form.progress({ min: -50, max: 50, unit: "°C" }).bind({ value }),
  );
  box(r, "max 1000, long unit", WIDTH).appendChild(
    form.progress({ max: 1000, unit: "items processed" }).bind({ value }),
  );
  const w = spaced_row(sec);
  for (const width of ["5rem", "10rem", "32rem"])
    box(w, width, { width }).appendChild(
      form.progress({ unit: "%", decimals: 2 }).bind({ value }),
    );
  box(w, "no value yet", WIDTH).appendChild(form.progress({ unit: "%" }));
}

//      _____  ______ _               _______ ______ _____
//     |  __ \|  ____| |        /\   |__   __|  ____|  __ \
//     | |__) | |__  | |       /  \     | |  | |__  | |  | |
//     |  _  /|  __| | |      / /\ \    | |  |  __| | |  | |
//     | | \ \| |____| |____ / ____ \   | |  | |____| |__| |
//     |_|  \_\______|______/_/    \_\  |_|  |______|_____/
{
  const sec = section(
    "Limits from the state",
    "All four are bound to one state with a number helper, min, max, step, decimals and unit come from related states. Change them with the buttons, legends and units should follow, and the elements should respect the new limits",
  );
  const min = state.ok_w(0);
  const max = state.ok_w(100);
  const step = state.ok_w(0);
  const decimals = state.ok_w(0);
  const unit = state.ok_w("%");
  const value = state.rosw(
    state.n.help(ok(20), { min, max, step, decimals, unit }),
    true,
  );
  controls(sec, {
    "Range 0 - 100": () => (min.set_ok(0), max.set_ok(100)),
    "Range -10 - 10": () => (min.set_ok(-10), max.set_ok(10)),
    "Range 0 - 5000": () => (min.set_ok(0), max.set_ok(5000)),
    "Step 0": () => step.set_ok(0),
    "Step 5": () => step.set_ok(5),
    "Decimals 0": () => decimals.set_ok(0),
    "Decimals 2": () => decimals.set_ok(2),
    "Unit %": () => unit.set_ok("%"),
    "Unit bar": () => unit.set_ok("bar"),
    "Value 7": () => value.set_ok(7),
  });
  const r = spaced_row(sec);
  const i = box(r, "number input", WIDTH);
  i.appendChild(form.number_input().bind({ value }));
  readout(i, "state", value);
  box(r, "stepper", WIDTH).appendChild(form.stepper().bind({ value }));
  box(r, "slider", WIDTH).appendChild(form.slider().bind({ value }));
  box(r, "progress", WIDTH).appendChild(form.progress().bind({ value }));
}

//      ______ _____  _____   ____  _____   _____
//     |  ____|  __ \|  __ \ / __ \|  __ \ / ____|
//     | |__  | |__) | |__) | |  | | |__) | (___
//     |  __| |  _  /|  _  /| |  | |  _  / \___ \
//     | |____| | \ \| | \ \| |__| | | \ \ ____) |
//     |______|_|  \_\_|  \_\\____/|_|  \_\_____/
{
  const sec = section(
    "Rejected writes, errors and access",
    "The state refuses values between 3 and 6 (exclusive), try to step or slide into them, it should warn and go back. Set error puts the state in error, none of the number elements show it (slider, stepper and progress only log it). Access applies to all four",
  );
  const value = state.from_w(0);
  const guarded = state.rosw(ok(0), async (v, s) =>
    v > 3 && v < 6 ? err("Values between 3 and 6 are not allowed") : (s.set_ok(v), ok(undefined)),
  );
  const access = state.ok_w<AccessTypes>("w");
  controls(sec, {
    "Set error": () => value.set_err("Sensor disconnected"),
    "Set 8": () => value.set_ok(8),
    "Access write": () => access.set_ok("w"),
    "Access read": () => access.set_ok("r"),
    "Access none": () => access.set_ok("n"),
  });
  const g = spaced_row(sec);
  const gi = box(g, "input, rejects 3 - 6", WIDTH);
  gi.appendChild(form.number_input({ step: 1 }).bind({ value: guarded }));
  readout(gi, "state", guarded);
  box(g, "stepper, rejects 3 - 6", WIDTH).appendChild(
    form.stepper({ step: 1 }).bind({ value: guarded }),
  );
  box(g, "slider 0 - 10, rejects 3 - 6", WIDTH).appendChild(
    form.slider({ min: 0, max: 10, live: true }).bind({ value: guarded }),
  );
  const e = spaced_row(sec);
  const ei = box(e, "input, errorable, access", WIDTH);
  ei.appendChild(form.number_input({ unit: "A" }).opts({ access }).bind({ value }));
  readout(ei, "state", value);
  box(e, "stepper, errorable, access", WIDTH).appendChild(
    form.stepper({ unit: "A" }).opts({ access }).bind({ value }),
  );
  box(e, "slider, errorable, access", WIDTH).appendChild(
    form.slider({ min: 0, max: 10, unit: "A" }).opts({ access }).bind({ value }),
  );
  box(e, "progress, errorable, access", WIDTH).appendChild(
    form.progress({ max: 10, unit: "A" }).opts({ access }).bind({ value }),
  );
}
