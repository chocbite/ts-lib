import type { AccessTypes } from "@chocbite/ts-lib-ui/base";
import form, { FormColors } from "@chocbite/ts-lib-ui/form";
import {
  material_play_arrow_rounded,
  material_stop_rounded,
} from "@chocbite/ts-lib-ui/icons";
import { array_from_length, IPAddress } from "@chocbite/ts-lib/common";
import type { NiceError, Result } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../../helpers";

/**A row with some space below, so the labels of the next row do not touch it*/
function spaced_row(parent: HTMLElement) {
  const r = row(parent);
  r.style.marginBottom = "0.75rem";
  return r;
}

/**A pre block for printing values into*/
function output(parent: HTMLElement) {
  const pre = parent.appendChild(document.createElement("pre"));
  pre.style.margin = "0.5rem 0 0";
  pre.style.fontSize = "0.8rem";
  pre.textContent = "-";
  return pre;
}

const WIDTH = { width: "18rem" };
const BORDERS = ["none", "inset", "outset", "line"] as const;

/**A few typical elements to fill a group with*/
const content = (name: string) => [
  form.text({ text: name }),
  form.switch({ value: true }),
  form.text({ text: "Speed" }),
  form.slider({ min: 0, max: 100, unit: "%", value: 40 }),
  form.button({ text: "Start", icon: material_play_arrow_rounded }),
];

//      ____   ____  _____  _____  ______ _____   _____
//     |  _ \ / __ \|  __ \|  __ \|  ____|  __ \ / ____|
//     | |_) | |  | | |__) | |  | | |__  | |__) | (___
//     |  _ <| |  | |  _  /| |  | |  __| |  _  / \___ \
//     | |_) | |__| | | \ \| |__| | |____| | \ \ ____) |
//     |____/ \____/|_|  \_\_____/|______|_|  \_\_____/
{
  const sec = section(
    "Borders",
    "The four border styles, top row normal, bottom row embedded (no padding). Is the padding between border and elements, and between elements, right",
  );
  const normal = spaced_row(sec);
  const embedded = spaced_row(sec);
  for (const border of BORDERS) {
    box(normal, border, WIDTH).appendChild(
      form.group({ border, elements: content("Pump") }),
    );
    box(embedded, border + ", embed", WIDTH).appendChild(
      form.group({ border, embed: true, elements: content("Pump") }),
    );
  }
}

{
  const sec = section(
    "Nested groups",
    "Groups in groups with different borders. Embedded inner groups should not add up padding. Does it get too busy",
  );
  const r = spaced_row(sec);
  for (const [label, embed] of [
    ["inner groups normal", false],
    ["inner groups embedded", true],
  ] as const)
    box(r, label, { width: "24rem" }).appendChild(
      form.group({
        border: "outset",
        elements: [
          form.text({ text: "Outer group", size: 1.2 }),
          form.group({ border: "inset", embed, elements: content("Inset") }),
          form.group({ border: "line", embed, elements: content("Line") }),
          form.group({
            border: "outset",
            embed,
            elements: [
              form.text({ text: "Outset with an inset inside" }),
              form.group({ border: "inset", elements: content("Deepest") }),
            ],
          }),
        ],
      }),
    );
}

