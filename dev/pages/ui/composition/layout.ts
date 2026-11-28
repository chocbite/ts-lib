import {
  comp,
  LayoutSide,
  type ContentCreateOptions,
  type LayoutNode,
} from "@chocbite/ts-lib-ui/composition";
import ctm from "@chocbite/ts-lib-ui/context_menu";
import {
  material_description_rounded,
  material_folder_rounded,
  material_settings_rounded,
  material_terminal_rounded,
} from "@chocbite/ts-lib-ui/icons";
import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { box, controls, demo_error, section } from "../../../helpers";

/**Names of the demo contents, for the text of the tree*/
const NAMES = new WeakMap<object, string>();

/**Content with a text saying what it is, the text repeated so scrolling can be tried*/
const demo = (options: ContentCreateOptions, text: string, lines = 1) => {
  const c = comp.content(options);
  NAMES.set(c, typeof options.title === "string" ? options.title : text);
  c.style.padding = "1rem";
  c.style.boxSizing = "border-box";
  for (let i = 0; i < lines; i++)
    c.appendChild(document.createElement("p")).textContent = text;
  return c;
};

/**The tree of the layout as text, read from the states of its nodes*/
const describe = (node: LayoutNode | undefined, depth = 0): string => {
  if (!node) return "";
  const pad = "  ".repeat(depth);
  const size = node.size().toFixed(2);
  if ("nodes" in node)
    return `${pad}${node.direction()} ${size}\n${node
      .nodes()
      .map((c) => describe(c, depth + 1))
      .join("\n")}`;
  const active = node.active();
  return `${pad}tabs ${size}: ${node
    .contents()
    .map((c) => (c === active ? "*" : "") + (NAMES.get(c) ?? "?"))
    .join(" | ")}`;
};

/**Shows the tree of the layout in the element, again every time the layout changes*/
const follow_tree = (
  layout: HTMLElement,
  root: () => LayoutNode | undefined,
) => {
  const text = document.createElement("pre");
  const show = () => {
    const tree = describe(root());
    if (text.textContent !== tree) text.textContent = tree;
  };
  show();
  new MutationObserver(show).observe(layout, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  });
  return text;
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
    "Drag a tab: onto a tab bar to put it between the tabs, onto the middle of a group to add it there, onto an edge of a group to split the group, onto the outer edge of the layout to split the whole layout. Escape while dragging cancels. A group left empty disappears, a split left with one group gives its space back. Drag the lines between groups to size them, a group never gets smaller than its contents' min width, Wide has min width 24rem. Middle click or × closes closable tabs, right click a tab for Close, Pop out, Split right and Split down. Pop out moves the tab into a new panel with a layout of its own, tabs drag between it and this layout, and the panel closes when its last tab leaves. Arrow keys move between the tabs of a group, Enter goes into the content. The layout is a tree of states, the text below follows them, it changes only when the layout writes them",
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
  const readme = demo(
    {
      title: "Readme.md",
      icon: material_description_rounded,
      closable: true,
    },
    "Readme, closable",
    40,
  );
  const root = state.ok_w<LayoutNode>(
    comp.layout_split({
      direction: "row",
      children: [
        comp.layout_tabs({ content: [files] }),
        comp.layout_split({
          direction: "column",
          children: [
            comp.layout_tabs({
              content: [
                readme,
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
            }),
            comp.layout_tabs({
              content: [
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
            }),
          ],
          size: 3,
        }),
      ],
    }),
  );
  const layout = comp.layout({ root });
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
    "Show Readme": () => layout.open(readme),
    Rename: () => title.set_ok(`Renamed ${++count}`),
    "Title error": () => title.set_err(demo_error("No title")),
  });
  box(sec, "Layout in a 60rem by 30rem box", {
    width: "60rem",
    maxWidth: "100%",
    height: "30rem",
    border: "1px solid #8884",
  }).appendChild(layout);
  sec.appendChild(follow_tree(layout, () => root.ok()));
}

//       _____ _____   ____   _____ _____ _____ _   _  _____
//      / ____|  __ \ / __ \ / ____/ ____|_   _| \ | |/ ____|
//     | |    | |__) | |  | | (___| (___   | | |  \| | |  __
//     | |    |  _  /| |  | |\___ \\___ \  | | | . ` | | |_ |
//     | |____| | \ \| |__| |____) |___) |_| |_| |\  | |__| |
//      \_____|_|  \_\\____/|_____/_____/|_____|_| \_|\_____|
{
  const sec = section(
    "Crossing sizers",
    "Press where sizers meet to move them together, the lines that will move light up and the cursor shows moving both ways. The two upright lines start lined up, pressing the middle line where they meet it moves all three. Move one upright line a bit away, they still move together while within reach, move it further and they move alone",
  );
  const cell = (name: string) =>
    comp.layout_tabs({
      content: [demo({ title: name, closable: true }, name)],
    });
  const row = (name: string) =>
    comp.layout_split({
      direction: "row",
      children: [cell(`${name} left`), cell(`${name} right`)],
    });
  box(sec, "Two rows in a column", {
    width: "40rem",
    maxWidth: "100%",
    height: "20rem",
  }).appendChild(
    comp.layout({
      root: comp.layout_split({
        direction: "column",
        children: [row("Top"), row("Bottom")],
      }),
    }),
  );
}

