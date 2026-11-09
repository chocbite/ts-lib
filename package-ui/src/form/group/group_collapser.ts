import { define_element } from "#base";
import { node_clone } from "#dom";
import {
  material_unfold_less_rounded,
  material_unfold_more_rounded,
} from "#icons";
import {
  ANIMATION_LEVEL,
  ANIMATION_SPEED,
  AnimationLevels,
} from "#theme";
import { FormElement, FormOptions } from "../base";
import { FormGroupBase } from "./group_base";
import "./group_collapser.scss";

export interface FormGroupCollapserOptions extends FormOptions {
  /**Wether the group is collapsed initially*/
  collapsed?: boolean;
  /**Text to show on the collapser when open*/
  opened_text?: string;
  /**Text to show on the collapser when closed*/
  closed_text?: string;
}

const opened_text = document.createElement("span");
opened_text.textContent = "Collapse";
const closed_text = document.createElement("span");
closed_text.textContent = "Expand";

/**Component group class which allows to add elements and controls the flow of the elements*/
export class FormGroupCollapser extends FormElement {
  static element_name() {
    return "group-collapser";
  }
  static element_name_space(): string {
    return "form";
  }

  #group;
  #collapse_button;
  #collapsed: boolean = false;
  /**Running collapse or open animation, cancelled when the other one starts*/
  #animation?: Animation;
  #open_text = node_clone(opened_text);
  #close_text = node_clone(closed_text);

  constructor(group: FormGroupBase<any, any>, collapsed?: boolean) {
    super();
    this.#group = this.appendChild(group);
    if (collapsed) {
      this.classList.add("collapsed");
      this.#collapsed = true;
    }
    this.#collapse_button = this.appendChild(document.createElement("span"));
    this.#collapse_button.tabIndex = 0;
    this.#collapse_button.appendChild(
      collapsed ? this.#close_text : this.#open_text,
    );
    this.#collapse_button.appendChild(
      collapsed
        ? material_unfold_more_rounded()
        : material_unfold_less_rounded(),
    );
    this.#collapse_button.onclick = () => (this.collapsed = !this.collapsed);
    this.#collapse_button.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.collapsed = !this.collapsed;
      }
    };
  }

  set group(group: FormGroupBase<any, any>) {
    this.replaceChild(group, this.#group);
    this.#group = group;
  }

  get group(): FormGroupBase<any, any> {
    return this.#group;
  }

  set collapsed(collapsed: boolean) {
    if (collapsed && !this.#collapsed) {
      this.#animation?.cancel();
      //# Animation
      this.#collapse_button.replaceChildren(
        this.#close_text,
        material_unfold_more_rounded(),
      );
      if (ANIMATION_LEVEL.get().value === AnimationLevels.All) {
        this.#group.style.overflowY = "auto";
        const full_height = this.#group.getBoundingClientRect().height + "px";
        this.#animation = this.#group.animate(
          [
            { maxHeight: full_height },
            { maxHeight: "0px", paddingBlock: "0px" },
          ],
          {
            duration: ANIMATION_SPEED.get().value,
            easing: "ease-in-out",
          },
        );
        this.#animation.onfinish = () => {
          this.classList.add("collapsed");
          this.#group.style.overflowY = "";
        };
      } else {
        this.classList.add("collapsed");
      }
    } else if (!collapsed && this.#collapsed) {
      this.#animation?.cancel();
      this.classList.remove("collapsed");
      this.#collapse_button.replaceChildren(
        this.#open_text,
        material_unfold_less_rounded(),
      );
      //# Animation
      if (ANIMATION_LEVEL.get().value === AnimationLevels.All) {
        this.#group.style.overflowY = "auto";
        const full_height = this.#group.getBoundingClientRect().height + "px";
        this.#animation = this.#group.animate(
          [
            { maxHeight: "0px", paddingBlock: "0px" },
            { maxHeight: full_height },
          ],
          {
            duration: ANIMATION_SPEED.get().value,
            easing: "ease-in-out",
          },
        );
        this.#animation.onfinish = () => (this.#group.style.overflowY = "");
      }
    }
    this.#collapsed = collapsed;
  }
  get collapsed(): boolean {
    return this.#collapsed;
  }

  set opened_text(text: string) {
    this.#open_text.textContent = text;
  }

  set closed_text(text: string) {
    this.#close_text.textContent = text;
  }
}
define_element(FormGroupCollapser);

/**Creates a dropdown form element */
export function form_group_collapser(
  group: FormGroupBase<any, any>,
  options?: FormGroupCollapserOptions,
): FormGroupCollapser {
  const slide = new FormGroupCollapser(group, options?.collapsed);
  if (options) {
    if (options.opened_text) slide.opened_text = options.opened_text;
    if (options.closed_text) slide.closed_text = options.closed_text;
    FormElement.apply_options(slide, options);
  }
  return slide;
}
