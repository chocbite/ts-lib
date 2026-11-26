import state, { type State } from "@chocbite/ts-lib/state";
import type { CanvasPage, CanvasWidget } from "./data";

/**The value of a state now, undefined while it has none, like an error or an async state not read yet
 * A value that is not a state is given as it is*/
export function value_now(value: unknown): unknown {
  if (!state.is.state(value)) return value;
  const now = (value as State<unknown>).rsync
    ? (value as State<unknown>).get!()
    : undefined;
  return now?.ok ? now.value : undefined;
}

/**The widgets a page or the content of a group makes now, none without a page*/
export const widgets_now = (
  page: CanvasPage | undefined,
): readonly CanvasWidget[] => page?.widgets_now() ?? [];

/**The value of an option of a widget now, undefined while it has none, a link is given as the link*/
export const option_now = (widget: CanvasWidget, key: string): unknown =>
  value_now(widget.option(key));
