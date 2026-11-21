import { define_element } from "#base";
import { KeyboardBase } from "./base";
import "./keyboard_datetime.scss";

/**The input types of the date and time keyboard, a keyboard is for one of them*/
export type DateTimeInputType =
  "date" | "datetime-local" | "month" | "time" | "week";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/**Hours shown at a time, and the last group of them*/
const HOURS = 4;
const LAST_HOUR_GROUP = 24 / HOURS - 1;
/**Minutes shown at a time, and the last group of them*/
const MINUTES = 10;
const LAST_MINUTE_GROUP = 60 / MINUTES - 1;
/**Years shown at a time in the year layer*/
const YEARS = 12;
/**The years an input takes, 4 digits*/
const FIRST_YEAR = 1;
const LAST_YEAR = 9999;

const pad = (value: number, length = 2) =>
  value.toString().padStart(length, "0");

function date_value(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function date_from_value(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return date_value(date) === match[0] ? date : undefined;
}

/**Date to show for the value of an input of the given type*/
function view_from_value(value: string, type: string): Date | undefined {
  if (type === "month") {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) return undefined;
    return new Date(Number(match[1]), Number(match[2]) - 1, 1);
  }
  if (type === "week") {
    const match = /^(\d{4})-W(\d{2})$/.exec(value);
    if (!match) return undefined;
    //The 4th of january is always in week 1, the week starts on monday
    const date = new Date(Number(match[1]), 0, 4);
    date.setDate(
      date.getDate() - ((date.getDay() + 6) % 7) + (Number(match[2]) - 1) * 7,
    );
    return date;
  }
  return date_from_value(value);
}

function week_value(date: Date): string {
  const utc = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const year = utc.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(
    ((utc.getTime() - start.getTime()) / 86400000 + 1) / 7,
  );
  return `${year}-W${pad(week)}`;
}

function div(class_name?: string): HTMLDivElement {
  const element = document.createElement("div");
  if (class_name) element.className = class_name;
  return element;
}

function button(
  text: string,
  click: () => void,
  class_name?: string,
): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = text;
  if (class_name) element.className = class_name;
  element.addEventListener("click", click);
  return element;
}

/**The keyboard of a date or time input, one keyboard per input type, opening only for inputs of its type
 * The buttons are made once, opening and moving between months or hours only changes their text and state*/
export class Keyboard_DateTime extends KeyboardBase {
  static element_name(): string {
    return "keyboard-datetime";
  }
  static element_name_space(): string {
    return "onscreen-keyboard";
  }

  readonly #type: DateTimeInputType;
  #input?: HTMLInputElement;
  /**Checks a value against the min, max and step of the input, one input instead of one per check*/
  readonly #check = document.createElement("input");
  #changed = false;
  /**The month shown, or the year for month inputs, its first day*/
  #view = new Date();
  /**The date chosen for a datetime-local input, written with the time on submit*/
  #chosen?: Date;
  #hour = 0;
  #minute = 0;
  #hour_group = 0;
  #minute_group = 0;

