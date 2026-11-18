import {
  Base,
  CREATE,
  input_key,
  type BaseOptions,
  type InputKey,
} from "#base";
import { sync_resolve } from "@chocbite/ts-lib/common";
import {
  err,
  err_nice,
  NiceError,
  ok,
  type Option,
  type ResultNice,
} from "@chocbite/ts-lib/result";
import {
  state,
  type State,
  type StateOrVal,
  type StateOrValREA,
} from "@chocbite/ts-lib/state";
import "./shared";
import { form_errors } from "./errors";

/**A change to an element bound to a read only state, normal use, the element only shows the value*/
const read_only = () => err_nice(form_errors.READ_ONLY, "The value can not be changed here");

/**Colors for form elements that have selectable colors*/
export const FormColors = {
  None: "none",
  Black: "black",
  Green: "green",
  Red: "red",
  Blue: "blue",
  Yellow: "yellow",
} as const;
export type FormColors = (typeof FormColors)[keyof typeof FormColors];

/**Shared component class for other components to inherit from*/
export abstract class FormElement extends Base {
  static element_name() {
    return "@abstract@";
  }
  static element_name_space(): string {
    return "form";
  }
}

//##################################################################################################
//     __      __     _     _    _ ______   _____  ______          _____
//     \ \    / /\   | |   | |  | |  ____| |  __ \|  ____|   /\   |  __ \
//      \ \  / /  \  | |   | |  | | |__    | |__) | |__     /  \  | |  | |
//       \ \/ / /\ \ | |   | |  | |  __|   |  _  /|  __|   / /\ \ | |  | |
//        \  / ____ \| |___| |__| | |____  | | \ \| |____ / ____ \| |__| |
//         \/_/    \_\______\____/|______| |_|  \_\______/_/    \_\_____/

/**Inputs of form value elements, loosely typed as the elements are generic in their value*/
const FORM_VALUE = {
  value: input_key<StateOrValREA<any, Option<{}>, any>>(),
  description: input_key<StateOrVal<string>>(),
};

/**Options of form value elements on the element pattern*/
export interface FormValueOptions<RT> extends BaseOptions {
  /**Value the element shows and the user changes
   * A fixed value is the value the element starts with, the element keeps the user's changes itself,
   * a writable state is written when the user changes the value,
   * a read only state is only shown, a change by the user is refused with a warning
   * Not given, the element starts without a value and keeps it itself
   * An error of the state shows as a fault of the element, and makes get_value an error while it lasts*/
  value?: StateOrValREA<RT, Option<{}>, unknown>;
  /**Longer description of what the element does, shown as a tooltip*/
  description?: StateOrVal<string>;
}

/**Options of form value elements given at creation*/
export interface FormValueCreateOptions<ID extends string | undefined> {
  /**Id the group of the element knows its value by, the group reads it to type its values*/
  id?: ID;
}

/**Shared class for all components with values*/
export abstract class FormValue<
  RT,
  ID extends string | undefined,
