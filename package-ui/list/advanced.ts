import { define_element } from "#base";
import { comp, ContentBase } from "#composition";
import form, { FormValueWrite, type FormSelections } from "#form";
import { material_add_rounded, material_delete_rounded } from "#icons";
import { ok, type ResultNice } from "@chocbite/ts-lib/result";
import { state } from "@chocbite/ts-lib/state";
import "./advanced.scss";
import {
  list_condition_text,
  list_filter_prune,
  list_is_group,
  list_is_range,
  list_range_read,
  LIST_NUMBER_OPERATORS,
  LIST_STRING_TYPED,
  LIST_TYPED_STRING,
  type ListCondition,
  type ListFilter,
  type ListFilterItem,
  type ListFilterMode,
  type ListNumberOperator,
} from "./search";
import type { ListDataType, ListEnumChoices } from "./types";

/**A visible column of the list, a condition can only be made on one with a type */
export interface ListAdvancedColumn {
  readonly key: string;
  readonly title: string;
  readonly type?: ListDataType;
  readonly choices?: ListEnumChoices;
}

/**Operators of the conditions on a type, the values are what is typed for them in the cells of the column search */
const OPERATORS: { readonly [type in ListDataType]: FormSelections<string> } = {
  string: [
    { value: "~", text: "~ contains" },
    { value: "!~", text: "!~ does not contain" },
    { value: "=", text: "= is" },
    { value: "!=", text: "!= is not" },
    { value: "^", text: "^ starts with" },
    { value: "$", text: "$ ends with" },
  ],
  number: [
    { value: "=", text: "= is" },
    { value: "!=", text: "!= is not" },
    { value: ">", text: "> more than" },
    { value: ">=", text: ">= at least" },
    { value: "<", text: "< less than" },
    { value: "<=", text: "<= at most" },
    { value: "between", text: "between" },
    { value: "not_between", text: "not between" },
    { value: "~", text: "~ contains" },
    { value: "!~", text: "!~ does not contain" },
  ],
  bool: [{ value: "=", text: "is" }],
  enum: [
    { value: "in", text: "is one of" },
    { value: "not_in", text: "is none of" },
  ],
};

/**How the conditions of a group combine, in words */
const MODES: FormSelections<ListFilterMode> = [
  { value: "all", text: "All of these" },
  { value: "any", text: "Any of these" },
  { value: "none", text: "None of these" },
];

/**Characters a number is typed with, a comma is a decimal point */
const NUMBER_CHARACTERS = /[\d.,\-+eE]/;

/**What the value of a condition is edited with */
type Editor = "text" | "number" | "range" | "bool" | "enum";

/**An item of a group, a condition or a group, its value is the condition or the group */
type Item = ListAdvancedCondition | ListAdvancedGroup;

//       _____ ____  _   _ _____ _____ _______ _____ ____  _   _
//      / ____/ __ \| \ | |  __ \_   _|__   __|_   _/ __ \| \ | |
//     | |   | |  | |  \| | |  | || |    | |    | || |  | |  \| |
//     | |   | |  | | . ` | |  | || |    | |    | || |  | | . ` |
//     | |___| |__| | |\  | |__| || |_   | |   _| || |__| | |\  |
//      \_____\____/|_| \_|_____/_____|  |_|  |_____\____/|_| \_|

/**A condition of the advanced search, a column, an operator for its type and a value
 * Its value is the condition, none while the user has not given a value yet, a group leaves it out then
 * A condition of a column it can not edit, without a type or not in the list, is shown as it is and kept */
class ListAdvancedCondition extends FormValueWrite<ListFilterItem, undefined> {
  static element_name() {
    return "advancedcondition";
  }
  static element_name_space() {
    return "list";
  }

  readonly #columns: readonly ListAdvancedColumn[];
  /**The columns a condition can be made on */
  readonly #typed: readonly ListAdvancedColumn[];
  #column = state.ok_w("");
  #op = state.ok_w("");
  #operators = state.ok_w<FormSelections<string>>([]);
  /**Value of a text or number condition, numbers are typed like in the cells */
  #text = state.ok_w("");
  /**The other end of a range, the first end is the text */
  #text_to = state.ok_w("");
  #bool = state.ok_w(true);
  #picked = state.ok_w<string[]>([]);
  #fields = document.createElement("div");
  #value = document.createElement("div");
  /**The text of a condition shown as it is */
  #fixed = document.createElement("span");
  /**The editor shown, by kind and for an enum by column, as its choices are those of the column */
  #editor = "";

