# @chocbite/ts-lib-ui/document

Keeps track of the documents the library works in, the page itself and windows the app opens, so the theme, context menus and the virtual keyboard reach every one of them.

```ts
import { DOCUMENT_HANDLER } from "@chocbite/ts-lib-ui/document";

const popup = window.open("", "", "width=600,height=400")!;
DOCUMENT_HANDLER.register_document(popup.document, true);
popup.addEventListener("pagehide", () => DOCUMENT_HANDLER.deregister_document(popup.document));
```

`DOCUMENT_HANDLER` is the one handler of the app, made at import with the page as its main document.

- **`register_document(document, styles?)`** adds a document, like the document of a window from `window.open`. With `styles` true it copies the stylesheet links and style tags of the main document into it, so the elements look the same there.
- **`deregister_document(document)`** removes it again, the main document can not be removed.
- **`main`** is the main document, **`documents`** all documents, and **`for_documents(func)`** calls a function for each.
- **`events`** fires `added` and `removed` with the document as `data`, for code that has to set something up in every document:

```ts
DOCUMENT_HANDLER.for_documents((doc) => doc.addEventListener("keydown", on_key));
DOCUMENT_HANDLER.events.on("added", (e) => e.data.addEventListener("keydown", on_key));
```
