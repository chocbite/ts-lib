import type { Result, ResultOk } from "#result";
import { err, ok } from "#result";

type CharMap = {
  n: number;
  s: string;
  b: boolean;
  l: null;
};

type TypeCharOrder = ["n", "s", "b", "l"];

type OrderedTypeString<Chars extends readonly string[]> =
  Chars extends readonly [
    infer First extends string,
    ...infer Rest extends readonly string[],
  ]
    ? First | `${First}${OrderedTypeString<Rest>}` | OrderedTypeString<Rest>
    : never;

type TypeString = OrderedTypeString<TypeCharOrder>;
type OptionalTypeString = `?${TypeString}`;
type PrimitiveSpec = TypeString | OptionalTypeString;
type Parser = (input: unknown) => unknown;

type ParseTypeString<S extends string> = S extends `?${infer Rest}`
  ? ParseTypeString<Rest> | undefined
  : S extends `${infer C}${infer Rest}`
    ? C extends keyof CharMap
      ? CharMap[C] | ParseTypeString<Rest>
      : never
    : never;

type Repeat<
  T,
  N extends number,
  Acc extends unknown[] = [],
> = Acc["length"] extends N ? Acc : Repeat<T, N, [...Acc, T]>;

type ResolveStringTuple<
  T extends readonly string[],
  Acc extends unknown[] = [],
> = T extends readonly [
  infer First extends string,
  ...infer Rest extends readonly string[],
]
  ? ResolveStringTuple<Rest, [...Acc, ParseTypeString<First>]>
  : Acc;

type ResolveSpec<T> = T extends string
  ? ParseTypeString<T>
  : T extends Parser
    ? Parsed<T>
    : T extends readonly ["?", infer Sub, () => unknown]
      ? ResolveSpec<Sub>
      : T extends readonly ["?", infer Sub]
        ? ResolveSpec<Sub> | undefined
        : T extends readonly ["{}", infer Sub]
          ? Record<string, ResolveSpec<Sub>>
          : T extends readonly [0, infer Sub]
            ? ResolveSpec<Sub>[]
            : T extends readonly [infer N extends number, infer Sub]
              ? Repeat<ResolveSpec<Sub>, N>
              : T extends readonly PrimitiveSpec[]
                ? ResolveStringTuple<T>
                : T extends readonly SchemaQNSBL[]
                  ? ResolveSpec<T[number]>
                  : T extends object
                    ? { -readonly [K in keyof T]: ResolveSpec<T[K]> }
                    : never;

type InferSchema<S> = {
  -readonly [K in keyof S]: ResolveSpec<S[K]>;
};

type InferArraySchema<S extends readonly [0, unknown]> = S extends readonly [
  0,
  infer Item,
]
  ? ResolveSpec<Item>[]
  : never;

type InferRecordSchema<S extends readonly ["{}", unknown]> =
  S extends readonly ["{}", infer Item]
    ? Record<string, ResolveSpec<Item>>
    : never;

type SchemaQNSBL =
  | PrimitiveSpec
  | Parser
  | readonly ["?", SchemaQNSBL]
  | readonly ["?", SchemaQNSBL, () => unknown]
  | readonly ["{}", SchemaQNSBL]
  | readonly [number, SchemaQNSBL]
  | readonly SchemaQNSBL[]
  | { readonly [key: string]: SchemaQNSBL };

type ParsedReturn<T> =
  T extends ResultOk<infer Value>
    ? Value
    : T extends { ok: boolean }
      ? never
      : T;

export type Parsed<F extends (...args: any[]) => unknown> = ParsedReturn<
  ReturnType<F>
>;

type Transform = { transformed: unknown };

const char_display: Record<string, string> = {
  n: "number",
  s: "string",
  b: "boolean",
  l: "null",
};

