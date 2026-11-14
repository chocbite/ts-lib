//Location editor: a list of the locations in a sidebar that can be hidden, and the selected location's fields.
import { ENGINE } from "#engine";
import type { Game } from "#game";
import { local_get, local_set } from "#lib/local";
import { type Change, type Id, type Location } from "#world";
import form from "@chocbite/ts-lib-ui/form";
import { material_add_location_rounded, material_delete_rounded, material_side_navigation_rounded } from "@chocbite/ts-lib-ui/icons";
import list from "@chocbite/ts-lib-ui/list";
import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { el, field, icon_button, panel, toast } from "./common";

const SIDEBAR_KEY = "ai-rpg/editor-sidebar";

/**Applies hand made changes, problems are shown and nothing is changed*/
function edit(changes: Change[]) {
  const applied = ENGINE.edit_world(changes);
  if (applied.err) toast(applied.error);
  return applied;
}

/**Opens the location editor
 * @param select location to show first, the first location when not given*/
export function locations_panel(select?: Id) {
  const start = ENGINE.game.ok();
  if (!start) return;
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

  let selected: Id | undefined = select ?? Object.values(start.world.locations).find((l) => !l.gone)?.id;
  /**Row elements by location, to mark the selected one*/
  const rows = new Map<Id, HTMLElement>();

  const locations = state.p.ros(ENGINE.game, (g) => ok(g.value ? Object.values(g.value.world.locations) : []));
  sidebar.append(
    list.container(
      { name: list.column_string("Name", { align: "left" }) },
      (location: Location, row) => {
        //The list has no selection, a click on the row selects it
        rows.set(location.id, row);
        row.onclick = () => choose(location.id);
        row.classList.toggle("selected", location.id === selected);
        row.classList.toggle("gone", location.gone);
        return ok({ values: { name: location.gone ? `${location.name} (removed)` : location.name } });
      },
      locations,
      { headless: true },
    ),
    form.button({
      text: "New location",
      icon: material_add_location_rounded,
      on_click: () => {
        const added = edit([{ op: "add_location", id: "new:location", name: "New location", description: "" }]);
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
    const game: Game | undefined = ENGINE.game.ok();
    const location = selected ? game?.world.locations[selected] : undefined;
    if (!game || !location) return details.append(form.text({ text: "No location selected" }));
    const id = location.id;
    const here = Object.values(game.world.characters).filter((c) => !c.gone && c.location === id);
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
            on_click: () => {
              if (edit([{ op: "remove_location", location: id }]).ok) show();
            },
          }),
        ),
      );
  }
  show();
}
