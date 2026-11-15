//World editor: the tree of the world in a list in a sidebar that can be hidden, and the selected node's fields.
//The list's rows are the node states of the engine and its sub rows their children states, a change refreshes only its row.
//The Global node holds the settings and the groups of definitions, things hold lists of their attributes, skills and abilities,
//which are array states of entry states too.
import { ENGINE } from "#engine";
import { local_get, local_set } from "#lib/local";
import { split } from "#lib/split";
import {
  ATTRIBUTES,
  AttributeType,
  FIELDS,
  Kind,
  SETTINGS_FIELDS,
  THING_KINDS,
  world_duration_text,
  world_level_exp,
  type Ability,
  type AttributeDef,
  type AttributeValue,
  type Change,
  type Character,
  type Definition,
  type Effect,
  type Field,
  type GlobalNode,
  type Id,
  type Node,
  type SettingsField,
  type SkillValue,
  type Thing,
  type ThingKind,
  type Value,
} from "#world";
import ctm from "@chocbite/ts-lib-ui/context-menu";
import form from "@chocbite/ts-lib-ui/form";
import {
  material_add_location_rounded,
  material_add_rounded,
  material_auto_awesome_rounded,
  material_delete_rounded,
  material_inventory_2_rounded,
  material_location_on_rounded,
  material_person_add_rounded,
  material_person_rounded,
  material_psychology_rounded,
  material_public_rounded,
  material_school_rounded,
  material_side_navigation_rounded,
  material_straighten_rounded,
  material_tune_rounded,
} from "@chocbite/ts-lib-ui/icons";
import list from "@chocbite/ts-lib-ui/list";
import { ok } from "@chocbite/ts-lib/result";
import state, { type StateROS } from "@chocbite/ts-lib/state";
import { el, field, icon_button, panel, toast } from "./common";

const SIDEBAR_KEY = "ai-rpg/editor-sidebar";
const SIZE_KEY = "ai-rpg/editor-sidebar-size";

const ICONS = {
  [Kind.Location]: material_location_on_rounded,
  [Kind.Character]: material_person_rounded,
  [Kind.Item]: material_inventory_2_rounded,
  [Kind.Global]: material_public_rounded,
  [Kind.Group]: material_tune_rounded,
  [Kind.Attribute]: material_straighten_rounded,
  [Kind.Skill]: material_psychology_rounded,
};
const KIND_NAMES = {
  [Kind.Location]: "Location",
  [Kind.Character]: "Character",
  [Kind.Item]: "Item",
  [Kind.Global]: "Global",
  [Kind.Group]: "Group",
  [Kind.Attribute]: "Attribute",
  [Kind.Skill]: "Skill",
};
const TYPE_NAMES = [
  { value: AttributeType.Number, text: "Number" },
  { value: AttributeType.Text, text: "Text" },
  { value: AttributeType.Bool, text: "Yes or no" },
];
const SETTING_NAMES: { [F in SettingsField]: string } = {
  exp_small: "Experience of a small award",
  exp_medium: "Experience of a medium award",
  exp_large: "Experience of a large award",
  level_exp: "Experience from level 1 to 2",
  level_growth: "Each next level needs this many times more",
  skill_points_per_level: "Skill points per level",
};
/**What a field is for, shown under it, only where the name does not say it*/
const NOTES: { [F in Field]?: string } = {
  appearance: "What others see before they know this character",
};

const is_thing = (n: Node): n is Thing => (THING_KINDS as readonly string[]).includes(n.kind);
const title = (text: string) => text[0].toUpperCase() + text.slice(1);

/**Applies hand made changes, problems are shown and nothing is changed*/
async function edit(changes: Change[]) {
  const applied = await ENGINE.edit_world(changes);
  if (applied.err) toast(applied.error);
  return applied;
}

/**Adds a new thing or definition in the parent
 * @returns the id of what was added*/
async function add(kind: Kind, parent: Id): Promise<Id | undefined> {
  const base = { id: "new:node", name: `New ${KIND_NAMES[kind].toLowerCase()}`, description: "" };
  const change: Change | undefined =
    kind === Kind.Location
      ? { op: "add_location", ...base, in: parent }
      : kind === Kind.Item
        ? { op: "add_item", ...base, in: parent }
        : kind === Kind.Character
          ? { op: "add_character", ...base, in: parent, appearance: "", bio: "", personality: "", goals: "" }
          : kind === Kind.Attribute
            ? { op: "define_attribute", ...base, type: AttributeType.Number, unit: "", kinds: [...THING_KINDS] }
            : kind === Kind.Skill
              ? { op: "define_skill", ...base }
              : undefined;
  if (!change) return undefined;
  const added = await edit([change]);
  return added.ok ? added.value.ids.get("new:node") : undefined;
}

