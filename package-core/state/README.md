# @chocbite/ts-lib/state

A type-safe state management library for TypeScript with support for synchronous/asynchronous, read-only/writable, and result-based states.

## Overview

The library classifies states along three axes:

- **Sync** — Synchronous (`ROS`, `RES`) or Asynchronous (`ROA`, `REA`)
- **Error** — Always OK (`ROS`, `ROA`) or Error-capable (`RES`, `REA`)
- **Write** — Read-only or Writable (`ROSW`, `ROAW`, `RESW`, `REAW`)

This gives eight state types that cover every combination:

| Type   | Sync | OK-only | Writable |
| ------ | ---- | ------- | -------- |
| `ROS`  | ✓    | ✓       |          |
| `ROSW` | ✓    | ✓       | ✓        |
| `RES`  | ✓    |         |          |
| `RESW` | ✓    |         | ✓        |
| `ROA`  |      | ✓       |          |
| `ROAW` |      | ✓       | ✓        |
| `REA`  |      |         |          |
| `REAW` |      |         | ✓        |

## Quick Start

```typescript
import state from "@chocbite/ts-lib/state";
import { ok } from "@chocbite/ts-lib/result";

// Create a writable, sync, ok-only state
const counter = state.ok_w(0);

// Subscribe to changes (true = call immediately with current value)
counter.sub((result) => {
  console.log("Count:", result.value);
}, true);

// Owner change state value
counter.set(ok(1));

// User request change to state value
counter.write(ok(2));

// Read the current value synchronously
console.log(counter.ok()); // 2
console.log(counter.get()); // ResultOk<2>

// Read the current value asynchronously
console.log(await counter); // ResultOk<2>
```

## State Methods

Every state has a common set of methods. The specific state type determines which additional methods are available and how return types are narrowed — all enforced at compile time by TypeScript.

### Common Methods

Available on every state type:

