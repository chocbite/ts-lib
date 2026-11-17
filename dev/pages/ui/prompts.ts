import form, {
  FormColors,
  FormDateTimeMode,
  FormDateTimeType,
  type FormSelections,
} from "@chocbite/ts-lib-ui/form";
import {
  material_delete_rounded,
  material_save_rounded,
} from "@chocbite/ts-lib-ui/icons";
import { prompts, type PromptFormValues } from "@chocbite/ts-lib-ui/prompts";
import { IPAddress, IPVersion } from "@chocbite/ts-lib/common";
import type { Option, Result } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { controls, section } from "../../helpers";

/**Lines under the controls showing the values of the last form answer, as all, partial and changed*/
const form_answer_lines = (sec: HTMLElement) => {
  const lines = sec.appendChild(document.createElement("div"));
  lines.style.whiteSpace = "pre";
  lines.textContent = "No answer yet";
  const text = (result: Result<object, string>) =>
    result.ok
      ? JSON.stringify(result.value, (_key, value: unknown) =>
          //An IP address holds a BigInt, which JSON can not write
          value instanceof IPAddress ? value.to_string() : value,
        )
      : "error, " + result.error;
  return <T extends object>(answer: Option<PromptFormValues<T>>) =>
    (lines.textContent = answer.some
      ? [
          "get_value: " + text(answer.value.get_value),
          "value_partial: " + text(answer.value.value_partial),
          "value_changed: " + text(answer.value.value_changed),
        ].join("\n")
      : "Closed without submitting");
};

/**Line under the controls showing the last answer*/
const answer_line = (sec: HTMLElement) => {
  const line = sec.appendChild(document.createElement("div"));
  line.textContent = "No answer yet";
  return (answer: unknown) =>
    (line.textContent = `Answer: ${JSON.stringify(answer)}`);
};

//      ____  _    _ _______ _______ ____  _   _  _____
//     |  _ \| |  | |__   __|__   __/ __ \| \ | |/ ____|
//     | |_) | |  | |  | |     | | | |  | |  \| | (___
//     |  _ <| |  | |  | |     | | | |  | | . ` |\___ \
//     | |_) | |__| |  | |     | | | |__| | |\  |____) |
//     |____/ \____/   |_|     |_|  \____/|_| \_|_____/
{
  const sec = section(
    "Buttons",
    "Pick a button and the answer shows its value. Escape, the close button, or pressing the dark part gives none, as the line below shows",
  );
  const show = answer_line(sec);
  controls(sec, {
    "Two buttons": async () =>
      show(
        await prompts.buttons("Discard changes?", [
          { text: "Discard", value: "discard", icon: material_delete_rounded },
          { text: "Keep", value: "keep", icon: material_save_rounded },
        ]),
      ),
    "Many buttons": async () =>
      show(
        await prompts.buttons(
          "Pick a number",
          [1, 2, 3, 4, 5, 6].map((n) => ({ text: String(n), value: n })),
        ),
      ),
  });
}

//      ______ ____  _____  __  __
//     |  ____/ __ \|  __ \|  \/  |
//     | |__ | |  | | |__) | \  / |
//     |  __|| |  | |  _  /| |\/| |
//     | |   | |__| | | \ \| |  | |
//     |_|    \____/|_|  \_\_|  |_|
{
  const sec = section(
    "Form",
    "The name field has the focus when the prompt opens. Enter submits with the last button. The answer lines show the three ways to read the values: all of them (an error while one has no value), those that have a value, and those the user changed. Cancel closes without submitting. Checked refuses an empty name and stays open",
  );
  const show = form_answer_lines(sec);
  //A tuple, so the answer is typed by the ids of the elements
  const tuple = <T extends unknown[]>(...items: T) => items;
  const fields = () =>
    tuple(
      form.text({ text: "Name" }),
      form.text_input({ id: "name" }),
      form.text({ text: "Admin" }),
      form.switch({ id: "admin" }),
    );
  controls(sec, {
    "One submit": async () =>
      show(await prompts.form("New user", fields(), { text: "Create" })),
    "Two submits": async () =>
      show(
        await prompts.form("New user", fields(), [
          { text: "Cancel", click: (_group, close) => close(false) },
          { text: "Create" },
        ]),
      ),
    Checked: async () =>
      show(
        await prompts.form("New user", fields(), {
          text: "Create",
          click: (group) => {
            const name = group.value_changed;
            return !(name.ok && name.value.name);
          },
        }),
      ),
  });
}

