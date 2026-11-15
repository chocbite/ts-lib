//Location editor: a list of the locations in a sidebar that can be hidden, and the selected location's fields.
//The list's rows are the location states of the engine, a changed location refreshes only its row.
import { ENGINE } from "#engine";
import { local_get, local_set } from "#lib/local";
import { world_characters, world_locations, type Change, type Id, type Location } from "#world";
import form from "@chocbite/ts-lib-ui/form";
import { material_add_location_rounded, material_delete_rounded, material_side_navigation_rounded } from "@chocbite/ts-lib-ui/icons";
import list from "@chocbite/ts-lib-ui/list";
import { ok } from "@chocbite/ts-lib/result";
import type { StateROS } from "@chocbite/ts-lib/state";
import { el, field, icon_button, panel, toast } from "./common";

const SIDEBAR_KEY = "ai-rpg/editor-sidebar";

/**Applies hand made changes, problems are shown and nothing is changed*/
async function edit(changes: Change[]) {
  const applied = await ENGINE.edit_world(changes);
  if (applied.err) toast(applied.error);
  return applied;
}

/**Opens the location editor
 * @param select location to show first, the first location when not given*/
export function locations_panel(select?: Id) {
  if (!ENGINE.game.ok()) return;
  const p = panel("Locations", true);
  const layout = p.body.appendChild(el("div", "editor"));
  const sidebar = layout.appendChild(el("div", "editor-sidebar"));
  const details = layout.appendChild(el("div", "editor-details"));

  //The sidebar is shown or hidden as it was last time
  const toggle = (show: boolean) => {
    layout.classList.toggle("no-sidebar", !show);
    local_set(SIDEBAR_KEY, show ? undefined : "hidden");
  };
  toggle(local_get(SIDEBAR_KEY) !== "hidden");
  p.actions.append(icon_button(material_side_navigation_rounded, "Show or hide the list", () => toggle(layout.classList.contains("no-sidebar"))));

  let selected: Id | undefined = select ?? world_locations(ENGINE.world)[0]?.id;
  //Workaround until list has selection, to be replaced by the library's selection: row elements by location, to mark the selected one
  const rows = new Map<Id, HTMLElement>();

  sidebar.append(
    list.container(
      { name: list.column_string("Name", { align: "left" }) },
      (location_state: StateROS<Location>, row) => {
        const location = location_state.ok();
        rows.set(location.id, row);
        row.onclick = () => choose(location.id);
        row.classList.toggle("selected", location.id === selected);
        row.classList.toggle("gone", location.gone);
        return ok({ values: { name: location.gone ? `${location.name} (removed)` : location.name } });
      },
      ENGINE.locations,
      { headless: true },
    ),
    form.button({
      text: "New location",
      icon: material_add_location_rounded,
      on_click: async () => {
        const added = await edit([{ op: "add_location", id: "new:location", name: "New location", description: "" }]);
        if (added.ok) choose(added.value.ids.get("new:location"));
      },
    }),
  );

  function choose(id: Id | undefined) {
    selected = id;
    for (const [row_id, row] of rows) row.classList.toggle("selected", row_id === id);
    show();
  }

  /**Shows the fields of the selected location, values are written when a field is left*/
  function show() {
    details.replaceChildren();
    const location = selected ? ENGINE.world.location(selected) : undefined;
    if (!location) return details.append(form.text({ text: "No location selected" }));
    const id = location.id;
    const here = world_characters(ENGINE.world).filter((c) => c.location === id);
    details.append(
      field(
        "Name",
        form.text_input({
          value: location.name,
          change: (value) => edit([{ op: "update_location", location: id, field: "name", value }]),
        }),
        `Id ${id}, the id stays when the name changes`,
      ),
      field(
        "Description",
        form.text_multiline({
          value: location.description,
          change: (value) => edit([{ op: "update_location", location: id, field: "description", value }]),
        }),
        "What the storyteller and the characters are told about the place. Mentions are written as [Name](char:id)",
      ),
      field("Characters here", form.text({ text: here.map((c) => c.name).join(", ") || "Nobody" })),
    );
    if (location.gone) details.append(form.text({ text: "This location is removed, its id is kept so old rounds still refer to it" }));
    else
      details.append(
        el(
          "div",
          "row",
          form.button({
            text: "Remove location",
            icon: material_delete_rounded,
            on_click: async () => {
              if ((await edit([{ op: "remove_location", location: id }])).ok) show();
            },
          }),
        ),
      );
  }
  show();
}
