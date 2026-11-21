# pattern_example

The complete example of the element pattern in [PATTERN.md](../PATTERN.md), its source is `package-ui/pattern_example/` in the repo and in `SOURCE.md` of the package. Every case the pattern describes is shown by an element here, and tested in `tests/index.test.ts`. Every factory takes optional options and creates its element with `create`, which applies them with `[CREATE]` and `set`.

This module is never built or exported, see `NOT_BUILT` in `config/tsdown.config.ts`. Its source is shipped in the `SOURCE.md` of the published package, for agents writing elements to copy from. In the repo, the dev page `dev/pages/ui/pattern_example.ts` shows the elements.

| Element                        | Shows                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `ExampleBox`                   | A keys object, `InputOptions`, and inputs handling their errors in different ways                                       |
| `ExampleLabelBox`              | A subclass adding its own keys                                                                                          |
| `ExampleOverrideBox`           | A subclass override reading a private field from an input, which works because inputs are applied in `set`              |
| `ExampleGroup`                 | Handing an input out to other elements, as a creation input applied by overriding `[CREATE]`                            |
| `ExampleWatcher`               | An input inside an input, with an inner key typed by `InputOf`                                                          |
| `ExampleSlider`                | A writable input written through `input_state`, and a plain value key                                                   |
| `ExampleView`, `ExampleEditor` | A parent passing inputs on to its children, with options built by hand with `InputOf`, a creation input and set options |
