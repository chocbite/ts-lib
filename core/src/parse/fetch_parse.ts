import { err, ok } from "#result";
import {
  state,
  STATE_ARRAY_READ_KEY,
  type StateArrayRead,
  type StateArrayReadTypes,
  type StateREA,
  type StateREAW,
  type StateResult,
} from "#state";
import { make_parser, type Parsed } from "./parse";

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
  | `?${FetchTypeString}w`;
type Parser = (input: unknown) => unknown;

export type ArrayWriteEncoder<T = any> = (value: T, index: number) => unknown;
export const FETCH_PARSE: unique symbol = Symbol("FETCH_PARSE");

export type FetchSchema =
  | FetchPrimitiveSpec
  | Parser
  | readonly ["?", FetchSchema]
  | readonly ["?", FetchSchema, () => unknown]
  | readonly ["{}", FetchSchema]
  | readonly [number, FetchSchema]
  | readonly [0, FetchSchema, ArrayWriteEncoder]
  | readonly FetchSchema[]
  | { readonly [key: string]: FetchSchema };

type RemoveWritable<S> = S extends string
  ? S extends `${infer Value}w`
    ? Value
    : S
  : S extends readonly [0, infer Item, ArrayWriteEncoder]
    ? readonly [0, RemoveWritable<Item>]
    : S extends readonly [infer Count extends number, infer Item]
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
type ResolveSchema<S> = S extends string
  ? ResolveString<RemoveWritable<S> & string>
  : S extends Parser
    ? Parsed<S>
    : S extends readonly ["?", infer Item, () => unknown]
      ? ResolveSchema<Item>
      : S extends readonly ["?", infer Item]
        ? ResolveSchema<Item> | undefined
  : S extends readonly ["{}", infer Item]
          ? Record<string, ResolveSchema<Item>>
  : S extends readonly [0, infer Item, ArrayWriteEncoder]
          ? ResolveSchema<Item>[]
          : S extends readonly [0, infer Item]
            ? ResolveSchema<Item>[]
            : S extends readonly [infer Count extends number, infer Item]
              ? Repeat<ResolveSchema<Item>, Count>
              : S extends readonly unknown[]
                ? { [K in keyof S]: ResolveSchema<S[K]> }
                : S extends object
                  ? { -readonly [K in keyof S]: ResolveSchema<S[K]> }
                  : never;

type Writable<S> = S extends string
  ? S extends `${string}w`
    ? true
    : false
  : false;

type FetchContainer<
  Value,
  State extends StateREA<Value> = StateREA<Value>,
> = { readonly [FETCH_PARSE]: State };
type FetchArrayItem<S, Value> = S extends string
  ? FetchContainer<Value, FetchNode<S, Value>>
  : FetchNode<S, Value>;
type FetchDynamicArrayItem<S, Value> = S extends string
  ? FetchNode<S, Value>
  : FetchNode<S, Value>;
type FetchRepeat<
  T,
  N extends number,
  Acc extends unknown[] = [],
> = Acc["length"] extends N ? Acc : FetchRepeat<T, N, [...Acc, T]>;
type FetchNode<S, Value> = S extends string
  ? Writable<S> extends true
    ? StateREAW<Value>
    : StateREA<Value>
  : S extends readonly [0, infer Item, ArrayWriteEncoder]
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
            ? FetchContainer<Value> & {
                readonly [key: string]: FetchNode<Item, RecordItem<Value>>;
              }
            : S extends readonly [infer Count extends number, infer Item]
            ? FetchRepeat<FetchArrayItem<Item, ArrayItem<Value>>, Count>
            : S extends Parser
              ? StateREA<Value>
              : S extends object
                ? FetchContainer<Value> & {
                    -readonly [K in keyof S]: FetchNode<
                      S[K],
                      ValueForKey<Value, K>
                    >;
                  }
                : StateREA<Value>;

