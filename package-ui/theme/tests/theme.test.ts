import { afterEach, describe, expect, it } from "vitest";

//The theme module is imported in the tests, after the stored settings are set up,
//every test file runs in its own browser context, so the import happens here first
describe("Theme engine", () => {
  it("rem_to_px uses the stored scale from the start", async () => {
    localStorage.setItem("@chocbite/ts-lib-theme/scale", "150");
    try {
      const { rem_to_px, px_to_rem } = await import("./engine");
      expect(rem_to_px(1)).toBe(24);
      expect(px_to_rem(24)).toBe(1);
    } finally {
      localStorage.removeItem("@chocbite/ts-lib-theme/scale");
    }
  });

  it("applies a changed animation speed", async () => {
    const { theme_init } = await import("./init");
    theme_init();
    const { ANIMATION_SPEED } = await import("./settings");
    expect((await ANIMATION_SPEED.write(500)).ok).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue("--animation-speed"),
    ).toBe("500ms");
  });

  it("types the scrollbar colors as colors", async () => {
    await import("./builtIn");
    const { BOTTOM_GROUPS } = await import("./shared");
    const thumb =
      BOTTOM_GROUPS["common"]["sub_groups"]["scrollbar"]["sub_groups"]["thumb"];
    const types = Object.values(thumb["variables"]).map((v) => v.type);
    expect(types.length).toBeGreaterThan(0);
    expect(types.every((type) => type === "Color")).toBe(true);
  });
});

/**Storage key of a theme setting, writes store the value, so tests remove it afterwards*/
const setting_key = (id: string) => "@chocbite/ts-lib-theme/" + id;
const root_style = () => document.documentElement.style;
const root_var = (name: string, doc: Document = document) =>
  doc.documentElement.style.getPropertyValue(name).trim();

//These run after theme_init in the tests above
describe("Theme applied to the document", () => {
  afterEach(() => {
    for (const id of [
      "scale",
      "scrollbar",
      "input_mode",
      "animation_level",
      "animation_speed",
      "theme",
    ])
      localStorage.removeItem(setting_key(id));
  });

  it("applies the scale as root font size and to rem_to_px", async () => {
    const { SCALE, rem_to_px, px_to_rem } = await import(".");
    expect(root_style().fontSize).toBe(SCALE.ok() * 0.16 + "px");
    expect((await SCALE.write(200)).ok).toBe(true);
    expect(root_style().fontSize).toBe("32px");
    expect(rem_to_px(2)).toBe(64);
    expect(px_to_rem(32)).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(localStorage.getItem(setting_key("scale"))).toBe("200");
    expect((await SCALE.write(100)).ok).toBe(true);
    expect(root_style().fontSize).toBe("16px");
    expect(rem_to_px(1)).toBe(16);
  });

  it("rejects scales and animation speeds outside their range", async () => {
    const { SCALE, ANIMATION_SPEED } = await import(".");
    const scale = SCALE.ok();
    expect((await SCALE.write(1000)).ok).toBe(false);
    expect((await SCALE.write(10)).ok).toBe(false);
    expect(SCALE.ok()).toBe(scale);
    const speed = ANIMATION_SPEED.ok();
    expect((await ANIMATION_SPEED.write(5000)).ok).toBe(false);
    expect(ANIMATION_SPEED.ok()).toBe(speed);
  });

  it("applies the scrollbar size", async () => {
    const { SCROLLBAR_MODE, ScrollbarModes } = await import(".");
    expect(root_var("--scrollbar")).toBe("0.6rem");
    await SCROLLBAR_MODE.write(ScrollbarModes.Wide);
    expect(root_var("--scrollbar")).toBe("2.6rem");
    await SCROLLBAR_MODE.write(ScrollbarModes.Medium);
    expect(root_var("--scrollbar")).toBe("1rem");
    await SCROLLBAR_MODE.write(ScrollbarModes.Thin);
    expect(root_var("--scrollbar")).toBe("0.6rem");
  });

  it("applies the input mode as class and variables, only one at a time", async () => {
    const { INPUT_MODE, InputModes } = await import(".");
    const initial = INPUT_MODE.ok();
    expect(document.documentElement.classList.contains(initial)).toBe(true);
    for (const mode of [InputModes.Pen, InputModes.Touch, InputModes.Mouse]) {
      expect((await INPUT_MODE.write(mode)).ok).toBe(true);
      for (const other of Object.values(InputModes)) {
        expect(document.documentElement.classList.contains(other)).toBe(
          other === mode,
        );
        expect(root_var("--" + other)).toBe(other === mode ? "1" : "0");
      }
    }
    await INPUT_MODE.write(initial);
  });

  it("applies the animation level as classes", async () => {
    const { ANIMATION_LEVEL, AnimationLevels } = await import(".");
    const classes = () =>
      ["anim-all", "anim-some"].filter((c) =>
        document.documentElement.classList.contains(c),
      );
    expect(ANIMATION_LEVEL.ok()).toBe(AnimationLevels.None);
    expect(classes()).toEqual([]);
    await ANIMATION_LEVEL.write(AnimationLevels.All);
    expect(classes()).toEqual(["anim-all", "anim-some"]);
    await ANIMATION_LEVEL.write(AnimationLevels.Some);
    expect(classes()).toEqual(["anim-some"]);
    await ANIMATION_LEVEL.write(AnimationLevels.None);
    expect(classes()).toEqual([]);
  });

  it("switches the theme variables between light and dark", async () => {
    const { THEME, Themes } = await import(".");
    const { GREY } = await import("@chocbite/ts-lib/colors");
    expect(THEME.ok()).toBe(Themes.Light);
    expect(root_var("--common-scrollbar-thumb-color")).toBe(GREY["400"]);
    expect((await THEME.write(Themes.Dark)).ok).toBe(true);
    expect(root_var("--common-scrollbar-thumb-color")).toBe(GREY["800"]);
    expect((await THEME.write(Themes.Light)).ok).toBe(true);
    expect(root_var("--common-scrollbar-thumb-color")).toBe(GREY["400"]);
  });

  it("does not accept the System theme when system is off", async () => {
    const { THEME, Themes } = await import(".");
    expect((await THEME.write(Themes.System)).ok).toBe(false);
    expect(THEME.ok()).toBe(Themes.Light);
  });

  it("applies everything to documents registered later, and stops for removed ones", async () => {
    const { DOCUMENT_HANDLER } = await import("#document");
    const { SCROLLBAR_MODE, ScrollbarModes, SCALE } = await import(".");
    const doc = document.implementation.createHTMLDocument("theme");
    DOCUMENT_HANDLER.register_document(doc);
    try {
      expect(root_var("--scrollbar", doc)).toBe("0.6rem");
      expect(root_var("--common-scrollbar-thumb-color", doc)).not.toBe("");
      expect(doc.documentElement.style.fontSize).toBe(
        SCALE.ok() * 0.16 + "px",
      );
      expect(root_var("--animation-speed", doc)).toMatch(/ms$/);
      await SCROLLBAR_MODE.write(ScrollbarModes.Wide);
      expect(root_var("--scrollbar", doc)).toBe("2.6rem");
    } finally {
      DOCUMENT_HANDLER.deregister_document(doc);
    }
    await SCROLLBAR_MODE.write(ScrollbarModes.Thin);
    expect(root_var("--scrollbar", doc)).toBe("2.6rem");
    expect(root_var("--scrollbar")).toBe("0.6rem");
  });
});