/**Opens the world editor
 * @param select node to show first, the first top level thing when not given*/
export function world_panel(select?: Id) {
  if (!ENGINE.game.ok()) return;
  const p = panel("World", true);
  const sidebar = el("div", "editor-sidebar");
  const details = el("div", "editor-details");
  //The width of the list and whether it is shown are kept from last time
  const layout = split(sidebar, details, {
    size: Number(local_get(SIZE_KEY)) || 18,
    min: 10,
    max: 40,
    on_size: (size) => local_set(SIZE_KEY, String(size)),
  });
  layout.element.classList.add("editor");
  p.body.append(layout.element);
  const toggle = (show: boolean) => {
    layout.first_shown = show;
    local_set(SIDEBAR_KEY, show ? undefined : "hidden");
  };
  toggle(local_get(SIDEBAR_KEY) !== "hidden");
  p.actions.append(icon_button(material_side_navigation_rounded, "Show or hide the list", () => toggle(!layout.first_shown)));

  const first = select ?? ENGINE.world.roots[0];
  const selected = state.ok_w<Id[]>(first ? [first] : []);
  const choose = (id: Id | undefined) => id && selected.write([id]);

  /**Adds inside the node of a row, opens the row so it shows, and selects what was added*/
  const add_inside = async (kind: Kind, parent: Id, row: { open: boolean }) => {
    const id = await add(kind, parent);
    if (!id) return;
    row.open = true;
    choose(id);
  };

  /**Menu lines of a row: adding inside it and removing it*/
  const menu = (node: Node, row: { open: boolean }) => {
    if (node.kind === Kind.Group) {
      const kind = node.id === ATTRIBUTES ? Kind.Attribute : Kind.Skill;
      return ctm.menu([ctm.line(`Add ${kind === Kind.Attribute ? "an attribute" : "a skill"}`, () => add_inside(kind, node.id, row), material_add_rounded())]);
    }
    if (node.kind === Kind.Attribute || node.kind === Kind.Skill)
      return ctm.menu([ctm.line(`Remove ${node.name}`, () => edit([{ op: "remove_definition", definition: node.id }]), material_delete_rounded())]);
    if (!is_thing(node)) return undefined;
    return ctm.menu([
      node.kind === Kind.Location
        ? ctm.line("Add a location inside", () => add_inside(Kind.Location, node.id, row), material_add_location_rounded())
        : undefined,
      ctm.line("Add a character inside", () => add_inside(Kind.Character, node.id, row), material_person_add_rounded()),
      ctm.line("Add an item inside", () => add_inside(Kind.Item, node.id, row), material_inventory_2_rounded()),
      ctm.devider(),
      ctm.line(`Remove ${node.name}`, () => edit([{ op: "remove", thing: node.id }]), material_delete_rounded()),
    ]);
  };

  const tree = list
    .container(
      {},
      (node_state: StateROS<Node>, row) => {
        const node = node_state.ok();
        return ok({
          openable: node.children.length > 0,
          key_field: { icon: ICONS[node.kind], text: node.name },
          sub_rows: () => ENGINE.children(node.id)!,
          context_menu: menu(node, row),
          values: {},
        });
      },
      ENGINE.roots,
      {
        headless: true,
        sub_rows: true,
        selection: { mode: "single", key: (node_state) => node_state.ok().id },
        add_row: {
          text: "New location",
          icon: material_add_location_rounded,
          on_add: async () => choose(await add(Kind.Location, "")),
        },
        reorder: {
          //The engine takes a moved thing out of its old parent itself
          no_remove: true,
          can_drop: (node_state, target) => {
            const node = node_state.ok();
            const into = target.parent?.ok();
            //Definitions are reordered inside their group, Global and the groups stay where they are
            if (node.kind === Kind.Attribute || node.kind === Kind.Skill) return into?.id === node.parent;
            if (!is_thing(node) || (into && !is_thing(into))) return false;
            return node.kind === Kind.Location ? !into || into.kind === Kind.Location : !!into;
          },
        },
      },
    )
    .bind({ selection: selected });
  sidebar.append(tree);

  /**Shows the form of the selected node, values are written when a field is left*/
  function show() {
    details.replaceChildren();
    const id = selected.ok()[0];
    const node = id ? ENGINE.world.node(id) : undefined;
    if (!node || node.gone) return details.append(form.text({ text: "Nothing selected" }));
    details.append(el("h3", undefined, node.kind === Kind.Group ? node.name : KIND_NAMES[node.kind]));
    if (node.kind === Kind.Global) details.append(...global_form(node));
    else if (node.kind === Kind.Group)
      details.append(
        form.text({
          text:
            node.id === ATTRIBUTES
              ? "Attributes every thing of the chosen kinds can have a value of, like height or coins. Add one from the menu of this row."
              : "Skills characters have a level of, 0 to 100, and items give a bonus to. Add one from the menu of this row.",
        }),
      );
    else if (node.kind === Kind.Attribute || node.kind === Kind.Skill) details.append(...definition_form(node));
    else details.append(...thing_form(node));
  }
  selected.sub(() => show());
  //A removed node leaves the tree, the selection is cleared instead of showing it
  tree.attach_state(ENGINE.changed, () => {
    const id = selected.ok()[0];
    if (id && ENGINE.world.node(id)?.gone) selected.write([]);
  });
  show();
}

