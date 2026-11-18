import { define_element, input_key, type InputOptions } from "#base";
import { sync_resolve } from "@chocbite/ts-lib/common";
import { set_cursor_end } from "#selection";
import { material_drag_handle_rounded } from "#icons";
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
import "./text_multi_line.scss";

/**Inputs of the multi line text input*/
const TEXT_MULTILINE = {
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
const TEXT_MULTILINE_RELATED = {
  max_length: input_key<StateOrVal<number | null>>(),
  max_bytes: input_key<StateOrVal<number | null>>(),
};
export type FormTextMultilineOptions = FormValueWriteOptions<string> &
  InputOptions<typeof TEXT_MULTILINE>;
export type FormTextMultilineCreateOptions<ID extends string | undefined> =
  FormTextMultilineOptions & FormValueCreateOptions<ID>;

class FormTextMultiline<
  ID extends string | undefined = string | undefined,
> extends FormValueWrite<string, ID> {
  static element_name() {
    return "textmultiline";
  }
  static element_name_space(): string {
    return "form";
  }

  #filter?: RegExp;
  #max_length?: number;
  #max_bytes?: number;
  #length = new FormSetting<number>((max) => {
    this.#max_length = max || undefined;
    if (max) this.#value_box.maxLength = max;
    else this.#value_box.removeAttribute("maxlength");
  });
  #bytes = new FormSetting<number>((max) => {
    this.#max_bytes = max || undefined;
  });
  #value_box: HTMLTextAreaElement = this.appendChild(
    document.createElement("textarea"),
  );
  #resizer: HTMLDivElement = this.appendChild(document.createElement("div"));

  constructor() {
    super();
    this.#value_box.onfocus = () => {
      this.selected = true;
    };
    this.#value_box.onblur = () => {
      this.selected = false;
      //Shows a state change that arrived while focused
      if (this._buffer !== undefined && this.#value_box.value !== this._buffer)
        this.new_value(this._buffer);
    };
    this.appendChild(this.warn_input);
    this.#resizer.appendChild(material_drag_handle_rounded());
    this.#resizer.onpointerdown = (e) => {
      e.preventDefault();
      const height = this.#value_box.getBoundingClientRect().height;
      const start_y = e.clientY;
      this.#resizer.setPointerCapture(e.pointerId);
      this.#resizer.onpointermove = (ev) => {
        const dy = ev.clientY - start_y;
        this.#value_box.style.height = `${height + dy}px`;
      };
      this.#resizer.onpointerup = (_ev) => {
        this.#resizer.releasePointerCapture(e.pointerId);
        this.#resizer.onpointermove = null;
        this.#resizer.onpointerup = null;
      };
    };
    this.#value_box.onchange = () => this.#set();
    this.#value_box.onbeforeinput = (e) => {
      this.warn("");
      const data = e.data || e.dataTransfer?.getData("text/plain");
      if (data) {
        if (this.#filter) this.#filter.lastIndex = 0;
        if (this.#filter && !this.#filter.test(data)) {
          e.preventDefault();
          this.warn("Invalid character entered");
        } else if (this.#max_length || this.#max_bytes) {
          //The selected text is replaced by the typed text
          const box = this.#value_box;
          const value = box.value;
          const start = box.selectionStart;
          const end = box.selectionEnd;
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
    this.#value_box.onkeydown = (e) => {
      if (e.key === "Escape") {
        //With nothing typed to revert, escape is left to parents, like a prompt closing
        if (this.#value_box.value === (this.buffer ?? "")) return;
        e.preventDefault();
        e.stopPropagation();
        if (this.buffer) this.new_value(this.buffer);
        else this.clear_value();
      } else if (e.key === "Enter") {
        //Enter is a new line, it must not reach parent elements
        if (!e.shiftKey) e.stopPropagation();
        if (e.ctrlKey) {
          e.preventDefault();
          this.#set();
        }
      }
    };
  }

  focus(options?: FocusOptions): void {
    this.#value_box.focus(options);
  }

  async #set() {
    const buff = this.buffer;
    (await this.set_value_check(this.#value_box.value || "")).map_err(() => {
      this.new_value(buff || "");
      set_cursor_end(this.#value_box);
    });
  }

  set(options: FormTextMultilineOptions): this {
    super.set(options);
    this.set_input(TEXT_MULTILINE.placeholder, options.placeholder, (text) => {
      this.#value_box.placeholder = text.ok ? text.value : text.error.nice;
    });
    this.set_input(TEXT_MULTILINE.max_length, options.max_length, (max) =>
      this.#length.input(max.ok ? max.value : undefined),
    );
    this.set_input(TEXT_MULTILINE.max_bytes, options.max_bytes, (max) =>
      this.#bytes.input(max.ok ? max.value : undefined),
    );
    this.set_input(TEXT_MULTILINE.filter, options.filter, (filter) => {
      this.#filter = filter.value;
    });
    return this;
  }

  protected new_value(val: string): void {
    this.#value_box.value = val;
  }

  protected clear_value(): void {
    this.#value_box.value = "";
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
      TEXT_MULTILINE_RELATED.max_length,
      related.max_length,
      (max) => this.#length.related(max),
    );
    this.follow_related(
      TEXT_MULTILINE_RELATED.max_bytes,
      related.max_length_bytes,
      (max) => this.#bytes.related(max),
    );
  }
}
define_element(FormTextMultiline);

export type { FormTextMultiline };

/**Creates a multi line text input
 * An initial value is where it starts, a writable state is written when the user changes the text, a read only state is only shown*/
export function form_text_multiline<ID extends string | undefined = undefined>(
  options: FormTextMultilineCreateOptions<ID> = {},
): FormTextMultiline<ID> {
  return FormTextMultiline.create(options) as FormTextMultiline<ID>;
}
