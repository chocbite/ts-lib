import {
  Base,
  CREATE,
  define_element,
  input_key,
  type InputOf,
  type InputOptions,
} from "#base";
import { ok } from "@chocbite/ts-lib/result";
import {
  state,
  type StateOrVal,
  type StateOrValROSW,
  type StateROS,
} from "@chocbite/ts-lib/state";

/**Base of the example elements, only sets the namespace, set, set_input and input_state come from Base*/
export abstract class ExampleBase extends Base {
  static element_name() {
    return "@abstract@";
  }
  static element_name_space() {
    return "example";
  }
}

//      ____   ______   __
//     |  _ \ / __ \ \ / /
//     | |_) | |  | \ V /
//     |  _ <| |  | |> <
//     | |_) | |__| / . \
//     |____/ \____/_/ \_\
/**Inputs of the box*/
const BOX = {
  /**Width in px, keeps the last good value on errors*/
  width: input_key<StateOrVal<number>>(),
  /**Height in px, keeps the last good value on errors*/
  height: input_key<StateOrVal<number>>(),
  /**Text in the box, shows the error on errors*/
  label: input_key<StateOrVal<string>>(),
  /**Background color, grey on errors*/
  color: input_key<StateOrVal<string>>(),
};
export type ExampleBoxOptions = InputOptions<typeof BOX>;

const BOX_STYLE =
  "display:inline-flex;align-items:center;justify-content:center;gap:4px;box-sizing:border-box;overflow:hidden;width:100px;height:32px;background:#2980b9;color:white;font:12px sans-serif";
const ERROR_COLOR = "#7f8c8d";

/**Colored box, each input handles errors its own way:
 * width and height keep their last good value, the label shows the error, the color turns grey*/
class ExampleBox extends ExampleBase {
  static element_name() {
    return "box";
  }

  #text = this.appendChild(document.createElement("span"));

  constructor() {
    super();
    this.style.cssText = BOX_STYLE;
  }

  set(options: ExampleBoxOptions): this {
    this.set_input(BOX.width, options.width, (width) => {
      if (width.ok) this.style.width = width.value + "px";
    });
    this.set_input(BOX.height, options.height, (height) => {
      if (height.ok) this.style.height = height.value + "px";
    });
    this.set_input(BOX.label, options.label, (label) => {
      this.#text.textContent = label.ok
        ? this.format_label(label.value)
        : "⚠ " + label.error;
    });
    this.set_input(BOX.color, options.color, (color) => {
      this.style.background = color.ok ? color.value : ERROR_COLOR;
    });
    return this;
  }

  /**Overridable, shows what happens when an input calls into a subclass*/
  protected format_label(label: string): string {
    return label;
  }
}
define_element(ExampleBox);

/**Inputs the label box adds to the box*/
const LABEL_BOX = {
  /**Bold text in front of the label*/
  badge: input_key<StateOrVal<string>>(),
};
export type ExampleLabelBoxOptions = ExampleBoxOptions &
  InputOptions<typeof LABEL_BOX>;

/**Subclass adding its own input*/
class ExampleLabelBox extends ExampleBox {
  static element_name() {
    return "labelbox";
  }

  #badge = this.insertBefore(document.createElement("b"), this.firstChild);

  set(options: ExampleLabelBoxOptions): this {
    super.set(options);
    this.set_input(LABEL_BOX.badge, options.badge, (badge) => {
      this.#badge.textContent = badge.ok ? badge.value : "";
    });
    return this;
  }
}
define_element(ExampleLabelBox);

/**Inputs the override box adds to the box*/
const OVERRIDE_BOX = {
  /**Plain value, only read when the label is applied*/
  prefix: input_key<string>(),
};
export type ExampleOverrideBoxOptions = ExampleBoxOptions &
  InputOptions<typeof OVERRIDE_BOX>;

/**Subclass overriding a method used by an input, the override reads a private field of the subclass
 * This works with fixed values too, as set runs after the field has been initialized*/
