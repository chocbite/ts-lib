//Local storage for conveniences, like a draft or a reading position.
//Local storage can be unavailable or throw (private windows, blocked site data), these never throw.

/**The stored text, undefined when there is none or storage is unavailable*/
export function local_get(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

/**Stores the text, undefined removes it, does nothing when storage is unavailable*/
export function local_set(key: string, value: string | undefined): void {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    //Only a convenience
  }
}
