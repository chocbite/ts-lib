//Debounce by key, with a flush that runs everything pending at once.
//Used to save text being typed after a pause, while still saving when the page is hidden,
//as a closing tab gives no time to wait for the pause.
//The library debounce has no flush, which is why this exists.

const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>();

/**Runs the function after a pause, a later call with the same key replaces a pending one*/
export function later(key: string, run: () => void, ms = 500) {
  const old = pending.get(key);
  if (old) clearTimeout(old.timer);
  pending.set(key, {
    run,
    timer: setTimeout(() => {
      pending.delete(key);
      run();
    }, ms),
  });
}

/**Runs every pending function now*/
export function later_flush() {
  for (const [key, { timer, run }] of pending) {
    clearTimeout(timer);
    pending.delete(key);
    run();
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") later_flush();
});
window.addEventListener("pagehide", later_flush);
