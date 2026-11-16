import {
  Base,
  CREATE,
  define_element,
  input_key,
  type InputOf,
  type InputOptions,
} from "#base";
import ctm, { type ContextMenuGroup } from "#context-menu";
import type { SVGFunc } from "#svg";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import "./content.scss";
import "./shared";

/**Inputs of content that can be set again*/
const CONTENT = {
  /**Context menu of the content, also shown by its container, like on the title bar of a panel
   * Lines, a menu, or a function giving them, which is called every time the menu opens*/
  context_menu: input_key<ContextMenuGroup>(),
};
export type ContentOptions = InputOptions<typeof CONTENT>;

/**Inputs of content given at creation, the container showing the content follows them
 * Exported for the containers of this module, not from the module*/
export const CONTENT_CREATE = {
  /**Title the container shows, like on the title bar of a panel*/
  title: input_key<StateOrVal<string>>(),
  /**Icon the container shows in front of the title*/
  icon: input_key<StateOrVal<SVGFunc | undefined>>(),
  /**Whether the container lets the user close the content*/
  closable: input_key<StateOrVal<boolean>>(),
  /**Smallest width in rem the container gives the content*/
  min_width: input_key<StateOrVal<number>>(),
  /**Smallest height in rem the container gives the content*/
  min_height: input_key<StateOrVal<number>>(),
};
export type ContentCreateOptions = ContentOptions &
  InputOptions<typeof CONTENT_CREATE>;

/**Called by the container when it closes the content, internal to this module*/
export const CONTENT_CLOSED = Symbol("content_closed");

/**The context menu of content as it is right now, for ctm.combine, internal to this module*/
export function content_context_lines(content: ContentBase) {
  const group = content.content_context_menu;
  return typeof group === "function" ? group() : (group ?? []);
}

/**Base for anything shown in a container of this module, like a panel
 *
 * Library users extend it for their own content, and create it with MyContent.create(options),
 * the title, icon, closable and minimum size are given at creation, as the container follows them
 * To follow its own size, content attaches to the resize observer of Base and overrides on_resize*/
export abstract class ContentBase extends Base {
  static element_name() {
    return "@abstract@";
  }
  static element_name_space() {
    return "@abstract@";
  }

  #title: InputOf<typeof CONTENT_CREATE.title> = "";
  #icon: InputOf<typeof CONTENT_CREATE.icon> = undefined;
  #closable: InputOf<typeof CONTENT_CREATE.closable> = false;
  #min_width: InputOf<typeof CONTENT_CREATE.min_width> = 0;
  #min_height: InputOf<typeof CONTENT_CREATE.min_height> = 0;
  #context_menu: ContextMenuGroup = undefined;
  #on_close: (() => void)[] = [];

  constructor() {
    super();
    this.tabIndex = -1;
    this.classList.add("content");
    ctm.attach(
      this,
      ctm.combine(() => content_context_lines(this)),
    );
  }

  /**Title the container shows, given at creation and never replaced*/
  get content_title(): InputOf<typeof CONTENT_CREATE.title> {
    return this.#title;
  }
  /**Icon the container shows, given at creation and never replaced*/
  get content_icon(): InputOf<typeof CONTENT_CREATE.icon> {
    return this.#icon;
  }
  /**Whether the container lets the user close the content, given at creation and never replaced*/
  get content_closable(): InputOf<typeof CONTENT_CREATE.closable> {
    return this.#closable;
  }
  /**Smallest width in rem, given at creation and never replaced*/
  get content_min_width(): InputOf<typeof CONTENT_CREATE.min_width> {
    return this.#min_width;
  }
  /**Smallest height in rem, given at creation and never replaced*/
  get content_min_height(): InputOf<typeof CONTENT_CREATE.min_height> {
    return this.#min_height;
  }
  /**Context menu of the content, read by the container every time its menu opens*/
  get content_context_menu(): ContextMenuGroup {
    return this.#context_menu;
  }

  [CREATE](options: ContentCreateOptions): void {
    super[CREATE](options);
    if (options.title !== undefined) this.#title = options.title;
    if (options.icon !== undefined) this.#icon = options.icon;
    if (options.closable !== undefined) this.#closable = options.closable;
    if (options.min_width !== undefined) this.#min_width = options.min_width;
    if (options.min_height !== undefined) this.#min_height = options.min_height;
  }

  set(options: ContentOptions): this {
    this.set_input(CONTENT.context_menu, options.context_menu, (menu) => {
      this.#context_menu = menu.value;
    });
    return this;
  }

  /**Resolves when the content is closed, by itself or by its container*/
  content_on_close(): Promise<void> {
    return new Promise<void>((resolve) => this.#on_close.push(resolve));
  }

  /**Closes the content, its container closes with it*/
  content_close(): void {
    this[CONTENT_CLOSED]();
    this.dispatchEvent(new CustomEvent("content_closed", { bubbles: true }));
  }

  /**Resolves the waiting content_on_close promises, called by the container that closes the content*/
  [CONTENT_CLOSED](): void {
    for (const resolve of this.#on_close.splice(0)) resolve();
  }
}

/**Content without behavior of its own, filled with children by the user*/
class Content extends ContentBase {
  static element_name() {
    return "content";
  }
  static element_name_space() {
    return "composition";
  }
}
define_element(Content);

export type { Content };

/**Content to fill with children, the title, icon, closable and minimum size are given here, the container follows them*/
export function content(options: ContentCreateOptions = {}): Content {
  return Content.create(options);
}
