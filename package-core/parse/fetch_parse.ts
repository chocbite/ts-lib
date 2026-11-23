import { is_promise_like, type Prettify } from "#common";
import { fetch_text_safe, safe } from "#safe";
import {
  err,
  err_nice,
  NiceError,
  ok,
  result as result_util,
  type Option,
  type Result,
  type ResultErr,
} from "#result";
import {
  state,
  STATE_ARRAY_READ_KEY,
  type StateArrayRead,
  type StateArrayReadTypes,
  type StateREA,
  type StateREAW,
  type StateResult,
  type StateROSW,
} from "#state";
import { fetch_parse_errors } from "./fetch_errors";
import { make_parser, type CheckDefaults, type Parsed } from "./parse";

type FetchTypeCharOrder = ["n", "s", "b", "l"];
type OrderedFetchTypeString<Chars extends readonly string[]> =
  Chars extends readonly [
    infer First extends string,
    ...infer Rest extends readonly string[],
  ]
    ?
        | First
        | `${First}${OrderedFetchTypeString<Rest>}`
        | OrderedFetchTypeString<Rest>
    : never;
type FetchTypeString = OrderedFetchTypeString<FetchTypeCharOrder>;
type FetchPrimitiveSpec =
  | FetchTypeString
  | `?${FetchTypeString}`
  | `${FetchTypeString}w`
  | `?${FetchTypeString}w`
  | FetchWriteOnlySpec;
/**A member that is only written, the server does not send it*/
type FetchWriteOnlySpec = `${FetchTypeString}wo`;
type Parser = (input: unknown) => unknown;

/**Options of a write only member with a default, the fourth entry of ["?", "nwo", () => default, options].
 * - reset: read the default again when a write finishes, whether it succeeded or failed,
 *   otherwise the last value written successfully is read*/
export type FetchWriteOnlyOptions = { readonly reset?: boolean };

export type ArrayWriteEncoder<T = any> = (value: T, index: number) => unknown;

/**Options for a dynamic array, the third entry of [0, item, options].
 * - write "single" (default): a write inside an item sends only that value, addressed by index, encode turns a written item into the payload.
 * - write "all": a write inside an item sends the whole array with the change, based on the last received value,
 *   and the array state itself is writable with plain item values or a state array write instruction.
 *   A change on the server since the last poll is overwritten by such a write.
 * - key: member of the object items that identifies them, like "id". Without it the states of an item follow its position,
 *   meant for arrays where positions do not change. With it they follow the item, the array reports real inserts, removals and moves,
 *   and writes find the item by key in the last received value. Index access gives undefined until a value is received.
 * - start: number of the first item on the server, added to the index of an item a write sends, in place of the array_start option*/
export type FetchArrayOptions<T = any> =
  | {
      readonly write?: "single";
      readonly encode?: ArrayWriteEncoder<T>;
      readonly key?: string;
      readonly start?: number;
    }
  | { readonly write: "all"; readonly key?: string; readonly start?: number };

/**Options for a fixed array, the third entry of [count, item, options].
 * - start: number of the first item on the server, added to the index of an item a write sends, in place of the array_start option*/
export type FetchFixedArrayOptions = { readonly start?: number };
export const FETCH_PARSE: unique symbol = Symbol("FETCH_PARSE");

export type FetchSchema = FetchPrimitiveSpec | FetchSchemaContainer;

/**An optional type string with a default, the default gives the type of the type string, one entry per type string.
 * A write only one can have options after the default*/
type FetchDefaultedTypeString = {
  [K in FetchPrimitiveSpec]: K extends FetchWriteOnlySpec
    ?
        | readonly ["?", K, () => ResolveString<K>]
        | readonly ["?", K, () => ResolveString<K>, FetchWriteOnlyOptions]
    : readonly ["?", K, () => ResolveString<K>];
}[FetchPrimitiveSpec];

/**Every spec but a type string, a default of a container or parser is checked by make_fetch_parser, see FetchDefaultErrors*/
type FetchSchemaContainer =
  | Parser
  | readonly ["?", FetchSchema]
  | FetchDefaultedTypeString
  | readonly ["?", FetchSchemaContainer, () => unknown]
  | readonly ["{}", FetchSchema]
  | readonly [number, FetchSchema]
  | readonly [number, FetchSchema, FetchFixedArrayOptions]
  | readonly [0, FetchSchema, ArrayWriteEncoder | FetchArrayOptions]
  | readonly FetchSchema[]
  | { readonly [key: string]: FetchSchema };

/**A message for every default in the schema that gives a value its spec does not allow, never when all fit, with the path to it.
 * The schema type checks the defaults of type strings, these are the ones of containers and parsers*/
type FetchDefaultErrors<S, P extends string = ""> =
  IsWholeSchema<S> extends true
    ? never
    : S extends string | Parser
      ? never
      : S extends readonly ["?", infer Item, () => infer Default, ...unknown[]]
        ?
            | ([Default] extends [ResolveSchema<Item>]
                ? never
                : `${P extends "" ? "root" : P}: the default gives a value the spec does not allow`)
            | FetchDefaultErrors<Item, P>
        : S extends readonly ["?", infer Item]
          ? FetchDefaultErrors<Item, P>
          : S extends readonly [0, infer Item, ...unknown[]]
            ? FetchDefaultErrors<Item, `${P}[]`>
            : S extends readonly ["{}" | number, infer Item, ...unknown[]]
              ? FetchDefaultErrors<Item, `${P}[]`>
              : S extends readonly unknown[]
                ? FetchDefaultErrors<S[number], `${P}[]`>
                : S extends object
                  ? {
                      [K in keyof S & string]: FetchDefaultErrors<
                        S[K],
                        P extends "" ? K : `${P}.${K}`
                      >;
                    }[keyof S & string]
                  : never;

/**True only for the generic FetchSchema itself, or FetchSchemaContainer, as in the constraint of a generic S.
 * Both contain themselves, so the recursive types below would recurse into it forever (TS2589).
 * They give a wide type for it instead. Lint rules ask for such constraints, an error there leaks into other types*/
type IsWholeSchema<S> = [FetchSchemaContainer] extends [S] ? true : false;

type RemoveWritable<S> = IsWholeSchema<S> extends true ? S : RemoveWritableEach<S>;
type RemoveWritableEach<S> = S extends string
  ? S extends `${infer Value}w`
    ? Value
    : S
  : S extends readonly [0, infer Item, ArrayWriteEncoder | FetchArrayOptions]
    ? readonly [0, RemoveWritable<Item>]
    : S extends readonly [infer Count extends number, infer Item, ...unknown[]]
      ? readonly [Count, RemoveWritable<Item>]
      : S extends readonly ["?", infer Item, infer Default]
        ? readonly ["?", RemoveWritable<Item>, Default]
        : S extends readonly ["?", infer Item]
          ? readonly ["?", RemoveWritable<Item>]
          : S extends readonly unknown[]
            ? { readonly [K in keyof S]: RemoveWritable<S[K]> }
            : S extends object
              ? { readonly [K in keyof S]: RemoveWritable<S[K]> }
              : S;

