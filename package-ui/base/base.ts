import { ok, some, type NiceError, type Option } from "@chocbite/ts-lib/result";
import {
  state,
  type State,
  type StateInferSub,
  type StateREA,
  type StateROA,
  type StateSub,
} from "@chocbite/ts-lib/state";
import { AccessTypes } from "./access";
import { fault_icon } from "./fault";
import {
  CREATE,
  type InputKey,
  type InputResult,
  type InputState,
  type InputValue,
} from "./input";
import {
  BaseIntersectObserver,
  type BaseIntersectObserverOptions,
} from "./intersect_observer";

// Helpers for opts
type DataProps<T> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [K in keyof T as T[K] extends Function ? never : K]: T[K];
};
type WithStateROA<T> = {
  [K in keyof T]?: T[K] | StateROA<T[K]>;
};

const base_resize_observer = new ResizeObserver((e) => {
  for (let i = 0; i < e.length; i++) {
    //@ts-expect-error Call of private method, is private to prevent external usage
    (<Base>e[i].target).internal_set_size_pos(e[i].contentRect);
  }
});

/**Shared class for elements to extend
 * All none abstract elements must use the define_element function to declare itself
 *
 * Elements are only created in code, with new or a factory function, HTML is not supported,
 * constructors add children and attributes, which document.createElement and the HTML parser do not allow
 *
 * New elements, and elements being reworked, follow the element pattern in package-ui/PATTERN.md:
 * The class is only exported as a type, a factory function taking optional options creates it with create
 * The constructor takes no arguments, it builds the children and sets the defaults
 * The inputs are an object of keys made with input_key, the options type is InputOptions of it
 * set takes the options, each a fixed value or a state (StateOrVal), and applies them with set_input
 * Inputs handed out to other elements are given once, at creation, and applied by overriding [CREATE]
 * so element_factory({ width: 100, label: label_state }).set({ width: 120 })
 * A fixed value never changes, anything that changes must be a state
 *
 * All none abstracts classes must override the static method element_name to return the name of the element
 * Abstract classes should return @abstract@
 *
 * If another library defines an abstract base class, it is recommended to change the static element_name_space method to the name of the library
 * example for this library '@chocolatelibui/core' becomes 'chocolatelibui-core'
 * static element_name_space() { return 'chocolatelibui-core' }
 * This resets the nametree to the library name and prevents too long element names
 *
 * Elements have an access propery, which builds on the html inert property
 * Access has the following three states
 * write = normal interaction and look
 * read = inert attribute is added making the element uninteractable, and add opacity 0.5 to make the element look inaccessible
 * none = adds display:none to element to make it */
export abstract class Base extends HTMLElement {
  /**Returns the name used to define the element, Abstract classes should return @abstract@ */
  static element_name() {
    return "@abstract@";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "lib";
  }

  #states: Map<StateSub<any>, [State<any>, boolean]> = new Map();

  readonly is_connected: boolean = false;

  /**Works when element is connected to observer, otherwise it is an alias for isConnected*/
  readonly is_visible: boolean = false;

  #access?: AccessTypes;

  #props: Map<any, StateSub<any>> = new Map();
  #attr: Map<string, StateSub<any>> = new Map();

