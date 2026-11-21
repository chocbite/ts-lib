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

/**Scrolls the list to the row with the label, in the middle, once its rows are shown, which takes a few frames
 * The list is scrolled itself, so the page does not move*/
export function list_scroll_to(container: HTMLElement, label: string): void {
  const scroll = (frames: number) => {
    //A row has no box of its own, its key field has
    const field = [...container.querySelectorAll<HTMLElement>("list-row")]
      .find((r) => (r as HTMLElement & { label: string }).label === label)
      ?.querySelector("list-keyfield");
    if (field) {
      const box = container.getBoundingClientRect();
      const rect = field.getBoundingClientRect();
      container.scrollTop +=
        rect.top - box.top - (box.height - rect.height) / 2;
    } else if (frames > 0) requestAnimationFrame(() => scroll(frames - 1));
  };
  requestAnimationFrame(() => scroll(10));
}
