import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  form_date_time,
  FormDateTimeMode,
  FormDateTimePrecision,
  FormDateTimeType,
} from "../special/date_time/date_time_input";

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**Sets the text of the input and dispatches change like the browser does*/
const enter = async (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event("change"));
  await wait();
};

describe("Date time input options", () => {
  afterEach(() => document.body.replaceChildren());

  it("defaults to a date time input with second steps", () => {
    const element = form_date_time({ mode: FormDateTimeMode.NUMBER });
    const input = element.querySelector("input")!;
    expect(input.type).toBe("datetime-local");
    expect(input.step).toBe("1");
  });

  it("switches the input type with the type option", () => {
    const element = form_date_time({
      mode: FormDateTimeMode.NUMBER,
      type: FormDateTimeType.DATE,
    });
    const input = element.querySelector("input")!;
    expect(input.type).toBe("date");
    element.set({ type: FormDateTimeType.TIME });
    expect(input.type).toBe("time");
    element.set({ type: FormDateTimeType.DATETIME });
    expect(input.type).toBe("datetime-local");
  });

  it("shows the fields of its precision, seconds by default", () => {
    const input = (precision?: FormDateTimePrecision) =>
      form_date_time({
        mode: FormDateTimeMode.NUMBER,
        precision,
      }).querySelector("input")!;
    expect(input().step).toBe("1");
    expect(input(FormDateTimePrecision.MINUTES).step).toBe("60");
    expect(input(FormDateTimePrecision.SECONDS).step).toBe("1");
    expect(input(FormDateTimePrecision.MILLISECONDS).step).toBe("0.001");
  });

  it("has precision instead of milliseconds and step", () => {
    const compile_only = () => {
      // @ts-expect-error milliseconds is precision MILLISECONDS
      form_date_time({ mode: FormDateTimeMode.NUMBER, milliseconds: true });
      // @ts-expect-error step is the precision
      form_date_time({ mode: FormDateTimeMode.NUMBER, step: 60 });
    };
    expect(compile_only).toBeTypeOf("function");
  });

  it("opens the picker when an icon is clicked", () => {
    const element = form_date_time({ mode: FormDateTimeMode.NUMBER });
    document.body.appendChild(element);
    const input = element.querySelector("input")!;
    const picker = vi.fn();
    input.showPicker = picker;
    const icons = element.querySelectorAll("svg");
    expect(icons.length).toBe(2);
    icons[0].dispatchEvent(new MouseEvent("click"));
    icons[1].dispatchEvent(new MouseEvent("click"));
    expect(picker).toHaveBeenCalledTimes(2);
  });

  it("shows the calendar icon for date time and date, and the clock for time", () => {
    const element = form_date_time({ mode: FormDateTimeMode.NUMBER });
    document.body.appendChild(element);
    const [calendar, clock] = Array.from(element.querySelectorAll("svg"));
    expect(getComputedStyle(calendar).display).not.toBe("none");
    expect(getComputedStyle(clock).display).toBe("none");
    element.set({ type: FormDateTimeType.DATE });
    expect(getComputedStyle(calendar).display).not.toBe("none");
    element.set({ type: FormDateTimeType.TIME });
    expect(getComputedStyle(calendar).display).toBe("none");
    expect(getComputedStyle(clock).display).not.toBe("none");
  });
});

