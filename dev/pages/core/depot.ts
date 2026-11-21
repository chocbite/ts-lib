import depot, {
  type DepotChild,
  type DepotGroup,
  type DepotSourceChild,
  type DepotSourceEntry,
  type DepotSourceGroup,
  type DepotType,
} from "@chocbite/ts-lib/depot";
import state, {
  STATE_ARRAY_READ_KEY,
  type StateArrayRead,
  type StateOrValROS,
  type StateROS,
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

/**Levels shown below a type, so a recursive provided source ends*/
const MAX_DEPTH = 5;

/**Shows a name in a span, following it when it is a state, returns a function dropping the subscription*/
function render_name(name: StateOrValROS<string>, parent: HTMLElement) {
  const span = parent.appendChild(document.createElement("span"));
  if (!state.is.state(name)) {
    span.textContent = `"${name}"`;
    return () => {};
  }
  const sub = name.sub((r) => {
    span.textContent = `"${r.value}"`;
  }, true);
  return () => name.unsub(sub);
}

/**Renders a group and everything below it, following children that are a state, constant children are shown once.
 * Returns a function dropping the subscriptions*/
function render_group(
  group: DepotGroup<unknown>,
  parent: HTMLElement,
  depth = 0,
) {
  const list = parent.appendChild(document.createElement("div"));
  list.style.paddingLeft = "1.2rem";
  if (depth >= MAX_DEPTH) {
    list.textContent = "…";
    return () => {};
  }
  let drops: (() => void)[] = [];
  const show = (children: readonly DepotChild<unknown>[]) => {
    for (const drop of drops) drop();
    drops = [];
    list.replaceChildren();
    for (const child of children)
      drops.push(render_child(child, list, depth + 1));
  };
  const children = group.children;
  if (!state.is.state(children)) {
    show(children);
    return () => {
      for (const drop of drops) drop();
    };
  }
  const sub = children.sub((r) => show(r.ok ? r.value : []), true);
  return () => {
    children.unsub(sub);
    for (const drop of drops) drop();
  };
}

function render_child(
  child: DepotChild<unknown>,
  parent: HTMLElement,
  depth: number,
) {
  const line = parent.appendChild(document.createElement("div"));
  line.append(child.id + (child.kind === "entry" ? "  " : "/  "));
  const drop_name = render_name(child.name, line);
  if (child.kind === "entry") {
    const value = line.appendChild(document.createElement("span"));
    value.style.opacity = "0.6";
    const content = child.value;
    if (!state.is.state(content)) {
      value.textContent = `  = ${JSON.stringify(content)} (constant)`;
      return drop_name;
    }
    const sub = content.sub((r) => {
      value.textContent = `  = ${r.ok ? JSON.stringify(r.value) : "⚠ " + r.error}`;
    }, true);
    return () => {
      drop_name();
      content.unsub(sub);
    };
  }
  const drop_group = render_group(child, parent, depth);
  return () => {
    drop_name();
    drop_group();
  };
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
      const line = tree.appendChild(document.createElement("div"));
      line.append(`/${type.id}  `);
      drops.push(render_name(type.name, line));
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
  //A registered group always has a children state
  const children = type.children as StateROS<readonly DepotChild<number>[]>;
  children.sub((res) => {
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
    "remove first": () => children.ok()[0]?.remove(),
    "remove last": () => children.ok().at(-1)?.remove(),
    "alias first, then remove alias": () => {
      const first = children.ok()[0];
      if (first) type.alias(`a${n++}`, first).remove();
    },
  });
}

//##################################################################################################################################################
{
  const sec = section(
    "Providers",
    "A source mounted at /server/objects, like objects users create on a server, its children a state. Add, rename and remove objects: the tree and the lookups should follow, a rename changes only the name, not the path. /server/loop is a recursive source, a group holding itself and a leaf, the tree stops at a depth, the lookups go as deep as asked, each path its own node. Unmount removes the objects mount, its lookups turn into errors",
  );
  const r = row(sec);
  const server = depot.type<number>("server", "Server", "Provided sources");
  /**An object on the server, the name a state as users rename it*/
  type ServerObject = DepotSourceEntry<number> & {
    name: ReturnType<typeof state.ok_w<string>>;
  };
  const objects = state.ok_w<DepotSourceChild<number>[]>([]);
  const source: DepotSourceGroup<number> = {
    name: "Objects",
    description: "Created by users",
    children: objects,
  };
  const leaf: DepotSourceEntry<number> = {
    name: "Leaf",
    description: "",
    value: 42,
  };
  const loop_children: DepotSourceChild<number>[] = [];
  const loop: DepotSourceGroup<number> = {
    name: "Loop",
    description: "Holds itself",
    children: loop_children,
  };
  loop_children.push(
    { id: "loop", source: loop },
    { id: "leaf", source: leaf },
  );
  let mount: DepotChild<number> | undefined = server.provide("objects", source);
  server.provide("loop", loop);
  tree_box(r);
  lookup_box(r, [
    "/server/objects",
    "/server/objects/o0",
    "/server/objects/o1",
    "/server/loop/leaf",
    "/server/loop/loop/loop/loop/loop/loop/leaf",
    "/server/loop/nope",
  ]);
  let n = 0;
  controls(sec, {
    "add object": () => {
      const object: ServerObject = {
        name: state.ok_w(`Object ${n}`),
        description: "",
        value: n,
      };
      objects.set_ok([...objects.ok(), { id: `o${n++}`, source: object }]);
    },
    "rename first": () => {
      const first = objects.ok()[0]?.source as ServerObject | undefined;
      first?.name.set_ok(first.name.ok() + "!");
    },
    "remove first": () => objects.set_ok(objects.ok().slice(1)),
    "unmount / mount": () => {
      if (mount) {
        mount.remove();
        mount = undefined;
      } else mount = server.provide("objects", source);
    },
  });
}

//##################################################################################################################################################
{
  const sec = section(
    "Provider cost",
    "Mounts a source of 100000 entries with a child lookup, then does 1000 lookups of different entries and 1000 of the same. Only the looked up entries get nodes, mounting should take no time whatever the size",
  );
  const r = row(sec);
  const log = log_box(r, "times");
  let run = 0;
  controls(sec, {
    run: () => {
      const id = `costprovided${run++}`;
      let t = performance.now();
      const lap = (text: string) => {
        const now = performance.now();
        log(`${text.padEnd(28)} ${(now - t).toFixed(1)}ms`);
        t = now;
      };
      const entries = new Map<string, DepotSourceEntry<number>>();
      for (let i = 0; i < 100000; i++)
        entries.set(`e${i}`, { name: `E${i}`, description: "", value: i });
      lap("make 100000 source items");
      const type = depot.type<number>(id, "Cost", "");
      type.provide("big", {
        name: "Big",
        description: "",
        children: [],
        child: (child) => entries.get(child),
      });
      lap("mount");
      for (let i = 0; i < 1000; i++) depot.get(`/${id}/big/e${i * 97}`).get();
      lap("1000 lookups");
      for (let i = 0; i < 1000; i++) depot.get(`/${id}/big/e5`).get();
      lap("1000 same lookups");
      type.remove();
      lap("remove type");
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
