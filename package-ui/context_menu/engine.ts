import { DOCUMENT_HANDLER } from "#document";
import type { Option } from "@chocbite/ts-lib/result";
import { Container } from "./container";
import type { ContextMenu } from "./menu";

export const CONTEXT_MENU_SYMBOL = Symbol("context_menu");

declare global {
  interface Document {
    [CONTEXT_MENU_SYMBOL]: Container | undefined;
  }
  interface Element {
    [CONTEXT_MENU_SYMBOL]: EventListenerOrEventListenerObject | undefined;
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
  doc[CONTEXT_MENU_SYMBOL] = container;
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
  if (element[CONTEXT_MENU_SYMBOL]) context_menu_detach(element);
  const listener = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (block && block()) return;
    const lineses =
      typeof lines === "function" ? lines().unwrap_or(undefined) : lines;
    if (!lineses) return;
    context_menu_summon(lineses, {
      element,
      x: (e as MouseEvent).clientX,
      y: (e as MouseEvent).clientY,
    });
  };
  element.addEventListener("contextmenu", listener);
  element[CONTEXT_MENU_SYMBOL] = listener;
}

/**Dettaches the context menu from the given element */
export function context_menu_detach(element: Element) {
  if (element[CONTEXT_MENU_SYMBOL]) {
    element.removeEventListener("contextmenu", element[CONTEXT_MENU_SYMBOL]);
    delete element[CONTEXT_MENU_SYMBOL];
  }
}

/**Where ctm.summon opens a menu*/
export interface ContextMenuSummonOptions {
  /**Element the menu belongs to, it opens in the document of the element, without it in the main document*/
  element?: Element;
  /**Position of the menu, without both x and y the menu opens at the middle of the element, or the top left corner without an element*/
  x?: number;
  y?: number;
  /**Places the menu beside the element instead of covering it*/
  dont_cover?: boolean;
}

/**Opens a menu, see ContextMenuSummonOptions for where*/
export function context_menu_summon(
  menu: ContextMenu,
  options: ContextMenuSummonOptions = {},
) {
  const { element, dont_cover } = options;
  let { x, y } = options;
  const container = element
    ? element.ownerDocument[CONTEXT_MENU_SYMBOL]
    : DOCUMENT_HANDLER.main[CONTEXT_MENU_SYMBOL];
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