class ExampleOverrideBox extends ExampleBox {
  static element_name() {
    return "overridebox";
  }

  #prefix = "";

  set(options: ExampleOverrideBoxOptions): this {
    //Before the box inputs, so the label is applied with the new prefix
    this.set_input(OVERRIDE_BOX.prefix, options.prefix, (prefix) => {
      this.#prefix = prefix.value;
    });
    return super.set(options);
  }

  protected format_label(label: string): string {
    return this.#prefix + label;
  }
}
define_element(ExampleOverrideBox);

//       _____ _____   ____  _    _ _____
//      / ____|  __ \ / __ \| |  | |  __ \
//     | |  __| |__) | |  | | |  | | |__) |
//     | | |_ |  _  /| |  | | |  | |  ___/
//     | |__| | | \ \| |__| | |__| | |
//      \_____|_|  \_\\____/ \____/|_|
/**Inputs of the group that can be set again*/
const GROUP = {
  /**Space between the boxes in px, keeps the last good value on errors*/
  gap: input_key<StateOrVal<number>>(),
};
export type ExampleGroupOptions = InputOptions<typeof GROUP>;
/**Inputs of the group given at creation, they are handed out to other elements so they can not be replaced*/
const GROUP_CREATE = {
  /**Boxes shown in the group, handed out as items*/
  items: input_key<StateOrVal<ExampleBox[]>>(),
};
export type ExampleGroupCreateOptions = ExampleGroupOptions &
  InputOptions<typeof GROUP_CREATE>;

/**Shows a list of boxes, and hands the list out so others can follow it
 * The list is a creation input, so whatever follows it never follows a list the group dropped*/
class ExampleGroup extends ExampleBase {
  static element_name() {
    return "group";
  }

  #items: StateOrVal<ExampleBox[]> = [];

  constructor() {
    super();
    this.style.cssText = "display:flex;flex-wrap:wrap;gap:4px";
  }

  /**Given at creation and never replaced, so others can follow it for the life of the group*/
  get items(): StateOrVal<ExampleBox[]> {
    return this.#items;
  }

  /**Applies the creation inputs, called once by create, the factory gives create both these and the set options*/
  [CREATE](options: ExampleGroupCreateOptions) {
    super[CREATE](options);
    if (options.items === undefined) return;
    this.#items = options.items;
    this.set_input(GROUP_CREATE.items, options.items, (items) => {
      if (items.ok) this.replaceChildren(...items.value);
      else this.textContent = "⚠ " + items.error;
    });
  }

  set(options: ExampleGroupOptions): this {
    this.set_input(GROUP.gap, options.gap, (gap) => {
      if (gap.ok) this.style.gap = gap.value + "px";
    });
    return this;
  }
}
define_element(ExampleGroup);

/**Inputs of the watcher*/
const WATCHER = {
  /**null watches nothing, undefined leaves the group unchanged*/
  group: input_key<StateOrVal<ExampleGroup | null>>(),
};
export type ExampleWatcherOptions = InputOptions<typeof WATCHER>;
/**The items of the watched group, an inner input and not an option, typed from the key of the group*/
const WATCHER_ITEMS = input_key<InputOf<typeof GROUP_CREATE.items>>();

/**Follows the list of whichever group it is given, the nested subscription of a viewport following its page
 * The inner subscription has its own symbol, so a new group replaces it*/
class ExampleWatcher extends ExampleBase {
  static element_name() {
    return "watcher";
  }

  constructor() {
    super();
    this.style.cssText = "font:12px monospace";
    this.textContent = "no group";
  }

  set(options: ExampleWatcherOptions): this {
    this.set_input(WATCHER.group, options.group, (group) => {
      if (!group.ok) {
        this.detach_state_from_symbol(WATCHER_ITEMS);
        this.textContent = "⚠ " + group.error;
      } else if (!group.value) {
        this.detach_state_from_symbol(WATCHER_ITEMS);
        this.textContent = "no group";
      } else
        this.set_input(WATCHER_ITEMS, group.value.items, (items) => {
          //A fixed list never changes
          const fixed = !state.is.state_of(group.value?.items);
          this.textContent = items.ok
            ? `${items.value.length} items${fixed ? ", fixed" : ""}`
            : "⚠ " + items.error;
        });
    });
    return this;
  }
}
define_element(ExampleWatcher);

