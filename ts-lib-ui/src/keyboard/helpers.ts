import { KeyboardType } from "./types";

export function input_keyboard_type(input: HTMLInputElement): KeyboardType {
  if (input.type === "tel") return KeyboardType.Phone;
  if (input.type === "email") return KeyboardType.Email;
  if (input.type === "color") return KeyboardType.Color;
  if (input.type === "date") return KeyboardType.Date;
  if (input.type === "datetime-local") return KeyboardType.DateTimeLocal;
  if (input.type === "month") return KeyboardType.Month;
  if (input.type === "time") return KeyboardType.Time;
  if (input.type === "week") return KeyboardType.Week;
  if (input.type !== "number") return KeyboardType.Text;

  const positive = input.min !== "" && Number(input.min) >= 0;
  const rational =
    input.step === "any" ||
    (input.step !== "" &&
      Number.isFinite(Number(input.step)) &&
      !Number.isInteger(Number(input.step)));

  if (rational)
    return positive
      ? KeyboardType.NumberRationalPositive
      : KeyboardType.NumberRational;
  return positive ? KeyboardType.NumberWhole : KeyboardType.NumberInteger;
}

export function keyboard_type(element: HTMLElement): KeyboardType | undefined {
  if (element instanceof HTMLTextAreaElement) return KeyboardType.Text;
  if (element instanceof HTMLInputElement) {
    if (
      element.disabled ||
      element.readOnly ||
      element.type === "hidden" ||
      element.dataset.keyboardManual === "true"
    )
      return undefined;
    if (
      [
        "button",
        "checkbox",
        "file",
        "image",
        "radio",
        "range",
        "reset",
        "submit",
      ].includes(element.type)
    )
      return undefined;
    return input_keyboard_type(element);
  }
  return element.isContentEditable ? KeyboardType.Text : undefined;
}
