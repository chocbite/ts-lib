import { AccessTypes } from "@chocbite/ts-lib-ui/base";
import ctm from "@chocbite/ts-lib-ui/context_menu";
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
import { NiceError, none, some } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
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
  ctm.line({ text, on_click: clicked(text), icon, shortcut });

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
      ctm.line({
        text: "Checked",
        on_click: clicked("Checked"),
        checked: true,
      }),
      ctm.line({
        text: "Not checked",
        on_click: clicked("Not checked"),
        checked: false,
      }),
      ctm.line({
        text: "Checked with shortcut",
        on_click: clicked("Checked with shortcut"),
        icon: material_star_rounded,
        shortcut: "F2",
        checked: true,
      }),
    ]),
  );
  ctm.attach(
    target(boxes, "Dividers"),
    ctm.menu([
      line("Cut", material_content_cut_rounded),
      line("Copy", material_content_copy_rounded),
      ctm.divider(),
      line("Delete", material_delete_rounded),
      ctm.divider(),
      ctm.divider(),
      line("After two dividers"),
    ]),
  );
  let toggled = false;
  ctm.attach(
    target(boxes, "Factory, toggling line"),
    ctm.menu(() => [
      ctm.line({
        text: "Toggle",
        on_click: () => (toggled = !toggled),
        checked: toggled,
      }),
      toggled ? line("Only when toggled") : undefined,
      line("Always"),
    ]),
  );
  ctm.attach(target(boxes, "Empty menu"), ctm.menu([]));
}

