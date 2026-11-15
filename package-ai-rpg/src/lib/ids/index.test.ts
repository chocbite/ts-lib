import { describe, expect, it } from "vitest";
import { ID_PATTERN, id_code } from "./index";

describe("ids", () => {
  it("makes short codes that never repeat and do not look alike", () => {
    const codes = Array.from({ length: 20000 }, (_, n) => id_code(n + 1));
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => c.length === 4 && ID_PATTERN.test("char:" + c))).toBe(true);
    //Neighbours share no character in place
    const [a, b] = [id_code(1), id_code(2)];
    expect([...a].filter((c, i) => b[i] === c).length).toBeLessThan(2);
  });
  it("grows past the 4 character space", () => {
    expect(id_code(31 ** 4)).toHaveLength(5);
    expect(id_code(31 ** 4)).not.toBe(id_code(31 ** 4 + 1));
  });
});
