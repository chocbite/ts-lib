import { describe, expect, it } from "vitest";
import { ID_PATTERN, id_make, id_slug } from "./index";

describe("ids", () => {
  it("slugs names to lowercase ascii", () => {
    expect(id_slug("Mara Ølgaard-Søn")).toBe("mara-olgaard-son");
    expect(id_slug("Éowyn the Brave!")).toBe("eowyn-the-brave");
    expect(id_slug("???")).toBe("");
  });
  it("adds a number while the id is taken", () => {
    const taken = new Set(["char:mara", "char:mara-2"]);
    expect(id_make("char", "Mara", (id) => taken.has(id))).toBe("char:mara-3");
    expect(id_make("loc", "!!", () => false)).toBe("loc:unnamed");
  });
  it("makes ids matching the pattern", () => {
    for (const name of ["Mara", "Old Mill", "  x  ", "Ølgaard"]) expect(id_make("char", name, () => false)).toMatch(ID_PATTERN);
  });
});
