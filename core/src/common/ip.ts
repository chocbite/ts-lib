/**Event types for base*/
export const IPVersion = {
  V4: 4,
  V6: 6,
} as const;
export type IPVersion = (typeof IPVersion)[keyof typeof IPVersion];

export class IPAddress {
  private readonly value: bigint;
  readonly version: IPVersion;

  /**Throws an error naming the input when it is not a valid address
   * @param input IPv4 or IPv6 string (:: shortening is supported), 32 bit number for IPv4, 128 bit bigint for IPv6,
   * or an array of 4 IPv4 octets or 8 IPv6 groups*/
  constructor(input: string | number | bigint | number[]) {
    if (typeof input === "string") {
      if (input.includes(":")) {
        this.value = parse_v6_string(input);
        this.version = 6;
      } else {
        this.value = parse_v4_string(input);
        this.version = 4;
      }
    } else if (typeof input === "number") {
      // IPv4 as a 32-bit number
      if (!Number.isInteger(input) || input < 0 || input > 0xffffffff)
        invalid(input, "must be a whole number from 0 to 4294967295");
      this.value = BigInt(input);
      this.version = 4;
    } else if (typeof input === "bigint") {
      // IPv6 as a 128-bit bigint
      if (input < 0n || input >= 1n << 128n)
        invalid(input, "must be a 128 bit unsigned number");
      this.value = input;
      this.version = 6;
    } else {
      if (input.length !== 4 && input.length !== 8)
        invalid(input, "needs 4 IPv4 octets or 8 IPv6 groups");
      this.version = input.length === 4 ? 4 : 6;
      this.value = parts_to_bigint(input, input, this.version);
    }
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

// --- Parsing ---

function invalid(input: unknown, reason: string): never {
  throw new Error(`Invalid IP address "${String(input)}": ${reason}`);
}

/**Combines octets or groups into one number, checking each is in range*/
function parts_to_bigint(
  input: unknown,
  parts: readonly number[],
  version: IPVersion
): bigint {
  const bits = version === 4 ? 8n : 16n;
  const max = version === 4 ? 0xff : 0xffff;
  let value = 0n;
  for (const part of parts) {
    if (!Number.isInteger(part) || part < 0 || part > max)
      invalid(input, `${part} is not a whole number from 0 to ${max}`);
    value = (value << bits) + BigInt(part);
  }
  return value;
}

function parse_v4_string(ip: string): bigint {
  const parts = ip.split(".");
  if (parts.length !== 4) invalid(ip, "IPv4 needs 4 octets separated by .");
  return parts_to_bigint(
    ip,
    parts.map((part) => {
      if (!/^\d{1,3}$/.test(part)) invalid(ip, `"${part}" is not a number`);
      return Number(part);
    }),
    4
  );
}

function parse_v6_string(ip: string): bigint {
  const halves = ip.split("::");
  if (halves.length > 2) invalid(ip, ":: can only be used once");
  const groups = (text: string | undefined) => (text ? text.split(":") : []);
  const head = groups(halves[0]);
  let parts = head;
  if (halves.length === 2) {
    //:: stands for as many zero groups as needed to make 8
    const tail = groups(halves[1]);
    const missing = 8 - head.length - tail.length;
    if (missing < 1) invalid(ip, "too many groups for ::");
    parts = [...head, ...Array<string>(missing).fill("0"), ...tail];
  } else if (head.length !== 8)
    invalid(ip, "IPv6 needs 8 groups separated by :, or :: to shorten");
  return parts_to_bigint(
    ip,
    parts.map((part) => {
      if (!/^[0-9a-f]{1,4}$/i.test(part))
        invalid(ip, `"${part}" is not a hexadecimal group`);
      return parseInt(part, 16);
    }),
    6
  );
}
