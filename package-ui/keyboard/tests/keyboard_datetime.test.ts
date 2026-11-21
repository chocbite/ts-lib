import { describe, expect, it } from "vitest";
import { Keyboard_DateTime } from "../keyboard_datetime";

function appendInput(type: string, value: string): HTMLInputElement {
  const input = document.body.appendChild(document.createElement("input"));
  input.type = type;
  input.value = value;
  return input;
}

describe("Keyboard_DateTime", () => {
  it("selects a date and emits input followed by change", () => {
    const input = appendInput("date", "2026-03-10");
    const events: string[] = [];
    input.addEventListener("input", () => events.push("input"));
    input.addEventListener("change", () => events.push("change"));
    const keyboard = new Keyboard_DateTime("date");

    keyboard.open(input);
    const date = [...keyboard.querySelectorAll("button")].find(
      (button) =>
        button.textContent === "11" && !button.classList.contains("outside"),
    );
    date?.click();

    expect(input.value).toBe("2026-03-11");
    expect(events).toEqual(["input", "change"]);
  });

  it("disables dates outside input constraints", () => {
    const input = appendInput("date", "2026-03-10");
    input.min = "2026-03-10";
    input.max = "2026-03-12";
    const keyboard = new Keyboard_DateTime("date");

    keyboard.open(input);
    const buttons = [...keyboard.querySelectorAll("button")];
    const allowed = buttons.find((button) => button.textContent === "11");
    const blocked = buttons.find((button) => button.textContent === "9");

    expect(allowed?.disabled).toBe(false);
    expect(blocked?.disabled).toBe(true);
    keyboard.close();
  });
});

/**Records the input and change events of the input*/
function record(input: HTMLInputElement): string[] {
  const events: string[] = [];
  input.addEventListener("input", () => events.push("input"));
  input.addEventListener("change", () => events.push("change"));
  return events;
}

/**Finds a button by its text, dates of the neighbouring months are skipped*/
function button(
  parent: ParentNode,
  text: string,
): HTMLButtonElement | undefined {
  return [...parent.querySelectorAll("button")].find(
    (b) => b.textContent === text && !b.classList.contains("outside"),
  );
}

/**Text of the header showing the month or year*/
function header(keyboard: Keyboard_DateTime): string | null | undefined {
  return keyboard.querySelector(".keyboard-datetime-title")?.textContent;
}

function time_parts(keyboard: Keyboard_DateTime) {
  const choices = keyboard.querySelectorAll(".keyboard-datetime-time-choices");
  const labels = keyboard.querySelectorAll(
    ".keyboard-datetime-time-navigation strong",
  );
  const navigation = keyboard.querySelectorAll(
    ".keyboard-datetime-time-navigation",
  );
  return {
    hours: choices[0],
    minutes: choices[1],
    hour_label: labels[0]?.textContent,
    minute_label: labels[1]?.textContent,
    hour_next: () => button(navigation[0], "›")?.click(),
    hour_previous: () => button(navigation[0], "‹")?.click(),
    minute_next: () => button(navigation[1], "›")?.click(),
    selected: (parent: Element) =>
      parent.querySelector("button.selected")?.textContent,
  };
}

describe("Keyboard_DateTime date", () => {
  it("opens on the month of the value and marks the selected date", () => {
    const keyboard = new Keyboard_DateTime("date");
    keyboard.open(appendInput("date", "2020-05-17"));
    expect(header(keyboard)).toBe("May 2020");
    expect(keyboard.querySelector("button.selected")?.textContent).toBe("17");
    keyboard.close();
  });

  it("moves between months and years", () => {
    const keyboard = new Keyboard_DateTime("date");
    keyboard.open(appendInput("date", "2020-12-31"));
    button(keyboard, "›")?.click();
    expect(header(keyboard)).toBe("January 2021");
    button(keyboard, "‹")?.click();
    button(keyboard, "‹")?.click();
    expect(header(keyboard)).toBe("November 2020");
    keyboard.close();
  });

  it("shows 42 days starting on a sunday", () => {
    const keyboard = new Keyboard_DateTime("date");
    keyboard.open(appendInput("date", "2020-05-17"));
    const days = [
      ...keyboard.querySelectorAll(".keyboard-datetime-calendar button"),
    ];
    expect(days.length).toBe(42);
    //May 2020 starts on a friday, so the calendar starts on sunday the 26th of april
    expect(days[0].textContent).toBe("26");
    expect(days[0].classList.contains("outside")).toBe(true);
    expect(days[5].textContent).toBe("1");
    expect(days[5].classList.contains("outside")).toBe(false);
    keyboard.close();
  });

  it("closes without events when closed or when the selected date is clicked", () => {
    const input = appendInput("date", "2020-05-17");
    const events = record(input);
    const keyboard = new Keyboard_DateTime("date");
    keyboard.open(input);
    button(keyboard, "🗙")?.click();
    expect(keyboard.isConnected).toBe(false);
    keyboard.open(input);
    button(keyboard, "17")?.click();
    expect(keyboard.isConnected).toBe(false);
    expect(input.value).toBe("2020-05-17");
    expect(events).toEqual([]);
  });

  it("does not open for inputs that are not date or time inputs", () => {
    const keyboard = new Keyboard_DateTime("date");
    keyboard.open(appendInput("text", "2020-05-17"));
    expect(keyboard.isConnected).toBe(false);
    keyboard.open(document.body.appendChild(document.createElement("div")));
    expect(keyboard.isConnected).toBe(false);
  });

  it("does not open for inputs of another date or time type", () => {
    const keyboard = new Keyboard_DateTime("date");
    for (const type of ["datetime-local", "month", "time", "week"]) {
      keyboard.open(appendInput(type, ""));
      expect(keyboard.isConnected, type).toBe(false);
    }
  });
});

