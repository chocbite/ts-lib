# @chocbite/ts-lib-ui/selection

Moves the text cursor and selects text, the same way in inputs, textareas and contenteditable elements.

```ts
import { get_cursor_position, set_cursor_end, set_cursor_position, set_selection_all } from "@chocbite/ts-lib-ui/selection";

const at = get_cursor_position(editor); // -1 when the cursor is not in it
editor.textContent = formatted;
set_cursor_position(editor, at);
```

| Function                              | Does                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `get_cursor_position(element)`        | The offset of the cursor in the text of the element, `-1` when the cursor is not in it.  |
| `set_cursor_position(element, offset)` | Focuses the element and puts the cursor at the offset, at the end when it is past it.   |
| `set_cursor_end(element)`             | Focuses the element and puts the cursor at the end of its text.                          |
| `set_selection_all(element)`          | Focuses the element and selects all of it.                                               |

In a contenteditable element the offset counts the characters of all its text, through child elements, so a cursor position survives rewriting the content like above.
