# Design notes for ts-lib-ui

How the elements of ts-lib-ui look, and why. Use these notes when restyling an element or writing a new one, so it fits with the rest. The form module (`form/base.scss`, `form/shared.ts`) is the reference implementation, and the keyboard, context menu, composition and list follow the same rules.

## The look in one paragraph

The style is flat and soft. Fields are white boxes with a faint grey border and rounded corners, and the border darkens on hover. With focus, the border turns into a blue ring. Buttons are filled grey blocks without a border. One blue accent marks what is on, selected or the main action. Nothing casts a shadow except things that float above the page: popups, menus, panels, the keyboard tray and slider knobs. The text is dark grey, never pure black, and secondary text such as units, legends and shortcuts is a lighter grey.

## Principles

1. **Each state has one visual signal.**
   - Hover darkens the border of a field, or the fill of a button.
   - Focus is a 2px blue ring.
   - Pressed is a darker fill.
   - On or selected is the blue accent.
   - Disabled (`inert`) is 50% opacity.
   
   Do not combine signals, for example a shadow and a colour change for the same state.
2. **Hover only applies with a mouse.** Wrap hover rules in `@media (pointer: fine)`, so a touch screen does not keep a hover state stuck after a tap.
3. **Show the focus ring for keyboard focus.** Inside menus and lists, use `:focus-visible` for the ring and `:focus-within` for a quiet hover-style background. A field shows the ring on `:focus-within`, because typing into it is focus.
4. **Elevation means floating.** Use a shadow only when the element is above other content. A dark-mode shadow is invisible on a dark background, so floating panels also get a faint light glow in dark mode. In light mode the glow is transparent. See `glow` in `composition/shared.ts`.
5. **Use grey for structure and blue for meaning.**
   - Borders, buttons, zebra rows and separators come from the `GREY` scale in `@chocbite/ts-lib/colors`.
   - Blue is reserved for focus and accent.
   - Red, green and yellow are only for the colours a user asks for, such as lamp colours and `form-colors`.
6. **Leave room for the content.** Give text the full line height so descenders are not clipped. When space runs out, hide the least important parts whole (legends first, then the unit, which ends in …), rather than squeezing everything.

## Tokens

Colours are theme variables, never hard-coded in SCSS.

- Each module declares its variables in its `shared.ts` with `make_variable(id, name, description, light, dark, "Color", undefined)`.
- SCSS uses them as `var(--<root>-<group>-<id>)`, normally through a `$color_*` alias at the top of the module's base SCSS (see `form/base.scss`).
- Every variable has both a light and a dark value. Check both.

The form defaults (light / dark):

| Role | Light | Dark |
| --- | --- | --- |
| Field background | `#FFFFFF` | `#2B2B2B` |
| Field border | GREY 400 | GREY 700 |
| Field border on hover | GREY 600 | GREY 500 |
| Focus ring | BLUE 400 | BLUE 300 |
| Accent / accent hover | BLUE 700 / 800 | BLUE 300 / 200 |
| Text on accent | `#FFFFFF` | GREY 900 |
| Button / hover / pressed | GREY 300 / `#D2D2D2` / GREY 400 | GREY 800 / 700 / 600 |
| Text / secondary text | GREY 800 / 600 | GREY 200 / 400 |
| Shadow | `rgba(0,0,0,0.25)` | `rgba(0,0,0,0.6)` |

Other modules use the same values for the same roles: white or `#2B2B2B` surfaces, a GREY 200 light hover row, and a BLUE 400 / 300 focus ring. Pick the existing value before inventing a new one.

### Sizes

The sizes are in `form/base.scss`. Use `rem` for everything, so the scale setting of the theme sizes the whole UI.