describe("Keyboard_DateTime month", () => {
  it("opens on the year of the value", () => {
    const keyboard = new Keyboard_DateTime("month");
    keyboard.open(appendInput("month", "2020-05"));
    expect(header(keyboard)).toBe("2020");
    expect(keyboard.querySelector("button.selected")?.textContent).toBe("May");
    keyboard.close();
  });

  it("selects a month of the shown year and closes", () => {
    const input = appendInput("month", "");
    const events = record(input);
    const keyboard = new Keyboard_DateTime("month");
    keyboard.open(input);
    const year = new Date().getFullYear();
    expect(header(keyboard)).toBe(year.toString());
    button(keyboard, "‹")?.click();
    expect(header(keyboard)).toBe((year - 1).toString());
    button(keyboard, "Mar")?.click();
    expect(input.value).toBe(`${year - 1}-03`);
    expect(events).toEqual(["input", "change"]);
    expect(keyboard.isConnected).toBe(false);
  });
});

describe("Keyboard_DateTime week", () => {
  it("opens on the month of the value", () => {
    const keyboard = new Keyboard_DateTime("week");
    //Week 10 of 2020 is monday the 2nd to sunday the 8th of march
    keyboard.open(appendInput("week", "2020-W10"));
    expect(header(keyboard)).toBe("March 2020");
    expect(keyboard.querySelector("button.selected")?.textContent).toBe("W10");
    keyboard.close();
  });

  it("opens on the month of a week 1 starting in the previous year", () => {
    const keyboard = new Keyboard_DateTime("week");
    //Week 1 of 2020 starts on monday the 30th of december 2019
    keyboard.open(appendInput("week", "2020-W01"));
    expect(header(keyboard)).toBe("December 2019");
    expect(keyboard.querySelector("button.selected")?.textContent).toBe("W01");
    keyboard.close();
  });

  it("selects a week and closes", () => {
    const input = appendInput("week", "");
    const events = record(input);
    const keyboard = new Keyboard_DateTime("week");
    keyboard.open(input);
    const weeks = [
      ...keyboard.querySelectorAll<HTMLButtonElement>(
        ".keyboard-datetime-week button",
      ),
    ];
    expect(weeks.length).toBe(6);
    const second = weeks[1];
    const label = second.textContent ?? "";
    second.click();
    expect(input.value).toMatch(/^\d{4}-W\d{2}$/);
    expect(input.value.endsWith(label)).toBe(true);
    expect(events).toEqual(["input", "change"]);
    expect(keyboard.isConnected).toBe(false);
  });
});

describe("Keyboard_DateTime time", () => {
  it("shows the time of the value and submits the chosen time", () => {
    const input = appendInput("time", "14:30");
    const events = record(input);
    const keyboard = new Keyboard_DateTime("time");
    keyboard.open(input);
    let parts = time_parts(keyboard);
    expect(parts.hour_label).toBe("12-15");
    expect(parts.minute_label).toBe("30-39");
    expect(parts.selected(parts.hours)).toBe("14");
    expect(parts.selected(parts.minutes)).toBe("30");
    button(parts.hours, "15")?.click();
    parts = time_parts(keyboard);
    parts.minute_next();
    parts = time_parts(keyboard);
    expect(parts.minute_label).toBe("40-49");
    button(parts.minutes, "45")?.click();
    //Nothing is written before submit
    expect(input.value).toBe("14:30");
    expect(events).toEqual([]);
    button(keyboard, "Submit")?.click();
    expect(input.value).toBe("15:45");
    expect(events).toEqual(["input", "change"]);
    expect(keyboard.isConnected).toBe(false);
  });

  it("keeps the hour and minute groups within the day", () => {
    const keyboard = new Keyboard_DateTime("time");
    keyboard.open(appendInput("time", "00:00"));
    let parts = time_parts(keyboard);
    parts.hour_previous();
    parts = time_parts(keyboard);
    expect(parts.hour_label).toBe("00-03");
    for (let i = 0; i < 10; i++) {
      parts.hour_next();
      parts.minute_next();
      parts = time_parts(keyboard);
    }
    expect(parts.hour_label).toBe("20-23");
    expect(parts.minute_label).toBe("50-59");
    expect(
      [...parts.hours.querySelectorAll("button")].map((b) => b.textContent),
    ).toEqual(["20", "21", "22", "23"]);
    keyboard.close();
  });

  it("closes without change when not submitted", () => {
    const input = appendInput("time", "14:30");
    const events = record(input);
    const keyboard = new Keyboard_DateTime("time");
    keyboard.open(input);
    const parts = time_parts(keyboard);
    button(parts.hours, "13")?.click();
    keyboard.close();
    expect(input.value).toBe("14:30");
    expect(events).toEqual([]);
  });
});