//       ______ ____  _____  __  __  _____
//      |  ____/ __ \|  __ \|  \/  |/ ____|
//      | |__ | |  | | |__) | \  / | (___
//      |  __|| |  | |  _  /| |\/| |\___ \
//      | |   | |__| | | \ \| |  | |____) |
//      |_|    \____/|_|  \_\_|  |_|_____/

/**Time and experience settings*/
function global_form(node: GlobalNode): HTMLElement[] {
  const time = node.settings.time;
  const parts = { day: Math.floor(time / 1440) + 1, hour: Math.floor((time % 1440) / 60), minute: time % 60 };
  const part = (name: keyof typeof parts, min: number, max: number) =>
    form.number_input({
      value: parts[name],
      min,
      max,
      change: (value) => {
        parts[name] = value;
        edit([{ op: "set_time", ...parts }]);
      },
    });
  return [
    field("Day", part("day", 1, 100000)),
    el("div", "row", field("Hour", part("hour", 0, 23)), field("Minute", part("minute", 0, 59))),
    el("h4", undefined, "Experience"),
    ...SETTINGS_FIELDS.map((name) =>
      field(
        SETTING_NAMES[name],
        form.number_input({
          value: node.settings[name],
          min: name === "level_growth" ? 1 : 0,
          decimals: name === "level_growth" ? 2 : 0,
          change: (value) => edit([{ op: "update_settings", field: name, value }]),
        }),
      ),
    ),
  ];
}

/**Name and description of a definition, and the type, unit and kinds of an attribute*/
function definition_form(def: Definition): HTMLElement[] {
  const set = (field: "name" | "description" | "unit") => (value: string) => edit([{ op: "update_definition", definition: def.id, field, value }]);
  const fields = [
    field("Name", form.text_input({ value: def.name, change: set("name") })),
    field("Description", form.text_multiline({ value: def.description, change: set("description") })),
  ];
  if (def.kind !== Kind.Attribute) return fields;
  const kinds = new Set(def.kinds);
  return [
    ...fields,
    field(
      "Type",
      form.dropdown({
        selections: TYPE_NAMES,
        value: def.type,
        change: (value) => edit([{ op: "update_definition", definition: def.id, field: "type", value }]),
      }),
      "Can only change while nothing has a value of it",
    ),
    field("Unit", form.text_input({ value: def.unit, change: set("unit") }), "For numbers, like cm or coins"),
    el(
      "div",
      "row",
      ...THING_KINDS.map((kind) =>
        field(
          `${title(kind)}s have it`,
          form.switch({
            value: kinds.has(kind),
            change: (on) => {
              if (on) kinds.add(kind);
              else kinds.delete(kind);
              edit([{ op: "update_definition", definition: def.id, field: "kinds", value: THING_KINDS.filter((k) => kinds.has(k)) }]);
            },
          }),
        ),
      ),
    ),
  ];
}