  constructor(
    columns: readonly ListAdvancedColumn[],
    remove: (item: Item) => void,
  ) {
    super();
    this.#columns = columns;
    this.#typed = columns.filter((column) => column.type);
    this.#fields.className = "fields";
    this.#fields.append(
      form.dropdown({
        selections: this.#typed.map((column) => ({
          value: column.key,
          text: column.title,
        })),
        value: this.#column,
        change: () => this.#column_changed(),
      }),
      form.dropdown({
        selections: this.#operators,
        value: this.#op,
        change: () => {
          this.#show_editor();
          this.#changed();
        },
      }),
      this.#value,
    );
    this.#value.className = "value";
    this.#fixed.className = "fixed";
    this.append(
      this.#fields,
      this.#fixed,
      form.button({
        icon: material_delete_rounded,
        on_click: () => remove(this),
      }),
    );
  }

  /**Starts a new condition of the column, the first column with a type when not given, without a value yet */
  start(column?: string) {
    this.#show(undefined, column);
  }

  /**Given with set({ value }), a condition the row shows */
  protected new_value(item: ListFilterItem) {
    if (!list_is_group(item)) this.#show(item);
  }

  protected clear_value() {
    this.#show(undefined, this.#column.get().value || undefined);
  }

  protected state_related() {}

  #options(key: string): ListAdvancedColumn | undefined {
    return this.#typed.find((column) => column.key === key);
  }

  #show(condition: ListCondition | undefined, column?: string) {
    const key = condition?.column ?? column ?? this.#typed[0]?.key ?? "";
    const options = this.#options(key);
    this.classList.toggle("fixed", !options);
    if (!options) {
      //A column it can not edit, the condition is kept as it is
      const title = this.#columns.find((one) => one.key === key)?.title ?? key;
      this.#fixed.textContent =
        title + " " + (condition ? list_condition_text(condition) : "");
      return;
    }
    this.#column.set_ok(key);
    const operators = OPERATORS[options.type!];
    this.#operators.set_ok(operators);
    this.#op.set_ok(operators[0].value);
    switch (condition?.type) {
      case "string":
        this.#op.set_ok(LIST_STRING_TYPED[condition.op]);
        this.#text.set_ok(condition.value);
        break;
      case "number":
        this.#op.set_ok(condition.op);
        if (list_is_range(condition)) {
          this.#text.set_ok(String(condition.value[0]));
          this.#text_to.set_ok(String(condition.value[1]));
        } else this.#text.set_ok(String(condition.value));
        break;
      case "bool":
        this.#bool.set_ok(condition.value);
        break;
      case "enum":
        this.#op.set_ok(condition.op);
        this.#picked.set_ok(condition.value.map(String));
        break;
    }
    this.#show_editor();
  }

  /**The operators of the type of the new column, keeping the operator when the type has it */
  #column_changed() {
    const operators = OPERATORS[this.#options(this.#column.get().value)!.type!];
    this.#operators.set_ok(operators);
    if (!operators.some((op) => op.value === this.#op.get().value))
      this.#op.set_ok(operators[0].value);
    //Picked values are of the choices of the old column
    this.#picked.set_ok([]);
    this.#show_editor();
    this.#changed();
  }

  #show_editor() {
    const column = this.#options(this.#column.get().value);
    if (!column) return;
    const op = this.#op.get().value;
    const kind: Editor =
      column.type === "bool" || column.type === "enum"
        ? column.type
        : column.type !== "number" || op === "~" || op === "!~"
          ? "text"
          : op === "between" || op === "not_between"
            ? "range"
            : "number";
    const editor = kind === "enum" ? "enum " + column.key : kind;
    if (editor === this.#editor) return;
    this.#editor = editor;
    this.#value.replaceChildren(this.#make_editor(kind, column));
  }

  #make_editor(kind: Editor, column: ListAdvancedColumn): HTMLElement {
    const changed = () => this.#changed();
    const text_input = (value = this.#text, number = false) =>
      form.text_input({
        value,
        live: true,
        filter: number ? NUMBER_CHARACTERS : undefined,
        change: changed,
      });
    switch (kind) {
      case "text":
        return text_input();
      case "number":
        return text_input(this.#text, true);
      case "range": {
        const range = document.createElement("div");
        range.className = "range";
        const and = document.createElement("span");
        and.textContent = "and";
        range.append(
          text_input(this.#text, true),
          and,
          text_input(this.#text_to, true),
        );
        return range;
      }
      case "bool":
        return form.dropdown({
          selections: [
            { value: true, text: "Yes" },
            { value: false, text: "No" },
          ],
          value: this.#bool,
          change: changed,
        });
      case "enum":
        return form.dropdown_multi({
          selections: Object.entries(column.choices ?? {}).map(
            ([value, choice]) => ({
              value,
              text: choice.name,
              icon: choice.icon,
            }),
          ),
          value: this.#picked,
          change: changed,
        });
    }
  }

  /**The user changed a field, the value is the condition the fields make, none while it has no value */
  #changed() {
    const condition = this.#read();
    this._buffer = condition;
    if (condition) this.call_change(condition);
  }

  /**The condition of the fields, undefined while it has no value, or a number that can not be read */
  #read(): ListCondition | undefined {
    const column = this.#options(this.#column.get().value);
    if (!column) return undefined;
    const key = column.key;
    const op = this.#op.get().value;
    const text = this.#text.get().value.trim();
    switch (column.type) {
      case "string": {
        const string_op = LIST_TYPED_STRING[op];
        return text && string_op
          ? { column: key, type: "string", op: string_op, value: text }
          : undefined;
      }
      case "number": {
        if (!text) return undefined;
        //~ finds the number as text, like in a cell
        if (op === "~" || op === "!~")
          return {
            column: key,
            type: "string",
            op: LIST_TYPED_STRING[op],
            value: text,
          };
        if (op === "between" || op === "not_between") {
          const range = list_range_read(
            text + ".." + this.#text_to.get().value.trim(),
          );
          return range
            ? { column: key, type: "number", op, value: range }
            : undefined;
        }
        const number = Number(text.replace(",", "."));
        return Number.isFinite(number) && LIST_NUMBER_OPERATORS.includes(op)
          ? {
              column: key,
              type: "number",
              op: op as ListNumberOperator,
              value: number,
            }
          : undefined;
      }
      case "bool":
        return { column: key, type: "bool", value: this.#bool.get().value };
      case "enum": {
        const picked = this.#picked.get().value;
        return picked.length
          ? {
              column: key,
              type: "enum",
              op: op === "not_in" ? "not_in" : "in",
              value: [...picked],
            }
          : undefined;
      }
    }
    return undefined;
  }

  /**Short text of the condition, with the title of the column and the names of enum choices, for the summary of a collapsed group */
  get text(): string {
    const condition = this._buffer;
    if (!condition || list_is_group(condition)) return "";
    const column = this.#columns.find((one) => one.key === condition.column);
    const title = column?.title ?? condition.column;
    if (condition.type === "enum") {
      const names = condition.value.map(
        (value) => column?.choices?.[String(value)]?.name ?? String(value),
      );
      return (
        title + " " + (condition.op === "in" ? "" : "not ") + names.join(" or ")
      );
    }
    return title + " " + list_condition_text(condition);
  }

  /**Focuses the value, to type it right away */
  focus_value() {
    (
      this.#value.querySelector<HTMLElement>("input") ??
      (this.#value.firstElementChild as HTMLElement | null)
    )?.focus();
  }
}
define_element(ListAdvancedCondition);

//       _____ _____   ____  _    _ _____
//      / ____|  __ \ / __ \| |  | |  __ \
//     | |  __| |__) | |  | | |  | | |__) |
//     | | |_ |  _  /| |  | | |  | |  ___/
//     | |__| | | \ \| |__| | |__| | |
//      \_____|_|  \_\\____/ \____/|_|

/**A group of the advanced search, a header with the mode and buttons, and its items, conditions and groups, in an array group
 * Its value is the group, of the items that have a value, the root group is the whole filter, without collapse or remove */
class ListAdvancedGroup extends FormValueWrite<ListFilterItem, undefined> {
  static element_name() {
    return "advancedgroup";
  }
  static element_name_space() {
    return "list";
  }

  readonly #columns: readonly ListAdvancedColumn[];
  #mode = state.ok_w<ListFilterMode>("all");
  #items = state.ok_w<Item[]>([]);
  #array = form.group_array<ListFilterItem>({
    elements: this.#items,
    embed: true,
  });
  /**Whether the items are collapsed, written by the collapser of a nested group */
  #collapsed = state.ok_w(false);
  /**What is in the group, on the button of the collapser while it is collapsed */
  #summary = state.ok_w("");
  #none = document.createElement("div");

  /**@param remove removes the group from its parent, not given for the root group, which is not collapsed either*/
  constructor(
    columns: readonly ListAdvancedColumn[],
    remove?: (item: Item) => void,
  ) {
    super();
    this.#columns = columns;
    const header = document.createElement("div");
    header.className = "header";
    header.append(
      form.dropdown({ selections: MODES, value: this.#mode }),
      form.button({
        text: "Add condition",
        icon: material_add_rounded,
        on_click: () => this.add_condition().focus_value(),
      }),
      form.button({
        text: "Add group",
        icon: material_add_rounded,
        on_click: () => this.#add_group(),
      }),
    );
    if (remove)
      header.appendChild(
        form.button({
          icon: material_delete_rounded,
          on_click: () => remove(this),
        }),
      );
    this.#none.className = "none";
    this.#none.textContent = remove
      ? "Nothing in the group"
      : "No conditions, every row is shown";
    //A nested group collapses its items with the collapser of form, its button shows a summary of them then
    this.append(
      header,
      remove
        ? form.group_collapser(this.#array, {
            collapsed: this.#collapsed,
            closed_text: this.#summary,
          })
        : this.#array,
      this.#none,
    );
    this.attach_state(this.#collapsed, (collapsed) =>
      this.#show_collapsed(collapsed.value),
    );
  }

  /**The value is the group of the items that have one, always a value, an empty group is no condition */
  get get_value(): ResultNice<ListFilterItem> {
    return ok({
      type: "group",
      mode: this.#mode.get().value,
      conditions: this.#array.value_partial.value,
    });
  }

  /**The filter of the root group, all of the conditions is left out as it is the default */
  get filter(): ListFilter {
    const mode = this.#mode.get().value;
    const conditions = this.#array.value_partial.value;
    return list_filter_prune(
      mode === "all" ? { conditions } : { mode, conditions },
    );
  }

  /**Shows the filter in the root group */
  start(filter: ListFilter) {
    this.#mode.set_ok(filter.mode ?? "all");
    this.#set_items(filter.conditions.map((item) => this.#make(item)));
  }

  /**Given with set({ value }), a group the group shows */
  protected new_value(item: ListFilterItem) {
    if (list_is_group(item)) this.start(item);
  }

  protected clear_value() {
    this.#set_items([]);
  }

  protected state_related() {}

  #make(item: ListFilterItem): Item {
    return list_is_group(item)
      ? ListAdvancedGroup.create({ value: item }, this.#columns, this.#remove)
      : ListAdvancedCondition.create(
          { value: item },
          this.#columns,
          this.#remove,
        );
  }

  #remove = (item: Item) =>
    this.#set_items(this.#items.get().value.filter((one) => one !== item));

  #set_items(items: Item[]) {
    this.#items.set_ok(items);
    this.#none.hidden = items.length > 0;
    //Opened to show what changed
    this.#collapsed.set_ok(false);
  }

  /**Adds a condition, of the column or the first one with a type, without a value yet */
  add_condition(column?: string): ListAdvancedCondition {
    const condition = ListAdvancedCondition.create(
      {},
      this.#columns,
      this.#remove,
    );
    condition.start(column);
    this.#set_items([...this.#items.get().value, condition]);
    return condition;
  }

  /**Adds a group of all, with a condition to start with */
  #add_group() {
    const group = ListAdvancedGroup.create({}, this.#columns, this.#remove);
    this.#set_items([...this.#items.get().value, group]);
    group.add_condition().focus_value();
  }

  /**Removes every item */
  clear_all() {
    this.#set_items([]);
  }

  /**Shows a summary of the items on the button of the collapser while it has them collapsed */
  #show_collapsed(collapsed: boolean) {
    this.classList.toggle("collapsed", collapsed);
    if (collapsed) this.#summary.set_ok(this.text || this.#none.textContent);
  }

  /**Short text of what is in the group */
  get text(): string {
    return this.#items
      .get()
      .value.map((item) =>
        item instanceof ListAdvancedGroup
          ? "(" +
            MODES.find(
              (mode) => mode.value === item.#mode.get().value,
            )!.text.toLowerCase() +
            ")"
          : item.text,
      )
      .filter((text) => text)
      .join(", ");
  }
}
define_element(ListAdvancedGroup);

//       _____ ____  _   _ _______ ______ _   _ _______
//      / ____/ __ \| \ | |__   __|  ____| \ | |__   __|
//     | |   | |  | |  \| |  | |  | |__  |  \| |  | |
//     | |   | |  | | . ` |  | |  |  __| | . ` |  | |
//     | |___| |__| | |\  |  | |  | |____| |\  |  | |
//      \_____\____/|_| \_|  |_|  |______|_| \_|  |_|

/**Content of the advanced search, the root group of the filter and the buttons, shown in a modal panel
 * Edits a copy of the filter, Apply and enter in a value give it on, Cancel, escape and the close button close it without */
class ListAdvancedSearch extends ContentBase {
  static element_name() {
    return "advancedsearch";
  }
  static element_name_space() {
    return "list";
  }

  readonly #root: ListAdvancedGroup;

  /**@param columns the visible columns of the list, conditions can be made on those with a type
   * @param apply called with the filter of the rows that have a value when the user applies, it then closes*/
  constructor(
    columns: readonly ListAdvancedColumn[],
    apply: (filter: ListFilter) => void,
  ) {
    super();
    this.#root = ListAdvancedGroup.create({}, columns);
    const buttons = document.createElement("div");
    buttons.className = "buttons";
    const submit = () => {
      apply(this.#root.filter);
      this.content_close();
    };
    buttons.append(
      form.button({
        text: "Clear all",
        on_click: () => this.#root.clear_all(),
      }),
      document.createElement("span"),
      form.button({ text: "Cancel", on_click: () => this.content_close() }),
      form.button({ text: "Apply", on_click: submit }),
    );
    this.append(this.#root, buttons);
    this.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.content_close();
      }
      //Enter in a value applies, like a prompt submitting
      else if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
        e.preventDefault();
        submit();
      }
    });
  }

  /**Shows the filter */
  start(filter: ListFilter) {
    this.#root.start(filter);
  }

  /**Adds a condition of the column to the root, for & typed in its cell */
  add_condition(column: string): ListAdvancedCondition {
    return this.#root.add_condition(column);
  }
}
define_element(ListAdvancedSearch);

