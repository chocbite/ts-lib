import { CompAnchor, comp } from "@chocbite/ts-lib-ui/composition";
import form, { type FormElement } from "@chocbite/ts-lib-ui/form";
import { material_settings_rounded } from "@chocbite/ts-lib-ui/icons";
import state from "@chocbite/ts-lib/state";
import { controls, section, demo_error } from "../../../helpers";

//      ____  _    _ _______ _______ ____  _   _
//     |  _ \| |  | |__   __|__   __/ __ \| \ | |
//     | |_) | |  | |  | |     | | | |  | |  \| |
//     |  _ <| |  | |  | |     | | | |  | | . ` |
//     | |_) | |__| |  | |     | | | |__| | |\  |
//     |____/ \____/   |_|     |_|  \____/|_| \_|
{
  const sec = section(
    "Attached to a button",
    "Click the settings button in the bar, the panel opens below it with its top right at the bottom right of the button. Press outside it, on the dark part, to hide it. Changing the theme or scale applies to this page. The app setting is under the theme, the advanced one last in the advanced section",
  );
  const button = comp.topbar_button({
    icon: material_settings_rounded,
    text: "Settings",
  });
  const bar = sec.appendChild(comp.topbar({ right: [button] }));
  bar.style.width = "40rem";
  attach_customization_panel(button);
}

function attach_customization_panel(button: HTMLElement) {
  const c = comp.attach_customization_panel_to_element(
    button,
    CompAnchor.BOT_RIGHT,
    CompAnchor.TOP_RIGHT,
  );
  c.content.set({
    main: [
      form.text({ text: "App setting" }),
      form.switch().bind({ value: state.ok_w(true) }),
    ],
    advanced: [
      form.text({ text: "Advanced app setting" }),
      form.stepper().bind({ value: state.ok_w(5) }),
    ],
  });
}

//       _____ _______    _______ ______
//      / ____|__   __|/\|__   __|  ____|
//     | (___    | |  /  \  | |  | |__
//      \___ \   | | / /\ \ | |  |  __|
//      ____) |  | |/ ____ \| |  | |____
//     |_____/   |_/_/    \_\_|  |______|
{
  const sec = section(
    "Settings from a state",
    "The app settings are a state. Add or remove settings, or set an error, then Show the panel to see them, an error shows none",
  );
  const list: FormElement[] = [];
  const items = state.from_w<readonly FormElement[]>([]);
  const c = comp.customization_panel({ main: items });
  controls(sec, {
    "Add setting": () => {
      list.push(form.text({ text: `Setting ${list.length + 1}` }));
      items.set_ok([...list]);
    },
    "Remove setting": () => {
      list.pop();
      items.set_ok([...list]);
    },
    Error: () => items.set_err(demo_error("no settings")),
    Show: () => void c.hidden.write(false),
  });
}