type CharMap = { n: number; s: string; b: boolean; l: null };
type ResolveString<S extends string> = S extends `?${infer Rest}`
  ? ResolveString<Rest> | undefined
  : S extends `${infer First}${infer Rest}`
    ? First extends keyof CharMap
      ? CharMap[First] | ResolveString<Rest>
      : never
    : never;
type Repeat<
  T,
  N extends number,
  Acc extends unknown[] = [],
> = Acc["length"] extends N ? Acc : Repeat<T, N, [...Acc, T]>;
type ResolveSchema<S> = IsWholeSchema<S> extends true ? unknown : ResolveSchemaEach<S>;
type ResolveSchemaEach<S> = S extends string
  ? ResolveString<RemoveWritable<S> & string>
  : S extends Parser
    ? Parsed<S>
    : S extends readonly ["?", infer Item, () => unknown]
      ? ResolveSchema<Item>
      : S extends readonly ["?", infer Item]
        ? ResolveSchema<Item> | undefined
  : S extends readonly ["{}", infer Item]
          ? Record<string, ResolveSchema<Item>>
  : S extends readonly [0, infer Item, ArrayWriteEncoder | FetchArrayOptions]
          ? ResolveSchema<Item>[]
          : S extends readonly [0, infer Item]
            ? ResolveSchema<Item>[]
            : S extends readonly [infer Count extends number, infer Item, ...unknown[]]
              ? Repeat<ResolveSchema<Item>, Count>
              : S extends readonly unknown[]
                ? { [K in keyof S]: ResolveSchema<S[K]> }
                : S extends object
                  ? ResolveObject<S>
                  : never;

/**Keys whose spec accepts a missing value, the parser leaves them out of the value when missing*/
type OptionalKeys<S> = {
  [K in keyof S]-?: undefined extends ResolveSchema<S[K]> ? K : never;
}[keyof S];

/**Write type of a write only spec, never for any other spec*/
type WriteOnlyType<S> = S extends `${infer Type extends FetchTypeString}wo`
  ? ResolveString<Type>
  : S extends readonly ["?", infer Item, ...unknown[]]
    ? WriteOnlyType<Item>
    : never;
/**True for a spec the server does not send, a write only type string,
 * or a fixed array, tuple, record or object of only write only members*/
type IsWriteOnly<S> =
  IsWholeSchema<S> extends true
    ? false
    : S extends FetchWriteOnlySpec
      ? true
      : S extends readonly ["?", infer Item, ...unknown[]]
        ? IsWriteOnly<Item>
        : S extends readonly [0, ...unknown[]]
          ? false
          : S extends readonly ["{}", infer Item]
            ? IsWriteOnly<Item>
            : S extends readonly [number, infer Item, ...unknown[]]
              ? IsWriteOnly<Item>
              : S extends readonly unknown[]
                ? false extends IsWriteOnly<S[number]>
                  ? false
                  : true
                : S extends string | Parser
                  ? false
                  : S extends object
                    ? [keyof S] extends [never]
                      ? false
                      : false extends { [K in keyof S]-?: IsWriteOnly<S[K]> }[keyof S]
                        ? false
                        : true
                    : false;
/**Keys of write only members, the server does not send them so they are not in the value*/
type WriteOnlyKeys<S> = {
  [K in keyof S]-?: IsWriteOnly<S[K]> extends true ? K : never;
}[keyof S];
/**A container with the state of its whole value under FETCH_PARSE, a write only container has none, the server does not send it*/
type WithFetchState<S, Value, T> =
  IsWriteOnly<S> extends true ? T : FetchContainer<Value> & T;

/**Value type of an object schema, keys that may be missing are optional.
 * An index signature, like the generic FetchSchema constraint, keeps the lazy mapped type,
 * flattening it would resolve FetchSchema inside itself forever*/
type ResolveObject<S> = string extends keyof S
  ? { -readonly [K in keyof S]: ResolveSchema<S[K]> }
  : Prettify<
      {
        -readonly [K in Exclude<
          keyof S,
          OptionalKeys<S> | WriteOnlyKeys<S>
        >]: ResolveSchema<S[K]>;
      } & {
        -readonly [K in Exclude<OptionalKeys<S>, WriteOnlyKeys<S>>]?: ResolveSchema<S[K]>;
      }
    >;

type Writable<S> = S extends string
  ? S extends `${string}w`
    ? true
    : false
  : false;

type FetchContainer<
  Value,
  State extends StateREA<Value> = StateREA<Value>,
> = { readonly [FETCH_PARSE]: State };
//Primitive items are wrapped, their state is under FETCH_PARSE
type FetchArrayItem<S, Value> = S extends string
  ? { readonly [FETCH_PARSE]: FetchNode<S, Value> }
  : FetchNode<S, Value>;
type FetchDynamicArrayItem<S, Value> = S extends string
  ? FetchNode<S, Value>
  : FetchNode<S, Value>;
type FetchRepeat<
  T,
  N extends number,
  Acc extends unknown[] = [],
> = Acc["length"] extends N ? Acc : FetchRepeat<T, N, [...Acc, T]>;
type FetchNode<S, Value> = IsWholeSchema<S> extends true
  ? StateREA<Value>
  : FetchNodeEach<S, Value>;
type FetchNodeEach<S, Value> = S extends FetchWriteOnlySpec
  ? StateROSW<undefined, Option<{}>, WriteOnlyType<S>>
  : S extends readonly ["?", FetchWriteOnlySpec, () => unknown, ...unknown[]]
    ? StateROSW<WriteOnlyType<S>, Option<{}>, WriteOnlyType<S>>
  : S extends string
  ? Writable<S> extends true
    ? StateREAW<Value, Option<{}>, Value>
    : StateREA<Value, Option<{}>, Value>
  : S extends readonly [0, infer Item, { readonly write: "all" }]
    ? StateREAW<
        FetchDynamicArrayItem<Item, ArrayItem<Value>>[],
        Option<{}>,
        Value
      > & {
        readonly [index: number]: FetchDynamicArrayItem<Item, ArrayItem<Value>>;
      }
    : S extends readonly [0, infer Item, ArrayWriteEncoder | FetchArrayOptions]
    ? StateREA<FetchDynamicArrayItem<Item, ArrayItem<Value>>[]> & {
        readonly [index: number]: FetchDynamicArrayItem<Item, ArrayItem<Value>>;
      }
    : S extends readonly [0, infer Item]
      ? StateREA<FetchDynamicArrayItem<Item, ArrayItem<Value>>[]> & {
          readonly [index: number]: FetchDynamicArrayItem<Item, ArrayItem<Value>>;
        }
      : S extends readonly ["?", infer Item, () => unknown]
        ? FetchNode<Item, Value>
        : S extends readonly ["?", infer Item]
          ? FetchNode<Item, Value>
          : S extends readonly ["{}", infer Item]
            ? WithFetchState<S, Value, {
                readonly [key: string]: FetchNode<Item, RecordItem<Value>>;
              }>
            : S extends readonly [infer Count extends number, infer Item, ...unknown[]]
            ? WithFetchState<S, Value,
                FetchRepeat<FetchArrayItem<Item, ArrayItem<Value>>, Count>>
            : S extends Parser
              ? StateREA<Value>
              : S extends object
                ? WithFetchState<S, Value, {
                    -readonly [K in keyof S]: FetchNode<
                      S[K],
                      ValueForKey<Value, K>
                    >;
                  }>
                : StateREA<Value>;

