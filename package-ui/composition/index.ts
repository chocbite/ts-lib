export type { PanelContainer } from "./container";
export {
  LayoutSide,
  type Layout,
  type LayoutDirection,
  type LayoutNode,
  type LayoutOpenOptions,
  type LayoutOptions,
  type LayoutSplit,
  type LayoutTabs,
} from "./layout";
export type { Panel, PanelOptions } from "./panel";
export { CompAnchor, type CompPosition } from "./shared";
export type {
  Workspace,
  WorkspaceConfig,
  WorkspaceOptions,
  WorkspacePanel,
} from "./workspace";
import {
  attach_customization_panel_to_element,
  customization,
  customization_panel,
} from "./customization";
import { panel, panel_container } from "./container";
import { content } from "./content";
import { layout, layout_split, layout_tabs } from "./layout";
import { get_element_anchor_position } from "./shared";
import { topbar, topbar_button, topbar_label } from "./topbar";
import { workspace, workspace_panel } from "./workspace";

export const comp = {
  content,
  layout,
  layout_split,
  layout_tabs,
  panel,
  panel_container,
  topbar,
  topbar_button,
  topbar_label,
  workspace,
  workspace_panel,
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
