import { define_element } from "@chocbite/ts-lib-ui/base";
import ctm from "@chocbite/ts-lib-ui/context_menu";
import {
  CompAnchor,
  comp,
  ContentBase,
  type ContentCreateOptions,
  type Panel,
} from "@chocbite/ts-lib-ui/composition";
import {
  material_brightness_medium_rounded,
  material_save_rounded,
  material_settings_rounded,
} from "@chocbite/ts-lib-ui/icons";
import type { SVGFunc } from "@chocbite/ts-lib-ui/svg";
import { prompts } from "@chocbite/ts-lib-ui/prompts";
import { px_to_rem } from "@chocbite/ts-lib-ui/theme";
import state from "@chocbite/ts-lib/state";
import { controls, section, demo_error } from "../../../helpers";

const open: Panel[] = [];
let offset = 0;
/**Opens content in a panel at the right of the page, away from the buttons, each a bit further down*/
const show = (options: ContentCreateOptions, text: string) => {
  const c = comp.content(options);
  c.style.padding = "1rem";
  c.textContent = text;
  const panel = comp.panel(c, {
    x: px_to_rem(document.documentElement.clientWidth) - 2 - (offset % 6) * 2,
    y: 2 + (offset % 6) * 6,
    anchor: CompAnchor.TOP_RIGHT,
    width: 20,
  });
  offset++;
  open.push(panel);
  return c;
};
const close_all = () => {
  for (const panel of open.splice(0)) if (panel.isConnected) panel.close();
};

//      ______ _______   ________ _____
//     |  ____|_   _\ \ / /  ____|  __ \
//     | |__    | |  \ V /| |__  | |  | |
//     |  __|   | |   > < |  __| | |  | |
//     | |     _| |_ / . \| |____| |__| |
//     |_|    |_____/_/ \_\______|_____/
{
  const sec = section(
    "Initial values",
    "The title, icon, closable and minimum width are given when the content is created, the panel shows them. Only the closable one has a close button. Drag the right edge of each, the wide one stops at 16rem",
  );
  controls(sec, {
    "Title only": () => show({ title: "Title only" }, "Content without icon"),
    "Icon and title": () =>
      show(
        { title: "Settings", icon: material_settings_rounded },
        "Content with an icon",
      ),
    Closable: () =>
      show({ title: "Closable", closable: true }, "Close me with the cross"),
    "Min width 16rem": () =>
      show({ title: "Wide", min_width: 16 }, "Can not get narrower than 16rem"),
    "Close all": close_all,
  });
}

//       _____ _______    _______ ______  _____
//      / ____|__   __|/\|__   __|  ____|/ ____|
//     | (___    | |  /  \  | |  | |__  | (___
//      \___ \   | | / /\ \ | |  |  __|  \___ \
//      ____) |  | |/ ____ \| |  | |____ ____) |
//     |_____/   |_/_/    \_\_|  |______|_____/
{
  const sec = section(
    "States",
    "Open a panel bound to states, then change them with the buttons. The title and icon follow, closable adds and removes the close button. An error shows in the title and drops the icon",
  );
  const title = state.from_w("Bound title");
  const icons: SVGFunc[] = [
    material_settings_rounded,
    material_save_rounded,
    material_brightness_medium_rounded,
  ];
  let icon_index = 0;
  const icon = state.from_w<SVGFunc | undefined>(icons[0]);
  const closable = state.ok_w(false);
  let changes = 0;
  controls(sec, {
    "Open bound panel": () =>
      show({ title, icon, closable }, "Follows the states of this section"),
    "Change title": () => title.set_ok(`Title ${++changes}`),
    "Next icon": () => icon.set_ok(icons[++icon_index % icons.length]),
    "Toggle closable": () => closable.set_ok(!closable.ok()),
    Errors: () => {
      title.set_err(demo_error("no title"));
      icon.set_err(demo_error("no icon"));
    },
    "Close all": close_all,
  });
}

//      __  __ ______ _   _ _    _
//     |  \/  |  ____| \ | | |  | |
//     | \  / | |__  |  \| | |  | |
//     | |\/| |  __| | . ` | |  | |
//     | |  | | |____| |\  | |__| |
//     |_|  |_|______|_| \_|\____/
{
  const sec = section(
    "Context menu",
    "Right click (or long press) the content or the title bar of the panel, both show the menu of the content. The count line is built when the menu opens. Replace menu swaps it with set, open menus after that show the new one",
  );
  let opened = 0;
  let current: ReturnType<typeof show> | undefined;
  controls(sec, {
    "Open panel with menu": () => {
      current = show(
        {
          title: "Right click me",
          closable: true,
        },
        "Right click here or on the title bar",
      ).set({
        context_menu: () => [
          ctm.line({ text: `Opened ${++opened} times`, on_click: () => {} }),
          ctm.line({ text: "Close", on_click: () => current?.content_close() }),
        ],
      });
    },
    "Replace menu": () =>
      current?.set({
        context_menu: [ctm.line({ text: "Replaced menu", on_click: () => {} })],
      }),
    "Close all": close_all,
  });
}

