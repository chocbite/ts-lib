import { afterEach, describe, expect, it } from "vitest";
import { keyboard_open, KeyboardType } from "./index";

describe("Keyboard page shift", () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.body.style.transform = "";
  });

  it("restores the page's own body transform when closing", () => {
    document.body.style.transform = "scale(1)";
    //Input at the bottom of the page, where the keyboard covers it
    const input = document.body.appendChild(document.createElement("input"));
    input.style.position = "fixed";
    input.style.bottom = "0px";
    const close = keyboard_open(input, KeyboardType.Text);
    expect(document.body.style.transform).toContain("translateY(");
    close();
    expect(document.body.style.transform).toBe("scale(1)");
  });

  it("does not move the top of a tall element off the screen", () => {
    //Element filling the screen, the keyboard covers its bottom part
    const input = document.body.appendChild(
      document.createElement("textarea"),
    );
    input.style.position = "fixed";
    input.style.top = "0px";
    input.style.height = "100vh";
    const close = keyboard_open(input, KeyboardType.Text);
    expect(input.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    close();
  });
});
