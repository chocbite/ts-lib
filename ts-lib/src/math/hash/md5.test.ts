import { describe, expect, it } from "vitest";
import { md5 } from "./md5";

describe("MD5", function () {
  it("abc", function () {
    expect(md5("abc").hex_small).toStrictEqual(
      "900150983cd24fb0d6963f7d28e17f72"
    );
  });
  it("", function () {
    expect(md5("").hex_small).toStrictEqual("d41d8cd98f00b204e9800998ecf8427e");
  });
  it("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", function () {
    expect(
      md5("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq").hex_small
    ).toStrictEqual("8215ef0796a20bcaaae116d3876c664a");
  });
  it("abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu", function () {
    expect(
      md5(
        "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"
      ).hex_small
    ).toStrictEqual("03dd8807a93175fb062dfb55dc7d359c");
  });
  it("1 million a", function () {
    const text = "".padEnd(1000000, "a");
    expect(md5(text).hex_small).toStrictEqual(
      "7707d6ae4e027c70eea2a935c2296f21"
    );
  });

  it("Return array of numbers", function () {
    expect(
      md5("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")
        .number_array
    ).toEqual([
      130, 21, 239, 7, 150, 162, 11, 202, 170, 225, 22, 211, 135, 108, 102, 74,
    ]);
  });
  it("Return uint8 array", function () {
    expect(
      md5("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")
        .uint8_array
    ).toEqual(
      new Uint8Array([
        130, 21, 239, 7, 150, 162, 11, 202, 170, 225, 22, 211, 135, 108, 102,
        74,
      ])
    );
  });
  it("Return small letter hexadecimal", function () {
    expect(
      md5("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq").hex_small
    ).toStrictEqual("8215ef0796a20bcaaae116d3876c664a");
  });
  it("Return big letter hexadecimal", function () {
    expect(
      md5("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq").hex_big
    ).toStrictEqual("8215EF0796A20BCAAAE116D3876C664A");
  });
});
