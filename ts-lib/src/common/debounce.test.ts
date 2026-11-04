import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce } from "./debounce";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should delay execution of the function", () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 100);

    debounced();
    expect(callback).not.toHaveBeenCalled();

    // Fast-forward time
    vi.advanceTimersByTime(50);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should only execute once if called multiple times rapidly", () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 100);

    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should use the most recent arguments provided", () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 100);

    debounced("first");
    debounced("second");
    debounced("third");

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledWith("third");
  });

  it("should trigger on the leading edge when leading option is true", () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 100, true);

    debounced("leading call");

    // Should call immediately
    expect(callback).toHaveBeenCalledWith("leading call");
    expect(callback).toHaveBeenCalledTimes(1);

    // Should not call again at the end of the timeout if no other calls happened
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should handle a trailing call after a leading call", () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 100, true);

    debounced("first"); // Immediate
    debounced("second"); // Buffers

    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    // Based on your implementation, the trailing call executes after 'wait'
    expect(callback).toHaveBeenCalledWith("second");
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("should reset the timer on every call", () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced(); // Reset
    vi.advanceTimersByTime(50);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
