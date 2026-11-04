export const KeyboardSpecialKeys = {
  Close: "close",
  Enter: "enter",
  Backspace: "backspace",
  Escape: "escape",
  Left: "left",
  Right: "right",
} as const;
export type KeyboardSpecialKeys =
  (typeof KeyboardSpecialKeys)[keyof typeof KeyboardSpecialKeys];

export const KeyboardBaseLayers = {
  Default: "default",
  Shift: "shift",
} as const;
export type KeyboardBaseLayers =
  (typeof KeyboardBaseLayers)[keyof typeof KeyboardBaseLayers];

export const KeyboardType = {
  /**Text input type */
  Text: "text",
  /**Email input type */
  Email: "email",
  /**Color input type */
  Color: "color",
  /**Date input type, eg. 2026-09-22 */
  Date: "date",
  /**Local date and time input type, eg. 2026-09-22T14:30 */
  DateTimeLocal: "datetime_local",
  /**Month input type, eg. 2026-09 */
  Month: "month",
  /**Time input type, eg. 14:30 */
  Time: "time",
  /**Week input type, eg. 2026-W39 */
  Week: "week",
  /**Whole number input type, eg. 0, 1, 2 ...*/
  NumberWhole: "number_whole",
  /**Hexadecimal number input type, eg. 0A, FF, 1C3 */
  NumberHex: "number_hex",
  /**Integer number input type, eg. -2, -1, 0, 1, 2 ... */
  NumberInteger: "number_integer",
  /**Positive rational number input type, eg. 0.5, 1.2 ... */
  NumberRationalPositive: "number_rational_positive",
  /**Rational number input type, eg. -2.5, -1.1, 0.5, 1.2 ... */
  NumberRational: "number_rational",
  /**Phone number input type, eg. +1 234 567 890 */
  Phone: "phone",
} as const;
export type KeyboardType = (typeof KeyboardType)[keyof typeof KeyboardType];

export interface KeyboardKeyConfig {
  text: string;
  key?: string;
  rows?: number;
  cols?: number;
}

export interface KeyboardLayerConfig {
  /**Maximum width of the keyboard layer in rems */
  max_width?: number;
  /**Default number of rows a key occupies in this layer */
  key_rows?: number;
  /**Default number of columns a key occupies in this layer */
  key_cols?: number;
  keys: (KeyboardKeyConfig | number)[][];
}

export interface KeyboardLayers {
  [layer: string]: KeyboardLayerConfig;
}

export interface KeyboardConfig {
  default: KeyboardLayerConfig;
  layers?: KeyboardLayers;
}
