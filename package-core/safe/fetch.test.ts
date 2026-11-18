import { NiceError, type Result } from "#result";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { fetch_status_safe, fetch_text_safe, FetchStatusError, type FetchResponse } from "./fetch";
import safe from "./index";

const errors = safe.fetch.errors;

afterEach(() => {
  vi.unstubAllGlobals();
});

/**The result is an error with a NiceError of kind, kind is checked to be a symbol so a missing export can not pass*/
const expect_kind = (result: Result<unknown, NiceError>, kind: symbol) => {
  expect(typeof kind).toBe("symbol");
  expect(!result.ok && result.error).toBeInstanceOf(NiceError);
  expect(!result.ok && result.error.kind).toBe(kind);
};

describe("fetch_text_safe", () => {
  it("gives the body text of an ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("hello")));

    const result = await fetch_text_safe("/x");

    expect(result.ok && result.value[0]).toBe("hello");
    expect(result.ok && result.value[1].status).toBe(200);
  });

  it("passes url and init to fetch", async () => {
    const fetch_mock = vi.fn().mockResolvedValue(new Response(""));
    vi.stubGlobal("fetch", fetch_mock);
    const init = { method: "PATCH", body: "{}" };

    await fetch_text_safe("/x", init);

    expect(fetch_mock).toHaveBeenCalledWith("/x", init);
  });

  it("gives a body that fails to load as connection lost, with the rejection as cause", async () => {
    const failure = new TypeError("connection reset");
    const response = new Response("{}");
    vi.spyOn(response, "text").mockRejectedValue(failure);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const result = await fetch_text_safe("/x");

    expect_kind(result, errors.CONNECTION_LOST);
    expect(!result.ok && result.error.cause).toBe(failure);
  });

  it("gives a real abort as aborted", async () => {
    const result = await fetch_text_safe("http://localhost/", {
      signal: AbortSignal.abort(),
    });

    expect_kind(result, errors.ABORTED);
  });
});

describe("the response given with the value", () => {
  it("gives fetch_text_safe the text and the response, for the status and headers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 201, headers: { "x-token": "abc" } })),
    );

    const result = await fetch_text_safe("/login", { method: "POST" });

    if (!result.ok) throw new Error("expected ok");
    const [text, response] = result.value;
    expect(text).toBe("{}");
    expect(response.status).toBe(201);
    expect(response.headers.get("x-token")).toBe("abc");
  });

  it("gives fetch_status_safe the response, its status is the status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 201 })));

    const result = await fetch_status_safe("/login", { method: "POST" });

    expect(result.ok && result.value.status).toBe(201);
  });

  it("types the response without its body, which is read or cancelled already", () => {
    expectTypeOf<FetchResponse>().toHaveProperty("status");
    expectTypeOf<FetchResponse>().toHaveProperty("headers");
    expectTypeOf<FetchResponse>().not.toHaveProperty("text");
    expectTypeOf<FetchResponse>().not.toHaveProperty("json");
    expectTypeOf<FetchResponse>().not.toHaveProperty("body");
  });
});

describe("fetch_status_safe", () => {
  it("gives the status of an ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const result = await fetch_status_safe("/x", { method: "PATCH" });

    expect(result.ok && result.value.status).toBe(204);
  });

  it("passes url and init to fetch", async () => {
    const fetch_mock = vi.fn().mockResolvedValue(new Response(""));
    vi.stubGlobal("fetch", fetch_mock);
    const init = { method: "POST", body: "{}" };

    await fetch_status_safe("/x", init);

    expect(fetch_mock).toHaveBeenCalledWith("/x", init);
  });

  it("cancels the body it does not read", async () => {
    const response = new Response("unused");
    const cancel = vi.spyOn(response.body!, "cancel");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await fetch_status_safe("/x");

    expect(cancel).toHaveBeenCalled();
  });

  it("gives the status when cancelling the body fails", async () => {
    const response = new Response("unused");
    vi.spyOn(response.body!, "cancel").mockRejectedValue(new Error("cancel failed"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const result = await fetch_status_safe("/x");

    expect(result.ok && result.value.status).toBe(200);
  });
});

describe.each([
  ["fetch_text_safe", fetch_text_safe],
  ["fetch_status_safe", fetch_status_safe],
])("%s errors", (_name, fetch_safe) => {
  it("gives a rejection of fetch as connection failed, with the rejection as cause", async () => {
    const failure = new TypeError("Failed to fetch");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));

    const result = await fetch_safe("/x");

    expect(!result.ok && result.error).toBeInstanceOf(NiceError);
    expect_kind(result, errors.CONNECTION_FAILED);
    expect(!result.ok && result.error.nice).toBe("Connection failed");
    expect(!result.ok && result.error.message).toBe("Failed to fetch");
    expect(!result.ok && result.error.cause).toBe(failure);
  });

  it("gives a rejection named TimeoutError as timed out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("signal timed out", "TimeoutError")));

    const result = await fetch_safe("/x");

    expect_kind(result, errors.TIMED_OUT);
    expect(!result.ok && result.error.message).toBe("signal timed out");
  });

  it("gives a rejection named AbortError as aborted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")));

    const result = await fetch_safe("/x");

    expect_kind(result, errors.ABORTED);
  });

  it("gives a rejection that is not an Error as connection failed with its text, without cause", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("gone"));

    const result = await fetch_safe("/x");

    expect_kind(result, errors.CONNECTION_FAILED);
    expect(!result.ok && result.error.message).toBe("gone");
    expect(!result.ok && result.error.cause).toBeUndefined();
  });

  it("gives a failed status as rejected, with a FetchStatusError with status and body as cause", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Speed too high", { status: 400 })));

    const result = await fetch_safe("/x");

    expect_kind(result, errors.REJECTED);
    expect(!result.ok && result.error.message).toBe("HTTP 400");
    const cause = !result.ok ? result.error.cause : undefined;
    expect(cause).toBeInstanceOf(FetchStatusError);
    expect((cause as FetchStatusError).status).toBe(400);
    expect((cause as FetchStatusError).body).toBe("Speed too high");
  });

  it("gives an empty body in the FetchStatusError when the body of a failed status fails to load", async () => {
    const response = new Response("Speed too high", { status: 400 });
    vi.spyOn(response, "text").mockRejectedValue(new TypeError("connection reset"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const result = await fetch_safe("/x");

    expect_kind(result, errors.REJECTED);
    expect(!result.ok && (result.error.cause as FetchStatusError).body).toBe("");
  });
});

describe("safe default export", () => {
  it("gives the fetch functions and their errors under fetch", () => {
    expect(safe.fetch.text).toBe(fetch_text_safe);
    expect(safe.fetch.status).toBe(fetch_status_safe);
    expect(Object.isFrozen(errors)).toBe(true);
    expect(errors.TIMED_OUT.description).toBe("Request timed out");
  });
});
