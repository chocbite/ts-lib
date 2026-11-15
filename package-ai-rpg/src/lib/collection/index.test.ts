import { describe, expect, it } from "vitest";
import { Collection } from "./index";

describe("collection", () => {
  it("keeps the state of an item when it changes, and tells the list which index changed", () => {
    const c = new Collection<{ id: string; name: string }>();
    c.reset([
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ]);
    const list = c.list.ok();
    const b = c.get("b")!;
    const seen: unknown[][] = [];
    c.list.sub((r) => seen.push([...r.value]));
    let b_value = "";
    b.sub((r) => (b_value = r.value.name));

    c.put({ id: "b", name: "Bee" });
    expect(c.get("b")).toBe(b);
    expect(b_value).toBe("Bee");
    expect(c.value("b")?.name).toBe("Bee");
    //Same array of the same states, the list only hears that an index changed
    expect(c.list.ok()).toBe(list);
    expect(seen.at(-1)).toEqual([c.get("a"), b]);
  });

  it("keeps items in id order, also new ones, and still finds changed items", () => {
    const c = new Collection<{ id: string; name: string }>();
    c.reset([
      { id: "m", name: "M" },
      { id: "a", name: "A" },
    ]);
    c.put({ id: "z", name: "Z" });
    c.put({ id: "f", name: "F" });
    expect(c.list.ok().map((s) => s.ok().id)).toEqual(["a", "f", "m", "z"]);
    c.put({ id: "m", name: "Em" });
    c.put({ id: "z", name: "Zed" });
    expect(c.list.ok().map((s) => s.ok().name)).toEqual(["A", "F", "Em", "Zed"]);
  });
});
