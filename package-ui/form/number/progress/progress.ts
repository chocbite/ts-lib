import { define_element, input_key, type InputOptions } from "#base";
import type { StateNumberRelated, StateOrVal } from "@chocbite/ts-lib/state";
import {
  FormSetting,
  FormValue,
  type FormValueCreateOptions,
  type FormValueOptions,
} from "../../base";
import "./progress.scss";

/**Inputs of the progress bar, not given the related value of the value state is used*/
const PROGRESS = {
  /**Value of an empty bar, 0 by default*/
  min: input_key<StateOrVal<number>>(),
  /**Value of a full bar, 100 by default*/
  max: input_key<StateOrVal<number>>(),
  /**Decimals shown, 0 by default*/
  decimals: input_key<StateOrVal<number>>(),
  /**Unit shown after the value*/
  unit: input_key<StateOrVal<string>>(),
};
const PROGRESS_RELATED = {
  min: input_key<StateOrVal<number | null>>(),
  max: input_key<StateOrVal<number | null>>(),
  decimals: input_key<StateOrVal<number | null>>(),
  unit: input_key<StateOrVal<string | null>>(),
};
export type FormProgressOptions = FormValueOptions<number> &
  InputOptions<typeof PROGRESS>;
export type FormProgressCreateOptions<ID extends string | undefined> =
  FormProgressOptions & FormValueCreateOptions<ID>;

/**Progress bar showing a number, only shows, the user can not change it*/
class FormProgress<
  ID extends string | undefined = string | undefined,
> extends FormValue<number, ID> {
  static element_name() {
    return "progress";
  }
  static element_name_space(): string {
    return "form";
  }

  #min_value: number = 0;
  #max_value: number = 100;
  #decimals_value: number = 0;
  #bar: HTMLDivElement = this.appendChild(document.createElement("div"));
  #val: HTMLSpanElement = this.appendChild(document.createElement("span"));
  #unit_box: HTMLSpanElement = this.appendChild(document.createElement("span"));
  #min = new FormSetting<number>((min) => {
    this.#min_value = min ?? 0;
    this.#redraw();
  });
  #max = new FormSetting<number>((max) => {
    this.#max_value = max ?? 100;
    this.#redraw();
  });
  #decimals = new FormSetting<number>((dec) => {
    this.#decimals_value = Math.max(dec ?? 0, 0);
    this.#redraw();
  });
  #unit = new FormSetting<string>((unit) => {
    this.#unit_box.textContent = unit ?? "";
  });

  set(options: FormProgressOptions): this {
    super.set(options);
    this.set_input(PROGRESS.min, options.min, (r) =>
      this.#min.input(r.ok ? r.value : undefined),
    );
    this.set_input(PROGRESS.max, options.max, (r) =>
      this.#max.input(r.ok ? r.value : undefined),
    );
    this.set_input(PROGRESS.decimals, options.decimals, (r) =>
      this.#decimals.input(r.ok ? r.value : undefined),
    );
    this.set_input(PROGRESS.unit, options.unit, (r) =>
      this.#unit.input(r.ok ? r.value : undefined),
    );
    return this;
  }

  /**Shows the value again, after a change to how it is shown*/
  #redraw(): void {
    if (this._buffer !== undefined) this.new_value(this._buffer);
  }

  protected new_value(value: number): void {
    const span = this.#max_value - this.#min_value;
    this.#bar.style.width =
      Math.min(Math.max(((value - this.#min_value) / span) * 100, 0), 100) +
      "%";
    this.#val.textContent = value.toFixed(this.#decimals_value);
  }

  protected clear_value(): void {
    this.#bar.style.width = "0%";
    this.#val.textContent = "";
  }

  protected state_related(related: Partial<StateNumberRelated>): void {
    this.follow_related(PROGRESS_RELATED.min, related.min, (v) =>
      this.#min.related(v),
    );
    this.follow_related(PROGRESS_RELATED.max, related.max, (v) =>
      this.#max.related(v),
    );
    this.follow_related(PROGRESS_RELATED.decimals, related.decimals, (v) =>
      this.#decimals.related(v),
    );
    this.follow_related(PROGRESS_RELATED.unit, related.unit, (v) =>
      this.#unit.related(v),
    );
  }
}
define_element(FormProgress);

export type { FormProgress };

/**Creates a progress bar showing a number*/
export function form_progress<ID extends string | undefined = undefined>(
  options: FormProgressCreateOptions<ID> = {},
): FormProgress<ID> {
  return FormProgress.create(options) as FormProgress<ID>;
}
