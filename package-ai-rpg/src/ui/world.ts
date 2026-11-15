//World editor: the tree of the world in a list in a sidebar that can be hidden, and the selected thing's fields.
//The list's rows are the thing states of the engine and its sub rows their children states, a change refreshes only its row.
import { ENGINE } from "#engine";
import { local_get, local_set } from "#lib/local";
import {
  Controller,
  FIELDS,
  Kind,
  world_subtree,
  type Change,
  type Character,
  type Field,
  type Id,
  type Thing,
} from "#world";
import ctm from "@chocbite/ts-lib-ui/context-menu";
import form from "@chocbite/ts-lib-ui/form";
import {
  material_add_location_rounded,
  material_delete_rounded,
  material_inventory_2_rounded,
  material_location_on_rounded,
  material_person_add_rounded,
  material_person_rounded,
  material_side_navigation_rounded,
} from "@chocbite/ts-lib-ui/icons";
import list from "@chocbite/ts-lib-ui/list";
import { ok } from "@chocbite/ts-lib/result";
import state, { type StateROS } from "@chocbite/ts-lib/state";
import { el, field, icon_button, panel, toast } from "./common";

const SIDEBAR_KEY = "ai-rpg/editor-sidebar";

const ICONS = {
  [Kind.Location]: material_location_on_rounded,
  [Kind.Character]: material_person_rounded,
  [Kind.Item]: material_inventory_2_rounded,
};
const KIND_NAMES = {
  [Kind.Location]: "location",
  [Kind.Character]: "character",
  [Kind.Item]: "item",
};

/**What each field is for, shown under it*/
const NOTES: { [F in Field]: string } = {
  name: "The id stays when the name changes",
  description:
    "What the storyteller and the scribes are told about it. Mentions are written as [Name](char:id)",
  appearance:
    "What others see before they know this character, used as its name until they learn the real one",
  bio: "",
  personality: "",
  goals: "",
};

/**Applies hand made changes, problems are shown and nothing is changed*/
async function edit(changes: Change[]) {
  const applied = await ENGINE.edit_world(changes);
  if (applied.err) toast(applied.error);
  return applied;
}

/**Adds a new thing in the parent
 * @returns the id of the new thing*/
async function add(kind: Kind, parent: Id): Promise<Id | undefined> {
  const base = {
    id: "new:thing",
    name: `New ${KIND_NAMES[kind]}`,
    description: "",
    in: parent,
  };
  const change: Change =
    kind === Kind.Location
      ? { op: "add_location", ...base }
      : kind === Kind.Item
        ? { op: "add_item", ...base }
        : {
            op: "add_character",
            ...base,
            appearance: "",
            bio: "",
            personality: "",
            goals: "",
          };
  const added = await edit([change]);
  return added.ok ? added.value.ids.get("new:thing") : undefined;
}

/**Things the thing can be put in, with the path to each as text, the top level as an empty id*/
function targets(thing: Thing): { value: Id; text: string }[] {
  const world = ENGINE.world;
  const own = new Set([
    thing.id,
    ...world_subtree(world, thing.id).map((t) => t.id),
  ]);
  const all = world_subtree(world, "").filter(
    (t) =>
      !own.has(t.id) &&
      !t.gone &&
      (thing.kind !== Kind.Location || t.kind === Kind.Location),
  );
  const text = (t: Thing) =>
    [...world.path(t.id).reverse(), t].map((p) => p.name).join(" › ");
  return [
    ...(thing.kind === Kind.Location
      ? [{ value: "", text: "The top level" }]
      : []),
    ...all.map((t) => ({ value: t.id, text: text(t) })),
  ];
}

/**Opens the world editor
 * @param select thing to show first, the first location when not given*/