describe("Date time input number mode", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows a number value as UTC", () => {
    const element = form_date_time({
      mode: FormDateTimeMode.NUMBER,
      value: Date.UTC(2024, 0, 15, 10, 30, 5),
    });
    expect(element.querySelector("input")!.value).toBe("2024-01-15T10:30:05");
  });

  it("shows the value cut to its precision, without changing the value", () => {
    const value = Date.UTC(2024, 0, 15, 10, 30, 5, 250);
    const shown = (precision?: FormDateTimePrecision) =>
      form_date_time({
        mode: FormDateTimeMode.NUMBER,
        precision,
        value,
      }).querySelector("input")!.valueAsNumber;
    expect(shown()).toBe(value - 250);
    expect(shown(FormDateTimePrecision.MINUTES)).toBe(value - 5250);
    expect(shown(FormDateTimePrecision.MILLISECONDS)).toBe(value);
    const element = form_date_time({
      mode: FormDateTimeMode.NUMBER,
      precision: FormDateTimePrecision.MINUTES,
      value,
    });
    expect(element.get_value.unwrap()).toBe(value);
  });

  it("cuts the seconds of a string value at minute precision", () => {
    const element = form_date_time({
      mode: FormDateTimeMode.STRING,
      precision: FormDateTimePrecision.MINUTES,
      value: "2026-01-15T13:45:30",
    });
    expect(element.querySelector("input")!.value).toBe("2026-01-15T13:45");
  });

  it("follows a precision state, showing the value again", () => {
    const value = Date.UTC(2024, 0, 15, 10, 30, 5, 250);
    const precision = st.ok_w<FormDateTimePrecision>(
      FormDateTimePrecision.SECONDS,
    );
    const element = document.body.appendChild(
      form_date_time({ mode: FormDateTimeMode.NUMBER, precision, value }),
    );
    const input = element.querySelector("input")!;
    precision.set_ok(FormDateTimePrecision.MILLISECONDS);
    expect(input.step).toBe("0.001");
    expect(input.valueAsNumber).toBe(value);
    precision.set_ok(FormDateTimePrecision.MINUTES);
    expect(input.step).toBe("60");
    expect(input.valueAsNumber).toBe(value - 5250);
  });

  it("gives an entered value as a UTC number", async () => {
    const change = vi.fn();
    const element = form_date_time({ mode: FormDateTimeMode.NUMBER, change });
    document.body.appendChild(element);
    await enter(element.querySelector("input")!, "2024-07-15T10:30");
    expect(change).toHaveBeenCalledWith(Date.UTC(2024, 6, 15, 10, 30));
    expect(element.buffer).toBe(Date.UTC(2024, 6, 15, 10, 30));
  });

  it("ignores a cleared input", async () => {
    const change = vi.fn();
    const element = form_date_time({
      mode: FormDateTimeMode.NUMBER,
      change,
      value: 0,
    });
    document.body.appendChild(element);
    await enter(element.querySelector("input")!, "");
    expect(change).not.toHaveBeenCalled();
    expect(element.buffer).toBe(0);
  });

  it("follows and writes a bound state", async () => {
    const state = st.ok_w(Date.UTC(2024, 0, 1, 12));
    const element = form_date_time({ mode: FormDateTimeMode.NUMBER });
    document.body.appendChild(element);
    element.set({ value: state });
    const input = element.querySelector("input")!;
    expect(input.value).toBe("2024-01-01T12:00");
    await enter(input, "2024-02-01T13:00");
    expect(state.ok()).toBe(Date.UTC(2024, 1, 1, 13));
    state.set_ok(Date.UTC(2025, 0, 1, 0));
    await wait();
    expect(input.value).toBe("2025-01-01T00:00");
  });

  it("shows a state change made while focused once the focus leaves", async () => {
    const state = st.ok_w(Date.UTC(2024, 0, 1, 12));
    const element = form_date_time({ mode: FormDateTimeMode.NUMBER });
    document.body.appendChild(element);
    element.set({ value: state });
    const input = element.querySelector("input")!;
    input.focus();
    state.set_ok(Date.UTC(2025, 0, 1, 0));
    await wait();
    expect(input.value).toBe("2024-01-01T12:00");
    input.blur();
    await wait();
    expect(input.value).toBe("2025-01-01T00:00");
  });
});