  /**Runs when element is attached to document*/
  protected connectedCallback() {
    for (const [f, [s, v]] of this.#states) if (!v) s.sub(f, true);
    //Set after subscribing, so states attached by the subscribers are not subscribed twice,
    //but before visibility, so states attached from on_visible are subscribed
    //@ts-expect-error Change readonly, in same class, why is there no way to do this without ts-ignore?
    this.is_connected = true;
    if (this.#attached_int_observer) this.#attached_int_observer.observe(this);
    else this.internal_set_visible(true);
  }

  /**Runs when element is dettached from document*/
  protected disconnectedCallback() {
    //@ts-expect-error Change readonly, in same class
    this.is_connected = false;
    for (const [f, [s, v]] of this.#states) if (!v) s.unsub(f);
    if (this.#attached_int_observer)
      this.#attached_int_observer.unobserve(this);
    this.internal_set_visible(false);
  }

  /**Sets any attribute on the base element, to either a fixed value or a state value
   * Older style, new elements take their inputs with set and set_input, see package-ui/PATTERN.md*/
  opts(opts: WithStateROA<DataProps<this>>): this {
    for (const key in opts) {
      const opt = opts[key] as this[typeof key] | StateROA<this[typeof key]>;
      if (state.is.roa(opt)) this.attach_state_ROA_to_prop(key, opt);
      else this.detach_state_from_prop(key)[key] = opt;
    }
    return this;
  }

  /**Applies the given options, options that are not given are left unchanged
   * Can be called any number of times, like when a list reuses an element for other data
   * Elements override it with their own options type and call super.set with the options,
   * each option is applied with set_input, so setting an option again replaces the state set before
   * It runs after every constructor has finished, so overrides called from it can use all fields of the subclass*/
  set(_options: object): this {
    return this;
  }

  /**Creates the element, applies the creation inputs with [CREATE] and then the rest with set
   * Factories call it, and called on a subclass it creates the subclass, so a user subclass is made with MyElement.create(options)
   * The options are those of [CREATE] and set together, both run after every constructor has finished
   * The constructor must take no arguments, abstract classes can not be created*/
  static create<T extends Base>(
    this: new () => T,
    options: Parameters<T[typeof CREATE]>[0] & Parameters<T["set"]>[0] = {},
  ): T {
    const element = new this();
    element[CREATE](options);
    return element.set(options);
  }

  /**Applies the inputs given at creation, called once by create before set
   * Inputs other elements follow are given here, and left out of the options of set, so they can never be replaced
   * Elements override it with their own options type and call super[CREATE] with the options, like set*/
  [CREATE](_options: object): void {}

  /**Sets an input that is either a fixed value or a state, see set
   * undefined leaves the input unchanged
   * A fixed value is applied right away as an ok result, and detaches any state the key had
   * A state replaces any state the key had, and is applied while the element is connected
   * The key decides the type of the input, and the result apply gets:
   * inputs that can not be errors give ok results, others results the element must handle
   * @param key the key of the input, made with input_key*/
  protected set_input<S>(
    key: InputKey<S>,
    input: NoInfer<S> | undefined,
    apply: (value: InputResult<S>) => void,
  ): void {
    if (input === undefined) return;
    if (state.is.state_of(input))
      //Every input reports its errors as faults, so every element shows the fault icon the same way.
      //After apply, which can rewrite the children of the element and with them the icon
      this.attach_state_to_symbol(key, input, ((value: InputResult<S>) => {
        apply(value);
        this.fault(key, value.err ? value.error : undefined);
      }) as StateSub<any>);
    else {
      this.detach_state_from_symbol(key);
      apply(ok(input as InputValue<S>) as InputResult<S>);
      this.fault(key, undefined);
    }
  }

  //       ______      _    _ _   _______ _____
  //      |  ____/   | |  | | | |__   __/ ____|
  //      | |__ /    | |  | | |    | | | (___
  //      |  __/ /  | |  | | |    | |  ___   //      | | / ____ | |__| | |____| |  ____) |
  //      |_|/_/    _____/|______|_| |_____/
  /**Faults by key, made at the first fault, an element that never has one pays nothing*/
  #faults?: Map<symbol, NiceError>;
  #fault_icon?: Element;

  /**The problems the element has now, the errors of its inputs and the faults it reports itself*/
  get faults(): readonly NiceError[] {
    return this.#faults ? [...this.#faults.values()] : [];
  }

  /**Sets or clears, with undefined, a fault of the element under a key, the errors of inputs are set by set_input
   * For problems that are not inputs, use a key of its own, like Symbol("connection")
   * The element shows the fault icon while it has a fault, clicking it lists them*/
  protected fault(key: symbol, error: NiceError | undefined): void {
    if (error) (this.#faults ??= new Map()).set(key, error);
    else if (!this.#faults?.delete(key) && !this.#faults?.size) return;
    const has = this.#faults.size > 0;
    if (has) {
      this.#fault_icon ??= fault_icon(() => this.faults);
      //Setting the text of the anchor removes the icon, it is put back on the next input or fault
      const anchor = this.fault_anchor();
      if (this.#fault_icon.parentNode !== anchor) {
        anchor.classList.add("base-fault-host");
        anchor.appendChild(this.#fault_icon);
      }
    } else if (this.#fault_icon) {
      this.#fault_icon.parentElement?.classList.remove("base-fault-host");
      this.#fault_icon.remove();
      this.#fault_icon = undefined;
    }
  }

  /**Element the fault icon is put in, at its top right corner, the element itself by default
   * Override it to put the icon in a child, like the box of a value instead of the label*/
  protected fault_anchor(): Element {
    return this;
  }

  /**The state an input has now, undefined when it has a fixed value or was never set
   * Typed by the key, so a writable input gives a writable state to write to,
   * the element keeps no reference of its own to the state*/
  protected input_state<S>(key: InputKey<S>): InputState<S> | undefined {
    const func = this.#props.get(key);
    return (func && this.#states.get(func)?.[0]) as InputState<S> | undefined;
  }

  /**Executes a function with the element as an argument and returns the element
   * Useful when declaring multiple elements in a single statement, without easy access to a scope to execute code in*/
  scope(fn: (elem: this) => void): this {
    fn(this);
    return this;
  }

  //       ____  ____   _____ ______ _______      ________ _____
  //      / __ \|  _ \ / ____|  ____|  __ \ \    / /  ____|  __ \
  //     | |  | | |_) | (___ | |__  | |__) \ \  / /| |__  | |__) |
  //     | |  | |  _ < \___ \|  __| |  _  / \ \/ / |  __| |  _  /
  //     | |__| | |_) |____) | |____| | \ \  \  /  | |____| | \ \
  //      \____/|____/|_____/|______|_|  \_\  \/   |______|_|  \_\
  /**Observer for children of this element */
  #intersect_observer?: BaseIntersectObserver;
  #attached_int_observer?: BaseIntersectObserver;

  /**Returns an observer for the element */
  intersect_observer(
    options: BaseIntersectObserverOptions = {
      root: this,
      threshold: 0,
      deffered_hidden: 1000,
    },
  ): BaseIntersectObserver {
    return (this.#intersect_observer ??= new BaseIntersectObserver(options));
  }

  /**Attaches the component to an observer, which is needed for the isVisible state and event to work and for the state system to work on visible*/
  attach_to_intersect_observer(observer?: BaseIntersectObserver): this {
    if (observer) {
      if (this.is_connected) {
        if (this.#attached_int_observer)
          this.#attached_int_observer.unobserve(this);
        observer.observe(this);
      }
      this.#attached_int_observer = observer;
    } else if (this.#attached_int_observer) {
      //Without an observer a connected element counts as visible
      if (this.is_connected) {
        this.#attached_int_observer.unobserve(this);
        this.internal_set_visible(true);
      }
      this.#attached_int_observer = undefined;
    }
    return this;
  }

  private internal_set_visible(is: boolean) {
    if (this.is_visible !== is) {
      //@ts-expect-error Change readonly, in same class
      this.is_visible = is;
      if (is) {
        for (const [f, [s, v]] of this.#states) if (v) s.sub(f, true);
        if (this.#resize_observe) base_resize_observer.observe(this);
      } else {
        for (const [f, [s, v]] of this.#states) if (v) s.unsub(f);
        if (this.#resize_observe) base_resize_observer.unobserve(this);
      }
      this.on_visible(is);
    }
  }
  /**Overrideable function called when the element becomes visible or hidden
   * If intersection observer is not attached it is based on connectedCallback, which is less accurate*/
  protected on_visible(_is: boolean) {}

  #resize_observe = false;
  #actual_size?: { width: number; height: number };
  /**Returns actual size and position of the element
   * if a resize observer is attached to the element, it will return the result of that, otherwise it will return the result of getBoundingClientRect()*/
  get actual_size(): { width: number; height: number } {
    return this.#actual_size ?? this.getBoundingClientRect();
  }

  /**Attaches the component to the global resize observer */
  attach_to_resize_observer(): this {
    if (this.is_visible) base_resize_observer.observe(this);
    this.#resize_observe = true;
    return this;
  }

  /**Dettaches the component from the global resize observer */
  detach_from_resize_observer(): this {
    if (this.is_visible) base_resize_observer.unobserve(this);
    this.#resize_observe = false;
    this.#actual_size = undefined;
    return this;
  }

  private internal_set_size_pos(rect: DOMRectReadOnly) {
    this.#actual_size = rect;
    this.on_resize(rect);
  }

  /**Overrideable function called when the element is resized
   * Only triggers when a resize observer is attached to the element, otherwise it will not trigger*/
  protected on_resize(_rect: { width: number; height: number }) {}

  //               _____ _____ ______  _____ _____
  //         /\   / ____/ ____|  ____|/ ____/ ____|
  //        /  \ | |   | |    | |__  | (___| (___
  //       / /\ \| |   | |    |  __|  \___ \\___ \
  //      / ____ \ |___| |____| |____ ____) |___) |
  //     /_/    \_\_____\_____|______|_____/_____/
  /**Sets the access of the element, passing undefined is the same as passing write access*/
  set access(access: AccessTypes) {
    if (this.#access === access) return;
    this.#access = access;
    switch (access) {
      case AccessTypes.Write:
        this.inert = false;
        break;
      case AccessTypes.Read:
        this.inert = true;
        break;
      case AccessTypes.None:
        this.setAttribute("inert", "none");
        break;
    }
    this.on_access(access);
  }

  /**Overrideable function called when access is changed */
  protected on_access(_access: AccessTypes) {}

  /**Returns the current access of the element */
  get access(): AccessTypes {
    return this.#access ?? AccessTypes.Write;
  }
  //       _____ _______    _______ ______
  //      / ____|__   __|/\|__   __|  ____|
  //     | (___    | |  /  \  | |  | |__
  //      \___ \   | | / /\ \ | |  |  __|
  //      ____) |  | |/ ____ \| |  | |____
  //     |_____/   |_/_/    \_\_|  |______|
  /**Attaches a state to a function, so that the function is subscribed to the state when the component is connected
   * @param visible when set true the function is only subscribed when the element is visible, this requires an observer to be attached to the element*/
  attach_state<S extends State<any>>(
    state: S,
    func: StateInferSub<S>,
    visible?: boolean,
  ): typeof func {
    if (this.#states.has(func))
      console.error("Function already registered with element", func, this);
    else {
      this.#states.set(func, [state, Boolean(visible)]);
      if (visible ? this.is_visible : this.is_connected)
        state.sub(func as StateSub<any>, true);
    }
    return func;
  }

  /**Detaches the function from the state/component */
  detach_state(func: StateSub<any>): typeof func {
    const state = this.#states.get(func);
    if (state) {
      if (state[1] ? this.is_visible : this.is_connected) state[0].unsub(func);
      this.#states.delete(func);
    } else console.error("Function not registered with element", func, this);
    return func;
  }

  /**Attaches a state to a function, so that the function is subscribed to the state when the component is connected
   * @param visible when set true the function is only subscribed when the element is visible, this requires an observer to be attached to the element*/
  attach_state_to_symbol<S extends State<any>>(
    symbol: symbol,
    state: S,
    func: StateInferSub<S>,
    visible?: boolean,
  ): this {
    this.detach_state_from_symbol(symbol).#props.set(
      symbol,
      this.attach_state(state, func, visible),
    );
    return this;
  }

  /**Detaches the function from the state/component */
  detach_state_from_symbol(symbol: symbol): this {
    const pro = this.#props.get(symbol);
    if (pro) {
      this.detach_state(pro);
      this.#props.delete(symbol);
    }
    return this;
  }

  //       _____ _______    _______ ______   _____  _____   ____  _____
  //      / ____|__   __|/\|__   __|  ____| |  __ \|  __ \ / __ \|  __ \
  //     | (___    | |  /  \  | |  | |__    | |__) | |__) | |  | | |__) |
  //      \___ \   | | / /\ \ | |  |  __|   |  ___/|  _  /| |  | |  ___/
  //      ____) |  | |/ ____ \| |  | |____  | |    | | \ \| |__| | |
  //     |_____/   |_/_/    \_\_|  |______| |_|    |_|  \_\\____/|_|
  /**Attaches a state to a property, so that the property is updated when the state changes
   * @param prop the property to attach the state to
   * @param state the state to attach to the property
   * @param visible when set true the property is only updated when the element is visible, this requires an observer to be attached to the element*/
  attach_state_ROA_to_prop<K extends keyof this>(
    prop: K,
    state: StateROA<this[K], any, any>,
    visible?: boolean,
  ): this {
    this.detach_state_from_prop(prop).#props.set(
      prop,
      this.attach_state(state, (val) => (this[prop] = val.value), visible),
    );
    return this;
  }

  /**Attaches a state to a property, so that the property is updated when the state changes
   * @param prop the property to attach the state to
   * @param state the state to attach to the property
   * @param visible when set true the property is only updated when the element is visible, this requires an observer to be attached to the element
   * @param fallback the fallback value for the property when the state is not ok, if undefined the property is not updated when the state is not ok*/
  attach_state_ROA_to_prop_map<K extends keyof this, T = this[K]>(
    prop: K,
    state: StateROA<T, any, any>,
    map: (val: T) => Option<this[K]>,
    visible?: boolean,
  ): this {
    this.detach_state_from_prop(prop).#props.set(
      prop,
      this.attach_state(
        state,
        (val) => {
          const o = map(val.value);
          if (o.some) this[prop] = o.value;
        },
        visible,
      ),
    );
    return this;
  }

  /**Attaches a state to a property, so that the property is updated when the state changes
   * @param prop the property to attach the state to
   * @param state the state to attach to the property
   * @param map_err function called when state gives a ResultErr,
   * @param visible when set true the property is only updated when the element is visible, this requires an observer to be attached to the element*/
  attach_state_to_prop<K extends keyof this>(
    prop: K,
    state: StateREA<this[K], any, any>,
    map_err: (error: NiceError) => Option<this[K]>,
    visible?: boolean,
  ): this {
    this.detach_state_from_prop(prop).#props.set(
      prop,
      this.attach_state(
        state,
        (v) => {
          const o = v.ok ? some(v.value) : map_err(v.error);
          if (o.some) this[prop] = o.value;
        },
        visible,
      ),
    );
    return this;
  }
  /**Attaches a state to a property, so that the property is updated when the state changes
   * @param prop the property to attach the state to
   * @param state the state to attach to the property
   * @param map_err function called when state gives a ResultErr,
   * @param map function called when state gives a ResultOk,
   * @param visible when set true the property is only updated when the element is visible, this requires an observer to be attached to the element*/
  attach_state_to_prop_map<K extends keyof this, T = this[K]>(
    prop: K,
    state: StateREA<T, any, any>,
    map_err: (error: NiceError) => Option<this[K]>,
    map: (val: T) => Option<this[K]>,
    visible?: boolean,
  ): this {
    this.detach_state_from_prop(prop).#props.set(
      prop,
      this.attach_state(
        state,
        (v) => {
          const o = v.ok ? map(v.value) : map_err(v.error);
          if (o.some) this[prop] = o.value;
        },
        visible,
      ),
    );
    return this;
  }

  /**Detaches the state from the property */
  detach_state_from_prop<T extends keyof this>(prop: T): this {
    const pro = this.#props.get(prop);
    if (pro) {
      this.detach_state(pro);
      this.#props.delete(prop);
    }
    return this;
  }

  //       _____ _______    _______ ______         _______ _______ _____  _____ ____  _    _ _______ ______
  //      / ____|__   __|/\|__   __|  ____|     /\|__   __|__   __|  __ \|_   _|  _ \| |  | |__   __|  ____|
  //     | (___    | |  /  \  | |  | |__       /  \  | |     | |  | |__) | | | | |_) | |  | |  | |  | |__
  //      \___ \   | | / /\ \ | |  |  __|     / /\ \ | |     | |  |  _  /  | | |  _ <| |  | |  | |  |  __|
  //      ____) |  | |/ ____ \| |  | |____   / ____ \| |     | |  | | \ \ _| |_| |_) | |__| |  | |  | |____
  //     |_____/   |_/_/    \_\_|  |______| /_/    \_\_|     |_|  |_|  \_\_____|____/ \____/   |_|  |______|
  /**Attaches a state to an element attribute, so that the attribute is updated when the state changes
   * @param qualified_name the qualified name of the attribute to attach the state to
   * @param state the state to attach to the attribute
   * @param visible when set true the attribute is only updated when the element is visible, this requires an observer to be attached to the element*/
  attach_state_ROA_to_attribute(
    qualified_name: string,
    state: StateROA<string, any, any>,
    visible?: boolean,
  ): this {
    this.detach_state_from_attribute(qualified_name).#attr.set(
      qualified_name,
      this.attach_state(
        state,
        (val) => this.setAttribute(qualified_name, val.value),
        visible,
      ),
    );
    return this;
  }

  /**Attaches a state to an element attribute, so that the attribute is updated when the state changes
   * @param qualified_name the qualified name of the attribute to attach the state to
   * @param state the state to attach to the attribute
   * @param visible when set true the attribute is only updated when the element is visible, this requires an observer to be attached to the element
   * @param fallback the fallback value for the attribute when the state is not ok, if undefined the attribute is not updated when the state is not ok*/
  attach_state_ROA_to_attribute_map<U>(
    qualified_name: string,
    state: StateROA<U, any, any>,
    map: (val: U) => Option<string>,
    visible?: boolean,
  ): this {
    this.detach_state_from_attribute(qualified_name).#attr.set(
      qualified_name,
      this.attach_state(
        state,
        (val) => {
          const o = map(val.value);
          if (o.some) this.setAttribute(qualified_name, o.value);
        },
        visible,
      ),
    );
    return this;
  }

  /**Attaches a state to an element attribute, so that the attribute is updated when the state changes
   * @param qualified_name the qualified name of the attribute to attach the state to
   * @param state the state to attach to the attribute
   * @param map_err function called when state gives a ResultErr,
   * @param visible when set true the attribute is only updated when the element is visible, this requires an observer to be attached to the element*/
  attach_state_to_attribute(
    qualified_name: string,
    state: StateREA<string, any, any>,
    map_err: (error: NiceError) => Option<string>,
    visible?: boolean,
  ): this {
    this.detach_state_from_attribute(qualified_name).#attr.set(
      qualified_name,
      this.attach_state(
        state,
        (v) => {
          const o = v.ok ? some(v.value) : map_err(v.error);
          if (o.some) this.setAttribute(qualified_name, o.value);
        },
        visible,
      ),
    );
    return this;
  }

  /**Attaches a state to an element attribute, so that the attribute is updated when the state changes
   * @param qualified_name the qualified name of the attribute to attach the state to
   * @param state the state to attach to the attribute
   * @param map_err function called when state gives a ResultErr,
   * @param map function called when state gives a ResultOk,
   * @param visible when set true the attribute is only updated when the element is visible, this requires an observer to be attached to the element*/
  attach_state_to_attribute_map<U>(
    qualified_name: string,
    state: StateREA<U, any, any>,
    map_err: (error: NiceError) => Option<string>,
    map: (val: U) => Option<string>,
    visible?: boolean,
  ): this {
    this.detach_state_from_attribute(qualified_name).#attr.set(
      qualified_name,
      this.attach_state(
        state,
        (v) => {
          const o = v.ok ? map(v.value) : map_err(v.error);
          if (o.some) this.setAttribute(qualified_name, o.value);
        },
        visible,
      ),
    );
    return this;
  }

  /**Detaches the state from the property */
  detach_state_from_attribute(qualified_name: string): this {
    const pro = this.#attr.get(qualified_name);
    if (pro) {
      this.detach_state(pro);
      this.#attr.delete(qualified_name);
    }
    return this;
  }
}
