import { describe, expect, it } from "vitest";
import { mention_ids, mention_map, mention_parse, mention_plain } from "./index";

describe("mentions", () => {
  const text = "[Mara](char:mara-2) greets [the guard](char:guard) at [the inn](loc:inn).";
  it("parses mentions and plain text", () => {
    expect(mention_parse(text)).toEqual([
      { text: "Mara", id: "char:mara-2" },
      { text: " greets " },
      { text: "the guard", id: "char:guard" },
      { text: " at " },
      { text: "the inn", id: "loc:inn" },
      { text: "." },
    ]);
    expect(mention_ids(text)).toEqual(["char:mara-2", "char:guard", "loc:inn"]);
  });
  it("leaves normal links alone", () => {
    expect(mention_parse("[site](https://example.com)")).toEqual([{ text: "[site](https://example.com)" }]);
  });
  it("maps and strips mentions", () => {
    expect(mention_map(text, (t, id) => (id === "char:guard" ? "someone" : { text: t.toUpperCase(), id }))).toBe(
      "[MARA](char:mara-2) greets someone at [THE INN](loc:inn).",
    );
    expect(mention_plain(text)).toBe("Mara greets the guard at the inn.");
  });
});
