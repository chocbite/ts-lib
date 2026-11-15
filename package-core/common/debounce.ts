/** Creates a debounced version of a function that delays execution until after
 * 'wait' milliseconds have elapsed since the last time it was invoked.
 * @template A - The type of the arguments array.
 * @template T - The type of the function to debounce.
 * @param func - The function to debounce.
 * @param wait - The delay in milliseconds, when 0 or unspecified it only removes calls to the function in the same cycle.
 * @param leading - If true, triggers the function on the leading edge of the timeout.
 * @returns  A new debounced function, its cancel drops a pending call and resets it to its first call state. */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 0,
  leading: boolean = false
): Cancelable<(...args: Parameters<T>) => void> {
  let running = false;
  let args_buffer: Parameters<T>;
  let has_args = false;
  let timeout: ReturnType<typeof setTimeout>;
  const debounced = (...args: Parameters<T>) => {
    if (running) {
      args_buffer = args;
      has_args = true;
    } else {
      if (leading) func(...(args ?? []));
      else {
        args_buffer = args;
        has_args = true;
      }
      running = true;
    }
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (has_args) {
        func(...(args_buffer ?? []));
        has_args = false;
      }
      if (!leading) running = false;
      else
        timeout = setTimeout(() => {
          running = false;
        }, wait);
    }, wait);
  };
  debounced.cancel = () => {
    clearTimeout(timeout);
    has_args = false;
    running = false;
  };
  return debounced;
}

/**A function with a cancel method that drops its pending call*/
export type Cancelable<F extends (...args: any[]) => void> = F & {
  cancel(): void;
};
