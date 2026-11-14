//Prompts and reply schemas of every role. Prompts are built from the world each time, never from a growing chat.
//Stable parts come first, so the server can reuse its cache of the start of the prompt.
import type { Round } from "#game";
import type { LlmMessage } from "#lib/llm";
import { mention_map } from "#lib/mention";
import { schema_object, type Schema } from "#lib/schema";
import {
  NEW_ID_PATTERN,
  world_change_schema,
  world_characters,
  world_empty,
  world_known_as,
  world_locations,
  type Character,
  type Chunk,
  type Id,
  type World,
} from "#world";

const MEMORIES = 30;
const STORY_ROUNDS = 3;

const link = (name: string, id: Id) => `[${name}](${id})`;
const lines = (items: string[], empty = "- none") => (items.length ? items.join("\n") : empty);

/**The characters of the cast that are not gone*/
const cast_of = (world: World, round: Round) =>
  round.cast.map((id) => world.characters[id]).filter((c): c is Character => !!c && !c.gone);

/**Story as the viewer experienced it, with the names the viewer knows, or true names without a viewer*/
export function story_text(world: World, chunks: readonly Chunk[], viewer?: Id): string {
  const name = (id: Id) =>
    viewer ? world_known_as(world, viewer, id) : (world.characters[id]?.name ?? world.locations[id]?.name ?? id);
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
export function prompt_character(world: World, round: Round, character: Character, last?: Round): LlmMessage[] {
  const location = world.locations[character.location];
  const others = cast_of(world, round).filter((c) => c.id !== character.id);
  const known = others.map((o) => {
    const rel = character.relationships[o.id];
    const name = world_known_as(world, character.id, o.id);
    return `- ${link(name, o.id)}${rel?.opinion ? `, ${rel.opinion}` : rel ? "" : ", a stranger to you"}`;
  });
  const example = others[0] ? link(world_known_as(world, character.id, others[0].id), others[0].id) : "[Name](char:id)";
  const system = `You play one character in an interactive story. Stay in character and only decide what this character does and says next. Others decide everything else, including whether you succeed.

# You are ${character.name}
${character.bio}
Personality: ${character.personality}
Goals: ${character.goals}

# How to answer
Write what ${character.name} does and says next, in first person, one to four sentences. Say what you attempt, not how it turns out. Refer to the people here by their link, like ${example}.`;

  const witnessed = last && last.cast.includes(character.id) && last.story.length ? story_text(world, last.story, character.id) : "";
  const user = `# Where you are
${location ? `${location.name}: ${location.description}` : "Unknown"}
Time: ${world.time || "unknown"}

# Who is here
${lines(known, "- nobody else")}

# What you remember
${lines(character.memories.slice(-MEMORIES).map((m) => "- " + m), "- nothing yet")}

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

function world_text(world: World, cast: Character[]): string {
  const in_cast = new Set(cast.map((c) => c.id));
  const person = (c: Character) =>
    `- ${link(c.name, c.id)}, ${c.description} (${c.controller === "player" ? "player character" : "AI character"})\n  Appearance: ${c.appearance}\n  Bio: ${c.bio}\n  Personality: ${c.personality}\n  Goals: ${c.goals}\n  Knows: ${
      Object.entries(c.relationships)
        .map(([id, r]) => `${link(world.characters[id]?.name ?? id, id)} as "${r.known_as}", ${r.opinion}`)
        .join("; ") || "nobody"
    }`;
  const elsewhere = world_characters(world).filter((c) => !in_cast.has(c.id));
  return `Time: ${world.time || "unknown"}

## Locations
${lines(world_locations(world).map((l) => `- ${link(l.name, l.id)}: ${l.description}`))}

## Characters in the scene
${lines(cast.map((c) => `${person(c)}\n  At: ${link(world.locations[c.location]?.name ?? c.location, c.location)}`))}

## Characters elsewhere
${lines(elsewhere.map((c) => `- ${link(c.name, c.id)}, ${c.description}, at ${link(world.locations[c.location]?.name ?? c.location, c.location)}`))}`;
}

const recent_story = (world: World, rounds: readonly Round[]) =>
  rounds
    .filter((r) => r.story.length)
    .slice(-STORY_ROUNDS)
    .map((r) => story_text(world, r.story))
    .join("\n\n") || "The story has not started yet.";

const actions_text = (world: World, round: Round) =>
  lines(
    cast_of(world, round).map((c) => `- ${link(c.name, c.id)} (${c.controller === "player" ? "player" : "AI"}): ${round.actions[c.id]?.text ?? "does nothing"}`),
  );

/**Prompt for the storyteller deciding what happens
 * @param earlier rounds before this one, their stories give the storyteller the story so far*/
export function prompt_storyteller(world: World, round: Round, earlier: readonly Round[]): LlmMessage[] {
  const cast = cast_of(world, round);
  const system = `You are the storyteller of an interactive story. Each round every character in the scene, including the player's, says what they attempt. You decide what actually happens and write it as the next part of the story.

Rules:
- Characters only attempt things, you decide the outcome. Not everything succeeds, keep it believable within the world.
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

Write what happens.`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
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

/**Prompt for the scribes recording what the story changed*/
export function prompt_scribes(world: World, round: Round): LlmMessage[] {
  const cast = cast_of(world, round);
  const system = `You are the scribe of an interactive story. The storyteller has written what happened this round. You record it as changes to the world, so later rounds stay consistent. Only record what the story says, never invent.

Record:
- add_memory for every character in the scene: one or two sentences from their point of view, what they did, saw and heard. Only what they could perceive.
- move_character when a character went somewhere. For a new place, add_location first with an id like new:old-mill.
- add_character when someone new appeared, with an id like new:city-guard. appearance is what others see of them.
- set_relationship when a character learns another's name (known_as) or their opinion of them changes.
- update_character when a description, bio or goals changed in a lasting way.
- remove_character when someone dies or leaves the story for good.
- set_time when time passed noticeably.
Refer to characters and locations in text as markdown links with their id, like ${cast[0] ? link(cast[0].name, cast[0].id) : "[Name](char:id)"}. Keep every text short. Return an empty list when nothing changed.

# World
${world_text(world, cast)}`;
  const user = `# What each character attempted
${actions_text(world, round)}

# What happened
${story_text(world, round.story)}

Record the changes.`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export const schema_scribes = (world: World): Schema => schema_object({ changes: world_change_schema(world) });
export interface ScribesReply {
  changes: import("#world").Change[];
}

//      ____  _    _ _____ _      _____  ______ _____
//     |  _ \| |  | |_   _| |    |  __ \|  ____|  __ \
//     | |_) | |  | | | | | |    | |  | | |__  | |__) |
//     |  _ <| |  | | | | | |    | |  | |  __| |  _  /
//     | |_) | |__| |_| |_| |____| |__| | |____| | \ \
//     |____/ \____/|_____|______|_____/|______|_|  \_\

export const PROMPT_BUILDER = `You help the player create the world of an interactive text RPG. Talk with the player about what they want and refine it with them. Every reply has a short message to the player, a name for the game, the complete world as a list of changes that build it from nothing, and the opening of the story.

The world:
- add_location for every place, with ids like new:harbor-inn.
- add_character for every character, with ids like new:mara. controller is "player" for the characters the player plays, at least one, and "ai" for the others. description tells characters apart, appearance is what strangers see, location is where they start.
- set_relationship for characters that already know each other, known_as is the name they know them by.
- set_time for the starting time.
- Start small: one to three locations and two to five characters, more can appear while playing.

The opening is the first part of the story, setting the scene for the player in three to six chunks. A chunk with a speaker (a character's new: id) is only the words that character says, a chunk with an empty speaker is narration. Refer to characters and locations as markdown links with their new: id, like [Mara](new:mara).

When the player asks for changes, return the whole updated world again, keeping the ids of everything that stays.`;

export const schema_builder = (): Schema =>
  schema_object({
    message: { type: "string" },
    name: { type: "string" },
    changes: world_change_schema(world_empty(), true),
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
  changes: import("#world").Change[];
  opening: Chunk[];
}
