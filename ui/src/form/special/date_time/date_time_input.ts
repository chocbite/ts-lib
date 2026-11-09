import { define_element } from "#base";
import {
  material_calendar_month_rounded,
  material_schedule_rounded,
} from "#icons";
import type { Option } from "@chocbite/ts-lib/result";
import { FormValueWrite, FormValueWriteOptions } from "../../base";
import "./date_time_input.scss";

export interface FormDateTimeOptions<
  MODE extends FormDateTimeMode,
  ID extends string | undefined,
> extends FormValueWriteOptions<FormDateTimeResult<MODE>, ID> {
  /**Type of date time*/
  type?: FormDateTimeType;
  /**Value representation used by the input*/
  mode: MODE;
  /**Force show milliseconds even when value is not precise to milliseconds */
  milliseconds?: boolean;
}

export const FormDateTimeType = {
  DATE: "date",
  TIME: "time",
  DATETIME: "datetime",
} as const;
export type FormDateTimeType =
  (typeof FormDateTimeType)[keyof typeof FormDateTimeType];

export const FormDateTimeMode = {
  DATE: "date",
  STRING: "string",
  NUMBER: "number",
} as const;
export type FormDateTimeMode =
  (typeof FormDateTimeMode)[keyof typeof FormDateTimeMode];

const TIME_ONLY = /^\d{2}:\d{2}/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
//Strings the input of each type shows as they are, without milliseconds
const INPUT_FORMAT: { [K in FormDateTimeType]: RegExp } = {
  date: DATE_ONLY,
  time: /^\d{2}:\d{2}(:\d{2})?$/,
  datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
};

/**Returns the wall clock time of a string as UTC milliseconds, like the input uses
 * Time only strings give the time since midnight, strings without time zone are local*/
const string_wall_time = (value: string): number => {
  if (TIME_ONLY.test(value)) return Date.parse("1970-01-01T" + value + "Z");
  //Date only strings are parsed as UTC midnight, which is the wall clock
  if (DATE_ONLY.test(value)) return Date.parse(value);
  const date = new Date(value);
  return date.getTime() - date.getTimezoneOffset() * 60000;
};

type FormDateTimeResult<MODE extends FormDateTimeMode> =
  MODE extends typeof FormDateTimeMode.DATE
    ? Date
    : MODE extends typeof FormDateTimeMode.STRING
      ? string
      : number;

export class FormDateTime<
  MODE extends FormDateTimeMode,
  ID extends string | undefined,
> extends FormValueWrite<FormDateTimeResult<MODE>, ID> {
  static element_name() {
    return "datetimeinput";
  }
  static element_name_space(): string {
    return "form";
  }

  #type: FormDateTimeType = FormDateTimeType.DATETIME;
  #mode: MODE;
  #milliseconds: boolean = false;

  constructor(mode: MODE, id?: ID) {
    super(id);
    this.#mode = mode;
    this.warn_input.onfocus = () => {
      this.selected = true;
    };
    this.warn_input.onblur = () => {
      this.selected = false;
      //Shows a state change that arrived while focused
      if (this._buffer !== undefined) this.new_value(this._buffer);
    };

    this.warn_input.type = "datetime-local";
    this.warn_input.lang = "da-DK";
    this.warn_input.step = "1";
    this.appendChild(this.warn_input);
    this.appendChild(material_calendar_month_rounded()).onclick = () =>
      this.warn_input.showPicker();
    this.appendChild(material_schedule_rounded()).onclick = () =>
      this.warn_input.showPicker();
    this.warn_input.onchange = () => {
      if (this.warn_input.value) {
        if (this.#mode === FormDateTimeMode.DATE) {
          //The input gives the local wall clock as UTC, the offset of the entered date is used
          const wall = new Date(this.warn_input.valueAsNumber);
          const date = new Date(0);
          date.setFullYear(
            wall.getUTCFullYear(),
            wall.getUTCMonth(),
            wall.getUTCDate(),
          );
          date.setHours(
            wall.getUTCHours(),
            wall.getUTCMinutes(),
            wall.getUTCSeconds(),
            wall.getUTCMilliseconds(),
          );
          this.set_value_check(date as FormDateTimeResult<MODE>);
        } else if (this.#mode === FormDateTimeMode.STRING)
          this.set_value_check(
            this.warn_input.value as FormDateTimeResult<MODE>,
          );
        else
          this.set_value_check(
            this.warn_input.valueAsNumber as FormDateTimeResult<MODE>,
          );
      }
    };
  }

  /**Returns the date time type*/
  get type() {
    return this.#type;
  }

  /**Sets the date time type*/
  set type(type: FormDateTimeType) {
    if (type === FormDateTimeType.DATE) this.warn_input.type = "date";
    if (type === FormDateTimeType.TIME) this.warn_input.type = "time";
    if (type === FormDateTimeType.DATETIME)
      this.warn_input.type = "datetime-local";
    this.#type = type;
  }

  /**Returns true if the input is set to show milliseconds*/
  get milliseconds() {
    return this.#milliseconds;
  }

  /**Sets the input to show milliseconds*/
  set milliseconds(value: boolean) {
    this.#milliseconds = value;
    if (value) this.warn_input.step = "0.001";
    else this.warn_input.step = "1";
  }

  /**Returns the date time type*/
  get step() {
    return Number(this.warn_input.step);
  }
  /**Sets the date time type*/
  set step(step: number) {
    this.warn_input.step = String(step);
  }

  protected new_value(value: FormDateTimeResult<MODE>): void {
    let time: number;
    if (typeof value === "number") time = value;
    else if (typeof value === "string") {
      if (INPUT_FORMAT[this.#type].test(value)) {
        this.warn_input.value = value;
        return;
      }
      time = string_wall_time(value);
    } else time = value.getTime() - value.getTimezoneOffset() * 60000;
    this.warn_input.valueAsNumber = this.#milliseconds
      ? time
      : time - (time % 1000);
  }
  protected clear_value(): void {
    this.warn_input.value = "";
  }

  protected new_error(_val: string): void {}

  protected clear_error(): void {}

  protected state_related(_related: Option<{}>): void {}
}
define_element(FormDateTime);

/**Creates a date time input form element
 * Number type is always UTC, Date and String is always local*/
export function form_date_time<
  MODE extends FormDateTimeMode,
  ID extends string | undefined,
>(options: FormDateTimeOptions<MODE, ID>): FormDateTime<MODE, ID> {
  const input = new FormDateTime<MODE, ID>(options.mode, options.id);
  if (options.type) input.type = options.type;
  if (options.milliseconds !== undefined)
    input.milliseconds = options.milliseconds;
  FormValueWrite.apply_options(input, options);
  return input;
}
