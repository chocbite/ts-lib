import { afterEach, describe, expect, it } from "vitest";
import { Keyboard_Color } from "./keyboard_color";

function appendInput(type: string, value: string): HTMLInputElement {
  const input = document.body.appendChild(document.createElement("input"));
  input.type = type;
  input.value = value;
  return input;
}

/**Records the input and change events of the input*/
function record(input: HTMLInputElement): string[] {
  const events: string[] = [];
  input.addEventListener("input", () => events.push("input"));
  input.addEventListener("change", () => events.push("change"));
  return events;
}

function parts(keyboard: Keyboard_Color) {
  const slider = (label: string) =>
    keyboard.querySelector<HTMLInputElement>(`label[title="${label}"] input`)!;
  return {
    hue: slider("Hue"),
    red: slider("Red"),
    green: slider("Green"),
    blue: slider("Blue"),
    hex: keyboard.querySelector<HTMLInputElement>(
      ".keyboard-color-controls input",
    )!,
    square: keyboard.querySelector<HTMLDivElement>(".keyboard-color-square")!,
  };
}

/**Moves a slider like a user does, input while dragging and change on release*/
function slide(slider: HTMLInputElement, value: number, release = true) {
  slider.value = value.toString();
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  if (release) slider.dispatchEvent(new Event("change", { bubbles: true }));
}

/**Drags over the square, positions are fractions of its size, synthetic pointer events need the capture stubbed*/
function drag(square: HTMLElement, ...points: [number, number][]) {
  let captured = false;
  square.setPointerCapture = () => {
    captured = true;
  };
  square.hasPointerCapture = () => captured;
  square.releasePointerCapture = () => {
    captured = false;
  };
  const bounds = square.getBoundingClientRect();
  const event = (type: string, [x, y]: [number, number]) =>
    square.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        clientX: bounds.left + x * bounds.width,
        clientY: bounds.top + y * bounds.height,
      }),
    );
  event("pointerdown", points[0]);
  for (const point of points.slice(1)) event("pointermove", point);
  event("pointerup", points[points.length - 1]);
}

describe("Keyboard_Color", () => {
  let keyboard: Keyboard_Color;
  afterEach(() => {
    keyboard?.close();
    document.body.replaceChildren();
  });

  it("only opens for color inputs", () => {
    keyboard = new Keyboard_Color();
    keyboard.open(appendInput("text", "#ff0000"));
    expect(keyboard.isConnected).toBe(false);
    keyboard.open(appendInput("color", "#ff0000"));
    expect(keyboard.isConnected).toBe(true);
  });

  it("shows the color of the input", () => {
    keyboard = new Keyboard_Color();
    keyboard.open(appendInput("color", "#ff8000"));
    const p = parts(keyboard);
    expect([p.red.value, p.green.value, p.blue.value]).toEqual(["255", "128", "0"]);
    expect(p.hue.value).toBe("30");
    expect(p.hex.value).toBe("#ff8000");
  });

  it("follows changes made to the input while open", () => {
    const input = appendInput("color", "#ff0000");
    keyboard = new Keyboard_Color();
    keyboard.open(input);
    input.value = "#00ff00";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const p = parts(keyboard);
    expect(p.green.value).toBe("255");
    expect(p.red.value).toBe("0");
    expect(p.hue.value).toBe("120");
    expect(p.hex.value).toBe("#00ff00");
  });

  it("writes slider moves to the input with input events", () => {
    const input = appendInput("color", "#ff8000");
    keyboard = new Keyboard_Color();
    keyboard.open(input);
    const events: string[] = [];
    input.addEventListener("input", () => events.push("input"));
    const p = parts(keyboard);
    slide(p.red, 0, false);
    expect(input.value).toBe("#008000");
    expect(events).toEqual(["input"]);
    slide(p.hue, 240, false);
    expect(input.value).toBe("#000080");
    expect(p.hex.value).toBe("#000080");
  });

  it("emits change on the input when a slider is released", () => {
    const input = appendInput("color", "#ff8000");
    keyboard = new Keyboard_Color();
    keyboard.open(input);
    const events = record(input);
    slide(parts(keyboard).red, 0);
    expect(input.value).toBe("#008000");
    expect(events).toEqual(["input", "change"]);
  });

  it("sets saturation and value by dragging over the square", () => {
    const input = appendInput("color", "#ff0000");
    keyboard = new Keyboard_Color();
    keyboard.open(input);
    const square = parts(keyboard).square;
    drag(square, [0.5, 0]);
    expect(input.value).toBe("#ff8080");
    drag(square, [1, 0]);
    expect(input.value).toBe("#ff0000");
    drag(square, [1, 1]);
    expect(input.value).toBe("#000000");
  });

  it("clamps drags outside the square", () => {
    const input = appendInput("color", "#ff0000");
    keyboard = new Keyboard_Color();
    keyboard.open(input);
    drag(parts(keyboard).square, [0.5, 0.5], [2, -1]);
    expect(input.value).toBe("#ff0000");
  });

  it("emits change on the input when a drag over the square ends", () => {
    const input = appendInput("color", "#ff0000");
    keyboard = new Keyboard_Color();
    keyboard.open(input);
    const events = record(input);
    drag(parts(keyboard).square, [0.5, 0], [0.5, 0.5]);
    expect(input.value).toBe("#804040");
    expect(events.filter((e) => e === "change")).toEqual(["change"]);
  });

  it("keeps the hue when a drag passes the grey left edge of the square", () => {
    //Hue of about 210
    const input = appendInput("color", "#0080ff");
    keyboard = new Keyboard_Color();
    keyboard.open(input);
    drag(parts(keyboard).square, [0, 0.5], [1, 0.5]);
    expect(input.value).toBe("#004080");
  });

  it("emits change on close after a slider moved without release", () => {
    const input = appendInput("color", "#ff8000");
    keyboard = new Keyboard_Color();
    keyboard.open(input);
    const events = record(input);
    slide(parts(keyboard).red, 0, false);
    keyboard.close();
    expect(events).toEqual(["input", "change"]);
  });

  it("emits change for the first input when opened for another", () => {
    const first = appendInput("color", "#ff8000");
    const second = appendInput("color", "#000000");
    keyboard = new Keyboard_Color();
    keyboard.open(first);
    const events = record(first);
    slide(parts(keyboard).red, 0, false);
    keyboard.open(second);
    expect(events).toEqual(["input", "change"]);
  });

  it("stops following the input after closing", () => {
    const input = appendInput("color", "#ff0000");
    keyboard = new Keyboard_Color();
    keyboard.open(input);
    keyboard.close();
    input.value = "#00ff00";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(parts(keyboard).red.value).toBe("255");
    //A slider moved while closed writes nowhere
    slide(parts(keyboard).blue, 255);
    expect(input.value).toBe("#00ff00");
  });
});
