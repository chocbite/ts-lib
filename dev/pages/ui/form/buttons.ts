import type { AccessTypes } from "@chocbite/ts-lib-ui/base";
import form, { FormColors } from "@chocbite/ts-lib-ui/form";
import {
  material_delete_rounded,
  material_play_arrow_rounded,
  material_power_settings_new_rounded,
  material_save_rounded,
  material_settings_rounded,
  material_stop_rounded,
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

//      ____           _____ _____ _____
//     |  _ \   /\    / ____|_   _/ ____|
//     | |_) | /  \  | (___   | || |
//     |  _ < / /\ \  \___ \  | || |
//     | |_) / ____ \ ____) |_| || |____
//     |____/_/    \_\_____/|_____\_____|
{
  const sec = section(
    "Content",
    "Text only, icon only, icon and text, left aligned and centered. Hover, press and focus (tab) each, do the icon and text line up",
  );
  const r = spaced_row(sec);
  box(r, "text", WIDTH).appendChild(form.button({ text: "Save" }));
  box(r, "icon", WIDTH).appendChild(
    form.button({ icon: material_save_rounded }),
  );
  box(r, "icon + text", WIDTH).appendChild(
    form.button({ text: "Save", icon: material_save_rounded }),
  );
  box(r, "no options", WIDTH).appendChild(form.button());
  const c = spaced_row(sec);
  box(c, "center, text", WIDTH).appendChild(
    form.button({ text: "Save", center: true }),
  );
  box(c, "center, icon", WIDTH).appendChild(
    form.button({ icon: material_save_rounded, center: true }),
  );
  box(c, "center, icon + text", WIDTH).appendChild(
    form.button({ text: "Save", icon: material_save_rounded, center: true }),
  );
}

//      _____ _____ ____________  _____
//     / ____|_   _|___  /  ____|/ ____|
//    | (___   | |    / /| |__  | (___
//     \___ \  | |   / / |  __|  \___ \
//     ____) |_| |_ / /__| |____ ____) |
//    |_____/|_____/_____|______|_____/
{
  const sec = section(
    "Widths and long text",
    "The same buttons in boxes from 4rem to 32rem, and as plain blocks in a row without a width. How does long text wrap or overflow, does the icon shrink",
  );
  const long =
    "A long label that explains far too much about what the button is going to do when pressed";
  for (const width of ["4rem", "8rem", "16rem", "32rem"]) {
    const r = spaced_row(sec);
    box(r, width + ", short", { width }).appendChild(
      form.button({ text: "Start", icon: material_play_arrow_rounded }),
    );
    box(r, width + ", long", { width }).appendChild(
      form.button({ text: long, icon: material_play_arrow_rounded }),
    );
    box(r, width + ", long centered", { width }).appendChild(
      form.button({ text: long, icon: material_play_arrow_rounded, center: true }),
    );
  }
  const free = spaced_row(sec);
  box(free, "no width, short").appendChild(form.button({ text: "OK" }));
  box(free, "no width, icon").appendChild(
    form.button({ icon: material_settings_rounded }),
  );
  box(free, "no width, long").appendChild(form.button({ text: long }));
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
    "Every FormColors value, top row released, bottom row held (toggled on). Is the text readable on each, can on and off be told apart, does hover still show",
  );
  const released = spaced_row(sec);
  const held = spaced_row(sec);
  for (const [name, color] of COLORS) {
    box(released, name, { width: "9rem" }).appendChild(
      form.button({
        text: name,
        icon: material_power_settings_new_rounded,
        color,
        toggle: true,
      }),
    );
    box(held, name + ", on", { width: "9rem" }).appendChild(
      form.button({
        text: name,
        icon: material_power_settings_new_rounded,
        color,
        toggle: true,
        value: true,
      }),
    );
  }
}

