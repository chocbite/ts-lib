import { Base } from "#base";
import { sync_resolve } from "@chocbite/ts-lib/common";
import { err, ok, type Option, type Result } from "@chocbite/ts-lib/result";
import type { State, StateREAW, StateSub } from "@chocbite/ts-lib/state";
import "./shared";

export interface FormOptions {}

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

  static apply_options(_element: FormElement, _options: FormOptions) {}
}

//##################################################################################################
//     __      __     _     _    _ ______   _____  ______          _____
//     \ \    / /\   | |   | |  | |  ____| |  __ \|  ____|   /\   |  __ \
//      \ \  / /  \  | |   | |  | | |__    | |__) | |__     /  \  | |  | |
//       \ \/ / /\ \ | |   | |  | |  __|   |  _  /|  __|   / /\ \ | |  | |
//        \  / ____ \| |___| |__| | |____  | | \ \| |____ / ____ \| |__| |
//         \/_/    \_\______\____/|______| |_|  \_\______/_/    \_\_____/

export interface FormValueOptions<
  RT,
  ID extends string | undefined,
> extends FormOptions {
  /**ID form form element */
  id?: ID;
  /**Value for form element */
  value?: RT;
  /**Longer description what form element does */
  description?: string;
}

/**Shared class for all components with values*/
export abstract class FormValue<
  RT,
  ID extends string | undefined,
> extends FormElement {
  static element_name() {
    return "@abstract@";
  }

  static apply_options<RT, ID extends string | undefined>(
    element: FormValue<RT, ID>,
    options: FormValueOptions<RT, ID>,
  ) {
    if (options.description) element.description = options.description;
    else if (options.value !== undefined) element.value = options.value;
    super.apply_options(element, options);
  }

  readonly form_id: ID;

  constructor(id?: ID) {
    super();
    this.form_id = id as ID;
  }

  protected _description?: string;
  /**Sets the current label of the element*/
  set description(text: string) {
    this._description = text;
  }
  get description(): string {
    return this._description || "";
  }

  protected _buffer?: RT;
  get buffer(): RT | undefined {
    return this._buffer;
  }

  protected _state?: State<RT, Option<{}>, RT>;
  #func?: StateSub<Result<RT, string>>;

  bind(opts: { value: StateREAW<RT, Option<{}>, RT> }): this {
    if (this.#func) this.detach_state(this.#func);
    if (opts.value) {
      this.attach_state(opts.value, (val) => {
        if (val.ok) {
          this.value = val.value;
          if (this.#error) this.error = undefined;
        } else this.error = val.error;
      });
      const related = opts.value.related();
      if (related.some) this.state_related(related.value);
    } else this.state_related({});
    this._state = opts.value;

    return this;
  }

  /**This sets the value of the component*/
  set value(val: RT) {
    if (typeof this._buffer !== "undefined" && this._buffer === val) return;
    this._buffer = val;
    this.new_value(val);
  }

  /**Returns value of the component*/
  get get_value(): Result<RT, string> {
    return this._state
      ? err("State based component")
      : typeof this._buffer === "undefined"
        ? err("No value yet")
        : ok(this._buffer);
  }

  #error = false;
  set error(err: string | undefined) {
    if (err) {
      this.new_error(err);
      this.#error = true;
    } else if (this.#error) {
      this.clear_error();
      this.#error = false;
    }
  }

  /**Clears the value and error of the component if not state based*/
  clear(): void {
    if (this._state) return;
    this._buffer = undefined;
    this.clear_value();
    this.clear_error();
  }

  /**Called when value is set by value setter or state*/
  protected abstract new_value(val: RT): void;

  /**Clears form element graphically*/
  protected abstract clear_value(): void;

  /**Called when error is set by error or state*/
  protected abstract new_error(val: string): void;

  /**Called when error is cleared by error or state*/
  protected abstract clear_error(): void;

  /**Called when state has related information */
  protected abstract state_related(related: {}): void;
}

//##################################################################################################
//     __      __     _     _    _ ______  __          _______  _____ _______ ______
//     \ \    / /\   | |   | |  | |  ____| \ \        / /  __ \|_   _|__   __|  ____|
//      \ \  / /  \  | |   | |  | | |__     \ \  /\  / /| |__) | | |    | |  | |__
//       \ \/ / /\ \ | |   | |  | |  __|     \ \/  \/ / |  _  /  | |    | |  |  __|
//        \  / ____ \| |___| |__| | |____     \  /\  /  | | \ \ _| |_   | |  | |____
//         \/_/    \_\______\____/|______|     \/  \/   |_|  \_\_____|  |_|  |______|

export interface FormValueWriteOptions<
  RT,
  ID extends string | undefined,
> extends FormValueOptions<RT, ID> {
  /**Change listener function*/
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

  static apply_options<RT, ID extends string | undefined>(
    element: FormValueWrite<RT, ID>,
    options: FormValueWriteOptions<RT, ID>,
  ) {
    if (options.change) element.change = options.change;
    super.apply_options(element, options);
  }

  constructor(id?: ID) {
    super(id);
    this.warn_input.name = "val";
  }

  focus(options?: FocusOptions): void {
    this.warn_input.focus(options);
  }

  set change(func: (val: RT) => void) {
    this.#change = func;
  }
  get change(): ((val: RT) => void) | undefined {
    return this.#change;
  }

  /**Returns true if the value of the component has changed*/
  get changed(): boolean {
    return this.#changed;
  }

  set value(val: RT) {
    if (!this.selected) super.value = val;
    else this._buffer = val;
  }

  warn(message: string): void {
    this.warn_input.setCustomValidity(message);
    this.warn_input.reportValidity();
    if (this.#warn_timeout) clearTimeout(this.#warn_timeout);
    this.#warn_timeout = setTimeout(() => {
      this.warn_input.setCustomValidity("");
      this.warn_input.reportValidity();
    }, 5000);
  }

  /**Function to limit value entered */
  protected limit_value(val: RT): PromiseLike<Result<RT, string>> {
    if (this._state) {
      if (this._state.writable) return this._state.limit(val);
      else return sync_resolve(err("Not writable"));
    } else return sync_resolve(ok(val));
  }

  /**Function to check value */
  protected check_value(val: RT): PromiseLike<Result<RT, string>> {
    if (this._state) {
      if (this._state.writable) return this._state.check(val);
      else return sync_resolve(err("Not writable"));
    } else return sync_resolve(ok(val));
  }

  /**Function to update value*/
  protected async set_value_limit(val: RT): Promise<Result<RT, string>> {
    const limited = await this.limit_value(val);
    if (limited.err) {
      this.warn(limited.error);
      return limited;
    }
    this.#set_value(limited.value);
    return limited;
  }

  /**Function to update value*/
  protected async set_value_check(val: RT): Promise<Result<RT, string>> {
    const checked = await this.check_value(val);
    if (checked.err) {
      this.warn(checked.error);
      return checked;
    }
    this.#set_value(checked.value);
    return checked;
  }

  #set_value(val: RT) {
    if (this._buffer === val) return;
    this.new_value(val);
    if (this._state) {
      const buff = this._buffer;
      this._state.write!(val).then((err) => {
        if (err.err) {
          if (buff !== undefined) this.new_value(buff);
          this.warn(err.error);
        }
      });
    } else {
      this._buffer = val;
      this.#changed = true;
    }
    if (this.#change)
      try {
        this.#change(val);
      } catch (e) {
        console.error("Failed while updating change listener", e);
      }
  }
}
