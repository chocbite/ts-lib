# @chocbite/ts-lib/safe

Standard JavaScript functions that throw for ordinary failures, wrapped so they return a `Result` from `@chocbite/ts-lib/result` instead.

JavaScript throws the same kind of error for a failure you have to expect, like a network error, as for a bug, like reading a property of `undefined`. Code that catches one with a `try` around a whole block catches the other too, and the bug then looks like a network problem. The functions here catch only the call that can fail. Everything around them keeps throwing, so a bug still shows up as a bug.

The errors are `NiceError`s from `@chocbite/ts-lib/result`: a `kind` symbol whose description is a nice text for the user, the `message`, and the original error as `cause`, with its stack.

```typescript
import { FETCH_REJECTED, FETCH_TIMED_OUT, fetch_status_safe, fetch_text_safe, FetchStatusError } from "@chocbite/ts-lib/safe";
```

## Fetch

Both call the global `fetch` and take the same `(url, init?)`. They differ in what they give:

| Function                        | Gives                                  | Use for                                                    |
| ------------------------------- | -------------------------------------- | ---------------------------------------------------------- |
| `fetch_text_safe(url, init?)`   | `ResultNice<string>`, the body text    | Reading, like a GET whose answer you parse.                |
| `fetch_status_safe(url, init?)` | `ResultNice<number>`, the status       | Sending, like a POST or PATCH whose answer you don't need. The body isn't read. It's cancelled, so it doesn't hold the connection open. |

The error's `kind` is one of:

| Kind                      | Nice text                    | When                                                                                   | `cause`                                   |
| ------------------------- | ---------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------- |
| `FETCH_CONNECTION_FAILED` | Connection failed            | `fetch` rejects, like a network that is down or a server that doesn't answer.         | The rejection, usually a `TypeError`.     |
| `FETCH_TIMED_OUT`         | Request timed out            | `fetch` rejects with a `TimeoutError`, from a signal like `AbortSignal.timeout(ms)`.  | The `DOMException`.                       |
| `FETCH_ABORTED`           | Request aborted              | `fetch` rejects with an `AbortError`, the request was aborted through its signal.     | The `DOMException`.                       |
| `FETCH_REJECTED`          | Request rejected by server   | The status is not ok. The message is `HTTP 404`.                                       | A `FetchStatusError` with `status` and `body`. Servers often explain a rejection in the body. `body` is `""` when it fails to load. |
| `FETCH_CONNECTION_LOST`   | Connection lost              | The body fails to load, like a connection that drops while it loads. `fetch_text_safe` only. | The rejection of `response.text()`.  |

A rejection that isn't an `Error` becomes the message, as text, and there's no `cause`.

```typescript
const result = await fetch_text_safe("/api/device", { signal: AbortSignal.timeout(5000) });
if (result.ok) show(result.value);
else if (result.error.kind === FETCH_TIMED_OUT) show_offline();
else show_warning(result.error.nice); //"Connection failed", "Request rejected by server", …

const saved = await fetch_status_safe("/api/device", { method: "PATCH", body: JSON.stringify(change) });
if (saved.err && saved.error.cause instanceof FetchStatusError) show_warning(saved.error.cause.body);
```

With `make_fetch_parser` from `@chocbite/ts-lib/parse`, map the error to a string. `fetch_text_safe` fits the `fetch` option and `fetch_status_safe` the `write` option:

```typescript
make_fetch_parser(() => "/api/device", 1000, schema, {
  fetch: async (url, init) =>
    (await fetch_text_safe(url, { ...init, headers: { Authorization: `Bearer ${token()}` } })).map_err((e) => e.message),
  write: async (payload) =>
    (await fetch_status_safe("/api/device", { method: "PATCH", body: JSON.stringify(payload) }))
      .map(() => undefined)
      .map_err((e) => (e.cause instanceof FetchStatusError && e.cause.body) || e.message),
});
```
