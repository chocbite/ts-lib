import { Hash } from "./common";

const ENCODER = new TextEncoder();

/**Calculates the md5 hash of the given text, hashed as UTF-8, or bytes*/
export function md5(data: string | Uint8Array) {
  return new Hash(md5_words(message_words(data)));
}

/**Amount of 32 bit words for a message of the given byte length, including padding*/
function word_count(byte_length: number) {
  return (((byte_length + 8) >> 6) + 1) * 16;
}

/**Adds the padding, a 1 bit after the message and the bit length as 64 bit little endian at the end*/
function pad(words: number[], byte_length: number) {
  const bit_length = byte_length * 8;
  words[byte_length >> 2] =
    (words[byte_length >> 2] ?? 0) | (0x80 << ((byte_length & 3) << 3));
  words[words.length - 2] = bit_length | 0;
  words[words.length - 1] = Math.floor(bit_length / 0x100000000) | 0;
}

/**Converts the message to little endian 32 bit words, ASCII text is read directly as it is the common case*/
function message_words(data: string | Uint8Array): number[] {
  if (typeof data === "string") {
    const words = ascii_words(data);
    if (words) return words;
    data = ENCODER.encode(data);
  }
  const words = Array<number>(word_count(data.length)).fill(0);
  for (let i = 0; i < data.length; i++)
    words[i >> 2] = (words[i >> 2] ?? 0) | ((data[i] ?? 0) << ((i & 3) << 3));
  pad(words, data.length);
  return words;
}

/**Returns undefined when the text is not pure ASCII*/
function ascii_words(text: string): number[] | undefined {
  const words = Array<number>(word_count(text.length)).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0x7f) return undefined;
    words[i >> 2] = (words[i >> 2] ?? 0) | (code << ((i & 3) << 3));
  }
  pad(words, text.length);
  return words;
}

