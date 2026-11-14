# ai-rpg design

A text based RPG where the story is run by several LLMs, each with its own role. Points are marked as decided, proposed or open. Decided points are not changed without the user. Update this file when a decision is made or changes.

## Targets

- Landscape or square screens. Phones work turned sideways, portrait is not a target.
- For now the game runs from the dev server. A single self contained html file is set up in the build (see `AGENTS.md`), but may be rethought, so nothing depends on it yet.
- First AI backend: a local OpenAI compatible server (LiteLLM in front of llama-swap / llama.cpp). Server address, key and model are settings in the game, never built in.

## Screen

Decided:

- The whole page is one big image, the scene.
- At the bottom middle is the prompt input. Next to it a floating hamburger button opens the menus (new game, game builder, save, load, settings).
- Above the prompt the story text floats over the image, no panel. It is made readable by a dark gradient rising from the bottom and a text shadow, not by blur (too expensive on low end hardware). Lines are limited to about 65 characters.
- The story of a round is shown in small chunks the player clicks through, like most RPGs, not as one wall of text.
- Text only first, with placeholder images. Generated images (ComfyUI) are the end goal, see [Images](#images).

### Character tab on the prompt

Decided: the prompt input has a tab on its side with the icon and name of the character it is for. Clicking it switches character.

- On a player character, the prompt is that character's action for the round.
- On an AI character (cowriter mode), the prompt shows the action its LLM decided, so it can be inspected.
- Several player characters are supported the same way, switch to each one and enter its action.

Proposed: the action of an AI character can be edited, which replaces what its LLM decided for this round.

## A round

Decided: a round runs in three phases, each with its own LLM calls.

1. **Characters.** One LLM call per AI character, each with its own context: who it is, its personality, what it knows, the situation it is in. It answers what it wants to do and say. Characters do not know each other's actions or the player's, so the calls start right when the round starts and run while the player is reading and typing. The phase ends when every player character has submitted its action. If an AI character has not decided by then, the game waits for it.
2. **Storyteller.** Gets all actions and the world state and decides what happens. Its text is the story shown to the player: what happens, what the characters say.
3. **Scribes.** Take what the storyteller decided and update the world: add characters, change locations, update bios, memories and relationships. The scribes only record what the storyteller decided, they do not invent.

The player only waits for the storyteller. Without cowriter mode the scribes run in the background while the player clicks through the story, and must finish before the next round's character phase.

### Cowriter mode

Decided: cowriter mode is a setting. It lets the player see and change everything the LLMs decide.

- The character tab shows the AI characters' actions (see above).
- After the storyteller, the game does not go on to the scribes by itself. A **next phase** button moves on, until then the storyteller's text can be edited.
- After the scribes, a review view lists every change the scribes want to make. The player can edit, remove or add changes before they are applied and the next round starts.

## Game builder

Decided: a new game is built from prompts in a game builder, a separate view with a chat. The player describes the premise, an LLM proposes the world (locations, characters, the player characters, the opening situation), and the player refines it by chatting more or by editing the world directly. A game can have several builder chats.

Open: can the builder be opened on a running game, to change the world between rounds?

## State

The game owns the state, not the chat history. Every prompt is built from the state each round, so contexts stay short and do not grow without limit. Stable parts first (bio, personality) and changing parts last, so the server can reuse its cache of the prompt start.

Proposed model, a starting point:

```
Game      { id, name, created, updated, time, phase, locations[], characters[] }
Character { id, name, icon, bio, personality, goals, location, memories[], relationships{id → { known_as, opinion }}, controller: "player" | "ai", gone }
Location  { id, name, description, image? }
Round     { game, n, actions{character → text}, rolls[], story[], changes[], applied }
```

A character's memories hold only what it witnessed or was told, that is what keeps characters from knowing everything. The scribes write them.

### References

Decided: every game object has an id, so two characters with the same name are never confused. Text alone cannot tell them apart.

Proposed:

- **The game makes ids, never an LLM.** An id is made when the object is created and never changes, also when the name changes. Ids are never reused: removed objects are marked gone, not deleted, so old rounds keep pointing at something.
- **Readable ids**: a type prefix and a slug of the name, with a number when taken, `char:mara`, `char:mara-2`, `loc:old-mill`. LLMs copy random ids badly and mix up similar ones, readable ids carry meaning and cost few tokens.
- **Every prompt has a roster** of the objects it may refer to: id, name and a short description that tells look alikes apart, and is told to refer to them by id.
- **Mentions in text are markdown links**, `[Mara](char:mara-2) slams the door.` LLMs write these reliably. The game shows the name only, and can later show more on hover. A chunk's `speaker` is an id.
- **Ids in JSON replies are restricted by the schema.** llama.cpp turns the JSON schema into a grammar, so an `enum` of the existing ids makes an unknown id impossible to generate. Ids in mentions inside free text cannot be restricted that way, the game checks them and flags unknown ones.
- **New objects get temporary ids** from the scribes, `new:guard`, used by the other changes in the same batch. Applying the changes gives the real id (`char:guard`, `char:guard-2`) and rewrites every reference.
- **Characters see the names they know.** A relationship stores `known_as`, so a character who only knows Mara as "the hooded woman" gets that name in its prompt, with the same id. The storyteller and scribes see true names. When a name is revealed, the scribes update `known_as`.

### LLM replies

Proposed:

- The storyteller returns the story as a list of chunks, each with an optional speaker, so the game can split it for clicking through and show who is talking:
  ```
  [{ "text": "The door creaks open." }, { "speaker": "mara", "text": "You're late." }]
  ```
- The scribes return a list of changes as JSON in a fixed schema (llama.cpp can force replies into a JSON schema). The same list is what the cowriter review shows. The game checks every change against the state before applying it, a change that does not fit is rejected and shown, not guessed at.
- Thinking effort per role, characters low or none, storyteller medium, scribes low. The models think at maximum effort by default, which costs minutes per round.
- Randomness from code, not the LLM: the game rolls for uncertain actions and gives the storyteller the results.

## Storage

Decided:

- Games are kept in the browser's IndexedDB, they get too big for local storage once images are in them.
- Small per browser state, like the chunk the player is reading, is kept in local storage.
- The game saves continuously, a refresh or a closed tab loses nothing.
- Games can be saved to and loaded from a file.

Proposed:

- One IndexedDB database with these stores:
  - `games`: one record per game with the current world state and phase. Small, rewritten on every change.
  - `rounds`: one record per round, keyed by game and round number. Finished rounds are never rewritten, so saving does not get slower as the story grows.
  - `images`: image blobs, stored as blobs (not base64), referenced by id from locations and characters.
  - `calls`: every LLM call with its prompt, reply and time, for debugging. Can be cleared without harming the game.
  - `chats`: the game builder chats.
- Every change to the game goes through one function that also writes it to IndexedDB, so nothing can change without being saved. Text edits (storyteller text, change review) are written after a short pause in typing, and on `visibilitychange` to hidden.
- Prompt drafts are kept in local storage per game and character, local storage writes are synchronous and survive a tab closing mid typing.
- Resuming: the phase and which LLM calls are done are part of the state. Each reply is saved when it finishes. Calls that were running when the page closed are started again on load.
- The game asks the browser to keep its storage (`navigator.storage.persist()`), otherwise the browser may delete it when the disk runs low.
- A save file is one JSON file: a format version, the game, its rounds and its images as base64. The debug call log is optional. Loading a file creates a new game, it never overwrites one. The format version lets older files be upgraded on load.

Open: when the game is opened as a `file://` page, browsers tie its storage to that origin, and some may tie it to the file's path. Moving or renaming the html file could then make saved games disappear (they are still on disk, but not found). To be checked per browser. Save files are the backup either way.

## AI server

- OpenAI compatible chat completions, streamed, cancellable.
- Settings: server address, key, model per role.
- Switching models on the server takes 8-95 seconds, so a game should stick to one or two models.
- The server handles about two requests at once per loaded model, more characters queue.
- Decided: the client stays in the game for now. If it becomes a good general interface for AI servers, it may move to `@chocbite/ts-lib` later.

## Debugging

Proposed: a debug view listing every LLM call of a round (the `calls` store), with its full prompt, reply and time. Prompt tuning across three phases is not possible without it.

## Images

Later. Proposed: the storyteller or scribes give a short scene description, the game asks ComfyUI for an image when the location or mood changes, the old image stays until the new one is ready and then crossfades. Images are cached per location so places look the same when revisited. Without an image server the background is a placeholder.

## Prototype status

Built: game builder chat with proposals editable as JSON, the three phase round, the story read chunk by chunk, the character tab, cowriter mode with both reviews, ids and mentions, continuous saving in IndexedDB with resuming after a reload (calls that were running start again), save files, settings, debug log of every call. Placeholder scene colored per location.

Decided while building:

- Characters have an `appearance` (what strangers see, the name used until they learn the real one) besides `description` (tells characters apart, for the storyteller and scribes).
- The cast of a round is fixed when it starts: the player characters and the AI characters at their locations.
- The builder's opening is stored as the story of round 0.
- A failed call stops the round with the error shown and a retry button, nothing is retried by itself.

Not built yet: dice rolls, images, a story log of earlier rounds, editing the world outside the builder, opening the builder on a running game, a way to tune prompts without code.

## Open questions

- Can the player read back earlier rounds (a story log), and where in the UI?
