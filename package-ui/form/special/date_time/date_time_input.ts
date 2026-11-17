import { CREATE, define_element, input_key, type InputOptions } from "#base";
import {
  material_calendar_month_rounded,
  material_schedule_rounded,
} from "#icons";
import type { Option } from "@chocbite/ts-lib/result";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import {
  FormValueWrite,
  type FormValueCreateOptions,
  type FormValueWriteOptions,
} from "../../base";
import "./date_time_input.scss";

export const FormDateTimeType = {
  DATE: "date",
  TIME: "time",
  DATETIME: "datetime",
} as const;
export type FormDateTimeType =
  (typeof FormDateTimeType)[keyof typeof FormDateTimeType];

/**Smallest part of the time a date time input shows and enters*/
export const FormDateTimePrecision = {
  MINUTES: "minutes",
  SECONDS: "seconds",
  MILLISECONDS: "milliseconds",
} as const;
export type FormDateTimePrecision =
  (typeof FormDateTimePrecision)[keyof typeof FormDateTimePrecision];

/**Milliseconds of the smallest part of each precision, also the step of the input in seconds times 1000*/
const PRECISION_MS: { [K in FormDateTimePrecision]: number } = {
  minutes: 60000,
  seconds: 1000,
  milliseconds: 1,
};

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

/**Inputs of the date time input*/
const DATE_TIME = {
  /**What is entered, a date, a time or both, both by default, an error keeps the type*/
  type: input_key<StateOrVal<FormDateTimeType>>(),
  /**Smallest part of the time shown and entered, seconds by default, the date type has none
   * The shown value is cut to it, the value itself keeps its precision until the user changes it*/
  precision: input_key<StateOrVal<FormDateTimePrecision>>(),
};
export type FormDateTimeOptions<MODE extends FormDateTimeMode> =
  FormValueWriteOptions<FormDateTimeResult<MODE>> &
    InputOptions<typeof DATE_TIME>;
export type FormDateTimeCreateOptions<
  MODE extends FormDateTimeMode,
  ID extends string | undefined,
> = FormDateTimeOptions<MODE> &
  FormValueCreateOptions<ID> & {
    /**How the value is given and taken, a Date, a string or a number, given at creation as it decides the value*/
    mode: MODE;
  };

/**Date and time input, the mode decides whether the value is a Date, a string or a number*/
class FormDateTime<
  MODE extends FormDateTimeMode = FormDateTimeMode,
  ID extends string | undefined = string | undefined,
> extends FormValueWrite<FormDateTimeResult<MODE>, ID> {
  static element_name() {
    return "datetimeinput";
  }
  static element_name_space(): string {
    return "form";
  }

  #type: FormDateTimeType = FormDateTimeType.DATETIME;
  #mode: MODE = FormDateTimeMode.NUMBER as MODE;
  #precision: FormDateTimePrecision = FormDateTimePrecision.SECONDS;

  constructor() {
    super();
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

  [CREATE](options: { mode?: MODE } & FormValueCreateOptions<ID>): void {
    super[CREATE](options);
    if (options.mode !== undefined) this.#mode = options.mode;
  }

  set(options: FormDateTimeOptions<MODE>): this {
    super.set(options);
    this.set_input(DATE_TIME.type, options.type, (type) => {
      if (!type.ok) return;
      this.#type = type.value;
      this.warn_input.type =
        type.value === FormDateTimeType.DATETIME
          ? "datetime-local"
          : type.value;
      this.#redraw();
    });
    this.set_input(DATE_TIME.precision, options.precision, (precision) => {
      if (!precision.ok) return;
      this.#precision = precision.value;
      this.warn_input.step = String(PRECISION_MS[precision.value] / 1000);
      this.#redraw();
    });
    return this;
  }

  /**Shows the value again, after a change to how it is shown, changing the input type empties it*/
  #redraw() {
    if (this._buffer !== undefined) this.new_value(this._buffer);
  }

  protected new_value(value: FormDateTimeResult<MODE>): void {
    let time: number;
    if (typeof value === "number") time = value;
    else if (typeof value === "string") {
      //Shown as it is, unless it has seconds the precision cuts off
      const cut =
        this.#precision === FormDateTimePrecision.MINUTES &&
        /\d{2}:\d{2}:\d{2}/.test(value);
      if (!cut && INPUT_FORMAT[this.#type].test(value)) {
        this.warn_input.value = value;
        return;
      }
      time = string_wall_time(value);
    } else time = value.getTime() - value.getTimezoneOffset() * 60000;
    const unit = PRECISION_MS[this.#precision];
    this.warn_input.valueAsNumber = time - (time % unit);
  }
  protected clear_value(): void {
    this.warn_input.value = "";
  }

  protected state_related(_related: Option<{}>): void {}
}
define_element(FormDateTime);

export type { FormDateTime };

/**Creates a date time input
 * The mode decides the value, a number is always UTC, a Date and a string are local*/
export function form_date_time<
  MODE extends FormDateTimeMode,
  ID extends string | undefined = undefined,
>(options: FormDateTimeCreateOptions<MODE, ID>): FormDateTime<MODE, ID> {
  //create can not carry the mode type of a generic class, the options are checked by this function
  return FormDateTime.create(options as never) as FormDateTime<MODE, ID>;
}
