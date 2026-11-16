import type { Prettify } from "#common";
import { err, ok, type Option } from "#result";
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

/**Options for a dynamic array, the third entry of [0, item, options].
 * - write "single" (default): a write inside an item sends only that value, addressed by index, encode turns a written item into the payload.
 * - write "all": a write inside an item sends the whole array with the change, based on the last received value,
 *   and the array state itself is writable with plain item values or a state array write instruction.
 *   A change on the server since the last poll is overwritten by such a write.
 * - key: member of the object items that identifies them, like "id". Without it the states of an item follow its position,
 *   meant for arrays where positions do not change. With it they follow the item, the array reports real inserts, removals and moves,
 *   and writes find the item by key in the last received value. Index access gives undefined until a value is received.*/
export type FetchArrayOptions<T = any> =
  | {
      readonly write?: "single";
      readonly encode?: ArrayWriteEncoder<T>;
      readonly key?: string;
    }
  | { readonly write: "all"; readonly key?: string };
export const FETCH_PARSE: unique symbol = Symbol("FETCH_PARSE");

export type FetchSchema =
  | FetchPrimitiveSpec
  | Parser
  | readonly ["?", FetchSchema]
  | readonly ["?", FetchSchema, () => unknown]
  | readonly ["{}", FetchSchema]
  | readonly [number, FetchSchema]
  | readonly [0, FetchSchema, ArrayWriteEncoder | FetchArrayOptions]
  | readonly FetchSchema[]
  | { readonly [key: string]: FetchSchema };

type RemoveWritable<S> = S extends string
  ? S extends `${infer Value}w`
    ? Value
    : S
  : S extends readonly [0, infer Item, ArrayWriteEncoder | FetchArrayOptions]
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
  : S extends readonly [0, infer Item, ArrayWriteEncoder | FetchArrayOptions]
          ? ResolveSchema<Item>[]
          : S extends readonly [0, infer Item]
            ? ResolveSchema<Item>[]
            : S extends readonly [infer Count extends number, infer Item]
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

/**Value type of an object schema, keys that may be missing are optional.
 * An index signature, like the generic FetchSchema constraint, keeps the lazy mapped type,
 * flattening it would resolve FetchSchema inside itself forever*/
type ResolveObject<S> = string extends keyof S
  ? { -readonly [K in keyof S]: ResolveSchema<S[K]> }
  : Prettify<
      {
        -readonly [K in Exclude<keyof S, OptionalKeys<S>>]: ResolveSchema<
          S[K]
        >;
      } & {
        -readonly [K in OptionalKeys<S>]?: ResolveSchema<S[K]>;
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
export type FetchWrite = (payload: unknown) => PromiseLike<void>;

/**Fetches a request, the global fetch fits. Only ok, status and text are used from the response.
 * init holds the signal that aborts the fetch when polling stops*/
export type FetchFunction = (
  url: string,
  init: RequestInit,
) => PromiseLike<{
  readonly ok: boolean;
  readonly status: number;
  text(): PromiseLike<string>;
}>;

export type FetchParserOptions = {
  /**Sends a write, required when the schema contains writable values*/
  readonly write?: FetchWrite;
  /**Used in place of the global fetch for reads*/
  readonly fetch?: FetchFunction;
};

/**Path part of a keyed array item, the occurrence-th item whose key member equals value*/
class ItemKey {
  constructor(
    readonly key: string,
    readonly value: unknown,
    readonly occurrence: number,
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

type PathPart = string | number | ItemKey;
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
  | { write: "single" | "all"; encode?: ArrayWriteEncoder<unknown>; key?: string }
  | undefined {
  if (!Array.isArray(schema) || schema[0] !== 0 || schema.length !== 3)
    return undefined;
  const options: unknown = schema[2];
  if (typeof options === "function")
    return { write: "single", encode: options as ArrayWriteEncoder<unknown> };
  const { write, encode, key } = options as {
    write?: "single" | "all";
    encode?: ArrayWriteEncoder<unknown>;
    key?: string;
  };
  return { write: write ?? "single", encode, key };
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
  if (array_options(schema)) return [0, strip_writable(schema[1])];
  return schema.map(strip_writable);
}

function has_writable(schema: unknown): boolean {
  if (typeof schema === "string") return schema.endsWith("w");
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
): StateResult<unknown> {
  if (value.err) return err(value.error);
  const resolved = resolve_path(value.value, path);
  if (resolved instanceof MissingPart)
    return resolved.at >= optional_at ? ok(undefined) : err(resolved.message);
  let current: unknown = value.value;
  for (const part of resolved)
    current = (current as Record<IndexPart, unknown>)[part];
  return ok(current);
}

type IndexPart = string | number;

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
          : `Failed to read missing member ${String(part)}`,
      );
    if (current === null || typeof current !== "object") return missing();
    let index: IndexPart;
    if (part instanceof ItemKey) {
      index = Array.isArray(current) ? part.index_in(current) : -1;
      if (index === -1) return missing();
    } else if (Object.hasOwn(current, part)) index = part;
    else return missing();
    resolved.push(index);
    current = (current as Record<IndexPart, unknown>)[index];
  }
  return resolved;
}

