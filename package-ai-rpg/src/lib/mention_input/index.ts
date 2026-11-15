//A multi line text input where things are mentioned by picking them from suggestions.
//A trigger key (by its keyboard code, or a typed character like @, the character is never typed) opens the suggestions, typing narrows them,
//arrows and Enter or Tab pick one, Escape closes. A picked thing becomes a chip, an element that can not be edited,
//made by the app, and is deleted as a whole. The value is plain text with mentions as [Name](id), see #lib/mention.
//It is an editable div with chips in it, a textarea can not hold elements.
import { el } from "#lib/dom";
import { mention_parse } from "#lib/mention";
import "./style.scss";

/**Something that can be mentioned*/
export interface MentionCandidate {
  id: string;
  /**Name shown in the chip and written in the mention*/
  name: string;
}

export interface MentionInputOptions<C extends MentionCandidate> {
  /**What can be mentioned now, asked for every time the suggestions open*/
  candidates: () => C[];
  /**Makes the chip of a mention, the candidate is undefined for a mention of something not among the candidates*/
  chip: (id: string, name: string, candidate: C | undefined) => HTMLElement;
  /**Makes a row of the suggestions*/
  suggestion: (candidate: C) => HTMLElement;
  /**Keyboard codes that open the suggestions, IntlBackslash (the key left of Z on ISO keyboards) when not given*/
  trigger_codes?: string[];
  /**Characters that open the suggestions when typed, @ when not given, whatever key they are on*/
  trigger_keys?: string[];
  placeholder?: string;
  /**Called on every change of the value by the user*/
  on_input?: (value: string) => void;
}

export interface MentionInput {
  /**The element to put in the page*/
  readonly element: HTMLDivElement;
  /**Text with mentions as [Name](id), setting it rebuilds the content*/
  value: string;
  placeholder: string;
  disabled: boolean;
  /**Whether the input has the focus*/
  readonly focused: boolean;
  focus(): void;
}

const MAX_SUGGESTIONS = 8;

