import {
  CREATE,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import { node_clone } from "#dom";
import {
  material_unfold_less_rounded,
  material_unfold_more_rounded,
} from "#icons";
import type { StateOrVal, StateOrValROS } from "@chocbite/ts-lib/state";
import { ANIMATION_LEVEL, ANIMATION_SPEED, AnimationLevels } from "#theme";
import { FormElement } from "../base";
import { FormGroupBase } from "./group_base";
import "./group_collapser.scss";

/**Inputs of the group collapser*/
const COLLAPSER = {
  /**Whether the group is collapsed, the user changes it with the button
   * A fixed value is how it starts, a writable state is written, a read only state locks it*/
  collapsed: input_key<StateOrValROS<boolean>>(),
  /**Text of the button while the group is open, Collapse by default*/
  opened_text: input_key<StateOrVal<string>>(),
  /**Text of the button while the group is collapsed, Expand by default*/
  closed_text: input_key<StateOrVal<string>>(),
};
export type FormGroupCollapserOptions = BaseOptions &
  InputOptions<typeof COLLAPSER>;

const opened_text = document.createElement("span");
opened_text.textContent = "Collapse";
const closed_text = document.createElement("span");
closed_text.textContent = "Expand";

/**A group that the user collapses and opens with a button under it*/
class FormGroupCollapser extends FormElement {
  static element_name() {
    return "group-collapser";
  }
  static element_name_space(): string {
    return "form";
  }

  #group?: FormGroupBase<any, any>;
  #collapse_button = this.appendChild(document.createElement("span"));
  #collapsed: boolean = false;
  /**Running collapse or open animation, cancelled when the other one starts*/
  #animation?: Animation;
  #open_text = node_clone(opened_text);
  #close_text = node_clone(closed_text);

  constructor() {
    super();
    this.#collapse_button.tabIndex = 0;
    this.#collapse_button.append(
      this.#open_text,
      material_unfold_less_rounded(),
    );
    this.#collapse_button.onclick = () => this.#toggle();
    this.#collapse_button.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.#toggle();
      }
    };
  }

  /**The group, given at creation, as the collapser holds it*/
  [CREATE](options: { group?: FormGroupBase<any, any> }): void {
    super[CREATE](options);
    if (options.group)
      this.#group = this.insertBefore(options.group, this.#collapse_button);
  }

  set(options: FormGroupCollapserOptions): this {
    super.set(options);
    this.set_input(COLLAPSER.collapsed, options.collapsed, (collapsed) =>
      this.#set_collapsed(collapsed.value),
    );
    this.set_input(COLLAPSER.opened_text, options.opened_text, (text) => {
      this.#open_text.textContent = text.ok ? text.value : text.error.nice;
    });
    this.set_input(COLLAPSER.closed_text, options.closed_text, (text) => {
      this.#close_text.textContent = text.ok ? text.value : text.error.nice;
    });
    return this;
  }

  /**A click of the user, written to a writable state, kept for a fixed value, nothing for a read only state*/
  #toggle() {
    const collapsed = this.input_state(COLLAPSER.collapsed);
    if (!collapsed) this.#set_collapsed(!this.#collapsed);
    else if (collapsed.writable) void collapsed.write?.(!this.#collapsed);
  }

  #set_collapsed(collapsed: boolean) {
    if (collapsed === this.#collapsed) return;
    this.#collapsed = collapsed;
    this.#animation?.cancel();
    this.#collapse_button.replaceChildren(
      collapsed ? this.#close_text : this.#open_text,
      collapsed
        ? material_unfold_more_rounded()
        : material_unfold_less_rounded(),
    );
    const group = this.#group;
    //Not in the document yet, like at creation, there is nothing to animate
    const animate =
      group &&
      this.isConnected &&
      ANIMATION_LEVEL.get().value === AnimationLevels.All;
    if (!animate) {
      this.classList.toggle("collapsed", collapsed);
      return;
    }
    if (!collapsed) this.classList.remove("collapsed");
    group.style.overflowY = "auto";
    const full_height = group.getBoundingClientRect().height + "px";
    const closed = { maxHeight: "0px", paddingBlock: "0px" };
    const open = { maxHeight: full_height };
    this.#animation = group.animate(
      collapsed ? [open, closed] : [closed, open],
      {
        duration: ANIMATION_SPEED.get().value,
        easing: "ease-in-out",
      },
    );
    this.#animation.onfinish = () => {
      if (collapsed) this.classList.add("collapsed");
      group.style.overflowY = "";
    };
  }
}
define_element(FormGroupCollapser);

export type { FormGroupCollapser };

/**Creates a collapser holding the group, the user collapses and opens it with a button*/
export function form_group_collapser(
  group: FormGroupBase<any, any>,
  options: FormGroupCollapserOptions = {},
): FormGroupCollapser {
  return FormGroupCollapser.create({ ...options, group });
}
