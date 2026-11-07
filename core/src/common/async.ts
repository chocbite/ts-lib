/**Returns true if the given value is promise like */
export function is_promise_like<T>(value: any): value is PromiseLike<T> {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { then: () => void }).then === "function"
  );
}

/**Returns a promise that resolves after the given number of milliseconds with the given argument (if any).*/
export function sleep<T = void>(ms: number, arg?: T): Promise<T> {
  return new Promise((a) => setTimeout(() => a(arg as T), ms));
}

/**Returns a promise that resolves after the given number of milliseconds with the result of the given function (if any).*/
export function sleep_lazy<T = void>(ms: number, arg?: () => T): Promise<T> {
  return new Promise((a) =>
    setTimeout(() => a(arg ? arg() : (undefined as T)), ms),
  );
}

/**Returns a function that, when called, will execute the given function after the given number of milliseconds with the given argument (if any).*/
export function deferrer<T = void>(
  ms: number,
  f: () => void,
  arg?: T,
): () => void {
  return () => {
    setTimeout(() => (f as (a?: T) => void)(arg), ms);
  };
}

/**Returns a promise that executes synchronously when using .then() and resolves immediately with the given value.
 * Like a native promise, an error thrown by on_fulfilled gives a rejected result, it is not passed to on_rejected.*/
export function sync_resolve<T>(value: T | PromiseLike<T>): PromiseLike<T> {
  if (is_promise_like(value)) return value;
  return {
    then<TResult1 = T, TResult2 = never>(
      on_fulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      _on_rejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      if (!on_fulfilled) return sync_resolve(value as unknown as TResult1);
      try {
        const result = on_fulfilled(value);
        if (is_promise_like(result)) return result;
        return sync_resolve(result);
      } catch (error) {
        return sync_reject(error);
      }
    },
  };
}

/**Returns a promise that executes synchronously when using .then() and rejects immediately with the given reason.
 * Like Promise.reject, a promise given as reason is not awaited, it becomes the reason.*/
export function sync_reject(error: unknown): PromiseLike<never> {
  return {
    then<TResult1 = never, TResult2 = never>(
      _on_fulfilled?: ((value: never) => TResult1 | PromiseLike<TResult1>) | null,
      on_rejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      if (!on_rejected) return sync_reject(error);
      try {
        const rejected_result = on_rejected(error);
        if (is_promise_like(rejected_result)) return rejected_result;
        return sync_resolve(rejected_result);
      } catch (err) {
        return sync_reject(err);
      }
    },
  };
}
