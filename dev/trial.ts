//Runs inside the shell's iframe, applies the options from the shell and loads one page.
//Everything the libraries do to the document stays in this frame, away from the shell.
import "./trial.css";

const PAGES = import.meta.glob("./pages/**/*.ts");
const params = new URLSearchParams(location.search);
const page = params.get("page") ?? "";
const SCROLL_KEY = "dev-scroll:" + page;
document.title = page;

function show_error(what: string, error?: unknown) {
  if (error !== undefined) console.error(error);
  const box = document.body.appendChild(document.createElement("pre"));
  box.className = "dev-error";
  box.textContent =
    what +
    (error === undefined
      ? ""
      : "\n\n" +
        (error instanceof Error
          ? (error.stack ?? error.message)
          : String(error)));
}

/**Returns the value if it is one of the allowed values*/
const one_of = <T>(values: { [key: string]: T }, value: unknown) =>
  Object.values(values).find((v) => v === value);

/**Writes theme, input mode and scale to the library, stays a no-op if the theme module failed to load*/
let apply_library = async (_options: URLSearchParams) => {};

//Loaded dynamically, so a broken theme module still lets the page show
try {
  const t = await import("@chocbite/ts-lib-ui/theme");
  t.theme_init();
  apply_library = async (options) => {
    const theme = one_of(t.Themes, options.get("theme"));
    if (theme) await t.THEME.write(theme);
    const input = one_of(t.InputModes, options.get("input"));
    if (input) await t.INPUT_MODE.write(input);
    const scale = Number(options.get("scale"));
    if (scale) await t.SCALE.write(scale);
  };
} catch (error) {
  show_error("Loading the theme failed", error);
}

async function apply(options: URLSearchParams) {
  //The library leaves page colors to the app, this stands in for the app
  document.documentElement.dataset.devTheme = options.get("theme") ?? "light";
  try {
    await apply_library(options);
  } catch (error) {
    show_error("Applying the theme failed", error);
  }
}
await apply(params);

//The shell sends changed options while the page runs, so they apply without a reload.
//The url is updated too, so reloading the frame keeps them.
window.addEventListener(
  "message",
  (e: MessageEvent<{ [key: string]: string }>) => {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    for (const [key, value] of Object.entries(e.data)) params.set(key, value);
    history.replaceState(null, "", "?" + params.toString());
    apply(params);
  },
);

const load = PAGES[`./pages/${page}.ts`];
if (!load) show_error(`No page "${page}" in dev/pages`);
else {
  try {
    await load();
  } catch (error) {
    show_error(`Loading page "${page}" failed`, error);
  }
  const [x, y] = (localStorage.getItem(SCROLL_KEY) ?? "0,0")
    .split(",")
    .map(Number);
  requestAnimationFrame(() => window.scrollTo(x, y));
  window.addEventListener("pagehide", () =>
    localStorage.setItem(SCROLL_KEY, `${window.scrollX},${window.scrollY}`),
  );
}
