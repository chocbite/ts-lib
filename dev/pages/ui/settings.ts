import { settings_init } from "@chocbite/ts-lib-ui/settings";
import { none, some, type Option } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../helpers";

const GROUP_NAME = "dev/settings-page";
const VERSION_KEY = "dev/settings-page-version";
const version = localStorage.getItem(VERSION_KEY) ?? "1.0.0";

const SETTINGS = settings_init(
  GROUP_NAME,
  version,
  "Dev settings page",
  "Settings made by the dev settings page",
);
const SUB = SETTINGS.make_sub_group("sub", "Sub group", "A nested group");

/**Line of monospace text, that can be changed later*/
function status(parent: HTMLElement): HTMLElement {
  const line = parent.appendChild(document.createElement("div"));
  line.style.margin = "0.25rem 0 0.5rem";
  line.style.fontFamily = "monospace";
  line.style.whiteSpace = "pre-wrap";
  return line;
}

/**Shows the stored values with the given key prefixes, updated while the page runs since storing is async*/
function storage_view(parent: HTMLElement, prefixes: string[]): HTMLElement {
  const view = status(parent);
  Object.assign(view.style, {
    padding: "0.5rem",
    border: "1px solid #8888",
    fontSize: "0.8rem",
  });
  const show = () => {
    const lines: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (prefixes.some((prefix) => key.startsWith(prefix)))
        lines.push(`${key} = ${localStorage.getItem(key)}`);
    }
    const text = lines.sort().join("\n") || "(nothing stored)";
    if (view.textContent !== text) view.textContent = text;
  };
  show();
  setInterval(show, 250);
  return view;
}

const in_range =
  (min: number, max: number) =>
  (stored: unknown): Option<number> =>
    typeof stored === "number" && stored >= min && stored <= max
      ? some(stored)
      : none();

//     _____  ______ _____ _____  _____ _______ ______ _____  ______ _____
//    |  __ \|  ____/ ____|_   _|/ ____|__   __|  ____|  __ \|  ____|  __ \
//    | |__) | |__ | |  __  | | | (___    | |  | |__  | |__) | |__  | |  | |
//    |  _  /|  __|| | |_ | | |  \___ \   | |  |  __| |  _  /|  __| | |  | |
//    | | \ \| |___| |__| |_| |_ ____) |  | |  | |____| | \ \| |____| |__| |
//    |_|  \_\______\_____|_____|_____/   |_|  |______|_|  \_\______|_____/
{
  const sec = section(
    "Registered states",
    "Each state is registered to the group, changing it stores it as JSON. Change values, then reload the frame, they should come back",
  );
  const flag = SETTINGS.register(
    "flag",
    "Flag",
    "A boolean",
    state.rosw(SETTINGS.get("flag", false), true),
  );
  const count = SETTINGS.register(
    "count",
    "Count",
    "A number between 0 and 10",
    state.rosw(
      state.n.help(SETTINGS.get("count", 5, in_range(0, 10)), {
        min: state.ok(0),
        max: state.ok(10),
      }),
      true,
    ),
  );
  const text = SUB.register(
    "text",
    "Text",
    "A string in the sub group",
    state.rosw(SUB.get("text", "hello"), true),
  );
  const list = SUB.register(
    "list",
    "List",
    "An array in the sub group",
    state.rosw(SUB.get<number[]>("list", [1, 2, 3]), true),
  );
  const values = status(sec);
  const show = () =>
    (values.textContent = [
      `flag = ${flag.ok()}`,
      `count = ${count.ok()}`,
      `text = ${text.ok()}`,
      `list = ${JSON.stringify(list.ok())}`,
    ].join("\n"));
  for (const s of [flag, count, text, list]) s.sub(show, true);
  const refused = status(sec);
  refused.style.color = "#d33";
  controls(sec, {
    "Toggle flag": () => void flag.write(!flag.ok()),
    "Count +1": async () => {
      const result = await count.write(count.ok() + 1);
      refused.textContent = result.ok ? "" : "count refused: " + result.error;
    },
    "Count -1": async () => {
      const result = await count.write(count.ok() - 1);
      refused.textContent = result.ok ? "" : "count refused: " + result.error;
    },
    "Text from prompt": () => {
      const value = prompt("Text", text.ok());
      if (value !== null) void text.write(value);
    },
    "Push to list": () => list.array.push(list.ok().length + 1),
    "Pop list": () => list.array.pop(),
    "Reload frame": () => location.reload(),
  });
  box(sec, "Stored in localStorage").appendChild(
    storage_view(sec, [GROUP_NAME + "/"]),
  );
}

