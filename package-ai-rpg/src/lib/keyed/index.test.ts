import { describe, expect, it } from "vitest";
import { Keyed } from "./index";

describe("keyed", () => {
  it("keeps the state of an entry while its key stays, and changes only what changed", () => {
    const keyed = new Keyed<{ id: string; v: number }>((e) => e.id, [
      { id: "a", v: 1 },
      { id: "b", v: 2 },
      { id: "c", v: 3 },
    ]);
    const rows = keyed.rows.ok();
    const [a, b] = rows;
    keyed.sync([
      { id: "b", v: 20 },
      { id: "a", v: 1 },
      { id: "d", v: 4 },
    ]);
    const now = keyed.rows.ok();
    expect(now[0]).toBe(b);
    expect(now[1]).toBe(a);
    expect(now.map((s) => s.ok())).toEqual([
      { id: "b", v: 20 },
      { id: "a", v: 1 },
      { id: "d", v: 4 },
    ]);
    //The same array, changed in place, so a list hears only the changes
    expect(now).toBe(rows);
  });
});
