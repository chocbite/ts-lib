//Storage of games in IndexedDB, and save files.
import { Db } from "#lib/db";
import type { Call, Game, Round } from "#game";
import { id_random } from "#lib/ids";
import type { LlmMessage } from "#lib/llm";
import type { BuilderReply } from "#prompts";
import { err, ok, type Result } from "@chocbite/ts-lib/result";

/**A game builder session*/
export interface Build {
  id: string;
  created: number;
  updated: number;
  /**Chat with the builder, assistant messages hold the JSON reply*/
  messages: LlmMessage[];
  /**Latest world proposal, from the last reply or edited by hand*/
  proposal?: BuilderReply;
}

const DB = await Db.open("ai-rpg", 1, {
  games: { key: "id" },
  rounds: { key: ["game", "n"] },
  calls: { key: ["game", "round", "id"] },
  builds: { key: "id" },
});

/**Shown when storage fails, so it is never silent*/
let on_error: (error: string) => void = (e) => console.error(e);
export const store_on_error = (handler: (error: string) => void) => (on_error = handler);

const report = <T>(result: Result<T, string>): Result<T, string> => {
  if (result.err) on_error("Saving failed: " + result.error);
  return result;
};

const db = () => {
  if (DB.err) throw new Error("The game storage could not be opened: " + DB.error);
  return DB.value;
};
export const store_ready: Result<void, string> = DB.ok ? ok(undefined) : err(DB.error);

//Asks the browser not to delete the storage when the disk runs low
navigator.storage?.persist?.();

//       _____          __  __ ______  _____
//      / ____|   /\   |  \/  |  ____|/ ____|
//     | |  __   /  \  | \  / | |__  | (___
//     | | |_ | / /\ \ | |\/| |  __|  \___ \
//     | |__| |/ ____ \| |  | | |____ ____) |
//      \_____/_/    \_\_|  |_|______|_____/

export const store_games = () => db().all<Game>("games");
export const store_game = (id: string) => db().get<Game>("games", id);
//Every compound key starting with the prefix, an array sorts after every number and string
const prefix_range = (...prefix: IDBValidKey[]) => IDBKeyRange.bound(prefix, [...prefix, []]);
export const store_rounds = (game: string) => db().all<Round>("rounds", prefix_range(game));
export const store_calls = (game: string, round: number) => db().all<Call>("calls", prefix_range(game, round));

export const store_put_game = async (game: Game) => report(await db().put("games", game));
export const store_put_round = async (round: Round) => report(await db().put("rounds", round));
export const store_put_call = async (call: Call) => report(await db().put("calls", call));

/**Saves the game and rounds together, either all of it is saved or none*/
export const store_put = async (game: Game, ...rounds: Round[]) =>
  report(
    await db().write(["games", "rounds"], (tx) => {
      tx.objectStore("games").put(game);
      for (const round of rounds) tx.objectStore("rounds").put(round);
    }),
  );

export const store_delete_game = async (game: string) =>
  report(
    await db().write(["games", "rounds", "calls"], (tx) => {
      tx.objectStore("games").delete(game);
      tx.objectStore("rounds").delete(prefix_range(game));
      tx.objectStore("calls").delete(prefix_range(game));
    }),
  );

export const store_builds = () => db().all<Build>("builds");
export const store_put_build = async (build: Build) => report(await db().put("builds", build));
export const store_delete_build = async (id: string) => report(await db().delete("builds", id));

//       _____         __      ________   ______ _____ _      ______  _____
//      / ____|  /\    \ \    / /  ____| |  ____|_   _| |    |  ____|/ ____|
//     | (___   /  \    \ \  / /| |__    | |__    | | | |    | |__  | (___
//      \___ \ / /\ \    \ \/ / |  __|   |  __|   | | | |    |  __|  \___ \
//      ____) / ____ \    \  /  | |____  | |     _| |_| |____| |____ ____) |
//     |_____/_/    \_\    \/   |______| |_|    |_____|______|______|_____/

const FORMAT = "ai-rpg-save";
const VERSION = 1;

interface SaveFile {
  format: typeof FORMAT;
  version: number;
  game: Game;
  rounds: Round[];
}

/**Save file of a game, as JSON*/
export async function store_export(game: string): Promise<Result<Blob, string>> {
  const g = await store_game(game);
  if (g.err) return g;
  if (!g.value) return err("The game does not exist");
  const rounds = await store_rounds(game);
  if (rounds.err) return rounds;
  const file: SaveFile = { format: FORMAT, version: VERSION, game: g.value, rounds: rounds.value };
  return ok(new Blob([JSON.stringify(file)], { type: "application/json" }));
}

/**Loads a save file as a new game, it never replaces an existing game
 * @returns the id of the new game*/
export async function store_import(text: string): Promise<Result<string, string>> {
  let file: SaveFile;
  try {
    file = JSON.parse(text) as SaveFile;
  } catch (e) {
    return err("The file is not a save file: " + String(e));
  }
  if (file?.format !== FORMAT || !file.game || !Array.isArray(file.rounds))
    return err("The file is not a save file of this game");
  if (file.version > VERSION) return err("The save file is from a newer version of the game");
  const id = id_random();
  const game: Game = { ...file.game, id, updated: Date.now() };
  const rounds = file.rounds.map((r) => ({ ...r, game: id }));
  const saved = await store_put(game, ...rounds);
  return saved.err ? saved : ok(id);
}