//      __  __  ____  _____  ______  _____
//     |  \/  |/ __ \|  __ \|  ____|/ ____|
//     | \  / | |  | | |  | | |__  | (___
//     | |\/| | |  | | |  | |  __|  \___ \
//     | |  | | |__| | |__| | |____ ____) |
//     |_|  |_|\____/|_____/|______|_____/
{
  const sec = section(
    "Momentary and toggle, bound to states",
    "Momentary is on while held, toggle flips on release. The lamps and lines follow the states, the plain buttons set the states from outside. Try pressing and dragging off the button, and space / enter with focus",
  );
  const momentary = state.ok_w(false);
  const toggled = state.ok_w(false);
  const clicks = state.ok_w(0);
  controls(sec, {
    "Momentary on": () => momentary.set_ok(true),
    "Momentary off": () => momentary.set_ok(false),
    "Toggle on": () => toggled.set_ok(true),
    "Toggle off": () => toggled.set_ok(false),
    "Reset clicks": () => clicks.set_ok(0),
  });
  const r = spaced_row(sec);
  const m = box(r, "momentary", WIDTH);
  m.appendChild(
    form
      .button({
        text: "Hold me",
        icon: material_play_arrow_rounded,
        on_click: () => clicks.set_ok(clicks.ok() + 1),
      })
      .bind({ value: momentary }),
  );
  m.appendChild(
    form
      .lamp({
        text: "Held",
        colors: [FormColors.None, FormColors.Green],
      })
      .bind({ value: momentary }),
  );
  readout(m, "value", momentary);
  readout(m, "on_click calls", clicks);
  const t = box(r, "toggle", WIDTH);
  t.appendChild(
    form
      .button({ text: "Toggle me", icon: material_stop_rounded, toggle: true })
      .bind({ value: toggled }),
  );
  t.appendChild(
    form
      .button({
        text: "Same state, yellow",
        icon: material_stop_rounded,
        toggle: true,
        color: FormColors.Yellow,
      })
      .bind({ value: toggled }),
  );
  readout(t, "value", toggled);
  const plain = box(r, "not bound, change listener", WIDTH);
  const changes = plain.appendChild(document.createElement("div"));
  changes.textContent = "change: -";
  plain.appendChild(
    form.button({
      text: "Toggle, unbound",
      toggle: true,
      change: (v) => (changes.textContent = "change: " + v),
    }),
  );
}

//               _____ _____ ______  _____ _____
//         /\   / ____/ ____|  ____|/ ____/ ____|
//        /  \ | |   | |    | |__  | (___| (___
//       / /\ \| |   | |    |  __|  \___ \\___ \
//      / ____ \ |___| |____| |____ ____) |___) |
//     /_/    \_\_____\_____|______|_____/_____/
{
  const sec = section(
    "Access and description",
    "Write, read and none side by side, and one driven by a state. Read should look disabled and not react, none hides it. Hover the right one for its description tooltip",
  );
  const access = state.ok_w<AccessTypes>("w");
  controls(sec, {
    "State: write": () => access.set_ok("w"),
    "State: read": () => access.set_ok("r"),
    "State: none": () => access.set_ok("n"),
  });
  const r = spaced_row(sec);
  for (const [label, a] of [
    ["write", "w"],
    ["read", "r"],
    ["none", "n"],
  ] as const)
    box(r, label, WIDTH).appendChild(
      form
        .button({ text: "Delete", icon: material_delete_rounded, toggle: true, value: true, color: FormColors.Red })
        .opts({ access: a }),
    );
  const s = box(r, "from state", WIDTH);
  s.appendChild(
    form
      .button({ text: "Delete", icon: material_delete_rounded })
      .opts({ access }),
  );
  readout(s, "access", access);
  box(r, "description", WIDTH).appendChild(
    form.button({
      text: "Hover me",
      description: "Deletes everything, this text is the description",
    }),
  );
}

//      ______ _____  _____   ____  _____
//     |  ____|  __ \|  __ \ / __ \|  __ \
//     | |__  | |__) | |__) | |  | | |__) |
//     |  __| |  _  /|  _  /| |  | |  _  /
//     | |____| | \ \| | \ \| |__| | | \ \
//     |______|_|  \_\_|  \_\\____/|_|  \_\
{
  const sec = section(
    "State errors and rejected writes",
    "Set error puts the bound state in error, the button has no error look yet (it only logs to the console). The right button writes to a state that rejects every write, it should warn and fall back",
  );
  const value = state.from_w(false);
  controls(sec, {
    "Set error": () => value.set_err("Device not reachable"),
    "Set ok false": () => value.set_ok(false),
    "Set ok true": () => value.set_ok(true),
  });
  const r = spaced_row(sec);
  const e = box(r, "errorable state", WIDTH);
  e.appendChild(
    form.button({ text: "Errorable", toggle: true }).bind({ value }),
  );
  readout(e, "state", value);
  const rejecting = state.rosw(ok(false), async () =>
    err("Rejected by the state"),
  );
  const j = box(r, "state rejects writes", WIDTH);
  j.appendChild(
    form.button({ text: "Rejected", toggle: true }).bind({ value: rejecting }),
  );
  readout(j, "state", rejecting);
}