//Distributive, a member under an optional container is undefined when the container is
type ArrayItem<T> = T extends readonly (infer Item)[] ? Item : undefined;
type RecordItem<T> = T extends Record<string, infer Item> ? Item : undefined;
type ValueForKey<T, K> = T extends unknown
  ? K extends keyof T
    ? T[K]
    : undefined
  : never;

export type FetchParsed<S extends FetchSchema> = FetchContainer<ResolveSchema<S>> &
  (S extends readonly ["{}", infer Item]
    ? {
        readonly [key: string]: FetchNode<Item, RecordItem<ResolveSchema<S>>>;
      }
    : S extends object
      ? {
          -readonly [K in keyof S]: FetchNode<
            S[K],
            ValueForKey<ResolveSchema<S>, K>
          >;
        }
      : {});

export type FetchRequest = string | readonly [string, RequestInit];
/**Sends a write. An expected failure, like a rejection by the server, is returned as a NiceError,
 * a throw is a bug and is logged with console.error. The ok value is not used, fetch_status_safe fits as is*/
export type FetchWrite = (payload: unknown) => PromiseLike<Result<unknown, NiceError>>;

/**Fetches a request and gives the body text, or the text and the response like fetch_text_safe. An expected failure, like a network error, a timeout or a failed status,
 * is returned as a NiceError, a throw is a bug and is logged with console.error. fetch_text_safe fits as is.
 * init holds the signal that aborts the fetch when polling stops*/
export type FetchFunction = (
  url: string,
  init: RequestInit,
) => PromiseLike<Result<string | readonly [string, unknown], NiceError>>;

export type FetchParserOptions = {
  /**Sends a write, required when the schema contains writable values*/
  readonly write?: FetchWrite;
  /**Used in place of the default, fetch_text_safe*/
  readonly fetch?: FetchFunction;
  /**Time in ms to wait after a read that gave an error, in place of update_rate, so a server that is down is not asked every update.
   * Any error counts, also a response that fails to parse. Defaults to update_rate*/
  readonly retry_rate?: number;
  /**Number of the first array item on the server, added to every array index a write sends and to the index given to an encoder.
   * For servers that count from 1. Reading is not affected, received arrays are JSON arrays. Defaults to 0*/
  readonly array_start?: number;
  /**Time in ms to collect writes, they are then sent as one payload, the writes of different members merged.
   * Counted from the first write, every write gets the result of the one write call.
   * A write that would overwrite the write of another member, like an encoded array item, sends the collected writes first.
   * Defaults to 0, every write is sent at once*/
  readonly write_debounce?: number;
  /**Time in ms a request may take, then it is aborted and gives a safe.fetch.errors.TIMED_OUT, like any other failed read.
   * Also when a fetch given in the options ignores the signal. Defaults to 5000*/
  readonly timeout?: number;
};

/**Default of the timeout option*/
const TIMEOUT = 5000;

const default_fetch: FetchFunction = fetch_text_safe;

/**An error that is not supposed to happen, with an Error whose cause is where make_fetch_parser was called,
 * the stack of the failure only shows the polling of the parser, not which parser it is*/
function failure(kind: symbol, message: string, created_at: Error): NiceError {
  return new NiceError(kind, new Error(message, { cause: created_at }));
}

/**Logs a bug in code given to make_fetch_parser and gives the error result for it, the message says what is wrong*/
function bug(message: string, value: unknown, created_at: Error): ResultErr<NiceError> {
  console.error(`make_fetch_parser: ${message}, got`, value);
  return err(failure(fetch_parse_errors.UNEXPECTED, message, created_at));
}

/**Checks what a fetch function gave, the type is not enough as any and plain javascript get past it*/
function checked_body(value: unknown, created_at: Error): Result<string, NiceError> {
  if (!result_util.is_result(value)) return bug("fetch must return a Result", value, created_at);
  if (value.err)
    return value.error instanceof NiceError
      ? (value as ResultErr<NiceError>)
      : bug("fetch must give a NiceError as its error", value.error, created_at);
  const body: unknown = value.value;
  if (typeof body === "string") return ok(body);
  //The text and response of fetch_text_safe, only the text is parsed
  if (Array.isArray(body) && typeof body[0] === "string") return ok(body[0]);
  if (typeof Response !== "undefined" && body instanceof Response)
    return bug(
      "fetch returned a Response in its Result, return the body text instead, for example with fetch_text_safe from @chocbite/ts-lib/safe",
      body,
      created_at,
    );
  if (is_promise_like(body))
    return bug(
      "fetch returned a promise in its Result, await it before wrapping it in ok",
      body,
      created_at,
    );
  return bug("fetch must give the body as a string", body, created_at);
}

/**Logs a throw from code given to make_fetch_parser, it is a bug, and gives the error result for it.
 * The thrown Error is the cause, where it was thrown is only in the log*/
function unexpected(where: string, cause: unknown): ResultErr<NiceError> {
  console.error(`make_fetch_parser: unexpected error in ${where}`, cause);
  return err_nice(
    fetch_parse_errors.UNEXPECTED,
    cause instanceof Error ? cause : `${where} threw ${String(cause)}`,
  );
}

/**Path part of an array position, index is read in received arrays, the server gets index + start*/
class Position {
  constructor(
    readonly index: number,
    readonly start: number,
  ) {}
}

/**Path part of a keyed array item, the occurrence-th item whose key member equals value, start is the one of its array*/
class ItemKey {
  constructor(
    readonly key: string,
    readonly value: unknown,
    readonly occurrence: number,
    readonly start: number,
  ) {}
  /**Index of the item in the array, -1 when it is not there*/
  index_in(array: readonly unknown[]): number {
    let seen = 0;
    for (let i = 0; i < array.length; i++) {
      const item = array[i];
      if (
        item !== null &&
        typeof item === "object" &&
        (item as Record<string, unknown>)[this.key] === this.value &&
        seen++ === this.occurrence
      )
        return i;
    }
    return -1;
  }
}

type PathPart = string | Position | ItemKey;
type RuntimeSchema =
  | Record<string, unknown>
  | readonly unknown[]
  | string
  | Parser;
