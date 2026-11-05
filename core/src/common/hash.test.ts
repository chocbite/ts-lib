import { describe, expect, it } from "vitest";
import { sha1 } from "./hash";

describe("sha1", () => {
  it.each([
    ["", "da39a3ee5e6b4b0d3255bfef95601890afd80709"],
    ["abc", "a9993e364706816aba3e25717850c26c9cd0d89d"],
    ["The quick brown fox jumps over the lazy dog", "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12"],
    ["The quick brown fox jumps over the lazy cog", "de9f2c7fd25e1b3afad3e85a0bd17d9b100db4b3"],
    ["The quick brown fox jumps over the lazy dog.".repeat(20), "6fca3304516c683cce9750846bf73ae0393c262d"],
  ])("hashes %j", (input, expected) => {
    expect(sha1(input)).toBe(expected);
  });

  it("encodes string input as UTF-8", () => {
    expect(sha1("Grüße, 世界")).toBe("3e5721529bceb180397d308b1fcf4ddcd13552d9");
  });

  it("hashes raw bytes", () => {
    expect(sha1(new Uint8Array([0, 1, 2, 255]))).toBe("c62c27924f4c967f5eddb1850c091d54c7a2ab58");
  });
});
