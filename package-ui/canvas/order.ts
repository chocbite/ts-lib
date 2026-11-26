import { AccessTypes } from "#base";
import ctm, { type ContextMenuLine } from "#context_menu";
import state from "@chocbite/ts-lib/state";
import type { CanvasPage, CanvasWidget, CanvasWidgetData } from "./data";
import { widgets_now } from "./now";

/**Ways to move a widget in the drawing order of its page, the last widget is drawn on top
 * front and back move it to the top or the bottom, forward and backward one step*/
export type WidgetOrder = "front" | "forward" | "backward" | "back";

/**The moves, from index to index done one after the other, that order the selected widgets,
 * moved together and kept in their order, none when nothing can move that way or none of them is one of the widgets
 * front and back move them to the top or the bottom, forward and backward one step past the next widget that is not selected*/
export function order_moves<T>(
  widgets: readonly T[],
  selected: readonly T[],
  order: WidgetOrder,
): [number, number][] {
  const chosen = new Set(selected);
  //Whether the widget at each index is selected, kept in step with the moves
  const flags = widgets.map((widget) => chosen.has(widget));
  const moves: [number, number][] = [];
  const move = (from: number, to: number) => {
    moves.push([from, to]);
    flags.splice(to, 0, ...flags.splice(from, 1));
  };
  const last = flags.length - 1;
  switch (order) {
    case "front": {
      let end = last;
      for (let i = last; i >= 0; i--)
        if (flags[i]) {
          if (i !== end) move(i, end);
          end--;
        }
      break;
    }
    case "back": {
      let start = 0;
      for (let i = 0; i <= last; i++)
        if (flags[i]) {
          if (i !== start) move(i, start);
          start++;
        }
      break;
    }
    case "forward":
      for (let i = last - 1; i >= 0; i--)
        if (flags[i] && !flags[i + 1]) move(i, i + 1);
      break;
    case "backward":
      for (let i = 1; i <= last; i++)
        if (flags[i] && !flags[i - 1]) move(i, i - 1);
      break;
  }
  return moves;
}

/**Moves the selected widgets in the drawing order of the page, see order_moves, by writing move instructions
 * to the widgets state of the page, false when nothing can move that way, or the widgets are not a writable state*/
export async function reorder_widget(
  page: CanvasPage,
  selected: readonly CanvasWidget[],
  order: WidgetOrder,
): Promise<boolean> {
  const widgets = page.widgets;
  if (!widgets.writable) return false;
  const current = await widgets.read();
  if (!current.ok) return false;
  const moves = order_moves(
    current.value,
    selected.map((widget) => widget.data),
    order,
  );
  if (!moves.length) return false;
  //Move instructions, so the state tells its subscribers only these widgets moved
  for (const [from, to] of moves) {
    const written = await widgets.write?.(
      state.a.write.move<CanvasWidgetData>(from, to),
    );
    if (!written?.ok) return false;
  }
  return true;
}

const ORDER_LINES: [WidgetOrder, string][] = [
  ["front", "Bring to front"],
  ["forward", "Move forward"],
  ["backward", "Move backward"],
  ["back", "Send to back"],
];

/**Context menu lines ordering the selected widgets on the page, a line that can not move them is greyed out*/
export function order_lines(
  page: CanvasPage,
  selected: readonly CanvasWidget[],
): ContextMenuLine[] {
  const widgets = widgets_now(page);
  const writable = page.widgets.writable;
  return ORDER_LINES.map(([order, text]) =>
    ctm.line({
      text,
      access:
        writable && order_moves(widgets, selected, order).length
          ? AccessTypes.Write
          : AccessTypes.Read,
      on_click: () => void reorder_widget(page, selected, order),
    }),
  );
}

/**Removes the widgets from the page by writing delete instructions to the widgets state of the page,
 * false when none of them is on the page, or the widgets are not a writable state*/
export async function remove_widgets(
  page: CanvasPage,
  selected: readonly CanvasWidget[],
): Promise<boolean> {
  const widgets = page.widgets;
  if (!widgets.writable) return false;
  const current = await widgets.read();
  if (!current.ok) return false;
  const removing = new Set(
    selected
      .map((widget) => widget.data)
      .filter((data) => current.value.includes(data)),
  );
  if (!removing.size) return false;
  for (const data of removing) {
    const written = await widgets.write?.(
      state.a.write.delete<CanvasWidgetData>(data),
    );
    if (!written?.ok) return false;
  }
  return true;
}

/**Context menu line removing the selected widgets from the page, greyed out when the widgets can not be written
 * @param removed called after they are removed, like to take them out of the selection*/
export function delete_line(
  page: CanvasPage,
  selected: readonly CanvasWidget[],
  removed?: () => void,
): ContextMenuLine {
  const writable = page.widgets.writable;
  return ctm.line({
    text: "Delete",
    shortcut: "Del",
    access: writable ? AccessTypes.Write : AccessTypes.Read,
    on_click: () => {
      void remove_widgets(page, selected).then((done) => {
        if (done) removed?.();
      });
    },
  });
}
