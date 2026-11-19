import { AccessTypes } from "#base";
import ctm, { type ContextMenuLine } from "#context_menu";
import state, { type State } from "@chocbite/ts-lib/state";
import { page_from_json, type CanvasPage, type CanvasWidget } from "./data";
import { group_bounds } from "./group";
import { remove_widgets } from "./order";

/**Distance every paste of copied widgets is placed further down and right, so copies do not hide the widgets they are copies of*/
const PASTE_OFFSET = 20;
/**Format of the text of copied widgets, a paste only takes texts of it*/
const FORMAT = "chocbite-canvas-widgets";

/**The copied widgets, as JSON, the way a page saves them, and as the text given to the clipboard of the system*/
let copied: unknown[] = [];
let copied_text = "";
/**Pastes since the copy, a cut starts at 0 so the first paste is where the widgets were*/
let pastes = 0;

/**Whether there are copied widgets to paste in the app, the clipboard of the system can have others*/
export function has_copied(): boolean {
  return copied.length > 0;
}

/**The value of a state now, undefined when it has none*/
const value_now = (option: State<unknown> | undefined): unknown => {
  const value = option?.rsync ? option.get() : undefined;
  return value?.ok ? value.value : undefined;
};

/**Copies the widgets, as the JSON a page saves them as, so pasting makes widgets with states of their own,
 * the copy is kept in the app, shared by every page, and given as the text for the clipboard of the system,
 * like {"format":"chocbite-canvas-widgets","widgets":[...]}, so it can be pasted in another browser
 * Options are read as they are now, an option without a value now is left out*/
export function copy_widgets(widgets: readonly CanvasWidget[]): string {
  if (!widgets.length) return copied_text;
  const json = widgets.map((widget) => {
    const options: Record<string, unknown> = {};
    for (const [key, option] of Object.entries(
      widget.options as Record<string, State<unknown> | undefined>,
    )) {
      const value = value_now(option);
      if (value !== undefined) options[key] = value;
    }
    return { widget: widget.widget, options };
  });
  //Through JSON, so links become their $link objects, like when a page is saved
  copied_text = JSON.stringify({ format: FORMAT, widgets: json });
  copied = (JSON.parse(copied_text) as { widgets: unknown[] }).widgets;
  pastes = 1;
  return copied_text;
}

/**Copies the widgets and removes them from the page, the first paste puts them back where they were,
 * false when they can not be removed, the copy is then undone*/
export async function cut_widgets(
  page: CanvasPage,
  widgets: readonly CanvasWidget[],
): Promise<boolean> {
  if (!widgets.length) return false;
  const before = { copied, copied_text, pastes };
  copy_widgets(widgets);
  pastes = 0;
  if (await remove_widgets(page, widgets)) return true;
  ({ copied, copied_text, pastes } = before);
  return false;
}

/**The widgets of a text of copied widgets, undefined for any other text*/
function widgets_of_text(text: string): unknown[] | undefined {
  try {
    const json: unknown = JSON.parse(text);
    if (
      typeof json === "object" &&
      json !== null &&
      (json as { format?: unknown }).format === FORMAT &&
      Array.isArray((json as { widgets?: unknown }).widgets)
    )
      return (json as { widgets: unknown[] }).widgets;
  } catch {
    return undefined;
  }
  return undefined;
}

/**A number value of an option, undefined while it holds none, like a link*/
const number_of = (widget: CanvasWidget, key: string): number | undefined => {
  const value = value_now(
    (widget.options as Record<string, State<unknown> | undefined>)[key],
  );
  return typeof value === "number" ? value : undefined;
};

/**An area of a page, like the part a viewport shows*/
export interface PageArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**Where and what paste_widgets pastes*/
export interface PasteOptions {
  /**Places the top left of the box around the copies here, without it every paste is placed further down and right*/
  at?: { x: number; y: number };
  /**From the clipboard of the system, copied widgets in it are pasted instead of those copied in the app,
   * widgets copied in another browser are placed where they were at the first paste*/
  text?: string;
  /**Keeps the copies inside the area, like the part of the page a viewport shows,
   * a box around them that does not fit keeps its top left in it*/
  within?: PageArea;
}

/**Moves a start along one axis so a length from it is inside the area, or the start when the length does not fit*/
const clamp_into = (
  start: number,
  length: number,
  from: number,
  size: number,
) =>
  length <= size
    ? Math.min(Math.max(start, from), from + size - length)
    : Math.min(Math.max(start, from), from + size);

/**Adds copies of the copied widgets to the page, in front, by writing a push instruction to its widgets state
 * They are placed further down and right with every paste, or with the top left of the box around them at the point given,
 * see PasteOptions. The page gives copies new ids, as their ids are taken. Gives the copies, none when the widgets can not be written*/
