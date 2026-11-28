import { EventHandler } from "@chocbite/ts-lib/event";

interface DocumentHandlerEvents {
  /**Fired when document is added*/
  added: Document;
  /**Fired when document is removed*/
  removed: Document;
  /**Fired while the page of the window of a document goes away, the window closes or loads a new document, which removed or
   * replaced tells a moment later. The browser takes the event listeners off the elements left in the page once it is gone,
   * so elements that should outlive it are taken out now, like into a fragment of the main document*/
  leaving: Document;
  /**Fired when the window of a document loaded a new document, like when the user refreshed it,
   * after added for the new document and before removed for the old one, so what was in the old document can be moved over*/
  replaced: { from: Document; to: Document };
}

/**How often and how many times the window of a document whose page went away is checked, the browser tells whether it closed
 * or loaded a new document a moment after*/
const CHECK_INTERVAL = 20;
const CHECKS = 500;

class DocumentHandler {
  /**Stores all managed documents */
  #documents: Set<Document> = new Set();
  /**Whether the styles of the main document were copied into the document, a new document of its window gets them too*/
  #styles = new WeakMap<Document, boolean>();
  /**Stores the main docuement of the manager */
  readonly main: Document;
  /**Event handler */
  #events: EventHandler<DocumentHandlerEvents, this> = new EventHandler(this);
  /**Manager events */
  readonly events = this.#events.consumer;

  constructor(main_document: Document) {
    this.main = main_document;
    this.#documents.add(main_document);
  }

  /**Itterates a function over all existing documents */
  for_documents(func: (document: Document) => void) {
    for (const doc of this.#documents) {
      func(doc);
    }
  }

  get documents() {
    return [...this.#documents];
  }

  /**Registers a document with the theme engine, which will be updated with
   * The window of the document is watched, when it closes the document is removed, and when it loads a new document,
   * like when the user refreshes it, the new document is registered in its place, see the replaced event
   * @param document document to register
   * @param styles copies all style from main document if set true */
  register_document(document: Document, styles?: boolean) {
    if (this.#documents.has(document))
      return console.error("Document already registered");
    this.#documents.add(document);
    this.#styles.set(document, !!styles);
    this.#watch(document);
    if (styles) {
      const head_elements = this.main.head.children;
      for (let i = 0; i < head_elements.length; i++) {
        switch (head_elements[i].nodeName) {
          case "LINK":
            //Built apps load their css through a stylesheet link
            if ((head_elements[i] as HTMLLinkElement).rel === "stylesheet")
              document.head.appendChild(head_elements[i].cloneNode(true));
            break;
          case "STYLE":
            document.head.appendChild(head_elements[i].cloneNode(true));
            break;
        }
      }
    }
    this.#events.emit("added", document);
  }

  /**When the page of the window of the document goes away, the window closed or is loading a new document,
   * the browser tells which a moment later, so the window is checked until one of them is seen*/
  #watch(document: Document): void {
    const view = document.defaultView;
    if (!view || document === this.main) return;
    view.addEventListener(
      "pagehide",
      () => {
        if (!this.#documents.has(document)) return;
        this.#events.emit("leaving", document);
        let checks = 0;
        const check = () => {
          if (!this.#documents.has(document)) return;
          const next = loaded(view);
          if (next === null || ++checks > CHECKS)
            return this.deregister_document(document);
          if (next && next !== document) return this.#replace(document, next);
          setTimeout(check, CHECK_INTERVAL);
        };
        setTimeout(check, CHECK_INTERVAL);
      },
      { once: true },
    );
  }

  /**Registers the new document of the window in the place of the old one*/
  #replace(from: Document, to: Document): void {
    this.register_document(to, this.#styles.get(from));
    this.#events.emit("replaced", { from, to });
    this.deregister_document(from);
  }

  /**Registers a document with the theme engine, which will be updated with */
  deregister_document(document: Document) {
    if (!this.#documents.has(document))
      return console.error("Document not registered");
    if (document === this.main)
      return console.error("Main document cannot be removed");
    this.#documents.delete(document);
    this.#events.emit("removed", document);
  }
}

export const DOCUMENT_HANDLER = new DocumentHandler(document);

/**The document the window shows once it is loaded, undefined while it loads, null when the window closed,
 * or shows a page of another site, whose document can not be reached*/
function loaded(view: Window): Document | null | undefined {
  try {
    if (view.closed) return null;
    const doc = view.document;
    return doc.readyState === "loading" ? undefined : doc;
  } catch {
    return null;
  }
}