/**Opens the advanced search in a modal panel of the document of the owner, editing a copy of the filter
 * Apply gives the filter of what has a value, without empty groups, cancel, escape and the close button leave it, the focus goes back to where it was
 * @param column a new condition of the column is started, for & typed in its cell*/
export function list_advanced_search(
  owner: Element,
  columns: readonly ListAdvancedColumn[],
  filter: ListFilter,
  column: string | undefined,
  apply: (filter: ListFilter) => void,
) {
  const previous = owner.ownerDocument.activeElement;
  const content = ListAdvancedSearch.create(
    { title: "Advanced search", closable: true, min_width: 30 },
    columns,
    apply,
  );
  content.start(filter);
  const started =
    column === undefined ? undefined : content.add_condition(column);
  //However it closes, the focus goes back to where it was, unless the code that closed it moved the focus elsewhere
  void content.content_on_close().then(() => {
    if (
      !(previous instanceof HTMLElement) ||
      !previous.isConnected ||
      previous === previous.ownerDocument.body
    )
      return;
    const active = previous.ownerDocument.activeElement;
    if (
      !active ||
      active === active.ownerDocument.body ||
      content.contains(active)
    )
      previous.focus({ preventScroll: true });
  });
  comp.panel_container(owner).panel(content, { modal: true, sizeable: false });
  if (started) started.focus_value();
  else content.focus();
}
