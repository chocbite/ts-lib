import { describe, expect, it } from "vitest";
import { Hash, sha1 } from "../hash";

describe("sha1", () => {
  it.each([
    ["", "da39a3ee5e6b4b0d3255bfef95601890afd80709"],
    ["abc", "a9993e364706816aba3e25717850c26c9cd0d89d"],
    ["The quick brown fox jumps over the lazy dog", "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12"],
    ["The quick brown fox jumps over the lazy cog", "de9f2c7fd25e1b3afad3e85a0bd17d9b100db4b3"],
    ["The quick brown fox jumps over the lazy dog.".repeat(20), "6fca3304516c683cce9750846bf73ae0393c262d"],
  ])("hashes %j", (input, expected) => {
    expect(sha1(input).hex_small).toBe(expected);
  });

  it("encodes string input as UTF-8", () => {
    expect(sha1("Grüße, 世界").hex_small).toBe("3e5721529bceb180397d308b1fcf4ddcd13552d9");
  });

  it("hashes raw bytes", () => {
    expect(sha1(new Uint8Array([0, 1, 2, 255])).hex_small).toBe("c62c27924f4c967f5eddb1850c091d54c7a2ab58");
  });

  it("returns the digest bytes big endian", () => {
    const hash = sha1("abc");
    expect(hash.number_array.length).toBe(20);
    expect(hash.number_array.slice(0, 4)).toEqual([0xa9, 0x99, 0x3e, 0x36]);
    expect(hash.uint8_array).toEqual(new Uint8Array(hash.number_array));
    expect(hash.hex_big).toBe("A9993E364706816ABA3E25717850C26C9CD0D89D");
  });
});

describe("Hash", () => {
  it("gives out copies, so the digest can not be changed", () => {
    const hash = new Hash(new Uint8Array([1, 2, 255]));
    hash.uint8_array[0] = 9;
    hash.number_array[0] = 9;
    expect(hash.hex_small).toBe("0102ff");
    expect(hash.number_array).toEqual([1, 2, 255]);
  });
});
