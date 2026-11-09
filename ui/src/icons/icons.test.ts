import { describe, expect, it } from "vitest";
import {
  material_10k_rounded,
  material_dark_mode_rounded,
  material_light_mode_rounded,
} from ".";
import { generate_function } from "./shared";

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M0 0h10v10H0z"/></svg>';

describe("generate_function", () => {
  it("returns an svg element with the icon name", () => {
    const icon = generate_function("test_icon", SVG)();
    expect(icon).toBeInstanceOf(SVGSVGElement);
    expect(icon.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(icon.getAttribute("icon")).toBe("test_icon");
    expect(icon.getAttribute("viewBox")).toBe("0 -960 960 960");
    expect(icon.querySelector("path")?.getAttribute("d")).toBe("M0 0h10v10H0z");
  });

  it("returns an independent copy on every call", () => {
    const func = generate_function("copies", SVG);
    const first = func();
    const second = func();
    expect(first).not.toBe(second);
    first.setAttribute("width", "48");
    first.querySelector("path")?.remove();
    first.classList.add("changed");
    const third = func();
    expect(third.getAttribute("width")).toBe("24");
    expect(third.querySelector("path")).not.toBeNull();
    expect(third.classList.contains("changed")).toBe(false);
    expect(second.querySelector("path")).not.toBeNull();
  });

  it("returns copies that can be placed in the page at the same time", () => {
    const func = generate_function("placed", SVG);
    const first = document.body.appendChild(func());
    const second = document.body.appendChild(func());
    try {
      expect(first.isConnected).toBe(true);
      expect(second.isConnected).toBe(true);
      expect(document.body.querySelectorAll('svg[icon="placed"]').length).toBe(2);
    } finally {
      first.remove();
      second.remove();
    }
  });

  it("keeps different icons apart", () => {
    const a = generate_function("a", SVG);
    const b = generate_function(
      "b",
      SVG.replace("M0 0h10v10H0z", "M1 1h5v5H1z"),
    );
    expect(a().getAttribute("icon")).toBe("a");
    expect(b().getAttribute("icon")).toBe("b");
    expect(a().querySelector("path")?.getAttribute("d")).toBe("M0 0h10v10H0z");
  });
});

describe("Material icons", () => {
  it("are svg elements named after their function", () => {
    for (const [name, func] of [
      ["material_10k_rounded", material_10k_rounded],
      ["material_dark_mode_rounded", material_dark_mode_rounded],
      ["material_light_mode_rounded", material_light_mode_rounded],
    ] as const) {
      const icon = func();
      expect(icon).toBeInstanceOf(SVGSVGElement);
      expect(icon.getAttribute("icon")).toBe(name);
      expect(icon.querySelector("path")).not.toBeNull();
    }
  });

  it("returns independent copies", () => {
    const first = material_dark_mode_rounded();
    first.querySelector("path")?.remove();
    const second = material_dark_mode_rounded();
    expect(second).not.toBe(first);
    expect(second.querySelector("path")).not.toBeNull();
  });
});
