# @chocbite/ts-lib-ui/svg

A TypeScript library for programmatic SVG generation with a fluent, chainable API.

## Quick Start

```ts
import { svg } from "@chocbite/ts-lib-ui/svg";

// Create an SVG canvas and append a red circle
const canvas = svg.svg(200, 200).elem;
canvas.appendChild(
  svg.circle(100, 100, 40).fill("red").stroke("black").stroke_width(2).elem
);
document.body.appendChild(canvas);
```

## API

All drawing functions return an `SVGAttributes` wrapper that supports chaining. Call `.elem` to get the underlying `SVGElement`.

### Primitives

#### `svg.svg(width, height, viewbox?)`

Creates an `<svg>` root element. The viewbox defaults to `"0 0 <width> <height>"`.

```ts
const canvas = svg.svg(400, 300).elem;
```

#### `svg.circle(center_x, center_y, radius)`

Creates a `<circle>` element.

```ts
svg.circle(50, 50, 25).fill("blue").elem;
```

#### `svg.ellipse(center_x, center_y, radius_x, radius_y)`

Creates an `<ellipse>` element.

```ts
svg.ellipse(100, 100, 60, 30).fill("green").stroke("black").elem;
```

#### `svg.rectangle_from_center(center_x, center_y, width, height, corner_radius)`

Creates a `<rect>` positioned by its center point.

```ts
svg.rectangle_from_center(100, 100, 80, 40, 5).fill("orange").elem;
```

#### `svg.rectangle_from_corner(start_x, start_y, width, height, corner_radius)`

Creates a `<rect>` positioned by its top-left corner.

```ts
svg.rectangle_from_corner(10, 10, 80, 40, 0).fill("purple").elem;
```

#### `svg.line(start_x, start_y, end_x, end_y)`

Creates a `<line>` element.

```ts
svg.line(0, 0, 100, 100).stroke("black").stroke_width(2).elem;
```

#### `svg.path(d)`

Creates a `<path>` element with the given path data string.

```ts
svg.path("M 10 80 C 40 10, 65 10, 95 80").stroke("black").fill("none").elem;
```

#### `svg.isosceles_triangle(center_x, center_y, width, height)`

Creates an isosceles triangle as a `<path>`.

```ts
svg.isosceles_triangle(100, 100, 60, 80).fill("yellow").stroke("black").elem;
```

#### `svg.circle_arc(center_x, center_y, radius, start_angle, end_angle)`

Draws a circular arc. Angles are in degrees.

```ts
svg.circle_arc(100, 100, 50, 0, 90).stroke("red").fill("none").stroke_width(2).elem;
```

#### `svg.ellipse_arc(center_x, center_y, radius_x, radius_y, start_angle, end_angle)`

Draws an elliptical arc. Angles are in degrees.

```ts
svg.ellipse_arc(100, 100, 60, 30, 0, 180).stroke("blue").fill("none").elem;
```

#### `svg.text(x, y, text, size, anchor)`

Creates a single-line `<text>` element. The `anchor` parameter controls text alignment using `SVGAnchorPoint`.

```ts
import { svg, SVGAnchorPoint } from "@chocbite/ts-lib-ui/svg";

svg.text(100, 50, "Hello", 16, SVGAnchorPoint.middleCenter).fill("black").elem;
```

#### `svg.multi_line_text(x, y, width, height, text, size, anchor)`

Creates a multi-line text block using a `<foreignObject>` with an inner `<div>`.

```ts
svg.multi_line_text(10, 10, 200, 100, "Long text that wraps", 14, SVGAnchorPoint.topLeft).elem;
```

#### `svg.group()`

Creates a `<g>` group element. Append child elements to it.

```ts
const g = svg.group().translate(50, 50).elem;
g.appendChild(svg.circle(0, 0, 20).fill("red").elem);
g.appendChild(svg.circle(40, 0, 20).fill("blue").elem);
```

#### `svg.create(tagName)`

Creates an arbitrary SVG element by tag name (e.g. `"defs"`, `"clipPath"`).

```ts
const defs = svg.create("defs").elem;
```

### Chaining Attributes

Every primitive returns an `SVGAttributes` wrapper with chainable methods:

| Method | Shorthand | Description |
|---|---|---|
| `.fill(color)` | `.f(color)` | Set fill color |
| `.stroke(color)` | `.s(color)` | Set stroke color |
| `.stroke_width(n)` | `.sw(n)` | Set stroke width |
| `.class_list(...names)` | `.cl(...names)` | Add CSS class names |
| `.attribute(name, value)` | `.a(name, value)` | Set any attribute |
| `.translate(x, y)` | | Apply translate transform |
| `.rotate(angle, cx?, cy?)` | | Apply rotate transform |
| `.scale(sx, sy?)` | | Apply scale transform |
| `.skewX(angle)` | | Apply skewX transform |
| `.skewY(angle)` | | Apply skewY transform |
| `.transform(str)` | | Apply a custom transform string |
| `.elem` | | Get the underlying `SVGElement` |

Transforms are accumulated and written to the `transform` attribute when `.elem` is accessed.

```ts
svg.circle(0, 0, 10)
  .fill("red")
  .stroke("black")
  .stroke_width(1)
  .class_list("my-circle")
  .translate(50, 50)
  .rotate(45)
  .elem;
```

### Utilities

#### `SVGAnchorPoint`

An enum-like object describing text anchor positions:

```ts
import { SVGAnchorPoint } from "@chocbite/ts-lib-ui/svg";

SVGAnchorPoint.topLeft;       // 2
SVGAnchorPoint.topCenter;     // 3
SVGAnchorPoint.topRight;      // 4
SVGAnchorPoint.middleLeft;    // 1
SVGAnchorPoint.middleCenter;  // 8
SVGAnchorPoint.middleRight;   // 5
SVGAnchorPoint.bottomLeft;    // 0
SVGAnchorPoint.bottomCenter;  // 7
SVGAnchorPoint.bottomRight;   // 6
```

#### `svg.angle_to_anchor_point(angle)`

Converts an angle (in radians) to the nearest `SVGAnchorPoint`. Useful for placing labels around a circle.

```ts
const anchor = svg.angle_to_anchor_point(Math.PI / 4); // bottomRight
```

## Full Example

```ts
import { svg, SVGAnchorPoint } from "@chocbite/ts-lib-ui/svg";

const canvas = svg.svg(300, 300).elem;

// Background
canvas.appendChild(
  svg.rectangle_from_corner(0, 0, 300, 300, 0).fill("#f0f0f0").elem
);

// Grouped shapes
const g = svg.group().translate(150, 150).elem;
g.appendChild(svg.circle(0, 0, 50).fill("none").stroke("steelblue").stroke_width(2).elem);
g.appendChild(svg.line(-50, 0, 50, 0).stroke("gray").stroke_width(1).elem);
g.appendChild(svg.line(0, -50, 0, 50).stroke("gray").stroke_width(1).elem);
g.appendChild(svg.text(0, -60, "Center", 12, SVGAnchorPoint.bottomCenter).fill("black").elem);
canvas.appendChild(g);

document.body.appendChild(canvas);
```

## License

MIT
