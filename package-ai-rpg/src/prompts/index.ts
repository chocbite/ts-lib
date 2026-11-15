//Prompts and reply schemas of every role. Prompts are built from the world each time, never from a growing chat.
//Stable parts come first, so the server can reuse its cache of the start of the prompt.
import { Difficulty, type Round } from "#game";
import { rules_roll_text } from "#rules";
import type { LlmMessage } from "#lib/llm";
import { mention_map } from "#lib/mention";
import { schema_object, type Schema } from "#lib/schema";
import {
  Kind,
  NEW_ID_PATTERN,
  SchemaFor,
  TimeUnit,
  world_attribute_texts,
  world_change_schema,
  world_empty,
  world_known_as,
  world_skill_texts,
  world_skill_total,
  world_subtree,
  world_time_text,
  world_visible,
  type Change,
  type Character,
  type Chunk,
  type Id,
  type Thing,
  type WorldRead,
} from "#world";

const MEMORIES = 30;
const STORY_ROUNDS = 3;

const link = (name: string, id: Id) => `[${name}](${id})`;

/**Attributes, skills, abilities and level of a character, one line each, empty lines left out*/
const sheet = (world: WorldRead, c: Character, indent = "") =>
  [
    `Level ${c.level}`,
    world_attribute_texts(world, c).join(", "),
    world_skill_texts(world, c).length ? "Skills: " + world_skill_texts(world, c).join(", ") : "",
    c.abilities.length ? "Abilities: " + c.abilities.map((a) => `${a.name} (${a.description})`).join("; ") : "",
  ]
    .filter(Boolean)
    .map((l) => indent + l)
    .join("\n");

/**Description of an item with its attributes and skill bonuses*/
const item_text = (world: WorldRead, t: Thing) => {
  const extra = [...world_attribute_texts(world, t), ...(t.kind === Kind.Item ? world_skill_texts(world, t) : [])];
  return t.description + (extra.length ? ` (${extra.join(", ")})` : "");
};
const lines = (items: string[], empty = "- none") => (items.length ? items.join("\n") : empty);

/**Where a thing is, as links from the nearest outwards, like "in [Hale](char:hale), in [Market Square](loc:square)"
 * @param name the name to show for a thing*/
const where = (world: WorldRead, id: Id, name: (t: Thing) => string = (t) => t.name) =>
  world
    .path(id)
    .map((t) => "in " + link(name(t), t.id))
    .join(", ") || "nowhere";

/**Depth of a thing below the thing a subtree is listed for*/
const depth = (world: WorldRead, id: Id, top: Id) => {
  let d = 0;
  for (const t of world.path(id)) {
    if (t.id === top) return d;
    d++;
  }
  return d;
};

/**The characters of the cast that are not gone*/
const cast_of = (world: WorldRead, round: Round) =>
  round.cast.map((id) => world.character(id)).filter((c): c is Character => !!c && !c.gone);

/**Story as the viewer experienced it, with the names the viewer knows, or true names without a viewer*/
export function story_text(world: WorldRead, chunks: readonly Chunk[], viewer?: Id): string {
  const name = (id: Id) =>
    viewer ? world_known_as(world, viewer, id) : (world.character(id)?.name ?? world.location(id)?.name ?? id);
  const text = (t: string) => mention_map(t, (shown, id) => (id.startsWith("char:") ? { text: name(id), id } : { text: shown, id }));
  return chunks
    .map((c) => (c.speaker ? `${link(name(c.speaker), c.speaker)}: "${text(c.text)}"` : text(c.text)))
    .join("\n");
}

//       _____ _    _          _____            _____ _______ ______ _____
//      / ____| |  | |   /\   |  __ \     /\   / ____|__   __|  ____|  __ \
//     | |    | |__| |  /  \  | |__) |   /  \ | |       | |  | |__  | |__) |
//     | |    |  __  | / /\ \ |  _  /   / /\ \| |       | |  |  __| |  _  /
//     | |____| |  | |/ ____ \| | \ \  / ____ \ |____   | |  | |____| | \ \
//      \_____|_|  |_/_/    \_\_|  \_\/_/    \_\_____|  |_|  |______|_|  \_\

