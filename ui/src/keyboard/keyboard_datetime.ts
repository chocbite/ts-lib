import { define_element } from "#base";
import { KeyboardBase } from "./base";
import "./keyboard_datetime.scss";

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
const DATE_TYPES = ["date", "datetime-local", "month", "time", "week"];

function date_value(date: Date): string {
  return `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
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
  return `${year}-W${week.toString().padStart(2, "0")}`;
}

export class Keyboard_DateTime extends KeyboardBase {
  #input?: HTMLInputElement;
  #view = new Date();
  #changed = false;
  #hour_group = 0;
  #minute_group = 0;
  #hour = 0;
  #minute = 0;
  #selected_datetime_date?: Date;

  static element_name(): string {
    return "keyboard-datetime";
  }
  static element_name_space(): string {
    return "onscreen-keyboard";
  }

  constructor() {
    super();
    this.classList.add("keyboard-datetime");
    this.addEventListener("mousedown", (event) => event.preventDefault());
  }

  open(element: HTMLElement): void {
    if (
      !(element instanceof HTMLInputElement) ||
      !DATE_TYPES.includes(element.type)
    )
      return;
    this.#input = element;
    this.#view = view_from_value(element.value, element.type) ?? new Date();
    this.#view.setDate(1);
    this.#selected_datetime_date =
      element.type === "datetime-local"
        ? date_from_value(element.value)
        : undefined;
    const time = element.value.match(/T?(\d{2}):(\d{2})/) ?? [];
    this.#hour = Number(time[1] ?? 0);
    this.#minute = Number(time[2] ?? 0);
    this.#hour_group = Math.floor(this.#hour / 4);
    this.#minute_group = Math.floor(this.#minute / 10);
    this.#changed = false;
    this.#render();
    super.open(element);
  }

  close(): void {
    if (this.elem && this.#changed)
      this.elem.dispatchEvent(new Event("change", { bubbles: true }));
    this.#input = undefined;
    this.#selected_datetime_date = undefined;
    this.#changed = false;
    super.close();
  }

  #render(): void {
    const container = document.createElement("div");
    const type = this.#input?.type;
    if (type === "datetime-local")
      container.className = "keyboard-datetime-local";
    if (type === "month") container.appendChild(this.#month_picker());
    else if (type === "time") container.appendChild(this.#time_picker());
    else {
      container.appendChild(
        type === "week" ? this.#week_picker() : this.#calendar(),
      );
      if (type === "datetime-local") container.appendChild(this.#time_picker());
    }
    this.replaceChildren(container);
  }

  #calendar(): HTMLElement {
    const picker = document.createElement("div");
    const header = document.createElement("div");
    header.className = "keyboard-datetime-header";
    header.append(
      this.#button("‹", () => this.#move_month(-1)),
      Object.assign(document.createElement("strong"), {
        textContent: `${MONTHS[this.#view.getMonth()]} ${this.#view.getFullYear()}`,
      }),
      this.#button("›", () => this.#move_month(1)),
      this.#button("🗙", () => this.close()),
    );
    const calendar = document.createElement("div");
    calendar.className = "keyboard-datetime-calendar";
    WEEKDAYS.forEach((day) =>
      calendar.append(
        Object.assign(document.createElement("span"), { textContent: day }),
      ),
    );
    const first = new Date(this.#view.getFullYear(), this.#view.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const value =
        this.#input?.type === "week"
          ? week_value(date)
          : this.#input?.type === "datetime-local"
            ? `${date_value(date)}T${this.#time_value()}`
            : date_value(date);
      const button = this.#button(date.getDate().toString(), () =>
        this.#select_date(date),
      );
      button.disabled = !this.#value_allowed(value);
      if (date.getMonth() !== this.#view.getMonth())
        button.classList.add("outside");
      if (date_value(date) === this.#selected_date_value())
        button.classList.add("selected");
      calendar.append(button);
    }
    picker.append(header, calendar);
    return picker;
  }

  #month_picker(): HTMLElement {
    const picker = document.createElement("div");
    const header = document.createElement("div");
    header.className = "keyboard-datetime-header";
    header.append(
      this.#button("‹", () => this.#move_year(-1)),
      Object.assign(document.createElement("strong"), {
        textContent: this.#view.getFullYear().toString(),
      }),
      this.#button("›", () => this.#move_year(1)),
      this.#button("🗙", () => this.close()),
    );
    const months = document.createElement("div");
    months.className = "keyboard-datetime-months";
    MONTHS.forEach((month, index) => {
      const value = `${this.#view.getFullYear()}-${(index + 1).toString().padStart(2, "0")}`;
      const button = this.#button(month.slice(0, 3), () => {
        this.#set_value(value);
        this.close();
      });
      button.disabled = !this.#value_allowed(value);
      if (value === this.#input?.value) button.classList.add("selected");
      months.append(button);
    });
    picker.append(header, months);
    return picker;
  }

  #week_picker(): HTMLElement {
    const picker = document.createElement("div");
    const header = document.createElement("div");
    header.className = "keyboard-datetime-header";
    header.append(
      this.#button("‹", () => this.#move_month(-1)),
      Object.assign(document.createElement("strong"), {
        textContent: `${MONTHS[this.#view.getMonth()]} ${this.#view.getFullYear()}`,
      }),
      this.#button("›", () => this.#move_month(1)),
      this.#button("🗙", () => this.close()),
    );
    const weeks = document.createElement("div");
    weeks.className = "keyboard-datetime-weeks";
    const first = new Date(this.#view.getFullYear(), this.#view.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    for (let index = 0; index < 6; index += 1) {
      const monday = new Date(start);
      monday.setDate(start.getDate() + index * 7);
      const value = week_value(monday);
      const row = document.createElement("div");
      row.className = "keyboard-datetime-week";
      const button = this.#button(`W${value.slice(-2)}`, () => {
        this.#set_value(value);
        this.close();
      });
      button.disabled = !this.#value_allowed(value);
      if (value === this.#input?.value) button.classList.add("selected");
      const dates = document.createElement("div");
      dates.className = "keyboard-datetime-week-dates";
      for (let day = 0; day < 7; day += 1) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + day);
        const label = document.createElement("span");
        label.textContent = date.getDate().toString();
        if (date.getMonth() !== this.#view.getMonth())
          label.classList.add("outside");
        dates.append(label);
      }
      row.append(button, dates);
      weeks.append(row);
    }
    picker.append(header, weeks);
    return picker;
  }

  #time_picker(): HTMLElement {
    const controls = document.createElement("div");
    controls.className = "keyboard-datetime-time";
    const hour_start = this.#hour_group * 4;
    const minute_start = this.#minute_group * 10;
    controls.append(
      this.#time_navigation(
        () => this.#move_time_group("hour", -1),
        `${hour_start.toString().padStart(2, "0")}-${(hour_start + 3).toString().padStart(2, "0")}`,
        () => this.#move_time_group("hour", 1),
      ),
      this.#time_choices(hour_start, 4, this.#hour, (hour) => {
        this.#hour = hour;
        this.#render();
      }),
      this.#time_navigation(
        () => this.#move_time_group("minute", -1),
        `${minute_start.toString().padStart(2, "0")}-${Math.min(
          minute_start + 9,
          59,
        )
          .toString()
          .padStart(2, "0")}`,
        () => this.#move_time_group("minute", 1),
      ),
      this.#time_choices(
        minute_start,
        10,
        this.#minute,
        (minute) => {
          this.#minute = minute;
          this.#render();
        },
        "minutes",
      ),
      this.#time_footer(),
    );
    return controls;
  }

  #time_navigation(
    previous: () => void,
    label: string,
    next: () => void,
  ): HTMLElement {
    const navigation = document.createElement("div");
    navigation.className = "keyboard-datetime-time-navigation";
    navigation.append(
      this.#button("‹", previous),
      Object.assign(document.createElement("strong"), { textContent: label }),
      this.#button("›", next),
    );
    return navigation;
  }

  #time_choices(
    start: number,
    count: number,
    selected: number,
    select: (value: number) => void,
    class_name?: string,
  ): HTMLElement {
    const choices = document.createElement("div");
    choices.className = "keyboard-datetime-time-choices";
    if (class_name) choices.classList.add(class_name);
    for (let offset = 0; offset < count; offset += 1) {
      const value = start + offset;
      const button = this.#button(value.toString().padStart(2, "0"), () =>
        select(value),
      );
      if (value === selected) button.classList.add("selected");
      choices.append(button);
    }
    return choices;
  }

  #time_footer(): HTMLElement {
    const footer = document.createElement("div");
    footer.className = "keyboard-datetime-time-footer";
    footer.append(
      this.#button("Submit", () => {
        this.#set_time();
        this.close();
      }),
      this.#button("🗙", () => this.close()),
    );
    return footer;
  }

  #move_time_group(part: "hour" | "minute", offset: number): void {
    const maximum = part === "hour" ? 5 : 5;
    const next = Math.max(
      0,
      Math.min(
        maximum,
        (part === "hour" ? this.#hour_group : this.#minute_group) + offset,
      ),
    );
    if (part === "hour") this.#hour_group = next;
    else this.#minute_group = next;
    this.#render();
  }

  #set_time(): void {
    const time = this.#time_value();
    if (this.#input?.type === "time") this.#set_value(time);
    else this.#set_value(`${date_value(this.#selected_date())}T${time}`);
  }

  #time_value(): string {
    return `${this.#hour.toString().padStart(2, "0")}:${this.#minute.toString().padStart(2, "0")}`;
  }

  #selected_date(): Date {
    return (
      this.#selected_datetime_date ??
      date_from_value(this.#input?.value ?? "") ??
      new Date(this.#view)
    );
  }

  #selected_date_value(): string | undefined {
    return this.#input?.type === "datetime-local"
      ? this.#selected_datetime_date && date_value(this.#selected_datetime_date)
      : date_from_value(this.#input?.value ?? "") &&
          this.#input?.value.slice(0, 10);
  }

  #button(text: string, click: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", click);
    return button;
  }

  #move_month(offset: number): void {
    this.#view.setMonth(this.#view.getMonth() + offset, 1);
    this.#render();
  }

  #move_year(offset: number): void {
    this.#view.setFullYear(this.#view.getFullYear() + offset, 0, 1);
    this.#render();
  }

  #select_date(date: Date): void {
    const type = this.#input?.type;
    if (type === "week") {
      this.#set_value(week_value(date));
      return this.close();
    }
    const value =
      type === "datetime-local"
        ? `${date_value(date)}T${this.#input?.value.match(/T(\d{2}:\d{2})/)?.[1] ?? "00:00"}`
        : date_value(date);
    if (type === "datetime-local") {
      this.#selected_datetime_date = date;
      this.#render();
      return;
    }
    this.#set_value(value);
    if (type === "date") this.close();
  }

  #value_allowed(value: string): boolean {
    const input = this.#input;
    if (!input) return false;
    const candidate = input.ownerDocument.createElement("input");
    candidate.type = input.type;
    candidate.min = input.min;
    candidate.max = input.max;
    candidate.step = input.step;
    candidate.value = value;
    return candidate.value === value && candidate.checkValidity();
  }

  #set_value(value: string): void {
    const input = this.#input;
    if (!input || !this.#value_allowed(value) || input.value === value) return;
    input.value = value;
    this.#changed = true;
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
}
define_element(Keyboard_DateTime);

export const DATETIME_KEYBOARD = new Keyboard_DateTime();
