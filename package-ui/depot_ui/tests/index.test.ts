import depot, { type DepotGroup, type DepotType } from "@chocbite/ts-lib/depot";
import { ok, NiceError } from "@chocbite/ts-lib/result";
import state, { type StateROSW } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import depot_ui, { DepotTree } from ".";

/**Closes the panels of open selectors*/
const close_panels = () => {
  for (const panel of document.querySelectorAll("composition-panel"))
    (panel as HTMLElement & { close(): void }).close();
};
/**The panel of the open selector*/
const selector_panel = () =>
  document.querySelector("composition-panel") as HTMLElement & {
    close(): void;
  };
const title = () => selector_panel().querySelector(".title")!.textContent;
/**A test error whose nice text is its message, so shown texts read as before*/
const nice_err = (text: string) => new NiceError(Symbol(text), text);

const types: DepotType<any>[] = [];
afterEach(() => {
  close_panels();
  for (const type of types.splice(0)) type.remove();
});

const setup = () => {
  const type = depot.type<number>("t", "Things", "");
  types.push(type);
  const shapes = type.group("shapes", "Shapes", "");
  const rect = shapes.add("rect", "Rectangle", "Four sides", 4);
  const circle = shapes.add("circle", "Circle", "Round", 0);
  const empty = type.group("empty", "Empty", "");
  const other = type.add("other", "Other", "", 9);
  return { type, shapes, rect, circle, empty, other };
};

const tick = () => new Promise<void>((r) => queueMicrotask(r));

describe("tree", () => {
  it("shows groups with entries below them and the entries", () => {
    const { type, shapes, rect, circle, other } = setup();
    const tree = new DepotTree(type);
    expect(tree.rows().ok()).toEqual([shapes, other]);
    expect(tree.rows(shapes).ok()).toEqual([rect, circle]);
  });

  it("hides entries the filter rejects and groups left empty", () => {
    const { type, shapes, rect, other } = setup();
    const tree = new DepotTree(type, (e) => e.id !== "circle");
    expect(tree.rows().ok()).toEqual([shapes, other]);
    expect(tree.rows(shapes).ok()).toEqual([rect]);
    const only_other = new DepotTree(type, (e) => e === other);
    expect(only_other.rows().ok()).toEqual([other]);
  });

  it("searches names and paths without case", () => {
    const { type, shapes, rect, circle } = setup();
    const tree = new DepotTree(type);
    tree.search = "RECT";
    expect(tree.searching).toBe(true);
    expect(tree.rows().ok()).toEqual([shapes]);
    expect(tree.rows(shapes).ok()).toEqual([rect]);
    tree.search = "shapes";
    expect(tree.rows(shapes).ok()).toEqual([rect, circle]);
    tree.search = " ";
    expect(tree.searching).toBe(false);
  });

  it("follows the depot after the burst of changes", async () => {
    const { type, shapes, empty, other } = setup();
    const tree = new DepotTree(type);
    const added = empty.add("x", "X", "", 1);
    shapes.remove();
    expect(tree.rows().ok()).toEqual([shapes, other]);
    await tick();
    expect(tree.rows().ok()).toEqual([empty, other]);
    expect(tree.rows(empty).ok()).toEqual([added]);
  });

  it("only sets rows that changed", async () => {
    const { type, shapes, other } = setup();
    const tree = new DepotTree(type);
    let calls = 0;
    tree.rows(shapes).sub(() => calls++);
    type.add("more", "", "", 1);
    await tick();
    expect(tree.rows().ok()).toEqual([
      shapes,
      other,
      type.children.ok().at(-1),
    ]);
    expect(calls).toBe(0);
  });

  it("drops its subscriptions when disposed", async () => {
    const { type, shapes } = setup();
    const tree = new DepotTree(type);
    expect(type.children.amount()).toBe(1);
    expect(shapes.children.amount()).toBe(1);
    tree.dispose();
    expect(type.children.amount()).toBe(0);
    expect(shapes.children.amount()).toBe(0);
    type.add("more", "", "", 1);
    await tick();
    expect(tree.rows().ok().length).toBe(2);
  });
});

