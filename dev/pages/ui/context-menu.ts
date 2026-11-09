import ctm from "@chocbite/ts-lib-ui/context-menu";
import {
  material_content_copy_rounded,
  material_content_cut_rounded,
  material_content_paste_rounded,
  material_delete_rounded,
  material_edit_rounded,
  material_folder_rounded,
  material_palette_rounded,
  material_save_rounded,
  material_search_rounded,
  material_settings_rounded,
  material_star_rounded,
} from "@chocbite/ts-lib-ui/icons";
import { array_from_length } from "@chocbite/ts-lib/common";
import { none, some } from "@chocbite/ts-lib/result";
import { box, controls, row, section } from "../../helpers";

const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf"];
const word = (i: number) => WORDS[i % WORDS.length];

//Shows what the last clicked line was, fixed so it is visible wherever the menu was opened
const last = document.body.appendChild(document.createElement("div"));
Object.assign(last.style, {
  position: "fixed",
  bottom: "0.5rem",
  left: "50%",
  transform: "translateX(-50%)",
  padding: "0.25rem 0.5rem",
  font: "0.8rem monospace",
  background: "#8884",
  borderRadius: "4px",
  zIndex: "1",
});
last.textContent = "Clicked line shows here";
const clicked = (text: string) => () => (last.textContent = "Clicked: " + text);

/**Plain line that reports when clicked*/
const line = (text: string, icon?: () => SVGSVGElement, shortcut?: string) =>
  ctm.line(text, clicked(text), icon?.(), shortcut);

/**Adds a box to right click*/
function target(
  parent: HTMLElement,
  label: string,
  style: Partial<CSSStyleDeclaration> = {},
): HTMLElement {
  const target = box(parent, label, {
    width: "8rem",
    height: "4rem",
    border: "1px dashed gray",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.8rem",
    ...style,
  });
  target.textContent = "Right click";
  return target;
}

//      _      _____ _   _ ______  _____
//     | |    |_   _| \ | |  ____|/ ____|
//     | |      | | |  \| | |__  | (___
//     | |      | | | . ` |  __|  \___ \
//     | |____ _| |_| |\  | |____ ____) |
//     |______|_____|_| \_|______|_____/
{
  const sec = section(
    "Lines",
    "Right click each box. Compare the menus side by side: alignment of icons, text, shortcuts and checkmarks, hover color, dividers. Try the keyboard too: arrows, tab, enter, escape",
  );
  const boxes = row(sec);
  ctm.attach(
    target(boxes, "Text only"),
    ctm.menu([line("Cut"), line("Copy"), line("Paste")]),
  );
  ctm.attach(
    target(boxes, "Icons"),
    ctm.menu([
      line("Cut", material_content_cut_rounded),
      line("Copy", material_content_copy_rounded),
      line("Paste", material_content_paste_rounded),
      line("Delete", material_delete_rounded),
    ]),
  );
  ctm.attach(
    target(boxes, "Some icons"),
    ctm.menu([
      line("With icon", material_star_rounded),
      line("Without icon"),
      line("With icon", material_save_rounded),
    ]),
  );
  ctm.attach(
    target(boxes, "Shortcuts"),
    ctm.menu([
      line("Cut", material_content_cut_rounded, "Ctrl+X"),
      line("Copy", material_content_copy_rounded, "Ctrl+C"),
      line("Paste", material_content_paste_rounded, "Ctrl+V"),
      line("Save as", material_save_rounded, "Ctrl+Shift+S"),
    ]),
  );
  ctm.attach(
    target(boxes, "Checkmarks"),
    ctm.menu([
      ctm.line("Checked", clicked("Checked"), undefined, undefined, true),
      ctm.line("Not checked", clicked("Not checked"), undefined, undefined, false),
      ctm.line(
        "Checked with shortcut",
        clicked("Checked with shortcut"),
        material_star_rounded(),
        "F2",
        true,
      ),
    ]),
  );
  ctm.attach(
    target(boxes, "Dividers"),
    ctm.menu([
      line("Cut", material_content_cut_rounded),
      line("Copy", material_content_copy_rounded),
      ctm.devider(),
      line("Delete", material_delete_rounded),
      ctm.devider(),
      ctm.devider(),
      line("After two dividers"),
    ]),
  );
  let toggled = false;
  ctm.attach(
    target(boxes, "Factory, toggling line"),
    ctm.menu(() => [
      ctm.line(
        "Toggle",
        () => (toggled = !toggled),
        undefined,
        undefined,
        toggled,
      ),
      toggled ? line("Only when toggled") : undefined,
      line("Always"),
    ]),
  );
  ctm.attach(target(boxes, "Empty menu"), ctm.menu([]));
}

