import type { AccessTypes } from "@chocbite/ts-lib-ui/base";
import form, {
  FormDateTimeMode,
  FormDateTimeType,
} from "@chocbite/ts-lib-ui/form";
import { IPAddress, IPVersion } from "@chocbite/ts-lib/common";
import { err, ok } from "@chocbite/ts-lib/result";
import state, { type State } from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../../helpers";

/**Shows the current value of a state as text and follows it*/
function readout<T>(
  parent: HTMLElement,
  label: string,
  value: State<T>,
  format: (v: T) => string = String,
) {
  const line = parent.appendChild(document.createElement("div"));
  value.sub(
    (r) =>
      (line.textContent =
        label + ": " + (r.ok ? format(r.value) : "error, " + r.error)),
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

//      _____ _____
//     |_   _|  __ \
//       | | | |__) |
//       | | |  ___/
//      _| |_| |
//     |_____|_|
{
  const sec = section(
    "IP address",
    "Type digits, a dot / colon / comma jumps to the next part, a full part jumps on by itself, backspace in an empty part goes back. Paste a whole address, copy gives the whole address. Enter or leaving writes it, escape reverts",
  );
  const r = spaced_row(sec);
  box(r, "IPv4, empty", WIDTH).appendChild(form.ip({ type: IPVersion.V4 }));
  box(r, "IPv4", WIDTH).appendChild(
    form.ip({ type: IPVersion.V4, value: new IPAddress("192.168.1.1") }),
  );
  box(r, "IPv4, max digits", WIDTH).appendChild(
    form.ip({ type: IPVersion.V4, value: new IPAddress("255.255.255.255") }),
  );
  const v6 = spaced_row(sec);
  box(v6, "IPv6, empty", WIDTH).appendChild(form.ip({ type: IPVersion.V6 }));
  box(v6, "IPv6, short", WIDTH).appendChild(
    form.ip({ type: IPVersion.V6, value: new IPAddress("2001:db8::1") }),
  );
  box(v6, "IPv6, full, 32rem", { width: "32rem" }).appendChild(
    form.ip({
      type: IPVersion.V6,
      value: new IPAddress("fe80:1234:abcd:ffff:ffff:5678:9abc:def0"),
    }),
  );
  const w = spaced_row(sec);
  for (const width of ["6rem", "10rem"])
    box(w, width + ", IPv4", { width }).appendChild(
      form.ip({ type: IPVersion.V4, value: new IPAddress("10.0.0.254") }),
    );
  box(w, "10rem, IPv6", { width: "10rem" }).appendChild(
    form.ip({
      type: IPVersion.V6,
      value: new IPAddress("fe80:1234:abcd:ffff:ffff:5678:9abc:def0"),
    }),
  );
}

{
  const sec = section(
    "IP address bound to states",
    "Both share one state. Setting an IPv6 address on an IPv4 input switches it to IPv6. The rejecting one refuses addresses outside 10.x.x.x",
  );
  const shared = state.ok_w(new IPAddress("192.168.0.10"));
  const rejecting = state.rosw(ok(new IPAddress("10.0.0.1")), async (v, s) =>
    v.as_array[0] === 10 && v.is_v4
      ? (s.set_ok(v), ok(undefined))
      : err("Only 10.x.x.x addresses are allowed"),
  );
  const access = state.ok_w<AccessTypes>("w");
  controls(sec, {
    "Set 192.168.0.10": () => shared.set_ok(new IPAddress("192.168.0.10")),
    "Set 8.8.8.8": () => shared.set_ok(new IPAddress("8.8.8.8")),
    "Set ::1 (IPv6)": () => shared.set_ok(new IPAddress("::1")),
    "Access write": () => access.set_ok("w"),
    "Access read": () => access.set_ok("r"),
    "Access none": () => access.set_ok("n"),
  });
  const r = spaced_row(sec);
  const a = box(r, "shared", WIDTH);
  a.appendChild(form.ip({ type: IPVersion.V4 }).bind({ value: shared }));
  readout(a, "state", shared, (v) => v.to_string());
  box(r, "shared, access from state", WIDTH).appendChild(
    form.ip({ type: IPVersion.V4 }).opts({ access }).bind({ value: shared }),
  );
  const j = box(r, "only 10.x.x.x", WIDTH);
  j.appendChild(form.ip({ type: IPVersion.V4 }).bind({ value: rejecting }));
  readout(j, "state", rejecting, (v) => v.to_string());
}

//      _____         _____ _______          ______  _____  _____
//     |  __ \ /\    / ____/ ____\ \        / / __ \|  __ \|  __ \
//     | |__) /  \  | (___| (___  \ \  /\  / / |  | | |__) | |  | |
//     |  ___/ /\ \  \___ \\___ \  \ \/  \/ /| |  | |  _  /| |  | |
//     | |  / ____ \ ____) |___) |  \  /\  / | |__| | | \ \| |__| |
//     |_| /_/    \_\_____/_____/    \/  \/   \____/|_|  \_\_____/
{
  const sec = section(
    "Password",
    "Focusing empties the input so a new password can be typed, leaving writes it. The digits only one warns on other characters. The bound value is written into the input, so the dots show its real length",
  );
  const value = state.ok_w("secret");
  const access = state.ok_w<AccessTypes>("w");
  controls(sec, {
    "Set hunter2": () => value.set_ok("hunter2"),
    "Set empty": () => value.set_ok(""),
    "Access write": () => access.set_ok("w"),
    "Access read": () => access.set_ok("r"),
  });
  const r = spaced_row(sec);
  box(r, "empty", WIDTH).appendChild(form.password());
  box(r, "digits only", WIDTH).appendChild(form.password({ filter: /^\d*$/ }));
  const b = box(r, "bound, access from state", WIDTH);
  b.appendChild(form.password().opts({ access }).bind({ value }));
  readout(b, "state", value);
  for (const width of ["5rem", "32rem"])
    box(r, width, { width }).appendChild(
      form.password({ value: "a long password that keeps going" }),
    );
}

//       _____ ____  _      ____  _____
//      / ____/ __ \| |    / __ \|  __ \
//     | |   | |  | | |   | |  | | |__) |
//     | |   | |  | | |   | |  | |  _  /
//     | |___| |__| | |___| |__| | | \ \
//      \_____\____/|______\____/|_|  \_\
{
  const sec = section(
    "Color",
    "The browser color picker. Live writes while picking, the other only when the picker closes. Both share a state, the buttons set it from outside",
  );
  const value = state.ok_w("#3366cc");
  controls(sec, {
    "Set red": () => value.set_ok("#ff0000"),
    "Set green": () => value.set_ok("#00aa00"),
    "Set black": () => value.set_ok("#000000"),
    "Set white": () => value.set_ok("#ffffff"),
  });
  const r = spaced_row(sec);
  const a = box(r, "not live", WIDTH);
  a.appendChild(form.color().bind({ value }));
  readout(a, "state", value);
  box(r, "live", WIDTH).appendChild(form.color({ live: true }).bind({ value }));
  box(r, "no value", WIDTH).appendChild(form.color());
  box(r, "read access", WIDTH).appendChild(
    form.color({ value: "#ff8800" }).opts({ access: "r" }),
  );
  box(r, "5rem", { width: "5rem" }).appendChild(
    form.color({ value: "#ff8800" }),
  );
}

//      _____       _______ ______   _______ _____ __  __ ______
//     |  __ \   /\|__   __|  ____| |__   __|_   _|  \/  |  ____|
//     | |  | | /  \  | |  | |__       | |    | | | \  / | |__
//     | |  | |/ /\ \ | |  |  __|      | |    | | | |\/| |  __|
//     | |__| / ____ \| |  |  ____|    | |   _| |_| |  | | |____
//     |_____/_/    \_\_|  |______|    |_|  |_____|_|  |_|______|
{
  const sec = section(
    "Date and time",
    "Every type (rows) with every value mode (columns), all the same instant, 2026-01-15 13:45:30 local time. Number mode is UTC milliseconds and shows the time in UTC. A calendar or clock icon should show on the right to open the picker (the css looks for the wrong icon names, so none show). The library sets lang da-DK, but the browser still formats with its own locale",
  );
  const local = new Date(2026, 0, 15, 13, 45, 30);
  for (const type of Object.values(FormDateTimeType)) {
    const r = spaced_row(sec);
    box(r, type + ", mode date", WIDTH).appendChild(
      form.date_time({ type, mode: FormDateTimeMode.DATE, value: local }),
    );
    box(r, type + ", mode string", WIDTH).appendChild(
      form.date_time({
        type,
        mode: FormDateTimeMode.STRING,
        value: "2026-01-15T13:45:30",
      }),
    );
    box(r, type + ", mode number", WIDTH).appendChild(
      form.date_time({
        type,
        mode: FormDateTimeMode.NUMBER,
        value: local.getTime(),
      }),
    );
    box(r, type + ", empty", WIDTH).appendChild(
      form.date_time({ type, mode: FormDateTimeMode.DATE }),
    );
  }
  const m = spaced_row(sec);
  box(m, "milliseconds", WIDTH).appendChild(
    form.date_time({
      mode: FormDateTimeMode.DATE,
      milliseconds: true,
      value: new Date(2026, 0, 15, 13, 45, 30, 123),
    }),
  );
  for (const width of ["8rem", "32rem"])
    box(m, width, { width }).appendChild(
      form.date_time({ mode: FormDateTimeMode.DATE, value: local }),
    );
}

{
  const sec = section(
    "Date and time bound to states",
    "A date, a string and a number state. Pick a new value in one and see what each state holds. The buttons set them from outside",
  );
  const date = state.ok_w(new Date(2026, 5, 1, 8, 0, 0));
  const text = state.ok_w("2026-06-01T08:00:00");
  const number = state.ok_w(Date.UTC(2026, 5, 1, 8, 0, 0));
  const access = state.ok_w<AccessTypes>("w");
  controls(sec, {
    "Set new year": () => {
      date.set_ok(new Date(2027, 0, 1, 0, 0, 0));
      text.set_ok("2027-01-01T00:00:00");
      number.set_ok(Date.UTC(2027, 0, 1, 0, 0, 0));
    },
    "Set summer (DST)": () => {
      date.set_ok(new Date(2026, 6, 15, 12, 0, 0));
      text.set_ok("2026-07-15T12:00:00");
      number.set_ok(Date.UTC(2026, 6, 15, 12, 0, 0));
    },
    "Access write": () => access.set_ok("w"),
    "Access read": () => access.set_ok("r"),
    "Access none": () => access.set_ok("n"),
  });
  const r = spaced_row(sec);
  const d = box(r, "date mode", WIDTH);
  d.appendChild(
    form
      .date_time({ mode: FormDateTimeMode.DATE })
      .opts({ access })
      .bind({ value: date }),
  );
  readout(d, "state", date, (v) => v.toISOString());
  const s = box(r, "string mode", WIDTH);
  s.appendChild(
    form
      .date_time({ mode: FormDateTimeMode.STRING })
      .opts({ access })
      .bind({ value: text }),
  );
  readout(s, "state", text);
  const n = box(r, "number mode (UTC)", WIDTH);
  n.appendChild(
    form
      .date_time({ mode: FormDateTimeMode.NUMBER })
      .opts({ access })
      .bind({ value: number }),
  );
  readout(n, "state", number, (v) => v + " = " + new Date(v).toISOString());
}
