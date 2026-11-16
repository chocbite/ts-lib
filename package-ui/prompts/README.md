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
