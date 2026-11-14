import { describe, expect, it } from "vitest";
import { schema_check, schema_object, type Schema } from "./index";

describe("schema", () => {
  const schema: Schema = schema_object({
    name: { type: "string" },
    kind: { type: "string", enum: ["a", "b"] },
    list: { type: "array", items: { anyOf: [{ type: "string", pattern: "^new:" }, { type: "integer" }] } },
  });
  it("accepts a matching value", () => {
    expect(schema_check(schema, { name: "x", kind: "a", list: ["new:x", 3] }).ok).toBe(true);
  });
  it("names the path of the problem", () => {
    expect(schema_check(schema, { name: "x", kind: "c", list: [] }).unwrap_err()).toContain("reply.kind");
    expect(schema_check(schema, { name: "x", kind: "a", list: ["old", 1] }).unwrap_err()).toContain("reply.list[0]");
    expect(schema_check(schema, { name: "x", kind: "a" }).unwrap_err()).toBe("reply.list is missing");
    expect(schema_check(schema, { name: "x", kind: "a", list: [], more: 1 }).unwrap_err()).toBe("reply.more is not allowed");
    expect(schema_check(schema, { name: "x", kind: "a", list: [1.5] }).err).toBe(true);
  });
});
