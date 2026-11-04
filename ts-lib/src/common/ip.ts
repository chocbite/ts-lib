/**Event types for base*/
export const IPVersion = {
  V4: 4,
  V6: 6,
} as const;
export type IPVersion = (typeof IPVersion)[keyof typeof IPVersion];

export class IPAddress {
  private readonly value: bigint;
  readonly version: IPVersion;

  constructor(input: string | number | bigint | number[]) {
    if (typeof input === "string") {
      if (input.includes(":")) {
        this.value = this.parse_v6_string(input);
        this.version = 6;
      } else {
        this.value = this.parse_v4_string(input);
        this.version = 4;
      }
    } else if (typeof input === "number") {
      // IPv4 as a 32-bit number
      this.value = BigInt(input);
      this.version = 4;
    } else if (typeof input === "bigint") {
      // IPv6 as a 128-bit bigint
      this.value = input;
      this.version = 6;
    } else {
      this.version = input.length === 4 ? 4 : 6;
      this.value = this.from_array(input);
    }
  }

  // --- Helpers ---
  private parse_v4_string(ip: string): bigint {
    const octets = ip.split(".").map(Number);
    return octets.reduce((acc, octet) => (acc << 8n) + BigInt(octet), 0n);
  }

  private parse_v6_string(ip: string): bigint {
    const parts = ip.split(":").map((part) => (part === "" ? "0" : part));
    return parts.reduce(
      (acc, part) => (acc << 16n) + BigInt(parseInt(part, 16)),
      0n
    );
  }

  private from_array(arr: number[]): bigint {
    return arr.reduce((acc, val) => {
      const bit_shift = this.version === 4 ? 8n : 16n;
      return (acc << bit_shift) + BigInt(val);
    }, 0n);
  }

  // --- Getters ---

  get is_v4(): boolean {
    return this.version === IPVersion.V4;
  }

  get is_v6(): boolean {
    return this.version === IPVersion.V6;
  }

  get as_big_int(): bigint {
    return this.value;
  }

  get as_array(): number[] {
    const result: number[] = [];
    let temp = this.value;
    const count = this.version === IPVersion.V4 ? 4 : 8;
    const mask = this.version === IPVersion.V4 ? 0xffn : 0xffffn;
    const shift = this.version === IPVersion.V4 ? 8n : 16n;

    for (let i = 0; i < count; i++) {
      result.unshift(Number(temp & mask));
      temp >>= shift;
    }
    return result;
  }

  to_string(): string {
    if (this.is_v4) return this.as_array.join(".");
    return this.as_array.map((n) => n.toString(16)).join(":");
  }
}
