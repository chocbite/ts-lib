import { Base, define_element } from "#base";
import {
  state,
  type State,
  type StateROSW,
  type StateSub,
} from "@chocbite/ts-lib/state";

/**A fixed value or a state giving the value*/
export type Input<T> = T | State<T>;

/**Base of the trial elements, attach_input would move to Base if the pattern is kept*/
export abstract class TestBase extends Base {
  static element_name() {
    return "@abstract@";
  }
  static element_name_space() {
    return "test";
  }

  /**Applies a fixed value right away, a state is applied while the element is connected
   * The last good value is kept when a state gives an error*/
  protected attach_input<T>(input: Input<T>, apply: (value: T) => void): void {
    if (state.is.state(input))
      this.attach_state(input, (result) => {
        if (result.ok) apply(result.value);
      });
    else apply(input);
  }
}

//      ____   ______   __
//     |  _ \ / __ \ \ / /
//     | |_) | |  | \ V /
//     |  _ <| |  | |> <
//     | |_) | |__| / . \
//     |____/ \____/_/ \_\
export interface TestBoxOptions {
  width?: Input<number>;
  height?: Input<number>;
  label?: Input<string>;
  /**State only, nothing is subscribed when left out*/
  color?: State<string>;
}

/**Colored box, the inputs are both values and states, except color which is only a state*/
export class TestBox extends TestBase {
  static element_name() {
    return "box";
  }

  readonly width: Input<number>;
  readonly height: Input<number>;
  readonly label: Input<string>;
  readonly color: State<string> | undefined;

  #text = this.appendChild(document.createElement("span"));

  constructor(options: TestBoxOptions = {}) {
    super();
    this.width = options.width ?? 100;
    this.height = options.height ?? 32;
    this.label = options.label ?? "";
    this.color = options.color;
    this.style.cssText = BOX_STYLE;
    this.attach_input(this.width, (width) => {
      this.style.width = width + "px";
    });
    this.attach_input(this.height, (height) => {
      this.style.height = height + "px";
    });
    this.attach_input(this.label, (label) => {
      this.#text.textContent = this.format_label(label);
    });
    if (this.color)
      this.attach_input(this.color, (color) => {
        this.style.background = color;
      });
  }

  /**Overridable, shows what happens when an input calls into a subclass*/
  protected format_label(label: string): string {
    return label;
  }
}
define_element(TestBox);

const BOX_STYLE =
  "display:inline-flex;align-items:center;justify-content:center;gap:4px;box-sizing:border-box;overflow:hidden;background:#2980b9;color:white;font:12px sans-serif";

export interface TestLabelBoxOptions extends TestBoxOptions {
  badge?: Input<string>;
}

/**Subclass adding its own input after super, which is safe*/
export class TestLabelBox extends TestBox {
  static element_name() {
    return "labelbox";
  }

  readonly badge: Input<string>;

  #badge = this.insertBefore(
    document.createElement("b"),
    this.firstChild,
  );

  constructor(options: TestLabelBoxOptions = {}) {
    super(options);
    this.badge = options.badge ?? "";
    this.attach_input(this.badge, (badge) => {
      this.#badge.textContent = badge;
    });
  }
}
define_element(TestLabelBox);

export interface TestOverrideBoxOptions extends TestBoxOptions {
  prefix: string;
}

/**Subclass overriding a method used by an input, which throws for a fixed label,
 * as a fixed value is applied in the base constructor before #prefix exists*/
export class TestOverrideBox extends TestBox {
  static element_name() {
    return "overridebox";
  }

  #prefix: string;

  constructor(options: TestOverrideBoxOptions) {
    super(options);
    this.#prefix = options.prefix;
  }

  protected format_label(label: string): string {
    return this.#prefix + label;
  }
}
define_element(TestOverrideBox);

//       _____ _____   ____  _    _ _____
//      / ____|  __ \ / __ \| |  | |  __ \
//     | |  __| |__) | |  | | |  | | |__) |
//     | | |_ |  _  /| |  | | |  | |  ___/
//     | |__| | | \ \| |__| | |__| | |
//      \_____|_|  \_\\____/ \____/|_|
export interface TestGroupOptions {
  /**State only, so other elements can always subscribe to it*/
  items: State<TestBox[]>;
}

