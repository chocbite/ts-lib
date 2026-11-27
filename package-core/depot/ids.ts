/**Allowed characters in an id*/
export const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**Throws if the id is not a valid depot id*/
export function check_id(id: string): void {
  if (!ID_PATTERN.test(id))
    throw new Error(
      `Depot id "${id}" is invalid, use letters, digits, "_" and "-"`,
    );
}

/**Splits a path like "/a/b" into its ids, undefined if the path is invalid*/
export function split(path: string): string[] | undefined {
  if (path[0] !== "/") return undefined;
  const ids = path.slice(1).split("/");
  for (const id of ids) if (!ID_PATTERN.test(id)) return undefined;
  return ids;
}
