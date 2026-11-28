import { settings_init } from "#settings";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  app_manager,
  Application,
  type AppManager,
  type AppManagerOptions,
  type AppManagerSaved,
} from "../application";
import { content, type ContentBase } from "../content";
import { LayoutSide, type Layout, type LayoutTabs } from "../layout/index";
import type { Panel } from "../panel";
import { group_of, move_content, popout } from "../layout/actions";
import { guarded } from "./guarded";
import { WINDOW_REOPEN, WindowReopen } from "../settings";

/**Notes with a name, one open per name, with an info content beside the main one*/
class Notes extends Application<{ name: string }> {
  static readonly type = "notes";
  static key(props: { name: string }) {
    return props.name;
  }
  closed_count = 0;
  /**Answer of the info content when asked to close*/
  info_answer = true;
  protected main(): ContentBase {
    return content({ title: `${this.key} main`, closable: true });
  }
  protected restore(key: string): ContentBase | undefined {
    return key === "info" ? this.#info() : undefined;
  }
  protected closed(): void {
    this.closed_count++;
  }
  #info() {
    return guarded(this.info_answer, {
      title: `${this.key} info`,
      closable: true,
    });
  }
  info(): ContentBase {
    return this.open_content("info", () => this.#info(), {
      side: LayoutSide.RIGHT,
    });
  }
  /**A content that is not made again after a refresh*/
  scratch(): ContentBase {
    return this.open_content("scratch", () =>
      content({ title: `${this.key} scratch`, closable: true }),
    );
  }
}

/**One open at a time*/
class Single extends Application {
  static readonly type = "single";
  protected main(): ContentBase {
    return content({ title: "single", closable: true });
  }
}

const shown: AppManager[] = [];
const manager = (
  restore?: unknown,
  options: Partial<AppManagerOptions> = {},
) => {
  const made = app_manager({ apps: [Notes, Single], restore, ...options });
  const box = document.body.appendChild(document.createElement("div"));
  box.style.cssText = "width:800px;height:500px";
  box.appendChild(made.workspace);
  shown.push(made);
  return made;
};
afterEach(() => {
  for (const made of shown.splice(0)) made.workspace.parentElement?.remove();
});

const main_layout = (made: AppManager) =>
  made.workspace.querySelector<Layout>("composition-layout")!;
const titles = (made: AppManager) =>
  main_layout(made)
    .contents()
    .map((c) => c.content_title);
const group_with = (made: AppManager, c: ContentBase) =>
  [
    ...made.workspace.querySelectorAll<LayoutTabs>("composition-layouttabs"),
  ].find((g) => g.contents().includes(c))!;

describe("Opening", () => {
  it("opens an application with its main content in the main layout", () => {
    const made = manager();
    const notes = made.open(Notes, { name: "a" });
    expect(made.apps()).toEqual([notes]);
    expect(notes.key).toBe("a");
    expect(notes.props.ok()).toEqual({ name: "a" });
    expect(titles(made)).toEqual(["a main"]);
  });

  it("shows the open application with the same key instead of opening another", () => {
    const made = manager();
    const a = made.open(Notes, { name: "a" });
    made.open(Notes, { name: "b" });
    expect(made.open(Notes, { name: "a" })).toBe(a);
    expect(group_with(made, a.content("main")!).active()).toBe(
      a.content("main"),
    );
    expect(made.apps().length).toBe(2);
    expect(made.open(Single, {})).toBe(made.open(Single, {}));
    expect(made.find(Notes, "b")?.key).toBe("b");
  });

  it("opens another content of an application once, where it is asked", () => {
    const made = manager();
    const notes = made.open(Notes, { name: "a" });
    const info = notes.info();
    expect(notes.info()).toBe(info);
    expect(titles(made)).toEqual(["a main", "a info"]);
    expect(group_with(made, info)).not.toBe(
      group_with(made, notes.content("main")!),
    );
  });

  it("refuses a class that is not in the apps of the manager", () => {
    class Other extends Application {
      static readonly type = "other";
      protected main(): ContentBase {
        return content({ title: "other" });
      }
    }
    expect(() => manager().open(Other, {})).toThrow();
  });
});