/**Shows a list of boxes and hands the state of the list out to other elements*/
export class TestGroup extends TestBase {
  static element_name() {
    return "group";
  }

  readonly items: State<TestBox[]>;

  constructor(options: TestGroupOptions) {
    super();
    this.items = options.items;
    this.style.cssText = "display:flex;flex-wrap:wrap;gap:4px";
    this.attach_input(this.items, (items) => {
      this.replaceChildren(...items);
    });
  }
}
define_element(TestGroup);

export interface TestWatcherOptions {
  group: State<TestGroup | undefined>;
}

/**Follows the list of whichever group it is given, the nested subscription of a viewport following its page*/
export class TestWatcher extends TestBase {
  static element_name() {
    return "watcher";
  }

  readonly group: State<TestGroup | undefined>;

  #on_items: StateSub<any> | undefined;

  constructor(options: TestWatcherOptions) {
    super();
    this.group = options.group;
    this.style.cssText = "font:12px monospace";
    this.attach_input(this.group, (group) => {
      if (this.#on_items) this.detach_state(this.#on_items);
      this.#on_items = undefined;
      if (group)
        this.#on_items = this.attach_state(group.items, (items) => {
          this.textContent = items.ok
            ? `${items.value.length} items`
            : items.error;
        });
      else this.textContent = "no group";
    });
  }
}
define_element(TestWatcher);

//       _____ _      _____ _____  ______ _____
//      / ____| |    |_   _|  __ \|  ____|  __ \
//     | (___ | |      | | | |  | | |__  | |__) |
//      \___ \| |      | | | |  | |  __| |  _  /
//      ____) | |____ _| |_| |__| | |____| | \ \
//     |_____/|______|_____|_____/|______|_|  \_\
export interface TestSliderOptions {
  value: StateROSW<number>;
  min?: Input<number>;
  max?: Input<number>;
}

/**Slider writing to a state, the state can be shared with any other element*/
export class TestSlider extends TestBase {
  static element_name() {
    return "slider";
  }

  readonly value: StateROSW<number>;

  #input = this.appendChild(document.createElement("input"));

  constructor(options: TestSliderOptions) {
    super();
    this.value = options.value;
    this.#input.type = "range";
    //Limits first, setting the value clamps it to the current limits
    this.attach_input(options.min ?? 0, (min) => {
      this.#input.min = String(min);
    });
    this.attach_input(options.max ?? 100, (max) => {
      this.#input.max = String(max);
    });
    this.attach_input(this.value, (value) => {
      this.#input.value = String(value);
    });
    this.#input.oninput = () => {
      void this.value.write(Number(this.#input.value));
    };
  }
}
define_element(TestSlider);

//       _____ ______ _______ _______ ______ _____   _____
//      / ____|  ____|__   __|__   __|  ____|  __ \ / ____|
//     | (___ | |__     | |     | |  | |__  | |__) | (___
//      \___ \|  __|    | |     | |  |  __| |  _  / \___ \
//      ____) | |____   | |     | |  | |____| | \ \ ____) |
//     |_____/|______|  |_|     |_|  |______|_|  \_\_____/
/**The box written the way elements are written today, with setters and getters, to compare against*/
export class TestSetterBox extends TestBase {
  static element_name() {
    return "setterbox";
  }

  #width: number = 100;
  #height: number = 32;
  #label: string = "";
  #text = this.appendChild(document.createElement("span"));

  constructor() {
    super();
    this.style.cssText = BOX_STYLE;
  }

  set width(width: number) {
    this.#width = width;
    this.style.width = width + "px";
  }
  get width(): number {
    return this.#width;
  }

  set height(height: number) {
    this.#height = height;
    this.style.height = height + "px";
  }
  get height(): number {
    return this.#height;
  }

  set label(label: string) {
    this.#label = label;
    this.#text.textContent = label;
  }
  get label(): string {
    return this.#label;
  }
}
define_element(TestSetterBox);