describe("Keyboard_DateTime datetime-local", () => {
  it("keeps the chosen date until the time is submitted", () => {
    const input = appendInput("datetime-local", "2020-05-17T08:15");
    const events = record(input);
    const keyboard = new Keyboard_DateTime("datetime-local");
    keyboard.open(input);
    expect(header(keyboard)).toBe("May 2020");
    let parts = time_parts(keyboard);
    expect(parts.selected(parts.hours)).toBe("08");
    expect(parts.selected(parts.minutes)).toBe("15");
    button(
      keyboard.querySelector(".keyboard-datetime-calendar")!,
      "20",
    )?.click();
    expect(keyboard.isConnected).toBe(true);
    expect(input.value).toBe("2020-05-17T08:15");
    expect(
      keyboard.querySelector(".keyboard-datetime-calendar button.selected")
        ?.textContent,
    ).toBe("20");
    parts = time_parts(keyboard);
    button(parts.hours, "09")?.click();
    button(keyboard, "Submit")?.click();
    expect(input.value).toBe("2020-05-20T09:15");
    expect(events).toEqual(["input", "change"]);
    expect(keyboard.isConnected).toBe(false);
  });

  it("does not write a value outside the input constraints", () => {
    const input = appendInput("datetime-local", "2020-05-17T08:15");
    input.max = "2020-05-17T08:30";
    const events = record(input);
    const keyboard = new Keyboard_DateTime("datetime-local");
    keyboard.open(input);
    const parts = time_parts(keyboard);
    button(parts.hours, "09")?.click();
    button(keyboard, "Submit")?.click();
    expect(input.value).toBe("2020-05-17T08:15");
    expect(events).toEqual([]);
  });
});

describe("Keyboard_DateTime updates", () => {
  it("keeps its buttons when moving between months and choosing a time", () => {
    const keyboard = new Keyboard_DateTime("datetime-local");
    keyboard.open(appendInput("datetime-local", "2020-05-17T08:15"));
    const days = [
      ...keyboard.querySelectorAll(".keyboard-datetime-calendar button"),
    ];
    const hours = [
      ...keyboard.querySelectorAll(".keyboard-datetime-time-choices button"),
    ];
    button(keyboard, "›")?.click();
    expect(header(keyboard)).toBe("June 2020");
    button(time_parts(keyboard).hours, "09")?.click();
    time_parts(keyboard).hour_next();
    expect(time_parts(keyboard).hour_label).toBe("12-15");
    expect(days.every((day) => day.isConnected)).toBe(true);
    expect(hours.every((hour) => hour.isConnected)).toBe(true);
    //June 2020 starts on a monday, so the calendar starts on sunday the 31st of may
    expect(days[0].textContent).toBe("31");
    expect(days[1].textContent).toBe("1");
    expect(hours[0].textContent).toBe("12");
    keyboard.close();
  });
});

/**The year layer, its title, the years and its previous and next*/
function year_layer(keyboard: Keyboard_DateTime) {
  const layer = keyboard.querySelector<HTMLElement>(
    ".keyboard-datetime-year-layer",
  )!;
  return {
    shown: () => !layer.classList.contains("hidden"),
    title: layer.querySelector<HTMLButtonElement>(".keyboard-datetime-title")!,
    years: [
      ...layer.querySelectorAll<HTMLButtonElement>(
        ".keyboard-datetime-years button",
      ),
    ],
    previous: () => button(layer, "‹")?.click(),
    next: () => button(layer, "›")?.click(),
  };
}

