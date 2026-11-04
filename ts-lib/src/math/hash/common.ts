const HEX_CHARS = "0123456789ABCDEF";

/**
 * Storage class for MD5 result */
export class Hash {
  private result: Uint8Array;
  private hexbuffer?: string;

  constructor(hash: Uint8Array) {
    this.result = hash;
  }

  //Returns the MD5 hash as an array of numbers
  get number_array() {
    return [...this.result];
  }

  //Returns the MD5 hash as an array of numbers
  get uint8_array() {
    return new Uint8Array(this.result);
  }

  //Returns the MD5 hash as hex string with big letters
  get hex_big() {
    if (!this.hexbuffer) this.calculate_hex();
    return this.hexbuffer;
  }

  //Returns the MD5 hash as hex string with small letters
  get hex_small() {
    if (!this.hexbuffer) this.calculate_hex();
    return this.hexbuffer?.toLowerCase();
  }

  //Calculates the hexadecimal string of the hash
  private calculate_hex() {
    this.hexbuffer = "";
    for (let i = 0; i < this.result.length; i++) {
      this.hexbuffer +=
        HEX_CHARS.charAt((this.result[i] >>> 4) & 15) +
        HEX_CHARS.charAt(15 & this.result[i]);
    }
  }
}
