import type { AccessTypes } from "@chocbite/ts-lib-ui/base";
import form from "@chocbite/ts-lib-ui/form";
import { ok } from "@chocbite/ts-lib/result";
import state, { type State } from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../../helpers";

/**Shows the current value of a state as text and follows it*/
function readout<T>(parent: HTMLElement, label: string, value: State<T>) {
  const line = parent.appendChild(document.createElement("div"));
  value.sub(
    (r) =>
      (line.textContent =
        label + ": " + (r.ok ? JSON.stringify(r.value) : "error, " + r.error)),
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
const LONG =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua";
const SAMPLES = ["", "Short", "Æble på dansk, ½ € and 漢字", LONG];

//      _______ ________   _________
//     |__   __|  ____\ \ / /__   __|
//        | |  | |__   \ V /   | |
//        | |  |  __|   > <    | |
//        | |  | |____ / . \   | |
//        |_|  |______/_/ \_\  |_|
{
  const sec = section(
    "Text",
    "Plain form text, used as labels above elements. Sizes in rem, and long text in narrow boxes. Does the line height work when it wraps",
  );
  const r = spaced_row(sec);
  for (const size of [undefined, 0.8, 1.5, 2, 3])
    box(r, "size " + (size ?? "default"), WIDTH).appendChild(
      form.text({ text: "Pump pressure", size }),
    );
  const w = spaced_row(sec);
  for (const width of ["6rem", "16rem", "32rem"])
    box(w, width + ", long", { width }).appendChild(form.text({ text: LONG }));
  box(w, "16rem, long, size 2", WIDTH).appendChild(
    form.text({ text: LONG, size: 2 }),
  );
  box(w, "empty", WIDTH).appendChild(form.text({}));
}

{
  const sec = section(
    "Text as labels",
    "How a typical form reads, a text above each input. Is the spacing between label and input, and between pairs, right",
  );
  const r = spaced_row(sec);
  const b = box(r, "label + input pairs", WIDTH);
  for (const [label, value] of [
    ["Name", "Pump 1"],
    ["Location", "Basement, room 4"],
    ["Notes", ""],
  ] as const) {
    b.appendChild(form.text({ text: label }));
    b.appendChild(form.text_input({ value, placeholder: label }));
  }
}

//      _____ _   _ _____  _    _ _______
//     |_   _| \ | |  __ \| |  | |__   __|
//       | | |  \| | |__) | |  | |  | |
//       | | | . ` |  ___/| |  | |  | |
//      _| |_| |\  | |    | |__| |  | |
//     |_____|_| \_|_|     \____/   |_|
{
  const sec = section(
    "Text input",
    "Empty with placeholder, short, unicode and long text. The value is written on enter or when leaving, escape reverts. Long text should scroll inside, not grow the input",
  );
  const r = spaced_row(sec);
  for (const value of SAMPLES)
    box(r, value ? value.slice(0, 20) : "empty, placeholder", WIDTH).appendChild(
      form.text_input({ value, placeholder: "Type something..." }),
    );
  const w = spaced_row(sec);
  for (const width of ["5rem", "10rem", "32rem"])
    box(w, width, { width }).appendChild(
      form.text_input({ value: LONG, placeholder: "Placeholder" }),
    );
}

{
  const sec = section(
    "Text input limits",
    "Max 10 characters, max 10 bytes (æ, ø, € take more than one), and a filter that only allows letters and spaces. Typing past a limit or a blocked character should show a warning bubble",
  );
  const r = spaced_row(sec);
  for (const [label, opts] of [
    ["max_length 10", { max_length: 10 }],
    ["max_bytes 10", { max_bytes: 10 }],
    ["filter letters and space", { filter: /^[a-zA-Z ]*$/ }],
    ["all three", { max_length: 10, max_bytes: 10, filter: /^[a-zA-Z ]*$/ }],
  ] as const) {
    const value = state.ok_w("");
    const b = box(r, label, WIDTH);
    b.appendChild(
      form.text_input({ ...opts, placeholder: label }).bind({ value }),
    );
    readout(b, "state", value);
  }
}

{
  const sec = section(
    "Text input bound to states",
    "Three inputs share one state, typing in one and pressing enter should update the others. The buttons set the state from outside, also while an input has focus (it should not overwrite what is being typed). The right one has its max length from a string helper",
  );
  const shared = state.ok_w("Hello");
  const max_length = state.ok_w(5);
  const helped = state.rosw(
    state.s.help(ok("12345"), { max_length }),
    true,
  );
  const access = state.ok_w<AccessTypes>("w");
  controls(sec, {
    "Set Hello": () => shared.set_ok("Hello"),
    "Set long": () => shared.set_ok(LONG),
    "Set empty": () => shared.set_ok(""),
    "Helper max 5": () => max_length.set_ok(5),
    "Helper max 20": () => max_length.set_ok(20),
    "Access write": () => access.set_ok("w"),
    "Access read": () => access.set_ok("r"),
    "Access none": () => access.set_ok("n"),
  });
  const r = spaced_row(sec);
  const a = box(r, "shared", WIDTH);
  a.appendChild(form.text_input().bind({ value: shared }));
  readout(a, "state", shared);
  box(r, "shared", WIDTH).appendChild(
    form.text_input({ placeholder: "Empty" }).bind({ value: shared }),
  );
  box(r, "shared, access from state", WIDTH).appendChild(
    form.text_input().opts({ access }).bind({ value: shared }),
  );
  const h = box(r, "string helper max_length", WIDTH);
  h.appendChild(form.text_input().bind({ value: helped }));
  readout(h, "state", helped);
  readout(h, "max_length", max_length);
  const d = spaced_row(sec);
  box(d, "description (hover)", WIDTH).appendChild(
    form.text_input({
      value: "Hover me",
      description: "The name shown on the overview",
    }),
  );
  const changes = box(d, "unbound, change listener", WIDTH);
  const line = document.createElement("div");
  line.textContent = "change: -";
  changes.appendChild(
    form.text_input({
      placeholder: "Type and press enter",
      change: (v) => (line.textContent = "change: " + JSON.stringify(v)),
    }),
  );
  changes.appendChild(line);
}

//      __  __ _    _ _   _______ _____   _      _____ _   _ ______
//     |  \/  | |  | | | |__   __|_   _| | |    |_   _| \ | |  ____|
//     | \  / | |  | | |    | |    | |   | |      | | |  \| | |__
//     | |\/| | |  | | |    | |    | |   | |      | | | . ` |  __|
//     | |  | | |__| | |____| |   _| |_  | |____ _| |_| |\  | |____
//     |_|  |_|\____/|______|_|  |_____| |______|_____|_| \_|______|
{
  const sec = section(
    "Multi line text",
    "Placeholder, short and long text in different widths. Drag the handle at the bottom to resize. Enter makes a new line, ctrl + enter or leaving writes the value, escape reverts",
  );
  const r = spaced_row(sec);
  for (const value of SAMPLES)
    box(r, value ? value.slice(0, 20) : "empty, placeholder", WIDTH).appendChild(
      form.text_multiline({ value, placeholder: "Write a note..." }),
    );
  const w = spaced_row(sec);
  const many_lines = Array.from(
    { length: 12 },
    (_, i) => "Line " + (i + 1),
  ).join("\n");
  for (const width of ["6rem", "32rem"])
    box(w, width + ", long", { width }).appendChild(
      form.text_multiline({ value: LONG + "\n\n" + LONG }),
    );
  box(w, "12 lines", WIDTH).appendChild(
    form.text_multiline({ value: many_lines }),
  );
}

{
  const sec = section(
    "Multi line limits and states",
    "Max 20 characters and max 20 bytes with warnings. The filter option is passed but form.text_multiline ignores it, digits should be blocked in the third one. The last two share a state with a single line input",
  );
  const shared = state.ok_w("Shared\nacross lines");
  controls(sec, {
    "Set two lines": () => shared.set_ok("First line\nSecond line"),
    "Set long": () => shared.set_ok(LONG),
    "Set empty": () => shared.set_ok(""),
  });
  const r = spaced_row(sec);
  box(r, "max_length 20", WIDTH).appendChild(
    form.text_multiline({ max_length: 20, placeholder: "Max 20 characters" }),
  );
  box(r, "max_bytes 20", WIDTH).appendChild(
    form.text_multiline({ max_bytes: 20, placeholder: "Max 20 bytes" }),
  );
  box(r, "filter no digits (ignored)", WIDTH).appendChild(
    form.text_multiline({ filter: /^\D*$/, placeholder: "No digits" }),
  );
  const s = spaced_row(sec);
  const a = box(s, "multi line, shared", WIDTH);
  a.appendChild(form.text_multiline().bind({ value: shared }));
  readout(a, "state", shared);
  box(s, "single line, shared", WIDTH).appendChild(
    form.text_input().bind({ value: shared }),
  );
  box(s, "multi line, read access", WIDTH).appendChild(
    form.text_multiline().opts({ access: "r" }).bind({ value: shared }),
  );
}
