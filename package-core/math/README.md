# @chocbite/ts-lib/math

Small math helpers for numbers in forms and simple 2D geometry: step snapping, piecewise linear conversion, angle conversion and a few trigonometry functions. All angles are in radians.

```typescript
import { number_step_start_decimal, linearise } from "@chocbite/ts-lib/math";
```

## Exports

| Export                                                                | Description                                                             |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `number_step_start_decimal(value, step?, start?, decimals?)`          | Snaps to the nearest step, then rounds to decimals. See below.          |
| `linearise(x, ends, ...xy)`                                           | Piecewise linear conversion through a list of points. See below.        |
| `radians_to_degrees(radians)`, `degrees_to_radians(degrees)`          | Angle conversion.                                                       |
| `point_on_circle(center_x, center_y, radius, angle)`                  | `{ x, y }` of the point at `angle` on the circle.                       |
| `bounding_width_and_height_of_rotated_rectangle(width, height, angle)`| `{ width, height }` of the axis aligned box around the rotated rectangle.|
| `hypotenuse(x1, y1, x2, y2)`                                          | Distance between two points.                                            |
| `Radians`                                                             | Type alias for `number`, marks parameters that take radians.            |

The results are plain floating point, so expect values like `6.123e-17` where you'd expect `0`, for example in `point_on_circle(0, 0, 1, Math.PI / 2).x`.

## number_step_start_decimal

Snaps `value` to the nearest multiple of `step` counted from `start`, then rounds to `decimals` decimal places. It's used by the number inputs, sliders and steppers in ts-lib-ui.

```typescript
number_step_start_decimal(11.3, 0.5); // 11.5
number_step_start_decimal(10.2, 2, 1); // 11, steps are 1, 3, 5, ... 11, 13
number_step_start_decimal(5.126, 0, 0, 2); // 5.13, no snapping, only rounding
number_step_start_decimal(0.1 + 0.2, 0.1, 0, 1); // 0.3
```

- **`step`**: `0` (the default) means don't snap.
- **`start`**: where the steps are counted from, default `0`.
- **`decimals`**: `-1` (the default) means don't round. Rounding happens after snapping and removes float noise from the step multiplication.

## linearise

Converts `x` through a curve of straight segments. The points are passed as all x values first, then all y values in the same order. The x values must be ascending.

```typescript
// Points (0, 0) and (10, 100)
linearise(5, false, 0, 10, 0, 100); // 50
linearise(15, false, 0, 10, 0, 100); // 150, the line is extended
linearise(15, true, 0, 10, 0, 100); // 100, limited to the end values
linearise(-5, true, 0, 10, 0, 100); // 0

// Points (0, 0), (10, 100) and (20, 150)
linearise(15, false, 0, 10, 20, 0, 100, 150); // 125
```

- With `ends` false, values outside the range continue along the first or last segment.
- With `ends` true, they are limited to the first or last y value.
- It returns `NaN` when there are fewer than two points or an odd number of values.

## Parameter order

Geometry functions take their parameters in this order, skipping the ones they don't need:

`x, y, z, center_x, center_y, center_z, width, height, depth, angle`

New functions in this module must follow the same order, see `trigonometry/rules.md`.
