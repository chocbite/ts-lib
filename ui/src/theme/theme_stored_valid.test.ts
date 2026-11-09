import { GREY } from "@chocbite/ts-lib/colors";
import { describe, expect, it } from "vitest";

const key = (id: string) => "@chocbite/ts-lib-theme/" + id;
const STORED: { [id: string]: unknown } = {
  theme: "dark",
  scale: 125,
  scrollbar: "wide",
  input_mode: "pen",
  animation_level: "some",
  animation_speed: 300,
};

//Valid stored values are set before the theme module loads,
//every test file runs in its own browser context, so the theme module loads fresh here
for (const id in STORED) localStorage.setItem(key(id), JSON.stringify(STORED[id]));

const root_var = (name: string) =>
  document.documentElement.style.getPropertyValue(name).trim();

describe("Theme settings from storage, valid values", () => {
  it("uses the stored values over the defaults and applies them on theme_init", async () => {
    try {
      const {
        theme_init,
        THEME,
        Themes,
        SCALE,
        SCROLLBAR_MODE,
        INPUT_MODE,
        ANIMATION_LEVEL,
        ANIMATION_SPEED,
        rem_to_px,
      } = await import(".");
      expect(THEME.ok()).toBe(Themes.Dark);
      expect(SCALE.ok()).toBe(125);
      expect(SCROLLBAR_MODE.ok()).toBe("wide");
      expect(INPUT_MODE.ok()).toBe("pen");
      expect(ANIMATION_LEVEL.ok()).toBe("some");
      expect(ANIMATION_SPEED.ok()).toBe(300);
      expect(rem_to_px(1)).toBe(20);

      //The stored choice of the user wins over the default theme
      theme_init({ default: Themes.Light });
      expect(THEME.ok()).toBe(Themes.Dark);
      const html = document.documentElement;
      expect(html.style.fontSize).toBe("20px");
      expect(root_var("--scrollbar")).toBe("2.6rem");
      expect(html.classList.contains("pen")).toBe(true);
      expect(root_var("--pen")).toBe("1");
      expect(html.classList.contains("anim-some")).toBe(true);
      expect(html.classList.contains("anim-all")).toBe(false);
      expect(root_var("--animation-speed")).toBe("300ms");
      expect(root_var("--common-scrollbar-thumb-color")).toBe(GREY["800"]);
    } finally {
      for (const id in STORED) localStorage.removeItem(key(id));
    }
  });
});