//       _____ _      _____ _____  ______ _____
//      / ____| |    |_   _|  __ \|  ____|  __ \
//     | (___ | |      | | | |  | | |__  | |__) |
//      \___ \| |      | | | |  | |  __| |  _  /
//      ____) | |____ _| |_| |__| | |____| | \ \
//     |_____/|______|_____|_____/|______|_|  \_\
/**Inputs of the slider*/
const SLIDER = {
  /**Value the slider shows and writes, a fixed value shows a disabled slider, as it can never change*/
  value: input_key<StateOrValROSW<number>>(),
  /**Lowest value*/
  min: input_key<StateOrVal<number>>(),
  /**Highest value*/
  max: input_key<StateOrVal<number>>(),
  /**Step between values, a plain value*/
  step: input_key<number>(),
};
export type ExampleSliderOptions = InputOptions<typeof SLIDER>;

/**Slider writing to a state, the state can be shared with any other element*/
class ExampleSlider extends ExampleBase {
  static element_name() {
    return "slider";
  }

  #input = this.appendChild(document.createElement("input"));

  constructor() {
    super();
    this.#input.type = "range";
    this.#input.disabled = true;
    //Writes to whatever state the value input has now, the key keeps the reference
    this.#input.oninput = () =>
      void this.input_state(SLIDER.value)?.write(Number(this.#input.value));
  }

  set(options: ExampleSliderOptions): this {
    this.set_input(SLIDER.step, options.step, (step) => {
      this.#input.step = String(step.value);
    });
    //Limits first, setting the value clamps it to the current limits
    this.set_input(SLIDER.min, options.min, (min) => {
      if (min.ok) this.#input.min = String(min.value);
    });
    this.set_input(SLIDER.max, options.max, (max) => {
      if (max.ok) this.#input.max = String(max.value);
    });
    if (options.value === undefined) return this;
    this.set_input(SLIDER.value, options.value, (result) => {
      this.#input.value = String(result.value);
    });
    //A fixed value can not be written
    this.#input.disabled = !this.input_state(SLIDER.value);
    return this;
  }
}
define_element(ExampleSlider);

//      ______ _____ _____ _______ ____  _____
//     |  ____|  __ \_   _|__   __/ __ \|  __ \
//     | |__  | |  | || |    | | | |  | | |__) |
//     |  __| | |  | || |    | | | |  | |  _  /
//     | |____| |__| || |_   | | | |__| | | \ \
//     |______|_____/_____|  |_|  \____/|_|  \_\
/**Inputs of the view*/
const VIEW = {
  /**Scale of the square*/
  scale: input_key<StateOrVal<number>>(),
};
export type ExampleViewOptions = InputOptions<typeof VIEW>;

/**Stand in for a viewport, draws a square at the given scale*/
class ExampleView extends ExampleBase {
  static element_name() {
    return "view";
  }

  #square = this.appendChild(document.createElement("div"));

  constructor() {
    super();
    this.style.cssText =
      "display:flex;align-items:center;justify-content:center;width:160px;height:160px;background:#ecf0f1;overflow:hidden";
    this.#square.style.cssText =
      "width:40px;height:40px;background:#e67e22;transform:scale(1)";
  }

  set(options: ExampleViewOptions): this {
    this.set_input(VIEW.scale, options.scale, (scale) => {
      if (scale.ok) this.#square.style.transform = `scale(${scale.value})`;
    });
    return this;
  }
}
define_element(ExampleView);

/**Built by hand, the editor has no inputs of its own, it passes the limits on to the slider*/
export interface ExampleEditorOptions {
  /**Lowest scale*/
  min?: InputOf<typeof SLIDER.min>;
  /**Highest scale*/
  max?: InputOf<typeof SLIDER.max>;
}
/**The scale is handed out, so it is given at creation
 * The slider writes the scale, so the scale takes the type of the slider value*/
export interface ExampleEditorCreateOptions extends ExampleEditorOptions {
  /**A fixed scale can not be changed, so the slider is disabled*/
  scale?: InputOf<typeof SLIDER.value>;
}

/**Wraps a view with controls, the stand in for an editor wrapping a viewport
 * The children are built in the constructor, the scale and limits are passed on to them unchanged,
 * as_state is only used where a state is needed, to derive the label and to hand the scale out*/
class ExampleEditor extends ExampleBase {
  static element_name() {
    return "editor";
  }

  #scale: StateROS<number> = state.ok(1);
  #view = this.appendChild(example_view());
  #slider = this.appendChild(
    example_slider({ min: 0.25, max: 3, step: 0.25, value: 1 }),
  );
  #label = this.appendChild(
    example_box({ width: 160, height: 24, label: "scale 1.00" }),
  );