  /**The month or year shown, opens the year layer*/
  readonly #title = button(
    "",
    () => this.#show_year_layer(true),
    "keyboard-datetime-title",
  );
  /**The picker of the type and the year layer in its place, for the types with a year*/
  #picker?: HTMLElement;
  #year_layer?: HTMLElement;
  /**The years shown in the year layer, goes back to the picker*/
  readonly #year_title = button(
    "",
    () => this.#show_year_layer(false),
    "keyboard-datetime-title",
  );
  readonly #years: HTMLButtonElement[] = [];
  /**The first year shown in the year layer*/
  #year_start = 0;
  readonly #days: HTMLButtonElement[] = [];
  /**The date of every day button*/
  readonly #day_dates: Date[] = [];
  readonly #weeks: {
    button: HTMLButtonElement;
    dates: HTMLSpanElement[];
  }[] = [];
  /**The value of every week button*/
  readonly #week_values: string[] = [];
  readonly #months: HTMLButtonElement[] = [];
  readonly #hour_label = document.createElement("strong");
  readonly #hours: HTMLButtonElement[] = [];
  readonly #minute_label = document.createElement("strong");
  readonly #minutes: HTMLButtonElement[] = [];
  /**The datetime-local keyboard, the date and the time side by side, or one at a time by tabs on a narrow screen*/
  #local?: HTMLElement;
  readonly #date_tab = button("", () => this.#show_tab("date"));
  readonly #time_tab = button("", () => this.#show_tab("time"));

  constructor(type: DateTimeInputType) {
    super();
    this.#type = type;
    this.#check.type = type;
    this.classList.add("keyboard-datetime");
    this.addEventListener("mousedown", (event) => event.preventDefault());
    const container = div(
      type === "datetime-local" ? "keyboard-datetime-local" : undefined,
    );
    if (type !== "time")
      container.append(
        this.#build_with_years(
          type === "month"
            ? this.#build_months()
            : type === "week"
              ? this.#build_weeks()
              : this.#build_calendar(),
        ),
      );
    if (type === "time" || type === "datetime-local")
      container.append(this.#build_time());
    if (type === "datetime-local") {
      const tabs = div("keyboard-datetime-tabs");
      tabs.append(this.#date_tab, this.#time_tab);
      container.prepend(tabs);
      this.#local = container;
    }
    this.append(container);
  }

  open(element: HTMLElement): void {
    if (!(element instanceof HTMLInputElement) || element.type !== this.#type)
      return;
    this.#input = element;
    this.#check.min = element.min;
    this.#check.max = element.max;
    this.#check.step = element.step;
    this.#view = view_from_value(element.value, this.#type) ?? new Date();
    this.#view.setDate(1);
    this.#chosen =
      this.#type === "datetime-local"
        ? date_from_value(element.value)
        : undefined;
    const time = /T?(\d{2}):(\d{2})/.exec(element.value) ?? [];
    this.#hour = Number(time[1] ?? 0);
    this.#minute = Number(time[2] ?? 0);
    this.#hour_group = Math.floor(this.#hour / HOURS);
    this.#minute_group = Math.floor(this.#minute / MINUTES);
    this.#changed = false;
    this.#show_year_layer(false);
    this.#show_view();
    if (this.#hours.length) {
      this.#show_hours();
      this.#show_minutes();
    }
    if (this.#local) {
      this.#show_tab("date");
      this.#show_tab_values();
    }
    super.open(element);
  }

  close(): void {
    if (this.elem && this.#changed)
      this.elem.dispatchEvent(new Event("change", { bubbles: true }));
    this.#input = undefined;
    this.#chosen = undefined;
    this.#changed = false;
    super.close();
  }

  //      ____  _    _ _____ _      _____
  //     |  _ \| |  | |_   _| |    |  __ \
  //     | |_) | |  | | | | | |    | |  | |
  //     |  _ <| |  | | | | | |    | |  | |
  //     | |_) | |__| |_| |_| |____| |__| |
  //     |____/ \____/|_____|______|_____/
  /**Previous, the title, next and close*/
  #header(title: HTMLElement, move: (offset: number) => void): HTMLElement {
    const header = div("keyboard-datetime-header");
    header.append(
      button("‹", () => move(-1)),
      title,
      button("›", () => move(1)),
      button("🗙", () => this.close()),
    );
    return header;
  }

  #build_calendar(): HTMLElement {
    const calendar = div("keyboard-datetime-calendar");
    for (const day of WEEKDAYS)
      calendar.append(
        Object.assign(document.createElement("span"), { textContent: day }),
      );
    for (let index = 0; index < 42; index++) {
      const day = button("", () => this.#select_date(this.#day_dates[index]));
      this.#days.push(day);
      calendar.append(day);
    }
    const picker = div();
    picker.append(
      this.#header(this.#title, (offset) => this.#move_month(offset)),
      calendar,
    );
    return picker;
  }

  #build_weeks(): HTMLElement {
    const weeks = div("keyboard-datetime-weeks");
    for (let index = 0; index < 6; index++) {
      const week = button("", () => {
        this.#set_value(this.#week_values[index]);
        this.close();
      });
      const dates = div("keyboard-datetime-week-dates");
      const spans: HTMLSpanElement[] = [];
      for (let day = 0; day < 7; day++)
        spans.push(dates.appendChild(document.createElement("span")));
      this.#weeks.push({ button: week, dates: spans });
      const row = div("keyboard-datetime-week");
      row.append(week, dates);
      weeks.append(row);
    }
    const picker = div();
    picker.append(
      this.#header(this.#title, (offset) => this.#move_month(offset)),
      weeks,
    );
    return picker;
  }

  #build_months(): HTMLElement {
    const months = div("keyboard-datetime-months");
    MONTHS.forEach((month, index) => {
      const choice = button(month.slice(0, 3), () => {
        this.#set_value(this.#month_value(index));
        this.close();
      });
      this.#months.push(choice);
      months.append(choice);
    });
    const picker = div();
    picker.append(
      this.#header(this.#title, (offset) => this.#move_year(offset)),
      months,
    );
    return picker;
  }

  /**The picker with the year layer in the same place, one of them shown*/
  #build_with_years(picker: HTMLElement): HTMLElement {
    const years = div("keyboard-datetime-years");
    for (let index = 0; index < YEARS; index++) {
      const year = button("", () => {
        this.#view.setFullYear(
          this.#year_start + index,
          this.#view.getMonth(),
          1,
        );
        this.#show_year_layer(false);
        this.#show_view();
      });
      this.#years.push(year);
      years.append(year);
    }
    const layer = div("keyboard-datetime-layer keyboard-datetime-year-layer");
    layer.append(
      this.#header(this.#year_title, (offset) => {
        this.#year_start = Math.max(
          0,
          Math.min(LAST_YEAR + 1 - YEARS, this.#year_start + offset * YEARS),
        );
        this.#show_years();
      }),
      years,
    );
    picker.classList.add("keyboard-datetime-layer");
    this.#picker = picker;
    this.#year_layer = layer;
    const layers = div("keyboard-datetime-layers");
    layers.append(picker, layer);
    return layers;
  }

  #build_time(): HTMLElement {
    const navigation = (label: HTMLElement, move: (offset: number) => void) => {
      const element = div("keyboard-datetime-time-navigation");
      element.append(
        button("‹", () => move(-1)),
        label,
        button("›", () => move(1)),
      );
      return element;
    };
    const hours = div("keyboard-datetime-time-choices");
    for (let index = 0; index < HOURS; index++) {
      const hour = button("", () => {
        this.#hour = this.#hour_group * HOURS + index;
        this.#mark(this.#hours, index);
        this.#time_changed();
      });
      this.#hours.push(hour);
      hours.append(hour);
    }
    const minutes = div("keyboard-datetime-time-choices minutes");
    for (let index = 0; index < MINUTES; index++) {
      const minute = button("", () => {
        this.#minute = this.#minute_group * MINUTES + index;
        this.#mark(this.#minutes, index);
        this.#time_changed();
      });
      this.#minutes.push(minute);
      minutes.append(minute);
    }
    const footer = div("keyboard-datetime-time-footer");
    footer.append(
      button("Submit", () => {
        this.#submit_time();
        this.close();
      }),
      button("🗙", () => this.close()),
    );
    const time = div("keyboard-datetime-time");
    time.append(
      navigation(this.#hour_label, (offset) => {
        this.#hour_group = Math.max(
          0,
          Math.min(LAST_HOUR_GROUP, this.#hour_group + offset),
        );
        this.#show_hours();
      }),
      hours,
      navigation(this.#minute_label, (offset) => {
        this.#minute_group = Math.max(
          0,
          Math.min(LAST_MINUTE_GROUP, this.#minute_group + offset),
        );
        this.#show_minutes();
      }),
      minutes,
      footer,
    );
    return time;
  }

  //      _____ _    _  ______          __
  //     / ____| |  | |/ __ \ \        / /
  //    | (___ | |__| | |  | \ \  /\  / /
  //     \___ \|  __  | |  | |\ \/  \/ /
  //     ____) | |  | | |__| | \  /\  /
  //    |_____/|_|  |_|\____/   \/  \/
  /**Shows the month or year of the view*/
  #show_view(): void {
    if (this.#type === "month") this.#show_months();
    else if (this.#type === "week") this.#show_weeks();
    else if (this.#type !== "time") this.#show_days();
  }

  #show_days(): void {
    const year = this.#view.getFullYear();
    const month = this.#view.getMonth();
    this.#title.textContent = `${MONTHS[month]} ${year}`;
    //Starts on the sunday on or before the first of the month
    const start = 1 - new Date(year, month, 1).getDay();
    this.#days.forEach((day, index) => {
      const date = new Date(year, month, start + index);
      this.#day_dates[index] = date;
      day.textContent = date.getDate().toString();
      day.classList.toggle("outside", date.getMonth() !== month);
    });
    this.#allow_days();
    this.#mark_day();
  }

  /**Disables the days outside the min, max and step of the input, for datetime-local with the chosen time*/
  #allow_days(): void {
    const time =
      this.#type === "datetime-local" ? `T${this.#time_value()}` : "";
    this.#days.forEach((day, index) => {
      day.disabled = !this.#allowed(date_value(this.#day_dates[index]) + time);
    });
  }

  /**Marks the chosen day, or the day of the value*/
  #mark_day(): void {
    const date =
      this.#type === "datetime-local"
        ? this.#chosen
        : date_from_value(this.#input?.value ?? "");
    const selected = date && date_value(date);
    this.#days.forEach((day, index) =>
      day.classList.toggle(
        "selected",
        date_value(this.#day_dates[index]) === selected,
      ),
    );
  }

  #show_weeks(): void {
    const year = this.#view.getFullYear();
    const month = this.#view.getMonth();
    this.#title.textContent = `${MONTHS[month]} ${year}`;
    //Starts on the monday on or before the first of the month
    const start = 1 - ((new Date(year, month, 1).getDay() + 6) % 7);
    this.#weeks.forEach((week, index) => {
      const monday = new Date(year, month, start + index * 7);
      const value = week_value(monday);
      this.#week_values[index] = value;
      week.button.textContent = `W${value.slice(-2)}`;
      week.button.disabled = !this.#allowed(value);
      week.button.classList.toggle("selected", value === this.#input?.value);
      week.dates.forEach((span, day) => {
        const date = new Date(year, month, start + index * 7 + day);
        span.textContent = date.getDate().toString();
        span.classList.toggle("outside", date.getMonth() !== month);
      });
    });
  }

  #month_value(index: number): string {
    return `${pad(this.#view.getFullYear(), 4)}-${pad(index + 1)}`;
  }

  #show_months(): void {
    this.#title.textContent = this.#view.getFullYear().toString();
    this.#months.forEach((month, index) => {
      const value = this.#month_value(index);
      month.disabled = !this.#allowed(value);
      month.classList.toggle("selected", value === this.#input?.value);
    });
  }

  /**Shows the year layer in place of the picker, on the years around the year shown, or the picker*/
  #show_year_layer(shown: boolean): void {
    if (!this.#picker || !this.#year_layer) return;
    this.#picker.classList.toggle("hidden", shown);
    this.#year_layer.classList.toggle("hidden", !shown);
    if (!shown) return;
    const year = this.#view.getFullYear();
    this.#year_start = year - (year % YEARS);
    this.#show_years();
  }

  #show_years(): void {
    const start = this.#year_start;
    this.#year_title.textContent = `${start}-${start + YEARS - 1}`;
    //Every value of these types starts with the year, so the year of min and max is their start
    const min = parseInt(this.#check.min) || FIRST_YEAR;
    const max = parseInt(this.#check.max) || LAST_YEAR;
    this.#years.forEach((choice, index) => {
      const year = start + index;
      choice.textContent = year.toString();
      choice.disabled =
        year < Math.max(min, FIRST_YEAR) || year > Math.min(max, LAST_YEAR);
      choice.classList.toggle("selected", year === this.#view.getFullYear());
    });
  }

  #show_hours(): void {
    const start = this.#hour_group * HOURS;
    this.#hour_label.textContent = `${pad(start)}-${pad(start + HOURS - 1)}`;
    this.#hours.forEach((hour, index) => {
      hour.textContent = pad(start + index);
    });
    this.#mark(this.#hours, this.#hour - start);
  }

  #show_minutes(): void {
    const start = this.#minute_group * MINUTES;
    this.#minute_label.textContent = `${pad(start)}-${pad(start + MINUTES - 1)}`;
    this.#minutes.forEach((minute, index) => {
      minute.textContent = pad(start + index);
    });
    this.#mark(this.#minutes, this.#minute - start);
  }

  /**Marks the button at the index as selected, an index outside the buttons marks none*/
  #mark(buttons: HTMLButtonElement[], selected: number): void {
    buttons.forEach((choice, index) =>
      choice.classList.toggle("selected", index === selected),
    );
  }

  //      _____ _    _  ____   ____   _____ ______
  //     / ____| |  | |/ __ \ / __ \ / ____|  ____|
  //    | |    | |__| | |  | | |  | | (___ | |__
  //    | |    |  __  | |  | | |  | |\___ \|  __|
  //    | |____| |  | | |__| | |__| |____) | |____
  //     \_____|_|  |_|\____/ \____/|_____/|______|
  #move_month(offset: number): void {
    this.#view.setMonth(this.#view.getMonth() + offset, 1);
    this.#show_view();
  }

  #move_year(offset: number): void {
    this.#view.setFullYear(this.#view.getFullYear() + offset, 0, 1);
    this.#show_view();
  }

  #select_date(date: Date): void {
    if (this.#type === "datetime-local") {
      this.#chosen = date;
      this.#mark_day();
      this.#show_tab_values();
      this.#show_tab("time");
      return;
    }
    this.#set_value(date_value(date));
    this.close();
  }

  /**The days allowed for datetime-local depend on the time*/
  #time_changed(): void {
    if (this.#type !== "datetime-local") return;
    this.#allow_days();
    this.#show_tab_values();
  }

  /**Shows the date or the time of datetime-local, only on a narrow screen, a wide one shows both*/
  #show_tab(tab: "date" | "time"): void {
    this.#local?.classList.toggle("tab-date", tab === "date");
    this.#local?.classList.toggle("tab-time", tab === "time");
    this.#date_tab.classList.toggle("selected", tab === "date");
    this.#time_tab.classList.toggle("selected", tab === "time");
  }

  /**The tabs show the chosen date and time, as only one of them is shown*/
  #show_tab_values(): void {
    const date = this.#chosen;
    this.#date_tab.textContent = date
      ? `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`
      : "Date";
    this.#time_tab.textContent = this.#time_value();
  }

  #time_value(): string {
    return `${pad(this.#hour)}:${pad(this.#minute)}`;
  }

  #submit_time(): void {
    const time = this.#time_value();
    if (this.#type === "time") this.#set_value(time);
    else this.#set_value(`${date_value(this.#chosen ?? this.#view)}T${time}`);
  }

  #allowed(value: string): boolean {
    this.#check.value = value;
    return this.#check.value === value && this.#check.checkValidity();
  }

  #set_value(value: string): void {
    const input = this.#input;
    if (!input || !this.#allowed(value) || input.value === value) return;
    input.value = value;
    this.#changed = true;
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
}
define_element(Keyboard_DateTime);
