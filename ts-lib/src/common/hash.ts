/**Returns the SHA-1 digest of UTF-8 text or bytes as a lowercase hexadecimal string.
 * This is a portable implementation for contexts where Web Crypto is unavailable.
 * @param input - The text or bytes to hash.
 * @returns The 40-character lowercase hexadecimal SHA-1 digest.*/
export function sha1(input: string | Uint8Array): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const bit_length = bytes.length * 8;
  const padded_length = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(padded_length);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const high_length = Math.floor(bit_length / 0x1_0000_0000);
  const low_length = bit_length >>> 0;
  const length_offset = padded_length - 8;
  padded[length_offset] = high_length >>> 24;
  padded[length_offset + 1] = high_length >>> 16;
  padded[length_offset + 2] = high_length >>> 8;
  padded[length_offset + 3] = high_length;
  padded[length_offset + 4] = low_length >>> 24;
  padded[length_offset + 5] = low_length >>> 16;
  padded[length_offset + 6] = low_length >>> 8;
  padded[length_offset + 7] = low_length;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const words = new Uint32Array(80);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index++) {
      const byte_offset = offset + index * 4;
      words[index] =
        (padded[byte_offset] << 24) |
        (padded[byte_offset + 1] << 16) |
        (padded[byte_offset + 2] << 8) |
        padded[byte_offset + 3];
    }
    for (let index = 16; index < 80; index++) {
      const value =
        words[index - 3] ^
        words[index - 8] ^
        words[index - 14] ^
        words[index - 16];
      words[index] = (value << 1) | (value >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let index = 0; index < 80; index++) {
      const f =
        index < 20
          ? (b & c) | (~b & d)
          : index < 40
            ? b ^ c ^ d
            : index < 60
              ? (b & c) | (b & d) | (c & d)
              : b ^ c ^ d;
      const k =
        index < 20
          ? 0x5a827999
          : index < 40
            ? 0x6ed9eba1
            : index < 60
              ? 0x8f1bbcdc
              : 0xca62c1d6;
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + words[index]) >>> 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4]
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("");
}