> extends FormElement {
  static element_name() {
    return "@abstract@";
  }

  #form_id?: ID;
  /**Id the group of the element knows its value by, given at creation*/
  get form_id(): ID {
    return this.#form_id as ID;
  }

  [CREATE](options: FormValueCreateOptions<ID>): void {
    super[CREATE](options);
    if (options.id !== undefined) this.#form_id = options.id;
  }

  set(options: FormValueOptions<RT>): this {
    super.set(options);
    this.set_input(FORM_VALUE.description, options.description, (text) =>
      this.#describe(text.ok ? text.value : ""),
    );
    const value = options.value;
    if (value === undefined) return this;
    const from_state = state.is.state_of(value);
    //Related first, so the first value is shown with them, like decimals
    const related = from_state ? value.related() : undefined;
    this.state_related(related?.some ? related.value : {});
    this.set_input(FORM_VALUE.value, value, (result) => {
      //The key is loosely typed, the value can be an error
      //The error itself is shown by the fault icon of Base
      const val = result as ResultNice<RT>;
      this.#value_error = val.err ? val.error : undefined;
      if (val.ok) this.show_value(val.value);
    });
    return this;
  }

  #describe(text: string) {
    if (text) this.title = text;
    else this.removeAttribute("title");
  }

  protected _buffer?: RT;
  get buffer(): RT | undefined {
    return this._buffer;
  }

  /**The state the value comes from, undefined for a fixed value or a value the element keeps itself*/
  protected get _state(): State<RT, Option<{}>, RT> | undefined {
    return this.input_state(FORM_VALUE.value) as
      State<RT, Option<{}>, RT> | undefined;
  }


  /**Shows the value and keeps it, without writing it anywhere, the value input uses it*/
  protected show_value(val: RT): void {
    if (typeof this._buffer !== "undefined" && this._buffer === val) return;
    this._buffer = val;
    this.new_value(val);
  }

  /**Returns the value of the element, from wherever it comes, an error while the value is in error or there is none yet*/
  get get_value(): ResultNice<RT> {
    //The whole error of the state, with its details for whoever has to fix it
    if (this.#value_error) return err(this.#value_error);
    return typeof this._buffer === "undefined"
      ? err_nice(form_errors.NO_VALUE, "No value yet")
      : ok(this._buffer);
  }

  /**The error of the state of the value while it lasts*/
  #value_error?: NiceError;

  /**Clears the value, only a value the element keeps itself, not one from a state*/
  clear(): void {
    if (this._state) return;
    this._buffer = undefined;
    this.clear_value();
  }

  /**Called when value is set by value setter or state*/
  protected abstract new_value(val: RT): void;

  /**Clears form element graphically*/
  protected abstract clear_value(): void;

  /**Called when the value input changes, with the related states of the value state, like limits, {} for a fixed value
   * Elements follow the ones they use with follow_related*/
  protected abstract state_related(related: {}): void;

  /**Follows a related state of the value state, like its maximum length, under a key of the element
   * apply gets undefined when the value state has none, or it is in error*/
  protected follow_related<T>(
    key: InputKey<StateOrVal<T | null>>,
    related: State<T> | undefined,
    apply: (value: T | undefined) => void,
  ): void {
    this.set_input(key, related ?? null, (value) =>
      apply(value.ok && value.value !== null ? value.value : undefined),
    );
  }
}

/**A setting of an element given as an input, or else taken from a related state of the value, like a maximum length
 * The input wins while it is given and ok, apply gets the setting that counts every time either changes*/
export class FormSetting<T> {
  #input?: T;
  #related?: T;
  #apply: (value: T | undefined) => void;
  constructor(apply: (value: T | undefined) => void) {
    this.#apply = apply;
  }
  /**The setting that counts now*/
  get value(): T | undefined {
    return this.#input ?? this.#related;
  }
  /**Sets the value of the input, undefined when it is in error*/
  input(value: T | undefined): void {
    this.#input = value;
    this.#apply(this.value);
  }
  /**Sets the related value, undefined when the value state has none*/
  related(value: T | undefined): void {
    this.#related = value;
    this.#apply(this.value);
  }
}

//##################################################################################################
//     __      __     _     _    _ ______  __          _______  _____ _______ ______
//     \ \    / /\   | |   | |  | |  ____| \ \        / /  __ \|_   _|__   __|  ____|
//      \ \  / /  \  | |   | |  | | |__     \ \  /\  / /| |__) | | |    | |  | |__
//       \ \/ / /\ \ | |   | |  | |  __|     \ \/  \/ / |  _  /  | |    | |  |  __|
//        \  / ____ \| |___| |__| | |____     \  /\  /  | | \ \ _| |_   | |  | |____
//         \/_/    \_\______\____/|______|     \/  \/   |_|  \_\_____|  |_|  |______|

const FORM_VALUE_WRITE = {
  change: input_key<(val: any) => void>(),
};

/**Options of form elements the user changes, on the element pattern*/
export interface FormValueWriteOptions<RT> extends FormValueOptions<RT> {
  /**Called with every value the user changes the element to, after it is accepted*/
  change?: (val: RT) => void;
}

