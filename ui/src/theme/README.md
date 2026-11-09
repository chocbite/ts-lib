# Theme

Colors, scale, scrollbar size, input mode and animations for the UI, stored as user settings.

## Starting the theme

The app must call `theme_init` once, nothing of the theme is applied to the page before that.

```ts
import { theme_init, Themes } from "@chocbite/ts-lib-ui/theme";

// Device with an operating system dark mode, the user can pick Light, Dark or System
theme_init({ system: true });

// Device without it, for example decided from the user agent, the user can pick Light or Dark
theme_init({ default: Themes.Dark });
```

Options:

- `system` offers the System theme, which follows the light or dark mode of the operating system. Only with `system` on is the operating system dark mode read. The System choice shows the active theme, for example "System (Dark)".
- `default` is the theme used until the user chooses one, it defaults to System with `system` on and Light otherwise. The default is not stored, a theme is only stored when the user chooses one.

`theme_init` throws when called twice, or when System is the default without `system` on.

## Mixins

Use scrollbar mixin like so

```
@use "@chocbite/ts-lib-ui/theme/mixins" as scrollbar;
```
