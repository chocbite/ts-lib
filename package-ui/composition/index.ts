export type { PanelContainer } from "./container";
export {
  LayoutSide,
  type Layout,
  type LayoutDirection,
  type LayoutInit,
  type LayoutOpenOptions,
  type LayoutSplitInit,
  type LayoutTabsInit,
} from "./layout";
export type { Panel, PanelOptions } from "./panel";
export { CompAnchor, type CompPosition } from "./shared";
import {
  attach_customization_panel_to_element,
  customization,
  customization_panel,
} from "./customization";
import { panel, panel_container } from "./container";
import { content } from "./content";
import { layout } from "./layout";
import { get_element_anchor_position } from "./shared";
import { topbar, topbar_button, topbar_label } from "./topbar";

export const comp = {
  content,
  layout,
  panel,
  panel_container,
  topbar,
  topbar_button,
  topbar_label,
  customization,
  customization_panel,
  attach_customization_panel_to_element,
  get_element_anchor_position,
};

export {
  ContentBase,
  type Content,
  type ContentCreateOptions,
  type ContentOptions,
} from "./content";
export type {
  Customization,
  CustomizationCreateOptions,
  CustomizationOptions,
  CustomizationPanel,
} from "./customization";
export type {
  Topbar,
  TopbarButton,
  TopbarButtonOptions,
  TopbarLabel,
  TopbarLabelOptions,
  TopbarOptions,
} from "./topbar";
