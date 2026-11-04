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
  return new Promise((a) => setTimeout(() => a(arg!()), ms));
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

/**Returns a promise that executes synchronously when using .then() and resolves immediately with the given value.*/
export function sync_resolve<T>(value: T | PromiseLike<T>): PromiseLike<T> {
  if (is_promise_like(value)) return value;
  return {
    then<TResult1 = T, TResult2 = never>(
      on_fulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      on_rejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      try {
        const result = on_fulfilled ? on_fulfilled(value) : value;
        if (is_promise_like(result)) return result;
        return sync_resolve(result as TResult1);
      } catch (error) {
        if (on_rejected) {
          const rejected_result = on_rejected(error);
          if (is_promise_like(rejected_result)) return rejected_result;
          return sync_resolve(rejected_result);
        }
        return sync_reject(error as any);
      }
    },
  };
}

/**Returns a promise that executes synchronously when using .catch() and rejects immediately with the given value.*/
export function sync_reject<T>(error: T | PromiseLike<T>): PromiseLike<T> {
  if (is_promise_like(error)) return error;
  return {
    then<TResult1, TResult2 = never>(
      _on_fulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      on_rejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      try {
        if (on_rejected) {
          const rejected_result = on_rejected(error);
          if (is_promise_like(rejected_result)) return rejected_result;
          return sync_resolve(rejected_result);
        }
        return sync_reject(error as any);
      } catch (err) {
        return sync_reject(err as any);
      }
    },
  };
}