//      _______       ____   _____
//     |__   __|/\   |  _ \ / ____|
//        | |  /  \  | |_) | (___
//        | | / /\ \ |  _ < \___ \
//        | |/ ____ \| |_) |____) |
//        |_/_/    \_\____/|_____/
{
  const sec = section(
    "Tab sides and compact tabs",
    "Right click a tab for Tabs at, to put the tabs of its group at a side, and Compact tabs, to show only icons, a content without an icon shows the first letter of its title. The whole title shows when hovering a tab. Tabs are never wider than 14rem, the long title is cut short. Drag tabs into the side bars, the line shows where they go",
  );
  const tabs = (name: string) => [
    demo(
      { title: `${name} files`, icon: material_folder_rounded, closable: true },
      `${name} files`,
    ),
    demo(
      { title: `${name} terminal`, icon: material_terminal_rounded },
      `${name} terminal`,
    ),
    demo({ title: `${name} notes`, closable: true }, `${name} notes, no icon`),
  ];
  box(sec, "Groups with their tabs at each side", {
    width: "60rem",
    maxWidth: "100%",
    height: "30rem",
    border: "1px solid #8884",
  }).appendChild(
    comp.layout({
      root: comp.layout_split({
        direction: "row",
        children: [
          comp.layout_tabs({
            content: tabs("Left"),
            side: "left",
            compact: true,
          }),
          comp.layout_split({
            direction: "column",
            children: [
              comp.layout_tabs({
                content: [
                  ...tabs("Top"),
                  demo(
                    {
                      title:
                        "A very long title that is cut short at the max width of a tab",
                      closable: true,
                    },
                    "Long title",
                  ),
                ],
              }),
              comp.layout_tabs({ content: tabs("Bottom"), side: "bottom" }),
            ],
            size: 3,
          }),
          comp.layout_tabs({
            content: tabs("Right"),
            side: "right",
            size: 1.5,
          }),
        ],
      }),
    }),
  );
}

//      _      ____   _____ _  ________ _____
//     | |    / __ \ / ____| |/ /  ____|  __ \
//     | |   | |  | | |    | ' /| |__  | |  | |
//     | |   | |  | | |    |  < |  __| | |  | |
//     | |___| |__| | |____| . \| |____| |__| |
//     |______\____/ \_____|_|\_\______|_____/
{
  const sec = section(
    "Locked parts",
    "Read only states lock parts of a layout, a state that does not write synchronously counts as read only. Left: the contents are a read only state, they can not be dragged, closed or reordered, and nothing can be dropped into the group, switching tabs still works. Right: the split is read only, tabs move between the two groups but no group can be added or removed, so the last tab of a group can not leave it",
  );
  const row = sec.appendChild(document.createElement("div"));
  row.style.cssText = "display:flex;gap:1rem;flex-wrap:wrap";
  const tabs = (name: string) =>
    [1, 2, 3].map((i) =>
      demo({ title: `${name} ${i}`, closable: true }, `${name} ${i}`),
    );
  box(row, "Read only contents", {
    width: "28rem",
    height: "14rem",
  }).appendChild(
    comp.layout({
      root: comp.layout_tabs({ content: state.ros(ok(tabs("Locked"))) }),
    }),
  );
  box(row, "Read only split", {
    width: "28rem",
    height: "14rem",
  }).appendChild(
    comp.layout({
      root: comp.layout_split({
        direction: "row",
        children: state.ros(
          ok([
            comp.layout_tabs({ content: tabs("A") }),
            comp.layout_tabs({ content: tabs("B") }),
          ]),
        ),
      }),
    }),
  );
}

//      _______          ______
//     |__   __\ \        / / __ \
//        | |   \ \  /\  / / |  | |
//        | |    \ \/  \/ /| |  | |
//        | |     \  /\  / | |__| |
//        |_|      \/  \/   \____/
{
  const sec = section(
    "Two layouts",
    "Tabs can be dragged from one layout to the other, each layout keeps its own initial root",
  );
  const make = (name: string) =>
    comp.layout({
      root: comp.layout_tabs({
        content: [1, 2, 3].map((i) =>
          demo({ title: `${name} ${i}`, closable: true }, `${name} ${i}`),
        ),
      }),
    });
  const r = sec.appendChild(document.createElement("div"));
  r.style.cssText = "display:flex;gap:1rem;flex-wrap:wrap";
  box(r, "Left", { width: "28rem", height: "16rem" }).appendChild(make("Left"));
  box(r, "Right", { width: "28rem", height: "16rem" }).appendChild(
    make("Right"),
  );
}