type RemoteOwner = {
  update_single(value: StateResult<unknown>, update?: boolean): void;
};

function set_fetch_state(target: object, fetch_state: StateREA<unknown>): void {
  Object.defineProperty(target, FETCH_PARSE, {
    value: fetch_state,
    enumerable: false,
    configurable: true,
  });
}

/**Options of a dynamic array schema [0, item, encoder | options], undefined for any other schema*/
function array_options(
  schema: unknown,
):
  | { write: "single" | "all"; encode?: ArrayWriteEncoder<unknown>; key?: string; start?: number }
  | undefined {
  if (!Array.isArray(schema) || schema[0] !== 0 || schema.length !== 3)
    return undefined;
  const options: unknown = schema[2];
  if (typeof options === "function")
    return { write: "single", encode: options as ArrayWriteEncoder<unknown> };
  const { write, encode, key, start } = options as {
    write?: "single" | "all";
    encode?: ArrayWriteEncoder<unknown>;
    key?: string;
    start?: number;
  };
  return { write: write ?? "single", encode, key, start };
}

/**True for a spec the server does not send, a write only type string, "nwo" or ["?", "nwo", ...],
 * or a fixed array, tuple, record or object of only write only members*/
function is_write_only(schema: unknown): boolean {
  if (typeof schema === "string") return schema.endsWith("wo");
  if (Array.isArray(schema)) {
    if (schema[0] === "?") return is_write_only(schema[1]);
    if (schema[0] === 0) return false;
    if (schema[0] === "{}" || typeof schema[0] === "number") return is_write_only(schema[1]);
    return schema.length > 0 && schema.every(is_write_only);
  }
  if (schema && typeof schema === "object") {
    const members = Object.values(schema);
    return members.length > 0 && members.every(is_write_only);
  }
  return false;
}

/**A write only state, "nwo" or ["?", "nwo", ...], not a container of them*/
function is_write_only_leaf(schema: unknown): boolean {
  if (typeof schema === "string") return schema.endsWith("wo");
  return Array.isArray(schema) && schema[0] === "?" && typeof schema[1] === "string" && schema[1].endsWith("wo");
}

/**Throws for a write only member where it can not be. It must be a member of an object, or inside a write only container,
 * as positions in a received list can not be left out, and outside write "all" arrays, which send the whole array built from the received value.
 * @param root the schema of the parser, its members are checked, not the schema itself*/
function check_write_only(
  schema: unknown,
  in_object = false,
  in_all = false,
  root = false,
): void {
  if (!root && is_write_only(schema)) {
    const shown = JSON.stringify(schema);
    if (!in_object)
      throw new Error(
        `The write only member ${shown} must be a member of an object, or in a fixed array, tuple, record or object of only write only members`,
      );
    if (in_all)
      throw new Error(`The write only member ${shown} can not be inside a write "all" array`);
    check_write_only_prefix(schema);
    return;
  }
  if (typeof schema === "string") {
    //A write only string here is in a received list
    if (schema.endsWith("wo"))
      throw new Error(
        `The write only member "${schema}" must be a member of an object, or in a fixed array, tuple, record or object of only write only members`,
      );
    return;
  }
  if (Array.isArray(schema)) {
    if (schema[0] === "?") return check_write_only(schema[1], in_object, in_all);
    const options = array_options(schema);
    if (options)
      return check_write_only(schema[1], false, in_all || options.write === "all");
    if (schema[0] === 0 || schema[0] === "{}" || typeof schema[0] === "number")
      return check_write_only(schema[1], false, in_all);
    for (const entry of schema) check_write_only(entry, false, in_all);
    return;
  }
  if (schema && typeof schema === "object")
    for (const value of Object.values(schema)) check_write_only(value, true, in_all);
}

/**Throws when the default of a write only member is not of its type, type_chars like "ns"*/
function check_write_only_default(
  path: readonly PathPart[],
  value: unknown,
  type_chars: string,
): void {
  const fits = [...type_chars].some(
    (char) =>
      (char === "n" && typeof value === "number") ||
      (char === "s" && typeof value === "string") ||
      (char === "b" && typeof value === "boolean") ||
      (char === "l" && value === null),
  );
  if (!fits)
    throw new Error(
      `The default of the write only member at ${path.map(part_text).join(".")} gives ${JSON.stringify(value)}, which is not of the type "${type_chars}"`,
    );
}

/**Throws for a write only type string with a "?" prefix, inside a write only spec*/
function check_write_only_prefix(schema: unknown): void {
  if (typeof schema === "string") {
    if (schema.startsWith("?"))
      throw new Error(`The write only member "${schema}" can not have a "?" prefix, use ["?", spec, () => default] for a default`);
    return;
  }
  if (Array.isArray(schema)) {
    if (schema[0] === "?" || schema[0] === "{}" || typeof schema[0] === "number")
      return check_write_only_prefix(schema[1]);
    for (const entry of schema) check_write_only_prefix(entry);
    return;
  }
  if (schema && typeof schema === "object")
    for (const value of Object.values(schema)) check_write_only_prefix(value);
}

function strip_writable(schema: unknown): unknown {
  if (typeof schema === "string")
    return schema.endsWith("w") ? schema.slice(0, -1) : schema;
  if (!Array.isArray(schema)) {
    if (schema && typeof schema === "object") {
      //Write only members are not received, the parser does not look at them
      return Object.fromEntries(
        Object.entries(schema)
          .filter(([, value]) => !is_write_only(value))
          .map(([key, value]) => [key, strip_writable(value)]),
      );
    }
    return schema;
  }
  if (array_options(schema)) return [0, strip_writable(schema[1])];
  //The options of a fixed array are not for the parser
  if (typeof schema[0] === "number") return [schema[0], strip_writable(schema[1])];
  return schema.map(strip_writable);
}

function has_writable(schema: unknown): boolean {
  if (typeof schema === "string") return schema.endsWith("w") || schema.endsWith("wo");
  const options = array_options(schema);
  if (options)
    return options.write === "all" || has_writable((schema as unknown[])[1]);
  if (Array.isArray(schema)) return schema.some(has_writable);
  return Boolean(
    schema &&
    typeof schema === "object" &&
    Object.values(schema).some(has_writable),
  );
}

/**The value at path.
 * @param optional_at index of the first optional part of the path, a member missing from there on reads as undefined*/
function result_at_path(
  value: StateResult<unknown>,
  path: readonly PathPart[],
  optional_at = Infinity,
  created_at: Error,
): StateResult<unknown> {
  if (value.err) return err(value.error);
  const resolved = resolve_path(value.value, path);
  if (resolved instanceof MissingPart)
    return resolved.at >= optional_at
      ? ok(undefined)
      : err(failure(fetch_parse_errors.MEMBER_MISSING, resolved.message, created_at));
  let current: unknown = value.value;
  for (const part of resolved)
    current = (current as Record<string | number, unknown>)[index_of(part)];
  return ok(current);
}

