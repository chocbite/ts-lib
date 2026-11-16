import depot, {
  type DepotChild,
  type DepotGroup,
  type DepotType,
} from "@chocbite/ts-lib/depot";
import state, {
  STATE_ARRAY_READ_KEY,
  type StateArrayRead,
} from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../helpers";

const MONO: Partial<CSSStyleDeclaration> = {
  border: "1px solid gray",
  padding: "0.4rem",
  fontFamily: "monospace",
  fontSize: "0.8rem",
  whiteSpace: "pre",
  overflow: "auto",
};

/**Adds a monospace log to the parent, returns a function writing a line to it*/
function log_box(parent: HTMLElement, label: string) {
  const log = box(parent, label, { width: "24rem", height: "14rem", ...MONO });
  return (text: string) => {
    log.appendChild(document.createElement("div")).textContent = text;
    log.scrollTop = log.scrollHeight;
  };
}

/**Renders a group and everything below it, following the children states.
 * Returns a function dropping the subscriptions*/
function render_group(group: DepotGroup<unknown>, parent: HTMLElement) {
  const list = parent.appendChild(document.createElement("div"));
  list.style.paddingLeft = "1.2rem";
  let drops: (() => void)[] = [];
  const sub = group.children.sub((r) => {
    for (const drop of drops) drop();
    drops = [];
    list.replaceChildren();
    for (const child of r.value) drops.push(render_child(child, list));
  }, true);
  return () => {
    group.children.unsub(sub);
    for (const drop of drops) drop();
  };
}

function render_child(child: DepotChild<unknown>, parent: HTMLElement) {
  const line = parent.appendChild(document.createElement("div"));
  if (child.kind === "entry") {
    line.textContent = `${child.id}  "${child.name}"`;
    const value = line.appendChild(document.createElement("span"));
    value.style.opacity = "0.6";
    const sub = child.value.sub((r) => {
      value.textContent = `  = ${r.ok ? JSON.stringify(r.value) : "⚠ " + r.error}`;
    }, true);
    return () => child.value.unsub(sub);
  }
  line.textContent = `${child.id}/  "${child.name}"`;
  return render_group(child, parent);
}

/**A live tree of every type in the depot*/
function tree_box(parent: HTMLElement) {
  const tree = box(parent, "depot", {
    width: "24rem",
    height: "18rem",
    ...MONO,
  });
  let drops: (() => void)[] = [];
  depot.types.sub((r) => {
    for (const drop of drops) drop();
    drops = [];
    tree.replaceChildren();
    for (const type of r.value) {
      //The cost section measures the depot, not rendering of the tree
      if (type.id.startsWith("cost")) continue;
      tree.appendChild(document.createElement("div")).textContent =
        `/${type.id}  "${type.name}"`;
      drops.push(render_group(type, tree));
    }
  }, true);
}

/**Shows the lookup state of each path, following changes*/
function lookup_box(parent: HTMLElement, paths: string[]) {
  const out = box(parent, "depot.get", { width: "30rem", ...MONO });
  for (const path of paths) {
    const line = out.appendChild(document.createElement("div"));
    depot.get(path).sub((r) => {
      line.textContent = `${path.padEnd(26)} ${r.ok ? `→ ${r.value.kind} ${r.value.path}` : "⚠ " + r.error}`;
      line.style.color = r.ok ? "" : "#c0392b";
    }, true);
  }
}