//      _____ _    _ ______ _____ _  __
//     / ____| |  | |  ____/ ____| |/ /
//    | |    | |__| | |__ | |    | ' /
//    | |    |  __  |  __|| |    |  <
//    | |____| |  | | |___| |____| . \
//     \_____|_|  |_|______\_____|_|\_\
{
  const sec = section(
    "Invalid stored values",
    "Writes a raw value to storage and reloads. Count has a check, so anything not a number from 0 to 10 falls back to 5. Text has no check, so any JSON comes back as is, broken JSON falls back",
  );
  const write_raw = (key: string, raw: string) => () => {
    localStorage.setItem(GROUP_NAME + "/" + key, raw);
    location.reload();
  };
  controls(sec, {
    "count = 99": write_raw("count", "99"),
    'count = "7"': write_raw("count", '"7"'),
    "count = broken JSON": write_raw("count", "{broken"),
    "text = 42 (a number)": write_raw("sub/text", "42"),
    "text = broken JSON": write_raw("sub/text", "{broken"),
  });
}

//      _____ ______ _______
//     / ____|  ____|__   __|
//    | (___ | |__     | |
//     \___ \|  __|    | |
//     ____) | |____   | |
//    |_____/|______|  |_|
{
  const sec = section(
    "set",
    "Stores a value for an id that has no registered state. Setting a registered id throws",
  );
  const result = status(sec);
  let n = 0;
  controls(sec, {
    "set unregistered": () => {
      SETTINGS.set("unregistered", { n: ++n });
      result.textContent = `stored { n: ${n} }, get gives ${JSON.stringify(SETTINGS.get("unregistered", {}).value)}`;
    },
    "set registered flag": () => {
      try {
        SETTINGS.set("flag", true);
        result.textContent = "did not throw";
      } catch (error) {
        result.textContent = "threw: " + String(error);
      }
    },
  });
}

//    __      ________ _____   _____ _____ ____  _   _
//    \ \    / /  ____|  __ \ / ____|_   _/ __ \| \ | |
//     \ \  / /| |__  | |__) | (___   | || |  | |  \| |
//      \ \/ / |  __| |  _  / \___ \  | || |  | | . ` |
//       \  /  | |____| | \ \ ____) |_| || |__| | |\  |
//        \/   |______|_|  \_\_____/|_____\____/|_| \_|
{
  const sec = section(
    "Version change",
    "The group is made with the version below. Reloading with another version gives the group version_changed, and a get with a migration function then migrates the stored value. Here the migration doubles the stored number",
  );
  const migrated = SETTINGS.get(
    "migrated",
    1,
    undefined,
    (existing, old_version) => {
      console.log(`migrating ${existing} from ${old_version}`);
      return Number(existing) * 2;
    },
  ).value;
  if (localStorage.getItem(GROUP_NAME + "/migrated") === null)
    SETTINGS.set("migrated", migrated);
  status(sec).textContent = [
    `version = ${version}`,
    `version_changed = ${SETTINGS.version_changed}`,
    `sub group version_changed = ${SUB.version_changed}`,
    `migrated = ${migrated}`,
  ].join("\n");
  const reload_as = (version: string) => () => {
    localStorage.setItem(VERSION_KEY, version);
    location.reload();
  };
  controls(sec, {
    "Reload as 1.0.0": reload_as("1.0.0"),
    "Reload as 2.0.0": reload_as("2.0.0"),
    "Reload as 3.0.0": reload_as("3.0.0"),
  });
}

//                _      _
//         /\    | |    | |
//        /  \   | |    | |
//       / /\ \  | |    | |
//      / ____ \ | |____| |____
//     /_/    \_\|______|______|
{
  const sec = section(
    "Everything stored",
    "All settings of this page and the libraries, and the stored package versions. The theme and keyboard settings show up here when changed in their pages or the shell",
  );
  storage_view(sec, [GROUP_NAME, "@chocbite/", "settings/"]);
  const buttons = row(sec);
  controls(buttons, {
    "Remove this page's settings and reload": () => {
      for (const key of Object.keys(localStorage))
        if (key.startsWith(GROUP_NAME)) localStorage.removeItem(key);
      location.reload();
    },
  });
}
