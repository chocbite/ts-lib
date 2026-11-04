import {
  array_from_range,
  IPAddress,
  IPVersion,
} from "@chocbite/ts-lib/common";
import {
  material_add_to_queue_rounded,
  material_remove_from_queue_rounded,
} from "#icons";
import { VIRTUAL_KEYBOARD } from "#keyboard";
import { err, ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import {
  ANIMATION_LEVEL,
  ANIMATION_SPEED,
  INPUT_MODE,
  SCALE,
  THEME,
} from "#theme";
import form, { FormColors, FormDateTimeMode, FormDateTimeType } from ".";

const form_cont = document.createElement("div");
document.body.appendChild(form_cont);
form_cont.style.display = "flex";
form_cont.style.flexDirection = "column";
form_cont.style.flexGrow = "1";
form_cont.style.overflow = "auto";
form_cont.style.backgroundColor = "var(--form-colors-background-normal)";

form_cont.appendChild(
  form.group_collapser(
    form.group({
      border: "inset",
      max_height: 16,
      embed: false,
      elements: [
        form.text({ text: "Theme" }),
        form.toggle_button().bind({ value: THEME }),
        form.text({ text: "Input Mode" }),
        form.toggle_button().bind({ value: INPUT_MODE }),
        form.text({ text: "Animation Level" }),
        form.toggle_button().bind({ value: ANIMATION_LEVEL }),
        form.text({ text: "UI Scale" }),
        form.stepper().bind({ value: SCALE }),
        form.text({ text: "Animation Speed" }),
        form.stepper().bind({ value: ANIMATION_SPEED }),
        form.text({ text: "Virtual Keyboard" }),
        form.switch().bind({ value: VIRTUAL_KEYBOARD }),
      ],
    }),
    { collapsed: true, closed_text: "Theme Options" },
  ),
);

//      _____         _____ _______          ______  _____  _____
//     |  __ \ /\    / ____/ ____\ \        / / __ \|  __ \|  __ \
//     | |__) /  \  | (___| (___  \ \  /\  / / |  | | |__) | |  | |
//     |  ___/ /\ \  \___ \\___ \  \ \/  \/ /| |  | |  _  /| |  | |
//     | |  / ____ \ ____) |___) |  \  /\  / | |__| | | \ \| |__| |
//     |_| /_/    \_\_____/_____/    \/  \/   \____/|_|  \_\_____/
const password_state = state.ok_w("");
password_state.sub(console.error);
form_cont.appendChild(form.text({ text: "Password Input" }));
form_cont.appendChild(
  form.password({ filter: /[0-9]/ }).bind({ value: password_state }),
);
const password_input = form_cont.appendChild(
  form.password({
    filter: /[0-9]/,
    change: (val) => {
      console.warn(val);
    },
  }),
);
setInterval(() => {
  password_input.value = Math.floor(Math.random() * 1000000000000).toString();
}, 1000);

//      _____ _____    _____ _   _ _____  _    _ _______
//     |_   _|  __ \  |_   _| \ | |  __ \| |  | |__   __|
//       | | | |__) |   | | |  \| | |__) | |  | |  | |
//       | | |  ___/    | | | . ` |  ___/| |  | |  | |
//      _| |_| |       _| |_| |\  | |    | |__| |  | |
//     |_____|_|      |_____|_| \_|_|     \____/   |_|
const ip_state = state.ok_w(new IPAddress("192.168.1.1"));
form_cont.appendChild(form.text({ text: "IP Input" }));
form_cont.appendChild(
  form.ip({ type: IPVersion.V4 }).bind({ value: ip_state }),
);
form_cont.appendChild(form.text({ text: "IP Input" }));
const ip_input = form_cont.appendChild(form.ip({ type: IPVersion.V6 }));
setInterval(() => {
  ip_input.value = new IPAddress(
    Math.floor(Math.random() * 2 ** 32).toString(),
  );
}, 1000);

//       _____ ____  _      ____  _____    _____ _   _ _____  _    _ _______
//      / ____/ __ \| |    / __ \|  __ \  |_   _| \ | |  __ \| |  | |__   __|
//     | |   | |  | | |   | |  | | |__) |   | | |  \| | |__) | |  | |  | |
//     | |   | |  | | |   | |  | |  _  /    | | | . ` |  ___/| |  | |  | |
//     | |___| |__| | |___| |__| | | \ \   _| |_| |\  | |    | |__| |  | |
//      \_____\____/|______\____/|_|  \_\ |_____|_| \_|_|     \____/   |_|
const color_state = state.ok_w("#00ff00");
form_cont.appendChild(form.text({ text: "Color Input" }));
form_cont.appendChild(form.color({}).bind({ value: color_state }));
form_cont.appendChild(form.text({ text: "Color Input 2" }));
form_cont.appendChild(form.color({ live: true }).bind({ value: color_state }));
const color_input = form_cont.appendChild(form.color({}));
setInterval(() => {
  color_input.value = "#" + Math.floor(Math.random() * 16777215).toString(16);
}, 1000);

//      _____       _______ ______ _______ _____ __  __ ______
//     |  __ \   /\|__   __|  ____|__   __|_   _|  \/  |  ____|
//     | |  | | /  \  | |  | |__     | |    | | | \  / | |__
//     | |  | |/ /\ \ | |  |  __|    | |    | | | |\/| |  __|
//     | |__| / ____ \| |  | |____   | |   _| |_| |  | | |____
//     |_____/_/    \_\_|  |______|  |_|  |_____|_|  |_|______|
form_cont.appendChild(form.text({ text: "Date Time Input" }));
form_cont.appendChild(
  form.date_time({
    type: FormDateTimeType.DATETIME,
    mode: FormDateTimeMode.STRING,
    value: "2026-12-12T10:10:10+01:00",
    change: console.warn,
  }),
);

const date_time_state = state.ok_w(new Date());
form_cont.appendChild(form.text({ text: "Date Time Input" }));
form_cont.appendChild(
  form
    .date_time({ type: FormDateTimeType.TIME, mode: FormDateTimeMode.DATE })
    .bind({ value: date_time_state }),
);
form_cont.appendChild(form.text({ text: "Date Time Input" }));
form_cont.appendChild(
  form
    .date_time({ mode: FormDateTimeMode.DATE })
    .bind({ value: date_time_state }),
);
form_cont.appendChild(form.text({ text: "Date Time Input" }));
const date_time_input = form_cont.appendChild(
  form.date_time({
    mode: FormDateTimeMode.NUMBER,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    value: 5000 as number,
  }),
);
setInterval(() => {
  date_time_input.value = Math.floor(Math.random() * 100000);
}, 1000);

//      _______ ________   _________   _____ _   _ _____  _    _ _______
//     |__   __|  ____\ \ / /__   __| |_   _| \ | |  __ \| |  | |__   __|
//        | |  | |__   \ V /   | |      | | |  \| | |__) | |  | |  | |
//        | |  |  __|   > <    | |      | | | . ` |  ___/| |  | |  | |
//        | |  | |____ / . \   | |     _| |_| |\  | |    | |__| |  | |
//        |_|  |______/_/ \_\  |_|    |_____|_| \_|_|     \____/   |_|

const text_state = state.ok_w("");
form_cont.appendChild(form.text({ text: "Text Input" }));
form_cont.appendChild(
  form
    .text_input({
      placeholder: "Enter text here...",
      max_length: 20,
      max_bytes: 20,
      filter: /[a-zA-Z ]/,
    })
    .bind({ value: text_state }),
);
form_cont.appendChild(form.text({ text: "Text Input 2" }));
form_cont.appendChild(
  form
    .text_input({
      placeholder: "Enter text here...",
      max_length: 20,
      max_bytes: 20,
    })
    .bind({ value: text_state }),
);
const text_input = form_cont.appendChild(
  form.text_input({
    placeholder: "Enter text here...",
    max_length: 20,
    max_bytes: 20,
  }),
);
setInterval(() => {
  text_input.value = Math.random().toString(36).substring(2, 15);
}, 1000);

const multi_line_text_state = state.ok_w("");
form_cont.appendChild(form.text({ text: "Multiline Text Input" }));
form_cont.appendChild(
  form
    .text_multiline({
      placeholder: "Enter text here...",
      max_length: 20,
      max_bytes: 20,
    })
    .bind({ value: multi_line_text_state }),
);

form_cont.appendChild(form.text({ text: "Multiline Text Input2" }));
form_cont.appendChild(
  form
    .text_multiline({
      placeholder: "Enter text here...",
      max_length: 20,
      max_bytes: 20,
    })
    .bind({ value: multi_line_text_state }),
);
const multi_line_text_input = form_cont.appendChild(
  form.text_multiline({
    placeholder: "Enter text here...",
    max_length: 20,
    max_bytes: 20,
  }),
);

setInterval(() => {
  multi_line_text_input.value = Math.random().toString(36).substring(2, 15);
}, 1000);

//      _   _ _    _ __  __ ____  ______ _____    _____ _   _ _____  _    _ _______
//     | \ | | |  | |  \/  |  _ \|  ____|  __ \  |_   _| \ | |  __ \| |  | |__   __|
//     |  \| | |  | | \  / | |_) | |__  | |__) |   | | |  \| | |__) | |  | |  | |
//     | . ` | |  | | |\/| |  _ <|  __| |  _  /    | | | . ` |  ___/| |  | |  | |
//     | |\  | |__| | |  | | |_) | |____| | \ \   _| |_| |\  | |    | |__| |  | |
//     |_| \_|\____/|_|  |_|____/|______|_|  \_\ |_____|_| \_|_|     \____/   |_|
form_cont.appendChild(form.text({ text: "Number Input" }));
const number_input = form_cont.appendChild(
  form.number_input({
    unit: "mA",
    min: -100,
    max: 100,
    step: 0.5,
    start: 0.1,
    decimals: 1,
  }),
);
setInterval(() => {
  number_input.value = Math.random() * 200 - 100;
}, 1000);

//       _____ _____   ____  _    _ _____
//      / ____|  __ \ / __ \| |  | |  __ \
//     | |  __| |__) | |  | | |  | | |__) |
//     | | |_ |  _  /| |  | | |  | |  ___/
//     | |__| | | \ \| |__| | |__| | |
//      \_____|_|  \_\\____/ \____/|_|
form_cont.appendChild(form.text({ text: "Grid Box" }));
form_cont.appendChild(
  form.group_collapser(
    form.group({
      border: "inset",
      column: "10rem",
      elements: [
        form.button({ text: "Click Me", center: true }),
        form.button({
          text: "Click Me, long text ahead, please mister autocomplete make some long text for me",
          center: true,
          icon: material_add_to_queue_rounded,
        }),
        form.lamp({
          text: "Click Me, long text ahead, please mister autocomplete make some long text for me",
          center: true,
          icon: material_add_to_queue_rounded,
          colors: [FormColors.Red, FormColors.Green],
        }),
        form.button({ text: "Click Me", center: true }),
        form.button({
          text: "Click Me",
          center: true,
          icon: material_add_to_queue_rounded,
        }),
      ],
    }),
  ),
);

form_cont.appendChild(form.text({ text: "Group Box" }));
const grouptest = form_cont.appendChild(
  form.group({
    border: "outset",
    max_height: 6,
    elements: [
      form.text({ text: "Button in Group" }),
      form
        .button({
          id: "test",
          text: "Click Me",
        })
        .opts({ access: "r" }),
      form.text({ text: "Button in Group" }),
      form
        .button({
          id: "test2",
          text: "Click Me",
        })
        .opts({ access: "r" }),
      form.text({ text: "Slider in Group" }),
      form.slider({
        id: "slider_in_group",
        unit: "mA",
        min: -100,
        max: 100,
      }),
      form.slider({
        unit: "mA",
        min: -100,
        max: 100,
      }),
    ],
  }),
);

console.warn(grouptest.get_value);
grouptest.value = {
  test: true,
  slider_in_group: 50,
};
form_cont.appendChild(
  form.group({
    border: "none",
    embed: false,
    elements: [
      form.text({ text: "Button in Group" }),
      form.button({ text: "Click Me" }),
    ],
  }),
);
form_cont.appendChild(
  form.group({
    border: "none",
    embed: false,
    elements: [
      form.text({ text: "Button in Group" }),
      form.button({ text: "Click Me" }),
    ],
  }),
);

form_cont.appendChild(form.text({ text: "Group Box" }));
form_cont.appendChild(
  form.group_collapser(
    form.group({
      border: "outset",
      elements: [
        form.text({ text: "Hello inside group!", size: 2 }),
        form.text({ text: "Button in Group" }),
        form.button({ text: "Click Me" }).opts({ access: "r" }),
      ],
    }),
  ),
);

form_cont.appendChild(form.text({ text: "Group Box" }));
form_cont.appendChild(
  form.group_collapser(
    form.group({
      border: "inset",
      elements: [
        form.text({ text: "Hello inside group!", size: 2 }),
        form.text({ text: "Button in Group" }),
        form.button({ text: "Click Me" }).opts({ access: "r" }),
      ],
    }),
    {
      collapsed: true,
      closed_text:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus vel risus sem. Curabitur a morbi.",
    },
  ),
);

form_cont.appendChild(
  form.text({
    text: "Hello World!",
    size: 2,
  }),
);
form_cont.appendChild(
  form.text({
    text: "Hello World!, This is a long text that should wrap around the container and be visible in multiple lines.",
    size: 1,
  }),
);

const bool = state.ok_w(false);
form_cont.appendChild(form.text({ text: "YOYOYOY" }));
form_cont.appendChild(
  form
    .button({
      id: "test",
      text: "YOYOYOYO",
      icon: material_add_to_queue_rounded,
      color: FormColors.Yellow,
    })
    .opts({ access: "w" })
    .bind({ value: bool }),
);
form_cont.appendChild(
  form
    .button({
      id: "test2",
      text: "YOYOYOYO",
      icon: material_add_to_queue_rounded,
      color: FormColors.Yellow,
      center: true,
    })
    .opts({ access: "w" })
    .bind({ value: bool }),
);

form_cont.appendChild(form.text({ text: "Toggle Me" }));
form_cont.appendChild(form.switch({}).bind({ value: bool }));

form_cont.appendChild(
  form
    .lamp({
      text: "Status Lamp",
      colors: [FormColors.Black, FormColors.Green],
      icon: material_add_to_queue_rounded,
    })
    .bind({ value: bool }),
);

form_cont.appendChild(
  form
    .lamp({
      text: "Status Lamp",
      colors: [FormColors.Red, FormColors.Green],
      icon: material_add_to_queue_rounded,
      center: true,
    })
    .bind({ value: bool }),
);

console.warn(
  form
    .lamp({ colors: [FormColors.Black, FormColors.Green] })
    .opts({ value: true }),
);
console.warn(form.switch({}).opts({ value: true }));

//      _____  _____   ____  _____  _____   ______          ___   _
//     |  __ \|  __ \ / __ \|  __ \|  __ \ / __ \ \        / / \ | |
//     | |  | | |__) | |  | | |__) | |  | | |  | \ \  /\  / /|  \| |
//     | |  | |  _  /| |  | |  ___/| |  | | |  | |\ \/  \/ / | . ` |
//     | |__| | | \ \| |__| | |    | |__| | |__| | \  /\  /  | |\  |
//     |_____/|_|  \_\\____/|_|    |_____/ \____/   \/  \/   |_| \_|
const num = state.rosw(ok(0), async (v, s) =>
  v === 3 ? err("Value cannot be 3") : (s.set_ok(v) ?? ok(undefined)),
);
form_cont.appendChild(form.text({ text: "Dropdown" }));
form_cont.appendChild(
  form
    .dropdown({
      selections: [
        {
          text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus vel risus sem. Curabitur a morbi.",
          value: 2,
          icon: material_add_to_queue_rounded,
        },
        {
          text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus vel risus sem. Curabitur a morbi.",
          value: 3,
          icon: material_remove_from_queue_rounded,
        },
        {
          text: "YPYP",
          value: 6,
          icon: material_remove_from_queue_rounded,
        },
      ],
    })
    .bind({ value: num }),
);

form_cont.appendChild(form.text({ text: "Dropdown" }));
form_cont.appendChild(
  form
    .dropdown({
      default:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus vel risus sem. Curabitur a morbi.",
      default_icon: material_add_to_queue_rounded,
      selections: array_from_range(0, 100, (i) => {
        return {
          value: i,
          text: `Option ${i + 1}`,
          icon: material_remove_from_queue_rounded,
        };
      }),
    })
    .bind({ value: num }),
);

form_cont.appendChild(form.text({ text: "Dropdown" }));
const dropdown = form_cont.appendChild(
  form.dropdown({
    default:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus vel risus sem. Curabitur a morbi.",
    default_icon: material_add_to_queue_rounded,
    selections: array_from_range(0, 100, (i) => {
      return {
        value: i,
        text: `Option ${i + 1}`,
      };
    }),
  }),
);
setInterval(() => {
  dropdown.value = Math.floor(Math.random() * 100);
}, 1000);

//      _______ ____   _____  _____ _      ______   ____  _    _ _______ _______ ____  _   _  _____
//     |__   __/ __ \ / ____|/ ____| |    |  ____| |  _ \| |  | |__   __|__   __/ __ \| \ | |/ ____|
//        | | | |  | | |  __| |  __| |    | |__    | |_) | |  | |  | |     | | | |  | |  \| | (___
//        | | | |  | | | |_ | | |_ | |    |  __|   |  _ <| |  | |  | |     | | | |  | | . ` |\___ \
//        | | | |__| | |__| | |__| | |____| |____  | |_) | |__| |  | |     | | | |__| | |\  |____) |
//        |_|  \____/ \_____|\_____|______|______| |____/ \____/   |_|     |_|  \____/|_| \_|_____/
form_cont.appendChild(form.text({ text: "Toggle Buttons" }));
form_cont.appendChild(
  form
    .toggle_button({
      selections: [
        {
          text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus vel risus sem. Curabitur a morbi.",
          value: 2,
          icon: material_add_to_queue_rounded,
        },
        {
          text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus vel risus sem. Curabitur a morbi.",
          value: 3,
          icon: material_remove_from_queue_rounded,
        },
        {
          text: "YPYP",
          value: 6,
          icon: material_remove_from_queue_rounded,
        },
      ],
    })
    .bind({ value: num }),
);

form_cont.appendChild(form.text({ text: "Toggle Buttons" }));
form_cont.appendChild(
  form
    .toggle_button({
      selections: array_from_range(0, 5, (i) => {
        return {
          value: i,
          text: `Option ${i + 1}`,
          icon: material_remove_from_queue_rounded,
        };
      }),
    })
    .bind({ value: num }),
);

form_cont.appendChild(form.text({ text: "Toggle Buttons" }));
form_cont.appendChild(
  form
    .toggle_button({
      selections: array_from_range(0, 20, (i) => {
        return {
          value: i,
          text: `Option ${i + 1}`,
        };
      }),
    })
    .bind({ value: num }),
);

//       _____ _      _____ _____  ______ _____
//      / ____| |    |_   _|  __ \|  ____|  __ \
//     | (___ | |      | | | |  | | |__  | |__) |
//      \___ \| |      | | | |  | |  __| |  _  /
//      ____) | |____ _| |_| |__| | |____| | \ \
//     |_____/|______|_____|_____/|______|_|  \_\
const slider_num = state.rosw(ok(0), async (v, s) =>
  v > 3 && v < 6
    ? err("Value cannot be 3 - 6")
    : (s.set_ok(v) ?? ok(undefined)),
);
slider_num.sub((value) => console.warn("2", value.value));
form_cont.appendChild(form.text({ text: "Slider" }));
form_cont.appendChild(
  form
    .slider({
      unit: "mA",
      max: 50,
      step: 0.5,
      start: 0.1,
      decimals: 1,
    })
    .bind({ value: slider_num }),
);
form_cont.appendChild(form.text({ text: "Slider" }));
form_cont.appendChild(
  form
    .slider({
      unit: "mA",
      live: true,
      max: 50,
      step: 0.5,
      start: 0.1,
      decimals: 1,
    })
    .bind({ value: slider_num }),
);
form_cont.appendChild(form.text({ text: "Slider" }));
form_cont.appendChild(
  form
    .slider({
      unit: "mA",
      min: -50,
      max: 50,
      step: 0.5,
      start: 0.1,
      decimals: 1,
    })
    .bind({ value: slider_num }),
);
form_cont.appendChild(form.text({ text: "Slider" }));
form_cont.appendChild(
  form
    .slider({
      unit: "mA",
      min: -50,
      max: 50,
      step: 0.5,
      start: 0.1,
      decimals: 1,
      live: true,
    })
    .bind({ value: slider_num }),
);

form_cont.appendChild(form.text({ text: "Slider" }));
const slider = form_cont.appendChild(
  form.slider({
    unit: "mA",
    min: -50,
    max: 50,
    step: 0.5,
    start: 0.1,
    decimals: 1,
    live: true,
  }),
);
setInterval(() => {
  slider.value = Math.random() * 100 - 50;
}, 1000);

//       _____ _______ ______ _____  _____  ______ _____
//      / ____|__   __|  ____|  __ \|  __ \|  ____|  __ \
//     | (___    | |  | |__  | |__) | |__) | |__  | |__) |
//      \___ \   | |  |  __| |  ___/|  ___/|  __| |  _  /
//      ____) |  | |  | |____| |    | |    | |____| | \ \
//     |_____/   |_|  |______|_|    |_|    |______|_|  \_\
const stepper_num = state.ok_w(0);
form_cont.appendChild(form.text({ text: "Stepper" }));
form_cont.appendChild(
  form
    .stepper({
      unit: "mA",
      step: 0.5,
      start: 0.1,
      decimals: 1,
    })
    .bind({ value: stepper_num }),
);
form_cont.appendChild(form.text({ text: "Stepper" }));
form_cont.appendChild(
  form
    .stepper({
      unit: "mA",
      live: true,
      max: 50,
      step: 0.5,
      start: 0.1,
      decimals: 1,
    })
    .bind({ value: stepper_num }),
);
form_cont.appendChild(form.text({ text: "Stepper" }));
form_cont.appendChild(
  form
    .stepper({
      unit: "mA",
      min: -50,
      max: 50,
      step: 0.5,
      start: 0.1,
      decimals: 1,
    })
    .bind({ value: stepper_num }),
);
form_cont.appendChild(form.text({ text: "Stepper" }));
const stepper = form_cont.appendChild(
  form.stepper({
    unit: "mA",
    min: -50,
    max: 50,
    step: 0.5,
    start: 0.1,
    decimals: 1,
  }),
);
setInterval(() => {
  stepper.value = Math.random() * 100 - 50;
}, 1000);

//      _____  _____   ____   _____ _____  ______  _____ _____
//     |  __ \|  __ \ / __ \ / ____|  __ \|  ____|/ ____/ ____|
//     | |__) | |__) | |  | | |  __| |__) | |__  | (___| (___
//     |  ___/|  _  /| |  | | | |_ |  _  /|  __|  \___ \\___ \
//     | |    | | \ \| |__| | |__| | | \ \| |____ ____) |___) |
//     |_|    |_|  \_\\____/ \_____|_|  \_\______|_____/_____/
form_cont.appendChild(form.text({ text: "Progress" }));
form_cont.appendChild(form.progress({ unit: "mA" }).bind({ value: num }));
