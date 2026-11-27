import { Base, define_element } from "#base";
import {
  list_is_range,
  list_range_read,
  list_range_text,
  LIST_NUMBER_OPERATORS,
  LIST_STRING_TYPED,
  LIST_TYPED_STRING,
  list_condition_text,
  type ListCondition,
  type ListNumberOperator,
} from "./search";
import type { ListDataType, ListEnumChoices } from "./types";

/**Shown in front of the summary of conditions a cell can not edit, the advanced filter of the column */
export const LIST_SEARCH_ADVANCED = "&";

/**Cell of a column in the column search, under the title of the column, edits the one simple condition of its column
 * Conditions it can not edit, like a range from the app, show as a summary with a button that clears them */
export abstract class ListSearchCell extends Base {
  static element_name_space() {
    return "list";
  }

  /**Called with the condition the user gave the column, undefined for none, now to search without waiting */
  on_change?: (condition: ListCondition | undefined, now: boolean) => void;
  /**Called to open the advanced search, for & typed in the cell, which starts a condition of the column, or a press on the summary */
  on_advanced?: (start: boolean) => void;
  /**Key of the column */
  readonly column: string;
  #summary = document.createElement("span");
  #read_only = false;
  #summary_shown = false;

  constructor(column: string) {
    super();
    this.column = column;
    this.classList.add("list-search-cell", "empty");
    this.#summary.className = "summary";
    this.#summary.onclick = (e) => {
      e.stopPropagation();
      if (!this.#read_only) this.on_advanced?.(false);
    };
    this.appendChild(this.#summary);
    const clear = this.appendChild(document.createElement("span"));
    clear.className = "clear";
    clear.onclick = (e) => {
      e.stopPropagation();
      if (!this.#read_only) this.change(undefined, true);
    };
  }

  /**Shows the conditions of the column, the one simple condition it edits or a summary of others
   * @param more whether the column has more to it than the cell can show, like conditions in groups, the summary ends with …*/
  show_conditions(conditions: readonly ListCondition[], more = false) {
    this.#summary_shown =
      more ||
      conditions.length > 1 ||
      (conditions.length === 1 && !this.edits(conditions[0]));
    this.classList.toggle("summary-shown", this.#summary_shown);
    this.classList.toggle("empty", conditions.length === 0 && !more);
    if (this.#summary_shown)
      this.#summary.textContent =
        LIST_SEARCH_ADVANCED +
        " " +
        conditions.map((condition) => this.describe(condition)).join(", ") +
        (more ? (conditions.length ? " …" : "…") : "");
    else this.show(conditions[0]);
  }

  /**Locks the cell, for a read only filter state */
  set read_only(value: boolean) {
    this.#read_only = value;
    this.classList.toggle("read-only", value);
    this.lock(value);
  }

  /**Whether the user can change the condition of the cell now, not while locked or showing a summary */
  protected get editing(): boolean {
    return !this.#read_only && !this.#summary_shown;
  }

  /**Short text of a condition for the summary */
  protected describe(condition: ListCondition): string {
    return list_condition_text(condition);
  }

  /**Whether the cell edits the condition, otherwise it shows it as a summary */
  protected abstract edits(condition: ListCondition): boolean;
  /**Shows the condition the cell edits, undefined for none */
  protected abstract show(condition: ListCondition | undefined): void;
  protected lock(_read_only: boolean) {}

  /**Gives the condition the user set to the list */
  protected change(condition: ListCondition | undefined, now: boolean) {
    this.classList.toggle("empty", !condition);
    this.on_change?.(condition, now);
  }
}

//      _________     _______  ______ _____
//     |__   __\ \   / /  __ \|  ____|  __ \
//        | |   \ \_/ /| |__) | |__  | |  | |
//        | |    \   / |  ___/|  __| | |  | |
//        | |     | |  | |    | |____| |__| |
//        |_|     |_|  |_|    |______|_____/

/**The operator of an empty cell and of a value typed without one, a similar text */
const SIMILAR = "~";

/**Operators typed in front of the value, longest first so >= is not read as >, the single keys ≥ ≤ ≠ are read as their pairs */
const OPERATORS: readonly (readonly [string, string])[] = [
  ["!=", "!="],
  ["!~", "!~"],
  [">=", ">="],
  ["<=", "<="],
  ["≥", ">="],
  ["≤", "<="],
  ["≠", "!="],
  ["~", "~"],
  ["=", "="],
  [">", ">"],
  ["<", "<"],
  ["^", "^"],
  ["$", "$"],
  [LIST_SEARCH_ADVANCED, LIST_SEARCH_ADVANCED],
];

/**The operator and the value of the text of a cell, without an operator it is similar */
function split(text: string): { op: string; value: string } {
  const start = text.trimStart();
  for (const [typed, op] of OPERATORS)
    if (start.startsWith(typed))
      return { op, value: start.slice(typed.length).trim() };
  return { op: SIMILAR, value: start.trim() };
}

/**Text or number cell, the value is typed after an operator, ~ for a similar text when there is none
 * The operator starts as ~ with the caret after it, backspace and another operator change it */
abstract class ListSearchTyped extends ListSearchCell {
  #input = document.createElement("input");
  /**The condition last shown, shown again after & is typed */
  #shown?: ListCondition;

  constructor(column: string) {
    super(column);
    const input = this.#input;
    input.type = "text";
    input.spellcheck = false;
    input.autocomplete = "off";
    input.value = SIMILAR;
    input.oninput = () => this.#typed(false);
    input.onkeydown = (e) => {
      if (!this.editing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        this.#typed(true);
      } else if (e.key === "Escape" && input.value !== SIMILAR) {
        e.preventDefault();
        e.stopPropagation();
        input.value = SIMILAR;
        this.#typed(true);
      }
    };
    //The caret goes after the operator of an empty cell, a click puts it where it lands after the focus, so it waits for that
    input.onfocus = () =>
      setTimeout(() => {
        if (this.ownerDocument.activeElement !== input) return;
        if (split(input.value).value !== "") return;
        input.setSelectionRange(input.value.length, input.value.length);
      });
    this.prepend(input);
  }

  /**The condition of an operator and a value, null when they make no condition of the column */
  protected abstract read(op: string, value: string): ListCondition | null;
  /**The text of a condition the cell edits, its operator and value */
  protected abstract write(condition: ListCondition): string;

  /**The condition of the typed text, undefined without a value or for the advanced filter, null when it can not be read */
  #condition(): ListCondition | undefined | null {
    const { op, value } = split(this.#input.value);
    if (!value || op === LIST_SEARCH_ADVANCED) return undefined;
    return this.read(op, value);
  }

  #typed(now: boolean) {
    if (split(this.#input.value).op === LIST_SEARCH_ADVANCED) {
      //& is the advanced search, the cell keeps its condition and the advanced search starts a new one of the column
      this.#input.value = this.#shown ? this.write(this.#shown) : SIMILAR;
      this.classList.remove("invalid");
      this.on_advanced?.(true);
      return;
    }
    const condition = this.#condition();
    this.classList.toggle("invalid", condition === null);
    this.change(condition ?? undefined, now);
  }

  protected show(condition: ListCondition | undefined) {
    this.#shown = condition;
    //What is typed stays while it means the same, with its spaces and single keys, and so does a value that can not be read yet
    const typed = this.#condition() ?? undefined;
    if (JSON.stringify(typed) === JSON.stringify(condition)) return;
    this.#input.value = condition ? this.write(condition) : SIMILAR;
    this.classList.remove("invalid");
  }

  protected lock(read_only: boolean) {
    this.#input.readOnly = read_only;
  }
}

/**Text cell, ~ contains, !~ does not contain, = is the whole text, != is not and ^ starts with, all ignoring case */
class ListSearchText extends ListSearchTyped {
  static element_name() {
    return "searchtext";
  }

  protected read(op: string, value: string): ListCondition | null {
    const string_op = LIST_TYPED_STRING[op];
    //Text can not be compared by size
    if (!string_op) return null;
    return { column: this.column, type: "string", op: string_op, value };
  }

  protected write(condition: ListCondition): string {
    if (condition.type !== "string") return SIMILAR;
    return LIST_STRING_TYPED[condition.op] + condition.value;
  }

  protected edits(condition: ListCondition): boolean {
    return condition.type === "string";
  }
}
define_element(ListSearchText);

/**Number cell, ~ finds the number as text, like 4 in 45 and 2.4, and !~ leaves it out, = != < <= > >= compare numbers, a comma is a decimal point
 * Two numbers with .. between them are a range, both ends in it, 30..50 is between, with = or ~ as well, !=30..50 not between */
class ListSearchNumber extends ListSearchTyped {
  static element_name() {
    return "searchnumber";
  }

  protected read(op: string, value: string): ListCondition | null {
    const range = list_range_read(value);
    if (range) {
      if (op === "~" || op === "=")
        return {
          column: this.column,
          type: "number",
          op: "between",
          value: range,
        };
      if (op === "!~" || op === "!=")
        return {
          column: this.column,
          type: "number",
          op: "not_between",
          value: range,
        };
      //A range can not be smaller or bigger
      return null;
    }
    if (op === "~" || op === "!~")
      return {
        column: this.column,
        type: "string",
        op: LIST_TYPED_STRING[op],
        value,
      };
    const number = Number(value.replace(",", "."));
    if (!LIST_NUMBER_OPERATORS.includes(op) || !Number.isFinite(number))
      return null;
    return {
      column: this.column,
      type: "number",
      op: op as ListNumberOperator,
      value: number,
    };
  }

  protected write(condition: ListCondition): string {
    if (list_is_range(condition))
      return list_range_text(condition.op, condition.value);
    if (condition.type === "number") return condition.op + condition.value;
    if (condition.type === "string")
      return LIST_STRING_TYPED[condition.op] + condition.value;
    return SIMILAR;
  }

  protected edits(condition: ListCondition): boolean {
    return (
      condition.type === "number" ||
      (condition.type === "string" &&
        (condition.op === "contains" || condition.op === "not_contains"))
    );
  }
}
define_element(ListSearchNumber);

/**Bool cell, a press goes from any to yes to no and back to any */
class ListSearchBool extends ListSearchCell {
  static element_name() {
    return "searchbool";
  }

  #value?: boolean;

  constructor(column: string) {
    super(column);
    const glyph = document.createElement("span");
    glyph.className = "glyph";
    this.prepend(glyph);
    this.tabIndex = 0;
    this.onclick = () => this.#next();
    this.onkeydown = (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      this.#next();
    };
  }

  #next() {
    if (!this.editing) return;
    const next =
      this.#value === undefined ? true : this.#value ? false : undefined;
    this.change(
      next === undefined
        ? undefined
        : { column: this.column, type: "bool", value: next },
      true,
    );
  }

  protected edits(condition: ListCondition): boolean {
    return condition.type === "bool";
  }

  protected show(condition: ListCondition | undefined) {
    this.#value = condition?.type === "bool" ? condition.value : undefined;
    this.classList.toggle("yes", this.#value === true);
    this.classList.toggle("no", this.#value === false);
  }
}
define_element(ListSearchBool);

/**Cell of a column without a type, it can not filter, but shows the conditions the app gives the column */
class ListSearchNone extends ListSearchCell {
  static element_name() {
    return "searchnone";
  }

  protected edits(): boolean {
    return false;
  }

  protected show() {}
}
define_element(ListSearchNone);

/**Choices of an enum cell folded down under it, over the rows, a press on one picks it or leaves it out */
class ListSearchChoices extends Base {
  static element_name() {
    return "searchchoices";
  }
  static element_name_space() {
    return "list";
  }

  constructor(
    choices: ListEnumChoices,
    toggle: (value: string) => void,
    clear_all: () => void,
  ) {
    super();
    const clear = this.appendChild(document.createElement("div"));
    clear.className = "clear-all";
    clear.tabIndex = 0;
    clear.textContent = "Clear all";
    clear.onclick = (e) => {
      e.stopPropagation();
      clear_all();
    };
    clear.onkeydown = (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      clear_all();
    };
    for (const [value, choice] of Object.entries(choices)) {
      const line = this.appendChild(document.createElement("div"));
      line.className = "choice";
      line.tabIndex = 0;
      line.dataset.value = value;
      if (choice.icon) line.appendChild(choice.icon());
      line.append(choice.name);
      line.onclick = (e) => {
        //Not to the cell, which would close it
        e.stopPropagation();
        toggle(value);
      };
      line.onkeydown = (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        toggle(value);
      };
    }
  }

  set selected(values: readonly string[]) {
    this.classList.toggle("none", values.length === 0);
    for (const line of this.querySelectorAll<HTMLElement>(":scope > .choice"))
      line.classList.toggle(
        "picked",
        values.includes(line.dataset.value ?? ""),
      );
  }
}
define_element(ListSearchChoices);

/**Enum cell, rows whose value is one of the picked choices
 * A press folds the choices down under the cell, they stay until a press outside, escape or a press on the cell */
class ListSearchEnum extends ListSearchCell {
  static element_name() {
    return "searchenum";
  }

  readonly #choices: ListEnumChoices;
  #text = document.createElement("span");
  /**Values picked, in the order of the choices */
  #picked: string[] = [];
  /**The folded down choices while open */
  #panel?: ListSearchChoices;
  #outside = (e: Event) => {
    if (!e.composedPath().includes(this)) this.#close();
  };

  constructor(column: string, choices: ListEnumChoices) {
    super(column);
    this.#choices = choices;
    this.#text.className = "text";
    this.#text.textContent = "Any";
    this.prepend(this.#text);
    this.tabIndex = 0;
    this.onclick = () => (this.#panel ? this.#close() : this.#open());
    this.onkeydown = (e) => {
      if (e.key === "Escape" && this.#panel) {
        e.preventDefault();
        e.stopPropagation();
        this.#close();
        this.focus();
      } else if ((e.key === "Enter" || e.key === " ") && e.target === this) {
        e.preventDefault();
        if (this.#panel) this.#close();
        else this.#open();
      }
    };
  }

  #open() {
    if (!this.editing) return;
    const panel = (this.#panel = new ListSearchChoices(
      this.#choices,
      (v) => this.#toggle(v),
      () => this.#clear_all(),
    ));
    panel.selected = this.#picked;
    this.appendChild(panel);
    //It is inside the scrolling box of the list, so it fits in what is left of it under the cell, and turns to the left at the right side
    const list = this.closest("list-container");
    if (list) {
      const box = list.getBoundingClientRect();
      const bottom = box.top + list.clientTop + list.clientHeight;
      const right = box.left + list.clientLeft + list.clientWidth;
      const cell = this.getBoundingClientRect();
      panel.style.maxHeight = `${Math.max(bottom - cell.bottom, 0)}px`;
      if (panel.getBoundingClientRect().right > right)
        panel.classList.add("right");
    }
    this.ownerDocument.addEventListener("pointerdown", this.#outside, true);
  }

  #close() {
    this.#panel?.remove();
    this.#panel = undefined;
    this.ownerDocument.removeEventListener("pointerdown", this.#outside, true);
  }

  protected disconnectedCallback() {
    super.disconnectedCallback();
    this.#close();
  }

  #toggle(value: string) {
    if (!this.editing) return;
    const picked = this.#picked.includes(value)
      ? this.#picked.filter((one) => one !== value)
      : [...this.#picked, value];
    const values = Object.keys(this.#choices).filter((one) =>
      picked.includes(one),
    );
    //Shown right away, the condition the list gives back shows it again
    this.#show_picked(values);
    this.change(
      values.length
        ? { column: this.column, type: "enum", op: "in", value: values }
        : undefined,
      true,
    );
  }

  #clear_all() {
    if (!this.editing || this.#picked.length === 0) return;
    this.#show_picked([]);
    this.change(undefined, true);
  }

  #show_picked(values: string[]) {
    this.#picked = values;
    this.#text.textContent = values.length
      ? values.map((value) => this.#choices[value]?.name ?? value).join(", ")
      : "Any";
    if (this.#panel) this.#panel.selected = values;
  }

  protected edits(condition: ListCondition): boolean {
    return condition.type === "enum" && condition.op === "in";
  }

  protected show(condition: ListCondition | undefined) {
    this.#show_picked(
      condition?.type === "enum" ? condition.value.map(String) : [],
    );
  }

  protected describe(condition: ListCondition): string {
    if (condition.type !== "enum") return super.describe(condition);
    const names = condition.value.map(
      (value) => this.#choices[String(value)]?.name ?? String(value),
    );
    return (condition.op === "in" ? "" : "not ") + names.join(" or ");
  }
}
define_element(ListSearchEnum);

/**The cell of the column search for a column of the type, enum columns pick from the choices */
export function list_search_cell(
  type: ListDataType | undefined,
  column: string,
  choices: ListEnumChoices = {},
): ListSearchCell {
  if (type === "string") return new ListSearchText(column);
  if (type === "number") return new ListSearchNumber(column);
  if (type === "bool") return new ListSearchBool(column);
  if (type === "enum") return new ListSearchEnum(column, choices);
  return new ListSearchNone(column);
}