describe("Date time input string mode", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows a local date time string", () => {
    const element = form_date_time({
      mode: FormDateTimeMode.STRING,
      value: "2024-01-15T10:30",
    });
    expect(element.querySelector("input")!.value).toBe("2024-01-15T10:30");
  });

  it("gives an entered value as the input string", async () => {
    const change = vi.fn();
    const element = form_date_time({ mode: FormDateTimeMode.STRING, change });
    document.body.appendChild(element);
    const input = element.querySelector("input")!;
    await enter(input, "2024-07-15T10:30");
    expect(change).toHaveBeenCalledWith("2024-07-15T10:30");
    expect(input.value).toBe("2024-07-15T10:30");
  });

  it("shows a time string with the time type", () => {
    const element = form_date_time({
      mode: FormDateTimeMode.STRING,
      type: FormDateTimeType.TIME,
      value: "10:30",
    });
    expect(element.querySelector("input")!.value).toBe("10:30");
  });

  it("keeps an entered time shown with the time type", async () => {
    const change = vi.fn();
    const element = form_date_time({
      mode: FormDateTimeMode.STRING,
      type: FormDateTimeType.TIME,
      change,
    });
    document.body.appendChild(element);
    const input = element.querySelector("input")!;
    await enter(input, "10:30");
    expect(change).toHaveBeenCalledWith("10:30");
    expect(input.value).toBe("10:30");
  });

  it("shows a date string with the date type", () => {
    const element = form_date_time({
      mode: FormDateTimeMode.STRING,
      type: FormDateTimeType.DATE,
      value: "2024-01-15",
    });
    expect(element.querySelector("input")!.value).toBe("2024-01-15");
  });

  //Date parses a date only string as UTC, the shown time is off by the time zone offset (passes in UTC)
  it("shows a date only string as local midnight", () => {
    const element = form_date_time({
      mode: FormDateTimeMode.STRING,
      value: "2024-01-15",
    });
    expect(element.querySelector("input")!.value).toBe("2024-01-15T00:00");
  });
});

describe("Date time input date mode", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows a date in local time", () => {
    const element = form_date_time({
      mode: FormDateTimeMode.DATE,
      value: new Date(2024, 0, 15, 10, 30),
    });
    expect(element.querySelector("input")!.value).toBe("2024-01-15T10:30");
  });

  it("shows a summer date in local time", () => {
    const element = form_date_time({
      mode: FormDateTimeMode.DATE,
      value: new Date(2024, 6, 15, 10, 30),
    });
    expect(element.querySelector("input")!.value).toBe("2024-07-15T10:30");
  });

  //In a time zone with daylight saving time, one of these two fails depending on the time of year the test runs,
  //the entered value is converted with the time zone offset of today instead of the offset of the entered date
  it("gives an entered winter date as local time", async () => {
    const change = vi.fn();
    const element = form_date_time({ mode: FormDateTimeMode.DATE, change });
    document.body.appendChild(element);
    await enter(element.querySelector("input")!, "2024-01-15T10:30");
    expect(change).toHaveBeenCalledOnce();
    const date = change.mock.calls[0][0] as Date;
    expect(date.getTime()).toBe(new Date(2024, 0, 15, 10, 30).getTime());
  });

  it("gives an entered summer date as local time", async () => {
    const change = vi.fn();
    const element = form_date_time({ mode: FormDateTimeMode.DATE, change });
    document.body.appendChild(element);
    await enter(element.querySelector("input")!, "2024-07-15T10:30");
    expect(change).toHaveBeenCalledOnce();
    const date = change.mock.calls[0][0] as Date;
    expect(date.getTime()).toBe(new Date(2024, 6, 15, 10, 30).getTime());
  });

  it("keeps showing the entered winter and summer dates", async () => {
    const element = form_date_time({ mode: FormDateTimeMode.DATE });
    document.body.appendChild(element);
    const input = element.querySelector("input")!;
    await enter(input, "2024-01-15T10:30");
    expect(input.value).toBe("2024-01-15T10:30");
    await enter(input, "2024-07-15T10:30");
    expect(input.value).toBe("2024-07-15T10:30");
  });
});
