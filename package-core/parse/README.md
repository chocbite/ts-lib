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

**A default must give a value its spec allows.** The types refuse `["?", "s", () => false]`: for a type string the schema type itself does, so `satisfies` catches it too. For an object, array or parser spec, `make_parser` and `make_fetch_parser` check it and name the path in the error, `"settings: the default gives a value the spec does not allow"`. At runtime the parser also checks a default against its spec, for plain JavaScript and `any`.

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

`make_fetch_parser(request, update_rate, schema, { write?, fetch? })` turns a JSON endpoint into states. Each member of the schema becomes a state that follows that member, and members marked writable send changes back through `write`.

```typescript
import form from "@chocbite/ts-lib-ui/form";
import { make_fetch_parser } from "@chocbite/ts-lib/parse";
import { fetch_status_safe } from "@chocbite/ts-lib/safe";

const device = make_fetch_parser(
  () => "/api/device",
  1000,
  { name: "sw", speed: "nw", temperature: "n", settings: { eco: "bw" } },
  {
    write: (payload) => fetch_status_safe("/api/device", { method: "PATCH", body: JSON.stringify(payload) }),
  },
);

form.text_input({ value: device.name }); // writable
form.slider({ min: 0, max: 100, value: device.speed }); // writable
form.progress({ unit: "°C", value: device.temperature }); // read only
form.switch({ value: device.settings.eco }); // writable, nested
```

### Fetching

- **`request`** returns the URL, or `[url, init]` for `fetch` options. It's called for every fetch, so it can change.
- **`fetch`** sends the request and gives the body text, or the text and the response like `fetch_text_safe`, `(url, init) => PromiseLike<Result<string | [string, unknown], NiceError>>`. The default is [`fetch_text_safe`](../safe/README.md) from `@chocbite/ts-lib/safe`, whose errors, like `safe.fetch.errors.CONNECTION_FAILED`, reach the states unchanged.

  A custom one can add authentication, retry, or answer from a fake server in tests, usually by calling `fetch_text_safe` with changed arguments. `init.signal` aborts when polling stops or the request times out. A fetch that ignores it runs to the end and its result is thrown away. `write` doesn't go through `fetch`, it sends however it wants, for example with `fetch_status_safe`.

  ```typescript
  const device = make_fetch_parser(() => "/api/device", 1000, { temperature: "n" }, {
    fetch: (url, init) => fetch_text_safe(url, { ...init, headers: { Authorization: `Bearer ${token()}` } }),
  });
  ```
- **Polling only runs while something is subscribed** to any of the states. The first subscription fetches at once, then the next fetch starts `update_rate` ms after the previous one finished. When the last subscriber is gone, polling stops and a fetch still running is ignored.
- **While polling, reading a state or subscribing another one sends no request.** It gets the result of the last poll, at most `update_rate` old, or the error of the last poll until the next one, like the subscribers. Before the first poll answers, it waits for that answer. Without a subscription every read fetches.
- **`timeout`** is the time in ms a request may take, 5000 by default. Then it is aborted and gives a `safe.fetch.errors.TIMED_OUT`, which counts as a failed read like any other, so polling goes on after `retry_rate`. It holds also for a `fetch` that ignores `init.signal`, so a server that never answers can not stop the polling.
- **`retry_rate`** is the wait in ms after a read that gave an error, used in place of `update_rate`, so a server that is down isn't asked at full speed. Any error counts, including a response that fails to parse. After the next successful read, polling is back at `update_rate`. It defaults to `update_rate`. Awaiting a state without subscribing still fetches at once, whatever the last read gave.

  ```typescript
  make_fetch_parser(() => "/api/device", 200, schema, { retry_rate: 5000 });
  ```
- **Awaiting a state without subscribing fetches once.**
- **The body text is parsed** with `make_parser` and the schema, without the `w` markers. An error from `fetch` or from parsing becomes the error of every state.

### Errors and bugs

