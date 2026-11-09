import ctm from "@chocbite/ts-lib-ui/context-menu";
import { DOCUMENT_HANDLER } from "@chocbite/ts-lib-ui/document";
import { VIRTUAL_KEYBOARD } from "@chocbite/ts-lib-ui/keyboard";
import { theme_init_variable_root } from "@chocbite/ts-lib-ui/theme";
import { box, controls, row, section } from "../../helpers";

//Colors for the other documents, so it is visible when the theme reaches them
const colors = theme_init_variable_root(
  "devdocument",
  "Dev document page",
  "Variables made by the dev document page",
);
const BACKGROUND = colors.make_variable(
  "background",
  "Background",
  "",
  "#fff8e0",
  "#203040",
  "Color",
  undefined,
);
const TEXT = colors.make_variable(
  "text",
  "Text",
  "",
  "#302000",
  "#e0f0ff",
  "Color",
  undefined,
);

/**Line of monospace text, that can be changed later*/
function status(parent: HTMLElement): HTMLElement {
  const line = parent.appendChild(document.createElement("div"));
  line.style.margin = "0.25rem 0 0.5rem";
  line.style.fontFamily = "monospace";
  line.style.whiteSpace = "pre-wrap";
  return line;
}

/**Fills another document with things that use the libraries*/
function fill(doc: Document, name: string) {
  //Inline, so the page css copied along with the library styles does not override it
  Object.assign(doc.documentElement.style, {
    background: `var(${BACKGROUND}, #f0f)`,
    color: `var(${TEXT}, #000)`,
  });
  const style = doc.head.appendChild(doc.createElement("style"));
  style.textContent = `
    body { margin: 0.5rem; font-family: sans-serif; }
    .target { border: 1px dashed gray; padding: 1rem; margin: 0.5rem 0; }
    .scroll { height: 4rem; overflow: auto; border: 1px solid gray; }
  `;
  doc.body.replaceChildren();
  doc.body.appendChild(doc.createElement("b")).textContent = name;
  const target = doc.body.appendChild(doc.createElement("div"));
  target.className = "target";
  target.textContent = "Right click me, context menu";
  ctm.attach(
    target,
    ctm.menu([
      ctm.line("Line in " + name, () => (target.textContent = "Clicked")),
      ctm.sub("Sub menu", ctm.menu([ctm.line("Inside", () => {})])),
    ]),
  );
  const input = doc.body.appendChild(doc.createElement("input"));
  input.placeholder = "Focus me, virtual keyboard";
  const scroll = doc.body.appendChild(doc.createElement("div"));
  scroll.className = "scroll";
  scroll.textContent = "Scrollbar from the theme. ".repeat(30);
}

/**Shows the registered documents, updated on the handler events*/
function documents_view(parent: HTMLElement) {
  const view = status(parent);
  const show = () =>
    (view.textContent =
      `${DOCUMENT_HANDLER.documents.length} registered:\n` +
      DOCUMENT_HANDLER.documents
        .map(
          (doc) =>
            "  " +
            (doc === DOCUMENT_HANDLER.main
              ? "main"
              : (doc.body.firstElementChild?.textContent ?? "?")),
        )
        .join("\n"));
  DOCUMENT_HANDLER.events.on("added", show);
  DOCUMENT_HANDLER.events.on("removed", show);
  show();
}

//      _____ ______ _____            __  __ ______  _____
//     |_   _|  ____|  __ \     /\   |  \/  |  ____|/ ____|
//       | | | |__  | |__) |   /  \  | \  / | |__  | (___
//       | | |  __| |  _  /   / /\ \ | |\/| |  __|  \___ \
//      _| |_| |    | | \ \  / ____ \| |  | | |____ ____) |
//     |_____|_|    |_|  \_\/_/    \_\_|  |_|______|_____/
{
  const sec = section(
    "Other documents",
    "Each iframe is filled from this page. Before registering, it has no theme colors (magenta fallback), right click shows the browser menu and no keyboard opens. Register it, then try the context menu, the keyboard and switch the theme in the shell. Copying styles brings the library css along, without it the menus are unstyled",
  );
  controls(sec, {
    "Keyboard on": () => void VIRTUAL_KEYBOARD.write(true),
    "Keyboard off": () => void VIRTUAL_KEYBOARD.write(false),
  });
  documents_view(sec);
  const frames = row(sec);
  for (const [label, styles] of [
    ["Frame A", true],
    ["Frame B", false],
  ] as const) {
    const parent = box(frames, label);
    const frame = parent.appendChild(document.createElement("iframe"));
    Object.assign(frame.style, {
      width: "22rem",
      height: "14rem",
      border: "1px solid gray",
    });
    const doc = frame.contentDocument!;
    fill(doc, label);
    const registered = () => DOCUMENT_HANDLER.documents.includes(doc);
    controls(parent, {
      [styles ? "Register, copy styles" : "Register, no styles"]: () => {
        if (!registered()) DOCUMENT_HANDLER.register_document(doc, styles);
      },
      Deregister: () => {
        if (registered()) DOCUMENT_HANDLER.deregister_document(doc);
      },
    });
  }
}

//     _____   ____  _____  _    _ _____
//    |  __ \ / __ \|  __ \| |  | |  __ \
//    | |__) | |  | | |__) | |  | | |__) |
//    |  ___/| |  | |  ___/| |  | |  ___/
//    | |    | |__| | |    | |__| | |
//    |_|     \____/|_|     \____/|_|
{
  const sec = section(
    "Popup window",
    "Opens a window, fills and registers it with copied styles, and deregisters it when it closes. The same things should work there",
  );
  controls(sec, {
    "Open popup": () => {
      const popup = window.open("", "", "width=420,height=320");
      if (!popup) return;
      const doc = popup.document;
      fill(doc, "Popup");
      DOCUMENT_HANDLER.register_document(doc, true);
      popup.addEventListener("pagehide", () => {
        if (DOCUMENT_HANDLER.documents.includes(doc))
          DOCUMENT_HANDLER.deregister_document(doc);
      });
    },
  });
}
