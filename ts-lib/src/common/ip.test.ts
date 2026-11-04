import { describe, expect, it } from "vitest";
import { IPAddress } from "./ip"; // Adjust the path as needed

describe("IPAddress Class", () => {
  describe("IPv4 Handling", () => {
    it("should parse a standard IPv4 string", () => {
      const ip = new IPAddress("192.168.1.1");
      expect(ip.is_v4).toBe(true);
      expect(ip.is_v6).toBe(false);
      expect(ip.as_array).toEqual([192, 168, 1, 1]);
    });

    it("should initialize from a number", () => {
      const ip = new IPAddress(3232235777);
      expect(ip.is_v4).toBe(true);
      expect(ip.to_string()).toBe("192.168.1.1");
    });

    it("should initialize from a 4-element number array", () => {
      const ip = new IPAddress([127, 0, 0, 1]);
      expect(ip.is_v4).toBe(true);
      expect(ip.as_big_int).toBe(2130706433n);
    });
  });

  describe("IPv6 Handling", () => {
    it("should parse an IPv6 string", () => {
      // Using a full 8-part string for the current simple parser
      const ip = new IPAddress("2001:db8:0:0:0:ff00:42:8329");
      expect(ip.is_v6).toBe(true);
      expect(ip.is_v4).toBe(false);
      expect(ip.as_array).toEqual([
        0x2001, 0xdb8, 0, 0, 0, 0xff00, 0x42, 0x8329,
      ]);
    });

    it("should initialize from a bigint", () => {
      const big_val = BigInt("42540766411282592856903984951653826560");
      const ip = new IPAddress(big_val);
      expect(ip.is_v6).toBe(true);
      expect(ip.as_big_int).toBe(big_val);
    });

    it("should initialize from an 8-element number array", () => {
      const arr = [0xfe80, 0, 0, 0, 0x202, 0xb3ff, 0xfe1e, 0x8329];
      const ip = new IPAddress(arr);
      expect(ip.is_v6).toBe(true);
      expect(ip.as_array).toEqual(arr);
    });
  });

  describe("Edge Cases and Errors", () => {
    it("should handle loopback addresses correctly", () => {
      const v4 = new IPAddress("127.0.0.1");
      const v6 = new IPAddress("0:0:0:0:0:0:0:1");
      expect(v4.as_big_int).toBe(2130706433n);
      expect(v6.as_big_int).toBe(1n);
    });
  });
});
