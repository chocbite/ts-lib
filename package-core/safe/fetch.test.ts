import { afterEach, describe, expect, it, vi } from "vitest";
import { fetch_text_safe, FetchStatusError } from "./fetch";

describe("fetch_text_safe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gives the body text of an ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("hello")));

    const result = await fetch_text_safe("/x");

    expect(result.ok && result.value).toBe("hello");
  });

  it("passes url and init to fetch", async () => {
    const fetch_mock = vi.fn().mockResolvedValue(new Response(""));
    vi.stubGlobal("fetch", fetch_mock);
    const init = { method: "PATCH", body: "{}" };

    await fetch_text_safe("/x", init);

    expect(fetch_mock).toHaveBeenCalledWith("/x", init);
  });

  it("gives the rejection of fetch as the error, unchanged", async () => {
    const failure = new TypeError("Failed to fetch");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));

    const result = await fetch_text_safe("/x");

    expect(!result.ok && result.error).toBe(failure);
  });

  it("wraps a rejection that is not an Error in an Error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("gone"));

    const result = await fetch_text_safe("/x");

    expect(!result.ok && result.error).toBeInstanceOf(Error);
    expect(!result.ok && result.error.message).toBe("gone");
  });

  it("gives a failed status as a FetchStatusError with the status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));

    const result = await fetch_text_safe("/x");

    expect(!result.ok && result.error).toBeInstanceOf(FetchStatusError);
    expect(!result.ok && (result.error as FetchStatusError).status).toBe(404);
    expect(!result.ok && result.error.message).toBe("HTTP 404");
  });

  it("gives a body that fails to load as the error", async () => {
    const failure = new TypeError("connection reset");
    const response = new Response("{}");
    vi.spyOn(response, "text").mockRejectedValue(failure);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const result = await fetch_text_safe("/x");

    expect(!result.ok && result.error).toBe(failure);
  });

  it("gives an abort as an error named AbortError", async () => {
    const result = await fetch_text_safe("http://localhost/", {
      signal: AbortSignal.abort(),
    });

    expect(!result.ok && result.error.name).toBe("AbortError");
  });
});
