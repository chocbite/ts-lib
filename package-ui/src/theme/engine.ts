import { DOCUMENT_HANDLER } from "#document";
import {
  ANIMATION_LEVEL,
  ANIMATION_SPEED,
  AnimationLevels,
  INPUT_MODE,
  InputModes,
  SCALE,
  SCROLLBAR_MODE,
  ScrollbarModes,
  THEME,
  Themes,
  type AppliedThemes,
} from "./settings";
import { BOTTOM_GROUPS } from "./shared";

class ThemeEngine {
  #started = false;
  /**Theme of the operating system, used for the System theme*/
  #os_theme: AppliedThemes = Themes.Light;

  /**Starts applying the theme to all documents, called once by theme_init*/
  start() {
    this.#started = true;
    DOCUMENT_HANDLER.events.on("added", (e) => {
      this.#apply_all_to_doc(e.data);
    });
    this.#for_documents((doc) => {
      this.#apply_all_to_doc(doc);
    });
  }

  /**Runs for every document, nothing is applied before the engine is started*/
  #for_documents(func: (doc: Document) => void) {
    if (this.#started) DOCUMENT_HANDLER.for_documents(func);
  }

  /**Sets the theme of the operating system, reapplying the theme when System is used*/
  set_os_theme(theme: AppliedThemes) {
    this.#os_theme = theme;
    if (THEME.ok() === Themes.System) this.apply_theme(Themes.System);
  }

  /**Resolves the System theme to the theme of the operating system*/
  #applied(theme: Themes): AppliedThemes {
    return theme === Themes.System ? this.#os_theme : theme;
  }

  /**This applies the current theme to a document*/
  #apply_all_to_doc(doc: Document) {
    this.#apply_scrollbar_to_doc(doc, SCROLLBAR_MODE.ok());
    this.#apply_theme_to_doc(doc, THEME.ok());
    this.#apply_input_to_doc(doc, INPUT_MODE.ok());
    this.#apply_scale_to_doc(doc, SCALE.ok() / 100);
    this.#apply_animation_level_to_doc(doc, ANIMATION_LEVEL.ok());
    this.#apply_animation_speed_to_doc(doc, ANIMATION_SPEED.ok());
  }

  /**This applies the current theme to a document*/
  apply_scrollbar(scroll: ScrollbarModes) {
    this.#for_documents((doc) => {
      this.#apply_scrollbar_to_doc(doc, scroll);
    });
  }
  #apply_scrollbar_to_doc(doc: Document, scroll: ScrollbarModes) {
    doc.documentElement.style.setProperty(
      "--scrollbar",
      {
        [ScrollbarModes.Thin]: "0.6rem",
        [ScrollbarModes.Medium]: "1rem",
        [ScrollbarModes.Wide]: "2.6rem",
      }[scroll],
    );
  }

  /**This applies the current theme to a document*/
  apply_animation_level(anim: AnimationLevels) {
    this.#for_documents((doc) => {
      this.#apply_animation_level_to_doc(doc, anim);
    });
  }
  #apply_animation_level_to_doc(doc: Document, anim: AnimationLevels) {
    doc.documentElement.classList.remove("anim-all", "anim-some");
    switch (anim) {
      case AnimationLevels.All:
        doc.documentElement.classList.add("anim-all");
        doc.documentElement.classList.add("anim-some");
        break;
      case AnimationLevels.Some:
        doc.documentElement.classList.add("anim-some");
        break;
    }
  }

  /**This applies the current theme to a document*/
  apply_animation_speed(speed: number) {
    this.#for_documents((doc) => {
      this.#apply_animation_speed_to_doc(doc, speed);
    });
  }
  #apply_animation_speed_to_doc(doc: Document, speed: number) {
    const style = doc.documentElement.style;
    style.setProperty("--animation-speed", speed.toString() + "ms");
  }

  /**This applies the current theme to a document*/
  apply_theme(theme: Themes) {
    this.#for_documents((doc) => {
      this.#apply_theme_to_doc(doc, theme);
    });
  }
  #apply_theme_to_doc(doc: Document, theme: Themes) {
    const applied = this.#applied(theme);
    for (const key in BOTTOM_GROUPS)
      BOTTOM_GROUPS[key].apply_themes(doc.documentElement.style, applied);
  }

  /**This applies the current scale to a document*/
  apply_scale(scale: number) {
    this.#for_documents((doc) => {
      this.#apply_scale_to_doc(doc, scale);
    });
  }
  #apply_scale_to_doc(doc: Document, scale: number) {
    doc.documentElement.style.fontSize = scale * 16 + "px";
  }

  /**Auto Input Mode */
  apply_input(mode: InputModes) {
    this.#for_documents((doc) => {
      this.#apply_input_to_doc(doc, mode);
    });
  }
  #apply_input_to_doc(doc: Document, mode: InputModes) {
    const style = doc.documentElement.style;
    style.setProperty("--mouse", "0");
    style.setProperty("--pen", "0");
    style.setProperty("--touch", "0");
    doc.documentElement.classList.remove("mouse", "pen", "touch");
    switch (mode) {
      case InputModes.Mouse:
        style.setProperty("--mouse", "1");
        doc.documentElement.classList.add("mouse");
        break;
      case InputModes.Pen:
        style.setProperty("--pen", "1");
        doc.documentElement.classList.add("pen");
        break;
      case InputModes.Touch:
        style.setProperty("--touch", "1");
        doc.documentElement.classList.add("touch");
        break;
    }
  }

  apply_single_property(key: string, variable: { [s: string]: string }) {
    const theme_buff = this.#applied(THEME.ok());
    this.#for_documents((doc) => {
      doc.documentElement.style.setProperty(key, variable[theme_buff]);
    });
  }
}

export const theme_engine = new ThemeEngine();

THEME.sub((val) => {
  theme_engine.apply_theme(val.value);
});
/**Size of a rem in pixels at the current scale, set right away from the stored scale*/
let scale_rem = 16;
SCALE.sub((val) => {
  const scale_value = val.value / 100;
  scale_rem = scale_value * 16;
  theme_engine.apply_scale(scale_value);
}, true);
/**Converts the given rems to pixels */
export function rem_to_px(rem: number) {
  return rem * scale_rem;
}
/**Converts the given pixels to rems */
export function px_to_rem(px: number) {
  return px / scale_rem;
}
SCROLLBAR_MODE.sub((val) => {
  theme_engine.apply_scrollbar(val.value);
});
INPUT_MODE.sub((val) => {
  theme_engine.apply_input(val.value);
});
ANIMATION_LEVEL.sub((val) => {
  theme_engine.apply_animation_level(val.value);
});
ANIMATION_SPEED.sub((val) => {
  theme_engine.apply_animation_speed(val.value);
});
