import {
  get_cursor_position,
  set_cursor_end,
  set_cursor_position,
  set_selection_all,
} from "@chocbite/ts-lib-ui/selection";
import { box, controls, row, section } from "../../helpers";

/**Buttons that keep the focus and selection where they are, so the functions act on the current state*/
function keep_focus(controls: HTMLElement): HTMLElement {
  controls.addEventListener("mousedown", (e) => e.preventDefault());
  return controls;
}

//      _______ ______  _____ _______
//     |__   __|  ____|/ ____|__   __|
//        | |  | |__  | (___    | |
//        | |  |  __|  \___ \   | |
//        | |  | |____ ____) |  | |
//        |_|  |______|_____/   |_|
{
  const sec = section(
    "Cursor in different editable elements",
    "Click or use the arrow keys in a field, the number under it is get_cursor_position, -1 means no cursor in it. Then use the buttons, they act on the last focused field and do not take the focus",
  );
  const fields = row(sec);
  const elements: { element: HTMLElement; position: HTMLElement }[] = [];
  const add = (label: string, element: HTMLElement) => {
    const parent = box(fields, label);
    parent.appendChild(element);
    const position = parent.appendChild(document.createElement("code"));
    position.style.display = "block";
    elements.push({ element, position });
    return element;
  };

  const input = document.createElement("input");
  input.value = "Hello input world";
  add("input", input);

  const textarea = document.createElement("textarea");
  textarea.value = "First line\nSecond line\nThird line";
  textarea.rows = 3;
  add("textarea", textarea);

  const editable = (html: string) => {
    const element = document.createElement("div");
    element.contentEditable = "true";
    element.innerHTML = html;
    Object.assign(element.style, {
      minWidth: "12rem",
      minHeight: "1.5rem",
      padding: "0.25rem",
      border: "1px solid gray",
    });
    return element;
  };
  add("contenteditable, plain", editable("Plain editable text"));
  add(
    "contenteditable, nested",
    editable("Some <b>bold <i>and italic</i></b> text"),
  );
  add(
    "contenteditable, lines",
    editable("First line<div>Second line</div><div>Third line</div>"),
  );
  add("contenteditable, empty", editable(""));

  let target: HTMLElement = input;
  const show = () => {
    for (const { element, position } of elements) {
      const at = get_cursor_position(element);
      position.textContent =
        `position ${at}` + (element === target ? " (target)" : "");
    }
  };
  for (const { element } of elements)
    element.addEventListener("focus", () => {
      target = element;
      show();
    });
  document.addEventListener("selectionchange", show);
  show();

  keep_focus(
    controls(sec, {
      "Position 0": () => set_cursor_position(target, 0),
      "Position 3": () => set_cursor_position(target, 3),
      "Position 12": () => set_cursor_position(target, 12),
      "Position 1000": () => set_cursor_position(target, 1000),
      "Cursor end": () => set_cursor_end(target),
      "Select all": () => set_selection_all(target),
      "Move right by one": () =>
        set_cursor_position(target, get_cursor_position(target) + 1),
      "Move left by one": () =>
        set_cursor_position(
          target,
          Math.max(get_cursor_position(target) - 1, 0),
        ),
    }),
  );
}

//      _   _  ____ _______   ______ ____   _____ _    _  _____ ______ _____
//     | \ | |/ __ \__   __| |  ____/ __ \ / ____| |  | |/ ____|  ____|  __ \
//     |  \| | |  | | | |    | |__ | |  | | |    | |  | | (___ | |__  | |  | |
//     | . ` | |  | | | |    |  __|| |  | | |    | |  | |\___ \|  __| | |  | |
//     | |\  | |__| | | |    | |   | |__| | |____| |__| |____) | |____| |__| |
//     |_| \_|\____/  |_|    |_|    \____/ \_____|\____/|_____/|______|_____/
{
  const sec = section(
    "Fields that are not focused",
    "The buttons call the functions on a field that does not have focus, they should move the focus there and place the cursor",
  );
  const fields = row(sec);
  const input = box(fields, "input").appendChild(
    document.createElement("input"),
  );
  input.value = "0123456789";
  const editable = box(fields, "contenteditable", {
    minWidth: "12rem",
    padding: "0.25rem",
    border: "1px solid gray",
  });
  editable.contentEditable = "true";
  editable.textContent = "0123456789";
  const result = sec.appendChild(document.createElement("code"));
  const report = (name: string, element: HTMLElement) =>
    (result.textContent = `${name}: focused ${document.activeElement === element}, position ${get_cursor_position(element)}`);
  controls(sec, {
    "Input position 5": () => {
      set_cursor_position(input, 5);
      report("input", input);
    },
    "Editable position 5": () => {
      set_cursor_position(editable, 5);
      report("editable", editable);
    },
    "Input select all": () => {
      set_selection_all(input);
      report("input", input);
    },
    "Editable select all": () => {
      set_selection_all(editable);
      report("editable", editable);
    },
    "Input end": () => {
      set_cursor_end(input);
      report("input", input);
    },
    "Editable end": () => {
      set_cursor_end(editable);
      report("editable", editable);
    },
  });
}
