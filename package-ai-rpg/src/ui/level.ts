//Level up window: player characters with skill points spend them, one point at a time, and say when they are done.
import { ENGINE } from "#engine";
import { Phase } from "#game";
import { Controller, world_skill_total, type Character } from "#world";
import form from "@chocbite/ts-lib-ui/form";
import { material_add_rounded } from "@chocbite/ts-lib-ui/icons";
import { el, panel, toast } from "./common";

/**Player characters still spending their skill points*/
export const level_waiting = (): Character[] => {
  const round = ENGINE.round.ok();
  if (round?.phase !== Phase.LevelUp) return [];
  return (round.leveling ?? []).flatMap((id) => {
    const c = ENGINE.world.character(id);
    return c && c.controller === Controller.Player ? [c] : [];
  });
};

/**Opens the level up window for the first player character still spending points*/
export function level_panel() {
  const character = level_waiting()[0];
  if (!character) return;
  const p = panel(`${character.name} levels up`);
  const body = p.body.appendChild(el("div", "review-list"));
  const render = () => {
    const c = ENGINE.world.character(character.id)!;
    body.replaceChildren(
      form.text({ text: `Level ${c.level}, ${c.skill_points} skill point${c.skill_points === 1 ? "" : "s"} to spend. Each point raises a skill by one, up to 100. Points can be kept for later.` }),
      ...ENGINE.world.skills().map((s) => {
        const level = c.skills.find((x) => x.skill === s.id)?.value ?? 0;
        return el(
          "div",
          "row",
          el("span", "review-summary", `${s.name}: ${level}${world_skill_total(ENGINE.world, c, s.id) !== level ? ` (${world_skill_total(ENGINE.world, c, s.id)} with items and effects)` : ""}`),
          form.button({
            icon: material_add_rounded,
            text: "1 point",
            on_click: async () => {
              const spent = await ENGINE.spend(c.id, s.id, 1);
              if (spent.err) toast(spent.error);
              render();
            },
          }),
        );
      }),
    );
  };
  render();
  p.footer.append(
    form.button({
      text: "Done",
      on_click: () => {
        ENGINE.level_done(character.id);
        p.close();
        //The next player character, if any
        if (level_waiting().length) level_panel();
      },
    }),
  );
}
