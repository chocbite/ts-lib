# @chocbite/ts-lib/result

Rust-like `Result` and `Option` types for TypeScript.

## Quick Start

```typescript
import { ok, err, some, none } from "@chocbite/ts-lib/result";
import type { Result, Option } from "@chocbite/ts-lib/result";

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err("division by zero");
  return ok(a / b);
}

const result = divide(10, 2);

if (result.ok) {
  console.log(result.value); // 5
}

// Chain operations
divide(10, 2)
  .and_then((v) => ok(v * 2))
  .map((v) => v + 1); // Ok(11)

// Provide defaults
divide(10, 0).unwrap_or(0); // 0
```

## Result

A `Result<T, E>` represents either success (`ResultOk<T>`) or failure (`ResultErr<E>`).

### Creating Results

```typescript
import { ok, err } from "@chocbite/ts-lib/result";

const success = ok(42); // ResultOk<number>
const failure = err("oops"); // ResultErr<string>
```

### Properties

| Property | `ResultOk<T>` | `ResultErr<E>` |
| -------- | ------------- | -------------- |
| `.ok`    | `true`        | `false`        |
| `.err`   | `false`       | `true`         |
| `.value` | `T`           | —              |
| `.error` | —             | `E`            |

### Type Narrowing

Check `.ok` or `.err` to narrow the type:

```typescript
function handle(r: Result<number, string>) {
  if (r.ok) {
    r.value; // number
  } else {
    r.error; // string
  }
}
```

### Methods

#### `unwrap(): T`

Returns the value. Throws if the result is an error.

```typescript
ok(42).unwrap(); // 42
err("e").unwrap(); // throws
```

#### `unwrap_or<T2>(value: T2): T | T2`

Returns the value, or the provided default if the result is an error.

```typescript
ok(42).unwrap_or(0); // 42
err("e").unwrap_or(0); // 0
```

#### `unwrap_err(): E`

Returns the error. Throws if the result is ok.

```typescript
err("e").unwrap_err(); // "e"
ok(42).unwrap_err(); // throws
```

#### `unwrap_err_or<E2>(error: E2): E | E2`

Returns the error, or the provided default if the result is ok.

```typescript
err("e").unwrap_err_or("default"); // "e"
ok(42).unwrap_err_or("default"); // "default"
```

#### `expect(msg: string): T`

Returns the value. Throws with the given message if the result is an error.

```typescript
ok(42).expect("should exist"); // 42
err("e").expect("should exist"); // throws "should exist"
```

#### `expect_err(msg: string): E`

Returns the error. Throws with the given message if the result is ok.

```typescript
err("e").expect_err("should fail"); // "e"
ok(42).expect_err("should fail"); // throws "should fail"
```

#### `and_then<T2, E2>(mapper: (value: T) => Result<T2, E2>): Result<T2, E2>`

Calls `mapper` if the result is ok, otherwise returns the error unchanged.

```typescript
ok(2)
  .and_then((v) => ok(v * 10))
  .unwrap(); // 20

err("e").and_then((v) => ok(v * 10)); // Err("e")
```

#### `or_else<T2, E2>(mapper: (error: E) => Result<T2, E2>): Result<T2, E2>`

Calls `mapper` if the result is an error, otherwise returns the ok value unchanged.

```typescript
err("e")
  .or_else(() => ok(0))
  .unwrap(); // 0

ok(42)
  .or_else(() => ok(0))
  .unwrap(); // 42
```

#### `map<U>(mapper: (value: T) => U): Result<U, E>`

Transforms the ok value with `mapper`, leaving errors untouched.

```typescript
ok(2)
  .map((v) => v * 10)
  .unwrap(); // 20
err("e").map((v) => v * 10); // Err("e")
```

#### `map_err<F>(mapper: (error: E) => F): Result<T, F>`

Transforms the error with `mapper`, leaving ok values untouched.

```typescript
err("e")
  .map_err((e) => e.toUpperCase())
  .unwrap_err(); // "E"
ok(42).map_err((e) => e.toUpperCase()); // Ok(42)
```

#### `compare(other: Result<T, E>): boolean`

Compares two results for equality by value.

```typescript
ok(1).compare(ok(1)); // true
ok(1).compare(ok(2)); // false
ok(1).compare(err(1)); // false
```

#### `to_option(): Option<T>`

Converts to an `Option`, discarding the error if any.

```typescript
ok(42).to_option(); // Some(42)
err("e").to_option(); // None
```

## Option

An `Option<T>` represents either a value (`OptionSome<T>`) or no value (`OptionNone`).

### Creating Options

```typescript
import { some, none } from "@chocbite/ts-lib/result";

const value = some(42); // OptionSome<number>
const nothing = none(); // OptionNone
```

### Properties

| Property | `OptionSome<T>` | `OptionNone` |
| -------- | --------------- | ------------ |
| `.some`  | `true`          | `false`      |
| `.none`  | `false`         | `true`       |
| `.value` | `T`             | —            |

### Type Narrowing

```typescript
function handle(o: Option<number>) {
  if (o.some) {
    o.value; // number
  }
}
```

### Methods

#### `unwrap(): T`

Returns the value. Throws if the option is none.