describe("select", () => {
  const panel = () => document.querySelector("depot-selector")!;
  const button = (text: string) =>
    [...panel().querySelectorAll("form-button")].find(
      (b) => b.textContent === text,
    ) as HTMLElement;
  const rows = () =>
    [...panel().querySelectorAll("list-row")].map(
      (r) => r.querySelector("list-keyfield")!.textContent,
    );
  const press = (el: HTMLElement) => el.click();

  it("shows the entries and gives the preselected entries on select", async () => {
    const { type, rect } = setup();
    const result = depot_ui.select(type, { selected: [rect] });
    expect(title()).toBe("Things");
    expect(rows()).toEqual(["Shapes", "Other"]);
    press(button("Select"));
    expect(await result).toEqual([rect]);
    expect(panel()).toBeNull();
    expect(document.querySelector("composition-panel")).toBeNull();
  });

  it("gives nothing when cancelled", async () => {
    const { type, rect } = setup();
    const result = depot_ui.select(type, { selected: [rect] });
    press(button("Cancel"));
    expect(await result).toEqual([]);
  });

  it("gives nothing when closed with Escape or by the panel", async () => {
    const { type, rect } = setup();
    const escaped = depot_ui.select(type, { selected: [rect] });
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(await escaped).toEqual([]);
    const closed = depot_ui.select(type, { selected: [rect] });
    selector_panel().close();
    expect(await closed).toEqual([]);
    expect(panel()).toBeNull();
  });

  it("clears the search on the first Escape and closes on the next", async () => {
    const { type } = setup();
    const result = depot_ui.select(type);
    const input = panel().querySelector("input")!;
    const escape = () =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    input.value = "circ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(rows()).toEqual(["Shapes", "Circle"]);
    escape();
    await tick();
    expect(input.value).toBe("");
    //Every entry is back, the group opened by the search stays open
    expect(rows()).toEqual(["Shapes", "Rectangle", "Circle", "Other"]);
    escape();
    expect(await result).toEqual([]);
  });

  it("is a modal panel with a close button, the search focused", () => {
    const { type } = setup();
    void depot_ui.select(type);
    expect(selector_panel().classList.contains("modal")).toBe(true);
    expect(selector_panel().querySelector(".close-button")).not.toBeNull();
    expect(document.activeElement).toBe(panel().querySelector("input"));
  });

  it("only shows entries passing the filter", () => {
    const { type } = setup();
    void depot_ui.select(type, { filter: (e) => e.id === "other" });
    expect(rows()).toEqual(["Other"]);
  });

  it("opens groups while searching", async () => {
    const { type } = setup();
    void depot_ui.select(type);
    const input = panel().querySelector("input")!;
    input.value = "circ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(rows()).toEqual(["Shapes", "Circle"]);
  });

  it("can select states of the states type by a filter", async () => {
    const machine = depot.states.group("machine", "Machine", "");
    const speed = machine.add("speed", "Speed", "", state.ok_w(1));
    machine.add("fixed", "Fixed", "", 2);
    try {
      const result = depot_ui.select(depot.states, {
        mode: "multi",
        filter: (e) => e.value.writable,
        selected: [speed],
      });
      expect(rows()).toEqual(["Machine"]);
      press(button("Select"));
      expect(await result).toEqual([speed]);
    } finally {
      machine.remove();
    }
  });
});

describe("select_state", () => {
  const panel = () => document.querySelector("depot-selector")!;
  const button = (text: string) =>
    [...panel().querySelectorAll("form-button")].find(
      (b) => b.textContent === text,
    ) as HTMLElement;
  const rows = () =>
    [...panel().querySelectorAll("list-row")].map(
      (r) => r.querySelector("list-keyfield")!.textContent,
    );
  const values = () =>
    [...panel().querySelectorAll("depot-value")].map((v) => v.textContent);
  const input = (text: string) => {
    const el = panel().querySelector("input")!;
    el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const setup = () => {
    const machine = depot.states.group("machine", "Machine", "");
    groups.push(machine);
    const speed = machine.add(
      "speed",
      "Speed",
      "",
      state.rosw(
        state.n.help(ok(12.5), {
          unit: state.ok("rpm"),
          decimals: state.ok(1),
        }),
        true,
      ),
    );
    const temp = machine.add("temp", "Temperature", "", state.ok(21));
    const name = machine.add("name", "Name", "", state.ok_w("Press"));
    const on = machine.add("on", "On", "", state.ok_w(true));
    const mode = machine.add(
      "mode",
      "Mode",
      "",
      state.rosw(
        state.e.help(ok<"auto" | "man">("auto"), {
          list: state.ok({
            auto: { name: "Automatic" },
            man: { name: "Manual" },
          }),
        }),
        true,
      ),
    );
    const remote = machine.add("remote", "Remote", "", state.ok_w(1).read_only);
    const broken = machine.add("broken", "Broken", "", state.err(nice_err("offline")));
    return { machine, speed, temp, name, on, mode, remote, broken };
  };
  const groups: DepotGroup<unknown>[] = [];
  afterEach(() => {
    for (const group of groups.splice(0)) group.remove();
  });

  it("shows the live values of the states", async () => {
    const { speed } = setup();
    void depot_ui.select_state();
    input("machine");
    expect(values()).toEqual([
      "",
      "12.5 rpm",
      "21",
      "Press",
      "true",
      "Automatic",
      "1",
      "offline",
    ]);
    await (speed.value as StateROSW<number>).write(14);
    expect(values()[1]).toBe("14.0 rpm");
  });

  it("only shows writable states", () => {
    setup();
    void depot_ui.select_state({ writable: true });
    input("machine");
    expect(rows()).toEqual(["Machine", "Speed", "Name", "On", "Mode"]);
  });

  it("only shows states of the kinds", () => {
    setup();
    void depot_ui.select_state({ kind: "number" });
    input("machine");
    expect(rows()).toEqual(["Machine", "Speed", "Temperature", "Remote"]);
    close_panels();
    void depot_ui.select_state({ kind: ["enum", "boolean"], writable: true });
    input("machine");
    expect(rows()).toEqual(["Machine", "On", "Mode"]);
  });

  it("selects from a group and gives the entries", async () => {
    const { machine, name } = setup();
    const result = depot_ui.select_state({
      from: machine,
      kind: "string",
      selected: [name],
    });
    expect(title()).toBe("Machine");
    expect(rows()).toEqual(["Name"]);
    button("Select").click();
    expect(await result).toEqual([name]);
  });

  it("throws for a group outside the states type", () => {
    const type = depot.type<number>("t", "Things", "");
    types.push(type);
    expect(() =>
      depot_ui.select_state({ from: type as DepotGroup<any> }),
    ).toThrow('Depot group "/t" is not in the states type');
  });

  it("drops the value subscriptions when closed", () => {
    const { temp } = setup();
    void depot_ui.select_state();
    input("machine");
    expect(temp.value.amount()).toBe(1);
    button("Cancel").click();
    expect(temp.value.amount()).toBe(0);
  });
});
