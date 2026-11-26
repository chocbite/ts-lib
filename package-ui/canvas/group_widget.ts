import {
  AccessTypes,
  define_element,
  input_key,
  type InputOptions,
} from "#base";
import ctm, { type ContextMenuLine } from "#context_menu";
import state, { type StateOrVal } from "@chocbite/ts-lib/state";
import {
  canvas_widget,
  GROUP,
  is_group,
  widget_definition,
  WIDGETS,
  type CanvasGroup,
  type CanvasPage,
  type CanvasWidget,
  type CanvasWidgetData,
} from "./data";
import { GEOMETRY_KEYS, geometry_now } from "./geometry";
import { group_bounds, transform_group, wrap_angle } from "./group";
import { CanvasLink } from "./link";
import { option_now, value_now } from "./now";
import { PageElement } from "./page";
import {
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
  /**The content of the group, the page it shows, given by the group, see CanvasGroup*/
  content: input_key<StateOrVal<CanvasPage>>(),
};

/**Options of a group that are its data, the content page is made of them, the element is given the content instead*/
interface GroupData {
  /**Size of the content*/
  content_width?: StateOrVal<number>;
  content_height?: StateOrVal<number>;
  /**Background of the content, a CSS color like the background of a page, transparent when not given*/
  background?: StateOrVal<string>;
  /**The data of the widgets of the content, the last is drawn on top*/
  widgets?: StateOrVal<readonly CanvasWidgetData[]>;
}

export type GroupWidgetOptions = WidgetBaseOptions &
  InputOptions<typeof GROUP_WIDGET> &
  GroupData;

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
 * It shows its content page like a viewport shows a page, its size, background and widgets from the page*/
class GroupWidget extends WidgetBase {
  static element_name() {
    return "groupwidget";
  }

  #display: GroupDisplay = "scale";
  #content = { width: 0, height: 0 };
  #page = this.appendChild(PageElement.create({ background: "transparent" }));

  /**The page element of the content, internal to canvas, a viewport editing inside the group reads its scrolling*/
  get content_page(): PageElement {
    return this.#page;
  }

  protected on_geometry(): void {
    this.#fit();
  }

  /**Places the content, scaled evenly and centered when displayed scaled, see content_fit,
   * the group itself is laid out at its own size, so its content is never stretched*/
  #fit() {
    const { width, height } = this.geometry;
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
    this.set_input(GROUP_WIDGET.content, options.content, (content) => {
      if (content.ok) this.#show(content.value);
    });
    return this;
  }

  /**Shows the content page, its page element follows the states of the page, like the page of a viewport,
   * the size it is fitted by is followed too*/
  #show(content: CanvasPage) {
    this.#page.set({
      width: content.width,
      height: content.height,
      background: content.background ?? "transparent",
      widgets: content.children,
    });
    this.attach_state_to_symbol(CONTENT_WIDTH, content.width, (width) => {
      if (!width.ok) return;
      this.#content.width = width.value;
      this.#fit();
    });
    this.attach_state_to_symbol(CONTENT_HEIGHT, content.height, (height) => {
      if (!height.ok) return;
      this.#content.height = height.value;
      this.#fit();
    });
  }
}
define_element(GroupWidget);

const CONTENT_WIDTH = Symbol("content width");
const CONTENT_HEIGHT = Symbol("content height");

export { GroupWidget };

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

/**The geometry of a widget as its elements show it, links followed, all 0 while a part has no value*/
const geometry_of = (widget: CanvasWidget): WidgetGeometry =>
  geometry_now(widget) ?? { x: 0, y: 0, width: 0, height: 0, rotation: 0 };

/**Writes the geometry to the options of the widget that hold values, linked ones keep their links*/
function set_geometry(widget: CanvasWidget, geometry: WidgetGeometry): void {
  for (const key of GEOMETRY_KEYS) {
    const option = widget.option(key);
    if (!option?.writable || option_now(widget, key) instanceof CanvasLink)
      continue;
    void option.write?.(
      key === "rotation" ? wrap_angle(geometry.rotation) : geometry[key],
    );
  }
}

/**The widgets of a page that can be written, undefined when they can not*/
async function writable_widgets(page: CanvasPage) {
  const widgets = page.widgets;
  if (!widgets.writable) return undefined;
  const current = await widgets.read();
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
): Promise<CanvasGroup | undefined> {
  const widgets = await writable_widgets(page);
  if (!widgets) return undefined;
  const ordered = page
    .widgets_now()
    .filter((widget) => selected.includes(widget));
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
    widgets: state.ok_w<readonly CanvasWidgetData[]>(
      ordered.map((widget) => widget.data),
    ),
  });
  //In the place of the front one, after the others are taken out
  const index =
    widgets.now.indexOf(ordered[ordered.length - 1].data) -
    (ordered.length - 1);
  for (const widget of ordered)
    await widgets.state.write?.(
      state.a.write.delete<CanvasWidgetData>(widget.data),
    );
  await widgets.state.write?.(
    state.a.write.splice<CanvasWidgetData>(index, 0, group),
  );
  return page.widget_of(group) as CanvasGroup;
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
  for (const group of page
    .widgets_now()
    .filter(
      (widget): widget is CanvasGroup =>
        is_group(widget) && groups.includes(widget),
    )) {
    const inside = group.content.widgets_now();
    const frame = geometry_of(group);
    const content = {
      width: Number(value_now(group.content.width)) || frame.width,
      height: Number(value_now(group.content.height)) || frame.height,
    };
    const fit = content_fit(option_now(group, "display"), content, frame);
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
    const now = await widgets.state.read();
    const index = now.ok ? now.value.indexOf(group.data) : -1;
    const data = inside.map((widget) => widget.data);
    await widgets.state.write?.(
      state.a.write.delete<CanvasWidgetData>(group.data),
    );
    await widgets.state.write?.(
      state.a.write.splice<CanvasWidgetData>(index, 0, ...data),
    );
    //The widgets the page makes of them
    ungrouped.push(...data.map((entry) => page.widget_of(entry)));
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
  const writable = page.widgets.writable;
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
