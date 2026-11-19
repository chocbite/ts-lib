import { define_element, input_key, type InputOptions } from "#base";
import { sync_resolve } from "@chocbite/ts-lib/common";
import { set_cursor_end } from "#selection";
import { err_nice, type ResultNice } from "@chocbite/ts-lib/result";
import {
  state,
  type StateOrVal,
  type StateStringRelated,
} from "@chocbite/ts-lib/state";
import { string_byte_length, string_byte_limit } from "@chocbite/ts-lib/string";
import {
  FormSetting,
  FormValueWrite,
  type FormValueCreateOptions,
  type FormValueWriteOptions,
} from "../../base";
import "./text_input.scss";

/**Inputs of the single line text input*/
const TEXT_INPUT = {
  /**Text shown while the input is empty, an error shows its nice text*/
  placeholder: input_key<StateOrVal<string>>(),
  /**Most characters the text can have, 0 for no limit, not given the limit of the value state is used*/
  max_length: input_key<StateOrVal<number>>(),
  /**Most bytes the text can have, 0 for no limit, not given the limit of the value state is used*/
  max_bytes: input_key<StateOrVal<number>>(),
  /**Characters the user can type, others are refused with a warning*/
  filter: input_key<RegExp>(),
};
/**Related limits of the value state, followed while the inputs are not given*/
const TEXT_INPUT_RELATED = {
  max_length: input_key<StateOrVal<number | null>>(),
  max_bytes: input_key<StateOrVal<number | null>>(),
};
export type FormTextInputOptions = FormValueWriteOptions<string> &
  InputOptions<typeof TEXT_INPUT>;
export type FormTextInputCreateOptions<ID extends string | undefined> =
  FormTextInputOptions & FormValueCreateOptions<ID>;

class FormTextInput<
  ID extends string | undefined = string | undefined,
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
  #length = new FormSetting<number>((max) => {
    this.#max_length = max || undefined;
    if (max) this.warn_input.maxLength = max;
    else this.warn_input.removeAttribute("maxlength");
  });
  #bytes = new FormSetting<number>((max) => {
    this.#max_bytes = max || undefined;
  });

  constructor() {
    super();
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
        //With nothing typed to revert, escape is left to parents, like a prompt closing
        if (this.warn_input.value === (this.buffer ?? "")) return;
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

  set(options: FormTextInputOptions): this {
    super.set(options);
    this.set_input(TEXT_INPUT.placeholder, options.placeholder, (text) => {
      this.warn_input.placeholder = text.ok ? text.value : text.error.nice;
    });
    this.set_input(TEXT_INPUT.max_length, options.max_length, (max) =>
      this.#length.input(max.ok ? max.value : undefined),
    );
    this.set_input(TEXT_INPUT.max_bytes, options.max_bytes, (max) =>
      this.#bytes.input(max.ok ? max.value : undefined),
    );
    this.set_input(TEXT_INPUT.filter, options.filter, (filter) => {
      this.#filter = filter.value;
    });
    return this;
  }

  protected new_value(val: string): void {
    this.warn_input.value = val;
  }

  protected clear_value(): void {
    this.warn_input.value = "";
  }

  protected limit_value(val: string): PromiseLike<ResultNice<string>> {
    if (this.#max_length && val.length > this.#max_length)
      val = val.slice(0, this.#max_length);
    if (this.#max_bytes) val = string_byte_limit(val, this.#max_bytes);
    return super.limit_value(val);
  }

  protected check_value(val: string): PromiseLike<ResultNice<string>> {
    if (this.#max_length && val.length > this.#max_length)
      return sync_resolve(
        err_nice(
          state.errors.TEXT_TOO_LONG,
          `A maximum of ${this.#max_length} characters is allowed`,
        ),
      );
    if (this.#max_bytes && string_byte_length(val) > this.#max_bytes)
      return sync_resolve(
        err_nice(
          state.errors.TEXT_TOO_LONG,
          `A maximum of ${this.#max_bytes} bytes is allowed`,
        ),
      );
    return super.check_value(val);
  }

  protected state_related(related: Partial<StateStringRelated>): void {
    this.follow_related(
      TEXT_INPUT_RELATED.max_length,
      related.max_length,
      (max) => this.#length.related(max),
    );
    this.follow_related(
      TEXT_INPUT_RELATED.max_bytes,
      related.max_length_bytes,
      (max) => this.#bytes.related(max),
    );
  }
}
define_element(FormTextInput);

export type { FormTextInput };

/**Creates a single line text input
 * An initial value is where it starts, a writable state is written when the user changes the text, a read only state is only shown*/
export function form_text_input<ID extends string | undefined = undefined>(
  options: FormTextInputCreateOptions<ID> = {},
): FormTextInput<ID> {
  return FormTextInput.create(options) as FormTextInput<ID>;
}
