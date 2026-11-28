# @chocbite/ts-lib-ui/prompts

Modal prompts that ask the user something and give the answer as a promise. A prompt opens in a panel of `composition`, in the middle of the page, and darkens the page behind it. Each resolves with `some(answer)`, or `none()` when the user closes it with the close button or Escape. When it closes, the focus goes back to the element that had it before, unless the code handling the answer moved it elsewhere.

```ts
import { prompts } from "@chocbite/ts-lib-ui/prompts";
```

Every prompt takes `PromptOptions` as its last argument, the form prompt with its own options:

- **`owner`**: the element the prompt is asked from. The prompt opens in its document, like a browser window the element is in, and the focus goes back there. Without it the prompt opens in the main document.
- **`layer`**: the layer of the panel of the prompt, see the panels of `composition`, 999 by default, above other panels.

```ts
//Asked by a content, which can be in a browser window of the page
const answer = await prompts.buttons("Discard changes?", buttons, { owner: this });
```

## Buttons

```ts
const answer = await prompts.buttons("Discard changes?", [
  { text: "Discard", value: true, icon: material_delete_rounded },
  { text: "Keep", value: false },
]);
if (answer.some && answer.value) discard();
```

Resolves with the `value` of the clicked button. A button's `click` is called after the prompt has closed.

## Form

```ts
const result = await prompts.form(
  "New user",
  [
    form.text({ text: "Name" }),
    form.text_input({ id: "name" }),
    form.switch({ id: "admin" }),
  ],
  { text: "Create" },
);
if (result.some) {
  const values = result.value.get_value;
  if (values.ok) create(values.value.name, values.value.admin);
}
```

Resolves with the values of the form, typed by the `id` of the elements, or `none()` when closed without submitting. Read the values the way that fits:

- **`get_value`**: all values, an error when an element has no value, for forms where every field is needed.
- **`value_partial`**: the values of the elements that have one.
- **`value_changed`**: only the values the user changed in the prompt, for editing settings.

The first element the user can change gets the focus, and Enter submits with the last button.

A submit button's `click(group, close)` runs on submit, with the form group to check and warn its elements. Returning `true` keeps the prompt open, then `close(true)` submits it and `close(false)` closes it without submitting. `close(values)` resolves it with values the button made instead of the values of the form, like a button setting a time to now, `close({ date_time: Date.now() })`. The answer is read the same way, `get_value`, `value_partial` and `value_changed` all give those values. Options set the columns and rows of the form and of the submit buttons.

### Live elements

An element whose `value` is a writable state is live: it writes to its state as soon as the user changes it, while the prompt is open, and submitting or closing does not undo it. This makes a prompt a quick small window for settings that apply right away, and live elements can be mixed with ones that are submitted. Their values are in the answer like any other, `value_changed` holds them when the user changed them. Elements that should only give their value on submit keep it themselves, started with an initial `value`.

```ts
await prompts.form(
  "Display",
  [
    form.text({ text: "Brightness" }),
    form.slider({ value: brightness }),
  ],
  { text: "Close" },
);
```

## Faults

```ts
await prompts.faults(element.faults);
```

Lists problems, the `NiceError`s from `@chocbite/ts-lib/result`. It is what the fault icon of an element opens, see the fault icon in [PATTERN.md](../PATTERN.md#the-fault-icon), so an app rarely calls it itself. The icon is its owner, so it opens in the window of the element. Problems are grouped by kind: the nice text once, with each distinct message of that kind under it. An outage that fails every input shows up once, and several missing members of a fetch parser show one heading with every member named. A message with an `Error` also gets a Details collapser with the stack and the stacks of its causes, formatted only when opened. The errors an error is made of, its `errors`, are shown nested under it in a group with a line, grouped by kind again, folded behind a Sub error details collapser until opened. It is built from form elements, so it follows the theme like the other prompts. The text can be selected, to copy it into a bug report.

The prompt is 60% of the width of the page of its owner, at least 20rem and never wider than the page. Only the list scrolls, so the Close button stays in view however many problems there are. Resolves when it is closed.
