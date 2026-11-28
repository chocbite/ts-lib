export {
  Application,
  type AppManager,
  type AppManagerOptions,
  type AppManagerSaved,
  type ApplicationClass,
  type ApplicationProps,
} from "./application";
export type { PanelContainer } from "./container";
export {
  LayoutSide,
  type Layout,
  type LayoutDirection,
  type LayoutNode,
  type LayoutOpenOptions,
  type LayoutNodeOptions,
  type LayoutOptions,
  type LayoutSplit,
  type LayoutSplitCreateOptions,
  type LayoutSplitOptions,
  type LayoutTabs,
  type LayoutTabsOptions,
  type LayoutTabsSide,
} from "./layout/index";
export type { Panel, PanelOptions } from "./panel";
export { CompAnchor, type CompPosition } from "./shared";
export type {
  Workspace,
  WorkspaceOptions,
  WorkspacePanel,
  WorkspacePlace,
  WorkspaceWindow,
} from "./workspace";
import {
  attach_customization_panel_to_element,
  customization,
  customization_panel,
} from "./customization";
import { app_manager } from "./application";
import { panel, panel_container, panel_layer } from "./container";
import { content } from "./content";
import { layout, layout_split, layout_tabs } from "./layout/index";
import { get_element_anchor_position } from "./shared";
import { topbar, topbar_button, topbar_label } from "./topbar";
import { workspace, workspace_panel, workspace_window } from "./workspace";

export const comp = {
  app_manager,
  content,
  layout,
  layout_split,
  layout_tabs,
  panel,
  panel_container,
  panel_layer,
  topbar,
  topbar_button,
  topbar_label,
  workspace,
  workspace_panel,
  workspace_window,
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
export { WINDOW_REOPEN, WindowReopen } from "./settings";
