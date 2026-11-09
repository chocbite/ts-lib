# @chocbite/ts-lib-ui/context-menu

Framework-agnostic TypeScript library for right-click / touch-and-hold context menus built on native Web Components.

## Basic Usage

Import the library and attach a context menu to an element. The CSS is auto-injected on import.

```ts
import ctm from "@chocbite/ts-lib-ui/context-menu";

ctm.attach(
  document.getElementById("editor")!,
  ctm.menu([
    ctm.line("Cut", () => document.execCommand("cut")),
    ctm.line("Copy", () => document.execCommand("copy")),
    ctm.line("Paste", () => document.execCommand("paste")),
  ]),
);
```

Right-click (or long-press) the element to open the menu.

## API

### `ctm.menu(lines)`

Creates a menu panel. `lines` can be a static array, a lazy factory, or a Promise/async factory (shows a spinner while loading).

```ts
// Static array
const menu = ctm.menu([
  ctm.line("Option A", () => console.log("A")),
  ctm.line("Option B", () => console.log("B")),
]);

// Factory — evaluated on every open
const menu = ctm.menu(() => [
  ctm.line("Timestamp", () => console.log(Date.now())),
]);

// Async factory — shows a spinner until the Promise resolves
const menu = ctm.menu(async () => {
  const items = await fetchMenuItems();
  return items.map((item) => ctm.line(item.label, item.action));
});
```

---

### `ctm.line(text, func, icon?, shortcut?, checkmark?)`

Creates a clickable menu item.

```ts
import { material_delete_rounded } from "@chocbite/ts-lib-ui/icons";

ctm.line("Delete", () => deleteFile());
ctm.line("Delete", () => deleteFile(), material_delete_rounded());
ctm.line("Save", () => save(), undefined, "Ctrl+S");
ctm.line("Mute", () => toggleMute(), undefined, undefined, isMuted);
```

---

### `ctm.sub(text, menu, icon?)`

Creates a submenu trigger. Hover (300 ms) or keyboard (→ / Enter / Space) opens the nested menu.

```ts
const colorMenu = ctm.menu([
  ctm.line("Red", () => setColor("red")),
  ctm.line("Green", () => setColor("green")),
  ctm.line("Blue", () => setColor("blue")),
]);

const menu = ctm.menu([
  ctm.line("Copy", () => copy()),
  ctm.sub("Color", colorMenu),
  ctm.line("Delete", () => remove()),
]);
```

---

### `ctm.devider()`

Inserts a horizontal separator.

```ts
const menu = ctm.menu([
  ctm.line("Cut", () => cut()),
  ctm.line("Copy", () => copy()),
  ctm.devider(),
  ctm.line("Delete", () => remove()),
]);
```

---

### `ctm.attach(element, lines, block?)`

Binds a context menu to a DOM element.

```ts
// Static menu
ctm.attach(el, menu);

// Dynamic menu — factory called on each open
import { some, none } from "@chocbite/ts-lib/result";

ctm.attach(el, () =>
  some(
    ctm.menu([
      ctm.line("Edit", () => edit(el)),
      ctm.line("Delete", () => remove(el)),
    ]),
  ),
);

// Conditionally suppress the menu
ctm.attach(el, menu, () => el.dataset.readonly === "true");

// Return None to suppress for a specific open
ctm.attach(el, () => (isLocked(el) ? none() : some(menu)));
```

---

### `ctm.detach(element)`

Removes a previously attached context menu.

```ts
ctm.detach(el);
```

---

### `ctm.summon(menu, element?, x?, y?, dont_cover?)`

Opens a menu programmatically — no right-click needed.

```ts
// At specific coordinates, in main document
ctm.summon(menu, undefined, event.clientX, event.clientY);

// Centered on an element, in same document as buttonEl
ctm.summon(menu, buttonEl);

// Positioned beside an element, in same document as buttonEl, without covering it
ctm.summon(menu, buttonEl, undefined, undefined, true);
```

---

### `ctm.default(lines | false | undefined)`

Sets a document-wide fallback context menu shown on any right-click with no element-specific menu.
It applies to every registered document, also documents registered later.

```ts
// Apply a global fallback
ctm.default(
  ctm.menu([
    ctm.line("View source", () => window.open("view-source:" + location.href)),
    ctm.line("Inspect", () => console.log("inspect")),
  ]),
);

// Suppress the browser's native context menu everywhere
ctm.default(false);

// Give the browser's native context menu back
ctm.default(undefined);
```

---

### `ctm.has(element)`

Returns `true` if a menu is attached to the element.

```ts
if (!ctm.has(el)) {
  ctm.attach(el, menu);
}
```

## Conditional Items

`undefined` values in a lines array are silently skipped, making conditional items clean:

```ts
ctm.menu(() => [
  ctm.line("Edit", () => edit()),
  canDelete ? ctm.line("Delete", () => remove()) : undefined,
  isAdmin ? ctm.line("Admin Panel", () => openAdmin()) : undefined,
]);
```

## Theming

Theming via `#theme`.

## License

MIT
