import { describe, expect, it, vi } from "vitest";

const THEME_KEY = "@chocbite/ts-lib-theme/theme";

//Stored before the theme module loads, every test file runs in its own browser context,
//so the theme module loads fresh here
localStorage.setItem(THEME_KEY, JSON.stringify("system"));
const match_media = vi.spyOn(window, "matchMedia");

describe("Theme without the operating system dark mode", () => {
  it("offers no System choice, does not read the dark mode, and replaces a stored System with the default", async () => {
    try {
      const { theme_init, THEME, Themes } = await import(".");
      theme_init({ default: Themes.Dark });
      expect(THEME.ok()).toBe(Themes.Dark);
      const list = (await THEME.related().unwrap().list).unwrap();
      expect(Themes.System in list).toBe(false);
      expect(
        match_media.mock.calls.some(([query]) =>
          query.includes("prefers-color-scheme"),
        ),
      ).toBe(false);
    } finally {
      localStorage.removeItem(THEME_KEY);
    }
  });

  it("does not allow System as default without system", async () => {
    const { theme_init, Themes } = await import(".");
    expect(() => theme_init({ default: Themes.System })).toThrow("System");
  });
});