//      _                 __     ______  _    _ _______
//     | |         /\     \ \   / / __ \| |  | |__   __|
//     | |        /  \     \ \_/ / |  | | |  | |  | |
//     | |       / /\ \     \   /| |  | | |  | |  | |
//     | |____  / ____ \     | | | |__| | |__| |  | |
//     |______|/_/    \_\    |_|  \____/ \____/   |_|
{
  const sec = section(
    "Columns and rows",
    "column: true is one column (default), a size string makes as many columns of at least that size as fit, an array makes exactly those columns. row is the same sideways. Resize the window to see auto fit columns change",
  );
  const buttons = (count: number) =>
    array_from_length(count, (i) =>
      form.button({ text: "Button " + (i + 1), center: true }),
    );
  const r = spaced_row(sec);
  box(r, "column: true", WIDTH).appendChild(
    form.group({ border: "inset", column: true, elements: buttons(4) }),
  );
  box(r, 'column: "8rem"', { width: "36rem" }).appendChild(
    form.group({ border: "inset", column: "8rem", elements: buttons(9) }),
  );
  box(r, 'column: ["6rem", "12rem"]', WIDTH).appendChild(
    form.group({
      border: "inset",
      column: ["6rem", "12rem"],
      elements: buttons(6),
    }),
  );
  const s = spaced_row(sec);
  box(s, "row: true (wraps)", { width: "36rem" }).appendChild(
    form.group({ border: "inset", row: true, elements: buttons(8) }),
  );
  box(s, 'row: ["2rem", "4rem"]', WIDTH).appendChild(
    form.group({ border: "inset", row: ["2rem", "4rem"], elements: buttons(6) }),
  );
  const f = spaced_row(sec);
  box(f, 'label / element pairs, column: ["8rem", "12rem"]', {
    width: "24rem",
  }).appendChild(
    form.group({
      border: "outset",
      column: ["8rem", "12rem"],
      elements: [
        form.text({ text: "Power" }),
        form.switch({ value: true }),
        form.text({ text: "Setpoint" }),
        form.number_input({ unit: "°C", value: 21, decimals: 1 }),
        form.text({ text: "Mode" }),
        form.dropdown({
          selections: [
            { value: 0, text: "Heat" },
            { value: 1, text: "Cool" },
          ],
          value: 0,
        }),
        form.text({ text: "A label long enough to wrap in the column" }),
        form.lamp({
          text: "Running",
          colors: [FormColors.None, FormColors.Green],
          value: true,
        }),
      ],
    }),
  );
}

{
  const sec = section(
    "Max height",
    "max_height in rem makes the group scroll. Does the scrollbar fit with the border and padding",
  );
  const r = spaced_row(sec);
  for (const border of BORDERS)
    box(r, border + ", max_height 10", WIDTH).appendChild(
      form.group({
        border,
        max_height: 10,
        elements: [...content("First"), ...content("Second")],
      }),
    );
}

//      _____ _____        _____ ______ _____
//     / ____|  __ \ /\   / ____|  ____|  __ \
//    | (___ | |__) /  \ | |    | |__  | |__) |
//     \___ \|  ___/ /\ \| |    |  __| |  _  /
//     ____) | |  / ____ \ |____| |____| | \ \
//    |_____/|_| /_/    \_\_____|______|_|  \_\
{
  const sec = section(
    "Spacer",
    "Spacers of 0.5, 1, 2 and 4 rem between buttons, and one without a size",
  );
  const r = spaced_row(sec);
  box(r, "spacers", WIDTH).appendChild(
    form.group({
      border: "inset",
      elements: [
        form.button({ text: "Above 0.5" }),
        form.spacer({ space: 0.5 }),
        form.button({ text: "Above 1" }),
        form.spacer({ space: 1 }),
        form.button({ text: "Above 2" }),
        form.spacer({ space: 2 }),
        form.button({ text: "Above 4" }),
        form.spacer({ space: 4 }),
        form.button({ text: "Above no size" }),
        form.spacer(),
        form.button({ text: "Last" }),
      ],
    }),
  );
}

