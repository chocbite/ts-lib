//The rules the code applies: rolling skillchecks. The LLMs decide what is checked, the code does the numbers.
import { Difficulty, type Roll } from "#game";
import { world_skill_total, type Id, type WorldRead } from "#world";

/**Added to the chance for each difficulty*/
export const DIFFICULTY: { [D in Difficulty]: number } = { trivial: 40, easy: 20, normal: 0, hard: -20, extreme: -40 };

/**A d100, 1 to 100*/
export const rules_d100 = () => 1 + Math.floor(Math.random() * 100);

export interface RollResult {
  /**The skill that counted, the best one, empty when none was given*/
  skill: Id;
  /**Total of that skill*/
  total: number;
  /**Chance to succeed, 5 to 95*/
  chance: number;
  success: boolean;
  /**Chance minus roll, how far above or below*/
  margin: number;
}

/**Works out a roll: the best skill counts, the chance is its total plus 30 plus the difficulty, at most 95 and at least 5*/
export function rules_roll(world: WorldRead, roll: Roll): RollResult {
  const c = world.character(roll.character);
  const totals = roll.skills.map((skill) => ({ skill, total: c ? world_skill_total(world, c, skill) : 0 }));
  const best = totals.reduce((a, b) => (b.total > a.total ? b : a), { skill: "", total: 0 });
  const chance = Math.max(5, Math.min(95, best.total + 30 + (DIFFICULTY[roll.difficulty] ?? 0)));
  return { ...best, chance, success: roll.roll <= chance, margin: chance - roll.roll };
}

/**How a roll went in words, for the storyteller and the player, "succeeded easily"*/
export function rules_roll_word(result: RollResult): string {
  const how = Math.abs(result.margin) >= 30 ? (result.success ? " easily" : " badly") : Math.abs(result.margin) <= 10 ? " barely" : "";
  return (result.success ? "succeeded" : "failed") + how;
}

/**A roll as one line, "Tamsin Vell, climb the wall: Climbing 50 against hard, chance 60, rolled 72, failed barely"*/
export function rules_roll_text(world: WorldRead, roll: Roll): string {
  const r = rules_roll(world, roll);
  const skill = r.skill ? `${world.skill(r.skill)?.name ?? r.skill} ${r.total}` : "no skill";
  return `${world.character(roll.character)?.name ?? roll.character}, ${roll.check}: ${skill} against ${roll.difficulty}, chance ${r.chance}, rolled ${roll.roll}, ${rules_roll_word(r)}`;
}