//       _____ _____ ____________
//      / ____|_   _|___  /  ____|
//     | (___   | |    / /| |__
//      \___ \  | |   / / |  __|
//      ____) |_| |_ / /__| |____
//     |_____/|_____/_____|______|
{
  const sec = section(
    "Content size",
    "Content gets its own size with content_size, width and height as states in px. Size the panel by its edges: the numbers follow, and the fixed 200 x 100 drawing, like a legacy gui, keeps its proportions and fills as much as it can. " +
      "Change the scale or input mode in the shell, the title bar changes height and the content follows that too.",
  );
  controls(sec, {
    "Open sized panel": () => {
      const c = comp.content({ title: "Content size", closable: true });
      c.style.cssText =
        "display:block;width:100%;height:100%;position:relative;overflow:hidden";
      const label = c.appendChild(document.createElement("div"));
      label.style.cssText =
        "position:absolute;left:0.5rem;top:0.25rem;font:12px monospace;z-index:1";
      //The legacy drawing, laid out for 200 x 100 px and scaled as a whole
      const drawing = c.appendChild(document.createElement("div"));
      drawing.style.cssText =
        "position:absolute;left:0;top:0;width:200px;height:100px;transform-origin:0 0;" +
        "background:linear-gradient(135deg,#2980b9,#8e44ad);border:2px solid #222;box-sizing:border-box";
      const { width, height } = c.content_size();
      //One function for both, so a change of either rescales
      const rescale = () => {
        const w = width.ok();
        const h = height.ok();
        const scale = Math.min(w / 200, h / 100);
        drawing.style.transform = `translate(${(w - 200 * scale) / 2}px,${(h - 100 * scale) / 2}px) scale(${scale})`;
        label.textContent = `${w.toFixed(0)} x ${h.toFixed(0)} px, scale ${scale.toFixed(2)}`;
      };
      width.sub(rescale, true);
      height.sub(rescale);
      open.push(
        comp.panel(c, {
          x: px_to_rem(document.documentElement.clientWidth) - 2,
          y: 2,
          anchor: CompAnchor.TOP_RIGHT,
          width: 24,
          height: 16,
        }),
      );
    },
    "Close all": close_all,
  });
}

//                _____ _  _______ _   _  _____
//         /\    / ____| |/ /_   _| \ | |/ ____|
//        /  \  | (___ | ' /  | | |  \| | |  __
//       / /\ \  \___ \|  <   | | | . ` | | |_ |
//      / ____ \ ____) | . \ _| |_| |\  | |__| |
//     /_/    \_\_____/|_|\_\_____|_| \_|\_____|
/**Content that asks before closing while it has unsaved changes*/
class Draft extends ContentBase {
  static element_name() {
    return "draft";
  }
  static element_name_space() {
    return "dev";
  }
  #unsaved = this.appendChild(document.createElement("input"));
  constructor() {
    super();
    this.style.cssText = "display:block;padding:1rem";
    this.#unsaved.type = "checkbox";
    this.#unsaved.checked = true;
    const label = this.appendChild(document.createElement("label"));
    label.textContent = " Unsaved changes";
    label.prepend(this.#unsaved);
  }
  protected async content_closing(): Promise<boolean> {
    if (!this.#unsaved.checked) return true;
    const answer = await prompts.buttons(
      `${String(this.content_title)} has unsaved changes`,
      [
        { text: "Discard", value: true },
        { text: "Keep open", value: false },
      ],
      { owner: this },
    );
    return answer.some && answer.value;
  }
}
define_element(Draft);
{
  const sec = section(
    "Asking before closing",
    "Content overrides content_closing to ask before it closes. Close a draft with the cross or by pressing outside the auto close one: with unsaved changes ticked it asks, Keep open or Escape keeps it, untick it and it closes at once. " +
      "Pressing the cross again while it asks does not ask twice. The layout of two drafts asks each, closes the ones that agree, and the panel stays while one is kept",
  );
  const draft = (title: string) => Draft.create({ title, closable: true });
  const place = (c: ContentBase, auto_close = false) =>
    open.push(
      comp.panel(c, {
        x: px_to_rem(document.documentElement.clientWidth) - 2,
        y: 2,
        anchor: CompAnchor.TOP_RIGHT,
        width: 22,
        height: 12,
        auto_close,
      }),
    );
  controls(sec, {
    Draft: () => place(draft("Draft")),
    "Auto close draft": () => place(draft("Auto close draft"), true),
    "Layout of two drafts": () =>
      place(
        comp.layout({
          root: comp.layout_tabs({
            content: [draft("First"), draft("Second")],
          }),
        }),
      ),
    "Close all": close_all,
  });
}