//       _____ ____  _      _               _____   _____ ______ _____
//      / ____/ __ \| |    | |        /\   |  __ \ / ____|  ____|  __ \
//     | |   | |  | | |    | |       /  \  | |__) | (___ | |__  | |__) |
//     | |   | |  | | |    | |      / /\ \ |  ___/ \___ \|  __| |  _  /
//     | |___| |__| | |____| |____ / ____ \| |     ____) | |____| | \ \
//      \_____\____/|______|______/_/    \_\_|    |_____/|______|_|  \_\
{
  const sec = section(
    "Group collapser",
    "Open and collapsed, default and custom texts, a long closed text, and the four borders. Is the collapse button easy to find and hit, does the animation feel right (set animation level in the shell)",
  );
  const r = spaced_row(sec);
  box(r, "open, default texts", WIDTH).appendChild(
    form.group_collapser(
      form.group({ border: "inset", elements: content("Open") }),
    ),
  );
  box(r, "collapsed, default texts", WIDTH).appendChild(
    form.group_collapser(
      form.group({ border: "inset", elements: content("Collapsed") }),
      { collapsed: true },
    ),
  );
  box(r, "custom texts", WIDTH).appendChild(
    form.group_collapser(
      form.group({ border: "inset", elements: content("Custom") }),
      { collapsed: true, closed_text: "Show pump settings", opened_text: "Hide pump settings" },
    ),
  );
  box(r, "long closed text", WIDTH).appendChild(
    form.group_collapser(
      form.group({ border: "inset", elements: content("Long") }),
      {
        collapsed: true,
        closed_text:
          "Advanced settings for the pump, only change these if you know what they do",
      },
    ),
  );
  const b = spaced_row(sec);
  for (const border of BORDERS)
    box(b, border, WIDTH).appendChild(
      form.group_collapser(form.group({ border, elements: content(border) })),
    );
  const t = spaced_row(sec);
  //The buttons and the collapser share a writable state, either changes it
  const collapsed = state.ok_w(false);
  const collapser = form.group_collapser(
    form.group({ border: "outset", max_height: 8, elements: [...content("Scrolls"), ...content("More")] }),
    { closed_text: "Toggled by the buttons", collapsed },
  );
  const tb = box(t, "toggled from outside, max_height 8", WIDTH);
  controls(tb, {
    Collapse: () => collapsed.set_ok(true),
    Open: () => collapsed.set_ok(false),
  });
  tb.appendChild(collapser);
}

//     __      __     _     _    _ ______  _____
//     \ \    / /\   | |   | |  | |  ____|/ ____|
//      \ \  / /  \  | |   | |  | | |__  | (___
//       \ \/ / /\ \ | |   | |  | |  __|  \___ \
//        \  / ____ \| |___| |__| | |____ ____) |
//         \/_/    \_\______\____/|______|_____/
{
  const sec = section(
    "Group values and access",
    "Elements with an id make up the group value. Change some elements, then print the value, the partial value (only elements with values) and the changed values. Set value writes all of them, clear empties them. Access applies to the whole group",
  );
  const group = form.group({
    border: "outset",
    column: ["8rem", "12rem"],
    elements: [
      form.text({ text: "Name" }),
      form.text_input({ id: "name", placeholder: "No value" }),
      form.text({ text: "Enabled" }),
      form.switch({ id: "enabled" }),
      form.text({ text: "Speed" }),
      form.stepper({ id: "speed", min: 0, max: 100, unit: "%" }),
      form.text({ text: "Mode" }),
      form.toggle_button({
        id: "mode",
        selections: [
          { value: "auto", text: "Auto" },
          { value: "manual", text: "Manual" },
        ],
      }),
      form.text({ text: "No id" }),
      form.switch({ value: true }),
      form.button({
        id: "run",
        text: "Run",
        icon: material_play_arrow_rounded,
        toggle: true,
      }),
      form.button({ text: "No id", icon: material_stop_rounded }),
    ],
  });
  const access = state.ok_w<AccessTypes>("w");
  group.set({ access });
  const r = spaced_row(sec);
  const b = box(r, "group with ids", { width: "24rem" });
  const out = output(sec);
  const print = (r: Result<object, NiceError>) =>
    (out.textContent = r.ok
      ? JSON.stringify(r.value, null, 1)
      : "error, " + r.error.toString() + r.error.errors.map((inner) => "\n  " + inner.toString()).join(""));
  controls(b, {
    "Print value": () => print(group.get_value),
    "Print partial": () => print(group.value_partial),
    "Print changed": () => print(group.value_changed),
    "Set value": () =>
      group.set({
        value: {
          name: "Pump 2",
          enabled: true,
          speed: 75,
          mode: "manual",
          run: false,
        },
      }),
    "Set speed only": () => group.set({ value: { speed: 10 } }),
    Clear: () => group.clear(),
  });
  controls(b, {
    "Access write": () => access.set_ok("w"),
    "Access read": () => access.set_ok("r"),
    "Access none": () => access.set_ok("n"),
  });
  b.appendChild(group);
}

