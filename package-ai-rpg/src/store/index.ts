//Storage of games in IndexedDB, and save files.
//Every record holds one thing, so a save writes only what changed.
import type { Call, Game, MemoryRecord, Round, ThingRecord } from "#game";
import { Db } from "#lib/db";
import { id_random } from "#lib/ids";
import type { LlmMessage } from "#lib/llm";
import type { BuilderReply } from "#prompts";
import type { Thing } from "#world";
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

//Version 3 made the world a tree of things, older databases are reset
const DB = await Db.open(
  "ai-rpg",
  3,
  {
    games: { key: "id" },
    things: { key: ["game", "id"] },
    memories: { key: ["game", "character", "n"] },
    rounds: { key: ["game", "n"] },
    calls: { key: ["game", "round", "id"] },
    builds: { key: "id" },
  },
  { reset_before: 3 },
);

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

//Every compound key starting with the prefix, an array sorts after every number and string
const prefix_range = (...prefix: IDBValidKey[]) => IDBKeyRange.bound(prefix, [...prefix, []]);

//       _____          __  __ ______  _____
//      / ____|   /\   |  \/  |  ____|/ ____|
//     | |  __   /  \  | \  / | |__  | (___
//     | | |_ | / /\ \ | |\/| |  __|  \___ \
//     | |__| |/ ____ \| |  | | |____ ____) |
//      \_____/_/    \_\_|  |_|______|_____/

/**Everything stored for a game*/
export interface GameRecords {
  game: Game;
  things: ThingRecord[];
  /**In order of character and number*/
  memories: MemoryRecord[];
  /**In order of number*/
  rounds: Round[];
}

export const store_games = () => db().all<Game>("games");

/**Reads every record of a game*/
export async function store_load(id: string): Promise<Result<GameRecords, string>> {
  const game = await db().get<Game>("games", id);
  if (game.err) return game;
  if (!game.value) return err("The game does not exist");
  const things = await db().all<ThingRecord>("things", prefix_range(id));
  if (things.err) return things;
  const memories = await db().all<MemoryRecord>("memories", prefix_range(id));
  if (memories.err) return memories;
  const rounds = await db().all<Round>("rounds", prefix_range(id));
  if (rounds.err) return rounds;
  return ok({
    game: game.value,
    things: things.value,
    memories: memories.value,
    rounds: rounds.value,
  });
}

/**Records to save for a game, everything given is saved in one transaction, all of it or none*/
export interface GameWrite {
  game?: Game;
  things?: readonly Thing[];
  memories?: readonly MemoryRecord[];
  rounds?: readonly Round[];
}

/**Saves records of a game, all of them or none*/
export const store_write = async (game: string, write: GameWrite) =>
  report(
    await db().write(["games", "things", "memories", "rounds"], (tx) => {
      if (write.game) tx.objectStore("games").put(write.game);
      for (const t of write.things ?? []) tx.objectStore("things").put({ ...t, game });
      for (const m of write.memories ?? []) tx.objectStore("memories").put(m);
      for (const r of write.rounds ?? []) tx.objectStore("rounds").put(r);
    }),
  );

export const store_put_round = async (round: Round) => report(await db().put("rounds", round));
export const store_put_call = async (call: Call) => report(await db().put("calls", call));
export const store_calls = (game: string, round: number) => db().all<Call>("calls", prefix_range(game, round));

export const store_delete_game = async (game: string) =>
  report(
    await db().write(["games", "things", "memories", "rounds", "calls"], (tx) => {
      tx.objectStore("games").delete(game);
      for (const store of ["things", "memories", "rounds", "calls"]) tx.objectStore(store).delete(prefix_range(game));
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
const VERSION = 3;

interface SaveFile extends GameRecords {
  format: typeof FORMAT;
  version: number;
}

/**Save file of a game, as JSON*/
export async function store_export(game: string): Promise<Result<Blob, string>> {
  const records = await store_load(game);
  if (records.err) return records;
  const file: SaveFile = { format: FORMAT, version: VERSION, ...records.value };
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
  if (file?.format !== FORMAT) return err("The file is not a save file of this game");
  if (file.version > VERSION) return err("The save file is from a newer version of the game");
  if (file.version < VERSION) return err("The save file is from an older version of the game, its format can not be loaded any more");
  const id = id_random();
  const saved = await store_write(id, {
    game: { ...file.game, id, updated: Date.now() },
    things: file.things,
    memories: file.memories.map((m) => ({ ...m, game: id })),
    rounds: file.rounds.map((r) => ({ ...r, game: id })),
  });
  return saved.err ? saved : ok(id);
}
