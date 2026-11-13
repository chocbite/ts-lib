/**Returns true if the bit at the given position is set.
 * * @param value - The number to read from.
 * @param bit - The zero-based bit position.
 * @returns True if the bit is set, false otherwise.*/
export function get_bit(value: number, bit: number): boolean {
  return ((value >> bit) & 1) === 1;
}

/**Returns a new number with the bit at the given position set, cleared, or toggled.
 * * @param value - The original number.
 * @param bit - The zero-based bit position.
 * @param state - True to set, false to clear, omit to toggle.
 * @returns The new number with the specified bit modified.*/
export function set_bit(value: number, bit: number, state?: boolean): number {
  if (state === undefined) return value ^ (1 << bit);
  if (state) return value | (1 << bit);
  return value & ~(1 << bit);
}

/**Returns a new number with the bit at the given position toggled.
 * * @param value - The original number.
 * @param bit - The zero-based bit position.
 * @returns The new number with the specified bit toggled.*/
export function toggle_bit(value: number, bit: number): number {
  return value ^ (1 << bit);
}

/**Reads a multi-bit value from a number at the given offset.
 * * @param value - The number to read from.
 * @param offset - The zero-based starting bit position.
 * @param bit_count - The number of bits to read.
 * @returns The extracted bit field as an unsigned integer.*/
export function get_bits(value: number, offset: number, bit_count: number): number {
  return (value >>> offset) & ((1 << bit_count) - 1);
}

/**Returns a new number with a multi-bit value written at the given offset.
 * * @param value - The original number.
 * @param offset - The zero-based starting bit position.
 * @param bit_count - The number of bits to write.
 * @param bits - The value to write into the bit field.
 * @returns The new number with the specified bit field replaced.*/
export function set_bits(value: number, offset: number, bit_count: number, bits: number): number {
  const mask = ((1 << bit_count) - 1) << offset;
  return (value & ~mask) | ((bits << offset) & mask);
}
