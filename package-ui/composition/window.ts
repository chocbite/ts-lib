import { Base, define_element, input_key, type InputOf } from "#base";
import { DOCUMENT_HANDLER } from "#document";
import type { SVGFunc } from "#svg";
import { CONTENT_CREATE, type ContentBase } from "./content";
import "./window.scss";

/**Where a window is on the screen in px, the top left corner of its frame and the size of its page
 * left and top are undefined where the browser does not tell where windows are, like on Wayland*/
export interface WindowPlace {
  left?: number;
  top?: number;
  width: number;
  height: number;
}

//Internal to this module, between the window and what opened it
export const WINDOW_CLOSED = Symbol("window_closed");
export const WINDOW_LEAVING = Symbol("window_leaving");
export const WINDOW_CONTENT_CLOSED = Symbol("window_content_closed");

/**What opened a window, as the window sees it*/
export interface WindowHost {
  /**The user closed the window, its content and the panels in it are still there, place is where the window was*/
  [WINDOW_CLOSED](place: WindowPlace): void;
  /**The page is going away and the window closes with it, place is where the window is*/
  [WINDOW_LEAVING](place: WindowPlace): void;
  /**The content in the window closed itself*/
  [WINDOW_CONTENT_CLOSED](): void;
}

/**Inputs of the content the window follows, inner inputs that are not options*/
const WINDOW_CONTENT = {
  title: input_key<InputOf<typeof CONTENT_CREATE.title>>(),
  icon: input_key<InputOf<typeof CONTENT_CREATE.icon>>(),
};

/**Windows that are open, closed with the page that opened them, their contents live in it*/
const OPEN = new Set<ContentWindow>();
DOCUMENT_HANDLER.main.defaultView?.addEventListener("pagehide", () => {
  for (const open of [...OPEN]) open.leave();
});

/**Opens of windows the browser blocked without a click or key press of the user, in the order they waited,
 * each click or key press in a document of the page runs the first, browsers open one window for each*/
const WAITING: (() => void)[] = [];
const interaction = () => WAITING.shift()?.();
const listen = (doc: Document) => {
  doc.addEventListener("pointerdown", interaction, { capture: true });
  doc.addEventListener("keydown", interaction, { capture: true });
};
DOCUMENT_HANDLER.for_documents(listen);
DOCUMENT_HANDLER.events.on("added", (e) => listen(e.data));

/**Runs the open on a coming click or key press of the user, after the ones waiting before it, gives a function that stops it waiting*/
export function open_on_interaction(open: () => void): () => void {
  WAITING.push(open);
  return () => {
    const index = WAITING.indexOf(open);
    if (index !== -1) WAITING.splice(index, 1);
  };
}

/**Whether the page has a click or key press of the user to open a window with, true where the browser does not tell*/
export function user_active(): boolean {
  const navigator = DOCUMENT_HANDLER.main.defaultView?.navigator as
    { userActivation?: { isActive: boolean } } | undefined;
  return navigator?.userActivation?.isActive ?? true;
}

/**Fills the page of a browser window with a content, the title and icon of the content are the title and icon of the window
 * The document handler tells when the window closed, or was refreshed and has a new document, which the window then fills again*/
class ContentWindow extends Base {
  static element_name() {
    return "window";
  }
  static element_name_space() {
    return "composition";
  }

