/**Returns the byte length of a string accounting for encoding*/
export const string_byte_length = (string: string) => {
  let s = string.length;
  if (s > 2048) return new TextEncoder().encode(string).length;
  else {
    for (let i = s - 1; i >= 0; i--) {
      const code = string.charCodeAt(i);
      if (code > 0x7f && code <= 0x7ff) s++;
      else if (code > 0x7ff && code <= 0xffff) s += 2;
      if (code >= 0xdc00 && code <= 0xdfff) i--;
    }
    return s;
  }
};

/**Returns the byte length of a string accounting for encoding*/
export const string_byte_limit = (string: string, limit: number) => {
  const encoder = new TextEncoder().encode(string);
  string = new TextDecoder().decode(encoder.slice(0, limit));
  if (string.at(-1)?.charCodeAt(0) === 65533) return string.slice(0, -1);
  return string;
};

/**Converts a Date object to an ISO 8601 string in the given timezone, with a toggle for milliseconds
 * @param tz_minutes offset from UTC in minutes, the printed time is the local time of that offset*/
export function time_and_timezone_to_string(
  time: Date,
  tz_minutes: number = 0,
  milliseconds: boolean = false,
): string {
  //Shifting the time by the offset makes toISOString print the local time of that offset
  const iso = new Date(time.getTime() + tz_minutes * 60000).toISOString();
  const local = milliseconds ? iso.slice(0, -1) : iso.slice(0, -5);
  if (tz_minutes === 0) return local + "Z";
  const sign = tz_minutes >= 0 ? "+" : "-";
  const abs = Math.abs(tz_minutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const minutes = String(abs % 60).padStart(2, "0");
  return local + sign + hours + ":" + minutes;
}
