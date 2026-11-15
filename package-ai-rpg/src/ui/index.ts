//The user interface of the game.
import { ENGINE } from "#engine";
import { Phase } from "#game";
import { file_open, file_save } from "#lib/file";
import { local_get, local_set } from "#lib/local";
import { QUICK_GAME } from "#quick";
import { store_delete_game, store_export, store_games, store_import, store_on_error, store_ready } from "#store";
import ctm from "@chocbite/ts-lib-ui/context-menu";
import { material_public_rounded } from "@chocbite/ts-lib-ui/icons";
import { builder_panel } from "./builder";
import { icon_button, panel_close, toast } from "./common";
import { debug_panel } from "./debug";
import { level_panel } from "./level";
import { play_view } from "./play";
import { review_panel } from "./review";
import { settings_panel } from "./settings";
import { world_panel } from "./world";
import "./style.scss";
import "./theme";

const LAST_GAME = "ai-rpg/game";
const remember = (id: string | undefined) => local_set(LAST_GAME, id);

async function load(id: string) {
  const loaded = await ENGINE.load(id);
  if (loaded.err) toast(loaded.error);
}

function menu(button: HTMLElement) {
  const game = ENGINE.game.ok();
  ctm.summon(
    ctm.menu([
      ctm.line("Quick game", quick_game),
      ctm.line("New game", () => builder_panel()),
      ctm.sub(
        "Load game",
        ctm.menu(async () => {
          const games = await store_games();
          if (games.err) return [ctm.line(games.error, () => {})];
          return games.value
            .sort((a, b) => b.updated - a.updated)
            .map((g) => ctm.line(`${g.name}, round ${g.round}`, () => load(g.id), undefined, undefined, g.id === game?.id));
        }),
      ),
      ctm.line("Load from file", async () => {
        const file = await file_open(".json,application/json");
        if (!file) return;
        const id = await store_import(await file.text());
        if (id.err) return toast(id.error);
        load(id.value);
      }),
      game
        ? ctm.line("Save to file", async () => {
            const blob = await store_export(game.id);
            if (blob.err) return toast(blob.error);
            file_save(`${game.name.replace(/[^\w -]+/g, "").trim() || "game"}, round ${game.round}.json`, blob.value);
          })
        : undefined,
      ctm.devider(),
      game ? ctm.line("World", () => world_panel()) : undefined,
      game ? ctm.line("Debug log", debug_panel) : undefined,
      ctm.line("Settings", settings_panel),
      game ? ctm.sub("Delete this game", ctm.menu([ctm.line(`Yes, delete ${game.name}`, () => delete_game(game.id))])) : undefined,
    ]),
    button,
    undefined,
    undefined,
    true,
  );
}

/**Starts a fresh ready made game, for development*/
async function quick_game() {
  const created = await ENGINE.create(QUICK_GAME, "Quick game");
  if (created.err) toast(created.error);
}

async function delete_game(id: string) {
  ENGINE.close();
  remember(undefined);
  await store_delete_game(id);
  toast("The game was deleted", false);
}

export async function ui_start() {
  store_on_error(toast);
  ctm.default(false);
  play_view({ menu, review: review_panel });
  //Quick access to the world editor, shown while a game is loaded
  const world_button = document.body.appendChild(icon_button(material_public_rounded, "World", () => world_panel()));
  world_button.classList.add("world-button");
  ENGINE.game.sub((g) => (world_button.hidden = !g.value), true);
  if (store_ready.err) return toast(store_ready.error);

  //Reviews and the level up window open by themselves when a round reaches them
  const REVIEWS: Phase[] = [Phase.RollsReview, Phase.StoryReview, Phase.ChangesReview];
  let phase: Phase | undefined;
  ENGINE.round.sub((round) => {
    const next = round.value?.phase;
    if (next !== phase && phase !== undefined && (REVIEWS.includes(phase) || phase === Phase.LevelUp)) panel_close();
    if (next !== phase && next && REVIEWS.includes(next)) review_panel();
    if (next !== phase && next === Phase.LevelUp) level_panel();
    phase = next;
  });
  ENGINE.game.sub((g) => {
    if (g.value) remember(g.value.id);
  });

  const last = local_get(LAST_GAME);
  if (last) await load(last);
}
