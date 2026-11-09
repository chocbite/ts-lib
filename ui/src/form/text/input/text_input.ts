import { define_element } from "#base";
import { sync_resolve } from "@chocbite/ts-lib/common";
import { set_cursor_end } from "#selection";
import { err, none, type Result } from "@chocbite/ts-lib/result";
import type { StateStringRelated } from "@chocbite/ts-lib/state";
import { string_byte_length, string_byte_limit } from "@chocbite/ts-lib/string";
import { FormValueWrite, FormValueWriteOptions } from "../../base";
import "./text_input.scss";

export interface FormTextInputOptions<
  ID extends string | undefined,
  RT = string,
> extends FormValueWriteOptions<RT, ID> {
  /**Placeholder text when input is empty */
  placeholder?: string;
  /**Maximum length of the input */
  max_length?: number;
  /**Maximum bytes of the input */
  max_bytes?: number;
  /**Allowed characters for the text input */
  filter?: RegExp;
}

export class FormTextInput<
  ID extends string | undefined,
> extends FormValueWrite<string, ID> {
  static element_name() {
    return "textinput";
  }
  static element_name_space(): string {
    return "form";
  }

  #filter?: RegExp;
  #max_length?: number;
  #max_bytes?: number;
  //True while the limit comes from the bound state
  #related_length = false;
  #related_bytes = false;

  constructor(id?: ID) {
    super(id);
    this.warn_input.onfocus = () => {
      this.selected = true;
    };
    this.warn_input.onblur = () => {
      this.selected = false;
      //Shows a state change that arrived while focused
      if (this._buffer !== undefined && this.warn_input.value !== this._buffer)
        this.new_value(this._buffer);
    };
    this.warn_input.type = "text";
    this.appendChild(this.warn_input);
    this.warn_input.onchange = () => this.#set();
    this.onbeforeinput = (e) => {
      this.warn("");
      const data = e.data || e.dataTransfer?.getData("text/plain");
      if (data) {
        if (this.#filter) this.#filter.lastIndex = 0;
        if (this.#filter && !this.#filter.test(data)) {
          e.preventDefault();
          this.warn("Invalid character entered");
        } else if (this.#max_length || this.#max_bytes) {
          //The selected text is replaced by the typed text
          const input = this.warn_input;
          const value = input.value;
          const start = input.selectionStart ?? value.length;
          const end = input.selectionEnd ?? start;
          if (
            this.#max_length &&
            value.length - (end - start) + data.length > this.#max_length
          ) {
            e.preventDefault();
            this.warn(`A maximum of ${this.#max_length} characters is allowed`);
          }
          if (
            this.#max_bytes &&
            string_byte_length(value) -
              string_byte_length(value.slice(start, end)) +
              string_byte_length(data) >
              this.#max_bytes
          ) {
            e.preventDefault();
            this.warn(`A maximum of ${this.#max_bytes} bytes is allowed`);
          }
        }
      }
    };
    this.onkeydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (this.buffer) this.new_value(this.buffer);
        else this.clear_value();
      }
    };
  }

  async #set() {
    const buff = this.buffer;
    (await this.set_value_check(this.warn_input.value || "")).map_err(() => {
      this.new_value(buff || "");
      set_cursor_end(this.warn_input);
    });
  }

  set filter(val: RegExp | undefined) {
    this.#filter = val;
  }
  get filter(): RegExp | undefined {
    return this.#filter;
  }

  set placeholder(val: string) {
    this.warn_input.placeholder = val;
  }
  get placeholder(): string {
    return this.warn_input.placeholder;
  }

  set max_length(val: number | undefined) {
    this.#max_length = val;
    if (val === undefined) this.warn_input.removeAttribute("maxlength");
    else this.warn_input.maxLength = val;
  }
  get max_length(): number | undefined {
    return this.#max_length;
  }

  set max_bytes(val: number | undefined) {
    this.#max_bytes = val;
  }
  get max_bytes(): number | undefined {
    return this.#max_bytes;
  }

  protected new_value(val: string): void {
    this.warn_input.value = val;
  }

  protected clear_value(): void {
    this.warn_input.value = "";
  }

  protected new_error(_val: string): void {}

  protected clear_error(): void {}

  protected limit_value(val: string): PromiseLike<Result<string, string>> {
    if (this.#max_length && val.length > this.#max_length)
      val = val.slice(0, this.#max_length);
    if (this.#max_bytes) val = string_byte_limit(val, this.#max_bytes);
    return super.limit_value(val);
  }

  protected check_value(val: string): PromiseLike<Result<string, string>> {
    if (this.#max_length && val.length > this.#max_length)
      return sync_resolve(
        err(`A maximum of ${this.#max_length} characters is allowed`),
      );
    if (this.#max_bytes && string_byte_length(val) > this.#max_bytes)
      return sync_resolve(
        err(`A maximum of ${this.#max_bytes} bytes is allowed`),
      );
    return super.check_value(val);
  }

  protected state_related(related: Partial<StateStringRelated>): void {
    if (related.max_length)
      this.attach_state_to_prop("max_length", related.max_length, () => none());
    else if (this.#related_length)
      this.detach_state_from_prop("max_length").max_length = undefined;
    this.#related_length = !!related.max_length;
    if (related.max_length_bytes)
      this.attach_state_to_prop("max_bytes", related.max_length_bytes, () =>
        none(),
      );
    else if (this.#related_bytes)
      this.detach_state_from_prop("max_bytes").max_bytes = undefined;
    this.#related_bytes = !!related.max_length_bytes;
  }
}
define_element(FormTextInput);

/**Creates a single line text input form element */
export function form_text_input<ID extends string | undefined>(
  options?: FormTextInputOptions<ID>,
): FormTextInput<ID> {
  const input = new FormTextInput<ID>(options?.id);
  if (options) {
    if (options.filter) input.filter = options.filter;
    if (options.placeholder) input.placeholder = options.placeholder;
    if (options.max_length) input.max_length = options.max_length;
    if (options.max_bytes) input.max_bytes = options.max_bytes;
    FormValueWrite.apply_options(input, options);
  }
  return input;
}