//      _____ _    _ ____    __  __ ______ _   _ _    _  _____
//     / ____| |  | |  _ \  |  \/  |  ____| \ | | |  | |/ ____|
//    | (___ | |  | | |_) | | \  / | |__  |  \| | |  | | (___
//     \___ \| |  | |  _ <  | |\/| |  __| | . ` | |  | |\___ \
//     ____) | |__| | |_) | | |  | | |____| |\  | |__| |____) |
//    |_____/ \____/|____/  |_|  |_|______|_| \_|\____/|_____/
{
  const sec = section(
    "Sub menus",
    "Hover opens a sub menu after a moment, click toggles it, arrow right / enter opens and arrow left closes. Do nested menus find room near the right edge",
  );
  const nested = (depth: number): ReturnType<typeof ctm.menu> =>
    ctm.menu([
      line("Line at depth " + depth),
      depth < 4 ? ctm.sub("Deeper", nested(depth + 1), material_folder_rounded()) : undefined,
      line("Another line"),
    ]);
  const menu = () =>
    ctm.menu([
      line("Copy", material_content_copy_rounded),
      ctm.sub(
        "Color",
        ctm.menu([line("Red"), line("Green"), line("Blue")]),
        material_palette_rounded(),
      ),
      ctm.sub("Without icon", ctm.menu([line("One"), line("Two")])),
      ctm.sub("Nested 4 deep", nested(1)),
      ctm.devider(),
      ctm.sub(
        "Long sub menu",
        ctm.menu(array_from_length(40, (i) => line(word(i) + " " + i))),
      ),
      line("Delete", material_delete_rounded),
    ]);
  const boxes = row(sec);
  boxes.style.justifyContent = "space-between";
  ctm.attach(target(boxes, "Left side"), menu());
  ctm.attach(target(boxes, "Middle"), menu());
  ctm.attach(target(boxes, "Right edge"), menu());
}

//      _      ____  _   _  _____
//     | |    / __ \| \ | |/ ____|
//     | |   | |  | |  \| | |  __
//     | |   | |  | | . ` | | |_ |
//     | |___| |__| | |\  | |__| |
//     |______\____/|_| \_|\_____|
{
  const sec = section(
    "Long menus and long text",
    "A menu taller than the screen fills the height. A menu covering more than half the screen gets a sticky Close line at the top, try 100 lines at 200% scale. Long text is limited to 30rem, are the shortcut and icon still visible",
  );
  const boxes = row(sec);
  ctm.attach(
    target(boxes, "15 lines"),
    ctm.menu(array_from_length(15, (i) => line(word(i) + " " + i))),
  );
  ctm.attach(
    target(boxes, "100 lines"),
    ctm.menu(
      array_from_length(100, (i) =>
        i % 10 === 9 ? ctm.devider() : line(word(i) + " " + i, i % 2 ? material_star_rounded : undefined),
      ),
    ),
  );
  ctm.attach(
    target(boxes, "Long text"),
    ctm.menu([
      line("Short"),
      line(
        "A line with a very long text that does not fit in the width of a context menu at all",
        material_edit_rounded,
        "Ctrl+Alt+Shift+F12",
      ),
      line(array_from_length(12, (i) => word(i)).join("")),
    ]),
  );
  ctm.attach(
    target(boxes, "Short text"),
    ctm.menu([line("A"), line("B", undefined, "1")]),
  );
}

