import { GREY } from "@chocbite/ts-lib/colors";
import { afterEach, describe, expect, it } from "vitest";
import { spinner as make_spinner } from ".";
import { theme_init } from "#theme";

/**The color as the browser computes it, for comparing with computed styles*/
const computed_color = (color: string) => {
  const probe = document.body.appendChild(document.createElement("div"));
  probe.style.color = color;
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
};

/**Spinner in a box of the given size, with its ring and dots*/
const make = (width = 64, height = 64) => {
  const box = document.body.appendChild(document.createElement("div"));
  box.style.cssText = `width:${width}px;height:${height}px`;
  const spinner = box.appendChild(make_spinner());
  const ring = spinner.firstElementChild as HTMLElement;
  const dots = [...ring.querySelectorAll(":scope > div > div")] as HTMLElement[];
  return { spinner, ring, dots };
};

/**Sets the animation level classes the theme puts on html*/
const animation = (level: "all" | "some" | "none") => {
  const html = document.documentElement;
  html.classList.remove("anim-all", "anim-some");
  if (level === "all") html.classList.add("anim-all", "anim-some");
  if (level === "some") html.classList.add("anim-some");
};

afterEach(() => {
  document.body.replaceChildren();
  animation("none");
});

describe("Spinner", () => {
  it("is defined as spinner-spinner with a ring of 12 dots in html, no svg", () => {
    const { spinner, dots } = make();
    expect(spinner.tagName.toLowerCase()).toBe("spinner-spinner");
    expect(customElements.get("spinner-spinner")).toBe(spinner.constructor);
    expect(dots.length).toBe(12);
    expect(spinner.querySelector("svg")).toBeNull();
  });

  it("gives every spinner its own dots", () => {
    const first = make().dots;
    const second = make().dots;
    expect(first[0]).not.toBe(second[0]);
  });

  it("is round and as big as its smaller side, centered", () => {
    const { ring } = make(100, 40);
    const rect = ring.getBoundingClientRect();
    expect(rect.width).toBe(40);
    expect(rect.height).toBe(40);
    expect(rect.left - ring.parentElement!.getBoundingClientRect().left).toBe(30);
  });

  it("pulses each dot at the full animation level, the ring stands still", () => {
    animation("all");
    const { ring, dots } = make();
    expect(getComputedStyle(ring).animationName).toBe("none");
    expect(getComputedStyle(dots[0]).animationName).toBe("spinner-pulse");
    //Each dot a moment after the one before
    expect(getComputedStyle(dots[0]).animationDelay).toBe("-1.1s");
    expect(getComputedStyle(dots[11]).animationDelay).toBe("0s");
  });

  it("turns the ring 30 degrees at a time with still dots at the lower levels", () => {
    for (const level of ["some", "none"] as const) {
      animation(level);
      const { ring, dots } = make();
      const style = getComputedStyle(ring);
      expect(style.animationName).toBe("spinner-steps");
      expect(style.animationTimingFunction).toBe("steps(12)");
      expect(getComputedStyle(dots[0]).animationName).toBe("none");
      //The still dots are a trail, the one at the peak of the wave the biggest
      expect(getComputedStyle(dots[5]).scale).toBe("1");
      expect(Number(getComputedStyle(dots[0]).scale)).toBeLessThan(1);
    }
  });

  it("colors the dots with the spinner theme variable", () => {
    theme_init();
    expect(
      document.documentElement.style.getPropertyValue("--spinners-color").trim(),
    ).toBe(GREY["700"]);
    const { dots } = make();
    expect(getComputedStyle(dots[0]).backgroundColor).toBe(
      computed_color(GREY["700"]),
    );
  });
});