/**A path part with keyed items found, string keys and array positions*/
type IndexPart = string | Position;
/**A part of a path as the server addresses it, positions with their start added*/
type SentPart = string | number;

/**The key of a part in the received value*/
const index_of = (part: IndexPart): string | number =>
  part instanceof Position ? part.index : part;

/**A path part for messages*/
const part_text = (part: PathPart): string =>
  part instanceof Position
    ? String(part.index)
    : part instanceof ItemKey
      ? `${part.key}=${String(part.value)}`
      : part;

/**Where a path could not be followed*/
class MissingPart {
  constructor(
    readonly at: number,
    readonly message: string,
  ) {}
}

/**Replaces the key lookups of a path with the current index of their item in value.
 * @returns the path, or where it could not be followed*/
function resolve_path(
  value: unknown,
  path: readonly PathPart[],
): IndexPart[] | MissingPart {
  const resolved: IndexPart[] = [];
  let current = value;
  for (const [at, part] of path.entries()) {
    const missing = () =>
      new MissingPart(
        at,
        part instanceof ItemKey
          ? `Failed to read missing item with ${part.key} ${String(part.value)}`
          : `Failed to read missing member ${part_text(part)}`,
      );
    if (current === null || typeof current !== "object") return missing();
    let index: IndexPart;
    if (part instanceof ItemKey) {
      const found = Array.isArray(current) ? part.index_in(current) : -1;
      if (found === -1) return missing();
      index = new Position(found, part.start);
    } else if (Object.hasOwn(current, index_of(part))) index = part;
    else return missing();
    resolved.push(index);
    current = (current as Record<string | number, unknown>)[index_of(index)];
  }
  return resolved;
}

function payload_at_path(path: readonly SentPart[], value: unknown): unknown {
  let payload = value;
  for (let index = path.length - 1; index >= 0; index--) {
    payload = { [path[index]!]: payload };
  }
  return payload;
}

/**Returns a copy of base with value set at path, only the containers on the path are copied.
 * Undefined when a container on the path is missing, like an item the server removed*/
function with_value_at(
  base: unknown,
  path: readonly IndexPart[],
  value: unknown,
): unknown {
  if (path.length === 0) return value;
  if (base === null || typeof base !== "object") return undefined;
  const [first, ...rest] = path as [IndexPart, ...IndexPart[]];
  const part = index_of(first);
  if (rest.length > 0 && !Object.hasOwn(base, part)) return undefined;
  const child = with_value_at(
    (base as Record<string | number, unknown>)[part],
    rest,
    value,
  );
  if (child === undefined && rest.length > 0) return undefined;
  const copy = Array.isArray(base)
    ? [...(base as unknown[])]
    : { ...(base as Record<string | number, unknown>) };
  (copy as Record<string | number, unknown>)[part] = child;
  return copy;
}

type MutableArrayChange =
  | { type: "added" | "removed"; index: number; items: unknown[] }
  | { type: "moved"; from_index: number; to_index: number; items: unknown[] };

/**Changes that turn previous into current, items are compared by identity.
 * Applied in order like state array reads: removals from the end first, then additions and moves from the start*/
function array_changes(
  previous: readonly unknown[],
  current: readonly unknown[],
): StateArrayReadTypes<unknown>[] {
  const changes: MutableArrayChange[] = [];
  const work = [...previous];
  const kept = new Set(current);
  for (let i = work.length - 1; i >= 0; i--) {
    if (kept.has(work[i])) continue;
    const last = changes.at(-1);
    if (last?.type === "removed" && last.index === i + 1) {
      last.index = i;
      last.items.unshift(work[i]);
    } else changes.push({ type: "removed", index: i, items: [work[i]] });
    work.splice(i, 1);
  }
  for (let i = 0; i < current.length; i++) {
    const item = current[i];
    if (work[i] === item) continue;
    const from = work.indexOf(item, i + 1);
    if (from === -1) {
      const last = changes.at(-1);
      if (last?.type === "added" && last.index + last.items.length === i)
        last.items.push(item);
      else changes.push({ type: "added", index: i, items: [item] });
      work.splice(i, 0, item);
    } else {
      changes.push({ type: "moved", from_index: from, to_index: i, items: [item] });
      work.splice(from, 1);
      work.splice(i, 0, item);
    }
  }
  return changes;
}

/**Payload of a write that can not be built, the write function is never called with it*/
class UnsentWrite {
  constructor(readonly error: NiceError) {}
}

/**Payload of a write with the member it writes, as the server addresses it, so a batch can tell members apart*/
class Outgoing {
  constructor(
    readonly payload: unknown,
    readonly member: string,
  ) {}
}

const is_plain_object = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

/**Paths to the values of a payload that are not plain objects, arrays are values as they are sent whole*/
function leaf_paths(payload: unknown, path: string[] = []): string[][] {
  if (!is_plain_object(payload)) return [path];
  return Object.entries(payload).flatMap(([key, value]) =>
    leaf_paths(value, [...path, key]),
  );
}

/**True when one path is the other or inside it*/
const paths_overlap = (a: readonly string[], b: readonly string[]): boolean =>
  a.slice(0, b.length).every((part, i) => part === b[i]) ||
  b.slice(0, a.length).every((part, i) => part === a[i]);

/**Copy of base with payload merged in, plain objects are merged, anything else replaces*/
function merge_payload(base: unknown, payload: unknown): unknown {
  if (!is_plain_object(base) || !is_plain_object(payload)) return payload;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(payload))
    merged[key] = key in merged ? merge_payload(merged[key], value) : value;
  return merged;
}

/**Writes waiting for write_debounce, merged into one payload*/
type WriteBatch = {
  payload: unknown;
  /**The leaf paths of the payload and the member that wrote them*/
  leaves: { path: string[]; member: string }[];
  done: ((result: StateResult<void>) => void)[];
  timer: ReturnType<typeof setTimeout>;
};

function request_parts(
  request: FetchRequest,
): [string, RequestInit | undefined] {
  return typeof request === "string"
    ? [request, undefined]
    : [request[0], request[1]];
}

