import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { throttle } from "./throttle"; // Adjust path as needed

describe("throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should execute the first call immediately", () => {
    const func = vi.fn();
    const throttled = throttle(func, 100);

    throttled("first");

    expect(func).toHaveBeenCalledTimes(1);
    expect(func).toHaveBeenCalledWith("first");
  });

  it("should execute the trailing call after the wait period", () => {
    const func = vi.fn();
    const throttled = throttle(func, 100);

    throttled("first"); // Immediate execution
    throttled("second"); // Buffered

    // Advance time slightly (not enough to trigger interval)
    vi.advanceTimersByTime(50);
    expect(func).toHaveBeenCalledTimes(1);

    // Advance time to trigger first interval tick
    vi.advanceTimersByTime(50);
    expect(func).toHaveBeenCalledTimes(2);
    expect(func).toHaveBeenCalledWith("second");
  });

  it("should only execute the most recent call from the buffer", () => {
    const func = vi.fn();
    const throttled = throttle(func, 100);

    throttled(1); // 0ms: Executed
    throttled(2); // 20ms: Buffered
    throttled(3); // 50ms: Replaces 2 in buffer

    vi.advanceTimersByTime(100); // 100ms: Interval ticks, executes 3
    expect(func).toHaveBeenCalledTimes(2);
    expect(func).toHaveBeenLastCalledWith(3);
  });

  it("should clear the interval when state reaches 0", () => {
    const func = vi.fn();
    const throttled = throttle(func, 100);

    throttled(1); // state becomes 2, interval starts

    vi.advanceTimersByTime(100); // tick 1: state becomes 1
    vi.advanceTimersByTime(100); // tick 2: state becomes 0

    // At this point, the interval should be cleared.
    // If we call it again, it should start a fresh cycle.
    throttled(2);
    expect(func).toHaveBeenCalledTimes(2);
    expect(func).toHaveBeenLastCalledWith(2);
  });

  it("should handle multiple trailing calls across multiple intervals", () => {
    const func = vi.fn();
    const throttled = throttle(func, 100);

    throttled("a"); // Immediate
    throttled("b"); // Buffered

    vi.advanceTimersByTime(100); // Executes 'b', state = 1
    throttled("c"); // Buffered, state = 2

    vi.advanceTimersByTime(100); // Executes 'c', state = 1
    vi.advanceTimersByTime(100); // state = 0

    expect(func).toHaveBeenCalledTimes(3);
    expect(func).toHaveBeenNthCalledWith(1, "a");
    expect(func).toHaveBeenNthCalledWith(2, "b");
    expect(func).toHaveBeenNthCalledWith(3, "c");
  });
});