/**Shared class for all components with values*/
export abstract class FormValueWrite<
  RT,
  ID extends string | undefined,
> extends FormValue<RT, ID> {
  static element_name() {
    return "@abstract@";
  }

  protected selected: boolean = false;
  protected warn_input: HTMLInputElement = document.createElement("input");
  #warn_timeout?: number;
  #changed: boolean = false;
  #change?: (val: RT) => void;

  constructor() {
    super();
    this.warn_input.name = "val";
  }

  set(options: FormValueWriteOptions<RT>): this {
    super.set(options);
    this.set_input(FORM_VALUE_WRITE.change, options.change, (change) => {
      this.#change = change.value;
    });
    return this;
  }

  focus(options?: FocusOptions): void {
    this.warn_input.focus(options);
  }

  /**Returns true if the value of the component has changed*/
  get changed(): boolean {
    return this.#changed;
  }

  /**While the user edits the element, a new value is only kept, so the edit is not overwritten*/
  protected show_value(val: RT): void {
    if (!this.selected) super.show_value(val);
    else this._buffer = val;
  }

  /**Shows a warning for a moment, a NiceError as its nice text and its message, there is room for both*/
  warn(message: string | NiceError): void {
    this.warn_input.setCustomValidity(typeof message === "string" ? message : message.toString());
    this.warn_input.reportValidity();
    if (this.#warn_timeout) clearTimeout(this.#warn_timeout);
    this.#warn_timeout = setTimeout(() => {
      this.warn_input.setCustomValidity("");
      this.warn_input.reportValidity();
    }, 5000);
  }

  /**Function to limit value entered */
  protected limit_value(val: RT): PromiseLike<ResultNice<RT>> {
    if (this._state) {
      if (this._state.writable) return this._state.limit(val);
      else return sync_resolve(read_only());
    } else return sync_resolve(ok(val));
  }

  /**Function to check value, a state checks the value itself when it is written, so it is not checked here*/
  protected check_value(val: RT): PromiseLike<ResultNice<RT>> {
    if (this._state && !this._state.writable) return sync_resolve(read_only());
    return sync_resolve(ok(val));
  }

  /**Function to update value*/
  protected async set_value_limit(val: RT): Promise<ResultNice<RT>> {
    const limited = await this.limit_value(val);
    if (limited.err) {
      this.warn(limited.error);
      return limited;
    }
    return this.#set_value(limited.value);
  }

  /**Function to update value*/
  protected async set_value_check(val: RT): Promise<ResultNice<RT>> {
    const checked = await this.check_value(val);
    if (checked.err) {
      this.warn(checked.error);
      return checked;
    }
    return this.#set_value(checked.value);
  }

  /**Shows the value and writes it to the state, a value the state rejects is reverted and warned about.
   * The change listener is only called with accepted values*/
  async #set_value(val: RT): Promise<ResultNice<RT>> {
    //Shown even when unchanged, the shown text can differ, like a typed value rounding to the current value
    this.new_value(val);
    if (this._buffer === val) return ok(val);
    if (this._state) {
      const buff = this._buffer;
      const written = await this._state.write!(val);
      if (written.err) {
        if (buff !== undefined) this.new_value(buff);
        this.warn(written.error);
        return err(written.error);
      }
      this.#changed = true;
    } else {
      this._buffer = val;
      this.#changed = true;
    }
    this.call_change(val);
    return ok(val);
  }

  /**Calls the change listener with a value the user changed, and lets a parent group know*/
  protected call_change(val: RT): void {
    if (this.#change)
      try {
        this.#change(val);
      } catch (e) {
        console.error("Failed while updating change listener", e);
      }
    const parent = this.parentElement;
    if (this.form_id !== undefined && parent instanceof FormValueWrite)
      parent.child_changed(this);
  }

  /**Called when a child value element with a form id was changed by the user*/
  protected child_changed(_child: FormValueWrite<any, any>): void {}
}
