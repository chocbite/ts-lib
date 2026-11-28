# @chocbite/ts-lib-ui/icons

The Material Symbols Rounded icons, as svg functions for elements and as an icon font for css, both bundled so nothing is fetched at runtime.

## Svg icons

```ts
import { material_delete_rounded, material_save_rounded } from "@chocbite/ts-lib-ui/icons";

button.appendChild(material_delete_rounded());
form.button({ text: "Save", icon: material_save_rounded });
```

Every icon is a function `material_<name>_rounded` giving a new `<svg>` element, the `SVGFunc` type of `@chocbite/ts-lib-ui/svg`. Elements taking an icon take the function, not the element, like `icon: material_save_rounded`, so they make a copy whenever they need one. Your own icons fit anywhere these do, any function giving an `<svg>` is an `SVGFunc`.

- **The names** are those of [Material Symbols](https://fonts.google.com/icons), with dashes as underscores, like `material_arrow_back_rounded`. There are about 4100, the `.d.mts` files of the package list them all.
- **Unused icons are left out of your build.** Each icon is its own export marked free of side effects, so a bundler keeps only the ones you import.
- **An icon is parsed once**, at its first use, every call after that gives a copy.

## Custom icons

A few icons Material Symbols has no icon for, drawn in the same style and size, so they fit wherever the material icons do. They are named `icon_<name>_rounded` and work like the material functions, but are not in the icon font.

| Function                | Shows                                      |
| ----------------------- | ------------------------------------------ |
| `icon_sort_a_z_rounded` | A above Z with a down arrow, sorted A to Z |
| `icon_sort_z_a_rounded` | Z above A with a down arrow, sorted Z to A |
| `icon_sort_1_9_rounded` | 1 above 9 with a down arrow, sorted 1 to 9 |
| `icon_sort_9_1_rounded` | 9 above 1 with a down arrow, sorted 9 to 1 |

## Icon font

The same icons as a font, for places that show many icons, like the rows of a list, because a glyph costs less than an svg element. The font is part of `style.css`. Use the mixin and write the name of the icon as the content:

```scss
@use "@chocbite/ts-lib-ui/icons/mixins" as icons;

.delete::before {
  @include icons.material-symbols-rounded;
  content: "delete";
}
```

The name is the Material Symbols name as written in the font, with underscores, like `"arrow_back"`.
