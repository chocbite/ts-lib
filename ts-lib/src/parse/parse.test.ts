import { describe, expect, expectTypeOf, it } from "vitest";
import { make_parser, type Parsed } from "./parse";

describe("make_parser", () => {
  describe("Parsed", () => {
    it("should infer successful values from parser results", () => {
      const parse = make_parser({ id: "n", label: "s" });

      expectTypeOf<Parsed<typeof parse>>().toEqualTypeOf<{
        id: number;
        label: string;
      }>();
    });

    it("should infer root array parser values", () => {
      const parse = make_parser([0, { id: "n" }]);

      expectTypeOf<Parsed<typeof parse>>().toEqualTypeOf<{ id: number }[]>();
    });

    it("should infer transformed values from class subparsers", () => {
      const internal = make_parser({ id: "n" });

      class Item {
        constructor(public id: number) {}
      }

      const parse_item = (input: unknown) => {
        const result = internal(input);
        return result.ok ? new Item(result.value.id) : result;
      };

      expectTypeOf<Parsed<typeof parse_item>>().toEqualTypeOf<Item>();
    });
  });

  describe("type strings", () => {
    it("should parse single-char types", () => {
      const parse = make_parser({ n: "n", s: "s", b: "b" });
      const result = parse({ n: 1, s: "hi", b: true });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual({ n: 1, s: "hi", b: true });
    });

    it("should parse union type strings", () => {
      const parse = make_parser({ val: "ns" });
      expect(parse({ val: 42 }).ok).toBe(true);
      expect(parse({ val: "hi" }).ok).toBe(true);
      expect(parse({ val: true }).ok).toBe(false);
    });

    it("should parse union type strings containing null", () => {
      const parse = make_parser({ val: "nsbl" });
      expect(parse({ val: 42 }).ok).toBe(true);
      expect(parse({ val: "hi" }).ok).toBe(true);
      expect(parse({ val: true }).ok).toBe(true);
      expect(parse({ val: null }).ok).toBe(true);
    });

    it("should parse null-only type strings", () => {
      const parse = make_parser({ val: "l" });
      expect(parse({ val: null }).ok).toBe(true);
      expect(parse({ val: undefined }).ok).toBe(false);
      expect(parse({ val: 42 }).ok).toBe(false);
    });

    it("should reject wrong types with descriptive error", () => {
      const parse = make_parser({ count: "n" });
      const result = parse({ count: "oops" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(
          "Failed to parse due to member count being wrong type (expected number)",
        );
      }
    });

    it("should list all union options in error", () => {
      const parse = make_parser({ id: "ns" });
      const result = parse({ id: true });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("number or string");
    });
  });

  describe("nested objects", () => {
    const parse = make_parser({
      meta: { name: "s", age: "n", active: "b" },
    });

    it("should accept valid nested objects", () => {
      const result = parse({ meta: { name: "Alice", age: 30, active: true } });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.meta).toEqual({ name: "Alice", age: 30, active: true });
    });

    it("should reject when nested field has wrong type", () => {
      const result = parse({ meta: { name: "Alice", age: "thirty", active: true } });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("meta.age");
        expect(result.error).toContain("wrong type");
      }
    });

    it("should reject when nested value is not an object", () => {
      const result = parse({ meta: "not an object" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("meta");
    });
  });

  describe("nested parsers", () => {
    const parse_part = make_parser({ id: "n", label: "s" });
    const parse = make_parser({ part: parse_part });

    it("should infer and accept a nested parser's output", () => {
      const result = parse({ part: { id: 1, label: "one" } });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.part).toEqual({ id: 1, label: "one" });
        expectTypeOf(result.value.part).toEqualTypeOf<{ id: number; label: string }>();
      }
    });

    it("should reject values rejected by the nested parser", () => {
      const result = parse({ part: { id: "one", label: "one" } });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(
          'Failed to parse due to member part: Subparser Failed to parse: "Failed to parse due to member id being wrong type (expected number)"',
        );
      }
    });

    it("should reject a missing required nested parser value", () => {
      const result = parse({});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("part");
    });

    it("should support optional nested parsers", () => {
      const parse_optional = make_parser({ part: ["?", parse_part] as const });

      const missing = parse_optional({});
      expect(missing.ok).toBe(true);
      if (missing.ok) {
        expectTypeOf(missing.value.part).toEqualTypeOf<
          { id: number; label: string } | undefined
        >();
      }

      expect(parse_optional({ part: { id: 1, label: "one" } }).ok).toBe(true);
      expect(parse_optional({ part: { id: "one", label: "one" } }).ok).toBe(false);
    });

    it("should support nested parsers in schema unions", () => {
      const parse_union = make_parser({ part: [parse_part, "s"] as const });

      const nested = parse_union({ part: { id: 1, label: "one" } });
      expect(nested.ok).toBe(true);
      if (nested.ok) {
        expectTypeOf(nested.value.part).toEqualTypeOf<
          { id: number; label: string } | string
        >();
      }

      expect(parse_union({ part: "one" }).ok).toBe(true);
      expect(parse_union({ part: { id: "one", label: "one" } }).ok).toBe(false);
    });

    it("should retain a class returned by a nested parser", () => {
      class Part {
        constructor(
          public id: number,
          public label: string,
        ) {}
      }

      const parse_class = (input: unknown) => {
        const result = parse_part(input);
        return result.ok ? new Part(result.value.id, result.value.label) : result;
      };
      const parse = make_parser({ part: parse_class });

      const result = parse({ part: { id: 1, label: "one" } });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.part).toBeInstanceOf(Part);
        expectTypeOf(result.value.part).toEqualTypeOf<Part>();
      }
    });
  });

  describe("string tuples", () => {
    const parse = make_parser({ pair: ["nb", "s"] });

    it("should accept valid tuples", () => {
      expect(parse({ pair: [42, "hi"] }).ok).toBe(true);
      expect(parse({ pair: [true, "hi"] }).ok).toBe(true);
    });

    it("should reject wrong element type", () => {
      const result = parse({ pair: ["wrong", "hi"] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("pair[0]");
    });

    it("should reject wrong length", () => {
      const result = parse({ pair: [1, "hi", "extra"] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("wrong length");
    });

    it("should reject non-arrays", () => {
      const result = parse({ pair: "not an array" });
      expect(result.ok).toBe(false);
    });
  });

  describe("repeated tuples", () => {
    const parse = make_parser({ triple: [3, "s"] });

    it("should accept correct length with matching types", () => {
      expect(parse({ triple: ["a", "b", "c"] }).ok).toBe(true);
    });

    it("should reject wrong length", () => {
      const result = parse({ triple: ["a", "b"] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("wrong length");
    });

    it("should reject wrong element types", () => {
      const result = parse({ triple: ["a", 2, "c"] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("triple[1]");
    });
  });

  describe("variable-length arrays", () => {
    const parse = make_parser({ items: [0, "n"] });

    it("should accept empty arrays", () => {
      expect(parse({ items: [] }).ok).toBe(true);
    });

    it("should accept arrays of correct type", () => {
      expect(parse({ items: [1, 2, 3, 4, 5] }).ok).toBe(true);
    });

    it("should reject arrays with wrong element types", () => {
      const result = parse({ items: [1, 2, "three"] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("items[2]");
    });

    it("should reject non-arrays", () => {
      expect(parse({ items: 42 }).ok).toBe(false);
    });
  });

  describe("array root schemas", () => {
    const parse = make_parser([0, { bln: "nb", num: "ns" }]);

    it("should infer and accept arrays at the root", () => {
      const result = parse([
        { bln: true, num: 1 },
        { bln: 2, num: "two" },
      ]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([
          { bln: true, num: 1 },
          { bln: 2, num: "two" },
        ]);
        expectTypeOf(result.value).toEqualTypeOf<
          { bln: number | boolean; num: number | string }[]
        >();
      }
    });

    it("should reject invalid root array elements", () => {
      const result = parse([{ bln: "wrong", num: 1 }]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("root[0].bln");
    });
  });

  describe("records", () => {
    const parse = make_parser({ scores: ["{}", "n"] });

    it("should accept objects with unknown keys and infer a record", () => {
      const result = parse({ scores: { alice: 1, bob: 2 } });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.scores).toEqual({ alice: 1, bob: 2 });
        expectTypeOf(result.value.scores).toEqualTypeOf<Record<string, number>>();
      }
    });

    it("should accept empty objects", () => {
      expect(parse({ scores: {} }).ok).toBe(true);
    });

    it("should reject values with wrong type", () => {
      const result = parse({ scores: { alice: 1, bob: "two" } });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(
          "Failed to parse due to member scores.bob being wrong type (expected number)",
        );
      }
    });

    it("should reject non-objects", () => {
      expect(parse({ scores: null }).ok).toBe(false);
      expect(parse({ scores: [1, 2] }).ok).toBe(false);
      expect(parse({ scores: 42 }).ok).toBe(false);
    });

    it("should support nested object values", () => {
      const parse_users = make_parser({ users: ["{}", { name: "s", age: "n" }] });
      const result = parse_users({ users: { a: { name: "A", age: 1 } } });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expectTypeOf(result.value.users).toEqualTypeOf<
          Record<string, { name: string; age: number }>
        >();
      }
      expect(parse_users({ users: { a: { name: "A", age: "1" } } }).ok).toBe(false);
    });

    it("should support records at the root", () => {
      const parse_root = make_parser(["{}", "s"]);
      const result = parse_root({ a: "x", b: "y" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expectTypeOf(result.value).toEqualTypeOf<Record<string, string>>();
      }
      const failed = parse_root({ a: 1 });
      expect(failed.ok).toBe(false);
      if (!failed.ok) expect(failed.error).toContain("root.a");
    });

    it("should apply subparser transforms to values", () => {
      const parse_dates = make_parser({ dates: ["{}", (input: unknown) => new Date(input as string)] });
      const result = parse_dates({ dates: { start: "2026-01-01" } });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.dates.start).toBeInstanceOf(Date);
    });

    it("should not replace the prototype when transforming a __proto__ key", () => {
      const parse_transform = make_parser(["{}", (input: unknown) => ({ wrapped: input })]);
      const result = parse_transform('{"__proto__": {"polluted": true}}');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Object.getPrototypeOf(result.value)).toBe(Object.prototype);
        expect(Object.getOwnPropertyDescriptor(result.value, "__proto__")?.value).toEqual({
          wrapped: { polluted: true },
        });
      }
    });
  });

  describe("json string input", () => {
    const parse = make_parser({ x: "n" });

    it("should parse valid json strings", () => {
      expect(parse('{"x": 5}').ok).toBe(true);
    });

    it("should reject invalid json", () => {
      const result = parse("{bad}");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("Failed to parse valid json");
    });
  });

  describe("non-object input", () => {
    const parse = make_parser({ x: "n" });

    it("should reject null", () => {
      expect(parse(null).ok).toBe(false);
    });

    it("should reject arrays", () => {
      expect(parse([1, 2]).ok).toBe(false);
    });

    it("should reject primitives", () => {
      expect(parse(42).ok).toBe(false);
      expect(parse(true).ok).toBe(false);
    });

    it("should use a default factory when provided", () => {
      const parse_with_default = make_parser(
        { enabled: "b", count: ["?", "n", () => 42] as const },
        () => ({ enabled: false }),
      );

      const result = parse_with_default(null);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ enabled: false, count: 42 });
        expectTypeOf(result.value).toEqualTypeOf<{
          enabled: boolean;
          count: number;
        }>();
      }
    });

    it("should validate the default factory result", () => {
      const parse_with_invalid_default = make_parser(
        { enabled: "b" },
        () => ({ enabled: "false" }),
      );

      expect(parse_with_invalid_default(undefined).ok).toBe(false);
    });
  });

  describe("optional fields", () => {
    describe("optional defaults", () => {
      const parse = make_parser({ count: ["?", "n", () => 0] as const });

      it("should supply the default when the field is missing", () => {
        const result = parse({});
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toEqual({ count: 0 });
      });

      it("should supply the default when the field is undefined", () => {
        const result = parse({ count: undefined });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toEqual({ count: 0 });
      });

      it("should retain a present value and infer it without undefined", () => {
        const result = parse({ count: 3 });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual({ count: 3 });
          expectTypeOf(result.value.count).toEqualTypeOf<number>();
        }
      });

      it("should reject an invalid default", () => {
        const invalid_default = make_parser({ count: ["?", "n", () => "zero"] as const });
        expect(invalid_default({}).ok).toBe(false);
      });
    });

    describe("optional primitives", () => {
      const parse = make_parser({ name: "s", age: "?n" });

      it("should accept when optional field is present with correct type", () => {
        const result = parse({ name: "Alice", age: 30 });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toEqual({ name: "Alice", age: 30 });
      });

      it("should accept when optional field is undefined", () => {
        const result = parse({ name: "Alice", age: undefined });
        expect(result.ok).toBe(true);
      });

      it("should accept when optional field is missing", () => {
        const result = parse({ name: "Alice" });
        expect(result.ok).toBe(true);
      });

      it("should reject null without the null type character", () => {
        const result = parse({ name: "Alice", age: null });
        expect(result.ok).toBe(false);
      });

      it("should reject when optional field has wrong type", () => {
        const result = parse({ name: "Alice", age: "thirty" });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain("age");
      });
    });

    describe("optional arrays", () => {
      const parse = make_parser({ name: "s", scores: ["?", [0, "n"]] as const });

      it("should accept when optional array is present", () => {
        const result = parse({ name: "Alice", scores: [1, 2, 3] });
        expect(result.ok).toBe(true);
      });

      it("should accept when optional array is missing", () => {
        const result = parse({ name: "Alice" });
        expect(result.ok).toBe(true);
      });

      it("should reject null without the null type character", () => {
        const result = parse({ name: "Alice", scores: null });
        expect(result.ok).toBe(false);
      });

      it("should reject when optional array has wrong element types", () => {
        const result = parse({ name: "Alice", scores: [1, "two", 3] });
        expect(result.ok).toBe(false);
      });
    });

    describe("optional objects", () => {
      const parse = make_parser({ name: "s", addr: ["?", { street: "s", zip: "n" }] as const });

      it("should accept when optional object is present", () => {
        const result = parse({ name: "Alice", addr: { street: "Main St", zip: 12345 } });
        expect(result.ok).toBe(true);
      });

      it("should accept when optional object is missing", () => {
        const result = parse({ name: "Alice" });
        expect(result.ok).toBe(true);
      });

      it("should reject when optional object has wrong field types", () => {
        const result = parse({ name: "Alice", addr: { street: "Main St", zip: "bad" } });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain("addr.zip");
      });
    });
  });

  describe("schema unions", () => {
    const parse = make_parser({
      val: ["?nsbl", [5, "b"], { a: "n" }],
    });

    it("should accept any primitive, array, or object union member", () => {
      expect(parse({ val: undefined }).ok).toBe(true);
      expect(parse({ val: 42 }).ok).toBe(true);
      expect(parse({ val: "hello" }).ok).toBe(true);
      expect(parse({ val: true }).ok).toBe(true);
      expect(parse({ val: null }).ok).toBe(true);
      expect(parse({ val: [true, false, true, false, true] }).ok).toBe(true);
      expect(parse({ val: { a: 42 } }).ok).toBe(true);
    });

    it("should reject values outside every union member", () => {
      expect(parse({ val: [true, false] }).ok).toBe(false);
      expect(parse({ val: { a: "wrong" } }).ok).toBe(false);
    });
  });

  describe("complex schema", () => {
    const parse = make_parser({
      foo: "n",
      bar: "sb",
      baz: { bln: "nb", str: "s", num: "n" },
      field_c: ["nb", "s"],
      field_d: [3, "s"],
      field_e: [0, "s"],
    });

    it("should accept a fully valid complex object", () => {
      const result = parse({
        foo: 42,
        bar: "hello",
        baz: { bln: true, str: "test", num: 1 },
        field_c: [7, "yes"],
        field_d: ["a", "b", "c"],
        field_e: ["x", "y"],
      });
      expect(result.ok).toBe(true);
    });

    it("should reject when nested field fails", () => {
      const result = parse({
        foo: 42,
        bar: "hello",
        baz: { bln: "wrong", str: "test", num: 1 },
        field_c: [7, "yes"],
        field_d: ["a", "b", "c"],
        field_e: ["x", "y"],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("baz.bln");
    });
  });
});