The errors of the states are `NiceError`s, see [Errors](../state/README.md#errors) in the state module. JavaScript throws the same `TypeError` for a network failure as for a bug, so `fetch` and `write` return expected failures as a `NiceError` instead of throwing. That error becomes the state's error unchanged. `fetch_text_safe` and `fetch_status_safe` fit as they are. `write` can give any ok value, it isn't used.

The fetch parser makes these kinds, in `parse.fetch.errors`:

| Kind             | Nice text                | When                                                                                       |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| `INVALID_DATA` ✱ | Invalid data from server | The response doesn't match the schema, the message is the parser's, like `Failed to parse valid json`. |
| `NO_VALUE`       | Waiting for data         | A write that needs the last value, before any value was received.                          |
| `MEMBER_MISSING` ✱ | Value missing          | A member or item the server left out that the schema doesn't mark as optional.            |
| `ITEM_GONE` ✱    | Item no longer exists    | A write to an item that isn't in the last received value anymore.                         |
| `UNEXPECTED` ✱   | Unexpected error         | A bug in `request`, `fetch` or `write`, see below.                                       |

`NO_VALUE` is normal use after start-up and has only a message. The kinds marked ✱ aren't supposed to happen and have an `Error` as `cause`. The failure happens while polling, so its stack shows only the parser's internals. To tell which parser it was, the `cause` of that `Error` is an `Error` made where `make_fetch_parser` was called. A thrown error is the `cause` itself.

**A throw from `request`, `fetch` or `write` is treated as a bug.** It's logged with `console.error`, saying where it was thrown, and the state gets an `UNEXPECTED` error with the thrown error as `cause`, so a pending read or write still finishes. A custom `fetch` should therefore catch only the failures of the request it sends and return them as errors, and let nothing else throw. `fetch_text_safe` does exactly that, so a custom `fetch` built on it needs no `try` of its own. A `try` around the whole function would turn its bugs into fetch errors too.

**What `fetch` and `write` return is also checked at runtime,** because `any` and plain JavaScript get past the types. These are bugs too, logged with a message saying what went wrong:
- Not returning a `Result`.
- A `Response` in the `Result` instead of the body text.
- A promise in the `Result`, from a missing `await` before wrapping it in `ok`.
- Anything else that isn't a string as the body.
- An error that isn't a `NiceError`.

### The parsed tree

| Schema                  | Gives                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `"n"`, `"?s"`, …        | A read-only state of the member.                                                                 |
| `"nw"`, `"?sw"`, …      | A writable state of the member, see [Writing](#writing).                                         |
| `"nwo"`, `["?", "nwo", () => v]` | A write-only state, the server doesn't send the member, see [Write-only members](#write-only-members). |
| `{ key: spec }`         | An object with a node per key.                                                                   |
| `["{}", spec]`          | An object that gives a node for any key you read.                                                |
| `[3, spec]`             | A real array of 3 nodes, and the whole array under `FETCH_PARSE`, see the note on primitive items below. |
| `["n", "sw"]`         | A tuple: a real array with a state per position, `point[0]`, and the whole tuple under `FETCH_PARSE`. |
| `[0, spec]`             | A state of the array of item nodes, plus index access, see [Dynamic arrays](#dynamic-arrays).    |
| `["?", spec]`           | What `spec` gives. Everything in it reads `undefined` while the member is missing.               |
| `["?", spec, () => v]`  | What `spec` gives, filled in by the default while the member is missing.                         |
| function or parser      | One read-only state of the parsed member.                                                        |

- **A container's own value:** every object, record, tuple, fixed array and fixed-array item also has the state of its whole value under the `FETCH_PARSE` symbol, `device.settings[FETCH_PARSE]`. On the root, `device[FETCH_PARSE]` is the state of the whole response. Schema keys never collide with it.
- **Primitive items of a fixed array** are wrapped, so their state is `fixed[0][FETCH_PARSE]`.
- **A missing optional member reads as `undefined`.** That covers a `"?n"` the server leaves out and everything in a missing `["?", spec]`. A missing optional dynamic array has no items. A missing required member, such as a record key the server doesn't have, reads as a `MEMBER_MISSING` error.

### Writing

A type string ending in `w` makes the member writable. A schema with writable members needs the `write` option, `make_fetch_parser` throws without it.

- **A write sends a partial object** with only the changed value at its path: `device.settings.eco.write(true)` calls `write({ settings: { eco: true } })`.
- **`write` returns `PromiseLike<Result<unknown, NiceError>>`.** The ok value isn't used. An error is the write's result, and form elements show it as a warning. A throw is a bug, see [Errors and bugs](#errors-and-bugs).
- **Nothing changes locally until the next poll** shows what the server kept.
- **Writable states have `limit` and `check`** like any state, so every form element can write through them.
- **`array_start`** is added to every array index a write sends, for servers that count from 1. With `array_start: 1`, writing the first pump sends `{ pumps: { 1: { name } } }`, and an `encode` function gets the shifted index too. Reading isn't affected, since received arrays are JSON arrays. A `"all"` array is sent whole, so only indexes outside it are shifted. The default is 0.
- **`write_debounce`** collects writes for that many ms, counted from the first, and sends them as one payload. The writes of different members are merged, `{ name: "A" }` and `{ settings: { eco: true } }` become `{ name: "A", settings: { eco: true } }`, and a member written twice sends only its last value. Every write gets the result of the one `write` call. Two cases are handled so no write is lost:
  - A write that would overwrite another member's write sends the collected writes first. This happens with `encode`, where every item goes to the same key of its array.
  - A `"all"` array is built on the array already waiting, so two writes in it both get through.

  The default is 0, every write is sent at once.

### Write-only members

A type string ending in `wo` is a member the server takes in writes but doesn't send, like a command, a PIN or a setting it doesn't report back.

```ts
const device = make_fetch_parser(() => "/api/device", 1000, {
  name: "sw",
  restart: "bwo", // reads undefined, writes boolean
  boost: ["?", "nwo", () => 0], // reads 0, then the last value written
  pin: ["?", "swo", () => "", { reset: true }], // reads "", back to "" after every write
}, { write });

device.restart.write(true); // write({ restart: true })
```

- **Parsing leaves the member out.** A response without it parses, and if the server sends it anyway it's ignored. It isn't in the value of its object either: `device[FETCH_PARSE]` reads `{ name }`.
- **A write is sent like the write of a writable member**, a partial object at its path, with `write_debounce`, `array_start`, `encode` and keyed items as described above.
- **The state is local and never fetches.** Subscribing to it doesn't start polling.
- **What it reads:**
  - **Without a default** it always reads `undefined`.
  - **With a default,** `["?", "nwo", () => v]`, it reads the default, which must be of the write type, `make_fetch_parser` throws otherwise, as nothing parses it. A written value is read at once, so an input shows what you sent, also while `write_debounce` collects it. When the write finishes, the state reads the last value written successfully, so a failed write goes back to the one before it.
  - **With `{ reset: true }`** as the fourth entry, the state reads the default again when a write finishes, whether it succeeded or failed. This suits PINs and commands.
- **When writes overlap,** only the last one decides what the state reads when it finishes.
- **Write-only containers:** a fixed array, tuple, record or object of only write-only members is write-only as a whole. The server doesn't send it, so it's left out of parsing and has no `FETCH_PARSE` state of its own. `passcode: [3, "swo"]` writes `{ passcode: { 2: "1234" } }` through `passcode[2][FETCH_PARSE]`, as primitive items of a fixed array are wrapped.
- **Only as a member of an object or in a write-only container,** also inside the items of a dynamic array. A received tuple, fixed array or dynamic array can't have write-only items, as the server sends every position, and nothing in an `"all"` array can be write-only, as it sends the whole array built from the received value. A `?` prefix isn't allowed either. `make_fetch_parser` throws for these.

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
  {
    write: (payload) => fetch_status_safe("/api/plant", { method: "PATCH", body: JSON.stringify(payload) }),
  },
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

