import { GREY } from "@chocbite/ts-lib/colors";
import { describe, expect, it, vi } from "vitest";

//The operating system dark mode query is replaced before the theme module loads, so the test can switch it,
//every test file runs in its own browser context, so the theme module loads fresh here
const os_listeners: ((e: { matches: boolean }) => void)[] = [];
vi.stubGlobal("matchMedia", (media: string) => ({
  matches: false,
  media,
  addEventListener: (_type: string, listener: (e: { matches: boolean }) => void) =>
    os_listeners.push(listener),
  removeEventListener: () => {},
}));

/**Switches the operating system dark mode, the theme write checks its value async, so this waits for it*/
const os_dark_mode = async (dark: boolean) => {
  os_listeners.forEach((listener) => listener({ matches: dark }));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

/**The light or dark value of a theme variable shows which theme is applied*/
const applied_thumb_color = () =>
  document.documentElement.style
    .getPropertyValue("--common-scrollbar-thumb-color")
    .trim();

describe("Theme with the operating system dark mode", () => {
  it("applies nothing before theme_init", async () => {
    await import(".");
    expect(applied_thumb_color()).toBe("");
  });

  it("follows the operating system with the default System theme, without storing it", async () => {
    const { theme_init, THEME, Themes } = await import(".");
    theme_init({ system: true });
    expect(THEME.ok()).toBe(Themes.System);
    expect(applied_thumb_color()).toBe(GREY["400"]);
    await os_dark_mode(true);
    expect(applied_thumb_color()).toBe(GREY["800"]);
    await os_dark_mode(false);
    expect(applied_thumb_color()).toBe(GREY["400"]);
    expect(localStorage.getItem("@chocbite/ts-lib-theme/theme")).toBeNull();
  });

  it("shows the theme the operating system uses in the System choice", async () => {
    const { THEME, Themes } = await import(".");
    const system_choice = async () =>
      (await THEME.related().unwrap().list).unwrap()[Themes.System];
    await os_dark_mode(true);
    expect((await system_choice()).name).toBe("System (Dark)");
    await os_dark_mode(false);
    expect((await system_choice()).name).toBe("System (Light)");
  });

  it("keeps the theme the user chose when the operating system changes", async () => {
    const { THEME, Themes } = await import(".");
    expect((await THEME.write(Themes.Dark)).ok).toBe(true);
    await os_dark_mode(false);
    expect(applied_thumb_color()).toBe(GREY["800"]);
    localStorage.removeItem("@chocbite/ts-lib-theme/theme");
  });

  it("can only be started once", async () => {
    const { theme_init } = await import(".");
    expect(() => theme_init()).toThrow("already");
  });
});
