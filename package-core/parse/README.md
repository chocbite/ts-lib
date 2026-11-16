# @chocbite/ts-lib/parse

Validates unknown data, such as JSON from a server or a file, against a compact schema. The parsed type is inferred from the schema, so the schema is the only type definition needed.

- **`make_parser`** checks a value once and returns a `Result`.
- **`make_fetch_parser`** polls a URL and gives a tree of states, one per member, that form elements can bind to directly, see [Fetch parser](#fetch-parser).

```typescript
import { make_parser, type Parsed } from "@chocbite/ts-lib/parse";

const parse_user = make_parser({
  name: "s",
  age: "?n",
  role: "sl",
  tags: [0, "s"],
  address: { street: "s", zip: "n" },
});

type User = Parsed<typeof parse_user>;
// { name: string; age?: number | undefined; role: string | null; tags: string[]; address: { street: string; zip: number } }

const result = parse_user(input); // Result<User, string>
if (result.ok) result.value.address.zip;
else console.error(result.error);
```

## Parsers

`make_parser(schema)` returns a function that takes `unknown` and returns a `Result` from `@chocbite/ts-lib/result`:

- **A string input is parsed as JSON first.** Invalid JSON gives the error `Failed to parse valid json`.
- **The first problem found is returned** as an error message naming the member, for example `Failed to parse due to member address.zip being wrong type (expected number)`.
- **Keys the schema does not mention are kept**, unchecked, in the result.
- **The input is never changed.** When a default or a function parser changes a value, the objects and arrays on the path to it are copied. Otherwise the result holds the input itself.

The root schema is one of these:

| Root schema         | Accepts                                             |
| ------------------- | --------------------------------------------------- |
| `{ key: spec }`     | An object.                                          |
| `[0, spec]`         | An array of any length.                             |
| `["{}", spec]`      | An object with any keys, each value checked.        |

With an object root, `make_parser(schema, default_value)` takes a factory that is used in place of input that is not an object, for example `null`. The value it returns is checked against the schema like any other input:

```typescript
const parse_settings = make_parser({ volume: ["?", "n", () => 50] }, () => ({}));
parse_settings(null).unwrap(); // { volume: 50 }
```

## Schema

### Primitives

A string of type characters, joined for unions. The characters must be in the order `n s b l`.

| Char | Type      |
| ---- | --------- |
| `n`  | `number`  |
| `s`  | `string`  |
| `b`  | `boolean` |
| `l`  | `null`    |

`"n"` is a number, `"sl"` a string or null, and `"nsbl"` any primitive. Prefix `?` to also allow a missing or `undefined` value, for example `"?n"`.

In an object, a key whose spec allows a missing value is optional in the type (`age?: number | undefined`), because a missing key stays missing in the result. This covers `"?…"` strings, `["?", spec]` and unions with an optional member. A key with a default, `["?", spec, () => v]`, stays required.

### Structures

| Spec                     | Matches                                                                          | Type                        |
| ------------------------ | -------------------------------------------------------------------------------- | --------------------------- |
| `{ key: spec }`          | Object with these keys.                                                          | `{ key: T }`                |
| `["{}", spec]`           | Object with any keys, every value matching spec.                                 | `Record<string, T>`         |
| `[0, spec]`              | Array of any length.                                                             | `T[]`                       |
| `[3, spec]`              | Array of exactly 3 items.                                                        | `[T, T, T]`                 |
| `["s", "n"]`             | Tuple, one type string per position, the length must match.                      | `[string, number]`          |
| `["?", spec]`            | The spec, or missing or `undefined`.                                             | `T \| undefined`            |
| `["?", spec, () => v]`   | The spec. A missing or `undefined` value is replaced by `v`, which is checked too. | `T`                         |
| `["?nl", [2, "b"], {…}]` | Union: the first spec that matches, tried in order.                              | union of the specs          |

A list of only type strings is a tuple. As soon as one entry is something else (an object, an array spec or a function), the list is a union.

### Functions and nested parsers

Any function `(input: unknown) => unknown` can be a spec, including another parser from `make_parser`:

- If it returns a `Result`, an error fails the parse and an ok value is used as the member's value.
- Any other return value is used as the member's value directly.

So a function spec can convert as well as check:

```typescript
const parse_event = make_parser({
  when: (v) => (typeof v === "string" ? ok(new Date(v)) : err("not a date")),
  settings: make_parser({ theme: "s" }),
});
type Event = Parsed<typeof parse_event>; // { when: Date; settings: { theme: string } }
```

The error of a function spec is wrapped in the member path: `Failed to parse due to member when: Subparser Failed to parse: "not a date"`.

`Parsed<F>` gives the ok type of a parser, or the return type of a plain function.

## Fetch parser

`make_fetch_parser(request, update_rate, schema, write?, options?)` turns a JSON endpoint into states. Each member of the schema becomes a state that follows that member, and members marked writable send changes back through `write`.

```typescript
import form from "@chocbite/ts-lib-ui/form";
import { make_fetch_parser } from "@chocbite/ts-lib/parse";

const device = make_fetch_parser(
  () => "/api/device",
  1000,
  { name: "sw", speed: "nw", temperature: "n", settings: { eco: "bw" } },
  async (payload) => {
    const response = await fetch("/api/device", { method: "PATCH", body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(await response.text());
  },
);

form.text_input().bind({ value: device.name }); // writable
form.slider({ min: 0, max: 100 }).bind({ value: device.speed }); // writable
form.progress({ unit: "°C" }).bind({ value: device.temperature }); // read only
form.switch().bind({ value: device.settings.eco }); // writable, nested
```

### Fetching

- **`request`** returns the URL, or `[url, init]` for `fetch` options. It's called for every fetch, so it can change.
- **`options.fetch`** is used in place of the global `fetch`, for example to add authentication, retry, or answer from a fake server in tests. It's called as `(url, init)` and only `ok`, `status` and `text()` of what it returns are used, so the global `fetch` fits as is. `init.signal` aborts when polling stops. A fetch that ignores it runs to the end and its result is thrown away. `write` doesn't go through `options.fetch`, it sends however it wants.

  ```typescript
  const device = make_fetch_parser(() => "/api/device", 1000, { temperature: "n" }, undefined, {
    fetch: (url, init) => fetch(url, { ...init, headers: { Authorization: `Bearer ${token()}` } }),
  });
  ```
- **Polling only runs while something is subscribed** to any of the states. The first subscription fetches at once, then the next fetch starts `update_rate` ms after the previous one finished. When the last subscriber is gone, polling stops and a fetch still running is ignored.
- **Awaiting a state without subscribing fetches once.**
- **The response body is parsed** with `make_parser` and the schema, without the `w` markers. A failed fetch, an HTTP error (`Fetch failed: HTTP 404`) or a parse error becomes the error of every state.

### The parsed tree

| Schema                  | Gives                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `"n"`, `"?s"`, …        | A read-only state of the member.                                                                 |
| `"nw"`, `"?sw"`, …      | A writable state of the member, see [Writing](#writing).                                         |
| `{ key: spec }`         | An object with a node per key.                                                                   |
| `["{}", spec]`          | An object that gives a node for any key you read.                                                |
| `[3, spec]`             | A real array of 3 nodes, see the note on primitive items below.                                  |
| `[0, spec]`             | A state of the array of item nodes, plus index access, see [Dynamic arrays](#dynamic-arrays).    |
| `["?", spec]`           | What `spec` gives. Everything in it reads `undefined` while the member is missing.               |
| `["?", spec, () => v]`  | What `spec` gives, filled in by the default while the member is missing.                         |
| function or parser      | One read-only state of the parsed member.                                                        |

- **A container's own value:** every object, record and fixed-array item also has the state of its whole value under the `FETCH_PARSE` symbol, `device.settings[FETCH_PARSE]`. On the root, `device[FETCH_PARSE]` is the state of the whole response. Schema keys never collide with it.
- **Primitive items of a fixed array** are wrapped, so their state is `fixed[0][FETCH_PARSE]`.
- **A missing optional member reads as `undefined`.** That covers a `"?n"` the server leaves out and everything in a missing `["?", spec]`. A missing optional dynamic array has no items. A missing required member, such as a record key the server doesn't have, reads as the error `Failed to read missing member`.

### Writing

A type string ending in `w` makes the member writable. A schema with writable members needs the `write` function, `make_fetch_parser` throws without it.

- **A write sends a partial object** with only the changed value at its path: `device.settings.eco.write(true)` calls `write({ settings: { eco: true } })`.
- **If `write` throws or rejects,** the write's result is an error with the message, and form elements show it as a warning.
- **Nothing changes locally until the next poll** shows what the server kept.
- **Writable states have `limit` and `check`** like any state, so every form element can write through them.

### Dynamic arrays

`[0, item]` takes an options object as a third entry: `[0, item, { write, key, encode }]`.

**Without a key, item states follow positions.** `items[0]` is always "whatever is at position 0", and the array only reports items added or removed at the end. That is right for arrays whose positions mean something, like the channels of a device. When the server inserts, removes or reorders items, every row after the change switches to showing another item. Anything tied to a row stays with the position: focus, an edit in progress, selection.

**`key: "id"` makes item states follow their item,** found by the value of that member. Items that share a key are told apart by their order.
- The array reports real inserts, removals and moves, so a list only touches the rows that changed.
- Writes find their item by key in the last received value.
- An item the server removed reads as an error, and writes to it are refused.
- Index access gives the item at that position of the last received value, and `undefined` before the first value arrives.

**`write`** decides what a write inside an item sends:

| `write`              | Sends                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `"single"` (default) | Only the changed value, addressed by index: `{ pumps: { 2: { name: "New" } } }`.                        |
| `"all"`              | The whole last received array with the change: `{ pumps: [ … ] }`.                                       |

**With `"all"`, the array state itself is writable.** It takes a plain array of item values, or a state array write instruction applied to the last received array:

```typescript
import state from "@chocbite/ts-lib/state";

const plant = make_fetch_parser(
  () => "/api/plant",
  1000,
  { pumps: [0, { id: "n", name: "sw" }, { write: "all", key: "id" }] },
  async (payload) => void (await fetch("/api/plant", { method: "PATCH", body: JSON.stringify(payload) })),
);

plant.pumps.write(state.a.write.push({ id: 5, name: "Pump 5" }));
plant.pumps.write(state.a.write.splice(0, 1));
plant.pumps.write(state.a.write.move(0, 2));
```

Inside an `"all"` array, writes in nested objects and arrays also send the outermost `"all"` array. A write is refused, without calling `write`, before any value has been received or when the item no longer exists.

**`encode`** (only with `"single"`) turns a written primitive item into the payload: `[0, "sw", { encode: (tag, index) => ({ index, tag }) }]` sends `{ tags: { index: 3, tag: "x" } }`. A function as the third entry is shorthand for `{ encode }`.

**Writes are based on the last poll.** If the server changed the array since then:
- **In `"single"` mode,** an index can point at another item. With a key, the index is right as of the last poll.
- **In `"all"` mode,** the whole array is sent back, which undoes the server's change, for example removing an item it just added.

Only the server can rule this out, for example by addressing items by id or rejecting writes based on an old version.