/**Fields of a thing, and the lists of its attributes, skills and abilities*/
function thing_form(thing: Thing): HTMLElement[] {
  const fields = (Object.keys(FIELDS) as Field[])
    .filter((name) => (FIELDS[name] as readonly ThingKind[]).includes(thing.kind))
    .map((name) => {
      const value = (thing as unknown as { [field: string]: string })[name];
      const change = (value: string) => edit([{ op: "update", thing: thing.id, field: name, value }]);
      return field(title(name), name === "name" ? form.text_input({ value, change }) : form.text_multiline({ value, change }), NOTES[name]);
    });
  return [
    ...fields,
    ...(thing.kind === Kind.Character ? [level_text(thing)] : []),
    field("Attributes", attribute_list(thing)),
    ...(thing.kind !== Kind.Location ? [field(thing.kind === Kind.Character ? "Skills" : "Skill bonuses", skill_list(thing))] : []),
    ...(thing.kind === Kind.Character ? [field("Abilities", ability_list(thing))] : []),
    field("Effects", effect_list(thing), "Changes that wear off, made by the story, like a potion"),
  ];
}

function effect_list(thing: Thing) {
  const world = ENGINE.world;
  return list.container(
    { target: list.column_string("Changes", { align: "left" }), amount: list.column_string("By"), left: list.column_string("For") },
    (entry_state: StateROS<Effect>) => {
      const e = entry_state.ok();
      const local = world.thing(thing.id)?.attributes.find((v) => v.id === e.target)?.local;
      return ok({
        values: {
          target: `${local?.name ?? world.node(e.target)?.name ?? e.target}, from ${e.reason || "an effect"}`,
          amount: (e.amount >= 0 ? "+" : "") + e.amount,
          left: world_duration_text(e.until - world.time),
        },
        context_menu: ctm.menu([ctm.line("Remove", () => edit([{ op: "remove_effect", thing: thing.id, effect: e.id }]), material_delete_rounded())]),
      });
    },
    ENGINE.effects(thing.id),
    { headless: true },
  );
}

/**Level and experience of a character*/
function level_text(c: Character) {
  const next = world_level_exp(ENGINE.world.settings, c.level + 1);
  return field(
    "Level",
    form.text({ text: `Level ${c.level}, ${c.exp} of ${next} experience to the next level, ${c.skill_points} skill points not spent` }),
  );
}

/**A form element in a list cell, made again when the entry changes*/
const node_column = (title: string) =>
  list.column({
    title,
    align: "left",
    field_gen: () => list.node_field(el("div")),
    field_apply: (cell, make: () => HTMLElement) => cell.node.replaceChildren(make()),
  });

/**Input for a value of the type*/
function value_input(type: string, value: Value, change: (value: Value) => void, unit = ""): HTMLElement {
  if (type === AttributeType.Number) return form.number_input({ value: typeof value === "number" ? value : 0, unit, change });
  if (type === AttributeType.Bool) return form.switch({ value: value === true, change });
  return form.text_input({ value: String(value), change });
}

const DEFAULTS: { [T in AttributeType]: Value } = { number: 0, text: "", bool: false };

/**A name for a new local attribute the thing does not have yet, "New attribute", "New attribute 2"*/
function free_name(id: Id): string {
  const names = new Set(ENGINE.world.thing(id)?.attributes.map((v) => v.local?.name.toLowerCase()));
  for (let n = 1; ; n++) if (!names.has(n === 1 ? "new attribute" : `new attribute ${n}`)) return n === 1 ? "New attribute" : `New attribute ${n}`;
}