export function world_panel(select?: Id) {
  if (!ENGINE.game.ok()) return;
  const p = panel("World", true);
  const layout = p.body.appendChild(el("div", "editor"));
  const sidebar = layout.appendChild(el("div", "editor-sidebar"));
  const details = layout.appendChild(el("div", "editor-details"));

  //The sidebar is shown or hidden as it was last time
  const toggle = (show: boolean) => {
    layout.classList.toggle("no-sidebar", !show);
    local_set(SIDEBAR_KEY, show ? undefined : "hidden");
  };
  toggle(local_get(SIDEBAR_KEY) !== "hidden");
  p.actions.append(
    icon_button(material_side_navigation_rounded, "Show or hide the list", () =>
      toggle(layout.classList.contains("no-sidebar")),
    ),
  );

  const first = select ?? ENGINE.world.roots[0];
  const selected = state.ok_w<Id[]>(first ? [first] : []);
  const choose = (id: Id | undefined) => id && selected.write([id]);

  /**Adds a thing inside the thing of a row, opens the row so it shows, and selects it*/
  const add_inside = async (kind: Kind, thing: Thing, row: { open: boolean }) => {
    const id = await add(kind, thing.id);
    if (!id) return;
    row.open = true;
    choose(id);
  };

  /**Menu lines of a row: adding inside it and removing it*/
  const menu = (thing: Thing, row: { open: boolean }) =>
    ctm.menu([
      thing.kind === Kind.Location
        ? ctm.line(
            "Add a location inside",
            () => add_inside(Kind.Location, thing, row),
            material_add_location_rounded(),
          )
        : undefined,
      ctm.line(
        "Add a character inside",
        () => add_inside(Kind.Character, thing, row),
        material_person_add_rounded(),
      ),
      ctm.line(
        "Add an item inside",
        () => add_inside(Kind.Item, thing, row),
        material_inventory_2_rounded(),
      ),
      ctm.devider(),
      ctm.line(
        `Remove ${thing.name}`,
        () => edit([{ op: "remove", thing: thing.id }]),
        material_delete_rounded(),
      ),
    ]);

  const tree = list
    .container(
      {},
      (thing_state: StateROS<Thing>, row) => {
        const thing = thing_state.ok();
        return ok({
          openable: thing.children.length > 0,
          key_field: { icon: ICONS[thing.kind], text: thing.name },
          sub_rows: () => ENGINE.children(thing.id)!,
          context_menu: menu(thing, row),
          values: {},
        });
      },
      ENGINE.roots,
      {
        headless: true,
        sub_rows: true,
        selection: {
          mode: "single",
          key: (thing_state) => thing_state.ok().id,
        },
        reorder: {
          can_drop: (thing_state, target) => {
            const thing = thing_state.ok();
            const into = target.parent?.ok();
            return thing.kind === Kind.Location
              ? !into || into.kind === Kind.Location
              : !!into;
          },
        },
      },
    )
    .bind({ selection: selected });
  sidebar.append(
    tree,
    form.button({
      text: "New location",
      icon: material_add_location_rounded,
      on_click: async () => choose(await add(Kind.Location, "")),
    }),
  );

  /**Shows the fields of the selected thing, values are written when a field is left*/
  function show() {
    details.replaceChildren();
    const id = selected.ok()[0];
    const thing = id ? ENGINE.world.thing(id) : undefined;
    if (!thing || thing.gone)
      return details.append(form.text({ text: "Nothing selected" }));
    details.append(
      el(
        "h3",
        undefined,
        `${KIND_NAMES[thing.kind][0].toUpperCase()}${KIND_NAMES[thing.kind].slice(1)}, ${thing.id}`,
      ),
    );
    for (const name of Object.keys(FIELDS) as Field[]) {
      if (!(FIELDS[name] as readonly Kind[]).includes(thing.kind)) continue;
      const value = (thing as unknown as { [field: string]: string })[name];
      const change = (value: string) =>
        edit([{ op: "update", thing: thing.id, field: name, value }]);
      const input =
        name === "name"
          ? form.text_input({ value, change })
          : form.text_multiline({ value, change });
      details.append(
        field(
          name[0].toUpperCase() + name.slice(1),
          input,
          NOTES[name] || undefined,
        ),
      );
    }
    details.append(
      field(
        "Inside",
        form.dropdown({
          selections: targets(thing),
          value: thing.parent,
          change: async (to) => {
            if ((await edit([{ op: "move", thing: thing.id, in: to }])).ok)
              show();
          },
        }),
        "Moving it takes everything inside along",
      ),
    );
    if (thing.kind === Kind.Character) details.append(...character_info(thing));
    details.append(
      el(
        "div",
        "row",
        form.button({
          text: `Remove ${KIND_NAMES[thing.kind]}`,
          icon: material_delete_rounded,
          on_click: () => edit([{ op: "remove", thing: thing.id }]),
        }),
      ),
    );
  }
  selected.sub(() => show());
  //A removed thing leaves the tree, the selection is cleared instead of showing it
  tree.attach_state(ENGINE.changed, () => {
    const id = selected.ok()[0];
    if (id && ENGINE.world.thing(id)?.gone) selected.write([]);
  });
  show();
}

/**What can not be edited here yet: who plays the character, who it knows and what it remembers*/
function character_info(c: Character) {
  const world = ENGINE.world;
  const knows = Object.entries(c.relationships).map(
    ([id, r]) =>
      `${world.thing(id)?.name ?? id} as "${r.known_as}", ${r.opinion}`,
  );
  const memories = world.memories(c.id);
  return [
    field(
      "Played by",
      form.text({
        text: c.controller === Controller.Player ? "The player" : "The AI",
      }),
    ),
    field("Knows", form.text({ text: knows.join("\n") || "Nobody" })),
    field(
      "Remembers",
      form.text({ text: memories.slice(-10).join("\n") || "Nothing yet" }),
      memories.length > 10 ? `The last 10 of ${memories.length}` : undefined,
    ),
  ];
}
