import {
  AccessTypes,
  define_element,
  input_key,
  type InputOptions,
} from "#base";
import ctm, { type ContextMenuLine } from "#context_menu";
import state, { type State, type StateOrVal } from "@chocbite/ts-lib/state";
import {
  canvas_widget,
  GROUP,
  widget_definition,
  WIDGETS,
  type CanvasPage,
  type CanvasWidget,
} from "./data";
import { group_bounds, transform_group, wrap_angle } from "./group";
import { CanvasLink } from "./link";
import { PageElement, widget_element_of } from "./page";
import {
  WIDGET_GEOMETRY,
  WIDGET_TRANSFORM_EVENT,
  WidgetBase,
  type WidgetBaseOptions,
  type WidgetGeometry,
} from "./widget";
import "./group_widget.scss";

export { GROUP };

/**How the content of a group fits the group*/
export type GroupDisplay = "scale" | "stretch" | "clip" | "scroll";

/**Inputs of the group widget*/
const GROUP_WIDGET = {
  /**Scale fits the content to the size of the group, stretch fills it, each axis on its own, clip shows it at its own size from the top left, cut off,
   * scroll at its own size with scrollbars when it is bigger*/
  display: input_key<StateOrVal<GroupDisplay>>(),
  /**Size of the content, the page of the widgets of the group*/
  content_width: input_key<StateOrVal<number>>(),
  content_height: input_key<StateOrVal<number>>(),
  /**Widgets of the content, the last is drawn on top*/
  widgets: input_key<StateOrVal<readonly CanvasWidget[]>>(),
  /**Background of the content, a CSS color like the background of a page, transparent when not given*/
  background: input_key<StateOrVal<string>>(),
};
export type GroupWidgetOptions = WidgetBaseOptions &
  InputOptions<typeof GROUP_WIDGET>;

/**Where the content of a group is shown in it
 * Scaled evenly by the smaller of the two ratios and centered when displayed scaled, so it keeps its proportions,
 * stretched to fill the group, each axis on its own, when displayed stretched, at its own size from the top left otherwise
 * @returns the scale of each axis, and the position of the top left of the content in the group*/
export function content_fit(
  display: unknown,
  content: { width: number; height: number },
  size: { width: number; height: number },
): { scale_x: number; scale_y: number; x: number; y: number } {
  if (content.width <= 0 || content.height <= 0)
    return { scale_x: 1, scale_y: 1, x: 0, y: 0 };
  if (display === "stretch")
    return {
      scale_x: size.width / content.width,
      scale_y: size.height / content.height,
      x: 0,
      y: 0,
    };
  if (display !== "scale") return { scale_x: 1, scale_y: 1, x: 0, y: 0 };
  const scale = Math.min(
    size.width / content.width,
    size.height / content.height,
  );
  return {
    scale_x: scale,
    scale_y: scale,
    x: (size.width - content.width * scale) / 2,
    y: (size.height - content.height * scale) / 2,
  };
}

/**A widget whose content is a page of widgets of its own, made by grouping widgets
 * The page of the content is shown like the page of a viewport, its widgets get slots and ids unique within it*/
class GroupWidget extends WidgetBase {
  static element_name() {
    return "groupwidget";
  }

  #display: GroupDisplay = "scale";
  #content = { width: 0, height: 0 };
  #page = this.appendChild(PageElement.create({ background: "transparent" }));

  constructor() {
    super();
    this.addEventListener(WIDGET_TRANSFORM_EVENT, () => this.#fit());
  }

  /**Places the content, scaled evenly and centered when displayed scaled, see content_fit,
   * the group itself is laid out at its own size, so its content is never stretched*/
  #fit() {
    const { width, height } = this[WIDGET_GEOMETRY];
    const fit = content_fit(this.#display, this.#content, { width, height });
    this.#page.style.transform =
      this.#display === "scale" || this.#display === "stretch"
        ? `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale_x}, ${fit.scale_y})`
        : "";
  }

  set(options: GroupWidgetOptions): this {
    super.set(options);
    this.set_input(GROUP_WIDGET.display, options.display, (display) => {
      this.#display = display.ok ? display.value : "scale";
      this.setAttribute("display", this.#display);
      this.#fit();
    });
    this.set_input(
      GROUP_WIDGET.content_width,
      options.content_width,
      (width) => {
        if (!width.ok) return;
        this.#content.width = width.value;
        this.#fit();
      },
    );
    this.set_input(
      GROUP_WIDGET.content_height,
      options.content_height,
      (height) => {
        if (!height.ok) return;
        this.#content.height = height.value;
        this.#fit();
      },
    );
    //The page follows the states itself, like the page of a viewport
    this.#page.set({
      width: options.content_width,
      height: options.content_height,
      widgets: options.widgets,
      ...(options.background !== undefined
        ? { background: options.background }
        : {}),
    });
    return this;
  }
}
define_element(GroupWidget);

