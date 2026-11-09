import {
  keyboard_create,
  keyboard_open,
  KeyboardType,
  VIRTUAL_KEYBOARD,
} from "@chocbite/ts-lib-ui/keyboard";
import { box, controls, row, section } from "../../helpers";

/**Adds a labeled input to the parent*/
function input(
  parent: HTMLElement,
  label: string,
  attributes: { [key: string]: string } = {},
): HTMLInputElement {
  const input = box(parent, label).appendChild(document.createElement("input"));
  for (const [key, value] of Object.entries(attributes))
    input.setAttribute(key, value);
  return input;
}

/**Adds a line of text to the parent, that can be changed later*/
function status(parent: HTMLElement): HTMLElement {
  const line = parent.appendChild(document.createElement("div"));
  line.style.margin = "0.5rem 0";
  line.style.fontFamily = "monospace";
  return line;
}

//      _____ ______ _______ _______ _____ _   _  _____
//     / ____|  ____|__   __|__   __|_   _| \ | |/ ____|
//    | (___ | |__     | |     | |    | | |  \| | |  __
//     \___ \|  __|    | |     | |    | | | . ` | | |_ |
//     ____) | |____   | |     | |   _| |_| |\  | |__| |
//    |_____/|______|  |_|     |_|  |_____|_| \_|\_____|
{
  const sec = section(
    "VIRTUAL_KEYBOARD setting",
    "Off by default. When on, focusing an editable field opens the matching keyboard. It is stored, so it stays on for other pages and reloads",
  );
  controls(sec, {
    On: () => void VIRTUAL_KEYBOARD.write(true),
    Off: () => void VIRTUAL_KEYBOARD.write(false),
  });
  const line = status(sec);
  VIRTUAL_KEYBOARD.sub((v) => {
    line.textContent = "VIRTUAL_KEYBOARD: " + (v.ok ? String(v.value) : "error");
  }, true);
}

//                _    _ _______ ____
//         /\    | |  | |__   __/ __ \
//        /  \   | |  | |  | | | |  | |
//       / /\ \  | |  | |  | | | |  | |
//      / ____ \ | |__| |  | | | |__| |
//     /_/    \_\ \____/   |_|  \____/
{
  const sec = section(
    "Automatic, one field per keyboard type",
    "Turn the setting on and click each field. Does the right keyboard open, do the keys fit, does typing, backspace, arrows, enter and close behave. The label says the expected keyboard",
  );
  const log = status(sec);
  const fields = row(sec);
  const all: HTMLElement[] = [
    input(fields, "text → Text", { type: "text", placeholder: "Text" }),
    input(fields, "password → Text", { type: "password", value: "secret" }),
    input(fields, "email → Email", { type: "email", placeholder: "a@b.c" }),
    input(fields, "tel → Phone", { type: "tel", placeholder: "+45 12 34" }),
    input(fields, "number → NumberInteger", { type: "number", value: "-12" }),
    input(fields, "number min=0 → NumberWhole", {
      type: "number",
      min: "0",
      value: "12",
    }),
    input(fields, "number step=0.1 → NumberRational", {
      type: "number",
      step: "0.1",
      value: "-1.5",
    }),
    input(fields, "number min=0 step=any → NumberRationalPositive", {
      type: "number",
      min: "0",
      step: "any",
      value: "1.5",
    }),
    input(fields, "color → Color", { type: "color", value: "#3b82f6" }),
    input(fields, "date → Date", { type: "date", value: "2026-09-22" }),
    input(fields, "datetime-local → DateTimeLocal", {
      type: "datetime-local",
      value: "2026-09-22T14:30",
    }),
    input(fields, "month → Month", { type: "month", value: "2026-09" }),
    input(fields, "time → Time", { type: "time", value: "14:30" }),
    input(fields, "week → Week", { type: "week", value: "2026-W39" }),
    input(fields, "empty date → Date", { type: "date" }),
  ];
  const textarea = box(fields, "textarea → Text").appendChild(
    document.createElement("textarea"),
  );
  textarea.value = "Line one\nLine two";
  const editable = box(fields, "contenteditable → Text", {
    minWidth: "10rem",
    padding: "0.25rem",
    border: "1px solid gray",
  });
  editable.contentEditable = "true";
  editable.innerHTML = "Some <b>bold</b> text";
  all.push(textarea, editable);
  for (const field of all) {
    const show = (e: Event) => {
      const value =
        field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
          ? field.value
          : field.textContent;
      log.textContent = `${e.type} ${JSON.stringify(value)}`;
    };
    field.addEventListener("input", show);
    field.addEventListener("change", show);
  }
  log.textContent = "Last input or change event shows here";
}

//     _   _  ____    _  _________     ______   ____          _____  _____
//    | \ | |/ __ \  | |/ /  ____\ \   / /  _ \ / __ \   /\   |  __ \|  __ \
//    |  \| | |  | | | ' /| |__   \ \_/ /| |_) | |  | | /  \  | |__) | |  | |
//    | . ` | |  | | |  < |  __|   \   / |  _ <| |  | |/ /\ \ |  _  /| |  | |
//    | |\  | |__| | | . \| |____   | |  | |_) | |__| / ____ \| | \ \| |__| |
//    |_| \_|\____/  |_|\_\______|  |_|  |____/ \____/_/    \_\_|  \_\_____/
{
  const sec = section(
    "Fields without a keyboard",
    "With the setting on, none of these should open a keyboard",
  );
  const fields = row(sec);
  input(fields, "checkbox", { type: "checkbox" });
  input(fields, "radio", { type: "radio" });
  input(fields, "range", { type: "range" });
  input(fields, "file", { type: "file" });
  input(fields, "readonly", { type: "text", readonly: "", value: "Read only" });
  input(fields, "disabled", { type: "text", disabled: "", value: "Disabled" });
  input(fields, "data-keyboard-manual", {
    type: "text",
    "data-keyboard-manual": "true",
    value: "Manual",
  });
  box(fields, "button").appendChild(
    document.createElement("button"),
  ).textContent = "Button";
}