describe("Closing", () => {
  it("closes the application and its other contents when its main content closes", async () => {
    const made = manager();
    const notes = made.open(Notes, { name: "a" });
    const info = notes.info();
    expect(await notes.content("main")!.content_close()).toBe(true);
    await Promise.resolve();
    expect(made.apps()).toEqual([]);
    expect(notes.closed_count).toBe(1);
    expect(titles(made)).toEqual([]);
    expect(info.isConnected).toBe(false);
  });

  it("asks every content when closing, a content that refuses keeps the application open", async () => {
    const made = manager();
    const notes = made.open(Notes, { name: "a" });
    notes.info_answer = false;
    notes.info();
    expect(await notes.close()).toBe(false);
    expect(made.apps()).toEqual([notes]);
    expect(titles(made)).toEqual(["a main", "a info"]);
  });

  it("closes when every content agrees", async () => {
    const made = manager();
    const notes = made.open(Notes, { name: "a" });
    notes.info();
    expect(await notes.close()).toBe(true);
    await Promise.resolve();
    expect(made.apps()).toEqual([]);
    expect(titles(made)).toEqual([]);
  });
});

describe("Saving", () => {
  /**Opens what the manager saved in a new manager*/
  const again = async (made: AppManager) =>
    manager(JSON.parse(await made.to_json()));

  it("opens the applications again with their props and contents where they were", async () => {
    const made = manager();
    const a = made.open(Notes, { name: "a" });
    a.info();
    made.open(Notes, { name: "b" });
    const restored = await again(made);
    expect(restored.apps().map((app) => [app.type, app.key])).toEqual([
      ["notes", "a"],
      ["notes", "b"],
    ]);
    expect(titles(restored)).toEqual(titles(made));
    const ra = restored.find(Notes, "a")!;
    expect(ra.props.ok()).toEqual({ name: "a" });
    expect(group_with(restored, ra.content("info")!)).not.toBe(
      group_with(restored, ra.content("main")!),
    );
    //Opened again, the restored application is shown, not opened twice
    expect(restored.open(Notes, { name: "a" })).toBe(ra);
  });

  it("saves the props the application writes, the shown tab, and the panels", async () => {
    const made = manager();
    const a = made.open(Notes, { name: "a" });
    const b = made.open(Notes, { name: "b" });
    a.props.write_sync({ name: "renamed" });
    const layout = main_layout(made);
    popout(layout, group_with(made, b.content("main")!), b.content("main")!);
    await Promise.resolve();
    const saved = JSON.parse(await made.to_json()) as AppManagerSaved;
    expect(saved.apps[0].props).toEqual({ name: "renamed" });
    expect(saved.windows[0].panels.length).toBe(1);
    const restored = await again(made);
    expect(titles(restored)).toEqual(["a main"]);
    expect(restored.find(Notes, "b")?.content("main")?.isConnected).toBe(true);
  });

  it("leaves out contents an application does not make again, unknown applications, and groups left empty", async () => {
    const made = manager();
    const a = made.open(Notes, { name: "a" });
    const scratch = a.scratch();
    //The scratch content alone in a group of its own
    move_content(scratch, {
      layout: main_layout(made),
      node: group_with(made, a.content("main")!),
      side: LayoutSide.BOTTOM,
    });
    const saved = JSON.parse(await made.to_json()) as {
      apps: { type: string; key: string; props: unknown }[];
    };
    saved.apps.push({ type: "gone", key: "", props: {} });
    const restored = manager(saved);
    expect(titles(restored)).toEqual(["a main"]);
    expect(
      restored.workspace.querySelectorAll("composition-layouttabs").length,
    ).toBe(1);
    expect(restored.apps().length).toBe(1);
  });

  it("saves a group without a shown tab without errors", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const saved = JSON.parse(await manager().to_json()) as {
      windows: { root: { active: unknown } }[];
    };
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
    expect(saved.windows[0].root.active).toBeNull();
  });

  it("starts empty from a saved value it does not understand", () => {
    const made = manager({ apps: "nope" });
    expect(made.apps()).toEqual([]);
    expect(titles(made)).toEqual([]);
  });

  it("stores in the settings group, and opens from it when made", async () => {
    const group = settings_init("@test/app-manager", "1.0.0", "Apps", "");
    const first = group.make_sub_group("first", "First", "");
    const made = app_manager({ apps: [Notes], settings: first });
    made.open(Notes, { name: "stored" });
    //Stored a delay after the last change
    await new Promise((resolve) => setTimeout(resolve, 700));
    const stored = first.get<unknown>("workspace", undefined).value;
    expect(stored).toMatchObject({ apps: [{ type: "notes", key: "stored" }] });
    const second = group.make_sub_group("second", "Second", "");
    second.set("workspace", stored as never);
    const restored = app_manager({ apps: [Notes], settings: second });
    expect(restored.apps().map((app) => app.key)).toEqual(["stored"]);
  });
});

