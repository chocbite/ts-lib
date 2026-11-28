import { define_element, input_key, type InputOptions } from "#base";
import { DOCUMENT_HANDLER } from "#document";
import form, { type FormElement } from "#form";
import { material_brightness_medium_rounded } from "#icons";
import {
  ANIMATION_LEVEL,
  ANIMATION_SPEED,
  INPUT_MODE,
  SCALE,
  THEME,
} from "#theme";
import state, { type StateOrVal, type StateROSW } from "@chocbite/ts-lib/state";
import { panel_container } from "./container";
import {
  ContentBase,
  type ContentCreateOptions,
  type ContentOptions,
} from "./content";
import type { Panel } from "./panel";
import { WINDOW_REOPEN } from "./settings";
import { get_element_anchor_position, type CompAnchor } from "./shared";

/**Inputs of the customization*/
const CUSTOMIZATION = {
  /**Settings of the app, shown under the theme*/
  main: input_key<StateOrVal<readonly FormElement[]>>(),
  /**Advanced settings of the app, shown last in the advanced section*/
  advanced: input_key<StateOrVal<readonly FormElement[]>>(),
};
export type CustomizationOptions = ContentOptions &
  InputOptions<typeof CUSTOMIZATION>;
export type CustomizationCreateOptions = ContentCreateOptions &
  CustomizationOptions;

/**Content with the settings of the library, theme, scale, input mode, animations and where windows open after a refresh,
 * and settings of the app*/
class Customization extends ContentBase {
  static element_name() {
    return "customization";
  }
  static element_name_space() {
    return "composition";
  }

  #main = form.group({ embed: true });
  #advanced = form.group({ embed: true });

  constructor() {
    super();
    this.appendChild(
      form.group({
        elements: [
          form.toggle_button().set({ value: THEME }),
          this.#main,
          form.group_collapser(
            form.group({
              embed: true,
              elements: [
                form.text({ text: "UI Scale" }),
                form.stepper().set({ value: SCALE }),
                form.text({ text: "Input Mode" }),
                form.toggle_button().set({ value: INPUT_MODE }),
                form.text({ text: "Animation Level" }),
                form.toggle_button().set({ value: ANIMATION_LEVEL }),
                form.text({ text: "Animation Speed" }),
                form.slider({ live: true }).set({ value: ANIMATION_SPEED }),
                form.text({ text: "Windows After a Refresh" }),
                form.toggle_button().set({ value: WINDOW_REOPEN }),
                this.#advanced,
              ],
            }),
            { closed_text: "Advanced", collapsed: true },
          ),
        ],
      }),
    );
  }

  set(options: CustomizationOptions): this {
    super.set(options);
    this.set_input(CUSTOMIZATION.main, options.main, (elements) => {
      this.#main = replace_group(this.#main, elements.ok ? elements.value : []);
    });
    this.set_input(CUSTOMIZATION.advanced, options.advanced, (elements) => {
      this.#advanced = replace_group(
        this.#advanced,
        elements.ok ? elements.value : [],
      );
    });
    return this;
  }
}
define_element(Customization);

/**A form group only takes elements once, so a new list gets a new group*/
const replace_group = (old: HTMLElement, elements: readonly FormElement[]) => {
  const group = form.group({ embed: true, elements: [...elements] });
  old.replaceWith(group);
  return group;
};

export type { Customization };

/**Content with the settings of the library, and of the app given as main and advanced
 * The title, icon and minimum size have defaults, give them to change them*/
export function customization(
  options: CustomizationCreateOptions = {},
): Customization {
  return Customization.create({
    title: "Customization",
    icon: material_brightness_medium_rounded,
    closable: true,
    min_width: 10,
    min_height: 6,
    ...options,
  });
}

/**The customization in a hidden modal panel*/
export interface CustomizationPanel {
  readonly panel: Panel;
  readonly content: Customization;
  /**Whether the panel is hidden, write false to show it, the panel writes true when the user presses outside it*/
  readonly hidden: StateROSW<boolean>;
}

/**Creates the customization in a modal panel, hidden, it hides again when the user presses outside it
 * Change the panel with panel.set, like its position
 * @param owner the panel is made in the document of the owner, the main document by default*/
export function customization_panel(
  options: CustomizationCreateOptions = {},
  owner: Node = DOCUMENT_HANDLER.main,
): CustomizationPanel {
  const content = customization(options);
  const hidden = state.ok_w(true);
  const panel = panel_container(owner).panel(content, {
    sizeable: false,
    titlebar: false,
    width: 20,
    hidden,
    auto_hide: true,
    modal: true,
    layer: 9999,
  });
  return { panel, content, hidden };
}

/**Shows the customization panel when the element is clicked, with the anchor of the panel at the anchor of the element
 * @param c_panel the panel to show, a new one in the document of the element by default*/
export function attach_customization_panel_to_element(
  element: Element,
  element_anchor: CompAnchor,
  panel_anchor: CompAnchor,
  c_panel: CustomizationPanel = customization_panel({}, element),
): CustomizationPanel {
  element.addEventListener("click", () => {
    const { x, y } = get_element_anchor_position(element, element_anchor);
    c_panel.panel.set({ x, y, anchor: panel_anchor });
    void c_panel.hidden.write(false);
    c_panel.panel.focus();
  });
  return c_panel;
}
