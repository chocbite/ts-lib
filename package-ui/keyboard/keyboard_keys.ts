import { Base, define_element } from "#base";
import { get_cursor_position, set_cursor_position } from "#selection";
import { some } from "@chocbite/ts-lib/result";
import state, { type StateOrValRES } from "@chocbite/ts-lib/state";
import { KeyboardBase } from "./base";
import "./keyboard_keys.scss";
import { keyboard_language_picker } from "./picker";
import "./shared";
import {
  KeyboardConfig,
  KeyboardLayerConfig,
  KeyboardSpecialKeys,
} from "./types";

const SPECIAL_KEYS: ReadonlySet<string> = new Set(
  Object.values(KeyboardSpecialKeys),
);

/**How long a key is held before the keys it can type when held are shown*/
const HOLD_MS = 400;
/**How far a held key is slid before the key under the pointer is chosen instead of the first*/
const SLIDE_PX = 8;

const COMBINING = /^\p{M}/u;
/**The text showing what a key types, a combining mark on a dotted circle, alone it would sit on nothing*/
const shown = (key: string) => (COMBINING.test(key) ? "◌" + key : key);

/**The keys a held key can type, in a row above it, the one under the pointer is typed when the key is let go*/
class KeyboardHold extends Base {
  static element_name(): string {
    return "hold";
  }

  static element_name_space(): string {
    return "onscreen-keyboard";
  }

  #items: HTMLElement[];
  #keys: readonly string[];
  #chosen = 0;