export function mention_input<C extends MentionCandidate>(options: MentionInputOptions<C>): MentionInput {
  const trigger_codes = options.trigger_codes ?? ["IntlBackslash"];
  const trigger_keys = options.trigger_keys ?? ["@"];
  const element = el("div", "mention-input");
  element.contentEditable = "true";
  element.spellcheck = true;
  element.dataset.placeholder = options.placeholder ?? "";
  element.classList.add("empty");
  const popup = el("div", "mention-suggestions");
  popup.hidden = true;
  document.body.append(popup);

  let disabled = false;
  /**Where the typed query starts, a text node and an offset, while the suggestions are open*/
  let anchor: { node: Text; offset: number } | undefined;
  let shown: C[] = [];
  let active = 0;

  //      __      __     _     _    _ ______
  //      \ \    / /\   | |   | |  | |  ____|
  //       \ \  / /  \  | |   | |  | | |__
  //        \ \/ / /\ \ | |   | |  | |  __|
  //         \  / ____ \| |___| |__| | |____
  //          \/_/    \_\______\____/|______|

  const chip = (id: string, name: string) => {
    const made = options.chip(
      id,
      name,
      options.candidates().find((c) => c.id === id),
    );
    made.classList.add("mention-chip");
    made.contentEditable = "false";
    made.dataset.id = id;
    made.dataset.name = name;
    return made;
  };

  /**Text of the content, chips as mentions, line breaks as \n*/
  const read = () => {
    let text = "";
    const walk = (node: Node) => {
      for (const child of node.childNodes) {
        if (child instanceof Text) text += child.data;
        else if (child instanceof HTMLElement && child.dataset.id) text += `[${child.dataset.name}](${child.dataset.id})`;
        else if (child instanceof HTMLBRElement) text += "\n";
        //Browsers wrap lines in divs when Enter is pressed in some cases
        else if (child instanceof HTMLDivElement) {
          if (text && !text.endsWith("\n")) text += "\n";
          walk(child);
        } else walk(child);
      }
    };
    walk(element);
    //A browser keeps a trailing break so the last line shows, it is not part of the text
    return text.replace(/\n$/, "");
  };

  const write = (text: string) => {
    element.replaceChildren(...mention_parse(text).map((part) => (part.id ? chip(part.id, part.text) : document.createTextNode(part.text))));
  };

  const changed = () => {
    element.classList.toggle("empty", !element.textContent && !element.querySelector(".mention-chip"));
    options.on_input?.(read());
  };

  //       _____ _    _  _____  _____ ______  _____ _______ _____ ____  _   _  _____
  //      / ____| |  | |/ ____|/ ____|  ____|/ ____|__   __|_   _/ __ \| \ | |/ ____|
  //     | (___ | |  | | |  __| |  __| |__  | (___    | |    | || |  | |  \| | (___
  //      \___ \| |  | | | |_ | | |_ |  __|  \___ \   | |    | || |  | | . ` |\___ \
  //      ____) | |__| | |__| | |__| | |____ ____) |  | |   _| || |__| | |\  |____) |
  //     |_____/ \____/ \_____|\_____|______|_____/   |_|  |_____\____/|_| \_|_____/

  /**The caret, when it is a collapsed selection inside the input*/
  const caret = () => {
    const selection = document.getSelection();
    if (!selection?.rangeCount || !selection.isCollapsed) return undefined;
    const range = selection.getRangeAt(0);
    return element.contains(range.startContainer) ? range : undefined;
  };

  /**Starts the suggestions at the caret, with an empty query*/
  const open = () => {
    const range = caret();
    if (!range) return;
    let node = range.startContainer;
    let offset = range.startOffset;
    //The query lives in a text node, one is made when the caret is between elements
    if (!(node instanceof Text)) {
      const text = document.createTextNode("");
      range.insertNode(text);
      node = text;
      offset = 0;
      range.setStart(text, 0);
      range.collapse(true);
      const selection = document.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    }
    anchor = { node: node as Text, offset };
    active = 0;
    update();
  };

  const close = () => {
    anchor = undefined;
    popup.hidden = true;
  };

  /**What has been typed since the suggestions opened, undefined when the caret left the query*/
  const query = () => {
    const range = caret();
    if (!anchor || !range || range.startContainer !== anchor.node || range.startOffset < anchor.offset) return undefined;
    return anchor.node.data.slice(anchor.offset, range.startOffset);
  };

  /**Filters the candidates by the query, names starting with it first, and shows them at the caret*/
  const update = () => {
    const q = query();
    if (q === undefined || q.includes("\n")) return close();
    const lower = q.trim().toLowerCase();
    const all = options.candidates().filter((c) => c.name.toLowerCase().includes(lower));
    shown = [...all.filter((c) => c.name.toLowerCase().startsWith(lower)), ...all.filter((c) => !c.name.toLowerCase().startsWith(lower))].slice(0, MAX_SUGGESTIONS);
    if (!shown.length) {
      popup.hidden = true;
      return;
    }
    active = Math.min(active, shown.length - 1);
    popup.replaceChildren(
      ...shown.map((c, i) => {
        const row = options.suggestion(c);
        row.classList.add("mention-suggestion");
        row.classList.toggle("active", i === active);
        //Pointer down, not click, so the input keeps the focus and the caret
        row.onpointerdown = (e) => {
          e.preventDefault();
          pick(c);
        };
        return row;
      }),
    );
    popup.hidden = false;
    const rect = caret()!.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    //Above the caret when there is more room there, the input is usually at the bottom of the page
    const left = Math.min(rect.left || box.left, window.innerWidth - popup.offsetWidth - 8);
    popup.style.left = Math.max(8, left) + "px";
    if (box.top > window.innerHeight - box.bottom) {
      popup.style.top = "";
      popup.style.bottom = window.innerHeight - (rect.top || box.top) + 4 + "px";
    } else {
      popup.style.bottom = "";
      popup.style.top = (rect.bottom || box.bottom) + 4 + "px";
    }
  };

  /**Replaces the query with a chip of the candidate and a space after it*/
  const pick = (candidate: C) => {
    const range = caret();
    if (!anchor || !range) return close();
    range.setStart(anchor.node, anchor.offset);
    range.deleteContents();
    const space = document.createTextNode(" ");
    range.insertNode(space);
    range.insertNode(chip(candidate.id, candidate.name));
    range.setStart(space, 1);
    range.collapse(true);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    close();
    changed();
  };

  //      _____ _   _ _____  _    _ _______
  //     |_   _| \ | |  __ \| |  | |__   __|
  //       | | |  \| | |__) | |  | |  | |
  //       | | | . ` |  ___/| |  | |  | |
  //      _| |_| |\  | |    | |__| |  | |
  //     |_____|_| \_|_|     \____/   |_|

  element.addEventListener("keydown", (e) => {
    if (disabled) return;
    //A character like @ is often typed with AltGr, which sets ctrlKey and altKey, so modifiers only stop the code triggers
    const by_code = trigger_codes.includes(e.code) && !e.ctrlKey && !e.altKey && !e.metaKey;
    if (by_code || trigger_keys.includes(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return open();
    }
    if (!anchor || popup.hidden) {
      if (anchor && e.key === "Escape") close();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      active = (active + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length;
      update();
    } else if (e.key === "Enter" || e.key === "Tab") pick(shown[active]);
    else if (e.key === "Escape") close();
    else return;
    //Keys used by the suggestions do not reach the app, so Enter does not also submit
    e.preventDefault();
    e.stopImmediatePropagation();
  });
  //Line breaks are plain text, so the content stays a text with chips
  element.addEventListener("beforeinput", (e) => {
    if (e.inputType === "insertParagraph" || e.inputType === "insertLineBreak") {
      e.preventDefault();
      document.execCommand("insertText", false, "\n");
    }
  });
  element.addEventListener("input", () => {
    if (anchor) update();
    changed();
  });
  //Pasted text is inserted as plain text, mentions in it become chips
  element.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") ?? "";
    const range = caret();
    if (!range) return;
    const parts = mention_parse(text).map((part) => (part.id ? chip(part.id, part.text) : document.createTextNode(part.text)));
    for (const part of parts.reverse()) range.insertNode(part);
    range.collapse(false);
    changed();
  });
  element.addEventListener("blur", close);
  document.addEventListener("selectionchange", () => {
    if (anchor && document.activeElement === element) update();
  });

  return {
    element,
    get value() {
      return read();
    },
    set value(text: string) {
      if (text === read()) return;
      close();
      write(text);
      element.classList.toggle("empty", !text);
    },
    get placeholder() {
      return element.dataset.placeholder ?? "";
    },
    set placeholder(text: string) {
      element.dataset.placeholder = text;
    },
    get disabled() {
      return disabled;
    },
    set disabled(value: boolean) {
      disabled = value;
      element.contentEditable = value ? "false" : "true";
      element.classList.toggle("disabled", value);
      if (value) close();
    },
    get focused() {
      return document.activeElement === element;
    },
    focus: () => element.focus(),
  };
}
