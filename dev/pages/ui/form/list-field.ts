import form, { FormColors } from "@chocbite/ts-lib-ui/form";
import { material_play_arrow_rounded } from "@chocbite/ts-lib-ui/icons";
import list from "@chocbite/ts-lib-ui/list";
import { array_from_length } from "@chocbite/ts-lib/common";
import state from "@chocbite/ts-lib/state";
import { box, controls, section } from "../../../helpers";

const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf"];

/**One machine per row, every value is a state so the form elements in the row write back*/
const machine = (i: number) => ({
  name: WORDS[i % WORDS.length] + " " + i,
  on: state.ok_w(i % 2 === 0),
  speed: state.ok_w((i * 7) % 101),
  mode: state.ok_w(i % 3),
});
type Machine = ReturnType<typeof machine>;

const MODES = [
  { value: 0, text: "Off" },
  { value: 1, text: "Auto" },
  { value: 2, text: "Hand" },
];

//      _      _____  _____ _______   ______ _____ ______ _      _____
//     | |    |_   _|/ ____|__   __| |  ____|_   _|  ____| |    |  __ \
//     | |      | | | (___    | |    | |__    | | | |__  | |    | |  | |
//     | |      | |  \___ \   | |    |  __|   | | |  __| | |    | |  | |
//     | |____ _| |_ ____) |  | |    | |     _| |_| |____| |____| |__| |
//     |______|_____|_____/   |_|    |_|    |_____|______|______|_____/
{
  const sec = section(
    "Form elements in list cells",
    "form.list_field wraps a form element as a list field. Each row binds its elements to its own states, so the switch, lamp and stepper in a row stay in sync. Do the elements fit the row height, do hover and focus inside a row work, does scrolling keep the right values in the right rows",
  );
  const rows = state.ok_w(array_from_length(200, machine));
  controls(sec, {
    "All on": () => rows.ok().forEach((m) => m.on.set_ok(true)),
    "All off": () => rows.ok().forEach((m) => m.on.set_ok(false)),
    "All mode auto": () => rows.ok().forEach((m) => m.mode.set_ok(1)),
    "5 rows": () => rows.set_ok(array_from_length(5, machine)),
    "200 rows": () => rows.set_ok(array_from_length(200, machine)),
  });
  box(sec, "200 rows in a 24rem high box", {
    height: "24rem",
    display: "grid",
  }).appendChild(
    list.container(
      {
        name: list.column_string("Name"),
        on: list.column({
          title: "On",
          fixed_width: "min",
          field_gen: () => form.list_field(form.switch()),
          field_apply: (field, v: Machine["on"]) =>
            field.element.bind({ value: v }),
        }),
        lamp: list.column({
          title: "State",
          init_width: 8,
          field_gen: () =>
            form.list_field(
              form.lamp({
                text: "Power",
                colors: [FormColors.Red, FormColors.Green],
              }),
            ),
          field_apply: (field, v: Machine["on"]) =>
            field.element.bind({ value: v }),
        }),
        speed: list.column({
          title: "Speed",
          init_width: 12,
          field_gen: () =>
            form.list_field(form.stepper({ min: 0, max: 100, unit: "%" })),
          field_apply: (field, v: Machine["speed"]) =>
            field.element.bind({ value: v }),
        }),
        progress: list.column({
          title: "Load",
          init_width: 10,
          field_gen: () => form.list_field(form.progress({ unit: "%" })),
          field_apply: (field, v: Machine["speed"]) =>
            field.element.bind({ value: v }),
        }),
        mode: list.column({
          title: "Mode",
          init_width: 14,
          field_gen: () =>
            form.list_field(form.toggle_button({ selections: MODES })),
          field_apply: (field, v: Machine["mode"]) =>
            field.element.bind({ value: v }),
        }),
        mode_dropdown: list.column({
          title: "Mode dropdown",
          init_width: 10,
          field_gen: () => form.list_field(form.dropdown({ selections: MODES })),
          field_apply: (field, v: Machine["mode"]) =>
            field.element.bind({ value: v }),
        }),
        start: list.column({
          title: "Start",
          fixed_width: "min",
          field_gen: () =>
            form.list_field(
              form.button({ icon: material_play_arrow_rounded, text: "Start" }),
            ),
          field_apply: (field, v: Machine["on"]) =>
            (field.element.on_click = () => v.set_ok(true)),
        }),
      },
      (m) => ({
        values: {
          name: m.name,
          on: m.on,
          lamp: m.on,
          speed: m.speed,
          progress: m.speed,
          mode: m.mode,
          mode_dropdown: m.mode,
          start: m.on,
        },
      }),
      rows,
    ),
  );
}