function attribute_list(thing: Thing) {
  const world = ENGINE.world;
  const container = list.container(
    { name: node_column("Name"), value: node_column("Value") },
    (entry_state: StateROS<AttributeValue>) => {
      const entry = entry_state.ok();
      const def: AttributeDef | undefined = world.attribute(entry.id);
      const shape = entry.local ?? def;
      const local = entry.local;
      return ok({
        values: {
          //Only a local attribute is named here, a global one is renamed under Global
          name: () =>
            local
              ? form.text_input({
                  value: local.name,
                  change: (name) => edit([{ op: "set_local_attribute", thing: thing.id, ...local, name, value: entry.value, attribute: entry.id }]),
                })
              : form.text({ text: shape?.name ?? entry.id }),
          value: () =>
            value_input(
              shape?.type ?? AttributeType.Text,
              entry.value,
              (value) =>
                edit([
                  local
                    ? { op: "set_local_attribute", thing: thing.id, ...local, value, attribute: entry.id }
                    : { op: "set_attribute", thing: thing.id, attribute: entry.id, value },
                ]),
              shape?.unit,
            ),
        },
        context_menu: ctm.menu([ctm.line("Remove", () => edit([{ op: "remove_attribute", thing: thing.id, attribute: entry.id }]), material_delete_rounded())]),
      });
    },
    ENGINE.attributes(thing.id),
    {
      headless: true,
      add_row: {
        text: "Add attribute",
        icon: material_add_rounded,
        on_add: () => {
          const has = new Set(ENGINE.world.thing(thing.id)?.attributes.map((v) => v.id));
          const global = world.attributes().filter((a) => a.kinds.includes(thing.kind) && !has.has(a.id));
          ctm.summon(
            ctm.menu([
              ...global.map((a) => ctm.line(a.name + (a.unit ? ` (${a.unit})` : ""), () => edit([{ op: "set_attribute", thing: thing.id, attribute: a.id, value: DEFAULTS[a.type] }]))),
              global.length ? ctm.devider() : undefined,
              ctm.sub(
                "Only for this one",
                ctm.menu(
                  TYPE_NAMES.map((t) =>
                    ctm.line(t.text, () =>
                      edit([{ op: "set_local_attribute", thing: thing.id, name: free_name(thing.id), type: t.value, unit: "", value: DEFAULTS[t.value] }]),
                    ),
                  ),
                ),
              ),
            ]),
            container,
            undefined,
            undefined,
            true,
          );
        },
      },
    },
  );
  return container;
}

function skill_list(thing: Exclude<Thing, { kind: "location" }>) {
  const world = ENGINE.world;
  const [min, max] = thing.kind === Kind.Character ? [0, 100] : [-100, 100];
  const container = list.container(
    { name: list.column_string("Skill", { align: "left" }), value: node_column(thing.kind === Kind.Character ? "Level" : "Bonus") },
    (entry_state: StateROS<SkillValue>) => {
      const entry = entry_state.ok();
      return ok({
        values: {
          name: world.skill(entry.skill)?.name ?? entry.skill,
          value: () => form.number_input({ value: entry.value, min, max, change: (value) => edit([{ op: "set_skill", thing: thing.id, skill: entry.skill, value }]) }),
        },
        context_menu: ctm.menu([ctm.line("Remove", () => edit([{ op: "remove_skill", thing: thing.id, skill: entry.skill }]), material_delete_rounded())]),
      });
    },
    ENGINE.skills(thing.id),
    {
      headless: true,
      add_row: {
        text: "Add skill",
        icon: material_school_rounded,
        on_add: () => {
          const current = ENGINE.world.thing(thing.id);
          const has = new Set(current && "skills" in current ? current.skills.map((s) => s.skill) : []);
          const skills = world.skills().filter((s) => !has.has(s.id));
          ctm.summon(
            ctm.menu(
              skills.length
                ? skills.map((s) => ctm.line(s.name, () => edit([{ op: "set_skill", thing: thing.id, skill: s.id, value: 0 }])))
                : [ctm.line("Every skill is added, new skills are made under Global", () => {})],
            ),
            container,
            undefined,
            undefined,
            true,
          );
        },
      },
    },
  );
  return container;
}

function ability_list(c: Character) {
  const set = (ability: Id, field: "name" | "description") => (value: string) =>
    edit([{ op: "update_ability", character: c.id, ability, field, value }]);
  return list.container(
    { name: node_column("Name"), description: node_column("Description") },
    (entry_state: StateROS<Ability>) => {
      const a = entry_state.ok();
      return ok({
        values: {
          name: () => form.text_input({ value: a.name, change: set(a.id, "name") }),
          description: () => form.text_input({ value: a.description, change: set(a.id, "description") }),
        },
        context_menu: ctm.menu([ctm.line("Remove", () => edit([{ op: "remove_ability", character: c.id, ability: a.id }]), material_delete_rounded())]),
      });
    },
    ENGINE.abilities(c.id),
    {
      headless: true,
      add_row: {
        text: "Add ability",
        icon: material_auto_awesome_rounded,
        on_add: () => edit([{ op: "add_ability", character: c.id, name: "New ability", description: "" }]),
      },
    },
  );
}
