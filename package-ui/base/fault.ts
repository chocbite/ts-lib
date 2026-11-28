import { GREY, ORANGE } from "@chocbite/ts-lib/colors";
import type { NiceError } from "@chocbite/ts-lib/result";
import { DOCUMENT_HANDLER } from "#document";
import { theme_init_variable_root } from "#theme";
import "./fault.scss";

//Fault icon of Base, an element shows the icon while it has faults, the icon opens a prompt listing them.
//Base keeps the faults, this file only knows an icon and how to get the faults of its element,
//it can not import base.ts, which imports it

const theme_root = theme_init_variable_root(
  "base",
  "Base",
  "Theme variables shared by all elements",
);
const colors = theme_root.make_sub_group(
  "fault",
  "Fault",
  "The icon an element shows while it has a problem",
);
colors.make_variable("icon", "Icon", "Color of the glyph of the fault icon", GREY[900], GREY[900], "Color", undefined);
colors.make_variable(
  "iconBackground",
  "Icon Background",
  "Background of the fault icon, so it stands out on the element",
  ORANGE[500],
  ORANGE[500],
  "Color",
  undefined,
);
colors.make_variable("iconOutline", "Icon Outline", "Outline of the fault icon, so it stands out on orange elements too", GREY[900], GREY[900], "Color", undefined);

/**The icon, a glyph of the icon font drawn by its css, the faults of its element are found through faults_of*/
class FaultIcon extends HTMLElement {}
customElements.define("base-fault", FaultIcon);

/**How each icon gets the faults of its element, set by Base when it makes the icon*/
const faults_of = new WeakMap<Element, () => readonly NiceError[]>();

/**Makes the icon for an element, faults gives the faults of the element when the icon is clicked*/
export function fault_icon(faults: () => readonly NiceError[]): Element {
  const icon = new FaultIcon();
  faults_of.set(icon, faults);
  return icon;
}

/**The fault icon an event happened on, undefined for everything else*/
const icon_of = (event: Event): Element | undefined => {
  const target = event.target;
  return target instanceof Element ? (target.closest("base-fault") ?? undefined) : undefined;
};

//One listener for every icon in each document, in the capture phase so the element under the icon never gets the event
const swallow = (event: Event) => {
  if (!icon_of(event)) return;
  event.stopPropagation();
  event.preventDefault();
};
const click = (event: Event) => {
  const icon = icon_of(event);
  if (!icon) return;
  event.stopPropagation();
  event.preventDefault();
  const faults = faults_of.get(icon)?.();
  //Loaded when clicked, prompts builds on elements that extend Base, so base can not import it while loading.
  //The prompt opens in the document of the icon, like a browser window of the page
  if (faults?.length) void import("#prompts").then(({ prompts }) => prompts.faults(faults, { owner: icon }));
};
const listen = (doc: Document) => {
  doc.addEventListener("pointerdown", swallow, { capture: true });
  doc.addEventListener("mousedown", swallow, { capture: true });
  doc.addEventListener("click", click, { capture: true });
};
DOCUMENT_HANDLER.for_documents(listen);
DOCUMENT_HANDLER.events.on("added", (e) => listen(e.data));
