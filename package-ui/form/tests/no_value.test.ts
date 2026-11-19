import state from "@chocbite/ts-lib/state";
import { theme_init } from "#theme";
import { afterEach, describe, expect, it } from "vitest";
import form from "..";

//Sizes come from theme variables
theme_init();

const tick = () => new Promise((resolve) => setTimeout(resolve));

afterEach(() => {
  document.body.replaceChildren();
});

const show = <E extends HTMLElement>(element: E) =>
  document.body.appendChild(element);
/**The style of a pseudo element*/
const pseudo = (element: Element, which: "::before" | "::after") =>
  getComputedStyle(element, which);
const drawn = (element: Element, which: "::before" | "::after") =>
  pseudo(element, which).content !== "none" &&
  pseudo(element, which).display !== "none";

describe("Form elements without a value", () => {
  it("are marked no-value until they get a value, and again when cleared", async () => {
    const empty = show(form.number_input());
    expect(empty.hasAttribute("no-value")).toBe(true);
    expect(show(form.number_input({ value: 5 })).hasAttribute("no-value")).toBe(
      false,
    );
    const from_state = show(form.number_input({ value: state.ok_w(5) }));
    expect(from_state.hasAttribute("no-value")).toBe(false);
    //A value the user enters
    const text = show(form.text_input());
    const input = text.querySelector("input")!;
    input.value = "typed";
    input.dispatchEvent(new Event("change"));
    await tick();
    expect(text.hasAttribute("no-value")).toBe(false);
    text.clear();
    expect(text.hasAttribute("no-value")).toBe(true);
  });

  it("text and number inputs show a short grey line, hidden while focused", () => {
    //Dropdowns have their own, the text asking to select something
    const text = show(form.text_input());
    const number = show(form.number_input());
    const places: [Element, Element][] = [
      [text, text],
      [number, number.querySelector(":scope > span")!],
    ];
    for (const [, place] of places) {
      expect(drawn(place, "::after")).toBe(true);
      expect(parseFloat(pseudo(place, "::after").width)).toBeGreaterThan(0);
      expect(parseFloat(pseudo(place, "::after").height)).toBeGreaterThan(0);
    }
    text.querySelector("input")!.focus();
    expect(drawn(text, "::after")).toBe(false);
    //With a value there is no line
    const valued = show(form.text_input({ value: "" }));
    expect(drawn(valued, "::after")).toBe(false);
    const valued_number = show(form.number_input({ value: 1 }));
    expect(
      drawn(valued_number.querySelector(":scope > span")!, "::after"),
    ).toBe(false);
  });

  it("a color input shows a muted rainbow over the swatch", () => {
    const color = show(form.color());
    expect(pseudo(color, "::after").backgroundImage).toContain("gradient");
    expect(drawn(show(form.color({ value: "#ff0000" })), "::after")).toBe(
      false,
    );
  });

  it("a switch has its knob in the middle, a press turns it on", async () => {
    const element = show(form.switch());
    const track = element.querySelector(":scope > div")!;
    const knob = pseudo(track, "::after");
    const track_width = track.getBoundingClientRect().width;
    const middle = parseFloat(knob.left) + parseFloat(knob.width) / 2;
    expect(middle).toBeCloseTo(track_width / 2, 0);
    const on = show(form.switch({ value: true }));
    const on_track = on.querySelector(":scope > div")!;
    expect(parseFloat(pseudo(on_track, "::after").left)).toBeGreaterThan(
      track_width / 2,
    );
    for (const type of ["keydown", "keyup"])
      track.dispatchEvent(new KeyboardEvent(type, { key: " ", bubbles: true }));
    await tick();
    expect(element.get_value).toMatchObject({ ok: true, value: true });
    expect(element.hasAttribute("no-value")).toBe(false);
  });
});