//      _____ _   _ _____  _    _ _______ _____
//     |_   _| \ | |  __ \| |  | |__   __/ ____|
//       | | |  \| | |__) | |  | |  | | | (___
//       | | | . ` |  ___/| |  | |  | |  \___ \
//      _| |_| |\  | |    | |__| |  | |  ____) |
//     |_____|_| \_|_|     \____/   |_| |_____/
{
  const sec = section(
    "Inputs and states",
    "Lines take text, icon, shortcut and checked as initial values or states, and access like every element. The menus are kept, not built on open, so the buttons change the open menu: open it, use the buttons, open it again. An error shows the nice text and the fault icon. The checked line writes its own state in on_click, a click does not toggle checked by itself. Read access greys a line out and the keyboard skips it, none hides it",
  );
  const text = st.from_w("Rename me");
  const shortcut = st.ok_w("F1");
  const checked = st.ok_w(false);
  const access = st.ok_w<AccessTypes>(AccessTypes.Write);
  let renames = 0;
  controls(sec, {
    Rename: () => text.set_ok("Renamed " + ++renames),
    "Text error": () =>
      text.set_err(
        new NiceError(Symbol("No name"), "The name could not be read"),
      ),
    "Change shortcut": () =>
      shortcut.set_ok(shortcut.ok() === "F1" ? "Ctrl+Shift+F1" : "F1"),
    "Toggle checked": () => checked.set_ok(!checked.ok()),
    "Access write": () => access.set_ok(AccessTypes.Write),
    "Access read": () => access.set_ok(AccessTypes.Read),
    "Access none": () => access.set_ok(AccessTypes.None),
  });
  const boxes = row(sec);
  ctm.attach(
    target(boxes, "States"),
    ctm.menu([
      ctm.line({ text, on_click: clicked("state text"), shortcut }),
      ctm.line({
        text: "Checked from a state",
        checked,
        on_click: () => checked.set_ok(!checked.ok()),
      }),
      ctm.sub({
        text,
        icon: material_folder_rounded,
        menu: ctm.menu([line("Inside")]),
      }),
    ]),
  );
  ctm.attach(
    target(boxes, "Access"),
    ctm.menu([
      line("Write"),
      ctm.line({
        text: "Read, greyed out",
        on_click: clicked("read"),
        access: AccessTypes.Read,
      }),
      ctm.line({ text: "None, hidden", access: AccessTypes.None }),
      ctm.line({
        text: "Access from the buttons",
        on_click: clicked("access state"),
        access,
      }),
      line("Last"),
    ]),
  );
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
      depth < 4
        ? ctm.sub({
            text: "Deeper",
            menu: nested(depth + 1),
            icon: material_folder_rounded,
          })
        : undefined,
      line("Another line"),
    ]);
  const menu = () =>
    ctm.menu([
      line("Copy", material_content_copy_rounded),
      ctm.sub({
        text: "Color",
        menu: ctm.menu([line("Red"), line("Green"), line("Blue")]),
        icon: material_palette_rounded,
      }),
      ctm.sub({
        text: "Without icon",
        menu: ctm.menu([line("One"), line("Two")]),
      }),
      ctm.sub({ text: "Nested 4 deep", menu: nested(1) }),
      ctm.divider(),
      ctm.sub({
        text: "Long sub menu",
        menu: ctm.menu(array_from_length(40, (i) => line(word(i) + " " + i))),
      }),
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
        i % 10 === 9
          ? ctm.divider()
          : line(word(i) + " " + i, i % 2 ? material_star_rounded : undefined),
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
  ctm.attach(target(boxes, "Attach factory, new menu each open"), () =>
    some(
      ctm.menu([
        line("Fresh menu " + ++opened),
        ctm.sub({ text: "Fresh sub", menu: ctm.menu([line("Inside")]) }),
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
      ctm.sub({
        text: "Settings",
        menu: ctm.menu([line("One"), line("Two")]),
        icon: material_settings_rounded,
      }),
    ]);
  const w = () => window.innerWidth;
  const h = () => window.innerHeight;
  controls(sec, {
    "No coordinates": () => ctm.summon(menu()),
    "Top left": () => ctm.summon(menu(), { x: 2, y: 2 }),
    "Top right": () => ctm.summon(menu(), { x: w() - 2, y: 2 }),
    "Bottom left": () => ctm.summon(menu(), { x: 2, y: h() - 2 }),
    "Bottom right": () => ctm.summon(menu(), { x: w() - 2, y: h() - 2 }),
    Center: () => ctm.summon(menu(), { x: w() / 2, y: h() / 2 }),
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
    on.onclick = () => ctm.summon(menu(), { element: on });
    const beside = group.appendChild(document.createElement("button"));
    Object.assign(beside.style, style);
    beside.textContent = "Beside";
    beside.onclick = () =>
      ctm.summon(menu(), { element: beside, dont_cover: true });
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
      ctm.sub({
        text: "More",
        menu: ctm.menu([line("One"), line("Two"), line("Three")]),
      }),
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

//       _____ ____  __  __ ____ _____ _   _ ______
//      / ____/ __ \|  \/  |  _ \_   _| \ | |  ____|
//     | |   | |  | | \  / | |_) || | |  \| | |__
//     | |   | |  | | |\/| |  _ < | | | . ` |  __|
//     | |___| |__| | |  | | |_) || |_| |\  | |____
//      \_____\____/|_|  |_|____/_____|_| \_|______|
{
  const sec = section(
    "Combined menus",
    "ctm.combine joins groups of lines and menus with a divider between them, the last box joins lines, two menus and a promised menu, it shows a spinner for a second. Empty groups leave no divider, all empty gives no menu so the default or browser menu shows. The middle group is a function, toggle the lock and right click again, the menu is built on every open",
  );
  let locked = false;
  let opens = 0;
  controls(sec, { "Toggle lock": () => (locked = !locked) });
  const boxes = row(sec);
  ctm.attach(
    target(boxes, "Three groups"),
    ctm.combine(
      [
        line("Cut", material_content_cut_rounded),
        line("Copy", material_content_copy_rounded),
      ],
      () => [
        line(locked ? "Unlock" : "Lock"),
        locked ? undefined : line("Edit", material_edit_rounded),
        line("Opened " + ++opens + " times"),
      ],
      [line("Delete", material_delete_rounded)],
    ),
  );
  ctm.attach(
    target(boxes, "Empty groups"),
    ctm.combine([], undefined, [line("Only line")], () => [undefined], []),
  );
  ctm.attach(target(boxes, "All empty"), ctm.combine([], undefined));
  ctm.attach(
    target(boxes, "Lines + menus"),
    ctm.combine(
      [line("Extra line in front")],
      ctm.menu([line("From a menu A"), line("From a menu B")]),
      () => some(ctm.menu([line("From a menu factory")])),
      () =>
        ctm.menu(
          new Promise((resolve) =>
            setTimeout(() => resolve([line("Promised after 1s")]), 1000),
          ),
        ),
    ),
  );
}
