//Ids for things an LLM refers to, and random ids for records it never sees.
//Ids an LLM sees are a prefix and a short code made from a counter, char:k7qm. The counter makes them unique and stable,
//the scramble makes neighbours look nothing alike, so a model does not mix up char:1 and char:2.

/**Letters and digits of codes, lowercase without the ones that look alike (0 o 1 l i)*/
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
/**Mixes the counter, it shares no factor with the size of the code space, so no two numbers give the same code*/
const MULTIPLIER = 611953;
const OFFSET = 98317;

/**Pattern every id an LLM sees matches, prefix:code*/
export const ID_PATTERN = /^[a-z]+:[a-hj-km-np-z2-9]{4,}$/;

/**Code of a counter value, 4 characters while the counter is below 31^4, more after, never the same code for two values*/
export function id_code(n: number): string {
  let length = 4;
  while (ALPHABET.length ** length <= n) length++;
  const size = ALPHABET.length ** length;
  let x = Number((BigInt(n) * BigInt(MULTIPLIER) + BigInt(OFFSET)) % BigInt(size));
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[x % ALPHABET.length];
    x = Math.floor(x / ALPHABET.length);
  }
  return code;
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