```typescript
some(42).unwrap(); // 42
none().unwrap(); // throws
```

#### `unwrap_or<T2>(value: T2): T | T2`

Returns the value, or the provided default if the option is none.

```typescript
some(42).unwrap_or(0); // 42
none().unwrap_or(0); // 0
```

#### `expect(msg: string): T`

Returns the value. Throws with the given message if the option is none.

```typescript
some(42).expect("missing"); // 42
none().expect("missing"); // throws "missing"
```

#### `and_then<T2>(mapper: (value: T) => Option<T2>): Option<T2>`

Calls `mapper` if the option is some, otherwise returns none.

```typescript
some(2)
  .and_then((v) => some(v * 10))
  .unwrap(); // 20
none().and_then((v) => some(v * 10)); // None
```

#### `or_else<T2>(mapper: () => Option<T2>): Option<T2>`

Calls `mapper` if the option is none, otherwise returns the value unchanged.

```typescript
none()
  .or_else(() => some(0))
  .unwrap(); // 0
some(42)
  .or_else(() => some(0))
  .unwrap(); // 42
```

#### `map<U>(mapper: (value: T) => U): Option<U>`

Transforms the value with `mapper`, leaving none untouched.

```typescript
some(2)
  .map((v) => v * 10)
  .unwrap(); // 20
none().map((v) => v * 10); // None
```

#### `compare(other: Option<T>): boolean`

Compares two options for equality by value.

```typescript
some(1).compare(some(1)); // true
some(1).compare(none()); // false
none().compare(none()); // true
```

#### `to_result<E>(error: E): Result<T, E>`

Converts to a `Result`, using the provided error if the option is none.

```typescript
some(42).to_result("err"); // Ok(42)
none().to_result("err"); // Err("err")
```

## NiceError

An error for results that are shown to a user. It has a short nice text for the user, like "Connection lost", and the details for whoever has to fix it, the message and the original `Error` with its stack.

```typescript
import { err_nice, ok, type ResultNice } from "@chocbite/ts-lib/result";

export const SETTINGS_INVALID = Symbol("Settings are invalid");

function read_settings(text: string): ResultNice<Settings> {
  if (text === "") return err_nice(SETTINGS_INVALID, "The file is empty");
  try {
    return ok(JSON.parse(text) as Settings);
  } catch (cause) {
    return err_nice(SETTINGS_INVALID, cause instanceof Error ? cause : String(cause));
  }
}
```

- **`kind`** is a symbol that identifies the error. Its description is the nice text. Code can check it with `error.kind === CONNECTION_LOST` instead of matching text. Each module gives its kinds in an `errors` object, like `state.errors.NOT_WRITABLE` or `safe.fetch.errors.TIMED_OUT`, so they stay namespaced.
- **Use `Symbol("…")`, never `Symbol.for("…")`.** `Symbol.for` gives the same symbol for the same text everywhere, so two modules with a "Connection lost" kind would share it.
- **The detail is a message or an `Error`.** `err_nice(kind, "text")` uses the text as the message. `err_nice(kind, error)` uses the error's message and keeps the error as `cause`, with the stack of where it failed. A caught value that isn't an `Error` is turned into one of the two first, `cause instanceof Error ? cause : String(cause)`.
- **A message for normal use, an `Error` for what isn't supposed to happen.** A rejected input, a closed write gate or data that hasn't arrived yet are normal and frequent, a message is enough and costs no more than a string. A bug, a lost connection or a server sending wrong data isn't supposed to happen and is rare, so give it an `Error`, made where the problem is found, its stack shows the code that caused it.

| Member            | Gives                                                              |
| ----------------- | ------------------------------------------------------------------ |
| `kind`            | The symbol given.                                                  |
| `detail`          | The message or `Error` given. A plain field, so `toEqual` in tests compares it. |
| `nice`            | The description of `kind`, or `"Unknown error"` when it has none.  |
| `message`         | The message given, or the message of the `Error` given.            |
| `cause`           | The `Error` given, or `undefined` when made from a message.        |
| `equals(other)`   | True for the same `kind` and `message`.                            |
| `toString()`      | `"Connection lost: No network"`.                                   |

**`compare` treats two NiceErrors as equal when `equals` says so,** even when they are different objects. A source makes a new `NiceError` for every failure, and states compare results to skip updates that change nothing. Other errors are still compared by identity.

**It wraps an `Error` instead of extending it, for speed.** Creating an `Error` captures a stack trace, which takes about a microsecond. A `NiceError` costs about as much as a string, and the stack worth having is the one of the wrapped `Error`, where the failure happened. It is not an `Error`, so it is not meant to be thrown, it lives in results.

## Type Helpers

```typescript
import type {
  Result,
  Option,
  ResultInferOk,
  ResultInferErr,
  OptionInfer,
} from "@chocbite/ts-lib/result";

type MyResult = Result<number, string>;

type T = ResultInferOk<MyResult>; // number
type E = ResultInferErr<MyResult>; // string

type MyOption = Option<number>;
type V = OptionInfer<MyOption>; // number
```

## Type Guards

```typescript
import result from "@chocbite/ts-lib/result";

result.is_result(ok(1)); // true
result.is_option(some(1)); // true
```

## License

MIT