//##################################################################################################################################################
{
  const sec = section(
    "Tree and lookups",
    "The tree follows the children states, the lookups follow depot.get. Register and remove in any order: lookups should turn ok when their path is registered and back to an error when removed. /widgets/basic/rect is an alias, it should follow rectangle and turn into an error when rectangle is removed, even if rectangle is registered again (the alias points at the old node). /widgets/shapes/rectangle goes through an alias of the basic group. The temperature value changes every second through its state",
  );
  const r = row(sec);
  tree_box(r);
  lookup_box(r, [
    "/widgets",
    "/widgets/basic/rectangle",
    "/widgets/basic/rect",
    "/widgets/shapes/rectangle",
    "/widgets/basic/circle",
    "/states/machine/speed",
    "/states/machine/temperature",
    "/nope/x",
    "widgets/basic",
    "/widgets//basic",
  ]);

  let widgets: DepotType<{ sides: number }> | undefined;
  const node = (path: string) => depot.get(path).get().unwrap_or(undefined);
  const basic = () => {
    const n = widgets?.get("/basic").get().unwrap_or(undefined);
    return n?.kind === "group" ? n : undefined;
  };
  const temperature = state.ok_w(20);
  setInterval(() => temperature.set_ok(temperature.ok() + 1), 1000);

  const err = (f: () => void) => () => {
    try {
      f();
    } catch (e) {
      alert_line(String(e));
    }
  };
  const alert_line = (text: string) => (status.textContent = text);
  controls(sec, {
    "register widgets": err(() => {
      widgets = depot.type("widgets", "Widgets", "Elements placed on pages");
      widgets.group("basic", "Basic", "Basic shapes");
    }),
    "add rectangle": err(() => {
      const g = basic();
      if (!g) throw new Error("register widgets first");
      g.add("rectangle", "Rectangle", "", { sides: 4 });
    }),
    "add circle": err(() => {
      const g = basic();
      if (!g) throw new Error("register widgets first");
      g.add("circle", "Circle", "", { sides: 0 });
    }),
    "alias rect": err(() => {
      const g = basic();
      const rect = widgets?.get("/basic/rectangle").get().unwrap_or(undefined);
      if (!g || rect?.kind !== "entry") throw new Error("add rectangle first");
      g.alias("rect", rect);
    }),
    "alias shapes": err(() => {
      const g = basic();
      if (!g || !widgets) throw new Error("register widgets first");
      widgets.alias("shapes", g);
    }),
    "remove rectangle": err(() => node("/widgets/basic/rectangle")?.remove()),
    "remove basic": err(() => basic()?.remove()),
    "remove widgets": err(() => widgets?.remove()),
    "add machine states": err(() => {
      const machine = depot.states.group("machine", "Machine", "From the PLC");
      machine.add("speed", "Speed", "rpm", 1200);
      machine.add("temperature", "Temperature", "°C", temperature);
    }),
    "remove machine states": err(() => node("/states/machine")?.remove()),
    "remove states type": err(() => depot.states.remove()),
  });
  const status = sec.appendChild(document.createElement("p"));
  status.style.color = "#c0392b";
}

//##################################################################################################################################################
{
  const sec = section(
    "Children metadata",
    "Each line is one update of the children state of /log, with what the array metadata says was added or removed. Removing an alias should not log anything, aliases are not children",
  );
  const r = row(sec);
  const log = log_box(r, "log/children");
  const type = depot.type<number>("log", "Log", "For the children metadata");
  type.children.sub((res) => {
    const ops = (res.value as StateArrayRead<DepotChild<number>>)[
      STATE_ARRAY_READ_KEY
    ];
    if (!ops) return log(`fresh ${res.value.length}`);
    for (const op of ops)
      log(
        op.type === "moved"
          ? "moved"
          : `${op.type} ${"index" in op ? op.index : ""} ${op.items.map((i) => i.id).join(",")}`,
      );
  });
  let n = 0;
  controls(sec, {
    add: () => type.add(`e${n++}`, "", "", n),
    "add group": () => type.group(`g${n++}`, "", ""),
    "remove first": () => type.children.ok()[0]?.remove(),
    "remove last": () => type.children.ok().at(-1)?.remove(),
    "alias first, then remove alias": () => {
      const first = type.children.ok()[0];
      if (first) type.alias(`a${n++}`, first).remove();
    },
  });
}

//##################################################################################################################################################
{
  const sec = section(
    "Cost",
    "Times registering 10000 entries in 100 groups, holding 1000 lookups of them, then registering and removing one entry with those lookups held (each change in a type resolves every lookup of that type again), removing the type, and registering everything again with the lookups held, like an app that loaded saved pages before registering. Run it several times, times should not grow between runs",
  );
  const r = row(sec);
  const log = log_box(r, "times");
  let run = 0;
  controls(sec, {
    run: () => {
      const id = `cost${run++}`;
      let t = performance.now();
      const lap = (text: string) => {
        const now = performance.now();
        log(`${text.padEnd(28)} ${(now - t).toFixed(1)}ms`);
        t = now;
      };
      const type = depot.type<number>(id, "Cost", "");
      for (let g = 0; g < 100; g++) {
        const group = type.group(`g${g}`, "", "");
        for (let e = 0; e < 100; e++) group.add(`e${e}`, "", "", e);
      }
      lap("register 10000");
      const held = [];
      for (let i = 0; i < 1000; i++)
        held.push(depot.get(`/${id}/g${i % 100}/e${Math.floor(i / 10)}`));
      lap("1000 lookups");
      const extra = type.add("extra", "", "", 1);
      lap("register 1 with lookups");
      extra.remove();
      lap("remove 1 with lookups");
      type.remove();
      lap("remove type");
      const again = depot.type<number>(id, "Cost", "");
      lap("register type again");
      for (let g = 0; g < 100; g++) {
        const group = again.group(`g${g}`, "", "");
        for (let e = 0; e < 100; e++) group.add(`e${e}`, "", "", e);
      }
      lap("register 10000 with lookups");
      again.remove();
      lap("remove type with lookups");
      log(`lookups now ok: ${held.filter((h) => h.get().ok).length}`);
    },
  });
}
