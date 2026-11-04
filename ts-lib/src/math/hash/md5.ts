import { Hash } from "./common";

//Calculates the md5 hash of the given string
export function md5(data: string) {
  return new Hash(y(data));
}

function y(data: string) {
  const length = 8 * data.length;
  const aaaa = Array<number>(data.length >> 2);
  for (let m = 0; m < aaaa.length; m++) aaaa[m] = 0;
  for (let m = 0; m < 8 * data.length; m += 8)
    aaaa[m >> 5] |= (255 & data.charCodeAt(m / 8)) << m % 32;
  aaaa[length >> 5] |= 128 << length % 32;
  aaaa[14 + (((length + 64) >>> 9) << 4)] = length;
  let m = 1732584193;
  let f = -271733879;
  let r = -1732584194;
  let i = 271733878;
  for (let n = 0; n < aaaa.length; n += 16) {
    const h = m;
    const t = f;
    const g = r;
    const e = i;
    f = md5_ii(
      (f = md5_ii(
        (f = md5_ii(
          (f = md5_ii(
            (f = md5_hh(
              (f = md5_hh(
                (f = md5_hh(
                  (f = md5_hh(
                    (f = md5_gg(
                      (f = md5_gg(
                        (f = md5_gg(
                          (f = md5_gg(
                            (f = md5_ff(
                              (f = md5_ff(
                                (f = md5_ff(
                                  (f = md5_ff(
                                    f,
                                    (r = md5_ff(
                                      r,
                                      (i = md5_ff(
                                        i,
                                        (m = md5_ff(
                                          m,
                                          f,
                                          r,
                                          i,
                                          aaaa[n + 0],
                                          7,
                                          -680876936
                                        )),
                                        f,
                                        r,
                                        aaaa[n + 1],
                                        12,
                                        -389564586
                                      )),
                                      m,
                                      f,
                                      aaaa[n + 2],
                                      17,
                                      606105819
                                    )),
                                    i,
                                    m,
                                    aaaa[n + 3],
                                    22,
                                    -1044525330
                                  )),
                                  (r = md5_ff(
                                    r,
                                    (i = md5_ff(
                                      i,
                                      (m = md5_ff(
                                        m,
                                        f,
                                        r,
                                        i,
                                        aaaa[n + 4],
                                        7,
                                        -176418897
                                      )),
                                      f,
                                      r,
                                      aaaa[n + 5],
                                      12,
                                      1200080426
                                    )),
                                    m,
                                    f,
                                    aaaa[n + 6],
                                    17,
                                    -1473231341
                                  )),
                                  i,
                                  m,
                                  aaaa[n + 7],
                                  22,
                                  -45705983
                                )),
                                (r = md5_ff(
                                  r,
                                  (i = md5_ff(
                                    i,
                                    (m = md5_ff(
                                      m,
                                      f,
                                      r,
                                      i,
                                      aaaa[n + 8],
                                      7,
                                      1770035416
                                    )),
                                    f,
                                    r,
                                    aaaa[n + 9],
                                    12,
                                    -1958414417
                                  )),
                                  m,
                                  f,
                                  aaaa[n + 10],
                                  17,
                                  -42063
                                )),
                                i,
                                m,
                                aaaa[n + 11],
                                22,
                                -1990404162
                              )),
                              (r = md5_ff(
                                r,
                                (i = md5_ff(
                                  i,
                                  (m = md5_ff(
                                    m,
                                    f,
                                    r,
                                    i,
                                    aaaa[n + 12],
                                    7,
                                    1804603682
                                  )),
                                  f,
                                  r,
                                  aaaa[n + 13],
                                  12,
                                  -40341101
                                )),
                                m,
                                f,
                                aaaa[n + 14],
                                17,
                                -1502002290
                              )),
                              i,
                              m,
                              aaaa[n + 15],
                              22,
                              1236535329
                            )),
                            (r = md5_gg(
                              r,
                              (i = md5_gg(
                                i,
                                (m = md5_gg(
                                  m,
                                  f,
                                  r,
                                  i,
                                  aaaa[n + 1],
                                  5,
                                  -165796510
                                )),
                                f,
                                r,
                                aaaa[n + 6],
                                9,
                                -1069501632
                              )),
                              m,
                              f,
                              aaaa[n + 11],
                              14,
                              643717713
                            )),
                            i,
                            m,
                            aaaa[n + 0],
                            20,
                            -373897302
                          )),
                          (r = md5_gg(
                            r,
                            (i = md5_gg(
                              i,
                              (m = md5_gg(
                                m,
                                f,
                                r,
                                i,
                                aaaa[n + 5],
                                5,
                                -701558691
                              )),
                              f,
                              r,
                              aaaa[n + 10],
                              9,
                              38016083
                            )),
                            m,
                            f,
                            aaaa[n + 15],
                            14,
                            -660478335
                          )),
                          i,
                          m,
                          aaaa[n + 4],
                          20,
                          -405537848
                        )),
                        (r = md5_gg(
                          r,
                          (i = md5_gg(
                            i,
                            (m = md5_gg(m, f, r, i, aaaa[n + 9], 5, 568446438)),
                            f,
                            r,
                            aaaa[n + 14],
                            9,
                            -1019803690
                          )),
                          m,
                          f,
                          aaaa[n + 3],
                          14,
                          -187363961
                        )),
                        i,
                        m,
                        aaaa[n + 8],
                        20,
                        1163531501
                      )),
                      (r = md5_gg(
                        r,
                        (i = md5_gg(
                          i,
                          (m = md5_gg(
                            m,
                            f,
                            r,
                            i,
                            aaaa[n + 13],
                            5,
                            -1444681467
                          )),
                          f,
                          r,
                          aaaa[n + 2],
                          9,
                          -51403784
                        )),
                        m,
                        f,
                        aaaa[n + 7],
                        14,
                        1735328473
                      )),
                      i,
                      m,
                      aaaa[n + 12],
                      20,
                      -1926607734
                    )),
                    (r = md5_hh(
                      r,
                      (i = md5_hh(
                        i,
                        (m = md5_hh(m, f, r, i, aaaa[n + 5], 4, -378558)),
                        f,
                        r,
                        aaaa[n + 8],
                        11,
                        -2022574463
                      )),
                      m,
                      f,
                      aaaa[n + 11],
                      16,
                      1839030562
                    )),
                    i,
                    m,
                    aaaa[n + 14],
                    23,
                    -35309556
                  )),
                  (r = md5_hh(
                    r,
                    (i = md5_hh(
                      i,
                      (m = md5_hh(m, f, r, i, aaaa[n + 1], 4, -1530992060)),
                      f,
                      r,
                      aaaa[n + 4],
                      11,
                      1272893353
                    )),
                    m,
                    f,
                    aaaa[n + 7],
                    16,
                    -155497632
                  )),
                  i,
                  m,
                  aaaa[n + 10],
                  23,
                  -1094730640
                )),
                (r = md5_hh(
                  r,
                  (i = md5_hh(
                    i,
                    (m = md5_hh(m, f, r, i, aaaa[n + 13], 4, 681279174)),
                    f,
                    r,
                    aaaa[n + 0],
                    11,
                    -358537222
                  )),
                  m,
                  f,
                  aaaa[n + 3],
                  16,
                  -722521979
                )),
                i,
                m,
                aaaa[n + 6],
                23,
                76029189
              )),
              (r = md5_hh(
                r,
                (i = md5_hh(
                  i,
                  (m = md5_hh(m, f, r, i, aaaa[n + 9], 4, -640364487)),
                  f,
                  r,
                  aaaa[n + 12],
                  11,
                  -421815835
                )),
                m,
                f,
                aaaa[n + 15],
                16,
                530742520
              )),
              i,
              m,
              aaaa[n + 2],
              23,
              -995338651
            )),
            (r = md5_ii(
              r,
              (i = md5_ii(
                i,
                (m = md5_ii(m, f, r, i, aaaa[n + 0], 6, -198630844)),
                f,
                r,
                aaaa[n + 7],
                10,
                1126891415
              )),
              m,
              f,
              aaaa[n + 14],
              15,
              -1416354905
            )),
            i,
            m,
            aaaa[n + 5],
            21,
            -57434055
          )),
          (r = md5_ii(
            r,
            (i = md5_ii(
              i,
              (m = md5_ii(m, f, r, i, aaaa[n + 12], 6, 1700485571)),
              f,
              r,
              aaaa[n + 3],
              10,
              -1894986606
            )),
            m,
            f,
            aaaa[n + 10],
            15,
            -1051523
          )),
          i,
          m,
          aaaa[n + 1],
          21,
          -2054922799
        )),
        (r = md5_ii(
          r,
          (i = md5_ii(
            i,
            (m = md5_ii(m, f, r, i, aaaa[n + 8], 6, 1873313359)),
            f,
            r,
            aaaa[n + 15],
            10,
            -30611744
          )),
          m,
          f,
          aaaa[n + 6],
          15,
          -1560198380
        )),
        i,
        m,
        aaaa[n + 13],
        21,
        1309151649
      )),
      (r = md5_ii(
        r,
        (i = md5_ii(
          i,
          (m = md5_ii(m, f, r, i, aaaa[n + 4], 6, -145523070)),
          f,
          r,
          aaaa[n + 11],
          10,
          -1120210379
        )),
        m,
        f,
        aaaa[n + 2],
        15,
        718787259
      )),
      i,
      m,
      aaaa[n + 9],
      21,
      -343485551
    );
    m = safe_add(m, h);
    f = safe_add(f, t);
    r = safe_add(r, g);
    i = safe_add(i, e);
  }
  const d = [m, f, r, i];
  const numbers = new Uint8Array(16);
  for (let i = 0, m = 0; m < 32 * d.length; m += 8, i++)
    numbers[i] = (d[m >> 5] >>> m % 32) & 255;
  return numbers;
}

function md5_cmn(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number
) {
  return safe_add(bit_rol(safe_add(safe_add(b, a), safe_add(d, f)), e), c);
}

function md5_ff(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number
) {
  return md5_cmn((b & c) | (~b & d), a, b, e, f, g);
}

function md5_gg(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number
) {
  return md5_cmn((b & d) | (c & ~d), a, b, e, f, g);
}

function md5_hh(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number
) {
  return md5_cmn(b ^ c ^ d, a, b, e, f, g);
}

function md5_ii(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number
) {
  return md5_cmn(c ^ (b | ~d), a, b, e, f, g);
}

function safe_add(a: number, b: number) {
  const c = (65535 & a) + (65535 & b);
  return (((a >> 16) + (b >> 16) + (c >> 16)) << 16) | (65535 & c);
}

function bit_rol(a: number, b: number) {
  return (a << b) | (a >>> (32 - b));
}
