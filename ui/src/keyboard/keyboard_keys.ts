import { Base, define_element } from "#base";
import { get_cursor_position, set_cursor_position } from "#selection";
import { some } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { KeyboardBase } from "./base";
import "./keyboard_keys.scss";
import "./shared";
import {
  KeyboardConfig,
  KeyboardLayerConfig,
  KeyboardSpecialKeys,
} from "./types";

class KeyboardKey extends Base {
  static element_name(): string {
    return "key";
  }

  static element_name_space(): string {
    return "onscreen-keyboard";
  }

  constructor(
    keyboard: Keyboard_Keys,
    text: string,
    key: string,
    ri: number,
    col_count: number,
    rows: number,
    cols: number,
  ) {
    super();

    this.textContent = text;
    this.style.gridRow = (ri + 1).toString();
    this.style.gridColumn = (col_count + 1).toString();
    this.style.gridRowEnd = `${ri + 1 + rows}`;
    this.style.gridColumnEnd = `${col_count + 1 + cols}`;
    this.onclick = () => keyboard.execute_key(key);
    if (key.includes("layer")) {
      const layer_name = key.split(":")[1];
      this.attach_state_ROA_to_attribute_map("active", keyboard.layer, (v) =>
        some(v === layer_name ? "true" : "false"),
      );
    }
  }
}
define_element(KeyboardKey);

class KeyboardLayer extends Base {
  static element_name(): string {
    return "layer";
  }

  static element_name_space(): string {
    return "onscreen-keyboard";
  }

  constructor(keyboard: Keyboard_Keys, config: KeyboardLayerConfig) {
    super();
    if (config.max_width) this.style.maxWidth = config.max_width + "rem";
    this.addEventListener("mousedown", (e) => e.preventDefault());

    let highest_col_count = 0;
    let highest_row = 0;
    config.keys.forEach((r, i) => {
      let col_count = 0;
      let highest_row_in_layer = 0;
      const ri = i * (config.key_rows ?? 1);
      r.forEach((k) => {
        if (typeof k === "number") {
          col_count += k;
          return;
        }
        const {
          text,
          rows = config.key_rows ?? 1,
          cols = config.key_cols ?? 1,
        } = k;
        this.appendChild(
          new KeyboardKey(
            keyboard,
            text,
            k.key ?? text,
            ri,
            col_count,
            rows,
            cols,
          ),
        );
        col_count += cols;
        highest_row_in_layer = Math.max(highest_row_in_layer, ri + rows);
      });
      highest_col_count = Math.max(highest_col_count, col_count);
      highest_row = Math.max(highest_row, highest_row_in_layer);
    });
    this.style.gridTemplateColumns = "repeat(" + highest_col_count + ", 1fr)";
    const row_height = 3 / (config.key_rows ?? 1);
    const row_max = 40 / highest_row;
    this.style.gridTemplateRows =
      "repeat(" +
      highest_row +
      ", min(" +
      row_height +
      "rem, " +
      row_max +
      "vh))";
  }
}
define_element(KeyboardLayer);

const KEO = {
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  repeat: false,
  bubbles: true,
  cancelable: true,
};
const IEO = {
  bubbles: true,
};

/**KeyboardEvent code of the key typing a character, empty for characters without a key of their own*/
function key_code(key: string): string {
  if (key === " ") return "Space";
  if (key >= "0" && key <= "9") return "Digit" + key;
  const upper = key.toUpperCase();
  if (upper.length === 1 && upper >= "A" && upper <= "Z") return "Key" + upper;
  return "";
}

/**Email and number inputs have no selection api*/
function no_selection(element: HTMLElement): boolean {
  return (
    element.tagName === "INPUT" &&
    (element as HTMLInputElement).selectionStart === null
  );
}

export class Keyboard_Keys extends KeyboardBase {
  static element_name(): string {
    return "keyboard-keys";
  }

  #layer = state.ok_w("default");
  readonly layer = this.#layer.read_only;
  #changed = false;