  //Registered when the module loads, before the panel container listens, so a closed window takes back its panels before
  //the container gives the rest to the main document
  static {
    DOCUMENT_HANDLER.events.on("leaving", (e) => {
      for (const open of OPEN) if (open.#document === e.data) open.#hold();
    });
    DOCUMENT_HANDLER.events.on("replaced", (e) => {
      for (const open of OPEN)
        if (open.#document === e.data.from) open.#replaced(e.data.to);
    });
    DOCUMENT_HANDLER.events.on("removed", (e) => {
      for (const open of [...OPEN])
        if (open.#document === e.data) open.#closed();
    });
  }

  readonly #content: ContentBase;
  readonly #popup: Window;
  readonly #host: WindowHost;
  /**The document the window shows, a new one after a refresh*/
  #document: Document;
  /**Where the window was when its page last went away, the browser does not tell after it closed*/
  #place: WindowPlace;
  #title = "";
  #icon?: SVGFunc;
  #icon_link?: HTMLLinkElement;

  /**@param content what the window shows
   * @param popup the browser window, its document registered with the document handler
   * @param host what opened the window*/
  constructor(content: ContentBase, popup: Window, host: WindowHost) {
    super();
    this.#content = content;
    this.#popup = popup;
    this.#host = host;
    this.#document = popup.document;
    this.#place = place_of(popup);
    this.appendChild(content);
    this.addEventListener("content_closed", (e) => {
      e.stopPropagation();
      this.#host[WINDOW_CONTENT_CLOSED]();
    });
    this.set_input(WINDOW_CONTENT.title, content.content_title, (title) => {
      this.#title = title.ok ? title.value : "⚠ " + title.error.nice;
      this.#show_title();
    });
    this.set_input(WINDOW_CONTENT.icon, content.content_icon, (icon) => {
      this.#icon = icon.ok ? icon.value : undefined;
      this.#show_icon();
    });
  }

  /**Content the window shows*/
  get content(): ContentBase {
    return this.#content;
  }

  /**Document of the window, panels opened from its content are shown in its panel container*/
  get document(): Document {
    return this.#document;
  }

  /**Where the window is*/
  place(): WindowPlace {
    return place_of(this.#popup);
  }

  /**Closes the window, what is in it stays there unless it was taken out first*/
  close(): void {
    this.#forget();
    this.#popup.close();
  }

  /**Closes the window as the page goes away, telling where it was*/
  leave(): void {
    this.#host[WINDOW_LEAVING](this.place());
    this.close();
  }

  /**The page of the window goes away, the window keeps out of it with the content, the browser takes the event listeners
   * off what is left in it, it goes into the new page of a refreshed window or the content back to what opened it*/
  #hold(): void {
    this.#place = place_of(this.#popup);
    DOCUMENT_HANDLER.main.createDocumentFragment().append(this);
  }

  /**The window was refreshed, the new document gets the content, the panels are moved by their container*/
  #replaced(document: Document): void {
    this.#document = document;
    this.#icon_link = undefined;
    document.body.appendChild(this);
    this.#show_title();
    this.#show_icon();
  }

  /**The user closed the window, what opened it takes back what is in it before the panel container of the document goes*/
  #closed(): void {
    OPEN.delete(this);
    this.#host[WINDOW_CLOSED](this.#place);
  }

  #forget(): void {
    OPEN.delete(this);
    if (DOCUMENT_HANDLER.documents.includes(this.#document))
      DOCUMENT_HANDLER.deregister_document(this.#document);
  }

  #show_title(): void {
    this.#document.title = this.#title;
  }

  /**The icon of the content as the icon of the window, its tab and task bar entry*/
  #show_icon(): void {
    const doc = this.#document;
    if (!this.#icon) {
      this.#icon_link?.remove();
      this.#icon_link = undefined;
      return;
    }
    this.#icon_link ??= doc.head.appendChild(doc.createElement("link"));
    this.#icon_link.rel = "icon";
    this.#icon_link.href =
      "data:image/svg+xml," +
      encodeURIComponent(new XMLSerializer().serializeToString(this.#icon()));
  }
}
define_element(ContentWindow);

export type { ContentWindow };

/**Where the page of the window starts on the screen in px, the frame of the window is taken as a border
 * of the same width at the sides and the bottom, the rest of it is at the top*/
export function page_on_screen(view: Window): { left: number; top: number } {
  const border = Math.max(0, (view.outerWidth - view.innerWidth) / 2);
  return {
    left: view.screenX + border,
    top:
      view.screenY + Math.max(0, view.outerHeight - view.innerHeight - border),
  };
}

/**Where the window is, without left and top when the browser gives every window the same place, as it does where it can not tell*/
function place_of(popup: Window): WindowPlace {
  const opener = DOCUMENT_HANDLER.main.defaultView;
  const unknown =
    popup.screenX === 0 &&
    popup.screenY === 0 &&
    opener?.screenX === 0 &&
    opener.screenY === 0;
  return {
    left: unknown ? undefined : popup.screenX,
    top: unknown ? undefined : popup.screenY,
    width: popup.innerWidth,
    height: popup.innerHeight,
  };
}

/**Opens a browser window showing the content, from the main page, so it closes with it,
 * at the place on the screen with the size of the place for its page, undefined when the browser blocks the window,
 * which it does without a click or key press of the user, unless the site may open popups*/
export function content_window(
  content: ContentBase,
  place: WindowPlace,
  host: WindowHost,
): ContentWindow | undefined {
  const features = [
    "popup",
    `width=${Math.round(place.width)}`,
    `height=${Math.round(place.height)}`,
  ];
  if (place.left !== undefined) features.push(`left=${Math.round(place.left)}`);
  if (place.top !== undefined) features.push(`top=${Math.round(place.top)}`);
  const popup = DOCUMENT_HANDLER.main.defaultView?.open(
    "",
    "",
    features.join(","),
  );
  if (!popup) return undefined;
  DOCUMENT_HANDLER.register_document(popup.document, true);
  const made = ContentWindow.create({}, content, popup, host);
  popup.document.body.appendChild(made);
  OPEN.add(made);
  return made;
}
