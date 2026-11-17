import { describe, expect, expectTypeOf, it } from "vitest";
import {
  err,
  err_nice,
  NiceError,
  ok,
  type ResultErr,
  type ResultNice,
} from "./index";

const CONNECTION_LOST = Symbol("Connection lost");
const SERVER_ERROR = Symbol("Server error");

describe("NiceError", () => {
  it("takes the nice text from the description of its kind", () => {
    const error = new NiceError(CONNECTION_LOST, "Failed to fetch");

    expect(error.kind).toBe(CONNECTION_LOST);
    expect(error.nice).toBe("Connection lost");
  });

  it("gives a fallback nice text for a kind without description", () => {
    expect(new NiceError(Symbol(), "x").nice).toBe("Unknown error");
  });

  it("gives a string detail as the message, without cause", () => {
    const error = new NiceError(CONNECTION_LOST, "Failed to fetch");

    expect(error.message).toBe("Failed to fetch");
    expect(error.cause).toBeUndefined();
  });

  it("gives the message of an Error detail and keeps the Error as cause", () => {
    const cause = new TypeError("Failed to fetch");
    const error = new NiceError(CONNECTION_LOST, cause);

    expect(error.message).toBe("Failed to fetch");
    expect(error.cause).toBe(cause);
  });

  it("is equal to an error of the same kind and message", () => {
    const a = new NiceError(CONNECTION_LOST, "Failed to fetch");

    expect(a.equals(new NiceError(CONNECTION_LOST, "Failed to fetch"))).toBe(true);
    expect(a.equals(new NiceError(CONNECTION_LOST, new TypeError("Failed to fetch")))).toBe(true);
    expect(a.equals(new NiceError(CONNECTION_LOST, "HTTP 500"))).toBe(false);
    expect(a.equals(new NiceError(SERVER_ERROR, "Failed to fetch"))).toBe(false);
  });

  it("reads as nice text and message", () => {
    expect(String(new NiceError(CONNECTION_LOST, "Failed to fetch"))).toBe(
      "Connection lost: Failed to fetch",
    );
  });
});

describe("err_nice", () => {
  it("makes an error result with a NiceError from a message", () => {
    const result = err_nice(CONNECTION_LOST, "Failed to fetch");

    expect(result.err).toBe(true);
    expect(result.error).toBeInstanceOf(NiceError);
    expect(result.error.kind).toBe(CONNECTION_LOST);
    expect(result.error.message).toBe("Failed to fetch");
  });

  it("makes an error result with a NiceError wrapping an Error", () => {
    const cause = new TypeError("Failed to fetch");
    const result = err_nice(CONNECTION_LOST, cause);

    expect(result.error.message).toBe("Failed to fetch");
    expect(result.error.cause).toBe(cause);
  });

  it("names the nice text and message when unwrapped", () => {
    expect(() => err_nice(CONNECTION_LOST, "Failed to fetch").unwrap()).toThrow(
      "Connection lost: Failed to fetch",
    );
  });

  it("is typed as a ResultErr of NiceError, assignable to ResultNice", () => {
    expectTypeOf(err_nice(CONNECTION_LOST, "x")).toEqualTypeOf<ResultErr<NiceError>>();
    const value: ResultNice<number> = Math.random() > 2 ? ok(1) : err_nice(CONNECTION_LOST, "x");
    expect(value.err).toBe(true);
  });
});

describe("compare with NiceError", () => {
  it("is equal for errors of the same kind and message, also when they are different objects", () => {
    expect(err_nice(CONNECTION_LOST, "Failed to fetch").compare(err_nice(CONNECTION_LOST, "Failed to fetch"))).toBe(true);
  });

  it("is not equal for another message or kind", () => {
    const a = err_nice(CONNECTION_LOST, "Failed to fetch");

    expect(a.compare(err_nice(CONNECTION_LOST, "HTTP 500"))).toBe(false);
    expect(a.compare(err_nice(SERVER_ERROR, "Failed to fetch"))).toBe(false);
  });

  it("is not equal to an ok result", () => {
    expect(err_nice(CONNECTION_LOST, "x").compare(ok(1) as ResultNice<number>)).toBe(false);
  });

  it("still compares other errors by identity", () => {
    expect(err("a").compare(err("a"))).toBe(true);
    const object = { a: 1 };
    expect(err(object).compare(err({ a: 1 }))).toBe(false);
    expect(err(object).compare(err(object))).toBe(true);
  });
});
