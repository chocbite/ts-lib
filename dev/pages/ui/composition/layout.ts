import {
  comp,
  LayoutSide,
  type ContentCreateOptions,
} from "@chocbite/ts-lib-ui/composition";
import ctm from "@chocbite/ts-lib-ui/context_menu";
import {
  material_description_rounded,
  material_folder_rounded,
  material_settings_rounded,
  material_terminal_rounded,
} from "@chocbite/ts-lib-ui/icons";
import state from "@chocbite/ts-lib/state";
import { box, controls, demo_error, section } from "../../../helpers";

/**Content with a text saying what it is, the text repeated so scrolling can be tried*/
const demo = (options: ContentCreateOptions, text: string, lines = 1) => {
  const c = comp.content(options);
  c.style.padding = "1rem";
  c.style.boxSizing = "border-box";
  for (let i = 0; i < lines; i++)
    c.appendChild(document.createElement("p")).textContent = text;
  return c;
};

//      _           __     ______  _    _ _______
//     | |        /\\ \   / / __ \| |  | |__   __|
//     | |       /  \\ \_/ / |  | | |  | |  | |
//     | |      / /\ \\   /| |  | | |  | |  | |
//     | |____ / ____ \| | | |__| | |__| |  | |
//     |______/_/    \_\_|  \____/ \____/   |_|
{
  const sec = section(
    "Layout",
    "Drag a tab: onto a tab bar to put it between the tabs, onto the middle of a group to add it there, onto an edge of a group to split the group, onto the outer edge of the layout to split the whole layout. Escape while dragging cancels. A group left empty disappears, a split left with one group gives its space back. Drag the lines between groups to size them, a group never gets smaller than its contents' min width, Wide has min width 24rem. Middle click or × closes closable tabs, right click a tab for Close, Split right and Split down. Arrow keys move between the tabs of a group, Enter goes into the content. The active tab of the group with focus is marked blue",
  );
  const title = state.from_w("Renamed by state");
  let count = 0;
  const files = demo(
    { title: "Files", icon: material_folder_rounded },
    "Files, not closable, has its own context menu line",
    30,
  );
  files.set({
    context_menu: () => [ctm.line({ text: "Files menu line" })],
  });
  const layout = comp.layout({
    split: "row",
    children: [
      { tabs: [files], size: 1 },
      {
        split: "column",
        size: 3,
        children: [
          {
            tabs: [
              demo(
                {
                  title: "Readme.md",
                  icon: material_description_rounded,
                  closable: true,
                },
                "Readme, closable",
                40,
              ),
              demo(
                { title, icon: material_description_rounded, closable: true },
                "The title is a state, change it with the buttons",
              ),
              demo(
                { title: "Wide", closable: true, min_width: 24 },
                "Min width 24rem, the group and the splits around it keep at least that",
              ),
            ],
            size: 3,
          },
          {
            tabs: [
              demo(
                { title: "Terminal", icon: material_terminal_rounded },
                "Terminal, not closable",
              ),
              demo(
                {
                  title: "Settings",
                  icon: material_settings_rounded,
                  closable: true,
                },
                "Settings",
              ),
            ],
          },
        ],
      },
    ],
  });
  controls(sec, {
    "Open new": () =>
      layout.open(
        demo(
          { title: `New ${++count}`, closable: true },
          "Opened in the group worked in last",
        ),
      ),
    "Open right of Files": () =>
      layout.open(
        demo(
          { title: `Beside ${++count}`, closable: true },
          "Opened to the right of the Files group",
        ),
        { beside: files, side: LayoutSide.RIGHT },
      ),
    "Show Files": () => layout.open(files),
    Rename: () => title.set_ok(`Renamed ${++count}`),
    "Title error": () => title.set_err(demo_error("No title")),
  });
  box(sec, "Layout in a 60rem by 30rem box", {
    width: "60rem",
    maxWidth: "100%",
    height: "30rem",
    border: "1px solid #8884",
  }).appendChild(layout);
}

{
  const sec = section(
    "Two layouts",
    "Tabs can be dragged from one layout to the other",
  );
  const make = (name: string) =>
    comp.layout({
      tabs: [1, 2, 3].map((i) =>
        demo({ title: `${name} ${i}`, closable: true }, `${name} ${i}`),
      ),
    });
  const r = document.createElement("div");
  r.style.cssText = "display:flex;gap:1rem;flex-wrap:wrap";
  sec.appendChild(r);
  box(r, "Left", { width: "28rem", height: "16rem" }).appendChild(make("Left"));
  box(r, "Right", { width: "28rem", height: "16rem" }).appendChild(
    make("Right"),
  );
}
