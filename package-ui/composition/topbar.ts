import {
  Base,
  define_element,
  input_key,
  type InputOptions,
  type BaseOptions,
} from "#base";
import type { SVGFunc } from "#svg";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import "./shared";
import "./topbar.scss";

/**Shared base of the top bar elements, only sets the namespace*/
abstract class TopbarBase extends Base {
  static element_name() {
    return "@abstract@";
  }
  static element_name_space() {
    return "composition";
  }
}

//      _______ ____  _____  ____          _____
//     |__   __/ __ \|  __ \|  _ \   /\   |  __ \
//        | | | |  | | |__) | |_) | /  \  | |__) |
//        | | | |  | |  ___/|  _ < / /\ \ |  _  /
//        | | | |__| | |    | |_) / ____ \| | \ \
//        |_|  \____/|_|    |____/_/    \_\_|  \_\
/**Inputs of the top bar*/
const TOPBAR = {
  /**Items at the left side, the side is empty on errors*/
  left: input_key<StateOrVal<readonly Element[]>>(),
  /**Items in the middle, the middle is empty on errors*/
  mid: input_key<StateOrVal<readonly Element[]>>(),
  /**Items at the right side, the side is empty on errors*/
  right: input_key<StateOrVal<readonly Element[]>>(),
};
export type TopbarOptions = BaseOptions & InputOptions<typeof TOPBAR>;

/**Bar along the top of a page, with items at the left, in the middle and at the right*/
class Topbar extends TopbarBase {
  static element_name() {
    return "topbar";
  }

  #left = this.appendChild(document.createElement("div"));
  #mid = this.appendChild(document.createElement("div"));
  #right = this.appendChild(document.createElement("div"));

  set(options: TopbarOptions): this {
    super.set(options);
    this.set_input(TOPBAR.left, options.left, (items) => {
      this.#left.replaceChildren(...(items.ok ? items.value : []));
    });
    this.set_input(TOPBAR.mid, options.mid, (items) => {
      this.#mid.replaceChildren(...(items.ok ? items.value : []));
    });
    this.set_input(TOPBAR.right, options.right, (items) => {
      this.#right.replaceChildren(...(items.ok ? items.value : []));
    });
    return this;
  }
}
define_element(Topbar);

//      ____  _    _ _______ _______ ____  _   _
//     |  _ \| |  | |__   __|__   __/ __ \| \ | |
//     | |_) | |  | |  | |     | | | |  | |  \| |
//     |  _ <| |  | |  | |     | | | |  | | . ` |
//     | |_) | |__| |  | |     | | | |__| | |\  |
//     |____/ \____/   |_|     |_|  \____/|_| \_|
/**Inputs of a top bar button*/
const BUTTON = {
  /**Text of the button, shows the error on errors*/
  text: input_key<StateOrVal<string>>(),
  /**Icon in front of the text, no icon on errors*/
  icon: input_key<StateOrVal<SVGFunc | undefined>>(),
  /**Called when the button is clicked, a plain value as it is not shown*/
  on_click: input_key<() => void>(),
};
export type TopbarButtonOptions = BaseOptions & InputOptions<typeof BUTTON>;

/**Button for the top bar, with an icon, a text or both*/
class TopbarButton extends TopbarBase {
  static element_name() {
    return "topbar-button";
  }

  #icon?: SVGSVGElement;
  #text = this.appendChild(document.createElement("span"));
  #on_click?: () => void;

  constructor() {
    super();
    this.onclick = () => this.#on_click?.();
  }

  set(options: TopbarButtonOptions): this {
    super.set(options);
    this.set_input(BUTTON.on_click, options.on_click, (on_click) => {
      this.#on_click = on_click.value;
    });
    this.set_input(BUTTON.text, options.text, (text) => {
      this.#text.textContent = text.ok ? text.value : "⚠ " + text.error.nice;
    });
    this.set_input(BUTTON.icon, options.icon, (icon) => {
      this.#icon?.remove();
      this.#icon = icon.ok && icon.value ? icon.value() : undefined;
      if (this.#icon) this.prepend(this.#icon);
    });
    return this;
  }
}
define_element(TopbarButton);

//      _               ____  ______ _
//     | |        /\   |  _ \|  ____| |
//     | |       /  \  | |_) | |__  | |
//     | |      / /\ \ |  _ <|  __| | |
//     | |____ / ____ \| |_) | |____| |____
//     |______/_/    \_\____/|______|______|
/**Inputs of a top bar label*/
const LABEL = {
  /**Text of the label, shows the error on errors*/
  text: input_key<StateOrVal<string>>(),
};
export type TopbarLabelOptions = BaseOptions & InputOptions<typeof LABEL>;

/**Text for the top bar*/
class TopbarLabel extends TopbarBase {
  static element_name() {
    return "topbar-label";
  }

  set(options: TopbarLabelOptions): this {
    super.set(options);
    this.set_input(LABEL.text, options.text, (text) => {
      this.textContent = text.ok ? text.value : "⚠ " + text.error.nice;
    });
    return this;
  }
}
define_element(TopbarLabel);

//      ______      _____ _______ ____  _____  _____ ______  _____
//     |  ____/\   / ____|__   __/ __ \|  __ \|_   _|  ____|/ ____|
//     | |__ /  \ | |       | | | |  | | |__) | | | | |__  | (___
//     |  __/ /\ \| |       | | | |  | |  _  /  | | |  __|  \___ \
//     | | / ____ \ |____   | | | |__| | | \ \ _| |_| |____ ____) |
//     |_|/_/    \_\_____|  |_|  \____/|_|  \_\_____|______|_____/
export type { Topbar, TopbarButton, TopbarLabel };

/**Bar along the top of a page, items are given as arrays for the left, middle and right*/
export function topbar(options: TopbarOptions = {}): Topbar {
  return Topbar.create(options);
}

/**Button for the top bar, with an icon, a text or both*/
export function topbar_button(options: TopbarButtonOptions = {}): TopbarButton {
  return TopbarButton.create(options);
}

/**Text for the top bar*/
export function topbar_label(options: TopbarLabelOptions = {}): TopbarLabel {
  return TopbarLabel.create(options);
}
