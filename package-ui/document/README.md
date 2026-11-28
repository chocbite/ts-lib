# @chocbite/ts-lib-ui/document

Keeps track of the documents the library works in, the page itself and windows the app opens, so the theme, context menus and the virtual keyboard reach every one of them.

```ts
import { DOCUMENT_HANDLER } from "@chocbite/ts-lib-ui/document";

const popup = window.open("", "", "width=600,height=400")!;
DOCUMENT_HANDLER.register_document(popup.document, true);
```

`DOCUMENT_HANDLER` is the one handler of the app, made at import with the page as its main document.

- **`register_document(document, styles?)`** adds a document, like the document of a window from `window.open`. With `styles` true it copies the stylesheet links and style tags of the main document into it, so the elements look the same there.
- **`deregister_document(document)`** removes it again, the main document can not be removed.

The handler watches the window of every document it has, other than the main one. When the window closes, the document is removed. When the window loads a new document, like when the user refreshes it, the new document is added in its place, with the styles when the old one got them, `replaced` fires, then the old document is removed. The browser tells which of the two happened a moment after the page goes away, so they come a few milliseconds later, after `leaving`, which fires while the page goes away. The browser takes the event listeners off the elements left in the page once it is gone, so code that wants to keep its elements takes them out on `leaving`, like into a fragment of the main document, and puts them in the new document on `replaced`.
- **`main`** is the main document, **`documents`** all documents, and **`for_documents(func)`** calls a function for each.
- **`events`** fires `added` and `removed` with the document as `data`, for code that has to set something up in every document, `leaving` with the document whose page goes away, and `replaced` with `{ from, to }`, for code that moves what it put in the old document into the new one:

```ts
DOCUMENT_HANDLER.for_documents((doc) => doc.addEventListener("keydown", on_key));
DOCUMENT_HANDLER.events.on("added", (e) => e.data.addEventListener("keydown", on_key));
const kept = DOCUMENT_HANDLER.main.createDocumentFragment();
DOCUMENT_HANDLER.events.on("leaving", (e) => kept.append(...mine_in(e.data)));
DOCUMENT_HANDLER.events.on("replaced", (e) => e.data.to.body.append(kept));
```