/**Prompt for a character deciding its action
 * @param last the previous round, its story is included when the character took part in it*/
export function prompt_character(world: WorldRead, character: Character, last?: Round): LlmMessage[] {
  const place = world.place(character.id);
  const seen_as = (t: Thing) => (t.kind === Kind.Character ? world_known_as(world, character.id, t.id) : t.name);
  const visible = world_visible(world, character.id);
  const people = visible.filter((t): t is Character => t.kind === Kind.Character);
  const known = people.map((o) => {
    const rel = character.relationships[o.id];
    return `- ${link(seen_as(o), o.id)}${rel?.opinion ? `, ${rel.opinion}` : rel ? "" : ", a stranger to you"}`;
  });
  const things = visible.filter((t) => t.kind === Kind.Item).map((t) => `- ${link(t.name, t.id)}: ${item_text(world, t)}`);
  const exits = visible.filter((t) => t.kind === Kind.Location).map((t) => `- ${link(t.name, t.id)}`);
  const carried = world_subtree(world, character.id)
    .filter((t) => !t.gone)
    .map((t) => `${"  ".repeat(depth(world, t.id, character.id))}- ${link(seen_as(t), t.id)}: ${t.kind === Kind.Character ? t.appearance : item_text(world, t)}`);
  const example = people[0] ? link(seen_as(people[0]), people[0].id) : "[Name](char:id)";
  const system = `You play one character in an interactive story. Stay in character and only decide what this character does and says next. Others decide everything else, including whether you succeed.

# You are ${character.name}
${character.bio}
Personality: ${character.personality}
Goals: ${character.goals}
${sheet(world, character)}

# How to answer
Write what ${character.name} does and says next, in first person, one to four sentences. Say what you attempt, not how it turns out. Refer to the people here by their link, like ${example}.`;

  const witnessed = last && last.cast.includes(character.id) && last.story.length ? story_text(world, last.story, character.id) : "";
  const user = `# Where you are
You are ${where(world, character.id, seen_as)}.
${place ? `${place.name}: ${place.description}` : ""}
Time: ${world_time_text(world.time)}

# Who is here
${lines(known, "- nobody else")}

# What is here
${lines(things, "- nothing of note")}

# Ways to go
${lines(exits)}

# What you carry
${lines(carried, "- nothing")}

# What you remember
${lines(world.memories(character.id).slice(-MEMORIES).map((m) => "- " + m), "- nothing yet")}

# What just happened
${witnessed || "Nothing yet, this is where your story starts."}

What do you do?`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

//       _____ _______ ____  _______     _________ ______ _      _      ______ _____
//      / ____|__   __/ __ \|  __ \ \   / /__   __|  ____| |    | |    |  ____|  __ \
//     | (___    | | | |  | | |__) \ \_/ /   | |  | |__  | |    | |    | |__  | |__) |
//      \___ \   | | | |  | |  _  / \   /    | |  |  __| | |    | |    |  __| |  _  /
//      ____) |  | | | |__| | | \ \  | |     | |  | |____| |____| |____| |____| | \ \
//     |_____/   |_|  \____/|_|  \_\ |_|     |_|  |______|______|______|______|_|  \_\

/**The world for the storyteller and scribes: every location, everything in the places of the cast, and where the others are*/
function world_text(world: WorldRead, cast: Character[]): string {
  const places = [...new Set(cast.map((c) => world.place(c.id)).filter((p) => !!p))];
  const in_scene = new Set(places.flatMap((p) => world_subtree(world, p.id).map((t) => t.id)));
  const person = (c: Character, indent: string) =>
    `${indent}- ${link(c.name, c.id)}, ${c.description} (${c.controller === "player" ? "player character" : "AI character"})
${indent}  Appearance: ${c.appearance}
${indent}  Bio: ${c.bio}
${indent}  Personality: ${c.personality}
${indent}  Goals: ${c.goals}
${sheet(world, c, indent + "  ")}
${indent}  Knows: ${
      Object.entries(c.relationships)
        .map(([id, r]) => `${link(world.character(id)?.name ?? id, id)} as "${r.known_as}", ${r.opinion}`)
        .join("; ") || "nobody"
    }`;
  const locations = (parent: Id, indent: string): string[] =>
    world
      .inside(parent)
      .filter((t) => t.kind === Kind.Location && !t.gone)
      .flatMap((l) => [`${indent}- ${link(l.name, l.id)}: ${l.description}`, ...locations(l.id, indent + "  ")]);
  const scene = places.map((p) =>
    [
      `- ${link(p.name, p.id)}, ${where(world, p.id)}`,
      ...world_subtree(world, p.id)
        .filter((t) => !t.gone)
        .map((t) => {
          const indent = "  ".repeat(depth(world, t.id, p.id) + 1);
          return t.kind === Kind.Character ? person(t, indent) : `${indent}- ${link(t.name, t.id)} (${t.kind}): ${item_text(world, t)}`;
        }),
    ].join("\n"),
  );
  const elsewhere = world.characters().filter((c) => !in_scene.has(c.id));
  return `Time: ${world_time_text(world.time)}

## Attributes
${lines(world.attributes().map((a) => `- ${a.id}: ${a.name} (${a.type}${a.unit ? ", in " + a.unit : ""}, for ${a.kinds.join(", ")}): ${a.description}`))}

## Skills
${lines(world.skills().map((s) => `- ${s.id}: ${s.name}: ${s.description}`))}

## Locations
Nested locations are inside the location above them.
${lines(locations("", ""))}

## The scene
Everything in the places of this round, things are inside what is above them.
${lines(scene)}

## Characters elsewhere
${lines(elsewhere.map((c) => `- ${link(c.name, c.id)}, ${c.description}, ${where(world, c.id)}`))}`;
}

const recent_story = (world: WorldRead, rounds: readonly Round[]) =>
  rounds
    .filter((r) => r.story.length)
    .slice(-STORY_ROUNDS)
    .map((r) => story_text(world, r.story))
    .join("\n\n") || "The story has not started yet.";

const actions_text = (world: WorldRead, round: Round) =>
  lines(
    cast_of(world, round).map((c) => `- ${link(c.name, c.id)} (${c.controller === "player" ? "player" : "AI"}): ${round.actions[c.id]?.text ?? "does nothing"}`),
  );

const rolls_text = (world: WorldRead, round: Round) => lines((round.rolls ?? []).map((r) => "- " + rules_roll_text(world, r)), "- No action needed a roll.");

const messages = (system: string, user: string): LlmMessage[] => [
  { role: "system", content: system },
  { role: "user", content: user },
];

//       _____ _  _______ _      _       _____ _    _ ______ _____ _  __
//      / ____| |/ /_   _| |    | |     / ____| |  | |  ____/ ____| |/ /
//     | (___ | ' /  | | | |    | |    | |    | |__| | |__ | |    | ' /
//      \___ \|  <   | | | |    | |    | |    |  __  |  __|| |    |  <
//      ____) | . \ _| |_| |____| |____| |____| |  | | |___| |____| . \
//     |_____/|_|\_\_____|______|______|\_____|_|  |_|______\_____|_|\_\

/**Prompt for the skillcheck deciding which actions need a roll*/
export function prompt_skillcheck(world: WorldRead, round: Round): LlmMessage[] {
  const cast = cast_of(world, round);
  const system = `You are the referee of an interactive story. Each character in the scene says what they attempt. You decide which attempts are uncertain enough to need a roll of the dice. The game rolls, you only decide what is checked.

Rules:
- Only attempts that could fail and where failing matters get a check: climbing, sneaking, persuading someone unwilling, noticing something hidden, fighting. Talking, walking, looking around and simple tasks need none.
- At most one check per character, for the most uncertain part of what they attempt.
- check is what is tested in a few words, like "climb the mill wall".
- skills are the skills that could help, best first, the best one counts. Leave it empty when none fits.
- difficulty is how hard it is for anyone: trivial, easy, normal, hard or extreme.
- Return an empty list when nothing needs a roll.

# Skills
${lines(world.skills().map((s) => `- ${s.id}: ${s.name}: ${s.description}`))}

# Characters
${lines(cast.map((c) => `- ${link(c.name, c.id)}: ${world_skill_texts(world, c).join(", ") || "no skills"}`))}`;
  return messages(system, `# This round, what each character attempts\n${actions_text(world, round)}\n\nDecide the checks.`);
}

export function schema_skillcheck(world: WorldRead, round: Round): Schema {
  const skills = world.skills().map((s) => s.id);
  return schema_object({
    checks: {
      type: "array",
      items: schema_object({
        character: { type: "string", enum: round.cast.length ? round.cast : [""] },
        check: { type: "string" },
        skills: { type: "array", items: { type: "string", enum: skills.length ? skills : [""] } },
        difficulty: { type: "string", enum: Object.values(Difficulty) },
      }),
    },
  });
}
export interface SkillcheckReply {
  checks: { character: Id; check: string; skills: Id[]; difficulty: Difficulty }[];
}

//       _____ _______ ____  _______     _________ ______ _      _      ______ _____
//      / ____|__   __/ __ \|  __ \ \   / /__   __|  ____| |    | |    |  ____|  __ \
//     | (___    | | | |  | | |__) \ \_/ /   | |  | |__  | |    | |    | |__  | |__) |
//      \___ \   | | | |  | |  _  / \   /    | |  |  __| | |    | |    |  __| |  _  /
//      ____) |  | | | |__| | | \ \  | |     | |  | |____| |____| |____| |____| | \ \
//     |_____/   |_|  \____/|_|  \_\ |_|     |_|  |______|______|______|______|_|  \_\

/**Prompt for the storyteller deciding what happens
 * @param earlier rounds before this one, their stories give the storyteller the story so far*/
export function prompt_storyteller(world: WorldRead, round: Round, earlier: readonly Round[]): LlmMessage[] {
  const cast = cast_of(world, round);
  const system = `You are the storyteller of an interactive story. Each round every character in the scene, including the player's, says what they attempt. You decide what actually happens and write it as the next part of the story.

Rules:
- Characters only attempt things, you decide the outcome. Not everything succeeds, keep it believable within the world.
- Where the dice were rolled, the result is final: a failed roll fails, a barely won roll barely succeeds. Show it in the story, never mention dice or numbers.
- Describe only what can be seen and heard, never private thoughts. Characters only know what they witness.
- Do not make player characters do or say more than they attempted.
- Keep it vivid but short, three to eight chunks. Each chunk is one to three sentences.
- A chunk with a speaker is only the words that character says aloud, without quotes. A chunk with an empty speaker is narration.
- Refer to characters and locations as markdown links with their id, like ${cast[0] ? link(cast[0].name, cast[0].id) : "[Name](char:id)"}.
- New people and places may appear when the story needs them, describe them in plain text without a link, the scribes record them.

# World
${world_text(world, cast)}`;
  const user = `# The story so far
${recent_story(world, earlier)}

# This round, what each character attempts
${actions_text(world, round)}

# How the uncertain attempts went
${rolls_text(world, round)}

Write what happens.`;
  return messages(system, user);
}

/**Schema of the storyteller's reply, speakers are limited to the cast*/
export function schema_storyteller(round: Round): Schema {
  return schema_object({
    story: {
      type: "array",
      items: schema_object({
        speaker: { type: "string", enum: ["", ...round.cast] },
        text: { type: "string" },
      }),
    },
  });
}
export interface StorytellerReply {
  story: Chunk[];
}

//       _____  _____ _____  _____ ____  ______  _____
//      / ____|/ ____|  __ \|_   _|  _ \|  ____|/ ____|
//     | (___ | |    | |__) | | | | |_) | |__  | (___
//      \___ \| |    |  _  /  | | |  _ <|  __|  \___ \
//      ____) | |____| | \ \ _| |_| |_) | |____ ____) |
//     |_____/ \_____|_|  \_\_____|____/|______|_____/

const SCRIBE_RULES = `Only record what the story says, never invent. Keep every text short. Refer to characters and locations in text as markdown links with their id. Return an empty list when nothing changed.`;

/**What happened this round, for every scribe*/
const round_text = (world: WorldRead, round: Round) => `# What each character attempted
${actions_text(world, round)}

# How the uncertain attempts went
${rolls_text(world, round)}

# What happened
${story_text(world, round.story)}`;

/**Prompt for the time scribe, only how much time passed*/
export function prompt_scribe_time(world: WorldRead, round: Round): LlmMessage[] {
  const system = `You keep the clock of an interactive story. Read what happened this round and say how much time it took, as an amount and a unit (minutes, hours or days). A short exchange of words takes a few minutes, a walk across town half an hour, a night's sleep about eight hours.

It is now ${world_time_text(world.time)}.`;
  return messages(system, round_text(world, round) + "\n\nHow much time passed?");
}
export const schema_scribe_time = (): Schema => schema_object({ amount: { type: "number" }, unit: { type: "string", enum: Object.values(TimeUnit) } });
export interface ScribeTimeReply {
  amount: number;
  unit: TimeUnit;
}

/**Prompt for the world scribe: new things, and changes to things that are not characters of the scene*/
export function prompt_scribe_world(world: WorldRead, round: Round): LlmMessage[] {
  const cast = cast_of(world, round);
  const system = `You are the world scribe of an interactive story. The storyteller has written what happened this round. You record what changed in the world outside the characters themselves, other scribes record the characters. ${SCRIBE_RULES}

Record:
- add_location for a new place, with an id like new:old-mill, inside the location it is part of.
- add_character when someone new appeared, with an id like new:city-guard, in where they are. appearance is what others see of them.
- add_item for a new object that matters to the story, with an id like new:rusty-key, in the location, character or item that holds it.
- update when the name or description of a location or item changed in a lasting way (a broken door, a burned house).
- move for items or locations moved by something other than the characters of the scene.
- remove when an item is destroyed or used up, or a place is gone. Only things with nothing inside can be removed.
- set_attribute, add_to_attribute, set_local_attribute or remove_attribute when a value of a location or item changed ("amount": -3 for 3 less).
- add_effect for a change of a number attribute or skill that wears off, with how long it lasts.
- define_skill for a new kind of skill the story needed, set_skill for the bonus an item gives to a skill (-100 to 100).

# World
${world_text(world, cast)}`;
  return messages(system, round_text(world, round) + "\n\nRecord the changes to the world.");
}
export const schema_scribe_world = (world: WorldRead): Schema => schema_object({ changes: world_change_schema(world, SchemaFor.ScribeWorld) });

/**Prompt for the scribe of one character: what it remembers, where it went, what it took, learned and became
 * @param world the world with the changes of the world scribe, so new things can be used*/
export function prompt_scribe_character(world: WorldRead, round: Round, character: Character): LlmMessage[] {
  const cast = cast_of(world, round);
  const system = `You are the scribe of ${character.name} (${character.id}) in an interactive story. The storyteller has written what happened this round. You record what changed for ${character.name} only, other scribes record the rest. ${SCRIBE_RULES}

Record:
- add_memory, always one: one or two sentences from ${character.name}'s point of view, what they did, saw and heard. Only what they could perceive.
- move when ${character.name} went somewhere (into the location), picked something up (into ${character.id}), dropped it (into the location), handed it over (into the other character), put it into something (into the item).
- set_relationship when ${character.name} learned another's name (known_as) or their opinion of them changed.
- update when ${character.name}'s description, appearance, bio, personality or goals changed in a lasting way.
- set_attribute, add_to_attribute, set_local_attribute or remove_attribute when a value of ${character.name} or what they carry changed ("amount": -3 for losing 3 coins).
- add_effect for a change of a number attribute or skill that wears off, with how long it lasts, like a potion.
- remove when something ${character.name} carries is used up or destroyed.
- add_ability or remove_ability when ${character.name} gained or lost a lasting special ability.
- award_exp when ${character.name} achieved, learned or overcame something: small, medium or large, with the reason.

# ${character.name}
${character.description}
${sheet(world, character)}
Carries: ${
    world_subtree(world, character.id)
      .filter((t) => !t.gone)
      .map((t) => link(t.name, t.id))
      .join(", ") || "nothing"
  }

# World
${world_text(world, cast)}`;
  return messages(system, round_text(world, round) + `\n\nRecord the changes for ${character.name}.`);
}
export const schema_scribe_character = (world: WorldRead, character: Id): Schema =>
  schema_object({ changes: world_change_schema(world, SchemaFor.ScribeCharacter, character) });

export interface ScribesReply {
  changes: Change[];
}

//      _      ________      ________ _        _    _ _____
//     | |    |  ____\ \    / /  ____| |      | |  | |  __ \
//     | |    | |__   \ \  / /| |__  | |      | |  | | |__) |
//     | |    |  __|   \ \/ / |  __| | |      | |  | |  ___/
//     | |____| |____   \  /  | |____| |____  | |__| | |
//     |______|______|   \/   |______|______|  \____/|_|

/**Prompt for an AI character spending its skill points*/
export function prompt_level_up(world: WorldRead, character: Character): LlmMessage[] {
  const system = `You play ${character.name} in an interactive story.
${character.bio}
Personality: ${character.personality}
Goals: ${character.goals}

${character.name} has grown and has ${character.skill_points} skill points to spend. Each point raises a skill by one, no skill goes over 100. Choose the skills ${character.name} would grow in, from what they did and what they want. Spend all points.

# Skills now
${lines(world.skills().map((s) => `- ${s.id}: ${s.name} ${world_skill_total(world, character, s.id)}: ${s.description}`))}

# What ${character.name} remembers lately
${lines(world.memories(character.id).slice(-10).map((m) => "- " + m), "- nothing yet")}`;
  return messages(system, "Which skills do you raise, and by how many points?");
}
export function schema_level_up(world: WorldRead): Schema {
  const skills = world.skills().map((s) => s.id);
  return schema_object({
    raises: { type: "array", items: schema_object({ skill: { type: "string", enum: skills.length ? skills : [""] }, points: { type: "integer" } }) },
  });
}
export interface LevelUpReply {
  raises: { skill: Id; points: number }[];
}

//      ____  _    _ _____ _      _____  ______ _____
//     |  _ \| |  | |_   _| |    |  __ \|  ____|  __ \
//     | |_) | |  | | | | | |    | |  | | |__  | |__) |
//     |  _ <| |  | | | | | |    | |  | |  __| |  _  /
//     | |_) | |__| |_| |_| |____| |__| | |____| | \ \
//     |____/ \____/|_____|______|_____/|______|_|  \_\

export const PROMPT_BUILDER = `You help the player create the world of an interactive text RPG. Talk with the player about what they want and refine it with them. Every reply has a short message to the player, a name for the game, the complete world as a list of changes that build it from nothing, and the opening of the story.

The world is a tree: locations can be inside locations (a town holds an inn, the inn a cellar), characters and items are inside a location, a character or an item. "in" is the id of what it is inside, empty only for a location at the top level.
- add_location for every place, with ids like new:harbor-inn.
- add_character for every character, with ids like new:mara. controller is "player" for the characters the player plays, at least one, and "ai" for the others. description tells characters apart, appearance is what strangers see, in is where they start.
- add_item for objects that matter: what characters carry (in the character) and what lies around (in a location), with ids like new:silver-key.
- set_relationship for characters that already know each other, known_as is the name they know them by.
- set_time for the starting day (from 1), hour and minute.
- define_attribute for measurable properties that matter in this world (number with a unit, text or bool, and the kinds of thing that have it), like height in cm or coins. set_attribute gives things their values.
- define_skill for the skills that matter in this world, five to ten, like new:climbing. set_skill gives characters their level (0 to 100, 20 is a beginner, 50 skilled, 80 a master) and items their bonus (-100 to 100).
- add_ability for what makes a character special, a name and a description.
- Start small: one to three places and two to five characters, more can appear while playing.

The opening is the first part of the story, setting the scene for the player in three to six chunks. A chunk with a speaker (a character's new: id) is only the words that character says, a chunk with an empty speaker is narration. Refer to characters and locations as markdown links with their new: id, like [Mara](new:mara).

When the player asks for changes, return the whole updated world again, keeping the ids of everything that stays.`;

export const schema_builder = (): Schema =>
  schema_object({
    message: { type: "string" },
    name: { type: "string" },
    changes: world_change_schema(world_empty(), SchemaFor.Builder),
    opening: {
      type: "array",
      items: schema_object({
        speaker: { anyOf: [{ type: "string", enum: [""] }, { type: "string", pattern: NEW_ID_PATTERN }] },
        text: { type: "string" },
      }),
    },
  });
export interface BuilderReply {
  message: string;
  name: string;
  changes: Change[];
  opening: Chunk[];
}