//     __  __          _   _ _    _          _
//    |  \/  |   /\   | \ | | |  | |   /\   | |
//    | \  / |  /  \  |  \| | |  | |  /  \  | |
//    | |\/| | / /\ \ | . ` | |  | | / /\ \ | |
//    | |  | |/ ____ \| |\  | |__| |/ ____ \| |____
//    |_|  |_/_/    \_\_| \_|\____//_/    \_\_|____|
{
  const sec = section(
    "keyboard_open",
    "Opens a keyboard for the field without the setting, works with the setting off. NumberHex is only reachable this way. Date and color keyboards only open for inputs of their own type",
  );
  const fields = row(sec);
  const text = input(fields, "Text field, data-keyboard-manual", {
    type: "text",
    "data-keyboard-manual": "true",
    placeholder: "Pick a keyboard",
  });
  const date = input(fields, "Date field, data-keyboard-manual", {
    type: "date",
    "data-keyboard-manual": "true",
    value: "2026-01-31",
  });
  const color = input(fields, "Color field, data-keyboard-manual", {
    type: "color",
    "data-keyboard-manual": "true",
    value: "#ff8800",
  });
  let close = () => {};
  const open = (element: HTMLInputElement, type: KeyboardType) => () => {
    close();
    element.focus();
    close = keyboard_open(element, type);
  };
  const buttons: { [text: string]: () => void } = {};
  for (const [name, type] of Object.entries(KeyboardType))
    buttons[name] =
      type === KeyboardType.Color
        ? open(color, type)
        : [
              KeyboardType.Date,
              KeyboardType.DateTimeLocal,
              KeyboardType.Month,
              KeyboardType.Time,
              KeyboardType.Week,
            ].includes(type as never)
          ? open(date, type)
          : open(text, type);
  buttons["Close (returned function)"] = () => close();
  controls(sec, buttons);
}

//      _____ _    _  _____ _______ ____  __  __
//     / ____| |  | |/ ____|__   __/ __ \|  \/  |
//    | |    | |  | | (___    | | | |  | | \  / |
//    | |    | |  | |\___ \   | | | |  | | |\/| |
//    | |____| |__| |____) |  | | | |__| | |  | |
//     \_____|\____/|_____/   |_|  \____/|_|  |_|
{
  const sec = section(
    "keyboard_create",
    "A custom keyboard with a second layer, wide and tall keys and gaps. The special keys are written as strings, KeyboardSpecialKeys is not exported",
  );
  const fields = row(sec);
  const target = input(fields, "Custom keyboard", {
    type: "text",
    "data-keyboard-manual": "true",
    placeholder: "Click to open",
  });
  const custom = keyboard_create({
    default: {
      max_width: 30,
      keys: [
        [{ text: "A" }, { text: "B" }, { text: "C" }, { text: "⌫", key: "backspace" }],
        [{ text: "D", cols: 2 }, 1, { text: "Tall", key: "!", rows: 2 }],
        [{ text: "123", key: "layer:numbers", cols: 3 }],
        [{ text: "Close", key: "close", cols: 4 }],
      ],
    },
    layers: {
      numbers: {
        max_width: 30,
        keys: [
          [{ text: "1" }, { text: "2" }, { text: "3" }, { text: "⌫", key: "backspace" }],
          [{ text: "4" }, { text: "5" }, { text: "6" }, { text: "⏎", key: "enter" }],
          [{ text: "ABC", key: "layer:numbers", cols: 4 }],
        ],
      },
    },
  });
  target.addEventListener("click", () => keyboard_open(target, custom));
  const tiny = input(fields, "One key keyboard from a config", {
    type: "text",
    "data-keyboard-manual": "true",
    placeholder: "Click to open",
  });
  tiny.addEventListener("click", () =>
    keyboard_open(tiny, { default: { keys: [[{ text: "x" }]] } }),
  );
}

//     _____   ____   _____ _____ _______ _____ ____  _   _
//    |  __ \ / __ \ / ____|_   _|__   __|_   _/ __ \| \ | |
//    | |__) | |  | | (___   | |    | |    | || |  | |  \| |
//    |  ___/| |  | |\___ \  | |    | |    | || |  | | . ` |
//    | |    | |__| |____) |_| |_   | |   _| || |__| | |\  |
//    |_|     \____/|_____/|_____|  |_|  |_____\____/|_| \_|
{
  const sec = section(
    "Fields the keyboard would cover",
    "With the setting on, the page moves up so the field stays above the keyboard and moves back on close. The tall textarea should keep its top on screen",
  );
  const fields = row(sec);
  const tall = box(fields, "Tall textarea").appendChild(
    document.createElement("textarea"),
  );
  tall.style.height = "70vh";
  tall.style.width = "20rem";
  tall.value = "Click near the bottom";
  const spacer = sec.appendChild(document.createElement("div"));
  spacer.style.height = "40vh";
  input(row(sec), "Text field at the bottom of the page", {
    type: "text",
    placeholder: "Bottom",
  });
  input(row(sec), "Number field at the bottom of the page", {
    type: "number",
    value: "0",
  });
}
