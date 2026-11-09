import { describe, expect, it } from "vitest";

const key = (id: string) => "@chocbite/ts-lib-theme/" + id;

//Stored values are set before the theme module loads,
//every test file runs in its own browser context, so the theme module loads fresh here
describe("Theme settings from storage", () => {
  it("ignores stored values of the wrong type or outside the allowed values", async () => {
    localStorage.setItem(key("scale"), JSON.stringify("big"));
    localStorage.setItem(key("theme"), JSON.stringify("purple"));
    localStorage.setItem(key("animation_speed"), JSON.stringify(-5));
    try {
      const { SCALE, THEME, Themes, ANIMATION_SPEED } = await import(
        "./settings"
      );
      expect(SCALE.ok()).toBe(100);
      expect(Object.values(Themes)).toContain(THEME.ok());
      expect(ANIMATION_SPEED.ok()).toBe(200);
    } finally {
      for (const id of ["scale", "theme", "animation_speed"])
        localStorage.removeItem(key(id));
    }
  });
});
