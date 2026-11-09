import { DOCUMENT_HANDLER } from "#document";
import type { Option } from "@chocbite/ts-lib/result";
import { Container } from "./container";
import "./engine.scss";
import { ContextMenu } from "./menu";

export const CONTEXT_MENY_SYMBOL = Symbol("context_menu");

declare global {
  interface Document {
    [CONTEXT_MENY_SYMBOL]: Container | undefined;
  }
  interface Element {
    [CONTEXT_MENY_SYMBOL]: EventListenerOrEventListenerObject | undefined;
  }
}

/**Default context menu, false blocks the operating system context menu, undefined leaves it*/
let default_menu: ContextMenu | (() => Option<ContextMenu>) | false | undefined;

/**Blocks the operating system context menu when the default is false*/
const block_os_menu = (e: Event) => e.preventDefault();

DOCUMENT_HANDLER.events.on("added", (e) => {
  apply_to_doc(e.data);
});
DOCUMENT_HANDLER.for_documents((doc) => {
  apply_to_doc(doc);
});

function apply_to_doc(doc: Document) {
  const container = new Container();
  doc[CONTEXT_MENY_SYMBOL] = container;
  doc.documentElement.appendChild(container);
  apply_default_to_doc(doc);
}

/**Applies the current default context menu to a document*/
function apply_default_to_doc(doc: Document) {
  const root = doc.documentElement;
  context_menu_detach(root);
  root.removeEventListener("contextmenu", block_os_menu);
  if (default_menu) context_menu_attach(root, default_menu);
  else if (default_menu === false)
    root.addEventListener("contextmenu", block_os_menu);
}

/**Attaches a context menu to the given element
 * @param element the element to attach the context menu to
 * @param lines the context menu to attach, if a function is given it will be called when the context menu is summoned
 * @param block a function that returns true if the context menu should not be summoned, if undefined the context menu will always be summoned*/
export function context_menu_attach(
  element: Element,
  lines: ContextMenu | (() => Option<ContextMenu>),
  block?: () => boolean,
) {
  if (element[CONTEXT_MENY_SYMBOL]) context_menu_detach(element);
  const listener = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (block && block()) return;
    const lineses =
      typeof lines === "function" ? lines().unwrap_or(undefined) : lines;
    if (!lineses) return;
    context_menu_summon(
      lineses,
      element,
      (e as MouseEvent).clientX,
      (e as MouseEvent).clientY,
    );
  };
  element.addEventListener("contextmenu", listener);
  element[CONTEXT_MENY_SYMBOL] = listener;
}

/**Dettaches the context menu from the given element */
export function context_menu_detach(element: Element) {
  if (element[CONTEXT_MENY_SYMBOL]) {
    element.removeEventListener("contextmenu", element[CONTEXT_MENY_SYMBOL]);
    delete element[CONTEXT_MENY_SYMBOL];
  }
}

/**Summons a context menu at a given location
 * @param menu the context menu to summon
 * @param element the element the context menu is referenced to, if undefined the context menu will appear in the main document
 * @param x x position for context menu, if undefined, will use element middle, if element undefined, will put context menu in the top left corner of the screen
 * @param y y position for context menu, if undefined, will use element middle, if element undefined, will put context menu in the top left corner of the screen
 * @param dont_cover when set true */
export function context_menu_summon(
  menu: ContextMenu,
  element?: Element,
  x?: number,
  y?: number,
  dont_cover?: boolean,
) {
  const container = element
    ? element.ownerDocument[CONTEXT_MENY_SYMBOL]
    : DOCUMENT_HANDLER.main[CONTEXT_MENY_SYMBOL];
  if (container) {
    if (typeof x !== "number" || typeof y !== "number") {
      if (element) {
        const box = element.getBoundingClientRect();
        x = box.left + box.width / 2;
        y = box.top + box.height / 2;
      } else {
        x = 0;
        y = 0;
      }
    }
    container
      .attach_menu(menu)
      .set_position(x, y, dont_cover ? element : undefined);
  } else console.error("No context menu container available");
}

/**Sets the default context menu for the page, the one used if no other context menu has been attached to the element
 * If set to false the operating system context menu is disabled and nothing will appear
 * If set undefined the operating systems context menu will be used*/
export function context_menu_default(
  lines: ContextMenu | (() => Option<ContextMenu>) | false | undefined,
) {
  default_menu = lines;
  DOCUMENT_HANDLER.for_documents(apply_default_to_doc);
}
