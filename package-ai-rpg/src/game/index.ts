//Records of a game, as they are stored.
import type { Change, Chunk, Id, Node } from "#world";

/**Details of a game, its world is stored in records of its own*/
export interface Game {
  /**Random id of the record, never shown to an LLM*/
  id: string;
  name: string;
  /**What the player asked for in the game builder*/
  premise: string;
  created: number;
  updated: number;
  /**Number of the current round*/
  round: number;
  /**Things at the top level of the world, in order*/
  roots: Id[];
}

/**Stored record of a node of the world, a thing, the Global node, a group or a definition, keyed by game and id*/
export type ThingRecord = Node & { game: string };
/**One memory of a character, keyed by game, character and its number*/
export interface MemoryRecord {
  game: string;
  character: Id;
  n: number;
  text: string;
}

export const Phase = {
  /**Characters with skill points spend them, only when someone has points*/
  LevelUp: "level_up",
  /**Characters decide their actions, player characters submit theirs*/
  Characters: "characters",
  /**Which actions need a roll, the code rolls*/
  Skillcheck: "skillcheck",
  /**Cowriter mode, the rolls can be changed before the storyteller runs*/
  RollsReview: "rolls_review",
  Storyteller: "storyteller",
  /**Cowriter mode, the story can be edited before the scribes run*/
  StoryReview: "story_review",
  Scribes: "scribes",
  /**Cowriter mode, the changes of the scribes can be edited before they are applied*/
  ChangesReview: "changes_review",
  Done: "done",
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

export const ActionSource = {
  Player: "player",
  Ai: "ai",
  /**Decided by an AI character's LLM, then changed by the player*/
  Edited: "edited",
} as const;
export type ActionSource = (typeof ActionSource)[keyof typeof ActionSource];

export interface Action {
  text: string;
  source: ActionSource;
}

export const Difficulty = { Trivial: "trivial", Easy: "easy", Normal: "normal", Hard: "hard", Extreme: "extreme" } as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

/**A check of an action, decided by the skillcheck, rolled by the code*/
export interface Roll {
  character: Id;
  /**What is checked, in a few words*/
  check: string;
  /**Skills that could help, the best one counts*/
  skills: Id[];
  difficulty: Difficulty;
  /**The d100 rolled, 1 to 100*/
  roll: number;
}

/**What the sub scribes have recorded so far, kept so a reload only runs the ones not done*/
export interface Scribed {
  time?: Change[];
  world?: Change[];
  characters: { [character: Id]: Change[] };
}

export interface Round {
  game: string;
  n: number;
  phase: Phase;
  /**Characters taking part in the round, decided when it starts*/
  cast: Id[];
  /**Decided actions, a character without one has not decided yet*/
  actions: { [character: Id]: Action };
  /**Characters with skill points that have not finished spending them, in the level up phase*/
  leveling?: Id[];
  rolls?: Roll[];
  story: Chunk[];
  scribed?: Scribed;
  changes: Change[];
  /**Which scribe made each change, by index, "time", "world", a character id, or "you" for changes added in the review*/
  sources?: string[];
  /**Problems with changes when they were applied, by index*/
  problems?: (string | undefined)[];
  /**Last failure, the round does not go on until it is retried*/
  error?: string;
}

/**A record of one LLM call, for debugging*/
export interface Call {
  id: string;
  game: string;
  round: number;
  role: string;
  /**Character the call was for, in the character phase*/
  character?: Id;
  model: string;
  messages: { role: string; content: string }[];
  reply: string;
  reasoning: string;
  error?: string;
  started: number;
  ms: number;
  prompt_tokens?: number;
  reply_tokens?: number;
}
