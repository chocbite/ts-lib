import form from "@chocbite/ts-lib-ui/form";
import {
  material_delete_rounded,
  material_save_rounded,
} from "@chocbite/ts-lib-ui/icons";
import { prompts } from "@chocbite/ts-lib-ui/prompts";
import { none } from "@chocbite/ts-lib/result";
import { controls, section } from "../../helpers";

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
    "The name field has the focus when the prompt opens. Enter submits with the last button. The answer holds only the values that were changed. Checked refuses an empty name and stays open",
  );
  const show = answer_line(sec);
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
          { text: "Cancel", click: (_group, close) => close(none()) },
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