type ArrayItem<T> = T extends readonly (infer Item)[] ? Item : never;
type RecordItem<T> = T extends Record<string, infer Item> ? Item : never;
type ValueForKey<T, K> = K extends keyof T ? T[K] : never;

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
export type FetchWrite = (payload: unknown) => PromiseLike<void>;

type PathPart = string | number;
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

function strip_writable(schema: unknown): unknown {
  if (typeof schema === "string")
    return schema.endsWith("w") ? schema.slice(0, -1) : schema;
  if (!Array.isArray(schema)) {
    if (schema && typeof schema === "object") {
      return Object.fromEntries(
        Object.entries(schema).map(([key, value]) => [
          key,
          strip_writable(value),
        ]),
      );
    }
    return schema;
  }
  if (
    schema[0] === 0 &&
    schema.length === 3 &&
    typeof schema[2] === "function"
  ) {
    return [0, strip_writable(schema[1])];
  }
  return schema.map(strip_writable);
}

function has_writable(schema: unknown): boolean {
  if (typeof schema === "string") return schema.endsWith("w");
  if (Array.isArray(schema)) return schema.some(has_writable);
  return Boolean(
    schema &&
    typeof schema === "object" &&
    Object.values(schema).some(has_writable),
  );
}

function result_at_path(
  value: StateResult<unknown>,
  path: readonly PathPart[],
): StateResult<unknown> {
  if (value.err) return err(value.error);
  let current: unknown = value.value;
  for (const part of path) {
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.hasOwn(current, part)
    ) {
      return err(`Failed to read missing member ${String(part)}`);
    }
    current = (current as Record<PathPart, unknown>)[part];
  }
  return ok(current);
}

