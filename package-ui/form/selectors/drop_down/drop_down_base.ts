import {
  material_keyboard_arrow_down_rounded,
  material_unfold_less_rounded,
} from "#icons";
import { FormSelectorBase, type FormSelectorOption } from "../selector_base";
import {
  dropdown_box,
  type DropDownBox,
  type DropDownMenu,
  type FormDropDownSelection,
} from "./box";
import "./drop_down.scss";

/**Base of the dropdowns, a field showing the value, which opens the popup of the document to pick from the selections
 * The value V is one of the selections of RT, or for a dropdown picking several, an array of them*/
export abstract class FormDropDownBase<
  RT,
  ID extends string | undefined,
  V,
> extends FormSelectorBase<RT, ID, V> {
  static element_name() {
    return "@abstract@";
  }

  /**True for a dropdown picking several, its popup has check boxes and stays open on a pick*/
  protected abstract readonly multi: boolean;
  /**Values of the selections, in their order*/
  protected _values: RT[] = [];
  /**Text and icon of each selection, in their order*/
  protected _lines: FormDropDownSelection[] = [];
  /**Index of each value in the selections, the first one for a value given twice*/
  protected _index: Map<RT, number> = new Map();
  /**Shows the value*/
  protected _text: HTMLDivElement = this.appendChild(
    document.createElement("div"),
  );
  #chevron: SVGSVGElement = this.appendChild(
    material_keyboard_arrow_down_rounded(),
  );
  #box?: DropDownBox;
  /**The menu open in the popup, undefined while closed*/
  #menu?: DropDownMenu;

  constructor() {
    super();
    this.appendChild(this.warn_input);
    this.tabIndex = 0;
    this.onclick = () => (this.open = true);
    this.onpointerdown = (e) => {
      if (e.pointerType === "mouse") {
        this.open = true;
        e.preventDefault();
      }
    };
    this.onkeydown = (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        this.open = true;
      } else this.key(e);
    };
  }

  focus(options?: FocusOptions): void {
    HTMLElement.prototype.focus.call(this, options);
  }

  /**Opens or closes the popup*/
  set open(open: boolean) {
    if (open && !this.#menu) {
      this.#chevron = this.#swap(material_unfold_less_rounded());
      const menu: DropDownMenu = {
        lines: this._lines,
        selected: this.selected_lines(),
        multi: this.multi,
        pick: (index) => this.pick(index),
        closed: (focus) => {
          this.#menu = undefined;
          this.#chevron = this.#swap(material_keyboard_arrow_down_rounded());
          if (focus) this.focus();
        },
      };
      this.#menu = menu;
      this.#box = dropdown_box(this.ownerDocument);
      this.#box.open_menu(this, menu);
    } else if (!open && this.#menu) this.#box?.close_menu(true, this.#menu);
  }

  /**Puts the icon in place of the chevron*/
  #swap(icon: SVGSVGElement): SVGSVGElement {
    this.#chevron.replaceWith(icon);
    return icon;
  }

  protected apply_selections(
    selections: FormSelectorOption<RT>[] | undefined,
  ): void {
    this.open = false;
    this._values = [];
    this._lines = [];
    this._index.clear();
    for (const { value, text, icon } of selections ?? []) {
      if (!this._index.has(value)) this._index.set(value, this._values.length);
      this._values.push(value);
      this._lines.push({ text, icon });
    }
    if (this._buffer !== undefined) this.new_value(this._buffer);
  }

  /**Indexes of the selections the value has, shown as selected in the popup*/
  protected abstract selected_lines(): number[];

  /**The user picked the selection at the index in the popup*/
  protected abstract pick(index: number): void;

  /**Keys pressed on the field, other than those opening the popup*/
  protected key(_e: KeyboardEvent): void {}

  /**Shows the selected lines in the popup again while it is open, after the value changed*/
  protected update_menu(): void {
    if (this.#menu) this.#box?.show_selected(this.#menu, this.selected_lines());
  }
}
