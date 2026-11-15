import { describe, expect, it } from "vitest";
import { world_apply, world_empty, type Change } from "#world";
import { rules_roll, rules_roll_text } from "./index";

const world = world_apply(world_empty(), [
  { op: "add_location", id: "new:here", name: "Here", description: "", in: "" },
  {
    op: "add_character",
    id: "new:mara",
    name: "Mara",
    description: "",
    appearance: "",
    bio: "",
    personality: "",
    goals: "",
    in: "new:here",
  },
  { op: "define_skill", id: "new:climb", name: "Climbing", description: "" },
  { op: "define_skill", id: "new:swim", name: "Swimming", description: "" },
  { op: "set_skill", thing: "new:mara", skill: "new:climb", value: 40 },
  { op: "add_item", id: "new:rope", name: "Rope", description: "", in: "new:mara" },
  { op: "set_skill", thing: "new:rope", skill: "new:climb", value: 10 },
] satisfies Change[]).world;

describe("rules", () => {
  it("rolls against the best skill plus 30 and the difficulty", () => {
    const roll = { character: "char:mara", check: "climb the wall", skills: ["skill:swimming", "skill:climbing"], difficulty: "hard" as const, roll: 59 };
    //50 with the rope, +30, -20 for hard
    expect(rules_roll(world, roll)).toEqual({ skill: "skill:climbing", total: 50, chance: 60, success: true, margin: 1 });
    expect(rules_roll_text(world, roll)).toBe("Mara, climb the wall: Climbing 50 against hard, chance 60, rolled 59, succeeded barely");
    expect(rules_roll(world, { ...roll, roll: 100, difficulty: "trivial" }).chance).toBe(95);
    expect(rules_roll(world, { ...roll, skills: [], difficulty: "extreme", roll: 5 })).toEqual({ skill: "", total: 0, chance: 5, success: true, margin: 0 });
  });
});
