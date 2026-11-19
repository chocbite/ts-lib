import { describe, expect, expectTypeOf, it } from "vitest";
import {
  err,
  err_nice,
  NiceError,
  ok,
  type ResultErr,
  result,
  type Result,
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

describe("NiceError equality in tests", () => {
  it("is toEqual only for the same kind and detail, so tests can compare whole results", () => {
    expect(new NiceError(CONNECTION_LOST, "a")).toEqual(new NiceError(CONNECTION_LOST, "a"));
    expect(new NiceError(CONNECTION_LOST, "a")).not.toEqual(new NiceError(CONNECTION_LOST, "b"));
    expect(err_nice(CONNECTION_LOST, "a")).not.toEqual(err_nice(SERVER_ERROR, "a"));
  });
});

describe("NiceError with inner errors", () => {
  const FORM_INVALID = Symbol("Invalid values");

  it("has no inner errors by default, shared so an error without them costs no array", () => {
    const a = new NiceError(CONNECTION_LOST, "a");
    const b = new NiceError(CONNECTION_LOST, "b");

    expect(a.errors).toEqual([]);
    expect(a.errors).toBe(b.errors);
  });

  it("keeps the inner errors it is made with, like the errors of the elements of a form", () => {
    const inner = [new NiceError(CONNECTION_LOST, "speed"), new NiceError(SERVER_ERROR, "unit")];

    const error = new NiceError(FORM_INVALID, "Elements speed, unit have no value", inner);

    expect(error.errors).toEqual(inner);
    expect(err_nice(FORM_INVALID, "x", inner).error.errors).toEqual(inner);
  });

  it("is equal only with equal inner errors, so a change of an inner error is a change", () => {
    const make = (inner: string) => new NiceError(FORM_INVALID, "same", [new NiceError(CONNECTION_LOST, inner)]);

    expect(make("speed").equals(make("speed"))).toBe(true);
    expect(make("speed").equals(make("unit"))).toBe(false);
    expect(make("speed").equals(new NiceError(FORM_INVALID, "same"))).toBe(false);
  });
});

describe("result.all_nice", () => {
  const FORM_INVALID = Symbol("Form invalid");
  const A = Symbol("A");
  const B = Symbol("B");

  it("gives the values in order when all are ok, typed per position", () => {
    const results = [ok(1), ok("a"), ok(true)] as [ResultNice<number>, ResultNice<string>, ResultNice<boolean>];

    const all = result.all_nice(results, FORM_INVALID);

    expect(all.ok && all.value).toEqual([1, "a", true]);
    expectTypeOf(all).toEqualTypeOf<Result<[number, string, boolean], NiceError>>();
  });

  it("gives an array of values for an array of results", () => {
    const results: ResultNice<number>[] = [ok(1), ok(2)];

    const all = result.all_nice(results, FORM_INVALID);

    expect(all.ok && all.value).toEqual([1, 2]);
    expectTypeOf(all).toEqualTypeOf<Result<number[], NiceError>>();
  });

  it("gives one error of the kind with every error inside, in order", () => {
    const a = new NiceError(A, "first");
    const b = new NiceError(B, "second");

    const all = result.all_nice([err(a), ok(1), err(b)], FORM_INVALID);

    expect(all.err).toBe(true);
    const error = all.unwrap_err();
    expect(error.kind).toBe(FORM_INVALID);
    expect(error.errors).toEqual([a, b]);
    expect(error.errors[0]).toBe(a);
    expect(error.message).toBe("2 of 3 failed");
  });

  it("gives an ok empty array for no results", () => {
    const all = result.all_nice([], FORM_INVALID);

    expect(all.ok && all.value).toEqual([]);
  });
});
