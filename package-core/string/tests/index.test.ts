import { describe, expect, it } from "vitest";
import {
  string_byte_length,
  string_byte_limit,
  time_and_timezone_to_string,
} from "./index";

describe("Byte Length", function () {
  it("asdf is 4 bytes", function () {
    expect(string_byte_length("asdf")).toStrictEqual(4);
  });
  it("asdfæø is 8 bytes", function () {
    expect(string_byte_length("asdfæø")).toStrictEqual(8);
  });
  it("asdfæø💕💕 is 16 bytes", function () {
    expect(string_byte_length("asdfæø💕💕")).toStrictEqual(16);
  });
});

describe("Byte Limit", function () {
  it("asdf is 2 bytes", function () {
    expect(string_byte_limit("asdf", 2)).toStrictEqual("as");
  });
  it("asdfæø is 8 bytes", function () {
    expect(string_byte_limit("asdfæø", 5)).toStrictEqual("asdf");
  });
  it("asdfæø💕💕 is 16 bytes", function () {
    expect(string_byte_limit("asdfæø💕💕", 10)).toStrictEqual("asdfæø");
  });
});

describe("Time and timezone to string", function () {
  const time = new Date(Date.UTC(2024, 0, 1, 12, 0, 0, 123));
  it("Without offset prints UTC", function () {
    expect(time_and_timezone_to_string(time)).toBe("2024-01-01T12:00:00Z");
    expect(time_and_timezone_to_string(time, 0, true)).toBe(
      "2024-01-01T12:00:00.123Z"
    );
  });
  it("With offset prints the local time of that offset", function () {
    expect(time_and_timezone_to_string(time, 120)).toBe(
      "2024-01-01T14:00:00+02:00"
    );
    expect(time_and_timezone_to_string(time, -90, true)).toBe(
      "2024-01-01T10:30:00.123-01:30"
    );
  });
  it("The string is the same moment as the date", function () {
    for (const tz of [0, 60, -300, 345])
      expect(new Date(time_and_timezone_to_string(time, tz, true)).getTime()).toBe(
        time.getTime()
      );
  });
});
