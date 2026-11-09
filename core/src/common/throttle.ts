/** Creates a throttled function that only invokes `func` at most once per
 * every `wait` milliseconds.
 * * Features:
 * - Immediate execution on the first call.
 * - Leading-edge and trailing-edge execution (ensures the last call is not lost).
 * * @param func - The function to throttle.
 * @param wait - The number of milliseconds to throttle invocations to.
 * @returns A new throttled function.*/
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 0
): (...args: Parameters<T>) => void {
  let args_buffer: Parameters<T>;
  let has_args = false;
  let state: number = 0;
  let interval: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    if (state > 0) {
      args_buffer = args;
      has_args = true;
      state = 2;
    } else {
      func(...(args ?? []));
      state = 2;
      interval = setInterval(() => {
        state--;
        if (has_args) {
          func(...(args_buffer ?? []));
          has_args = false;
        }
        //Cleared right away, a call before the next tick would otherwise start a second interval
        if (state === 0) clearInterval(interval);
      }, wait);
    }
  };
}
