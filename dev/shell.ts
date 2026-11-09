//The shell must never import from the libraries, so it keeps working while they are being trialed.
//It only lists the pages and passes the chosen options to the trial frame, which does the rest.

const STORAGE_KEY = "dev-shell";

/**Page ids like "ui/list", from the files in pages, the pages are only loaded by the trial frame.
 * Sorted by folder first, so each folder is one group in the list*/
const PAGES = Object.keys(import.meta.glob("./pages/**/*.ts"))
  .map((path) => path.slice("./pages/".length, -".ts".length))
  .sort((a, b) => {
    const folder = (page: string) => page.slice(0, page.lastIndexOf("/") + 1);
    return folder(a).localeCompare(folder(b)) || a.localeCompare(b);
  });

const THEMES = { light: "Light", dark: "Dark" };
const INPUTS = { mouse: "Mouse", pen: "Pen", touch: "Touch" };
const SCALES = { 75: "75%", 100: "100%", 125: "125%", 150: "150%", 200: "200%" };
const SIZES = {
  fill: "Fill",
  "800x480": "800 × 480",
  "1024x600": "1024 × 600",
  "1280x800": "1280 × 800",
  "1920x1080": "1920 × 1080",
};

interface ShellState {
  page: string | undefined;
  theme: string;
  input: string;
  scale: string;
  size: string;
  sidebar: boolean;
}

const state: ShellState = {
  page: undefined,
  theme: "light",
  input: "mouse",
  scale: "100",
  size: "fill",
  sidebar: true,
};
try {
  Object.assign(state, JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
} catch {
  //Broken stored state, start from the defaults
}
if (!state.page || !PAGES.includes(state.page)) state.page = PAGES[0];

const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

const by_id = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const frame = by_id<HTMLIFrameElement>("frame");
const stage = by_id<HTMLElement>("stage");
const pages_list = by_id<HTMLDivElement>("pages");
const filter = by_id<HTMLInputElement>("filter");
const title = by_id<HTMLSpanElement>("title");
const open = by_id<HTMLAnchorElement>("open");

const trial_url = (page: string) =>
  "trial.html?" +
  new URLSearchParams({
    page,
    theme: state.theme,
    input: state.input,
    scale: state.scale,
  }).toString();

/**Loads the selected page in the frame, which reloads it*/
function load_frame() {
  title.textContent = state.page ?? "No pages, add one to dev/pages";
  if (!state.page) return;
  const url = trial_url(state.page);
  frame.src = url;
  open.href = url;
}

function apply_size() {
  const [width, height] = state.size.split("x");
  stage.classList.toggle("sized", state.size !== "fill");
  frame.style.width = height ? width + "px" : "";
  frame.style.height = height ? height + "px" : "";
}

function render_pages() {
  const text = filter.value.toLowerCase();
  pages_list.replaceChildren();
  let group: string | undefined;
  for (const page of PAGES) {
    if (!page.toLowerCase().includes(text)) continue;
    const slash = page.lastIndexOf("/");
    const page_group = slash === -1 ? "" : page.slice(0, slash);
    if (page_group !== group) {
      group = page_group;
      pages_list.appendChild(document.createElement("h2")).textContent = group;
    }
    const link = pages_list.appendChild(document.createElement("a"));
    link.textContent = page.slice(slash + 1);
    //Middle click opens the trial in its own tab
    link.href = trial_url(page);
    link.classList.toggle("selected", page === state.page);
    link.onclick = (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      state.page = page;
      save();
      render_pages();
      load_frame();
    };
  }
}

/**Fills a select with options and keeps the state key in sync with it*/
function bind_select(
  id: string,
  options: { [value: string]: string },
  key: "theme" | "input" | "scale" | "size",
  changed: () => void,
) {
  const select = by_id<HTMLSelectElement>(id);
  for (const [value, text] of Object.entries(options)) {
    const option = select.appendChild(document.createElement("option"));
    option.value = value;
    option.textContent = text;
  }
  if (!(state[key] in options)) state[key] = Object.keys(options)[0];
  select.value = state[key];
  select.onchange = () => {
    state[key] = select.value;
    save();
    changed();
  };
}

/**Sends changed options to the frame, which applies them without reloading*/
const update_frame = () => {
  render_pages();
  if (state.page) open.href = trial_url(state.page);
  frame.contentWindow?.postMessage(
    { theme: state.theme, input: state.input, scale: state.scale },
    location.origin,
  );
};
bind_select("theme", THEMES, "theme", update_frame);
bind_select("input", INPUTS, "input", update_frame);
bind_select("scale", SCALES, "scale", update_frame);
bind_select("size", SIZES, "size", apply_size);

by_id("reload").onclick = () => frame.contentWindow?.location.reload();
by_id("toggle-sidebar").onclick = () => {
  state.sidebar = !state.sidebar;
  document.body.classList.toggle("no-sidebar", !state.sidebar);
  save();
};
document.body.classList.toggle("no-sidebar", !state.sidebar);
filter.oninput = render_pages;

apply_size();
render_pages();
load_frame();