- Height: `1.5rem`, or `2rem` in touch mode.
- Corner radius: `0.375rem` for fields and buttons. Things inside a field use the radius minus the border. Menu rows use about `0.3rem`, keyboard keys `0.45rem`.
- Border: `0.0625rem`. The focus ring is `0.125rem`.
- Padding between the edge of a field and its text: `0.4rem`.
- Spacing between elements: `0.4rem`.
- Fonts:
  - Value: `0.9rem`.
  - Unit: `0.7rem`.
  - Min and max legends: `0.6rem`.
  - Touch mode multiplies the value and unit by 1.4.
  - The value and the unit share one line height (`value × 1.25`), so they line up when centred.

### Shadows

The shadows are `$shadow_popup` (`0 0.25rem 0.75rem`) for popups, and `$shadow_knob` (`0 0.0625rem 0.1875rem`) for a knob on a track. The older `$shadow_out` and `$shadow_in` names still exist and are all flat now. Do not use them in new code.

## Mixins to build on

Use the mixins from `form/base.scss` instead of copying their rules:

- `field`: anything that takes input. Text, numbers, drop downs and sliders use it.
- `pressable`: anything that is pressed. Buttons, steppers and toggle buttons use it.
- `base`: the bottom margin between elements, and the `inert` look.
- `value-font`, `unit-font`, `unit-container` and `limit-legend`: the text inside value elements.
- `no-value-line`: the short grey line shown in place of a missing value.

The keyboard has its own versions in `keyboard/_tray.scss`: `tray`, `key` and `accent`. A key has a 1px bottom shadow like a key cap, and while pressed it drops that shadow and moves down 1px.

## Modes

- **Touch.** A `.touch` class on an ancestor switches it on. Write touch rules as `.touch & { … }` in the same block as the normal rule. In touch mode everything is taller and the fonts are bigger, but nothing may become wider than its container. Check every element in a narrow list cell with touch on.
- **Animation.** Put transitions under `.anim-all &`, so the animation setting can switch them off. Animate colours, borders and shadows, not layout.
- **Dark.** The theme switches the variables. Never write a `prefers-color-scheme` rule in a module.

## Narrow space

The elements are used in list cells and sidebars, so they must work at any width:

- Set `min-width: 0` on flex children that may shrink. Use `overflow: hidden` with `text-overflow: ellipsis` for text.
- To hide parts that don't fit, let them wrap onto a second line that is cut off. The container gets `flex-wrap: wrap; align-content: flex-start; overflow: hidden`, and the main content gets `height: 100%`. The number input and the stepper use this to drop their legends.
- A flexible part that should give way late, but never grow past its text, uses `flex: 1 1 <basis>; min-width: 0; max-width: max-content`. The unit of the number input does this.
- When a part must size itself to the element, make the element a container (`container-type: inline-size`, plus `contain-intrinsic-inline-size` for its natural width) and use `cqw` units. This is how the slider knob shrinks so that it never covers the buttons.

## SCSS pitfalls found the hard way

- **Interpolation.** Sass does not interpolate variables inside custom properties or `calc()` mixed with `var()`. Write `--knob: #{calc(...)}` and `calc(#{$a} - #{$b})`.
- **Attribute selectors match every value.** An attribute that can be `"none"` needs `[color]:not([color="none"])`, not just `[color]`.
- **Specificity in touch rules.** `*` adds no specificity, so `.touch & > *` can lose to an element's own rule. Use `> :nth-child(n)` to add specificity without changing what matches. `list/field.scss` does this.
- **Check the result in the browser.** Look in both themes, and with touch on and off, using the dev pages (`npm run dev`, `dev/pages/ui/…`). For subtle effects such as a dark-mode glow, measure the pixel difference rather than judging it by eye. An effect too faint to measure will not be seen.

## Lists

Form elements in a list cell sit in a `list-cell` wrapper (`list/field.ts`), which gives them small padding and lets them fill the cell. The list itself follows the same palette:

- Faint zebra rows and light grey lines.
- A blue focus ring.
- A bold header.
- A resize grip that only appears on hover.
- A dashed "Add row" button.
