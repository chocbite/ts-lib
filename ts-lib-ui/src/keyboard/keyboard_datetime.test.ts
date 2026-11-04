import { describe, expect, it } from "vitest";
import { Keyboard_DateTime } from "./keyboard_datetime";

function appendInput(type: string, value: string): HTMLInputElement {
  const input = document.body.appendChild(document.createElement("input"));
  input.type = type;
  input.value = value;
  return input;
}

describe("Keyboard_DateTime", () => {
  it("selects a date and emits input followed by change", () => {
    const input = appendInput("date", "2026-03-10");
    const events: string[] = [];
    input.addEventListener("input", () => events.push("input"));
    input.addEventListener("change", () => events.push("change"));
    const keyboard = new Keyboard_DateTime();

    keyboard.open(input);
    const date = [...keyboard.querySelectorAll("button")].find(
      (button) => button.textContent === "11" && !button.classList.contains("outside"),
    );
    date?.click();

    expect(input.value).toBe("2026-03-11");
    expect(events).toEqual(["input", "change"]);
  });

  it("disables dates outside input constraints", () => {
    const input = appendInput("date", "2026-03-10");
    input.min = "2026-03-10";
    input.max = "2026-03-12";
    const keyboard = new Keyboard_DateTime();

    keyboard.open(input);
    const buttons = [...keyboard.querySelectorAll("button")];
    const allowed = buttons.find((button) => button.textContent === "11");
    const blocked = buttons.find((button) => button.textContent === "9");

    expect(allowed?.disabled).toBe(false);
    expect(blocked?.disabled).toBe(true);
    keyboard.close();
  });
});