describe("Windows", () => {
  it("opens browser windows again as windows after a refresh by default", () => {
    expect(WINDOW_REOPEN.ok()).toBe(WindowReopen.Windows);
  });

  const main_of = (made: AppManager, name: string) =>
    made.find(Notes, name)!.content("main")!;
  const in_window = (made: AppManager, name: string) =>
    main_of(made, name).ownerDocument !== document;
  /**Pops the main content of the notes out of the main layout into a panel, gives the panel*/
  const pop = async (made: AppManager, name: string) => {
    const c = main_of(made, name);
    popout(main_layout(made), group_with(made, c), c);
    await Promise.resolve();
    return c.closest<Panel>("composition-panel")!;
  };
  /**Opens the panel in a window from the menu of its title bar, as the user does*/
  const open_in_window = (shown_in: Panel) => {
    shown_in.children[1].dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    const line = [
      ...document.querySelectorAll("contextmenu-container contextmenu-option"),
    ].find((o) => o.textContent?.includes("Open in window")) as HTMLElement;
    line.click();
  };
  const saved_of = async (made: AppManager) =>
    JSON.parse(await made.to_json()) as AppManagerSaved;
  /**Notes a in a browser window, b popped out into a panel in that window, c in the main layout*/
  const window_with_panel = async () => {
    const made = manager();
    for (const name of ["a", "b", "c"]) made.open(Notes, { name });
    open_in_window(await pop(made, "a"));
    //The panel becomes a window after the menu click
    await vi.waitFor(() => expect(in_window(made, "a")).toBe(true));
    const a = main_of(made, "a");
    const b = main_of(made, "b");
    const layout = a.closest<Layout>("composition-layout")!;
    const group = group_of(layout.root_node()!, a)!;
    move_content(b, { layout, group, index: 1 });
    popout(layout, group, b);
    await Promise.resolve();
    return { made, popup: a.ownerDocument.defaultView! };
  };
  /**Saved with notes a in a browser window with b in a panel in it, c in another window, d in the main layout*/
  const saved_windows = async () => {
    const made = manager();
    for (const name of ["a", "b", "c", "d"]) made.open(Notes, { name });
    for (const name of ["a", "b", "c"]) await pop(made, name);
    const saved = await saved_of(made);
    const [pa, pb, pc] = saved.windows[0].panels;
    saved.windows = [
      { root: saved.windows[0].root, panels: [] },
      { ...pa, panels: [{ ...pb, x: 1, y: 1 }] },
      { ...pc, panels: [] },
    ];
    return saved;
  };

  it("opens a panel in a browser window, saved as a window, a tab popped out in it stays in the window", async () => {
    const { made, popup } = await window_with_panel();
    expect(main_of(made, "b").ownerDocument).toBe(popup.document);
    const saved = await saved_of(made);
    expect(saved.windows.length).toBe(2);
    expect(saved.windows[0].panels.length).toBe(0);
    expect(saved.windows[1].panels.length).toBe(1);
  });

  it("brings a closed window back to the page as a panel, followed by its panels, nothing closes", async () => {
    const { made, popup } = await window_with_panel();
    popup.close();
    await vi.waitFor(async () =>
      expect((await saved_of(made)).windows.length).toBe(1),
    );
    expect((await saved_of(made)).windows[0].panels.length).toBe(2);
    expect(in_window(made, "a")).toBe(false);
    expect(in_window(made, "b")).toBe(false);
    expect(main_of(made, "b").isConnected).toBe(true);
    expect(made.apps().length).toBe(3);
  });

  it("drops a window its last tab leaves, its panels go to the page", async () => {
    const { made, popup } = await window_with_panel();
    const c = main_of(made, "c");
    move_content(main_of(made, "a"), {
      layout: main_layout(made),
      group: group_with(made, c),
      index: 0,
    });
    await vi.waitFor(() => expect(popup.closed).toBe(true));
    const saved = await saved_of(made);
    expect(saved.windows.length).toBe(1);
    expect(saved.windows[0].panels.length).toBe(1);
    expect(in_window(made, "b")).toBe(false);
    expect(main_of(made, "b").isConnected).toBe(true);
  });

  it("opens browser windows saved as panels of the page when the user set the main window, followed by their panels", async () => {
    const saved_value = await saved_windows();
    await WINDOW_REOPEN.write(WindowReopen.Main);
    const restored = manager(saved_value);
    await WINDOW_REOPEN.write(WindowReopen.Windows);
    for (const name of ["a", "b", "c"])
      expect(in_window(restored, name)).toBe(false);
    const saved = await saved_of(restored);
    expect(saved.windows.length).toBe(1);
    expect(saved.windows[0].panels.length).toBe(3);
  });

  describe("set to windows", () => {
    const click = () =>
      document.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true }),
      );

    it("opens them as windows again with their panels in them, where the browser lets the page open windows", async () => {
      const saved = await saved_windows();
      await WINDOW_REOPEN.write(WindowReopen.Windows);
      const restored = manager(saved);
      expect(in_window(restored, "a")).toBe(true);
      expect(main_of(restored, "b").ownerDocument).toBe(
        main_of(restored, "a").ownerDocument,
      );
      expect(in_window(restored, "c")).toBe(true);
      const again = await saved_of(restored);
      expect(again.windows.map((w) => w.panels.length)).toEqual([0, 1, 0]);
    });

    it("keeps them hidden, nothing in the page, until clicks and key presses open them one each", async () => {
      const saved = await saved_windows();
      await WINDOW_REOPEN.write(WindowReopen.Windows);
      vi.spyOn(window, "open")
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);
      const restored = manager(saved);
      const a = main_of(restored, "a");
      expect(in_window(restored, "a")).toBe(false);
      expect(a.checkVisibility()).toBe(false);
      expect(main_of(restored, "b").isConnected).toBe(false);
      expect(main_of(restored, "c").checkVisibility()).toBe(false);
      click();
      expect(in_window(restored, "a")).toBe(true);
      expect(main_of(restored, "b").ownerDocument).toBe(a.ownerDocument);
      expect(in_window(restored, "c")).toBe(false);
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
      expect(in_window(restored, "c")).toBe(true);
      expect(
        (await saved_of(restored)).windows.map((w) => w.panels.length),
      ).toEqual([0, 1, 0]);
    });

    it("passes over a waiting window whose last tab closed, its panels go to the page", async () => {
      const saved = await saved_windows();
      await WINDOW_REOPEN.write(WindowReopen.Windows);
      vi.spyOn(window, "open")
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);
      const restored = manager(saved);
      await restored.find(Notes, "a")!.close();
      await Promise.resolve();
      expect(main_of(restored, "b").ownerDocument).toBe(document);
      expect(main_of(restored, "b").checkVisibility()).toBe(true);
      click();
      expect(in_window(restored, "c")).toBe(true);
    });
  });
});
