# @chocbite/ts-lib-ui/composition

Builds up the page of an app: a top bar, panels floating over the page, and content shown in them.

```ts
import { comp } from "@chocbite/ts-lib-ui/composition";
```

The elements follow the element pattern of ts-lib-ui: factories take options, every option is an initial value or a state, and `set` changes options later. Give a state for anything changed from outside.

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

Colors come from the theme variables of the composition group: `titlebar`, `titlebarHover`, `titlebarText`, `icons` and `border` (the line below the bar). Panels use the same title bar colors, with `background` for their content, `border`, `shadow` and `glow` (a light halo, for dark mode) around them, `shadowFocus` for the border of the panel with focus, `titlebarCloseHover` for the close button and `sizers` for the frame of the sizers in touch mode.

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
| `title`        | at creation   | Title the container shows. An error shows its nice text as the title.                                                               |
| `icon`         | at creation   | Icon in front of the title, `undefined` for none. An error shows no icon.                                                           |
| `closable`     | at creation   | Whether the container shows a close button.                                                                                         |
| `min_width`    | at creation   | Smallest width in rem the container gives the content.                                                                              |
| `min_height`   | at creation   | Smallest height in rem the container gives the content.                                                                             |
| `context_menu` | `set` as well | Lines, a menu, or a function giving them, called every time the menu opens. Shown on the content and on the title bar of its panel. |

- **`content_close()`** closes the content and the container showing it.
- **`content_on_close()`** gives a promise resolved when the content is closed, by itself or by its container.

### Own content

Extend `ContentBase` and create it with `create`, which takes the content options together with your own. Inputs your content hands out to others go in `[CREATE]`, everything else in `set`, see [PATTERN.md](../PATTERN.md). To follow its own size, the space its container gives it, content calls `this.content_size()`, which gives `width` and `height` as read only states in px, see [state_ui.size](../state_ui/README.md):

```ts
const { width, height } = this.content_size();
const scale = () => this.#scale(width.ok(), height.ok());
width.sub(scale, true);
height.sub(scale);
```

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

| Option       | Description                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `x`, `y`     | Position in rem from the top left of the page, of the anchor point of the panel.                                                                             |
| `anchor`     | Point of the panel x and y place, `CompAnchor`: the corners or `center`. `top_left` by default. The point stays in place when the size of the panel changes. |
| `width`      | Width in rem, not given the panel fits its content. Never smaller than the `min_width` of the content.                                                       |
| `height`     | Height in rem, like width.                                                                                                                                   |
| `sizeable`   | Whether the user can size the panel, true by default.                                                                                                        |
| `hidden`     | Whether the panel is hidden.                                                                                                                                 |
| `auto_hide`  | Hides the panel when the user presses outside it.                                                                                                            |
| `auto_close` | Closes the panel when the user presses outside it.                                                                                                           |
| `modal`      | Darkens the page behind the panel and keeps the focus in it.                                                                                                 |
| `titlebar`   | Whether the title bar is shown, true by default. Without it the panel can not be moved by the user.                                                          |
| `layer`      | Panels in a higher layer are always above those in a lower one. Within a layer the panel the user worked in last is at the front.                            |
| `window`     | Whether the content is shown in a browser window of its own instead of the panel, see below.                                                                 |

`x`, `y`, `width`, `height`, `hidden` and `window` are changed by the user, by moving, sizing, auto hiding the panel and opening it in a window. An initial value is where the panel starts, and the panel keeps the user's changes itself. A writable state is written by the panel. A read only state can not be changed, so `x: state.ok(4)` moves only up and down. A panel without a position starts centered.

The position is kept as given, the panel only shows it clamped so its title bar stays on the page. When the window gets smaller and then bigger again, or the scale changes, the panel goes back to where it was.

The user opens any panel in a browser window with **Open in window** in the menu of its title bar. The content moves into the window, which is titled after it and has the theme and styles of the page, and the panel leaves the page. When the user closes the window the content comes back in the panel, with the size of the window and where the window was, where the browser tells where windows are (not on Wayland). Panels opened in the window, like prompts, move into the page with it, over the content where they were, none of them closes. The same happens to the panels of any document that is deregistered from `DOCUMENT_HANDLER`. Writing `window` opens and closes it from the app. Browsers open a window only on a click or key press of the user, one window each, unless the site may open popups. A window blocked without one waits, the panel hidden, and opens on the next click or key press in the page, waiting windows open one each in the order they waited. A window blocked during a click means the browser does not let the page open windows, the panel stays in the page and writes `false`. The windows close with the page, their contents live in it, without writing `window`, so a saved `true` can open them again.

- **`panel.close()`** closes the panel and its content, **`panel.on_close()`** resolves when it is closed.
- **`panel.content`** is the content it shows.
- **`comp.panel_container().active_panel`** is the panel the user worked in last.
- **`WINDOW_REOPEN`** is the setting of the user, also in the advanced part of the customization panel, of where the application manager opens browser windows after a refresh, `WindowReopen.Windows` as windows, the default, each waiting for a click or key press unless the page may open popups, or `WindowReopen.Main` as panels of the main window.
- **`comp.panel_layer(element)`** is the layer of the panel the element is in, the state the panel was given or its value, 0 when it is not in a panel. A panel opened from the element with it comes above the panel it came from, and follows it to another layer.

## Customization

Content with the settings of the library: theme, UI scale, input mode and animations. The app adds its own settings with `main`, shown under the theme, and `advanced`, shown last in the collapsed advanced section. Each is an array of form elements, or a state of one, a state in error shows none.

```ts
const settings = comp.attach_customization_panel_to_element(
  settings_button,
  CompAnchor.BOT_RIGHT,
  CompAnchor.TOP_RIGHT,
);
settings.content.set({
  main: [form.text({ text: "Units" }), form.toggle_button({ value: units })],
});
```

- **`comp.customization(options)`** makes the content, to show in any panel. Title, icon, closable and minimum size have defaults, give them to change them.
- **`comp.customization_panel(options, owner?)`** puts it in a modal panel that starts hidden and hides again when the user presses outside it. It returns `{ panel, content, hidden }`, write `false` to `hidden` to show it, change the panel with `panel.set`, like its position.
- **`comp.attach_customization_panel_to_element(element, element_anchor, panel_anchor, c_panel?)`** shows the panel when the element is clicked, with `panel_anchor` of the panel at `element_anchor` of the element.