/**The definition of groups, registered by canvas*/
export const GROUP_DEFINITION = WIDGETS.group(
  "canvas",
  "Canvas",
  "Widgets of canvas",
).add(
  "group",
  "Group",
  "Widgets grouped, a page of their own",
  widget_definition({
    create: (options: GroupWidgetOptions) => GroupWidget.create(options),
    properties: {
      display: {
        kind: "enum",
        name: "Display",
        default: "scale",
        list: {
          scale: { name: "Scale" },
          stretch: { name: "Stretch" },
          clip: { name: "Clipped" },
          scroll: { name: "Scroll" },
        },
      },
      content_width: {
        kind: "number",
        name: "Content width",
        default: 100,
        min: 1,
        unit: "px",
      },
      content_height: {
        kind: "number",
        name: "Content height",
        default: 100,
        min: 1,
        unit: "px",
      },
      background: {
        kind: "color",
        name: "Background",
        default: "transparent",
        alpha: true,
      },
    },
  }),
);

/**Whether the widget is a group*/
export const is_group = (widget: CanvasWidget): boolean =>
  widget.widget === GROUP;

/**The value of an option now, undefined while it has none*/
const value_now = (widget: CanvasWidget, key: string): unknown => {
  const option = (widget.options as Record<string, State<unknown> | undefined>)[
    key
  ];
  const value = option?.rsync ? option.get() : undefined;
  return value?.ok ? value.value : undefined;
};

/**The widgets of a group now*/
export const group_widgets_of = (group: CanvasWidget): CanvasWidget[] => {
  const widgets = value_now(group, "widgets");
  return Array.isArray(widgets) ? (widgets as CanvasWidget[]) : [];
};

/**The groups from the widgets down to the target, empty when it is one of the widgets, undefined when it is not in them
 * Found in the structure as it is now, so it holds after widgets were grouped, ungrouped or pasted*/
export function path_to(
  widgets: readonly CanvasWidget[],
  target: CanvasWidget,
): CanvasWidget[] | undefined {
  for (const widget of widgets) {
    if (widget === target) return [];
    if (!is_group(widget)) continue;
    const inside = path_to(group_widgets_of(widget), target);
    if (inside) return [widget, ...inside];
  }
  return undefined;
}

const GEOMETRY_KEYS = ["x", "y", "width", "height", "rotation"] as const;

/**The geometry of a widget, as its element shows it, from its options where no page shows it*/
function geometry_of(widget: CanvasWidget): WidgetGeometry {
  const element = widget_element_of(widget);
  if (element) return { ...element[WIDGET_GEOMETRY] };
  const geometry: WidgetGeometry = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
  };
  for (const key of GEOMETRY_KEYS) {
    const value = value_now(widget, key);
    if (typeof value === "number") geometry[key] = value;
  }
  return geometry;
}

/**Writes the geometry to the options of the widget that hold values, linked ones keep their links*/
function set_geometry(widget: CanvasWidget, geometry: WidgetGeometry): void {
  for (const key of GEOMETRY_KEYS) {
    const option = (
      widget.options as Record<string, State<unknown> | undefined>
    )[key];
    if (!option?.writable || value_now(widget, key) instanceof CanvasLink)
      continue;
    void option.write?.(
      key === "rotation" ? wrap_angle(geometry.rotation) : geometry[key],
    );
  }
}

/**The widgets of a page that can be written, undefined when they can not*/
async function writable_widgets(page: CanvasPage) {
  const widgets = page.widgets;
  if (!state.is.state(widgets) || !widgets.writable) return undefined;
  const current = await widgets;
  return current.ok ? { state: widgets, now: current.value } : undefined;
}

/**Groups the widgets into a new group, in the place of the front one of them in the drawing order, by writing instructions
 * to the widgets state of the page. The group is the box around them, turned by the rotation given, and its content the same size,
 * the widgets keep their drawing order and get positions relative to it, linked positions keep their links
 * Gives the group, undefined when none of the widgets is on the page, or the widgets can not be written*/
export async function group_widgets(
  page: CanvasPage,
  selected: readonly CanvasWidget[],
  rotation = 0,
): Promise<CanvasWidget | undefined> {
  const widgets = await writable_widgets(page);
  if (!widgets) return undefined;
  const ordered = widgets.now.filter((widget) => selected.includes(widget));
  if (!ordered.length) return undefined;
  const geometries = ordered.map(geometry_of);
  const box = group_bounds(geometries, rotation);
  const inside = transform_group(geometries, box, {
    x: 0,
    y: 0,
    width: box.width,
    height: box.height,
    rotation: 0,
  });
  ordered.forEach((widget, i) => set_geometry(widget, inside[i]));
  const group = canvas_widget(GROUP_DEFINITION, {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: wrap_angle(rotation),
    display: "scale",
    content_width: box.width,
    content_height: box.height,
    background: "transparent",
    widgets: state.ok_w<readonly CanvasWidget[]>(ordered),
  }) as unknown as CanvasWidget;
  //In the place of the front one, after the others are taken out
  const index =
    widgets.now.indexOf(ordered[ordered.length - 1]) - (ordered.length - 1);
  for (const widget of ordered)
    await widgets.state.write?.(state.a.write.delete<CanvasWidget>(widget));
  await widgets.state.write?.(
    state.a.write.splice<CanvasWidget>(index, 0, group),
  );
  return group;
}

