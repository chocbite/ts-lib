//Records of a game, as they are stored.
import type { Change, Chunk, Id, World } from "#world";

export interface Game {
  /**Random id of the record, never shown to an LLM*/
  id: string;
  name: string;
  /**What the player asked for in the game builder*/
  premise: string;
  created: number;
  updated: number;
  world: World;
  /**Number of the current round*/
  round: number;
}

export const Phase = {
  /**Characters decide their actions, player characters submit theirs*/
  Characters: "characters",
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

export interface Round {
  game: string;
  n: number;
  phase: Phase;
  /**Characters taking part in the round, decided when it starts*/
  cast: Id[];
  /**Decided actions, a character without one has not decided yet*/
  actions: { [character: Id]: Action };
  story: Chunk[];
  changes: Change[];
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