describe("Keyboard_DateTime years", () => {
  it("opens from the title, pages by 12 years and shows the chosen year on the same month", () => {
    const keyboard = new Keyboard_DateTime("date");
    keyboard.open(appendInput("date", "2026-05-17"));
    const layer = year_layer(keyboard);
    expect(layer.shown()).toBe(false);
    keyboard
      .querySelector<HTMLButtonElement>(".keyboard-datetime-title")!
      .click();
    expect(layer.shown()).toBe(true);
    expect(layer.title.textContent).toBe("2016-2027");
    expect(layer.years).toHaveLength(12);
    expect(
      layer.years.find((y) => y.classList.contains("selected"))?.textContent,
    ).toBe("2026");
    const days = keyboard.querySelector(".keyboard-datetime-calendar button");
    layer.previous();
    expect(layer.title.textContent).toBe("2004-2015");
    expect(layer.years.some((y) => y.classList.contains("selected"))).toBe(
      false,
    );
    button(
      keyboard.querySelector(".keyboard-datetime-years")!,
      "2010",
    )!.click();
    expect(layer.shown()).toBe(false);
    expect(header(keyboard)).toBe("May 2010");
    expect(keyboard.querySelector(".keyboard-datetime-calendar button")).toBe(
      days,
    );
    keyboard.close();
  });

  it("goes back from its title, and is closed when opened again", () => {
    const input = appendInput("month", "2026-05");
    const keyboard = new Keyboard_DateTime("month");
    keyboard.open(input);
    const layer = year_layer(keyboard);
    keyboard
      .querySelector<HTMLButtonElement>(".keyboard-datetime-title")!
      .click();
    layer.title.click();
    expect(layer.shown()).toBe(false);
    expect(header(keyboard)).toBe("2026");
    keyboard
      .querySelector<HTMLButtonElement>(".keyboard-datetime-title")!
      .click();
    keyboard.close();
    keyboard.open(input);
    expect(layer.shown()).toBe(false);
    keyboard.close();
  });

  it("disables the years outside the min and max of the input", () => {
    const input = appendInput("week", "2026-W10");
    input.min = "2020-W01";
    input.max = "2026-W30";
    const keyboard = new Keyboard_DateTime("week");
    keyboard.open(input);
    keyboard
      .querySelector<HTMLButtonElement>(".keyboard-datetime-title")!
      .click();
    const disabled = year_layer(keyboard)
      .years.filter((y) => y.disabled)
      .map((y) => y.textContent);
    expect(disabled).toEqual(["2016", "2017", "2018", "2019", "2027"]);
    keyboard.close();
  });

  it("is not in the time keyboard", () => {
    const keyboard = new Keyboard_DateTime("time");
    keyboard.open(appendInput("time", "14:30"));
    expect(keyboard.querySelector(".keyboard-datetime-year-layer")).toBeNull();
    keyboard.close();
  });
});

describe("Keyboard_DateTime datetime-local tabs", () => {
  const tabs = (keyboard: Keyboard_DateTime) => {
    const local = keyboard.querySelector(".keyboard-datetime-local")!;
    const [date, time] = keyboard.querySelectorAll<HTMLButtonElement>(
      ".keyboard-datetime-tabs button",
    );
    return {
      date,
      time,
      shown: () => (local.classList.contains("tab-time") ? "time" : "date"),
    };
  };

  it("switch between the date and the time, and show what is chosen", () => {
    const keyboard = new Keyboard_DateTime("datetime-local");
    keyboard.open(appendInput("datetime-local", "2020-05-17T08:15"));
    let tab = tabs(keyboard);
    expect(tab.shown()).toBe("date");
    expect(tab.date.textContent).toBe("17 May 2020");
    expect(tab.time.textContent).toBe("08:15");
    expect(tab.date.classList.contains("selected")).toBe(true);
    tab.time.click();
    expect(tab.shown()).toBe("time");
    expect(tab.time.classList.contains("selected")).toBe(true);
    button(time_parts(keyboard).hours, "09")!.click();
    expect(tab.time.textContent).toBe("09:15");
    tab.date.click();
    //Choosing a day goes on to the time
    button(
      keyboard.querySelector(".keyboard-datetime-calendar")!,
      "20",
    )!.click();
    expect(tab.date.textContent).toBe("20 May 2020");
    expect(tab.shown()).toBe("time");
    keyboard.close();
    keyboard.open(appendInput("datetime-local", ""));
    tab = tabs(keyboard);
    expect(tab.shown()).toBe("date");
    expect(tab.date.textContent).toBe("Date");
    expect(tab.time.textContent).toBe("00:00");
    keyboard.close();
  });

  it("are only in the datetime-local keyboard", () => {
    for (const type of ["date", "month", "time", "week"] as const) {
      const keyboard = new Keyboard_DateTime(type);
      expect(
        keyboard.querySelector(".keyboard-datetime-tabs"),
        type,
      ).toBeNull();
    }
  });
});
