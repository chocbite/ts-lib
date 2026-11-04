import { define_element } from "#base";
import { sync_resolve } from "@chocbite/ts-lib/common";
import { set_cursor_end } from "#selection";
import { material_drag_handle_rounded } from "#icons";
import { err, none, type Result } from "@chocbite/ts-lib/result";
import type { StateStringRelated } from "@chocbite/ts-lib/state";
import { string_byte_length, string_byte_limit } from "@chocbite/ts-lib/string";
import { FormValueWrite, FormValueWriteOptions } from "../../base";
import "./text_multi_line.scss";

export interface FormTextMultilineOptions<
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

export class FormTextMultiline<
  ID extends string | undefined,
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
  #value_box: HTMLTextAreaElement = this.appendChild(
    document.createElement("textarea"),
  );
  #resizer: HTMLDivElement = this.appendChild(document.createElement("div"));

  constructor(id?: ID) {
    super(id);
    this.#value_box.onfocus = () => {
      this.selected = true;
    };
    this.#value_box.onblur = () => {
      this.selected = false;
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
    this.#value_box.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.stopPropagation();
      }
    };
    this.#value_box.onchange = () => this.#set();
    this.#value_box.onbeforeinput = (e) => {
      this.warn("");
      const data = e.data || e.dataTransfer?.getData("text/plain");
      if (data) {
        if (this.#filter && !this.#filter.test(data)) {
          e.preventDefault();
          this.warn("Invalid character entered");
        } else {
          if (
            this.#max_length &&
            this.#value_box.value.length + data.length > this.#max_length
          ) {
            e.preventDefault();
            this.warn(`A maximum of ${this.#max_length} characters is allowed`);
          }
          if (
            this.#max_bytes &&
            string_byte_length(this.#value_box.value) +
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
        e.preventDefault();
        e.stopPropagation();
        if (this.buffer) this.new_value(this.buffer);
        else this.clear_value();
      } else if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        this.#set();
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

  set filter(val: RegExp | undefined) {
    this.#filter = val;
  }
  get filter(): RegExp | undefined {
    return this.#filter;
  }

  set placeholder(val: string) {
    this.#value_box.placeholder = val;
  }
  get placeholder(): string {
    return this.#value_box.placeholder;
  }

  set max_length(val: number | undefined) {
    this.#max_length = val;
    this.#value_box.maxLength = val ?? -1;
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
    this.#value_box.value = val;
  }

  protected clear_value(): void {
    this.#value_box.value = "";
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
    else this.detach_state_from_prop("max_length");
    if (related.max_length_bytes)
      this.attach_state_to_prop("max_bytes", related.max_length_bytes, () =>
        none(),
      );
    else this.detach_state_from_prop("max_bytes");
  }
}
define_element(FormTextMultiline);

/**Creates a multi line text input form element */
export function form_text_multiline<ID extends string | undefined>(
  options?: FormTextMultilineOptions<ID>,
): FormTextMultiline<ID> {
  const input = new FormTextMultiline<ID>(options?.id);
  if (options) {
    if (options.placeholder) input.placeholder = options.placeholder;
    if (options.max_length) input.max_length = options.max_length;
    if (options.max_bytes) input.max_bytes = options.max_bytes;
    FormValueWrite.apply_options(input, options);
  }
  return input;
}
