import {
  comp,
  type ContentCreateOptions,
  type LayoutNode,
  type WorkspacePanel,
  type WorkspaceWindow,
} from "@chocbite/ts-lib-ui/composition";
import {
  material_description_rounded,
  material_folder_rounded,
  material_terminal_rounded,
} from "@chocbite/ts-lib-ui/icons";
import { DOCUMENT_HANDLER } from "@chocbite/ts-lib-ui/document";
import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { box, section } from "../../../helpers";

/**Names of the demo contents, for the text of the tree*/
const NAMES = new WeakMap<object, string>();

/**Content with a text saying what it is*/
const demo = (options: ContentCreateOptions, text: string, lines = 1) => {
  const c = comp.content(options);
  NAMES.set(c, typeof options.title === "string" ? options.title : text);
  c.style.padding = "1rem";
  c.style.boxSizing = "border-box";
  for (let i = 0; i < lines; i++)
    c.appendChild(document.createElement("p")).textContent = text;
  return c;
};

/**Position in rem on the page, from the top left of the element, panels are placed on the page in the panel container*/
const at = (element: Element, x: number, y: number) => {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const rect = element.getBoundingClientRect();
  return { x: rect.left / rem + x, y: rect.top / rem + y };
};

/**The tree of a layout as text, read from the states of its nodes*/
const describe = (node: LayoutNode | undefined, depth = 0): string => {
  if (!node) return "";
  const pad = "  ".repeat(depth);
  if ("nodes" in node)
    return `${pad}${node.direction()}\n${node
      .nodes()
      .map((c) => describe(c, depth + 1))
      .join("\n")}`;
  const active = node.active();
  return `${pad}tabs: ${node
    .contents()
    .map((c) => (c === active ? "*" : "") + (NAMES.get(c) ?? "?"))
    .join(" | ")}`;
};

//     __          ______  _____  _  __ _____ _____        _____ ______
//     \ \        / / __ \|  __ \| |/ // ____|  __ \ /\   / ____|  ____|
//      \ \  /\  / / |  | | |__) | ' /| (___ | |__) /  \ | |    | |__
//       \ \/  \/ /| |  | |  _  /|  <  \___ \|  ___/ /\ \| |    |  __|
//        \  /\  / | |__| | | \ \| . \ ____) | |  / ____ \ |____| |____
//         \/  \/   \____/|_|  \_\_|\_\_____/|_| /_/    \_\_____|______|
{
  const sec = section(
    "Workspace",
    "Right click a tab and Pop out to put it in a panel, a tab alone in the main layout has no Pop out. Drag tabs between the main layout and the panels, and between panels, a panel is removed when its last tab leaves. The title bar of a panel shows the shown tab of the group worked in last, and moves the panel, its menu has Open in window: the panel becomes a browser window, drag tabs between the window and the page with the mouse (touch drags stay within a window), Pop out in the window makes a panel in that window, closing the window brings it back as a panel of the page with its panels. A new panel has its tabs at the bottom. The close button shows when every tab in the panel can be closed, Terminal can not, and closes them all. The panels are in the panel container of the page, like all panels, so they stay where they are when the page scrolls, the starting panel is placed over the box when the page loads. The text below follows the states of the workspace and its nodes, the windows with their panels, place and size",
  );
  const root = state.ok_w<LayoutNode>(
    comp.layout_split({
      direction: "row",
      children: [
        comp.layout_tabs({
          content: [
            demo(
              { title: "Files", icon: material_folder_rounded },
              "Files, not closable",
              30,
            ),
          ],
        }),
        comp.layout_tabs({
          content: [
            demo(
              {
                title: "Readme.md",
                icon: material_description_rounded,
                closable: true,
              },
              "Readme",
              40,
            ),
            demo({ title: "Notes", closable: true }, "Notes"),
            demo({ title: "Wide", closable: true, min_width: 24 }, "Wide"),
          ],
          size: 3,
        }),
      ],
    }),
  );
  const area = box(sec, "Workspace in a 60rem by 32rem box", {
    width: "60rem",
    maxWidth: "100%",
    height: "32rem",
    border: "1px solid #8884",
  });
  const panels: WorkspacePanel[] = [
    comp.workspace_panel(
      comp.layout_tabs({
        content: [
          demo(
            { title: "Terminal", icon: material_terminal_rounded },
            "Terminal, a panel from the start",
          ),
          demo({ title: "Output", closable: true }, "Output"),
        ],
        side: "bottom",
      }),
      { ...at(area, 30, 12), width: 24, height: 12 },
    ),
  ];
  const windows = state.ok_w<WorkspaceWindow[]>([
    { root, panels: state.ok_w(panels) },
  ]);
  area.appendChild(comp.workspace({ windows }));
  const tree = sec.appendChild(document.createElement("pre"));
  const show = () => {
    const n = (v: number) => v.toFixed(1);
    const place = (p: Partial<WorkspacePanel>) =>
      p.x && p.y && p.width && p.height
        ? ` at ${n(p.x.ok())}, ${n(p.y.ok())} size ${n(p.width.ok())} x ${n(p.height.ok())}`
        : "";
    const text = windows
      .ok()
      .flatMap((w, i) => [
        (i === 0 ? "page" : `window ${i}${place(w)}`) +
          "\n" +
          describe(w.root.ok(), 1),
        ...w.panels
          .ok()
          .map(
            (p, j) => `  panel ${j}${place(p)}\n` + describe(p.root.ok(), 2),
          ),
      ])
      .join("\n");
    //Written only when it changed, writing it is a change of the page the observer sees
    if (tree.textContent !== text) tree.textContent = text;
  };
  show();
  //The nodes follow their own states, the elements show them, the panels are in the panel containers of the page and the windows
  const observer = new MutationObserver(show);
  const observe = (doc: Document) =>
    observer.observe(doc.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style"],
    });
  observe(document);
  DOCUMENT_HANDLER.events.on("added", (e) => observe(e.data));
}

//      ______ _____  ____  _____  ______ _   _
//     |  ____|  __ \/ __ \|___  /|  ____| \ | |
//     | |__  | |__) | |  | |  / / | |__  |  \| |
//     |  __| |  _  /| |  | | / /  |  __| | . ` |
//     | |    | | \ \| |__| |/ /__ | |____| |\  |
//     |_|    |_|  \_\\____//_____||______|_| \_|
{
  const sec = section(
    "Read only panels",
    "The panels are a read only state, the panel stays but tabs can not be popped out, and the last tab of the panel can not leave it, so it would not be left empty. Tabs still move between the panel and the layout. A plain layout next to it has no owner, tabs can not be dragged between it and the workspace",
  );
  const r = sec.appendChild(document.createElement("div"));
  r.style.cssText = "display:flex;gap:1rem;flex-wrap:wrap";
  const tabs = (name: string) =>
    [1, 2, 3].map((i) =>
      demo({ title: `${name} ${i}`, closable: true }, `${name} ${i}`),
    );
  const area = box(r, "Workspace", { width: "36rem", height: "18rem" });
  area.appendChild(
    comp.workspace({
      windows: [
        {
          root: state.ok_w<LayoutNode>(
            comp.layout_tabs({ content: tabs("Main") }),
          ),
          panels: state.ros(
            ok([
              comp.workspace_panel(
                comp.layout_tabs({ content: tabs("Fixed") }),
                { ...at(area, 10, 4), width: 20, height: 10 },
              ),
            ]),
          ),
        },
      ],
    }),
  );
  box(r, "Plain layout", { width: "20rem", height: "18rem" }).appendChild(
    comp.layout({ root: comp.layout_tabs({ content: tabs("Plain") }) }),
  );
}