function validate(
  value: unknown,
  spec: SchemaQNSBL,
  path: string,
): string | null | Transform {
  if (typeof spec === "function") {
    const result = spec(value);
    if (typeof result === "object" && result !== null && "ok" in result) {
      const parsed = result as Result<unknown, unknown>;
      if (!parsed.ok) {
        return `Failed to parse due to member ${path}: Subparser Failed to parse: "${String(parsed.error)}"`;
      }
      return parsed.value === value ? null : { transformed: parsed.value };
    }
    return result === value ? null : { transformed: result };
  }

  if (typeof spec === "string") {
    let type_spec: string = spec;
    if (type_spec.startsWith("?")) {
      if (value === undefined) return null;
      type_spec = type_spec.slice(1);
    }
    for (const char of type_spec) {
      if (char === "n" && typeof value === "number") return null;
      if (char === "s" && typeof value === "string") return null;
      if (char === "b" && typeof value === "boolean") return null;
      if (char === "l" && value === null) return null;
    }
    const expected = [...type_spec]
      .map((c) => char_display[c])
      .filter(Boolean)
      .join(" or ");
    return `Failed to parse due to member ${path} being wrong type (expected ${expected})`;
  }

  if (Array.isArray(spec)) {
    if (spec[0] === "?") {
      if (value === undefined) {
        if (spec.length === 2) return null;
        const default_value = (spec[2] as () => unknown)();
        const result = validate(default_value, spec[1] as SchemaQNSBL, path);
        if (typeof result === "string") return result;
        return result ?? { transformed: default_value };
      }
      return validate(value, spec[1] as SchemaQNSBL, path);
    }

    if (spec[0] === "{}") {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return `Failed to parse due to member ${path} being wrong type (expected object)`;
      }
      const record = value as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        const result = validate(
          record[key],
          spec[1] as SchemaQNSBL,
          `${path}.${key}`,
        );
        if (typeof result === "string") return result;
        // defineProperty avoids triggering the __proto__ setter for an own "__proto__" key
        if (result)
          Object.defineProperty(record, key, { value: result.transformed });
      }
      return null;
    }

    if (typeof spec[0] === "number") {
      const count = spec[0];
      const sub_spec = spec[1] as SchemaQNSBL;

      if (!Array.isArray(value)) {
        return `Failed to parse due to member ${path} being wrong type (expected array)`;
      }

      if (count === 0) {
        for (let i = 0; i < value.length; i++) {
          const result = validate(value[i], sub_spec, `${path}[${i}]`);
          if (typeof result === "string") return result;
          if (result) value[i] = result.transformed;
        }
        return null;
      }

      if (value.length !== count) {
        return `Failed to parse due to member ${path} having wrong length (expected ${count}, got ${value.length})`;
      }
      for (let i = 0; i < count; i++) {
        const result = validate(value[i], sub_spec, `${path}[${i}]`);
        if (typeof result === "string") return result;
        if (result) value[i] = result.transformed;
      }
      return null;
    }

    if (!spec.every((sub_spec) => typeof sub_spec === "string")) {
      for (const sub_spec of spec) {
        const result = validate(value, sub_spec as SchemaQNSBL, path);
        if (typeof result !== "string") return result;
      }
      return `Failed to parse due to member ${path} not matching any union type`;
    }

    if (!Array.isArray(value)) {
      return `Failed to parse due to member ${path} being wrong type (expected array)`;
    }
    if (value.length !== spec.length) {
      return `Failed to parse due to member ${path} having wrong length (expected ${spec.length}, got ${value.length})`;
    }
    for (let i = 0; i < spec.length; i++) {
      const result = validate(
        value[i],
        spec[i] as SchemaQNSBL,
        `${path}[${i}]`,
      );
      if (typeof result === "string") return result;
      if (result) value[i] = result.transformed;
    }
    return null;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return `Failed to parse due to member ${path} being wrong type (expected object)`;
  }
  const record = value as Record<string, unknown>;
  for (const [key, sub_spec] of Object.entries(
    spec as Record<string, SchemaQNSBL>,
  )) {
    const result = validate(record[key], sub_spec, `${path}.${key}`);
    if (typeof result === "string") return result;
    if (result) record[key] = result.transformed;
  }
  return null;
}

/** Creates a parser function from a schema definition.
 *
 * Type chars: "n" = number, "s" = string, "b" = boolean, "l" = null. Concatenate for unions ("sbl" = string | boolean | null).
 *
 * Schema spec values:
 * - Type string: "n", "sbl", "nsb" — primitive or union of primitive values
 * - Optional spec: prefix a type string with "?", or use ["?", spec] — permits a missing or undefined value
 * - Optional default: ["?", spec, () => defaultValue] — supplies a value when the input is missing or undefined
 * - Nested object: { key: spec } — recursively validated object
 * - Record: ["{}", spec] — object with unknown keys, every value validated against spec
 * - Nested parser: another parser created by `make_parser`
 * - String tuple: ["ns", "b"] — tuple with per-position types
 * - Repeated tuple: [3, "s"] — fixed-length tuple of N elements of the same type
 * - Variable-length array: [0, "n"] — array of any length with uniform element type
 * - Schema union: ["?nsl", [5, "b"], { a: "n" }] — accepts any listed schema
 *
 * @example
 * const parse_user = make_parser({
 *   name: "s",
 *   age: "n",
 *   active: "b",
 *   role: "ns",
 *   scores: [0, "n"],
 *   address: { street: "s", zip: "n" },
 *   settings: make_parser({ theme: "s" }),
 * });
 *
 * type User = Parsed<typeof parse_user>;
 * const result = parse_user(input);
 *
 * @param schema - Schema defining the expected root value
 * @param default_value - Optional factory used when an object schema receives a non-object input
 * @returns A parser that accepts unknown input (or JSON string) and returns Result<T, string>*/
export function make_parser<const S extends Record<string, SchemaQNSBL>>(
  schema: S,
  default_value: () => unknown,
): (input: unknown) => Result<InferSchema<S>, string>;
export function make_parser<const S extends Record<string, SchemaQNSBL>>(
  schema: S,
): (input: unknown) => Result<InferSchema<S>, string>;
export function make_parser<const S extends readonly [0, unknown]>(
  schema: S & readonly [0, SchemaQNSBL],
): (input: unknown) => Result<InferArraySchema<S>, string>;
export function make_parser<const S extends readonly ["{}", unknown]>(
  schema: S & readonly ["{}", SchemaQNSBL],
): (input: unknown) => Result<InferRecordSchema<S>, string>;
export function make_parser(
  schema: unknown,
  default_value?: () => unknown,
): (input: unknown) => Result<unknown, string> {
  return (input: unknown): Result<unknown, string> => {
    let obj: unknown;

    if (typeof input === "string") {
      try {
        obj = JSON.parse(input);
      } catch {
        return err("Failed to parse valid json");
      }
    } else {
      obj = input;
    }

    if (
      !Array.isArray(schema) &&
      typeof schema === "object" &&
      schema !== null
    ) {
      if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        if (!default_value)
          return err("Failed to parse: input is not an object");
        obj = default_value();
      }

      const record = obj as Record<string, unknown>;
      for (const [key, spec] of Object.entries(
        schema as Record<string, SchemaQNSBL>,
      )) {
        const result = validate(record[key], spec, key);
        if (typeof result === "string") return err(result);
        if (result) record[key] = result.transformed;
      }
    } else {
      const result = validate(obj, schema as SchemaQNSBL, "root");
      if (typeof result === "string") return err(result);
      if (result) obj = result.transformed;
    }

    return ok(obj);
  };
}
