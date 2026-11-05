import { describe, expect, it } from "vitest";
import { string_byte_length, string_byte_limit } from "./index";

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
