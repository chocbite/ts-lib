//A small subset of JSON schema, enough to describe LLM replies.
//The same schema is sent to the server, which forces the reply into it (llama.cpp turns it into a grammar),
//and checks the reply here, as not every server enforces it.
import { err, ok, type Result } from "@chocbite/ts-lib/result";

interface SchemaBase {
  description?: string;
}
export interface SchemaString extends SchemaBase {
  type: "string";
  /**Allowed values, must not be empty*/
  enum?: readonly string[];
  pattern?: string;
}
export interface SchemaNumber extends SchemaBase {
  type: "number" | "integer";
}
export interface SchemaBoolean extends SchemaBase {
  type: "boolean";
}
export interface SchemaArray extends SchemaBase {
  type: "array";
  items: Schema;
}
export interface SchemaObject extends SchemaBase {
  type: "object";
  properties: { [key: string]: Schema };
  required?: readonly string[];
  additionalProperties?: false;
}
export interface SchemaAnyOf extends SchemaBase {
  anyOf: readonly Schema[];
}
export type Schema =
  | SchemaString
  | SchemaNumber
  | SchemaBoolean
  | SchemaArray
  | SchemaObject
  | SchemaAnyOf;

/**Object schema where every property is required and no others are allowed, what LLM replies are best forced into*/
export function schema_object(
  properties: { [key: string]: Schema },
  description?: string,
): SchemaObject {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
    ...(description ? { description } : {}),
  };
}

/**Checks a value against the schema, the error names the path of the first problem found
 * @returns the value typed as T, the caller must make sure the schema describes T*/
export function schema_check<T>(
  schema: Schema,
  value: unknown,
): Result<T, string> {
  const problem = check(schema, value, "reply");
  return problem ? err(problem) : ok(value as T);
}

function check(
  schema: Schema,
  value: unknown,
  path: string,
): string | undefined {
  if ("anyOf" in schema) {
    const problems = schema.anyOf.map((s) => check(s, value, path));
    if (problems.some((p) => p === undefined)) return undefined;
    return problems.join(", or ");
  }
  switch (schema.type) {
    case "string":
      if (typeof value !== "string") return `${path} must be a string`;
      if (schema.enum && !schema.enum.includes(value))
        return `${path} is "${value}", must be one of ${schema.enum.join(", ")}`;
      if (schema.pattern && !new RegExp(schema.pattern).test(value))
        return `${path} is "${value}", must match ${schema.pattern}`;
      return undefined;
    case "number":
    case "integer":
      if (typeof value !== "number" || !Number.isFinite(value))
        return `${path} must be a number`;
      if (schema.type === "integer" && !Number.isInteger(value))
        return `${path} must be a whole number`;
      return undefined;
    case "boolean":
      return typeof value === "boolean"
        ? undefined
        : `${path} must be true or false`;
    case "array":
      if (!Array.isArray(value)) return `${path} must be a list`;
      for (const [i, item] of value.entries()) {
        const problem = check(schema.items, item, `${path}[${i}]`);
        if (problem) return problem;
      }
      return undefined;
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value))
        return `${path} must be an object`;
      const record = value as { [key: string]: unknown };
      for (const key of schema.required ?? [])
        if (!(key in record)) return `${path}.${key} is missing`;
      for (const [key, item] of Object.entries(record)) {
        const sub = schema.properties[key];
        if (!sub) {
          if (schema.additionalProperties === false)
            return `${path}.${key} is not allowed`;
          continue;
        }
        const problem = check(sub, item, `${path}.${key}`);
        if (problem) return problem;
      }
      return undefined;
    }
  }
}
