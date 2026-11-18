# @chocbite/ts-lib-ui/context-menu

Context menus that open on a right click, or a press and hold on touch screens, with lines, submenus and menus built when they open.

## Basic Usage

Attach a context menu to an element. Its css is part of `style.css` of ts-lib-ui.

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

### `ctm.combine(...groups)`

Combines groups of lines and menus into one menu, with a devider between the groups. It returns a menu factory for `ctm.attach`, or anything else taking one, like the `context_menu` row option of the list.

- A group is an array of lines, a menu, a function giving lines, a menu or an option of a menu (what `ctm.attach` takes), or `undefined` for no group.
- Functions are called and the menu is built every time it opens, so lines can show the state at that moment.
- A menu gives its lines, so two finished menus can be joined, like extra lines in front of a menu that came from somewhere else.
- Empty groups are left out with their devider, `undefined` lines are skipped like in `ctm.menu`.
- When all groups are empty there is no menu.

```ts
ctm.attach(
  el,
  ctm.combine(
    [ctm.line("Cut", () => cut()), ctm.line("Copy", () => copy())],
    () => (canDelete() ? [ctm.line("Delete", () => remove())] : []),
    isAdmin ? [ctm.line("Admin Panel", () => openAdmin())] : undefined,
  ),
);

// Lines in front of a finished menu, or of a menu factory given by someone else
ctm.attach(el, ctm.combine([ctm.line("Select", () => select())], other_menu));
```

Lines are elements that live in one menu at a time. The combined menu takes the lines of a menu group while it is open, the menu takes them back when it opens on its own. An array group is fine because only one menu is open at a time, but give a function when the same lines should also be used in another menu that can be open at the same time.

A menu group with promised lines makes the combined menu wait for all groups with a spinner, like `ctm.menu` with a promise. The combined menu then always opens, even when the lines turn out empty.

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

The colors are theme variables of `@chocbite/ts-lib-ui/theme`, in the group `contextmenu`: `background`, `text`, `hover`, `hoverText` and `border`.
