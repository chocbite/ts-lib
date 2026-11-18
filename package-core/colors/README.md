# @chocbite/ts-lib/colors

The Material Design color palettes, each with its shades from 50, the lightest, to 900, the darkest, as hex strings.

```ts
import { BLUE, GREY } from "@chocbite/ts-lib/colors";

element.style.backgroundColor = BLUE[500]; // "#2196F3"
element.style.color = GREY[50];
```

The palettes are `RED`, `PINK`, `PURPLE`, `DEEP_PURPLE`, `INDIGO`, `BLUE`, `LIGHT_BLUE`, `CYAN`, `TEAL`, `GREEN`, `LIGHT_GREEN`, `LIME`, `YELLOW`, `AMBER`, `ORANGE`, `DEEP_ORANGE`, `BROWN`, `GREY` and `BLUE_GREY`. Each is a `ColorStruct`, with the shades `"50"`, `"100"` and on in steps of 100 to `"900"`, and is frozen, so it can not be changed by accident. Take a `ColorStruct` to let code choose the palette:

```ts
import { RED, type ColorStruct } from "@chocbite/ts-lib/colors";

const warning = (palette: ColorStruct = RED) => palette["700"];
```

The theme variables of ts-lib-ui use them for their light and dark values.