  constructor(config: KeyboardConfig) {
    super();
    const container = this.appendChild(document.createElement("div"));
    this.addEventListener("mousedown", (e) => e.preventDefault());

    this.classList.add("keyboard");
    const layer_map: Record<string, KeyboardLayer> = {};
    [
      ["default", config.default] as [string, KeyboardLayerConfig],
      ...(config.layers ? Object.entries(config.layers) : []),
    ].forEach((l) => {
      const [layer_name, layer_config] = l;
      const layer = new KeyboardLayer(this, layer_config);
      layer_map[layer_name] = layer;
    });

    this.attach_state(this.#layer, (v) => {
      container.replaceChildren(layer_map[v.value] ?? layer_map["default"]);
    });
  }

  open(element: HTMLElement): void {
    //Edits of the previous element are done when the keyboard moves to another
    if (element !== this.elem) this.#dispatch_change();
    super.open(element);
    this.#layer.write("default");
  }

  close(): void {
    this.#dispatch_change();
    super.close();
  }

  #dispatch_change(): void {
    if (this.elem && this.#changed)
      this.elem.dispatchEvent(new Event("change", { bubbles: true }));
    this.#changed = false;
  }

  #dis_keydown(opts?: KeyboardEventInit): boolean {
    return (
      this.elem?.dispatchEvent(
        new KeyboardEvent("keydown", { ...KEO, ...opts }),
      ) ?? false
    );
  }
  #dis_keypress(opts?: KeyboardEventInit): boolean {
    return (
      this.elem?.dispatchEvent(
        new KeyboardEvent("keypress", { ...KEO, ...opts }),
      ) ?? false
    );
  }
  #dis_keyup(opts?: KeyboardEventInit): boolean {
    return (
      this.elem?.dispatchEvent(
        new KeyboardEvent("keyup", { ...KEO, ...opts }),
      ) ?? false
    );
  }
  #dis_input(opts?: InputEventInit): boolean {
    return (
      this.elem?.dispatchEvent(
        new InputEvent("input", { ...IEO, cancelable: false, ...opts }),
      ) ?? false
    );
  }
  #dis_beforeinput(opts?: InputEventInit): boolean {
    return (
      this.elem?.dispatchEvent(
        new InputEvent("beforeinput", { ...IEO, cancelable: true, ...opts }),
      ) ?? false
    );
  }

  /**Edits like a typed key, beforeinput, the edit, then input*/
  #edit(data: string | null, input_type: string): void {
    if (!this.#dis_beforeinput({ data, inputType: input_type })) return;
    const edited = this.#edit_value(data ?? "", data === null);
    if (!edited) return;
    this.#changed = true;
    if (edited !== "native") this.#dis_input({ data, inputType: input_type });
  }

  /**Returns "native" when the browser dispatched the input event itself*/
  #edit_value(data: string, delete_backward = false): boolean | "native" {
    const element = this.elem;
    if (!element) return false;

    //Setting the value of a number input clears partial numbers like "-" or "1.",
    //execCommand edits the text at the cursor like the user would
    if (no_selection(element)) {
      let edited = false;
      const mark = () => (edited = true);
      element.addEventListener("input", mark);
      element.focus();
      element.ownerDocument.execCommand(
        delete_backward ? "delete" : "insertText",
        false,
        data,
      );
      element.removeEventListener("input", mark);
      return edited && "native";
    }

    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      if (start === null || end === null) return false;

      const replace_start =
        delete_backward && start === end ? start - 1 : start;
      if (replace_start < 0) return false;
      input.setRangeText(data, replace_start, end, "end");
      return true;
    }

    if (!element.isContentEditable) return false;
    const selection = element.ownerDocument.getSelection();
    if (!selection?.rangeCount) return false;
    let range = selection.getRangeAt(0);
    if (!element.contains(range.commonAncestorContainer)) return false;

    if (delete_backward && range.collapsed) {
      selection.modify("extend", "backward", "character");
      if (!selection.rangeCount) return false;
      range = selection.getRangeAt(0);
      if (range.collapsed) return false;
    }
    if (delete_backward || !range.collapsed) range.deleteContents();
    if (data) {
      const text = element.ownerDocument.createTextNode(data);
      range.insertNode(text);
      range.setStartAfter(text);
    }
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  execute_key(key: string): void {
    if (!this.elem) return this.close();
    if (key.length === 0) return this.close();
    if (key.includes("layer")) {
      const layer_name = key.split(":")[1];
      if (layer_name === this.#layer.ok()) this.#layer.write("default");
      else this.#layer.write(layer_name);
      return;
    }
    if (key === KeyboardSpecialKeys.Close) return this.close();

    const special_keys: Partial<
      Record<KeyboardSpecialKeys, KeyboardEventInit>
    > = {
      [KeyboardSpecialKeys.Backspace]: { key: "Backspace", code: "Backspace" },
      [KeyboardSpecialKeys.Enter]: { key: "Enter", code: "Enter" },
      [KeyboardSpecialKeys.Escape]: { key: "Escape", code: "Escape" },
      [KeyboardSpecialKeys.Left]: { key: "ArrowLeft", code: "ArrowLeft" },
      [KeyboardSpecialKeys.Right]: { key: "ArrowRight", code: "ArrowRight" },
    };
    const opts = special_keys[key as KeyboardSpecialKeys] ?? {
      key,
      code: key_code(key),
    };

    if (this.#dis_keydown(opts)) {
      if (key.length === 1) {
        this.#dis_keypress(opts);
        this.#edit(key, "insertText");
      } else if (key === KeyboardSpecialKeys.Backspace)
        this.#edit(null, "deleteContentBackward");
      else if (
        key === KeyboardSpecialKeys.Enter &&
        this.elem.tagName !== "INPUT"
      )
        this.#edit("\n", "insertLineBreak");
      else if (key === KeyboardSpecialKeys.Left) this.#move_cursor(-1);
      else if (key === KeyboardSpecialKeys.Right) this.#move_cursor(1);
    }
    this.#dis_keyup(opts);
    if (key === KeyboardSpecialKeys.Enter) this.#dispatch_change();
  }

  #move_cursor(by: -1 | 1): void {
    const element = this.elem!;
    if (no_selection(element)) {
      element.focus();
      element.ownerDocument
        .getSelection()
        ?.modify("move", by < 0 ? "backward" : "forward", "character");
    } else
      set_cursor_position(
        element,
        Math.max(get_cursor_position(element) + by, 0),
      );
  }
}
define_element(Keyboard_Keys);