| Method                           | Description                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `await state` / `state.then(fn)` | Get the current value. Returns `ResultOk<T>` on ok-only types, `ResultNice<T>` on error-capable types, see [Errors](#errors). |
| `sub(fn, immediate?)`            | Subscribe to value changes. Pass `true` to also call `fn` immediately with the current value.                                 |
| `unsub(fn)`                      | Remove a subscription.                                                                                                        |
| `related()`                      | Returns helper metadata (e.g., number min/max, string max_length).                                                            |
| `in_use()`                       | Returns the state if it has any subscribers, `undefined` otherwise.                                                           |
| `has(fn)`                        | Returns the state if `fn` is a current subscriber.                                                                            |
| `amount()`                       | Returns the subscriber count.                                                                                                 |

### Narrowed Methods

These methods are only guaranteed on certain state types. TypeScript will error if you call them on the wrong type:

| Method         | Available when               | Description                                        |
| -------------- | ---------------------------- | -------------------------------------------------- |
| `get()`        | Sync (`rsync: true`)         | Synchronously read the current `Result` value.     |
| `ok()`         | Sync + OK-only (`rok: true`) | Synchronously read the unwrapped value directly.   |
| `write(value)` | Writable (`writable: true`)  | Request a value change, rejected if `check` fails. |
| `limit(value)` | Writable                     | Clamp a value to the valid range via the helper.   |
| `check(value)` | Writable                     | Validate a value without applying it.              |

### Per-Type Narrowing

Each of the eight state types narrows the available methods and result types:

| Type        | `get()`       | `ok()` | `write()/ limit()/ check()` | `then` / `await` result |
| ----------- | ------------- | ------ | --------------------------- | ----------------------- |
| `StateROS`  | `ResultOk<T>` | `T`    | —                           | `ResultOk<T>`           |
| `StateROSW` | `ResultOk<T>` | `T`    | ✓                           | `ResultOk<T>`           |
| `StateRES`  | `Result<T>`   | —      | —                           | `Result<T>`             |
| `StateRESW` | `Result<T>`   | —      | ✓                           | `Result<T>`             |
| `StateROA`  | —             | —      | —                           | `ResultOk<T>`           |
| `StateROAW` | —             | —      | ✓                           | `ResultOk<T>`           |
| `StateREA`  | —             | —      | —                           | `Result<T>`             |
| `StateREAW` | —             | —      | ✓                           | `Result<T>`             |

The three boolean properties `rsync`, `rok`, and `writable` act as runtime discriminants matching the same axes:

- **Sync** (`rsync: true`) — enables `get()`, and `ok()` when also ok-only
- **OK-only** (`rok: true`) — narrows `then` result to `ResultOk<T>` (value is never an error)
- **Writable** (`writable: true`) — enables `write()`, `limit()`, and `check()`

The types form a subtype hierarchy — more specific types are assignable to less specific ones. For example, a `StateROSW<number>` (sync + ok + writable) can be passed anywhere a `StateROS<number>`, `StateROA<number>`, or `State<number>` is expected.

```typescript
function show_sync(s: StateROS<number>) {
  // Sync + OK → get() and ok() available
  console.log(s.ok()); // number — unwrapped value
  console.log(s.get().value); // number — via ResultOk
}

async function show_async(s: StateROA<number>) {
  // Async + OK → no get()/ok(), must await
  const result = await s; // ResultOk<number>
  console.log(result.value); // always ok, no error check needed
}

function handle_errors(s: StateRES<number>) {
  // Sync + Error-capable → get() returns ResultNice<T>
  const result = s.get();
  if (result.ok) console.log(result.value);
  else console.log(result.error.nice); // "Value too high", the details are in result.error.message
}

async function update(s: StateROSW<number>) {
  // Writable → write(), limit(), check() available
  s.write(42);
  // This will only be correct if the state accepts the write
  console.log(s.ok()); // 42
  // If the write is denied it returns an error result with a NiceError saying why
  console.log(await s.write(42));
}
```

Each state type can be narrowed down to a less restricted state type with StateROS being the least restricted and State/StateREA being the most restricted.

```typescript
async function narrowing(s: State<number>) {
  if (s.ok) {
    //State -> StateROXX
    if (s.sync) {
      //StateROXX -> StateROSX
      if (s.writable) {
        //StateROSX -> StateROSW
      }
    }
  }
}
```

## Creating States

### Shorthand state generators

```typescript
state.ok(value); // ROS  — read-only, sync, always ok
state.ok_w(value); // ROSW — writable, sync, always ok
state.from(value); // RES  — read-only, sync, error-capable
state.from_w(value); // RESW — writable, sync, error-capable
state.err(error); // RES  — read-only, sync, starts with the NiceError error
state.err_w(error); // RESW — writable, sync, starts with the NiceError error
```

### Local States

For full control over initial values, use the lower-level local factories. Each accepts a `Result` value:

```typescript
import { ok, err_nice } from "@chocbite/ts-lib/result";

const NOT_CONNECTED = Symbol("Not connected");

const a = state.ros(ok(42)); // ROS
const b = state.rosw(ok(42)); // ROSW
const c = state.res(ok(42)); // RES
const d = state.resw(err_nice(NOT_CONNECTED, "n/a")); // RESW
```

State generators also accept a function which will be lazily executed at first access of state value:

```typescript
import { ok } from "@chocbite/ts-lib/result";
const f = state.ros(() => ok(42)); // ROS
```

Async local states accept an async function, which is lazily executed at first state access:

```typescript
const e = state.roa(async () => ok(await fetchData()));
const f = state.roaw(async () => ok(await fetchData()));
```

#### Owner

Every local generator returns an **owner** — the full state object that includes both the public state interface and privileged methods for updating it. The owner is what you keep internally; you hand out `state.read_only` or `state.read_write` to consumers.

```typescript
const counter = state.rosw(ok(0));

// Owner methods
counter.set(ok(5)); // set the raw Result value
counter.set_ok(5); // shorthand: wraps the value in ok() for you
counter.set_err(new NiceError(Symbol("Sensor offline"), "fail")); // set an error (only on error-capable states: RES/REA)

// The owner can get basic state types without access to the owner methods for passing on, or just set them to a variable with appropriate typeing
const read_only = counter.read_only; //Returns a read only view as StateROS<number>
const read_only_type: StateROS<number> = counter; //Only read only by type, the owner methods are still there at runtime
const read_write = counter.read_write; // Returns as StateROSW<number>
const read_write_type: StateROSW<number> = counter;
const state = counter.state; // Returns as State<number>
const state_type: State<number> = counter.state;
```

`set` and `set_ok` bypass the setter/validation pipeline — they directly replace the state value and notify subscribers. In contrast, `.write()` is the public API that goes through the setter function, the default setter rejects values the helper's `check` fails. `write` never clamps, call `limit` first when clamping is wanted, like a slider does.

You can also provide a custom setter to control how writes are applied:

```typescript
const NOT_A_NUMBER = Symbol("Not a number");

const limited = state.rosw(ok(0), async (value, owner, old) => {
  // Custom write logic
  if (Number.isNaN(value)) return err_nice(NOT_A_NUMBER, "NaN is not allowed");
  owner.set_ok(Math.min(100, Math.max(0, value)));
  return ok(undefined);
});
```

#### Read only view

`read_only` returns a view, not the state itself. The view forwards reading and subscribing to the state but has no write, setter or owner methods, `writable` is always `false`, `check` and `limit` give a not writable error, and its `write_enabled` gate is always false. Narrowing (`if (s.writable)`, `instanceof`) can not get write access back from it. The view keeps no value or subscribers of its own, it is created on first access of `read_only` and reused after that, so `owner.read_only !== owner` but `owner.read_only === owner.read_only`. Remote, proxy and collected states give a view the same way.

Assigning the owner to a read only type (`const s: StateROS<number> = counter`) is only read only for TypeScript, use `read_only` when handing a state to code that must not write.

#### Write gate

`writable` says whether a state can be written at all. A state can also be disabled for writing temporarily with a write gate, a `State<boolean>` set by the owner. While the gate is not `ok(true)`, `write` and `check` give a not writable error, without calling the setter or helper. The gate is readable as `write_enabled`, so a UI can subscribe to it to show an input as disabled, it is `undefined` when writing is not gated.

```typescript
const logged_in = state.ok_w(false);
const name = state.ok_w("");
name.set_write_enabled(logged_in);
await name.write("a"); // error of kind state.errors.NOT_WRITABLE
logged_in.set_ok(true);
await name.write("a"); // ok
name.set_write_enabled(undefined); // remove the gate
```

Local and remote states have `set_write_enabled`. Writable proxies use the gate of their source, read only proxies and read only views have a gate that is always false. Custom states extending `state.class` run their write through `write_gated` to apply the gate.

## Subscribing to State

```typescript
// Subscribe — callback receives a ResultNice<T>
const unsub = counter.sub((result) => {
  if (result.ok) {
    console.log(result.value);
  }
});

// Unsubscribe
counter.unsub(unsub);

// Subscribe with immediate invocation
counter.sub(callback, true);

// Promise-style using then executes immediately
counter.then((result) => {
  console.log(result.value);
});
// Promise-style using await syntax executes in microloop
console.log((await counter).value);
```

## Deriving a state

A state made from other states is a proxy or a collected state:

- **From one state, use a proxy**, `state.p`. It changes the value of that state, and can pass writes back to it, see [Proxy States](#proxy-states).
- **From several states, use a collected state**, `state.c`. It combines their values into one, see [Collected States](#collected-states).

Both follow their states only while they have subscribers themselves, so a derived state nobody uses costs nothing. The states of `make_fetch_parser` of `@chocbite/ts-lib/parse` are async states that can fail, so values combined from several members are `state.c.rea_ok`, one member changed is `state.p.rea`.

## Collected States

Combines the values of several states into one. The transform gets the result of every state, in the order the states are given, and returns the result of the collected state. It runs as a microtask, so states changed in the same cycle call it once.

```typescript
const first_name = state.ok("Alice");
const last_name = state.ok("Smith");

const full_name = state.c.ros(
  (vals) => ok(`${vals[0].value} ${vals[1].value}`),
  first_name,
  last_name,
);
// full_name.ok() === "Alice Smith"
```

Available variants: `state.c.ros`, `state.c.roa`, `state.c.res`, `state.c.rea`, the ok forms `res_ok` and `rea_ok` below, and the writable forms below.

### Errors of the states

With `res` and `rea` any state can give an error. **Return the failed result as it is** to pass the error on, it keeps its kind, message and cause, so the error shows where it came from. Returning a new error result works too, for an error that says what failed for the collected value.

```typescript
const temperature_text = state.c.rea(
  ([temperature, unit]) => {
    if (temperature.err) return temperature;
    if (unit.err) return unit;
    return ok(`${temperature.value} ${unit.value}`);
  },
  device.temperature,
  device.unit,
);
```

That is what the ok forms do for you, and is the way to write most transforms:

**Ok forms, `res_ok` and `rea_ok`,** give the transform the plain values and make an ok result of what it returns. The first error of the states is passed on as it is, without calling the transform. `set_getter` of such a state still takes the results.

```typescript
const temperature_text = state.c.rea_ok(
  ([temperature, unit]) => `${temperature} ${unit}`,
  device.temperature,
  device.unit,
);
```

To report every error instead of the first, `result.all_nice(values, kind)` of `@chocbite/ts-lib/result` makes one error of a kind of your own, with every error of the states inside it:

```typescript
const settings = state.c.rea(
  (values) => result.all_nice(values, SETTINGS_INVALID).map(([speed, mode]) => ({ speed, mode })),
  device.speed,
  device.mode,
);
```

### Writable collected states

**Writable forms, `rosw`, `roaw`, `resw`, `reaw`, `resw_ok` and `reaw_ok`,** take a `StateCollectedWrite` before the states. Each function gets the written value and the collected states:

- `write(value, states)` sends the value on, usually by writing parts of it to the collected states, and gives the result of that.
- `check(value, states)` tells if a value can be written, `limit(value, states)` gives the closest value that can. Both are optional, and give the value as it is when left out.

All three go through the write gate, `set_write_enabled(gate)` sets it, see [Write gate](#write-gate). The read only view is not writable.

```typescript
const span = state.c.resw(
  (values) => result.all_nice(values, RANGE_INVALID).map(([min, max]) => max - min),
  {
    write: (value: number, [min, max]) => max.write(min.ok() + value),
    check: async (value) => (value >= 0 ? ok(value) : err_nice(RANGE_INVALID, "Span below 0")),
  },
  min,
  max,
);
```

## Proxy States

Changes the value of one state, for several states use a [collected state](#collected-states). The read transform gets the result of the state, so with `res` and `rea` an error is passed on by returning it, `(val) => val.err ? val : ok(val.value * 2)`, or with `val.map((v) => v * 2)`, which passes an error on by itself. Without a transform the proxy gives the value of the state as it is. With write transforms it can also pass writes back to the state:

```typescript
const source = state.ok_w(5);

// Read-only proxy that doubles the value
const doubled = state.p.ros(source, (val) => ok(val.value * 2));
// doubled.ok() === 10

// Writable proxy, writes, check and limit go to the source as they are
const shown = state.p.rosw(source, (val) => ok(val.value * 2));

// Writable proxy with a write of its own, here showing the value as text
const text = state.p.rosw(source, (val) => ok(String(val.value)), {
  write: (value: string, source) => source.write(Number(value)),
  check: async (value) => (isNaN(Number(value)) ? err_nice(NOT_A_NUMBER, `${value} is not a number`) : ok(value)),
});
```

The writable proxies `rosw`, `roaw`, `resw` and `reaw` take an optional `StateProxyWrite` after the read transform:

- **Without it** the proxy has the write type of its source, and writes, `check` and `limit` go to the source as they are.
- **With it** the proxy can have a write type of its own, and needs it for that, the types refuse a proxy with another write type without it. `write(value, source)` sends the value on, usually by writing it, changed, to the source. `check(value, source)` and `limit(value, source)` are optional, and give the value as it is when left out. All three go through the write gate of the source.

It is the same form as the write of [collected states](#writable-collected-states), with the source in place of the collected states. `set_write(write)` changes it later, `undefined` writes to the source as it is again.

## Remote States

Remote states represent asynchronous resources that are fetched on demand or streamed via a subscription. They are always async (`ROA`/`REA`/`ROAW`/`REAW`).

Each remote generator (`state.r.*.from`) takes three callback functions and an optional timing configuration:

- **`once`** — called when the state value is awaited (one-shot fetch). Call `owner.update_single(value)` to deliver the result.
- **`setup`** — called when the first subscriber arrives. Use this to open a connection or start polling. Call `owner.update_value(value)` to push new values.
- **`teardown`** — called when the last subscriber leaves. Clean up connections here.

```typescript
let ws;
const user_data = state.r.roa.from<User>(
  // once: one-shot fetch when awaited
  async (owner) => {
    const data = await fetch("/api/user").then((r) => r.json());
    owner.update_single(ok(data));
  },
  // setup: called on first subscription
  (owner) => {
    const ws = new WebSocket("/api/user_subscribe");
    ws.onmessage = (e) => owner.update_value(ok(JSON.parse(e.data)));
  },
  // teardown: called when all subscribers leave
  () => {
    ws.close();
  },
);
```

Timing options control debounce, validity caching, and retention:

```typescript
state.r.rea.from(once, setup, teardown, {
  timeout: 1000, // ms before waiting reads get an error if no response, ok states (roa/roaw) keep waiting and the next read retries
  debounce: 50, // ms to batch multiple awaits into one fetch
  validity: 5000, // ms the buffered value stays fresh (or true = while connected, until teardown after retention)
  retention: 200, // ms to keep the connection after last unsubscribe
});
```

Writable remote variants (`state.r.roaw`, `state.r.reaw`) additionally accept a `write_action` callback:

```typescript
const setting = state.r.roaw.from<number>(
  once,
  setup,
  teardown,
  async (value, owner) => {
    await fetch("/api/setting", {
      method: "POST",
      body: JSON.stringify(value),
    });
    return ok(undefined);
  },
  { write_debounce: 300 }, // ms to wait before using the last value written
);
```

Available variants: `state.r.roa`, `state.r.rea`, `state.r.roaw`, `state.r.reaw`.

## Errors

The error of a state is a `NiceError` from `@chocbite/ts-lib/result`: a `kind` symbol whose description is a short text for the user, the `message` with the details, and for a failure caused by a thrown error, that error as `cause`, with its stack. `StateResult<T>` is `ResultNice<T>`. Two errors of the same kind and message count as the same value, so a state that fails the same way again doesn't notify its subscribers.

Errors you put into a state yourself, with `set_err`, `state.err`, `err_nice` from a setter or a remote state, use your own kinds. Make them with `Symbol("…")`, the description is the text the user sees.

Errors of normal use, like a value above its max, have only a message. Errors that aren't supposed to happen have an `Error` as `cause`, marked with ✱ below. For a write to a state that can't be written, its stack shows the code that tried to write.

The state system makes these kinds, in `state.errors`:

| Kind                | Nice text            | When                                                                                                     |
| ------------------- | -------------------- | -------------------------------------------------------------------------------------------------------- |
| `NOT_WRITABLE` ✱    | Not writable         | A write, check or limit on a state that can't be written, a bug.                                         |
| `WRITE_DISABLED`    | Writing disabled     | A write or check while the write gate of the state is closed.                                            |
| `NO_STATES`         | No data              | A collected state without states.                                                                        |
| `INIT_FAILED` ✱     | Failed to load value | The init function of a lazy state threw, the `cause` is what it threw.                                   |
| `TIMED_OUT` ✱       | No response          | A remote state got no value within its timeout.                                                          |
| `WRITE_FAILED` ✱    | Write failed         | The write action of a remote state threw, the `cause` is what it threw.                                  |
| `ABOVE_MAX`         | Value too high       | A number above `max`.                                                                                    |
| `BELOW_MIN`         | Value too low        | A number below `min`.                                                                                    |
| `OFF_STEP`          | Value not on a step  | A number not on `step` from `start`.                                                                     |
| `TOO_MANY_DECIMALS` | Too many decimals    | A number with more than `decimals` decimals.                                                             |
| `TEXT_TOO_LONG`     | Text too long        | A text longer than `max_length` characters or `max_length_bytes` bytes.                                  |
| `NOT_IN_LIST`       | Value not available  | An enum value that isn't in the list. While the list itself is an error, a check gives the list's error. |

```typescript
const result = await temperature.write(150);
if (result.err && result.error.kind === state.errors.ABOVE_MAX) show_max_hint();
```

## Helpers

### Array

States holding arrays get built-in mutation helpers:

```typescript
const list = state.rosw(ok([1, 2, 3]));

list.array.push(4); // [1, 2, 3, 4]
list.array.unshift(0); // [0, 1, 2, 3, 4]
list.array.pop(); // [0, 1, 2, 3]
list.array.shift(); // [1, 2, 3]
list.array.splice(1, 0, 99); // [1, 99, 2, 3]
list.array.splice(0, 1); // [99, 2, 3]
list.array.change(0, 50); // [50, 2, 3]
list.array.move(0, 2); // [2, 3, 50]
list.array.delete(3); // [2, 50]  (removes by value)
list.array.sort((a, b) => a - b);
```

Each mutation is tracked with metadata (`added`, `removed`, `changed`, `moved`, `fresh`).

### Object

States holding objects get field-level mutation helpers:

```typescript
const obj = state.rosw(ok({ a: 1, b: 2 }));

obj.object.change("a", 10); // { a: 10, b: 2 }
obj.object.add("c", 3); // { a: 10, b: 2, c: 3 }
obj.object.remove("b"); // { a: 10, c: 3 }
```

Each mutation is tracked with metadata (`added`, `removed`, `changed`, `fresh`).

### Number

```typescript
const temperature = state.rosw(
  state.n.help(ok(20), {
    min: state.ok(0),
    max: state.ok(100),
    step: state.ok(0.5),
  }),
  true,
);

await temperature.write(150); // error ABOVE_MAX, "150 is bigger than the limit of 100", value unchanged
await temperature.limit(150); // returns ok(100)
await temperature.check(20.3); // error OFF_STEP, "20.3 is not on a step of 0.5"
temperature.related().unwrap().min; // state holding 0
```

Options: `min`, `max`, `step`, `start`, `decimals`, `unit` — each is itself a `State`, so limits can be reactive. `check` rejects values outside `min`/`max` and values not on `step`/`start`/`decimals`, except `min` and `max` themselves.

### String

```typescript
const name = state.rosw(
  state.s.help(ok("hello"), {
    max_length: state.ok(10),
    max_length_bytes: state.ok(10),
  }),
  true,
);

await name.write("this is too long"); // error TEXT_TOO_LONG, "the text is longer than the limit of 10 characters", value unchanged
await name.limit("this is too long"); // returns ok("this is to")
await name.check("this is ææ"); // error TEXT_TOO_LONG, "the text is longer than the limit of 10 bytes"
```

Options: `max_length`, `max_length_bytes`.

### Enum

Enum values are strings. The list is an object, which turns number keys into strings, so number keys are rejected by the types.

```typescript
export const Color = {
  Red: "red",
  Green: "green",
  Blue: "blue",
} as const;
export type Color = (typeof Color)[keyof typeof Color];

const list = state.e.list<Color>({
  [Color.Red]: { name: "Red" },
  [Color.Green]: {
    name: "Green",
    description: "The color green, what more is needed",
  },
  [Color.Blue]: {
    name: "Blue",
    description: "I'm blue dabudedabuda",
    icon: () => blue_icon.cloneNode(),
  },
});

const color = state.rosw(
  state.e.help(ok(Color.Red as Color), { list: state.ok(list) }),
  true,
);
```

### Boolean

```typescript
const flag = state.rosw(state.b.help(ok(true)), true);
```

## Type Guards

Check state types at runtime:

```typescript
state.is.state(obj); // Is any state?
state.is.ros(obj); // Is ROS?
state.is.rosw(obj); // Is ROSW?
state.is.res(obj); // Is RES?
// ... and so on for all eight types
```

## Initial Value or State

`StateOrVal<T>` is either an initial value or a state giving the value. It is meant for inputs, like element options, where a user can give a value to start from or bind a state. An initial value is applied once and not followed, a state is followed, so a value changed from outside must be a state. A receiver that changes the value itself, like an element the user changes, starts from an initial value and keeps its changes.

There is one variant per state type, `StateOrValROS<T>`, `StateOrValROSW<T>` and so on, each is `T | StateXXX<T>`. A writable variant lets the receiver write to the state when one is given, an initial value has nothing to write to.

The value type must not itself be a state, as it could not be told apart from the state.

```typescript
function show(text: StateOrValRES<string>) {
  // Narrows to the exact state type, the else branch is the initial value
  if (state.is.state_of(text)) text.sub((result) => console.log(result), true);
  else console.log(text);
}

function edit(value: StateOrValROSW<number>) {
  if (state.is.state_of(value)) value.write(5); // StateROSW<number>
}

// Returns the state, or the initial value wrapped in a read only ok state,
// for when a state is needed, like to pass on or hand out
const scale = state.as_state(options.scale ?? 1); // StateOrValROSW<number> gives StateROS<number>
```

`as_state` returns the read only type matching the input, `StateOrValROSW` and `StateOrValROS` give `StateROS`, `StateOrValRES` gives `StateRES` and so on.

## Viewer

`state.v.viewer(root, callback)` calls the callback when the root, or any state in its value, changes, at any depth: states holding states, and states inside arrays and objects, the same tree `to_json` writes. It is for following a whole tree of data, like storing a page of widgets whenever anything on it changes.

```typescript
const x = state.ok_w(1);
const widgets = state.ok_w([{ path: "/a", options: { x } }]);
const view = state.v.viewer(widgets, () => console.log("changed"));
x.set_ok(2); // changed
widgets.set_ok([]); // changed, x is no longer followed
view.unsub();
```

- The callback is not called for the first values, only for changes.
- When a state changes, its new value is walked again. States still in it keep their subscription, new states are subscribed and states that are gone are unsubscribed, compared by identity.
- Async states are followed once they have a value.
- A value can give what is walked instead of itself with `state.v.OVERRIDE_KEY`, like a class instance holding states. `to_json` uses the same key.

## Utilities

```typescript
// Await the first emitted value from any state
const value = await state.u.await_value(myState);

// Compare any two state values for equality, returns a promise
const equal = state.u.compare(stateA, stateB);

// Compare two states sync state values
const equal = state.u.compare_sync(stateA, stateB);
```

## License

MIT