//                _______     ___   _  _____
//         /\    / ____\ \   / / \ | |/ ____|
//        /  \  | (___  \ \_/ /|  \| | |
//       / /\ \  \___ \  \   / | . ` | |
//      / ____ \ ____) |  | |  | |\  | |____
//     /_/    \_\_____/   |_|  |_| \_|\_____|
{
  const sec = section(
    "Async and factory menus",
    "Async menus show a spinner until the lines arrive, then reposition. The factory runs on every open",
  );
  const boxes = row(sec);
  const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
  ctm.attach(
    target(boxes, "Async 1s"),
    ctm.menu(async () => {
      await wait(1000);
      return [line("Loaded A"), line("Loaded B"), line("Loaded C")];
    }),
  );
  ctm.attach(
    target(boxes, "Async 3s, 30 lines"),
    ctm.menu(async () => {
      await wait(3000);
      return array_from_length(30, (i) => line("Loaded " + i));
    }),
  );
  let opened = 0;
  ctm.attach(
    target(boxes, "Counting factory"),
    ctm.menu(() => [line("Opened " + ++opened + " times")]),
  );
  ctm.attach(
    target(boxes, "Attach factory, new menu each open"),
    () =>
      some(
        ctm.menu([
          line("Fresh menu " + ++opened),
          ctm.sub("Fresh sub", ctm.menu([line("Inside")])),
        ]),
      ),
  );
}

//     ____  _      ____   _____ _  __
//    |  _ \| |    / __ \ / ____| |/ /
//    | |_) | |   | |  | | |    | ' /
//    |  _ <| |   | |  | | |    |  <
//    | |_) | |___| |__| | |____| . \
//    |____/|______\____/ \_____|_|\_\
{
  const sec = section(
    "Block, none, detach and has",
    "Toggle blocking and attachment, then right click the box. Blocked or none shows no menu and no browser menu",
  );
  let blocked = false;
  let give_none = false;
  const boxes = row(sec);
  const blockable = target(boxes, "Blockable");
  const none_box = target(boxes, "Factory with none");
  const attachable = target(boxes, "Attachable");
  const info = sec.appendChild(document.createElement("div"));
  info.style.fontFamily = "monospace";
  const show = () =>
    (info.textContent = `blocked: ${blocked}, none: ${give_none}, has(attachable): ${ctm.has(attachable)}`);
  ctm.attach(blockable, ctm.menu([line("Not blocked")]), () => blocked);
  ctm.attach(none_box, () =>
    give_none ? none() : some(ctm.menu([line("Gave a menu")])),
  );
  const attach = () =>
    ctm.attach(attachable, ctm.menu([line("Attached menu")]));
  attach();
  controls(sec, {
    "Toggle block": () => {
      blocked = !blocked;
      show();
    },
    "Toggle none": () => {
      give_none = !give_none;
      show();
    },
    Detach: () => {
      ctm.detach(attachable);
      show();
    },
    Attach: () => {
      attach();
      show();
    },
  });
  show();
}

