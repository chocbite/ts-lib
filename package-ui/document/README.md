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

The handler watches the window of every document it has, other than the main one. When the window closes, the document is removed. When the window loads a new document, like when the user refreshes it, the new document is added in its place, with the styles when the old one got them, `replaced` fires, then the old document is removed. The browser tells which of the two happened a moment after the page goes away, so they come a few milliseconds later.
- **`main`** is the main document, **`documents`** all documents, and **`for_documents(func)`** calls a function for each.
- **`events`** fires `added` and `removed` with the document as `data`, for code that has to set something up in every document, and `replaced` with `{ from, to }`, for code that moves what it put in the old document into the new one:

```ts
DOCUMENT_HANDLER.for_documents((doc) => doc.addEventListener("keydown", on_key));
DOCUMENT_HANDLER.events.on("added", (e) => e.data.addEventListener("keydown", on_key));
DOCUMENT_HANDLER.events.on("replaced", (e) => move_into(e.data.from, e.data.to));
```
