# @chocbite/ts-lib-ui/composition

Builds up the page of an app: a top bar, panels floating over the page, and content shown in them.

```ts
import { comp } from "@chocbite/ts-lib-ui/composition";
```

The elements follow the element pattern of ts-lib-ui: factories take options, every option is a fixed value or a state, and `set` changes options later. Give a state for anything that changes.

## Top bar

A bar along the top of the page, with items at the left, in the middle and at the right.

```ts
const title = state.ok_w("Overview");
const bar = comp.topbar({
  left: [
    comp.topbar_button({ icon: material_menu_rounded, on_click: open_menu }),
  ],
  mid: [comp.topbar_label({ text: title })],
  right: [
    comp.topbar_button({
      icon: material_settings_rounded,
      text: "Settings",
      on_click: open_settings,
    }),
  ],
});
```

- **`comp.topbar({ left, mid, right })`**: each side is an array of elements, or a state of one. A side in error is empty. The middle stays centered, and when space runs out the middle gives way first, its labels end in "…".
- **`comp.topbar_button({ text, icon, on_click })`**: a button with an icon, a text or both. A text in error shows the nice text of the error, an icon in error is left out. `on_click` is a plain function, `set({ on_click })` replaces it.
- **`comp.topbar_label({ text })`**: a text, showing the nice text of the error when the state is in error.

Colors come from the theme variables of the composition group: title bar background, hover and text.

## Content

Content is what a container, like a panel, shows. The container follows the title, icon, closable and minimum size of the content, so they are given when the content is created and can not be replaced later. Give states for values that change.

```ts
const title = state.ok_w("Report");
const report = comp.content({
  title,
  icon: material_description_rounded,
  closable: true,
  min_width: 20,
  context_menu: () => [ctm.line("Refresh", refresh)],
});
report.append(report_table);
```

| Option         | Given         | Description                                                                                                                         |
| -------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `title`        | at creation   | Title the container shows. An error shows its nice text as the title.                                                                          |
| `icon`         | at creation   | Icon in front of the title, `undefined` for none. An error shows no icon.                                                           |
| `closable`     | at creation   | Whether the container shows a close button.                                                                                         |
| `min_width`    | at creation   | Smallest width in rem the container gives the content.                                                                              |
| `min_height`   | at creation   | Smallest height in rem the container gives the content.                                                                             |
| `context_menu` | `set` as well | Lines, a menu, or a function giving them, called every time the menu opens. Shown on the content and on the title bar of its panel. |

- **`content_close()`** closes the content and the container showing it.
- **`content_on_close()`** gives a promise resolved when the content is closed, by itself or by its container.

### Own content

Extend `ContentBase` and create it with `create`, which takes the content options together with your own. Inputs your content hands out to others go in `[CREATE]`, everything else in `set`, see `PATTERN.md` of ts-lib-ui. To follow its own size, content attaches to the resize observer of `Base` and overrides `on_resize`.

```ts
class Note extends ContentBase {
  static element_name() {
    return "note";
  }
  static element_name_space() {
    return "myapp";
  }
  #text = this.appendChild(document.createElement("p"));
  set(options: NoteOptions): this {
    super.set(options);
    this.set_input(NOTE.text, options.text, (text) => {
      this.#text.textContent = text.ok ? text.value : "⚠ " + text.error.nice;
    });
    return this;
  }
}
define_element(Note);

const note = Note.create({ title: "Note", closable: true, text: note_text });
```

## Panels

A panel floats over the page and shows one content, with a title bar showing the title, icon and close button of the content. Panels live in the panel container of their document, which is made the first time it is needed.

```ts
const x = state.ok_w(10);
const y = state.ok_w(4);
const panel = comp.panel(report, { x, y, width: 30 });
```

`comp.panel(content, options)` opens the panel in the main document, `comp.panel_container(element).panel(content, options)` in the document of the element, like a second window registered with `DOCUMENT_HANDLER`.

| Option       | Description                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `x`, `y`     | Position in rem from the top left of the page, of the anchor point of the panel.                                                  |
| `anchor`     | Point of the panel x and y place, `CompAnchor`: the corners or `center`. `top_left` by default.                                   |
| `width`      | Width in rem, not given the panel fits its content. Never smaller than the `min_width` of the content.                            |
| `height`     | Height in rem, like width.                                                                                                        |
| `sizeable`   | Whether the user can size the panel, true by default.                                                                             |
| `hidden`     | Whether the panel is hidden.                                                                                                      |
| `auto_hide`  | Hides the panel when the user presses outside it.                                                                                 |
| `auto_close` | Closes the panel when the user presses outside it.                                                                                |
| `modal`      | Darkens the page behind the panel and keeps the focus in it.                                                                      |
| `titlebar`   | Whether the title bar is shown, true by default. Without it the panel can not be moved by the user.                               |
| `layer`      | Panels in a higher layer are always above those in a lower one. Within a layer the panel the user worked in last is at the front. |

`x`, `y`, `width`, `height` and `hidden` are changed by the user, by moving, sizing and auto hiding the panel. A fixed value is where the panel starts, and the panel keeps the user's changes itself. A writable state is written by the panel. A read only state can not be changed, so `x: state.ok(4)` moves only up and down. A panel without a position starts centered.

The position is kept as given, the panel only shows it clamped so its title bar stays on the page. When the window gets smaller and then bigger again, or the scale changes, the panel goes back to where it was.

- **`panel.close()`** closes the panel and its content, **`panel.on_close()`** resolves when it is closed.
- **`panel.content`** is the content it shows.
- **`comp.panel_container().active_panel`** is the panel the user worked in last.

## Customization

Content with the settings of the library: theme, UI scale, input mode and animations. The app adds its own settings with `main`, shown under the theme, and `advanced`, shown last in the collapsed advanced section. Each is an array of form elements, or a state of one, a state in error shows none.

```ts
const settings = comp.attach_customization_panel_to_element(
  settings_button,
  CompAnchor.BOT_RIGHT,
  CompAnchor.TOP_RIGHT,
);
settings.content.set({
  main: [
    form.text({ text: "Units" }),
    form.toggle_button({ value: units }),
  ],
});
```

- **`comp.customization(options)`** makes the content, to show in any panel. Title, icon, closable and minimum size have defaults, give them to change them.
- **`comp.customization_panel(options, owner?)`** puts it in a modal panel that starts hidden and hides again when the user presses outside it. It returns `{ panel, content, hidden }`, write `false` to `hidden` to show it, change the panel with `panel.set`, like its position.
- **`comp.attach_customization_panel_to_element(element, element_anchor, panel_anchor, c_panel?)`** shows the panel when the element is clicked, with `panel_anchor` of the panel at `element_anchor` of the element.