//      _____ _    _ __  __ __  __  ____  _   _
//     / ____| |  | |  \/  |  \/  |/ __ \| \ | |
//    | (___ | |  | | \  / | \  / | |  | |  \| |
//     \___ \| |  | | |\/| | |\/| | |  | | . ` |
//     ____) | |__| | |  | | |  | | |__| | |\  |
//    |_____/ \____/|_|  |_|_|  |_|\____/|_| \_|
{
  const sec = section(
    "Summon",
    "Opens menus from buttons. At coordinates near each corner, on an element, and beside an element without covering it (dont_cover). Does the menu stay on screen",
  );
  const menu = () =>
    ctm.menu([
      line("Copy", material_content_copy_rounded),
      line("Search", material_search_rounded),
      ctm.sub("Settings", ctm.menu([line("One"), line("Two")]), material_settings_rounded()),
    ]);
  const w = () => window.innerWidth;
  const h = () => window.innerHeight;
  controls(sec, {
    "No coordinates": () => ctm.summon(menu()),
    "Top left": () => ctm.summon(menu(), undefined, 2, 2),
    "Top right": () => ctm.summon(menu(), undefined, w() - 2, 2),
    "Bottom left": () => ctm.summon(menu(), undefined, 2, h() - 2),
    "Bottom right": () => ctm.summon(menu(), undefined, w() - 2, h() - 2),
    Center: () => ctm.summon(menu(), undefined, w() / 2, h() / 2),
  });
  const buttons = row(sec);
  buttons.style.justifyContent = "space-between";
  for (const [label, style] of [
    ["Small", { width: "3rem" }],
    ["Wide", { width: "20rem" }],
    ["Tall", { height: "8rem" }],
    ["At the right edge", {}],
  ] as [string, Partial<CSSStyleDeclaration>][]) {
    const group = box(buttons, label);
    const on = group.appendChild(document.createElement("button"));
    Object.assign(on.style, style);
    on.textContent = "On";
    on.onclick = () => ctm.summon(menu(), on);
    const beside = group.appendChild(document.createElement("button"));
    Object.assign(beside.style, style);
    beside.textContent = "Beside";
    beside.onclick = () => ctm.summon(menu(), beside, undefined, undefined, true);
  }
}

//     _____   ____   _____ _____ _______ _____ ____  _   _  _____
//    |  __ \ / __ \ / ____|_   _|__   __|_   _/ __ \| \ | |/ ____|
//    | |__) | |  | | (___   | |    | |    | || |  | |  \| | (___
//    |  ___/| |  | |\___ \  | |    | |    | || |  | | . ` |\___ \
//    | |    | |__| |____) |_| |_   | |   _| || |__| | |\  |____) |
//    |_|     \____/|_____/|_____|  |_|  |_____\____/|_| \_|_____/
{
  const sec = section(
    "Sizes and screen edges",
    "Elements of different sizes, and the four fixed squares in the corners of the screen. Right click near the edges, does the menu flip to stay on screen",
  );
  const boxes = row(sec);
  const menu = () =>
    ctm.menu([
      line("Copy", material_content_copy_rounded),
      ctm.sub("More", ctm.menu([line("One"), line("Two"), line("Three")])),
      line("Delete", material_delete_rounded),
    ]);
  const tiny = target(boxes, "Tiny", { width: "1rem", height: "1rem" });
  tiny.textContent = "";
  ctm.attach(tiny, menu());
  ctm.attach(target(boxes, "Wide", { width: "30rem" }), menu());
  ctm.attach(target(boxes, "Tall", { height: "20rem" }), menu());
  const text = sec.appendChild(document.createElement("p"));
  text.append("Inline: ");
  const span = text.appendChild(document.createElement("b"));
  span.textContent = "right click this word";
  text.append(" but not this text.");
  ctm.attach(span, menu());
  for (const [top, left] of [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ]) {
    const corner = document.body.appendChild(document.createElement("div"));
    Object.assign(corner.style, {
      position: "fixed",
      width: "1rem",
      height: "1rem",
      background: "#8888",
      [top ? "top" : "bottom"]: "0",
      [left ? "left" : "right"]: "0",
    });
    ctm.attach(corner, menu());
  }
}

//     _____  ______ ______      _    _ _   _______
//    |  __ \|  ____|  ____/\   | |  | | | |__   __|
//    | |  | | |__  | |__ /  \  | |  | | |    | |
//    | |  | |  __| |  __/ /\ \ | |  | | |    | |
//    | |__| | |____| | / ____ \| |__| | |____| |
//    |_____/|______|_|/_/    \_\\____/|______|_|
{
  const sec = section(
    "Default menu",
    "The menu for right clicks anywhere without a menu of their own, like the empty space of this page",
  );
  controls(sec, {
    "Default menu": () =>
      ctm.default(ctm.menu([line("Default A"), line("Default B")])),
    "Default factory": () =>
      ctm.default(() => some(ctm.menu([line("From default factory")]))),
    "false, block browser menu": () => ctm.default(false),
    "undefined, browser menu": () => ctm.default(undefined),
  });
}
