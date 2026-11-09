import { describe, expect, it } from "vitest";
import { Keyboard_DateTime } from "./keyboard_datetime";

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
    const keyboard = new Keyboard_DateTime();

    keyboard.open(input);
    const date = [...keyboard.querySelectorAll("button")].find(
      (button) => button.textContent === "11" && !button.classList.contains("outside"),
    );
    date?.click();

    expect(input.value).toBe("2026-03-11");
    expect(events).toEqual(["input", "change"]);
  });

  it("disables dates outside input constraints", () => {
    const input = appendInput("date", "2026-03-10");
    input.min = "2026-03-10";
    input.max = "2026-03-12";
    const keyboard = new Keyboard_DateTime();

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
  return keyboard.querySelector(".keyboard-datetime-header strong")?.textContent;
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
    const keyboard = new Keyboard_DateTime();
    keyboard.open(appendInput("date", "2020-05-17"));
    expect(header(keyboard)).toBe("May 2020");
    expect(keyboard.querySelector("button.selected")?.textContent).toBe("17");
    keyboard.close();
  });

  it("moves between months and years", () => {
    const keyboard = new Keyboard_DateTime();
    keyboard.open(appendInput("date", "2020-12-31"));
    button(keyboard, "›")?.click();
    expect(header(keyboard)).toBe("January 2021");
    button(keyboard, "‹")?.click();
    button(keyboard, "‹")?.click();
    expect(header(keyboard)).toBe("November 2020");
    keyboard.close();
  });

  it("shows 42 days starting on a sunday", () => {
    const keyboard = new Keyboard_DateTime();
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
    const keyboard = new Keyboard_DateTime();
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
    const keyboard = new Keyboard_DateTime();
    keyboard.open(appendInput("text", "2020-05-17"));
    expect(keyboard.isConnected).toBe(false);
    keyboard.open(document.body.appendChild(document.createElement("div")));
    expect(keyboard.isConnected).toBe(false);
  });
});

describe("Keyboard_DateTime month", () => {
  it("opens on the year of the value", () => {
    const keyboard = new Keyboard_DateTime();
    keyboard.open(appendInput("month", "2020-05"));
    expect(header(keyboard)).toBe("2020");
    expect(keyboard.querySelector("button.selected")?.textContent).toBe("May");
    keyboard.close();
  });

  it("selects a month of the shown year and closes", () => {
    const input = appendInput("month", "");
    const events = record(input);
    const keyboard = new Keyboard_DateTime();
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
    const keyboard = new Keyboard_DateTime();
    //Week 10 of 2020 is monday the 2nd to sunday the 8th of march
    keyboard.open(appendInput("week", "2020-W10"));
    expect(header(keyboard)).toBe("March 2020");
    expect(keyboard.querySelector("button.selected")?.textContent).toBe("W10");
    keyboard.close();
  });

  it("opens on the month of a week 1 starting in the previous year", () => {
    const keyboard = new Keyboard_DateTime();
    //Week 1 of 2020 starts on monday the 30th of december 2019
    keyboard.open(appendInput("week", "2020-W01"));
    expect(header(keyboard)).toBe("December 2019");
    expect(keyboard.querySelector("button.selected")?.textContent).toBe("W01");
    keyboard.close();
  });

  it("selects a week and closes", () => {
    const input = appendInput("week", "");
    const events = record(input);
    const keyboard = new Keyboard_DateTime();
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
    const keyboard = new Keyboard_DateTime();
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
    const keyboard = new Keyboard_DateTime();
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
    const keyboard = new Keyboard_DateTime();
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
    const keyboard = new Keyboard_DateTime();
    keyboard.open(input);
    expect(header(keyboard)).toBe("May 2020");
    let parts = time_parts(keyboard);
    expect(parts.selected(parts.hours)).toBe("08");
    expect(parts.selected(parts.minutes)).toBe("15");
    button(keyboard.querySelector(".keyboard-datetime-calendar")!, "20")?.click();
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
    const keyboard = new Keyboard_DateTime();
    keyboard.open(input);
    const parts = time_parts(keyboard);
    button(parts.hours, "09")?.click();
    button(keyboard, "Submit")?.click();
    expect(input.value).toBe("2020-05-17T08:15");
    expect(events).toEqual([]);
  });
});