/**MD5 as described in RFC 1321, words beyond the end can not happen as the message is padded to whole blocks*/
function md5_words(words: number[]): Uint8Array {
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  for (let block = 0; block < words.length; block += 16) {
    const x0 = words[block] ?? 0;
    const x1 = words[block + 1] ?? 0;
    const x2 = words[block + 2] ?? 0;
    const x3 = words[block + 3] ?? 0;
    const x4 = words[block + 4] ?? 0;
    const x5 = words[block + 5] ?? 0;
    const x6 = words[block + 6] ?? 0;
    const x7 = words[block + 7] ?? 0;
    const x8 = words[block + 8] ?? 0;
    const x9 = words[block + 9] ?? 0;
    const x10 = words[block + 10] ?? 0;
    const x11 = words[block + 11] ?? 0;
    const x12 = words[block + 12] ?? 0;
    const x13 = words[block + 13] ?? 0;
    const x14 = words[block + 14] ?? 0;
    const x15 = words[block + 15] ?? 0;
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    //Round 1
    a = ff(a, b, c, d, x0, 7, 0xd76aa478);
    d = ff(d, a, b, c, x1, 12, 0xe8c7b756);
    c = ff(c, d, a, b, x2, 17, 0x242070db);
    b = ff(b, c, d, a, x3, 22, 0xc1bdceee);
    a = ff(a, b, c, d, x4, 7, 0xf57c0faf);
    d = ff(d, a, b, c, x5, 12, 0x4787c62a);
    c = ff(c, d, a, b, x6, 17, 0xa8304613);
    b = ff(b, c, d, a, x7, 22, 0xfd469501);
    a = ff(a, b, c, d, x8, 7, 0x698098d8);
    d = ff(d, a, b, c, x9, 12, 0x8b44f7af);
    c = ff(c, d, a, b, x10, 17, 0xffff5bb1);
    b = ff(b, c, d, a, x11, 22, 0x895cd7be);
    a = ff(a, b, c, d, x12, 7, 0x6b901122);
    d = ff(d, a, b, c, x13, 12, 0xfd987193);
    c = ff(c, d, a, b, x14, 17, 0xa679438e);
    b = ff(b, c, d, a, x15, 22, 0x49b40821);
    //Round 2
    a = gg(a, b, c, d, x1, 5, 0xf61e2562);
    d = gg(d, a, b, c, x6, 9, 0xc040b340);
    c = gg(c, d, a, b, x11, 14, 0x265e5a51);
    b = gg(b, c, d, a, x0, 20, 0xe9b6c7aa);
    a = gg(a, b, c, d, x5, 5, 0xd62f105d);
    d = gg(d, a, b, c, x10, 9, 0x02441453);
    c = gg(c, d, a, b, x15, 14, 0xd8a1e681);
    b = gg(b, c, d, a, x4, 20, 0xe7d3fbc8);
    a = gg(a, b, c, d, x9, 5, 0x21e1cde6);
    d = gg(d, a, b, c, x14, 9, 0xc33707d6);
    c = gg(c, d, a, b, x3, 14, 0xf4d50d87);
    b = gg(b, c, d, a, x8, 20, 0x455a14ed);
    a = gg(a, b, c, d, x13, 5, 0xa9e3e905);
    d = gg(d, a, b, c, x2, 9, 0xfcefa3f8);
    c = gg(c, d, a, b, x7, 14, 0x676f02d9);
    b = gg(b, c, d, a, x12, 20, 0x8d2a4c8a);
    //Round 3
    a = hh(a, b, c, d, x5, 4, 0xfffa3942);
    d = hh(d, a, b, c, x8, 11, 0x8771f681);
    c = hh(c, d, a, b, x11, 16, 0x6d9d6122);
    b = hh(b, c, d, a, x14, 23, 0xfde5380c);
    a = hh(a, b, c, d, x1, 4, 0xa4beea44);
    d = hh(d, a, b, c, x4, 11, 0x4bdecfa9);
    c = hh(c, d, a, b, x7, 16, 0xf6bb4b60);
    b = hh(b, c, d, a, x10, 23, 0xbebfbc70);
    a = hh(a, b, c, d, x13, 4, 0x289b7ec6);
    d = hh(d, a, b, c, x0, 11, 0xeaa127fa);
    c = hh(c, d, a, b, x3, 16, 0xd4ef3085);
    b = hh(b, c, d, a, x6, 23, 0x04881d05);
    a = hh(a, b, c, d, x9, 4, 0xd9d4d039);
    d = hh(d, a, b, c, x12, 11, 0xe6db99e5);
    c = hh(c, d, a, b, x15, 16, 0x1fa27cf8);
    b = hh(b, c, d, a, x2, 23, 0xc4ac5665);
    //Round 4
    a = ii(a, b, c, d, x0, 6, 0xf4292244);
    d = ii(d, a, b, c, x7, 10, 0x432aff97);
    c = ii(c, d, a, b, x14, 15, 0xab9423a7);
    b = ii(b, c, d, a, x5, 21, 0xfc93a039);
    a = ii(a, b, c, d, x12, 6, 0x655b59c3);
    d = ii(d, a, b, c, x3, 10, 0x8f0ccc92);
    c = ii(c, d, a, b, x10, 15, 0xffeff47d);
    b = ii(b, c, d, a, x1, 21, 0x85845dd1);
    a = ii(a, b, c, d, x8, 6, 0x6fa87e4f);
    d = ii(d, a, b, c, x15, 10, 0xfe2ce6e0);
    c = ii(c, d, a, b, x6, 15, 0xa3014314);
    b = ii(b, c, d, a, x13, 21, 0x4e0811a1);
    a = ii(a, b, c, d, x4, 6, 0xf7537e82);
    d = ii(d, a, b, c, x11, 10, 0xbd3af235);
    c = ii(c, d, a, b, x2, 15, 0x2ad7d2bb);
    b = ii(b, c, d, a, x9, 21, 0xeb86d391);
    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }
  const result = new Uint8Array(16);
  for (const [i, word] of [a0, b0, c0, d0].entries())
    for (let j = 0; j < 4; j++) result[i * 4 + j] = (word >>> (j * 8)) & 0xff;
  return result;
}

/**Shared part of every step, adds and rotates in 32 bit*/
function step(f: number, a: number, b: number, x: number, s: number, t: number) {
  const n = safe_add(safe_add(a, f), safe_add(x, t));
  return safe_add((n << s) | (n >>> (32 - s)), b);
}

/**Adds in 16 bit halves, keeping every value a 32 bit integer is much faster in JS engines than letting the sum overflow*/
function safe_add(a: number, b: number) {
  const c = (65535 & a) + (65535 & b);
  return (((a >> 16) + (b >> 16) + (c >> 16)) << 16) | (65535 & c);
}

function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return step((b & c) | (~b & d), a, b, x, s, t);
}

function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return step((b & d) | (c & ~d), a, b, x, s, t);
}

function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return step(b ^ c ^ d, a, b, x, s, t);
}

function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return step(c ^ (b | ~d), a, b, x, s, t);
}