/**Puts the widgets of the groups back on the page in the place of each group, where the group shows them,
 * by writing instructions to the widgets state of the page, linked positions keep their links
 * Gives the widgets that were in the groups, none when no group is on the page, or the widgets can not be written*/
export async function ungroup_widgets(
  page: CanvasPage,
  groups: readonly CanvasWidget[],
): Promise<CanvasWidget[]> {
  const widgets = await writable_widgets(page);
  if (!widgets) return [];
  const ungrouped: CanvasWidget[] = [];
  for (const group of widgets.now.filter(
    (widget) => is_group(widget) && groups.includes(widget),
  )) {
    const inside = group_widgets_of(group);
    const frame = geometry_of(group);
    const content = {
      width: Number(value_now(group, "content_width")) || frame.width,
      height: Number(value_now(group, "content_height")) || frame.height,
    };
    const fit = content_fit(value_now(group, "display"), content, frame);
    //Where the group shows the content, turned around the center of the group
    const shown_at = (x: number, y: number) => {
      const radians = (frame.rotation * Math.PI) / 180;
      const cx = x - frame.width / 2;
      const cy = y - frame.height / 2;
      return {
        x:
          frame.x +
          frame.width / 2 +
          cx * Math.cos(radians) -
          cy * Math.sin(radians),
        y:
          frame.y +
          frame.height / 2 +
          cx * Math.sin(radians) +
          cy * Math.cos(radians),
      };
    };
    const center = shown_at(
      fit.x + (content.width * fit.scale_x) / 2,
      fit.y + (content.height * fit.scale_y) / 2,
    );
    const from: WidgetGeometry = {
      x: 0,
      y: 0,
      width: content.width,
      height: content.height,
      rotation: 0,
    };
    const to: WidgetGeometry = {
      x: center.x - (content.width * fit.scale_x) / 2,
      y: center.y - (content.height * fit.scale_y) / 2,
      width: content.width * fit.scale_x,
      height: content.height * fit.scale_y,
      rotation: frame.rotation,
    };
    transform_group(inside.map(geometry_of), from, to).forEach((geometry, i) =>
      set_geometry(inside[i], geometry),
    );
    const now = (await widgets.state).ok
      ? ((await widgets.state) as { value: readonly CanvasWidget[] }).value
      : [];
    const index = now.indexOf(group);
    await widgets.state.write?.(state.a.write.delete<CanvasWidget>(group));
    await widgets.state.write?.(
      state.a.write.splice<CanvasWidget>(index, 0, ...inside),
    );
    ungrouped.push(...inside);
  }
  return ungrouped;
}

/**Context menu lines grouping the selected widgets, and ungrouping the selected groups
 * @param rotation of the group, the rotation of the box of the selection, see GroupRotation
 * @param done called with the group, or the widgets that were in the groups, like to select them*/
export function group_lines(
  page: CanvasPage,
  selected: readonly CanvasWidget[],
  rotation: number,
  done: (widgets: CanvasWidget[]) => void,
): ContextMenuLine[] {
  const writable = state.is.state(page.widgets) && page.widgets.writable;
  const access = (can: boolean) => (can ? AccessTypes.Write : AccessTypes.Read);
  return [
    ctm.line({
      text: "Group",
      shortcut: "Ctrl+G",
      access: access(writable && selected.length > 0),
      on_click: () => {
        void group_widgets(page, selected, rotation).then((group) => {
          if (group) done([group]);
        });
      },
    }),
    ctm.line({
      text: "Ungroup",
      shortcut: "Ctrl+Shift+G",
      access: access(writable && selected.some(is_group)),
      on_click: () => {
        void ungroup_widgets(page, selected).then((widgets) => {
          if (widgets.length) done(widgets);
        });
      },
    }),
  ];
}

/**Handles ctrl+g, grouping the selected widgets, and ctrl+shift+g, ungrouping the selected groups, true when the key was one of them
 * @param done called with the group, or the widgets that were in the groups, like to select them*/
export function group_key(
  e: KeyboardEvent,
  page: CanvasPage | undefined,
  selected: readonly CanvasWidget[],
  rotation: number,
  done: (widgets: CanvasWidget[]) => void,
): boolean {
  if (!page || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "g")
    return false;
  if (e.shiftKey)
    void ungroup_widgets(page, selected).then((widgets) => {
      if (widgets.length) done(widgets);
    });
  else
    void group_widgets(page, selected, rotation).then((group) => {
      if (group) done([group]);
    });
  return true;
}