describe("Theme variables", () => {
  afterEach(() => {
    localStorage.removeItem(setting_key("theme"));
  });

  it("applies a variable made after theme_init right away, and on theme changes", async () => {
    const { theme_init_variable_root, THEME, Themes } = await import(".");
    const root = theme_init_variable_root("testvars", "Test", "Test variables");
    expect(root.name).toBe("Test");
    expect(root.description).toBe("Test variables");
    const key = root.make_variable("size", "Size", "", "1rem", "2rem", "Length", {
      min: 0,
      max: 10,
    });
    expect(key).toBe("--testvars-size");
    expect(root_var(key)).toBe("1rem");
    const inner = root.make_sub_group("inner", "Inner", "");
    const inner_key = inner.make_variable("color", "Color", "", "#fff", "#000", "Color", undefined);
    expect(inner_key).toBe("--testvars-inner-color");
    expect(root_var(inner_key)).toBe("#fff");
    await THEME.write(Themes.Dark);
    expect(root_var(key)).toBe("2rem");
    expect(root_var(inner_key)).toBe("#000");
    await THEME.write(Themes.Light);
    expect(root_var(key)).toBe("1rem");
    expect(root_var(inner_key)).toBe("#fff");
  });

  it("does not allow dashes in names and ids", async () => {
    const { theme_init_variable_root } = await import(".");
    expect(() => theme_init_variable_root("with-dash", "", "")).toThrow("Dash");
    const root = theme_init_variable_root("dashes", "", "");
    expect(() => root.make_sub_group("a-b", "", "")).toThrow("Dash");
    expect(() =>
      root.make_variable("a-b", "", "", "1", "2", "String", undefined),
    ).toThrow("Dash");
  });

  it("throws for variables and sub groups registered twice", async () => {
    const { theme_init_variable_root } = await import(".");
    const root = theme_init_variable_root("twice", "", "");
    root.make_variable("v", "", "", "1", "2", "String", undefined);
    expect(() =>
      root.make_variable("v", "", "", "1", "2", "String", undefined),
    ).toThrow("already registered");
    root.make_sub_group("s", "", "");
    expect(() => root.make_sub_group("s", "", "")).toThrow("already registered");
  });

  it("throws for a root group name used twice", async () => {
    const { theme_init_variable_root } = await import(".");
    const root = theme_init_variable_root("rootonce", "First", "");
    root.make_variable("v", "", "", "1", "2", "String", undefined);
    expect(() => theme_init_variable_root("rootonce", "Second", "")).toThrow(
      "already registered",
    );
  });
});