//                _      _        ______ _      ______ __  __ ______ _   _ _______ _____
//          /\   | |    | |      |  ____| |    |  ____|  \/  |  ____| \ | |__   __/ ____|
//         /  \  | |    | |      | |__  | |    | |__  | \  / | |__  |  \| |  | | | (___
//        / /\ \ | |    | |      |  __| | |    |  __| | |\/| |  __| | . ` |  | |  \___ \
//       / ____ \| |____| |____  | |____| |____| |____| |  | | |____| |\  |  | |  ____) |
//      /_/    \_\______|______| |______|______|______|_|  |_|______|_| \_|  |_| |_____/
{
  const sec = section(
    "All form elements",
    "A prompt with every form element, the answer lines show their values by id. The lamp follows the switch and the progress bar the slider. The live switch is bound to a state, it changes the line above the button right away, and is in the answer like the others. Tab through them, Space toggles the switch, Enter submits from anywhere but the multi line text. When the prompt closes the focus is back on the button that opened it",
  );
  const show = form_answer_lines(sec);
  const tuple = <T extends unknown[]>(...items: T) => items;
  //A live setting of the page, the prompt writes it right away
  const live = state.ok_w(false);
  const live_line = sec.appendChild(document.createElement("div"));
  live.sub((v) => (live_line.textContent = `Live state: ${v.value}`), true);
  const choices: FormSelections<number> = [
    { value: 0, text: "Low" },
    { value: 1, text: "Medium" },
    { value: 2, text: "High" },
  ];
  controls(sec, {
    "All elements": async () => {
      //Bound elements write to their state instead of the form, so these follow the change of the elements
      const on = state.ok_w(false);
      const level = state.ok_w(40);
      const label = (text: string) => form.text({ text });
      show(
        await prompts.form(
          "All form elements",
          tuple(
            label("Text input"),
            form.text_input({ id: "text", placeholder: "Type here" }),
            label("Multi line text"),
            form.text_multiline({ id: "multiline" }),
            label("Password"),
            form.password({ id: "password" }),
            label("Number input"),
            form.number_input({ id: "number", value: 5, min: 0, max: 10 }),
            label("Stepper"),
            form.stepper({ id: "stepper", value: 2, step: 0.5, unit: "m" }),
            label("Slider, the progress bar follows it"),
            form.slider({
              id: "slider",
              unit: "%",
              value: 40,
              change: (v) => level.set_ok(v),
            }),
            form.progress({ unit: "%" }).set({ value: level }),
            label("Switch, the lamp follows it"),
            form.switch({ id: "switch", change: (v) => on.set_ok(v) }),
            form
              .lamp({ text: "On", colors: [FormColors.Red, FormColors.Green] })
              .set({ value: on }),
            label("Live switch, bound to the state of the page"),
            form.switch({ id: "live" }).set({ value: live }),
            label("Toggle buttons"),
            form.toggle_button({ id: "toggle", selections: choices, value: 1 }),
            label("Dropdown"),
            form.dropdown({ id: "dropdown", selections: choices, value: 0 }),
            label("Color"),
            form.color({ id: "color", value: "#ff8800" }),
            label("Date and time"),
            form.date_time({
              id: "date_time",
              type: FormDateTimeType.DATETIME,
              mode: FormDateTimeMode.STRING,
              value: "2026-01-15T13:45:30",
            }),
            label("IP address"),
            form.ip({
              id: "ip",
              type: IPVersion.V4,
              value: new IPAddress("192.168.1.1"),
            }),
            label("Button, not a value"),
            form.button({ text: "Does nothing" }),
          ),
          [
            { text: "Cancel", click: (_group, close) => close(false) },
            { text: "Submit" },
          ],
        ),
      );
    },
  });
}
