import { IPAddress } from "@chocbite/ts-lib/common";
import { err, NiceError, ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import form from "..";

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
const show = <E extends HTMLElement>(element: E) =>
  document.body.appendChild(element);
const rejected = new NiceError(Symbol("Rejected"), "Not now");

afterEach(() => {
  document.body.replaceChildren();
});

/**The typed number of a number input or stepper*/
const number_field = (element: HTMLElement) =>
  element.querySelector<HTMLElement>("span[contenteditable]")!;
/**Types in a number field and leaves it*/
const type_and_leave = (field: HTMLElement, text: string) => {
  field.focus();
  field.textContent = text;
  field.dispatchEvent(new Event("input"));
  field.blur();
};

describe("Form elements show their value again after a rejected change", () => {
  it("a stepper, a typed number over its max", async () => {
    const element = show(form.stepper({ value: 5, max: 10 }));
    type_and_leave(number_field(element), "500");
    await tick();
    expect(number_field(element).textContent).toBe("5");
  });

  it("a number input without a value shows it has none, not a number", async () => {
    const element = show(form.number_input({ max: 10 }));
    type_and_leave(number_field(element), "500");
    await tick();
    expect(number_field(element).textContent).toBe("");
    expect(element.hasAttribute("no-value")).toBe(true);
  });

  it("a password, a new one entered with Enter while it has the focus", async () => {
    const element = show(
      form.password({ value: state.ok_w("secret").read_only }),
    );
    const input = element.querySelector("input")!;
    input.focus();
    input.value = "other";
    input.dispatchEvent(new Event("change"));
    await tick();
    expect(input.value).toBe("secret");
  });

  it("a color, a picked color, also on the swatch", async () => {
    const element = show(
      form.color({ value: state.ok_w("#ff0000").read_only }),
    );
    const input = element.querySelector("input")!;
    input.value = "#00ff00";
    input.dispatchEvent(new Event("change"));
    await tick();
    expect(input.value).toBe("#ff0000");
    expect(
      element.querySelector<HTMLElement>(".swatch > div")!.style
        .backgroundColor,
    ).toBe("rgb(255, 0, 0)");
  });

  it("a date and time, a date entered while it has the focus", async () => {
    const element = show(
      form.date_time({
        mode: form.FormDateTimeMode.NUMBER,
        value: state.ok_w(Date.UTC(2024, 0, 2, 3, 4, 5)).read_only,
      }),
    );
    const input = element.querySelector("input")!;
    const shown = input.value;
    input.focus();
    input.value = "2020-01-01T00:00:00";
    input.dispatchEvent(new Event("change"));
    await tick();
    expect(input.value).toBe(shown);
  });

  it("an IP address, a typed address committed with Enter", async () => {
    const element = show(
      form.ip({ value: state.ok_w(new IPAddress("10.0.0.1")).read_only }),
    );
    const parts = [...element.querySelectorAll<HTMLElement>(":scope > div")];
    parts[3].textContent = "2";
    parts[3].dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await tick();
    expect(parts[3].textContent).toBe("1");
  });

  it("an IP address, an incomplete address when leaving it", async () => {
    const element = show(form.ip({ value: new IPAddress("10.0.0.1") }));
    const parts = [...element.querySelectorAll<HTMLElement>(":scope > div")];
    parts[0].focus();
    parts[0].textContent = "";
    parts[0].blur();
    await tick();
    expect(parts.slice(0, 4).map((part) => part.textContent)).toEqual([
      "10",
      "0",
      "0",
      "1",
    ]);
  });

  it("a switch without a value, a write its state rejects", async () => {
    const element = show(
      form.switch({
        value: state.resw<boolean>(err(rejected), async () => err(rejected)),
      }),
    );
    element.click();
    await tick();
    expect(
      element.querySelector(":scope > div")!.classList.contains("on"),
    ).toBe(false);
  });

  it("the value the state changed to while it rejected the write, not the one before", async () => {
    const value = state.rosw(ok(1), async (_value, owner) => {
      owner.set_ok(3);
      return err(rejected);
    });
    const element = show(form.stepper({ value }));
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await tick();
    expect(number_field(element).textContent).toBe("3");
  });
});