//Elements given again
{
  const sec = section(
    "Elements given again",
    "The buttons give the group other elements with the same ids and value types, a stepper or slider for speed, a dropdown or toggle buttons for mode. The switch is the same element in both, it stays in place and keeps its value, the others are new with every press and start from their own values. Large, with value gives the value to the new elements. Change something and print, the value is that of the elements shown",
  );
  const modes = [
    { value: "auto", text: "Auto" },
    { value: "manual", text: "Manual" },
  ];
  const on = form.switch({ id: "on", value: true });
  const compact = () =>
    [
      form.text({ text: "Compact" }),
      form.stepper({ id: "speed", min: 0, max: 100, unit: "%", value: 20 }),
      form.dropdown({ id: "mode", selections: modes, value: "auto" }),
      on,
    ] as const;
  const large = () =>
    [
      form.text({ text: "Large, with more room" }),
      form.slider({ id: "speed", min: 0, max: 100, unit: "%", value: 80 }),
      form.toggle_button({ id: "mode", selections: modes, value: "manual" }),
      on,
    ] as const;
  const group = form.group({ border: "inset", elements: [...compact()] });
  const r = spaced_row(sec);
  const b = box(r, "group", { width: "24rem" });
  const out = output(sec);
  controls(b, {
    Compact: () => group.set({ elements: [...compact()] }),
    Large: () => group.set({ elements: [...large()] }),
    "Large, with value": () =>
      group.set({
        elements: [...large()],
        value: { speed: 50, mode: "auto", on: false },
      }),
    "Print value": () => {
      const value = group.get_value;
      out.textContent = value.ok
        ? JSON.stringify(value.value, null, 1)
        : "error, " + value.error.toString();
    },
  });
  b.appendChild(group);
}

//Array group
{
  const sec = section(
    "Array group",
    "Its value is the values of its items in order. Add and Remove put in and take out items, the items already there are not moved, so what was typed in them stays. An address left empty makes the value an error naming its index, partial leaves it out. Below, an array group of groups, its value is an array of objects",
  );
  const items = state.ok_w([form.ip(), form.ip()]);
  const addresses = form.group_array({ elements: items, border: "inset" });
  const changes = document.createElement("div");
  changes.textContent = "change: -";
  addresses.set({
    change: (values) =>
      (changes.textContent =
        "change: [" + values.map((ip) => ip.to_string()).join(", ") + "]"),
  });
  const r = spaced_row(sec);
  const b = box(r, "addresses", { width: "24rem" });
  const out = output(sec);
  //Addresses as text, an IPAddress holds a bigint, which JSON can not hold
  const print = (r: Result<unknown, NiceError>) =>
    (out.textContent = r.ok
      ? JSON.stringify(
          r.value,
          (_key, value: unknown) =>
            value instanceof IPAddress ? value.to_string() : value,
          1,
        )
      : "error, " + r.error.toString());
  controls(b, {
    Add: () => items.set_ok([...items.ok(), form.ip()]),
    "Add first": () => items.set_ok([form.ip(), ...items.ok()]),
    "Remove last": () => items.set_ok(items.ok().slice(0, -1)),
    "Print value": () => print(addresses.get_value),
    "Print partial": () => print(addresses.value_partial),
  });
  b.appendChild(addresses);
  b.appendChild(changes);

  const pump = (name: string, speed: number) =>
    form.group({
      border: "line",
      elements: [
        form.text({ text: name }),
        form.stepper({ id: "speed", min: 0, max: 100, unit: "%", value: speed }),
        form.switch({ id: "on", value: speed > 0 }),
      ],
    });
  const pumps = form.group_array({
    column: "12rem",
    elements: [pump("Pump 1", 20), pump("Pump 2", 0), pump("Pump 3", 60)],
  });
  const p = box(spaced_row(sec), "pumps", { width: "40rem" });
  controls(p, {
    "Print value": () => print(pumps.get_value),
  });
  p.appendChild(pumps);
}