export async function paste_widgets(
  page: CanvasPage,
  options: PasteOptions = {},
): Promise<CanvasWidget[]> {
  const { at, text, within } = options;
  const from_text = text === undefined ? undefined : widgets_of_text(text);
  if (from_text && text !== copied_text) {
    copied = from_text;
    copied_text = text!;
    pastes = 0;
  }
  const widgets = page.widgets;
  if (!copied.length || !state.is.state(widgets) || !widgets.writable)
    return [];
  const made = page_from_json({ widgets: copied });
  if (!made.some) return [];
  //page_from_json makes the widgets a local state, which has its value at once
  const copies = (
    made.value.widgets as State<CanvasWidget[]> & { ok(): CanvasWidget[] }
  ).ok();
  const box = group_bounds(
    copies.map((widget) => ({
      x: number_of(widget, "x") ?? 0,
      y: number_of(widget, "y") ?? 0,
      width: number_of(widget, "width") ?? 0,
      height: number_of(widget, "height") ?? 0,
      rotation: number_of(widget, "rotation") ?? 0,
    })),
  );
  let dx: number;
  let dy: number;
  if (at) {
    dx = at.x - box.x;
    dy = at.y - box.y;
  } else {
    dx = dy = PASTE_OFFSET * pastes++;
  }
  if (within) {
    dx = clamp_into(box.x + dx, box.width, within.x, within.width) - box.x;
    dy = clamp_into(box.y + dy, box.height, within.y, within.height) - box.y;
  }
  for (const widget of copies)
    for (const [key, by] of [
      ["x", dx],
      ["y", dy],
    ] as const) {
      const now = number_of(widget, key);
      const option = (
        widget.options as Record<string, State<unknown> | undefined>
      )[key];
      if (now !== undefined && by !== 0) void option?.write?.(now + by);
    }
  const written = await widgets.write?.(
    state.a.write.push<CanvasWidget>(...copies),
  );
  return written?.ok ? copies : [];
}

/**Gives the text to the clipboard of the system, where the browser lets it, the copy in the app is kept either way*/
function write_system(text: string | undefined): void {
  if (text) void navigator.clipboard?.writeText(text).catch(() => {});
}

/**The text of the clipboard of the system, only where reading it is granted already, so a menu never waits on the browser asking,
 * undefined otherwise, ctrl+v gives the text with the paste event, which needs no permission*/
async function read_system(): Promise<string | undefined> {
  try {
    const permission = await navigator.permissions?.query({
      name: "clipboard-read" as PermissionName,
    });
    if (permission?.state !== "granted") return undefined;
    return await navigator.clipboard?.readText();
  } catch {
    return undefined;
  }
}

/**Context menu lines to cut, copy and paste widgets, they use the clipboard of the system where the browser lets them,
 * paste is greyed out without widgets copied in the app, as the clipboard of the system can only be read on the click
 * @param selected the widgets cut and copied
 * @param removed called after cut widgets are removed, like to take them out of the selection
 * @param pasted called with the pasted widgets, like to select them
 * @param at where paste puts the copies, see paste_widgets*/
export function edit_lines(
  page: CanvasPage,
  selected: readonly CanvasWidget[],
  removed: () => void,
  pasted: (widgets: CanvasWidget[]) => void,
  at?: { x: number; y: number },
  within?: PageArea,
): ContextMenuLine[] {
  const writable = state.is.state(page.widgets) && page.widgets.writable;
  const access = (can: boolean) => (can ? AccessTypes.Write : AccessTypes.Read);
  return [
    ctm.line({
      text: "Cut",
      shortcut: "Ctrl+X",
      access: access(writable && selected.length > 0),
      on_click: () => {
        void cut_widgets(page, selected).then((done) => {
          if (!done) return;
          write_system(copied_text);
          removed();
        });
      },
    }),
    ctm.line({
      text: "Copy",
      shortcut: "Ctrl+C",
      access: access(selected.length > 0),
      on_click: () => write_system(copy_widgets(selected)),
    }),
    paste_line(page, pasted, at, within),
  ];
}

/**Context menu line pasting copied widgets, from the clipboard of the system where the browser lets it,
 * greyed out without widgets copied in the app*/
export function paste_line(
  page: CanvasPage,
  pasted: (widgets: CanvasWidget[]) => void,
  at?: { x: number; y: number },
  within?: PageArea,
): ContextMenuLine {
  const writable = state.is.state(page.widgets) && page.widgets.writable;
  return ctm.line({
    text: "Paste",
    shortcut: "Ctrl+V",
    access: writable && has_copied() ? AccessTypes.Write : AccessTypes.Read,
    on_click: () => {
      void read_system()
        .then((text) => paste_widgets(page, { at, text, within }))
        .then((widgets) => {
          if (widgets.length) pasted(widgets);
        });
    },
  });
}

/**Cuts, copies and pastes the selected widgets of a page on the cut, copy and paste events of the element, which the browser
 * gives the focused element for ctrl+x, ctrl+c and ctrl+v, with the clipboard of the system, so widgets can be copied
 * between browsers, the events need no permission
 * @param removed called after cut widgets are removed, like to take them out of the selection
 * @param pasted called with the pasted widgets, like to select them
 * @param within the area pasted widgets are kept in, like the part of the page a viewport shows*/
export function clipboard_events(
  element: HTMLElement,
  page: () => CanvasPage | undefined,
  selected: () => readonly CanvasWidget[],
  removed: (widgets: readonly CanvasWidget[]) => void,
  pasted: (widgets: CanvasWidget[]) => void,
  within?: () => PageArea | undefined,
): void {
  element.addEventListener("copy", (e) => {
    const widgets = selected();
    if (!widgets.length) return;
    e.preventDefault();
    e.clipboardData?.setData("text/plain", copy_widgets(widgets));
  });
  element.addEventListener("cut", (e) => {
    const target = page();
    const widgets = selected();
    if (!target || !widgets.length) return;
    e.preventDefault();
    //The text is set now, the event does not wait for the removal
    e.clipboardData?.setData("text/plain", copy_widgets(widgets));
    void cut_widgets(target, widgets).then((done) => {
      if (done) removed(widgets);
    });
  });
  element.addEventListener("paste", (e) => {
    const target = page();
    if (!target) return;
    e.preventDefault();
    void paste_widgets(target, {
      text: e.clipboardData?.getData("text/plain"),
      within: within?.(),
    }).then((widgets) => {
      if (widgets.length) pasted(widgets);
    });
  });
}
