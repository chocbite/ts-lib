import { afterEach, describe, expect, it, vi } from "vitest";
import { fetch_status_safe, fetch_text_safe, FetchStatusError } from "./fetch";

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

  it("gives the body of a failed status in the FetchStatusError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Speed too high", { status: 400 })));

    const result = await fetch_text_safe("/x");

    expect(!result.ok && (result.error as FetchStatusError).body).toBe("Speed too high");
  });

  it("gives an empty body in the FetchStatusError when the body of a failed status fails to load", async () => {
    const response = new Response("Speed too high", { status: 400 });
    vi.spyOn(response, "text").mockRejectedValue(new TypeError("connection reset"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const result = await fetch_text_safe("/x");

    expect(!result.ok && result.error).toBeInstanceOf(FetchStatusError);
    expect(!result.ok && (result.error as FetchStatusError).body).toBe("");
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

describe("fetch_status_safe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gives the status of an ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const result = await fetch_status_safe("/x", { method: "PATCH" });

    expect(result.ok && result.value).toBe(204);
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

    expect(result.ok && result.value).toBe(200);
  });

  it("gives the rejection of fetch as the error, unchanged", async () => {
    const failure = new TypeError("Failed to fetch");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));

    const result = await fetch_status_safe("/x");

    expect(!result.ok && result.error).toBe(failure);
  });

  it("wraps a rejection that is not an Error in an Error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("gone"));

    const result = await fetch_status_safe("/x");

    expect(!result.ok && result.error.message).toBe("gone");
  });

  it("gives a failed status as a FetchStatusError with the status and body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Speed too high", { status: 400 })));

    const result = await fetch_status_safe("/x");

    expect(!result.ok && result.error).toBeInstanceOf(FetchStatusError);
    expect(!result.ok && (result.error as FetchStatusError).status).toBe(400);
    expect(!result.ok && (result.error as FetchStatusError).body).toBe("Speed too high");
    expect(!result.ok && result.error.message).toBe("HTTP 400");
  });
});
