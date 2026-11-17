# @chocbite/ts-lib-ui/prompts

Modal prompts that ask the user something and give the answer as a promise. A prompt opens in a panel of `composition`, in the middle of the page, and darkens the page behind it. Each resolves with `some(answer)`, or `none()` when the user closes it with the close button or Escape.

```ts
import { prompts } from "@chocbite/ts-lib-ui/prompts";
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
  [form.text({ text: "Name" }), form.text_input({ id: "name" })],
  { text: "Create" },
);
if (result.some) create(result.value.name);
```

Resolves with the values the user changed, by `id` of the form elements, typed from the elements. The first element the user can change gets the focus, and Enter submits with the last button.

A submit button's `click(group, close)` runs on submit. Returning `true` keeps the prompt open, for example to check the values first, and `close(result)` closes it later. Options set the columns and rows of the form and of the submit buttons.

## Faults

```ts
await prompts.faults(element.faults);
```

Lists problems, the `NiceError`s from `@chocbite/ts-lib/result`. It is what the fault icon of an element opens, see the fault icon in [PATTERN.md](../PATTERN.md#the-fault-icon), so an app rarely calls it itself. Problems are grouped by kind: the nice text once, with each distinct message of that kind under it. An outage that fails every input shows up once, and several missing members of a fetch parser show one heading with every member named. A message with an `Error` also gets a Details toggle with the stack and the stacks of its causes, formatted only when opened. The text can be selected, to copy it into a bug report.

The prompt is 60% of the width of the page, at least 20rem and never wider than the page. Only the list scrolls, so the Close button stays in view however many problems there are. Resolves when it is closed.
