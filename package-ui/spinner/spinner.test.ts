import { GREY } from "@chocbite/ts-lib/colors";
import { describe, expect, it } from "vitest";
import { Spinner } from ".";
import { theme_init } from "#theme";

/**The color as the browser computes it, for comparing with computed styles*/
const computed_color = (color: string) => {
  const probe = document.body.appendChild(document.createElement("div"));
  probe.style.color = color;
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
};

describe("Spinner", () => {
  it("is defined as spinner-spinner with a 12 dot svg", () => {
    const spinner = new Spinner();
    expect(spinner.tagName.toLowerCase()).toBe("spinner-spinner");
    expect(customElements.get("spinner-spinner")).toBe(Spinner);
    const svg = spinner.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 64 64");
    expect(svg?.querySelectorAll("circle").length).toBe(12);
  });

  it("gives every spinner its own svg", () => {
    const first = new Spinner();
    const second = new Spinner();
    const first_svg = first.querySelector("svg");
    const second_svg = second.querySelector("svg");
    expect(first_svg).not.toBe(second_svg);
    first_svg?.querySelector("circle")?.remove();
    expect(first_svg?.querySelectorAll("circle").length).toBe(11);
    expect(second_svg?.querySelectorAll("circle").length).toBe(12);
    expect(new Spinner().querySelectorAll("circle").length).toBe(12);
  });

  it("colors the dots with the spinner theme variable", () => {
    theme_init();
    expect(
      document.documentElement.style.getPropertyValue("--spinners-color").trim(),
    ).toBe(GREY["700"]);
    const spinner = document.body.appendChild(new Spinner());
    try {
      const circle = spinner.querySelector("circle")!;
      expect(getComputedStyle(circle).fill).toBe(computed_color(GREY["700"]));
    } finally {
      spinner.remove();
    }
  });
});