/** Creates a polling remote state and parsed state projections from a fetch schema. */
export function make_fetch_parser<const S extends FetchSchema>(
  request: () => FetchRequest,
  update_rate: number,
  schema: S & CheckDefaults<S, FetchDefaultErrors<S>>,
  options?: FetchParserOptions,
): FetchParsed<S> {
  check_write_only(schema, false, false, true);
  if (has_writable(schema) && !options?.write) {
    throw new Error(
      "A write function is required when the schema contains writable values",
    );
  }

  //Where this parser is made, the cause of its errors that are not supposed to happen, made once per parser
  const created_at = new Error("make_fetch_parser was called here");
  const at_path = (value: StateResult<unknown>, path: readonly PathPart[], optional_at?: number) =>
    result_at_path(value, path, optional_at, created_at);

  const parse = make_parser(
    strip_writable(schema) as RuntimeSchema & Record<string, never>,
  );
  const fetch_with: FetchFunction = options?.fetch ?? default_fetch;
  let timer: ReturnType<typeof setTimeout> | undefined;
  //Each subscription gets its own controller, ending it aborts its fetches and stops its polling
  let subscription: AbortController | undefined;
  const timeout = options?.timeout ?? TIMEOUT;
  /**Fetches with the timeout, the request is aborted when the subscription of the signal ends or the time is up.
   * The time being up gives TIMED_OUT also when the fetch ignores the signal, so a request never hangs the polling*/
  const fetch_timed = (url: string, init: RequestInit | undefined, signal?: AbortSignal) => {
    const controller = new AbortController();
    const end = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", end, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timed_out = new Promise<ResultErr<NiceError>>((resolve) => {
      timer = setTimeout(() => {
        //The name tells fetch and fetch_text_safe it is a timeout, not an abort
        const error = new Error(`No answer within ${timeout}ms`);
        error.name = "TimeoutError";
        controller.abort(error);
        resolve(err_nice(safe.fetch.errors.TIMED_OUT, error));
      }, timeout);
    });
    //Started right away, a throw of the fetch becomes a rejection, so the timer and listener are always cleaned up
    const fetching = new Promise<Awaited<ReturnType<FetchFunction>>>((resolve) =>
      resolve(fetch_with(url, { ...init, signal: controller.signal })),
    );
    return Promise.race([fetching, timed_out]).finally(() => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", end);
    });
  };

  //Expected failures arrive as errors, a throw from request or fetch is a bug
  const read = async (signal?: AbortSignal): Promise<StateResult<unknown>> => {
    let url: string;
    let init: RequestInit | undefined;
    try {
      [url, init] = request_parts(request());
    } catch (cause) {
      return unexpected("request", cause);
    }
    let fetched: unknown;
    try {
      fetched = await fetch_timed(url, init, signal);
    } catch (cause) {
      return unexpected("fetch", cause);
    }
    const body = checked_body(fetched, created_at);
    if (body.err) return body;
    return parse(body.value).map_err(
      (message) => failure(fetch_parse_errors.INVALID_DATA, message, created_at),
    );
  };

  // One-shot reads always answer so pending reads resolve, subscription fetches only notify while that subscription lasts
  //The last received value, write "all" arrays build their payload from it
  let latest: StateResult<unknown> = err_nice(
    fetch_parse_errors.NO_VALUE,
    "No value received yet",
  );
  /**@returns if the read gave a value*/
  const load = async (
    owner: RemoteOwner,
    signal?: AbortSignal,
  ): Promise<boolean> => {
    const result = await read(signal);
    if (signal?.aborted) return false;
    if (result.ok) latest = result;
    owner.update_single(result, Boolean(signal));
    return result.ok;
  };

  //A poll request of the subscription is running, and a read waits for its answer instead of fetching itself
  let polling = false;
  let read_waits = false;
  /**One poll of the subscription, its answer also answers the reads waiting*/
  const poll = async (owner: RemoteOwner, signal: AbortSignal): Promise<boolean> => {
    polling = true;
    const loaded = await load(owner, signal);
    //An ended subscription has handed its waiting reads on in teardown, a new one may be polling by now
    if (!signal.aborted) polling = read_waits = false;
    return loaded;
  };

  const retry_rate = options?.retry_rate ?? update_rate;
  const schedule = (owner: RemoteOwner, signal: AbortSignal, loaded: boolean) => {
    if (signal.aborted) return;
    timer = setTimeout(
      async () => schedule(owner, signal, await poll(owner, signal)),
      loaded ? update_rate : retry_rate,
    );
  };

  const array_start = options?.array_start ?? 0;
  /**A path as the server numbers it, numbers in a path are always array positions, object and record keys are strings*/
  const to_server = (path: readonly IndexPart[]): SentPart[] =>
    path.map((part) => (part instanceof Position ? part.index + part.start : part));

  /**Calls write once, expected failures are its error, a throw or a wrong return value is a bug*/
  const send = async (payload: unknown): Promise<StateResult<void>> => {
    if (!options?.write)
      return err(failure(state.errors.NOT_WRITABLE, "No write function given", created_at));
    let written: unknown;
    try {
      written = await options.write(payload);
    } catch (cause) {
      return unexpected("write", cause);
    }
    //The type is not enough as any and plain javascript get past it
    if (!result_util.is_result(written)) return bug("write must return a Result", written, created_at);
    if (written.ok) return ok(undefined);
    return written.error instanceof NiceError
      ? (written as ResultErr<NiceError>)
      : bug("write must give a NiceError as its error", written.error, created_at);
  };

  const write_debounce = options?.write_debounce ?? 0;
  let batch: WriteBatch | undefined;

  /**Sends the waiting writes as one, every write of the batch gets the result*/
  const send_batch = async () => {
    const sending = batch;
    if (!sending) return;
    batch = undefined;
    clearTimeout(sending.timer);
    const result = await send(sending.payload);
    for (const done of sending.done) done(result);
  };

  /**Merges a write into the batch, a write that would overwrite the write of another member sends the batch first,
   * like encoded items, which all go to the same key of their array*/
  const add_to_batch = (outgoing: Outgoing): Promise<StateResult<void>> => {
    const leaves = leaf_paths(outgoing.payload);
    if (
      batch?.leaves.some(
        (leaf) =>
          leaf.member !== outgoing.member &&
          leaves.some((path) => paths_overlap(path, leaf.path)),
      )
    )
      void send_batch();
    batch ??= {
      payload: undefined,
      leaves: [],
      done: [],
      timer: setTimeout(() => void send_batch(), write_debounce),
    };
    const current = batch;
    //A member written again replaces its earlier write
    current.leaves = current.leaves.filter((leaf) => leaf.member !== outgoing.member);
    current.leaves.push(...leaves.map((path) => ({ path, member: outgoing.member })));
    current.payload = merge_payload(current.payload, outgoing.payload);
    return new Promise((resolve) => current.done.push(resolve));
  };

  /**The array waiting in the batch at a path, write "all" arrays build on it so writes in one batch keep each other*/
  const pending_array_at = (path: readonly IndexPart[]): unknown[] | undefined => {
    let current = batch?.payload;
    for (const part of to_server(path)) {
      if (!is_plain_object(current)) return undefined;
      current = current[String(part)];
    }
    return Array.isArray(current) ? current : undefined;
  };

  const root = state.r.reaw.from<unknown, any, unknown>(
    //While polling, the value is valid and only reads before the first answer get here, they wait for it
    (owner) => {
      if (polling) read_waits = true;
      else void load(owner);
    },
    (owner) => {
      subscription = new AbortController();
      const signal = subscription.signal;
      void poll(owner, signal).then((loaded) => schedule(owner, signal, loaded));
    },
    (owner) => {
      subscription?.abort();
      subscription = undefined;
      if (timer) clearTimeout(timer);
      timer = undefined;
      //The aborted poll gives no answer, so reads waiting for it fetch themselves
      if (read_waits) void load(owner);
      polling = read_waits = false;
    },
    (payload) => {
      if (payload instanceof UnsentWrite) return Promise.resolve(err(payload.error));
      //A write to the root itself is a member of its own
      const outgoing = payload instanceof Outgoing ? payload : new Outgoing(payload, "");
      if (write_debounce <= 0) return send(outgoing.payload);
      return add_to_batch(outgoing);
    },
    //Polling keeps the value current, so it is valid while subscribed, errors included until the next poll.
    //The own timeout of the state is later than the one of the request, so a read gets the TIMED_OUT of the request
    { validity: true, timeout: timeout + 1000 },
  ) as StateREAW<ResolveSchema<S>, any, unknown>;

  /**Builds the payload for writing value at path.
   * Inside a write "all" array the whole array at all_path is sent, with value set in a copy of the last received array,
   * otherwise only the value is sent, wrapped in the path, an encoder replaces the last index with the encoded item*/
  const payload_for = (
    path: readonly PathPart[],
    value: unknown,
    encoder?: ArrayWriteEncoder<unknown>,
    all_path?: readonly PathPart[],
  ): unknown => {
    //Keyed items are found by key in the last received value, the members after the last item are kept as they are
    const last_key = path.findLastIndex((part) => part instanceof ItemKey);
    let concrete = path as readonly IndexPart[];
    if (last_key !== -1) {
      if (latest.err) return new UnsentWrite(latest.error);
      const items = resolve_path(latest.value, path.slice(0, last_key + 1));
      if (items instanceof MissingPart)
        return new UnsentWrite(
          failure(fetch_parse_errors.ITEM_GONE, "Failed to write, the item no longer exists", created_at),
        );
      concrete = [...items, ...(path.slice(last_key + 1) as IndexPart[])];
    }
    if (!all_path) {
      const sent = to_server(concrete);
      return new Outgoing(
        payload_at_path(
          sent.slice(0, encoder ? -1 : undefined),
          encoder ? encoder(value, sent.at(-1) as number) : value,
        ),
        JSON.stringify(sent),
      );
    }
    const all_concrete = concrete.slice(0, all_path.length);
    const base = array_base_at(all_concrete);
    if (base.err) return new UnsentWrite(base.error);
    //Positions inside the array sent stay as they are, it is sent whole
    const array = with_value_at(base.value, concrete.slice(all_path.length), value);
    if (array === undefined)
      return new UnsentWrite(
          failure(fetch_parse_errors.ITEM_GONE, "Failed to write, the item no longer exists", created_at),
        );
    //The whole array is one member, a later write in it is built on this one and replaces it
    const sent_path = to_server(all_concrete);
    return new Outgoing(payload_at_path(sent_path, array), JSON.stringify(sent_path));
  };

  /**The array a write "all" array builds on, the one waiting in the batch, else the last received one*/
  const array_base_at = (path: readonly IndexPart[]): Result<unknown[], NiceError> => {
    const pending = pending_array_at(path);
    if (pending) return ok(pending);
    const base = at_path(latest, path);
    if (base.err) return err(base.error);
    if (!Array.isArray(base.value))
      return err(
        failure(
          fetch_parse_errors.INVALID_DATA,
          "Failed to write array, the received value is not an array",
          created_at,
        ),
      );
    return ok(base.value as unknown[]);
  };

  /**Writable projection of the root, a written value is sent as the payload built from it.
   * The root has no limit or check of its own, they give the payload back as it is,
   * so a value that passes is given back as it is, a payload can not always be turned back into the value*/
  const writable = (
    transform: (result: StateResult<unknown>) => StateResult<unknown>,
    to_payload: (value: unknown) => unknown,
  ) =>
    (root as StateREAW<unknown, any, unknown>).proxy_w(transform, {
      write: (value: unknown, source) => source.write(to_payload(value)),
      check: (value, source) =>
        source.check(to_payload(value)).then((checked) => checked.map(() => value)),
      limit: (value, source) =>
        source.limit(to_payload(value)).then((limited) => limited.map(() => value)),
    });

  /**State of a write only member, a local state, so reading it never fetches.
   * A write is sent like the write of a writable member and is read at once.
   * When the last write finishes the state reads the last value written successfully, or with reset the default.
   * Without a default it always reads undefined*/
  const write_only = (
    path: readonly PathPart[],
    encoder: ArrayWriteEncoder<unknown> | undefined,
    type_chars: string,
    default_value?: () => unknown,
    reset = false,
  ) => {
    let kept = default_value?.();
    //Nothing parses the default of a write only member, the types check it, plain javascript and any get past them
    if (default_value) check_write_only_default(path, kept, type_chars);
    //Only the last write decides what is read when it finishes
    let last_write = 0;
    return state.rosw<unknown, unknown>(ok(kept), (value, owner) => {
      const write = ++last_write;
      if (default_value) owner.set_ok(value);
      return root.write(payload_for(path, value, encoder)).then((result) => {
        if (result.ok && !reset) kept = value;
        if (default_value && write === last_write)
          owner.set_ok(reset ? default_value() : kept);
        return result;
      });
    });
  };

  /**Builds the states for a part of the schema.
   * @param optional_at index in the path of the outermost optional member, a member missing from there on reads as undefined*/
  const node = (
    part_schema: unknown,
    path: PathPart[],
    encoder?: ArrayWriteEncoder<unknown>,
    all_path?: PathPart[],
    optional_at?: number,
  ): unknown => {
    /**Gives a container the state of its whole value, a write only container has none, the server does not send it*/
    const whole_value = (container: object) => {
      if (is_write_only(part_schema)) return;
      set_fetch_state(
        container,
        root.proxy((result) => at_path(result, path, optional_at)),
      );
    };

    if (is_write_only_leaf(part_schema)) {
      if (typeof part_schema === "string")
        return write_only(path, encoder, part_schema.slice(0, -2));
      const [, spec, default_value, write_options] = part_schema as [
        "?",
        string,
        (() => unknown)?,
        FetchWriteOnlyOptions?,
      ];
      return write_only(path, encoder, spec.slice(0, -2), default_value, write_options?.reset);
    }

    if (typeof part_schema === "string") {
      const optional =
        optional_at ?? (part_schema.startsWith("?") ? path.length - 1 : undefined);
      const transform = (result: StateResult<unknown>) =>
        at_path(result, path, optional);
      if (!part_schema.endsWith("w"))
        return root.proxy(transform);
      return writable(transform, (value) =>
        payload_for(path, value, encoder, all_path),
      );
    }

    //An optional member is built like its spec, a default always fills it in so it is not optional
    if (Array.isArray(part_schema) && part_schema[0] === "?")
      return node(
        part_schema[1],
        path,
        encoder,
        all_path,
        part_schema.length === 3 ? optional_at : (optional_at ?? path.length - 1),
      );

    const array_item = (
      item_schema: unknown,
      item_path: PathPart[],
      array_encoder?: ArrayWriteEncoder<unknown>,
    ): unknown => {
      const item = node(item_schema, item_path, array_encoder, all_path, optional_at);
      if (typeof item_schema !== "string") return item;
      const container = {};
      set_fetch_state(container, item as StateREA<unknown>);
      return container;
    };

    if (Array.isArray(part_schema) && part_schema[0] === 0) {
      const item: unknown = part_schema[1];
      const options = array_options(part_schema);
      //The outermost write "all" array decides what is sent for everything inside it
      const own_all = options?.write === "all";
      const item_all_path = all_path ?? (own_all ? path : undefined);
      const array_encoder = item_all_path ? undefined : options?.encode;
      const key = options?.key;
      const start = options?.start ?? array_start;
      //Without a key the states of an item are kept per index, with a key per key value and occurrence of that value
      const by_index = new Map<number, unknown>();
      let by_key = new Map<unknown, unknown[]>();
      let listed_array: unknown;
      let listed_items: unknown[] = [];
      /**The item states for a received array, the same array gives the same list*/
      const item_states = (array: unknown[]): unknown[] => {
        if (array === listed_array) return listed_items;
        let list: unknown[];
        if (key === undefined) {
          list = array.map((_value, index) => {
            let item_state = by_index.get(index);
            if (!item_state) {
              item_state = node(
                item,
                [...path, new Position(index, start)],
                array_encoder,
                item_all_path,
                optional_at,
              );
              by_index.set(index, item_state);
            }
            return item_state;
          });
        } else {
          //Items no longer in the array are dropped, an item that comes back gets new states
          const next = new Map<unknown, unknown[]>();
          list = array.map((value) => {
            const key_value =
              value !== null && typeof value === "object"
                ? (value as Record<string, unknown>)[key]
                : undefined;
            let same_key = next.get(key_value);
            if (!same_key) next.set(key_value, (same_key = []));
            const occurrence = same_key.length;
            const item_state =
              by_key.get(key_value)?.[occurrence] ??
              node(
                item,
                [...path, new ItemKey(key, key_value, occurrence, start)],
                array_encoder,
                item_all_path,
                optional_at,
              );
            same_key.push(item_state);
            return item_state;
          });
          by_key = next;
        }
        listed_array = array;
        listed_items = list;
        return list;
      };
      /**Item states at an index of the last received array, undefined for a keyed array without a value yet*/
      const get_item = (index: number): unknown => {
        if (key === undefined) {
          let item_state = by_index.get(index);
          if (!item_state) {
            item_state = node(
              item,
              [...path, new Position(index, start)],
              array_encoder,
              item_all_path,
              optional_at,
            );
            by_index.set(index, item_state);
          }
          return item_state;
        }
        const current = at_path(latest, path, optional_at);
        if (current.err || !Array.isArray(current.value)) return undefined;
        return item_states(current.value)[index];
      };
      let previous_items: unknown[] = [];
      const transform = (result: StateResult<unknown>): StateResult<unknown> => {
        const value = at_path(result, path, optional_at);
        if (value.err) return value;
        //A missing optional array has no items
        const array: unknown = value.value === undefined ? [] : value.value;
        if (!Array.isArray(array))
          return err(failure(fetch_parse_errors.INVALID_DATA, "Expected array", created_at));
        //A copy, the list is cached and the read key is set on it
        const current_items = [...item_states(array)];
        const changes = array_changes(previous_items, current_items);
        previous_items = current_items;
        (current_items as StateArrayRead<unknown>)[STATE_ARRAY_READ_KEY] = changes;
        return ok(current_items);
      };
      //A write "all" array takes plain item values or a state array write instruction applied to the last received array
      const array_state = own_all
        ? writable(transform, (values) => {
            if (!state.a.is_write(values))
              return payload_for(path, values, undefined, item_all_path);
            //Keyed items in the path are found in the last received value
            const concrete = latest.ok ? resolve_path(latest.value, path) : undefined;
            const base =
              concrete && !(concrete instanceof MissingPart)
                ? array_base_at(concrete)
                : at_path(latest, path);
            if (base.err) return new UnsentWrite(base.error);
            if (!Array.isArray(base.value))
              return new UnsentWrite(
                failure(
                  fetch_parse_errors.INVALID_DATA,
                  "Failed to write array, the received value is not an array",
                  created_at,
                ),
              );
            const [applied] = state.a.write_apply(values, [...(base.value as unknown[])]);
            return payload_for(path, applied, undefined, item_all_path);
          })
        : root.proxy(transform);
      return new Proxy(array_state, {
        get(target, property) {
          if (typeof property !== "string" || !/^\d+$/.test(property)) {
            const member: unknown = Reflect.get(target, property, target);
            return typeof member === "function"
              ? (member.bind(target) as unknown)
              : member;
          }
          return get_item(Number(property));
        },
      });
    }

    if (Array.isArray(part_schema) && part_schema[0] === "{}") {
      const item: unknown = part_schema[1];
      const items = new Map<string, unknown>();
      const record = {};
      whole_value(record);
      return new Proxy(record, {
        get(target, property) {
          if (typeof property !== "string")
            return Reflect.get(target, property, target) as unknown;
          let item_state = items.get(property);
          if (!item_state) {
            item_state = node(
              item,
              [...path, property],
              undefined,
              all_path,
              optional_at,
            );
            items.set(property, item_state);
          }
          return item_state;
        },
      });
    }

    if (Array.isArray(part_schema) && typeof part_schema[0] === "number") {
      const count = part_schema[0];
      const item: unknown = part_schema[1];
      const start =
        (part_schema[2] as FetchFixedArrayOptions | undefined)?.start ?? array_start;
      const fixed = Array.from({ length: count }, (_value, index) =>
        array_item(item, [...path, new Position(index, start)]),
      );
      whole_value(fixed);
      return fixed;
    }

    //A list of only type strings is a tuple, a state per position, other lists are unions with one state
    if (
      Array.isArray(part_schema) &&
      part_schema.every((entry) => typeof entry === "string")
    ) {
      const tuple = part_schema.map((entry, index) =>
        node(entry, [...path, new Position(index, array_start)], undefined, all_path, optional_at),
      );
      whole_value(tuple);
      return tuple;
    }

    if (
      part_schema &&
      typeof part_schema === "object" &&
      !Array.isArray(part_schema)
    ) {
      const object: Record<string, unknown> = {};
      whole_value(object);
      for (const [key, child] of Object.entries(part_schema))
        object[key] = node(child, [...path, key], undefined, all_path, optional_at);
      return object;
    }

    return root.proxy((result) =>
      at_path(result, path, optional_at),
    );
  };

  const result = node(schema, []) as object;
  set_fetch_state(result, root);
  return result as unknown as FetchParsed<S>;
}
