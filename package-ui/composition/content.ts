import {
  Base,
  CREATE,
  define_element,
  input_key,
  type InputOf,
  type InputOptions,
  type BaseOptions,
} from "#base";
import ctm, { type ContextMenuGroup } from "#context_menu";
import { state_ui, type StateUISize } from "#state_ui";
import type { SVGFunc } from "#svg";
import state, { type StateOrVal } from "@chocbite/ts-lib/state";
import "./content.scss";
import "./shared";

/**Inputs of content that can be set again*/
const CONTENT = {
  /**Context menu of the content, also shown by its container, like on the title bar of a panel
   * Lines, a menu, or a function giving them, which is called every time the menu opens*/
  context_menu: input_key<ContextMenuGroup>(),
};
export type ContentOptions = BaseOptions & InputOptions<typeof CONTENT>;

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

/**The container showing the content, set by containers that move content between them, internal to this module*/
export const CONTENT_HOST = Symbol("content_host");
/**Id a content is saved as, set by the application manager, internal to this module*/
export const CONTENT_ID = Symbol("content_id");
/**Called on the host by content_close, internal to this module*/
export const HOST_CAN_CLOSE = Symbol("host_can_close");
export const HOST_CLOSE_CONTENT = Symbol("host_close_content");
/**A container showing content that knows it by reference, like a layout, the content may not be in the document,
 * like an inactive tab, so it can not reach its container with an event*/
export interface ContentHost {
  /**Whether the host lets the content close, asked before the content is asked and again when it agrees*/
  [HOST_CAN_CLOSE](content: ContentBase): boolean;
  /**Closes the content, gives whether it did, undefined when the host no longer shows it,
   * the content then closes like content without a host*/
  [HOST_CLOSE_CONTENT](content: ContentBase): boolean | undefined;
}

/**The context menu of content as it is right now, for ctm.combine, internal to this module*/
export function content_context_lines(content: ContentBase) {
  const group = content.content_context_menu;
  return typeof group === "function" ? group() : (group ?? []);
}

/**Base for anything shown in a container of this module, like a panel
 *
 * Library users extend it for their own content, and create it with MyContent.create(options),
 * the title, icon, closable and minimum size are given at creation, as the container follows them
 * To follow its own size, content uses content_size, width and height as states*/
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
  /**The close waiting for the answer of content_closing*/
  #closing?: Promise<boolean>;
  /**Container showing the content, when it is one that knows it by reference*/
  [CONTENT_HOST]?: ContentHost;
  /**Id the content is saved as, given by the application manager*/
  [CONTENT_ID]?: readonly string[];

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
  /**Width and height of the content as read only states in px, the space it has in its container, like a panel.
   * Observed only while something is subscribed, see state_ui.size*/
  content_size(): StateUISize {
    return state_ui.size(this);
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
    super.set(options);
    this.set_input(CONTENT.context_menu, options.context_menu, (menu) => {
      this.#context_menu = menu.value;
    });
    return this;
  }

  /**Resolves when the content is closed, by itself or by its container*/
  content_on_close(): Promise<void> {
    return new Promise<void>((resolve) => this.#on_close.push(resolve));
  }

  /**Asked before the content closes, false or a promise of false keeps it open, like to ask about unsaved changes
   * Library users override it, it is not asked when its container does not let it close*/
  protected content_closing(): boolean | PromiseLike<boolean> {
    return true;
  }

  /**Closes the content when it agrees, see content_closing, its container closes with it
   * Gives whether it closed, a close while one waits for the answer gives the same*/
  content_close(): Promise<boolean> {
    if (this.#closing) return this.#closing;
    const host = this[CONTENT_HOST];
    if (host && !host[HOST_CAN_CLOSE](this)) return Promise.resolve(false);
    const answer = this.content_closing();
    //A plain answer closes at once, so the container is gone before anything else runs
    if (typeof answer === "boolean")
      return Promise.resolve(answer && this.#close());
    return (this.#closing = Promise.resolve(answer)
      .then((agreed) => agreed && this.#close())
      .finally(() => (this.#closing = undefined)));
  }

  #close(): boolean {
    const host = this[CONTENT_HOST];
    if (host) {
      //The host may have changed while the content was asked
      if (!host[HOST_CAN_CLOSE](this)) return false;
      const closed = host[HOST_CLOSE_CONTENT](this);
      if (closed !== undefined) return closed;
    }
    this[CONTENT_CLOSED]();
    this.dispatchEvent(new CustomEvent("content_closed", { bubbles: true }));
    return true;
  }

  /**Saved as the id the application manager gave it, null without one, instead of the states in its fields,
   * see to_json and the viewer of the state module*/
  [state.v.OVERRIDE_KEY](): readonly string[] | null {
    return this[CONTENT_ID] ?? null;
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
