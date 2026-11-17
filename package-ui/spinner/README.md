# @chocbite/ts-lib-ui/spinner

A placeholder for data with an unknown arrival time, twelve dots going round.

```ts
import { spinner } from "@chocbite/ts-lib-ui/spinner";

box.replaceChildren(spinner());
```

`spinner(options)` takes the options every element has, like `access`. It fills its parent, keeping its round shape, and its dots take the color of the `spinners` theme variable.

It follows the animation level of the theme. At the full level each dot pulses in turn, a wave going round. At the lower levels the dots stand still as a trail and the whole ring turns 30 degrees at a time, a single animation. Both animate only transforms and opacity, which the browser runs off the main thread, so spinners cost next to nothing while they wait.
