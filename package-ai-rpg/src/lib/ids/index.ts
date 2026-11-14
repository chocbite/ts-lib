//Readable ids for things an LLM refers to, and random ids for records it never sees.
//Readable ids are a prefix and a slug of the name, char:mara, char:mara-2, LLMs copy them far better than random ids.

/**Pattern every readable id matches, prefix:slug*/
export const ID_PATTERN = /^[a-z]+:[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**Lowercase ascii slug of a name, words joined by -, at most 32 characters, empty when nothing is left*/
export function id_slug(name: string): string {
  return name
    .normalize("NFKD")
    //Drops the accents NFKD split off the letters
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    //Letters NFKD does not split
    .replace(/[øæåßđł]/g, (c) => ({ ø: "o", æ: "ae", å: "a", ß: "ss", đ: "d", ł: "l" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 32)
    .replace(/^-+|-+$/g, "");
}

/**Makes a readable id, prefix:slug of the name, with -2, -3 and so on added while it is taken
 * @param prefix type of the thing, like char or loc
 * @param name name to make the slug from, a name without letters or digits gives prefix:unnamed
 * @param taken tells if an id is in use, ids must never be reused, so this includes removed things*/
export function id_make(
  prefix: string,
  name: string,
  taken: (id: string) => boolean,
): string {
  const base = `${prefix}:${id_slug(name) || "unnamed"}`;
  if (!taken(base)) return base;
  for (let i = 2; ; i++) {
    const id = `${base}-${i}`;
    if (!taken(id)) return id;
  }
}

/**Random id for records, unique enough for one browser, crypto.randomUUID is not used as it needs a secure context*/
export function id_random(): string {
  return (
    Date.now().toString(36) +
    Array.from({ length: 10 }, () =>
      Math.floor(Math.random() * 36).toString(36),
    ).join("")
  );
}
