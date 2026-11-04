import { DOCUMENT_HANDLER } from "#document";
import { KeyboardBase } from "./base";
import { keyboard_type } from "./helpers";
import { Keyboard_Color } from "./keyboard_color";
import { DATETIME_KEYBOARD } from "./keyboard_datetime";
import { Keyboard_Keys } from "./keyboard_keys";
import {
  NUMBER_HEX_KEYBOARD,
  NUMBER_INTEGER_KEYBOARD,
  NUMBER_RATIONAL_KEYBOARD,
  NUMBER_RATIONAL_POSITIVE_KEYBOARD,
  NUMBER_WHOLE_KEYBOARD,
  PHONE_KEYBOARD,
} from "./number";
import { VIRTUAL_KEYBOARD } from "./settings";
import { EMAIL_KEYBOARD, TEXT_KEYBOARD } from "./text";
import { KeyboardConfig, KeyboardType } from "./types";

export { VIRTUAL_KEYBOARD } from "./settings";
export { KeyboardType } from "./types";

const KEYBOARDS: Partial<Record<KeyboardType, KeyboardBase>> = {
  [KeyboardType.Text]: TEXT_KEYBOARD,
  [KeyboardType.Email]: EMAIL_KEYBOARD,
  [KeyboardType.Color]: new Keyboard_Color(),
  [KeyboardType.Date]: DATETIME_KEYBOARD,
  [KeyboardType.DateTimeLocal]: DATETIME_KEYBOARD,
  [KeyboardType.Month]: DATETIME_KEYBOARD,
  [KeyboardType.Time]: DATETIME_KEYBOARD,
  [KeyboardType.Week]: DATETIME_KEYBOARD,
  [KeyboardType.NumberWhole]: NUMBER_WHOLE_KEYBOARD,
  [KeyboardType.NumberHex]: NUMBER_HEX_KEYBOARD,
  [KeyboardType.NumberInteger]: NUMBER_INTEGER_KEYBOARD,
  [KeyboardType.NumberRationalPositive]: NUMBER_RATIONAL_POSITIVE_KEYBOARD,
  [KeyboardType.NumberRational]: NUMBER_RATIONAL_KEYBOARD,
  [KeyboardType.Phone]: PHONE_KEYBOARD,
};

/**Opens the on-screen keyboard for the specified element with the given mode and returns a function to close it
 * @param element The HTML element to attach the keyboard to.
 * @param mode The keyboard mode, which can be a predefined type, a custom keyboard instance, or a keyboard configuration.
 * @returns A function that closes the keyboard when called. */
export function keyboard_open(
  element: HTMLElement,
  mode: KeyboardType | KeyboardBase | KeyboardConfig,
): () => void {
  const keyboard =
    mode instanceof KeyboardBase
      ? mode
      : typeof mode === "object"
        ? new Keyboard_Keys(mode)
        : KEYBOARDS[mode];

  if (!keyboard) return () => {};
  keyboard.open(element);

  return () => {
    keyboard.close();
  };
}

/** Attaches automatic virtual-keyboard handling to a document and returns a cleanup function. */
const on_focus = (event: FocusEvent) => {
  const type = keyboard_type(event.target as HTMLElement);
  if (event.target instanceof HTMLElement && type)
    keyboard_open(event.target, type);
};

VIRTUAL_KEYBOARD.sub((v) => {
  if (v.value)
    DOCUMENT_HANDLER.for_documents((doc) =>
      doc.addEventListener("focusin", on_focus),
    );
  else
    DOCUMENT_HANDLER.for_documents((doc) =>
      doc.removeEventListener("focusin", on_focus),
    );
}, true);
DOCUMENT_HANDLER.events.on("added", (e) => {
  if (VIRTUAL_KEYBOARD.ok()) e.data.addEventListener("focusin", on_focus);
  else e.data.removeEventListener("focusin", on_focus);
});

/** Creates a new on-screen keyboard instance with the specified configuration */
export function keyboard_create(config: KeyboardConfig): Keyboard_Keys {
  return new Keyboard_Keys(config);
}
