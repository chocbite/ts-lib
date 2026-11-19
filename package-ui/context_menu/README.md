# @chocbite/ts-lib-ui/context_menu

Context menus that open on a right click, or a press and hold on touch screens, with lines, submenus and menus built when they open.

## Basic Usage

Attach a context menu to an element. Its css is part of `style.css` of ts-lib-ui.

```ts
import ctm from "@chocbite/ts-lib-ui/context_menu";

ctm.attach(
  editor,
  ctm.menu([
    ctm.line({ text: "Cut", on_click: () => cut() }),
    ctm.line({ text: "Copy", on_click: () => copy() }),
    ctm.line({ text: "Paste", on_click: () => paste() }),
  ]),
);
```

Right-click (or long-press) the element to open the menu.

Lines and submenus follow the element pattern of ts-lib-ui, see [PATTERN.md](../PATTERN.md): their factories take options, every option is an initial value or a state, and `set(options)` changes options later. States are followed while the menu is open, so a menu that is kept, instead of built on every open, shows their current values. Every line takes `access` like any element: read greys the line out and the keyboard skips it, none hides it.

## API

### `ctm.menu(lines)`

Creates a menu panel. `lines` can be a static array, a lazy factory, or a Promise/async factory (shows a spinner while loading).

```ts
// Static array
const menu = ctm.menu([
  ctm.line({ text: "Option A", on_click: () => console.log("A") }),
  ctm.line({ text: "Option B", on_click: () => console.log("B") }),
]);

// Factory — evaluated on every open
const menu = ctm.menu(() => [
  ctm.line({ text: "Timestamp", on_click: () => console.log(Date.now()) }),
]);

// Async factory — shows a spinner until the Promise resolves
const menu = ctm.menu(async () => {
  const items = await fetchMenuItems();
  return items.map((item) => ctm.line({ text: item.label, on_click: item.action }));
});
```

---

### `ctm.line(options)`

Creates a menu line that does something when chosen.

- **`text`**: text of the line, an error shows its nice text.
- **`on_click`**: called when the line is clicked, or chosen with enter or space. The menu then closes.
- **`icon`**: an icon function in front of the text, like `material_delete_rounded`.
- **`shortcut`**: text at the right end, like the keyboard shortcut doing the same.
- **`checked`**: shows a checkmark. It is only shown, a click does not change it, write the state in `on_click` for a line that toggles.

```ts
import { material_delete_rounded } from "@chocbite/ts-lib-ui/icons";

ctm.line({ text: "Delete", on_click: () => delete_file(), icon: material_delete_rounded });
ctm.line({ text: "Save", on_click: () => save(), shortcut: "Ctrl+S" });
ctm.line({ text: "Mute", checked: muted, on_click: () => muted.write(!muted.ok()) });
ctm.line({ text: "Paste", on_click: () => paste(), access: can_paste }); // AccessTypes state
```

---

### `ctm.sub(options)`

Creates a line that opens another menu beside it. Hover (300 ms) or keyboard (→ / Enter / Space) opens the nested menu. Takes `text`, `icon` and `access` like a line, and the `menu` it opens.

```ts
const color_menu = ctm.menu([
  ctm.line({ text: "Red", on_click: () => set_color("red") }),
  ctm.line({ text: "Green", on_click: () => set_color("green") }),
  ctm.line({ text: "Blue", on_click: () => set_color("blue") }),
]);

const menu = ctm.menu([
  ctm.line({ text: "Copy", on_click: () => copy() }),
  ctm.sub({ text: "Color", menu: color_menu }),
  ctm.line({ text: "Delete", on_click: () => remove() }),
]);
```

---

### `ctm.divider()`

Inserts a horizontal separator.

```ts
const menu = ctm.menu([
  ctm.line({ text: "Cut", on_click: () => cut() }),
  ctm.line({ text: "Copy", on_click: () => copy() }),
  ctm.divider(),
  ctm.line({ text: "Delete", on_click: () => remove() }),
]);
```

---

### `ctm.combine(...groups)`

Combines groups of lines and menus into one menu, with a divider between the groups. It returns a menu factory for `ctm.attach`, or anything else taking one, like the `context_menu` row option of the list.

- A group is an array of lines, a menu, a function giving lines, a menu or an option of a menu (what `ctm.attach` takes), or `undefined` for no group.
- Functions are called and the menu is built every time it opens, so lines can show the state at that moment.
- A menu gives its lines, so two finished menus can be joined, like extra lines in front of a menu that came from somewhere else.
- Empty groups are left out with their divider, `undefined` lines are skipped like in `ctm.menu`.
- When all groups are empty there is no menu.

```ts
ctm.attach(
  el,
  ctm.combine(
    [ctm.line({ text: "Cut", on_click: () => cut() }), ctm.line({ text: "Copy", on_click: () => copy() })],
    () => (canDelete() ? [ctm.line({ text: "Delete", on_click: () => remove() })] : []),
    isAdmin ? [ctm.line({ text: "Admin Panel", on_click: () => openAdmin() })] : undefined,
  ),
);

// Lines in front of a finished menu, or of a menu factory given by someone else
ctm.attach(el, ctm.combine([ctm.line({ text: "Select", on_click: () => select() })], other_menu));
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
      ctm.line({ text: "Edit", on_click: () => edit(el) }),
      ctm.line({ text: "Delete", on_click: () => remove(el) }),
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

### `ctm.summon(menu, options?)`

Opens a menu programmatically — no right-click needed.

- **`element`**: the element the menu belongs to, it opens in the document of the element, without it in the main document.
- **`x`**, **`y`**: the position. Without both, the menu opens at the middle of the element, or the top left corner without an element.
- **`dont_cover`**: places the menu beside the element instead of covering it.

```ts
// At specific coordinates, in main document
ctm.summon(menu, { x: event.clientX, y: event.clientY });

// Centered on an element, in same document as button
ctm.summon(menu, { element: button });

// Positioned beside an element, in same document as button, without covering it
ctm.summon(menu, { element: button, dont_cover: true });
```

---

### `ctm.default(lines | false | undefined)`

Sets a document-wide fallback context menu shown on any right-click with no element-specific menu.
It applies to every registered document, also documents registered later.

```ts
// Apply a global fallback
ctm.default(
  ctm.menu([
    ctm.line({ text: "View source", on_click: () => window.open("view-source:" + location.href) }),
    ctm.line({ text: "Inspect", on_click: () => console.log("inspect") }),
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
  ctm.line({ text: "Edit", on_click: () => edit() }),
  canDelete ? ctm.line({ text: "Delete", on_click: () => remove() }) : undefined,
  isAdmin ? ctm.line({ text: "Admin Panel", on_click: () => openAdmin() }) : undefined,
]);
```

## Theming

The colors are theme variables of `@chocbite/ts-lib-ui/theme`, in the group `contextmenu`: `background`, `text`, `hover`, `hoverText` and `border`.