  constructor(
    keyboard: HTMLElement,
    key: HTMLElement,
    keys: readonly string[],
  ) {
    super();
    this.#keys = keys;
    const key_rect = key.getBoundingClientRect();
    this.style.gridTemplateColumns = `repeat(${keys.length}, ${key_rect.width}px)`;
    this.style.height = key_rect.height + "px";
    this.#items = keys.map((k) => {
      const item = this.appendChild(document.createElement("div"));
      item.textContent = shown(k);
      return item;
    });
    keyboard.appendChild(this);
    const board = keyboard.getBoundingClientRect();
    const width = this.getBoundingClientRect().width;
    //The first key is right above the held key, so letting go without sliding types it, the hint in the corner
    const padding = parseFloat(getComputedStyle(this).paddingLeft) || 0;
    const left = key_rect.left - board.left - padding;
    this.style.left = Math.max(0, Math.min(left, board.width - width)) + "px";
    this.style.bottom = board.bottom - key_rect.top + 4 + "px";
    this.#mark(0);
  }

  #mark(index: number): void {
    this.#items[this.#chosen]?.removeAttribute("active");
    this.#chosen = index;
    this.#items[index]?.setAttribute("active", "true");
  }

  /**Chooses the key at the horizontal position of the pointer, the first or last when the pointer is beyond them*/
  track(x: number): void {
    const index = this.#items.findIndex(
      (item) => x < item.getBoundingClientRect().right,
    );
    this.#mark(index === -1 ? this.#items.length - 1 : index);
  }

  /**The key under the pointer*/
  get chosen(): string {
    return this.#keys[this.#chosen];
  }
}
define_element(KeyboardHold);

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
    hold: readonly string[] | undefined,
    dead: boolean,
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
    if (hold?.length) this.#holdable(keyboard, key, hold);
    else this.onclick = () => keyboard.execute_key(key);
    //Special and layer keys look different from the keys that type
    if (SPECIAL_KEYS.has(key)) this.setAttribute("special", key);
    else if (key.startsWith("layer:")) this.setAttribute("special", "layer");
    //A dead key shows that it is waiting for the next key
    if (dead) {
      this.setAttribute("dead", "");
      this.attach_state_ROA_to_attribute_map("active", keyboard.pending, (v) =>
        some(v === key ? "true" : "false"),
      );
    }
    if (key.includes("layer")) {
      const layer_name = key.split(":")[1];
      this.attach_state_ROA_to_attribute_map("active", keyboard.layer, (v) =>
        some(v === layer_name ? "true" : "false"),
      );
    }
  }

  /**A tap types the key, holding it shows what else it types, which is typed by letting go over it*/
  #holdable(
    keyboard: Keyboard_Keys,
    key: string,
    hold: readonly string[],
  ): void {
    this.setAttribute("hint", shown(hold[0]));
    let timer: ReturnType<typeof setTimeout> | undefined;
    let popup: KeyboardHold | undefined;
    let held = false;
    let start = 0;
    let sliding = false;
    const stop = () => {
      clearTimeout(timer);
      timer = undefined;
      popup?.remove();
      popup = undefined;
    };
    this.onpointerdown = (e) => {
      if (e.button !== 0) return;
      stop();
      held = false;
      //The moves while held come to the key, also outside it, a pointer that is no longer down cannot be captured
      try {
        this.setPointerCapture(e.pointerId);
      } catch {
        /* empty */
      }
      start = e.clientX;
      sliding = false;
      timer = setTimeout(() => {
        held = true;
        popup = new KeyboardHold(keyboard, this, hold);
      }, HOLD_MS);
    };
    //The first key stays chosen until the pointer slides, so a finger shaking a little still types the hint
    this.onpointermove = (e) => {
      if (!popup) return;
      sliding ||= Math.abs(e.clientX - start) > SLIDE_PX;
      if (sliding) popup.track(e.clientX);
    };
    this.onpointerup = () => {
      const chosen = popup?.chosen;
      stop();
      if (chosen) keyboard.execute_key(chosen);
    };
    this.onpointercancel = stop;
    this.onclick = () => {
      if (held) held = false;
      else keyboard.execute_key(key);
    };
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
            k.hold,
            config.dead_keys !== false && keyboard.is_dead(k.key ?? text),
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
  #container = this.appendChild(document.createElement("div"));
  #config?: KeyboardConfig;
  #layers: Record<string, KeyboardLayer> = {};
  #layer_configs: Record<string, KeyboardLayerConfig> = {};
  #dead_keys: { readonly [keys: string]: string } = {};
  #dead_starts = new Set<string>();
  #pending = state.ok_w("");
  /**The dead key waiting for the next key, empty when none*/
  readonly pending = this.#pending.read_only;
  #close_picker?: () => void;

  /**@param config the layout, or a state of it to change the layout while the keyboard is in use*/
  constructor(config: StateOrValRES<KeyboardConfig>) {
    super();
    this.addEventListener("mousedown", (e) => e.preventDefault());
    //Holding a key on a touch screen would open the context menu
    this.addEventListener("contextmenu", (e) => e.preventDefault());
    this.classList.add("keyboard");

    this.attach_state(this.#layer, () => this.#show());
    if (state.is.state_of(config))
      this.attach_state(config, (v) => {
        if (v.ok) this.#build(v.value);
      });
    else this.#build(config);
  }

  /**Whether the key is a dead key of the layout, it types nothing until the next key*/
  is_dead(key: string): boolean {
    return this.#dead_starts.has(key);
  }

  #build(config: KeyboardConfig): void {
    if (config === this.#config) return;
    this.#config = config;
    this.#pending.write("");
    this.#dead_keys = config.dead_keys ?? {};
    this.#dead_starts = new Set(
      Object.keys(this.#dead_keys)
        .map((keys) => [...keys])
        .filter((keys) => keys.length > 1)
        .map((keys) => keys.slice(0, -1).join("")),
    );
    this.#layers = {};
    this.#layer_configs = {
      ...config.layers,
      default: config.default,
    };
    for (const [name, layer] of Object.entries(this.#layer_configs))
      this.#layers[name] = new KeyboardLayer(this, layer);
    this.#show();
  }

  #show(): void {
    const layer = this.#layers[this.#layer.ok()] ?? this.#layers["default"];
    if (layer && this.#container.firstChild !== layer)
      this.#container.replaceChildren(layer);
  }

  open(element: HTMLElement): void {
    //Edits of the previous element are done when the keyboard moves to another
    if (element !== this.elem) this.#dispatch_change();
    super.open(element);
    this.#layer.write("default");
  }

  close(): void {
    this.#dispatch_change();
    this.#pending.write("");
    this.#close_picker?.();
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
    if (key === KeyboardSpecialKeys.Language) {
      this.#close_picker?.();
      const close = keyboard_language_picker(this, this.elem);
      this.#close_picker = () => {
        this.#close_picker = undefined;
        close();
      };
      return;
    }

    const typing = !SPECIAL_KEYS.has(key);
    //A dead key waits for the next key, which types what the two make together, or both when they make nothing
    //A layer without dead keys, like the symbols, types its keys as they are
    const dead =
      (this.#layer_configs[this.#layer.ok()] ?? this.#layer_configs.default)
        ?.dead_keys !== false;
    const pending = this.#pending.ok();
    if (pending) {
      this.#pending.write("");
      if (typing)
        key = (dead && this.#dead_keys[pending + key]) || pending + key;
      else if (key === KeyboardSpecialKeys.Backspace) return;
    } else if (typing && dead && this.#dead_starts.has(key)) {
      this.#pending.write(key);
      return;
    }

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
      if (typing) {
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