function payload_at_path(path: readonly IndexPart[], value: unknown): unknown {
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
  const [part, ...rest] = path as [IndexPart, ...IndexPart[]];
  if (rest.length > 0 && !Object.hasOwn(base, part)) return undefined;
  const child = with_value_at(
    (base as Record<IndexPart, unknown>)[part],
    rest,
    value,
  );
  if (child === undefined && rest.length > 0) return undefined;
  const copy = Array.isArray(base)
    ? [...(base as unknown[])]
    : { ...(base as Record<IndexPart, unknown>) };
  (copy as Record<IndexPart, unknown>)[part] = child;
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
  constructor(readonly reason: string) {}
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
  options?: FetchParserOptions,
): FetchParsed<S> {
  if (has_writable(schema) && !options?.write) {
    throw new Error(
      "A write function is required when the schema contains writable values",
    );
  }

  const parse = make_parser(
    strip_writable(schema) as RuntimeSchema & Record<string, never>,
  );
  //Looked up per fetch when not given, so a global fetch replaced later is used
  const fetch_with: FetchFunction = options?.fetch ?? ((url, init) => fetch(url, init));
  let timer: ReturnType<typeof setTimeout> | undefined;
  //Each subscription gets its own controller, ending it aborts its fetches and stops its polling
  let subscription: AbortController | undefined;
  const fetch_result = async (
    signal?: AbortSignal,
  ): Promise<StateResult<unknown>> => {
    try {
      const [url, init] = request_parts(request());
      const response = await fetch_with(url, { ...init, signal });
      if (!response.ok) return err(`Fetch failed: HTTP ${response.status}`);
      return parse(await response.text());
    } catch (cause) {
      // fetch, response.text and request can reject, convert to a result here
      return err(cause instanceof Error ? cause.message : String(cause));
    }
  };

  // One-shot reads always answer so pending reads resolve, subscription fetches only notify while that subscription lasts
  //The last received value, write "all" arrays build their payload from it
  let latest: StateResult<unknown> = err("No value received yet");
  const load = async (owner: RemoteOwner, signal?: AbortSignal) => {
    const result = await fetch_result(signal);
    if (signal?.aborted) return;
    if (result.ok) latest = result;
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
      if (payload instanceof UnsentWrite) return err(payload.reason);
      try {
        await options?.write?.(payload);
        return ok(undefined);
      } catch (cause) {
        return err(cause instanceof Error ? cause.message : String(cause));
      }
    },
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
        return new UnsentWrite("Failed to write, the item no longer exists");
      concrete = [...items, ...(path.slice(last_key + 1) as IndexPart[])];
    }
    if (!all_path)
      return payload_at_path(
        concrete.slice(0, encoder ? -1 : undefined),
        encoder ? encoder(value, concrete.at(-1) as number) : value,
      );
    const all_concrete = concrete.slice(0, all_path.length);
    const base = result_at_path(latest, all_concrete);
    if (base.err) return new UnsentWrite(base.error);
    if (!Array.isArray(base.value))
      return new UnsentWrite("Failed to write array, the received value is not an array");
    const array = with_value_at(base.value, concrete.slice(all_path.length), value);
    if (array === undefined)
      return new UnsentWrite("Failed to write, the item no longer exists");
    return payload_at_path(all_concrete, array);
  };

  /**Writable projection of the root, limit and check on the root give the payload back,
   * it is mapped back to the value it was built from, as a payload can not always be turned back into the value*/
  const writable = (
    transform: (result: StateResult<unknown>) => StateResult<unknown>,
    to_payload: (value: unknown) => unknown,
  ) => {
    const sent = new WeakMap<object, unknown>();
    return state.proxy.reaw(root as any, transform, {
      wout_win: (value) => {
        const payload = to_payload(value);
        if (payload !== null && typeof payload === "object")
          sent.set(payload, value);
        return payload;
      },
      win_wout: (payload) => {
        if (payload !== null && typeof payload === "object" && sent.has(payload))
          return sent.get(payload);
        throw new Error(
          "Writable fetch projections can only map back payloads they built themselves",
        );
      },
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
    if (typeof part_schema === "string") {
      const optional =
        optional_at ?? (part_schema.startsWith("?") ? path.length - 1 : undefined);
      const transform = (result: StateResult<unknown>) =>
        result_at_path(result, path, optional);
      if (!part_schema.endsWith("w"))
        return state.proxy.rea(root as any, transform);
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
                [...path, index],
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
                [...path, new ItemKey(key, key_value, occurrence)],
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
              [...path, index],
              array_encoder,
              item_all_path,
              optional_at,
            );
            by_index.set(index, item_state);
          }
          return item_state;
        }
        const current = result_at_path(latest, path, optional_at);
        if (current.err || !Array.isArray(current.value)) return undefined;
        return item_states(current.value)[index];
      };
      let previous_items: unknown[] = [];
      const transform = (result: StateResult<unknown>): StateResult<unknown> => {
        const value = result_at_path(result, path, optional_at);
        if (value.err) return value;
        //A missing optional array has no items
        const array: unknown = value.value === undefined ? [] : value.value;
        if (!Array.isArray(array)) return err("Expected array");
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
            const base = result_at_path(latest, path);
            if (base.err) return new UnsentWrite(base.error);
            if (!Array.isArray(base.value))
              return new UnsentWrite("Failed to write array, the received value is not an array");
            const [applied] = state.a.write_apply(values, [...(base.value as unknown[])]);
            return payload_for(path, applied, undefined, item_all_path);
          })
        : state.proxy.rea(root as any, transform);
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
        state.proxy.rea(root as any, (result) =>
          result_at_path(result, path, optional_at),
        ),
      );
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
        result_at_path(result, path, optional_at),
      );
      const object: Record<string, unknown> = {};
      set_fetch_state(object, object_state);
      for (const [key, child] of Object.entries(part_schema))
        object[key] = node(child, [...path, key], undefined, all_path, optional_at);
      return object;
    }

    return state.proxy.rea(root as any, (result) =>
      result_at_path(result, path, optional_at),
    );
  };

  const result = node(schema, []) as object;
  set_fetch_state(result, root);
  return result as unknown as FetchParsed<S>;
}