function payload_at_path(path: readonly PathPart[], value: unknown): unknown {
  let payload = value;
  for (let index = path.length - 1; index >= 0; index--) {
    payload = { [path[index]!]: payload };
  }
  return payload;
}

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
  schema: S,
  write?: FetchWrite,
): FetchParsed<S> {
  if (has_writable(schema) && !write) {
    throw new Error(
      "A write function is required when the schema contains writable values",
    );
  }

  const parse = make_parser(
    strip_writable(schema) as RuntimeSchema & Record<string, never>,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  //Each subscription gets its own controller, ending it aborts its fetches and stops its polling
  let subscription: AbortController | undefined;
  const fetch_result = async (
    signal?: AbortSignal,
  ): Promise<StateResult<unknown>> => {
    try {
      const [url, init] = request_parts(request());
      const response = await fetch(url, { ...init, signal });
      if (!response.ok) return err(`Fetch failed: HTTP ${response.status}`);
      return parse(await response.text());
    } catch (cause) {
      // fetch, response.text and request can reject, convert to a result here
      return err(cause instanceof Error ? cause.message : String(cause));
    }
  };

  // One-shot reads always answer so pending reads resolve, subscription fetches only notify while that subscription lasts
  const load = async (owner: RemoteOwner, signal?: AbortSignal) => {
    const result = await fetch_result(signal);
    if (signal?.aborted) return;
    owner.update_single(result, Boolean(signal));
  };

  const schedule = (owner: RemoteOwner, signal: AbortSignal) => {
    if (signal.aborted) return;
    timer = setTimeout(async () => {
      await load(owner, signal);
      schedule(owner, signal);
    }, update_rate);
  };

  const root = state.r.reaw.from<unknown, any, unknown>(
    (owner) => void load(owner),
    (owner) => {
      subscription = new AbortController();
      const signal = subscription.signal;
      void load(owner, signal).then(() => schedule(owner, signal));
    },
    () => {
      subscription?.abort();
      subscription = undefined;
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
    async (payload) => {
      try {
        await write?.(payload);
        return ok(undefined);
      } catch (cause) {
        return err(cause instanceof Error ? cause.message : String(cause));
      }
    },
  ) as StateREAW<ResolveSchema<S>, any, unknown>;

  const node = (
    part_schema: unknown,
    path: PathPart[],
    encoder?: ArrayWriteEncoder<unknown>,
  ): unknown => {
    if (typeof part_schema === "string") {
      const transform = (result: StateResult<unknown>) =>
        result_at_path(result, path);
      if (!part_schema.endsWith("w"))
        return state.proxy.rea(root as any, transform);
      return state.proxy.reaw(root as any, transform, {
        wout_win: (value) =>
          payload_at_path(
            path.slice(0, encoder ? -1 : undefined),
            encoder ? encoder(value, path.at(-1) as number) : value,
          ),
        win_wout: () => {
          throw new Error(
            "Writable fetch projections do not transform root payloads to leaf values",
          );
        },
      });
    }

    const array_item = (
      item_schema: unknown,
      item_path: PathPart[],
      array_encoder?: ArrayWriteEncoder<unknown>,
    ): unknown => {
      const item = node(item_schema, item_path, array_encoder);
      if (typeof item_schema !== "string") return item;
      const container = {};
      set_fetch_state(container, item as StateREA<unknown>);
      return container;
    };

    if (Array.isArray(part_schema) && part_schema[0] === 0) {
      const item: unknown = part_schema[1];
      const array_encoder =
        typeof part_schema[2] === "function"
          ? (part_schema[2] as ArrayWriteEncoder<unknown>)
          : undefined;
      const items = new Map<number, unknown>();
      const get_item = (index: number): unknown => {
        let item_state = items.get(index);
        if (!item_state) {
          item_state = node(item, [...path, index], array_encoder);
          items.set(index, item_state);
        }
        return item_state;
      };
      let previous_items: unknown[] = [];
      const array_state = state.proxy.rea(root as any, (result) => {
        const value = result_at_path(result, path);
        if (value.err) return value;
        if (!Array.isArray(value.value)) return err("Expected array");
        const current_items = value.value.map((_value, index) => get_item(index));
        const changes: StateArrayReadTypes<unknown>[] = [];
        if (current_items.length > previous_items.length) {
          changes.push({
            type: "added",
            index: previous_items.length,
            items: current_items.slice(previous_items.length),
          });
        } else if (current_items.length < previous_items.length) {
          changes.push({
            type: "removed",
            index: current_items.length,
            items: previous_items.slice(current_items.length),
          });
        }
        previous_items = current_items;
        (current_items as StateArrayRead<unknown>)[STATE_ARRAY_READ_KEY] = changes;
        return ok(current_items);
      });
      return new Proxy(array_state as object, {
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
      set_fetch_state(
        record,
        state.proxy.rea(root as any, (result) => result_at_path(result, path)),
      );
      return new Proxy(record, {
        get(target, property) {
          if (typeof property !== "string")
            return Reflect.get(target, property, target) as unknown;
          let item_state = items.get(property);
          if (!item_state) {
            item_state = node(item, [...path, property]);
            items.set(property, item_state);
          }
          return item_state;
        },
      });
    }

    if (Array.isArray(part_schema) && typeof part_schema[0] === "number") {
      const count = part_schema[0];
      const item: unknown = part_schema[1];
      return Array.from({ length: count }, (_value, index) =>
        array_item(item, [...path, index]),
      );
    }

    if (
      part_schema &&
      typeof part_schema === "object" &&
      !Array.isArray(part_schema)
    ) {
      const object_state = state.proxy.rea(root as any, (result) =>
        result_at_path(result, path),
      );
      const object: Record<string, unknown> = {};
      set_fetch_state(object, object_state);
      for (const [key, child] of Object.entries(part_schema))
        object[key] = node(child, [...path, key]);
      return object;
    }

    return state.proxy.rea(root as any, (result) =>
      result_at_path(result, path),
    );
  };

  const result = node(schema, []) as object;
  set_fetch_state(result, root);
  return result as unknown as FetchParsed<S>;
}