  constructor() {
    super();
    this.style.cssText =
      "display:inline-flex;flex-direction:column;gap:4px;align-items:flex-start";
  }

  /**The scale as a state, also when a fixed scale was given, so anything can subscribe to it
   * Given at creation and never replaced*/
  get scale(): StateROS<number> {
    return this.#scale;
  }

  /**Applies the scale, given at creation as it is handed out*/
  [CREATE](options: ExampleEditorCreateOptions) {
    super[CREATE](options);
    const scale = options.scale;
    if (scale === undefined) return;
    this.#scale = state.as_state(scale);
    this.#view.set({ scale });
    this.#slider.set({ value: scale });
    this.#label.set({
      label: state.p.ros(this.#scale, (v) => ok(`scale ${v.value.toFixed(2)}`)),
    });
  }

  set(options: ExampleEditorOptions): this {
    this.#slider.set({ min: options.min, max: options.max });
    return this;
  }
}
define_element(ExampleEditor);

//      ______      _____ _______ ____  _____  _____ ______  _____
//     |  ____/\   / ____|__   __/ __ \|  __ \|_   _|  ____|/ ____|
//     | |__ /  \ | |       | | | |  | | |__) | | | | |__  | (___
//     |  __/ /\ \| |       | | | |  | |  _  /  | | |  __|  \___ \
//     | | / ____ \ |____   | | | |__| | | \ \ _| |_| |____ ____) |
//     |_|/_/    \_\_____|  |_|  \____/|_|  \_\_____|______|_____/
//The classes are only exported as types, so they can only be created through the factories
//The factories take optional options and create the element with create, which applies them with [CREATE] and set
export type {
  ExampleBox,
  ExampleEditor,
  ExampleGroup,
  ExampleLabelBox,
  ExampleOverrideBox,
  ExampleSlider,
  ExampleView,
  ExampleWatcher,
};

export function example_box(options: ExampleBoxOptions = {}): ExampleBox {
  return ExampleBox.create(options);
}
export function example_label_box(
  options: ExampleLabelBoxOptions = {},
): ExampleLabelBox {
  return ExampleLabelBox.create(options);
}
export function example_override_box(
  options: ExampleOverrideBoxOptions = {},
): ExampleOverrideBox {
  return ExampleOverrideBox.create(options);
}
export function example_group(
  options: ExampleGroupCreateOptions = {},
): ExampleGroup {
  return ExampleGroup.create(options);
}
export function example_watcher(
  options: ExampleWatcherOptions = {},
): ExampleWatcher {
  return ExampleWatcher.create(options);
}
export function example_slider(
  options: ExampleSliderOptions = {},
): ExampleSlider {
  return ExampleSlider.create(options);
}
export function example_view(options: ExampleViewOptions = {}): ExampleView {
  return ExampleView.create(options);
}
export function example_editor(
  options: ExampleEditorCreateOptions = {},
): ExampleEditor {
  return ExampleEditor.create(options);
}
