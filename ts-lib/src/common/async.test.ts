import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deferrer,
  is_promise_like,
  sleep,
  sleep_lazy,
  sync_reject,
  sync_resolve,
} from "./async";

describe("is_promise_like", () => {
  it("returns true for a native Promise", () => {
    expect(is_promise_like(Promise.resolve(1))).toBe(true);
  });

  it("returns true for an object with a then function", () => {
    expect(is_promise_like({ then: () => {} })).toBe(true);
  });

  it("returns true for an instant_promise", () => {
    expect(is_promise_like(sync_resolve(42))).toBe(true);
  });

  it("returns false for null", () => {
    expect(is_promise_like(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(is_promise_like(undefined)).toBe(false);
  });

  it("returns false for a plain object without then", () => {
    expect(is_promise_like({ value: 1 })).toBe(false);
  });

  it("returns false for an object where then is not a function", () => {
    expect(is_promise_like({ then: 42 })).toBe(false);
  });

  it("returns false for a number", () => {
    expect(is_promise_like(42)).toBe(false);
  });

  it("returns false for a string", () => {
    expect(is_promise_like("promise")).toBe(false);
  });
});

describe("Sync PromiseLike", () => {
  describe("Sync PromiseLike Chaining", () => {
    it("resolves simple values through multiple .then() calls", () => {
      let result = "";
      sync_resolve("a")
        .then((v) => v + "b")
        .then((v) => v + "c")
        .then((v) => {
          result = v;
        });

      expect(result).toBe("abc");
    });

    it("recovers from errors when onrejected returns a value", () => {
      let recovered_value = "";
      sync_reject("error")
        .then(null, (err) => {
          expect(err).toBe("error");
          return "recovered";
        })
        .then((v) => {
          recovered_value = v;
        });
      expect(recovered_value).toBe("recovered");
    });

    it("propagates errors if no onrejected is provided", () => {
      let caught = "";
      sync_reject("initial failure")
        .then((v) => v + " ignored")
        .then(null, (err) => {
          caught = err as string;
        });

      expect(caught).toBe("initial failure");
    });
  });

  describe("Native Interop", () => {
    it("is consumable by Promise.resolve()", async () => {
      const sync = sync_resolve(100);
      const native = Promise.resolve(sync);

      expect(native).toBeInstanceOf(Promise);
      await expect(native).resolves.toBe(100);
    });

    it("works with async/await keywords", async () => {
      async function test_async() {
        const val = await sync_resolve("hello");
        return val + " world";
      }

      const result = await test_async();
      expect(result).toBe("hello world");
    });

    it("correctly assimilates a native Promise returned from .then()", async () => {
      const chain = sync_resolve("sync").then(() => Promise.resolve("native"));

      // Because your sync_resolved checks is_promise_like,
      // it should return the native promise directly or wrap it.
      const result = await chain;
      expect(result).toBe("native");
    });
  });

  describe("Execution Timing", () => {
    it("executes .then() callbacks immediately (synchronously)", () => {
      const execution_order: string[] = [];

      execution_order.push("start");
      sync_resolve("data").then(() => {
        execution_order.push("sync-callback");
      });
      execution_order.push("end");

      expect(execution_order).toEqual(["start", "sync-callback", "end"]);
    });

    it("contrasts with native Promise timing", async () => {
      const execution_order: string[] = [];

      execution_order.push("start");
      Promise.resolve().then(() => {
        execution_order.push("native-callback");
      });
      execution_order.push("end");
      await Promise.resolve(); // flush native microtasks
      // In native promises, 'end' comes before 'native-callback'
      expect(execution_order).toEqual(["start", "end", "native-callback"]);
    });
  });

  describe("Boundary Conditions", () => {
    it("onfulfilled throwing an error triggers subsequent onrejected", () => {
      let error_caught = "";
      sync_resolve("initial")
        .then(() => {
          throw new Error("sync failure");
        })
        .then(
          () => "should not happen",
          (err: Error) => {
            error_caught = err.message;
          },
        );

      expect(error_caught).toBe("sync failure");
    });

    it("supports null/undefined onfulfilled arguments", () => {
      const result = sync_resolve(42)
        .then(undefined)
        .then((v) => v);

      // Should behave like an identity function
      let final;
      result.then((v) => {
        final = v;
      });
      expect(final).toBe(42);
    });
  });
});

describe("sleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves after the given number of milliseconds", async () => {
    const promise = sleep(100);
    vi.advanceTimersByTime(100);
    await expect(promise).resolves.toBeUndefined();
  });

  it("does not resolve before the given time", async () => {
    let resolved = false;
    sleep(100).then(() => {
      resolved = true;
    });
    vi.advanceTimersByTime(99);
    await Promise.resolve(); // flush microtasks
    expect(resolved).toBe(false);
  });

  it("resolves with the provided argument", async () => {
    const promise = sleep(50, "hello");
    vi.advanceTimersByTime(50);
    await expect(promise).resolves.toBe("hello");
  });

  it("resolves with undefined when no argument is given", async () => {
    const promise = sleep(50);
    vi.advanceTimersByTime(50);
    await expect(promise).resolves.toBeUndefined();
  });
});

describe("sleep_lazy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves after the given number of milliseconds", async () => {
    const promise = sleep_lazy(100, () => "done");
    vi.advanceTimersByTime(100);
    await expect(promise).resolves.toBe("done");
  });

  it("calls the factory function only after the delay", async () => {
    const factory = vi.fn(() => 99);
    const promise = sleep_lazy(100, factory);
    expect(factory).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    await expect(promise).resolves.toBe(99);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("resolves with the return value of the factory function", async () => {
    const promise = sleep_lazy(50, () => ({ key: "value" }));
    vi.advanceTimersByTime(50);
    await expect(promise).resolves.toEqual({ key: "value" });
  });
});

describe("defer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("schedules the function only when the returned function is called", () => {
    const callback = vi.fn();
    const schedule = deferrer(100, callback);

    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();

    schedule();
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not execute the function before the given delay", () => {
    const callback = vi.fn();
    const schedule = deferrer(100, callback);

    schedule();
    vi.advanceTimersByTime(99);

    expect(callback).not.toHaveBeenCalled();
  });

  it("calls the function with the provided argument", () => {
    const callback = vi.fn();
    const schedule = deferrer(100, callback, "value");

    schedule();
    vi.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalledWith("value");
  });
});
