import { define_element } from "@chocbite/ts-lib-ui/base";
import {
  Application,
  comp,
  ContentBase,
  LayoutSide,
  WINDOW_REOPEN,
} from "@chocbite/ts-lib-ui/composition";
import {
  material_description_rounded,
  material_list_rounded,
  material_edit_note_rounded,
} from "@chocbite/ts-lib-ui/icons";
import form from "@chocbite/ts-lib-ui/form";
import { prompts } from "@chocbite/ts-lib-ui/prompts";
import { settings_init } from "@chocbite/ts-lib-ui/settings";
import { box, controls, section } from "../../../helpers";

const GROUP_NAME = "dev/application-page";
const SETTINGS = settings_init(
  GROUP_NAME,
  "1.0.0",
  "Dev application page",
  "Applications saved by the application dev page",
);

/**Content filled with a line of text and buttons*/
const filled = (
  c: ContentBase,
  text: string,
  buttons: { [text: string]: () => void } = {},
) => {
  c.style.cssText = "display:block;padding:1rem;box-sizing:border-box";
  c.appendChild(document.createElement("p")).textContent = text;
  controls(c, buttons);
  return c;
};

//      ______ _____ _____ _______ ____  _____
//     |  ____|  __ \_   _|__   __/ __ \|  __ \
//     | |__  | |  | || |    | | | |  | | |__) |
//     |  __| | |  | || |    | | | |  | |  _  /
//     | |____| |__| || |_   | | | |__| | | \ \
//     |______|_____/_____|  |_|  \____/|_|  \_\
/**An editor per file, with an outline beside it*/
class Editor extends Application<{ file: string }> {
  static readonly type = "editor";
  static key(props: { file: string }) {
    return props.file;
  }
  protected main(): ContentBase {
    return filled(
      comp.content({
        title: this.key,
        icon: material_description_rounded,
        closable: true,
      }),
      `Editor of ${this.key}, the main content, closing it closes the outline too`,
      {
        Outline: () => this.outline(),
        "Close application": () => void this.close(),
      },
    );
  }
  protected restore(key: string): ContentBase | undefined {
    return key === "outline" ? this.#outline() : undefined;
  }
  #outline() {
    return filled(
      comp.content({
        title: `${this.key} outline`,
        icon: material_list_rounded,
        closable: true,
      }),
      `Outline of ${this.key}, made again after a reload`,
    );
  }
  outline() {
    this.open_content("outline", () => this.#outline(), {
      beside: this.content("main"),
      side: LayoutSide.RIGHT,
    });
  }
}

//      _   _  ____ _______ ______  _____
//     | \ | |/ __ \__   __|  ____|/ ____|
//     |  \| | |  | | | |  | |__  | (___
//     | . ` | |  | | | |  |  __|  \___ \
//     | |\  | |__| | | |  | |____ ____) |
//     |_| \_|\____/  |_|  |______|_____/
/**Notes that ask before closing while they have unsaved changes*/
class NotesContent extends ContentBase {
  static element_name() {
    return "notes";
  }
  static element_name_space() {
    return "devapp";
  }
  #unsaved = document.createElement("input");
  constructor() {
    super();
    filled(
      this,
      "Notes, one open at a time, ask before closing with unsaved changes ticked",
    );
    this.#unsaved.type = "checkbox";
    const label = this.appendChild(document.createElement("label"));
    label.append(this.#unsaved, " Unsaved changes");
  }
  protected async content_closing(): Promise<boolean> {
    if (!this.#unsaved.checked) return true;
    //Owned by the notes, so it asks in the window they are in
    const answer = await prompts.buttons(
      "The notes have unsaved changes",
      [
        { text: "Discard", value: true },
        { text: "Keep open", value: false },
      ],
      { owner: this },
    );
    return answer.some && answer.value;
  }
}
define_element(NotesContent);

class Notes extends Application {
  static readonly type = "notes";
  protected main(): ContentBase {
    return NotesContent.create({
      title: "Notes",
      icon: material_edit_note_rounded,
      closable: true,
    });
  }
}

//      __  __          _   _          _____ ______ _____
//     |  \/  |   /\   | \ | |   /\   / ____|  ____|  __ \
//     | \  / |  /  \  |  \| |  /  \ | |  __| |__  | |__) |
//     | |\/| | / /\ \ | . ` | / /\ \| | |_ |  __| |  _  /
//     | |  | |/ ____ \| |\  |/ ____ \ |__| | |____| | \ \
//     |_|  |_/_/    \_\_| \_/_/    \_\_____|______|_| \_\
{
  const sec = section(
    "Application manager",
    "Open editors and notes, an editor per file, Outline opens beside it. Move tabs around, pop them out, resize, switch tabs, then reload the page: the applications open again with their contents where they were, stored in the settings a moment after the last change. " +
      "Closing an editor closes its outline, Close application asks every content. Pop a tab out and Open in window from the menu of the panel title bar, pop tabs out in the window too. After a reload the windows open again as the Windows after a refresh setting says, the switch below, it is in the customization panel too: in the main window each is a panel of the page with its panels, in windows each waits hidden for a click or key press in the page, one window each, unless the browser lets the page open popups. The saved value below is what is stored",
  );
  const manager = comp.app_manager({
    apps: [Editor, Notes],
    settings: SETTINGS,
  });
  sec.appendChild(
    form.group({
      embed: true,
      column: true,
      elements: [
        form.text({ text: "Windows after a refresh" }),
        form.toggle_button().set({ value: WINDOW_REOPEN }),
      ],
    }),
  );
  let count = 0;
  const saved = document.createElement("pre");
  const show_saved = async () => {
    saved.textContent = JSON.stringify(
      JSON.parse(await manager.to_json()),
      null,
      1,
    );
  };
  controls(sec, {
    "Open a.ts": () => manager.open(Editor, { file: "a.ts" }),
    "Open b.ts": () => manager.open(Editor, { file: "b.ts" }),
    "Open new file": () => manager.open(Editor, { file: `new ${++count}.ts` }),
    "Open notes": () => manager.open(Notes, {}),
    "Show saved": () => void show_saved(),
    "Forget saved and reload": () => {
      for (const key of Object.keys(localStorage))
        if (key.includes(GROUP_NAME)) localStorage.removeItem(key);
      //Stored again when the page is hidden, so nothing is waiting
      location.reload();
    },
  });
  box(sec, "Workspace of the manager, 60rem by 30rem", {
    width: "60rem",
    maxWidth: "100%",
    height: "30rem",
    border: "1px solid #8884",
  }).appendChild(manager.workspace);
  sec.appendChild(saved);
  void show_saved();
}
