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

Decided: a round runs in phases, each with its own LLM calls.

0. **Level up**, only when a character has skill points to spend, see [Experience and levels](#experience-and-levels).
1. **Characters.** One LLM call per AI character, each with its own context: who it is, its personality, what it knows, the situation it is in. It answers what it wants to do and say. Characters do not know each other's actions or the player's, so the calls start right when the round starts and run while the player is reading and typing. The phase ends when every player character has submitted its action. If an AI character has not decided by then, the game waits for it.
2. **Skillcheck.** Decides which actions need a roll, the code rolls, see [Skillcheck](#skillcheck).
3. **Storyteller.** Gets all actions, the results of the rolls and the world state and decides what happens. Its text is the story shown to the player: what happens, what the characters say.
4. **Scribes.** Take what the storyteller decided and update the world: add characters, change locations, update bios, memories and relationships. The scribes only record what the storyteller decided, they do not invent. They are split in sub scribes, see [Sub scribes](#sub-scribes).

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

The world is a tree of things, see [World tree](#world-tree). Rounds are kept apart from it, see [State and storage model](#state-and-storage-model).

A character's memories hold only what it witnessed or was told, that is what keeps characters from knowing everything. The scribes write them.

## World tree

Decided, built.

The whole world is one tree, like a file system. Every node is a **thing** of one kind:

- **Location**: a place. Locations nest, a town holds a house, the house a room. Locations go only in locations, or at the top level.
- **Character**: goes in anything, a location, another character (a tiny one in a pocket) or an item (in a chest). Never at the top level.
- **Item**: goes in anything, items hold items (a bag in a chest). Never at the top level.

Nothing goes into itself or anything inside it. There can be several top level locations.

- Every thing has `parent` (empty at the top level) and `children`, the ids inside it in order. The order is kept and can be changed by hand. The game record holds the order of the top level, `roots`.
- Moving is one operation for everything: walking somewhere, picking something up, handing it over and hiding in a chest all change the parent (`move`).
- A removed thing leaves the tree: it is taken out of its parent, marked `gone` and kept, so its id is never reused and old story text still links to it. Only things with nothing inside can be removed.

### What characters perceive

- A character's **place** is the nearest location above it. The **scene** of a round is everyone in the same place, that decides the cast.
- A character is told the path to where it is ("in [Hale]'s coat pocket, in the Market Square, in Ashencross").
- It sees what is directly in its place: the characters, the items (the chest, not what is in it) and the locations inside it, which are the exits, along with the location around it.
- It knows everything inside itself, its own items, bags included.
- Things inside a character or an item are hidden from everyone except whoever holds them and whoever is inside with them. A character inside something sees what is in there with it.
- The storyteller and the scribes see the whole scene, everything inside the place, and the locations of the world.

### Editor

One world editor, a dialog with a sidebar (can be hidden) holding the tree in a `list`, and a form for the selected thing on the right.

- Each kind has an icon in the list, and the form has the editable fields of its kind, nothing internal (no ids, no engine details).
- Single selection, the selection state holds ids.
- The row context menu adds a location, character or item inside the row, and removes. New top level locations come from the list's add row.
- Things are moved only by dragging rows, anywhere the rules allow, also to another parent. A drag inside a parent is a `move` write to its children state, a drag to another parent only an insert into the target (the list's `no_remove`), the engine takes the thing out of its old parent itself. Either way it is one checked and saved `move` change.

## Attributes, skills and time

Decided and built. The principle: **the LLMs pick, the code does the numbers**. LLMs are bad at arithmetic and at randomness.

### Global

Everything that is global to a game is under a **Global** node, the first row of the world tree, with a globe icon. It can not be removed or moved.

- Its form holds the game settings: the time (day, hour, minute), and the experience settings (exp per small, medium and large award, exp to reach level 2, how much more each level needs, skill points per level).
- Under it are two groups, **Attributes** and **Skills**, holding the global definitions. A group's context menu adds a definition. Definitions are reordered by dragging inside their group, and removed only while nothing uses them.
- Every node of the tree, Global, groups and definitions included, is its own state, stored as its own record, like the things.

### Attributes

- Values with a type: number (with a unit, "cm", "kg", "coins"), text or yes/no.
- **Global attributes** are defined once per game: name, type, unit and the kinds of thing that can have them. So `height` means the same everywhere and a potion finds it.
- **Local attributes** are defined on one thing, for what only it has (a sword's inscription, a chest's lock).
- A thing stores only the values it has, a missing value is unknown.
- A thing's attributes, skills and abilities are each an array state of states, one per entry, so the form shows them as lists and a change touches only its entry.
- Changed with `set_attribute` and `add_to_attribute`, the attribute given as an enum in the schema. The LLM says +5, the code adds and rejects nonsense (adding to text, a negative height).
- Shown to LLMs with the unit, "Height: 185 cm".

### Skills

- A skill list per game, ids like `skill:climbing`. The builder makes it, the scribes can add skills.
- Characters have a level per skill, 0 to 100, a missing skill is 0. Items give -100 to 100 to skills.
- Only items **directly** inside a character count, what it holds or wears. A sword in a bag does not help, drawing it moves it to the character.

### Abilities

Not global, they belong to one character: a name and a description of something special it can do ("reads old maps at a glance"). Ids are local to the character, `ability:<slug>`.

### Skillcheck

A step between the characters and the storyteller.

1. An LLM gets the actions and the characters' skills, and returns per action: the character, the relevant skills (enum) and a difficulty word (trivial, easy, normal, hard, extreme), or no check for actions without risk.
2. The code sums per skill the character's level and its items, takes the best skill, applies the difficulty as a fixed amount and rolls d100.
3. The storyteller gets the results with the margin ("failed, barely") and writes the story around them.

Cowriter mode shows the rolls and they can be changed before the storyteller runs.

The numbers: the total of a skill is the character's level plus the bonuses of its items and the active effects on it. The best chosen skill counts. The chance is the total plus 30, plus the difficulty (trivial +40, easy +20, normal 0, hard -20, extreme -40), kept between 5 and 95. A d100 at or under the chance succeeds. The margin (chance minus roll) says how: 30 or more easily, 10 or less barely. So an untrained character succeeds a normal check 30% of the time, a skilled one (50) 80%.

### Experience and levels

- The scribes award experience per character in words (none, small, medium, large) with a reason, the code turns the word into a number. No cap per round.
- The code levels characters up on a threshold curve, each level gives skill points.
- A **level up phase** at the start of the next round, only when someone has points: the player spends them in a window and says when done (points may be kept), AI characters are asked in character which skills they raise. The code checks the total and the 100 limit (`spend_skill_points`).

### Time

- Time is a number, minutes since the start of day 1, kept in the Global settings. The builder sets the start with `set_time` (day, hour, minute), `pass_time` (an amount and a unit) moves it on. Shown as "Day 3, 14:20".
- **Effects** are changes with an end time: height +5 cm for an hour, climbing +20 until dawn (`add_effect` with an amount, a duration and a reason). They are stored on the thing, on number attributes and skills, a value is the base value plus the active effects, and the code drops effects whose time has passed when time moves on. Nothing has to be undone. LLMs see "Height: 185 cm (180, +5 from potion for 40 min)".

### Sub scribes

One scribe for everything is too hard for one LLM, the work is split, in this order:

1. **scribe_time**: only how much time passed, an amount and a unit. The code adds it.
2. **scribe_world**: creates new characters, items and locations, and changes things outside characters (a broken door, a burned house). Runs before the character scribes so they can use the new ids.
3. **scribe_character**, one per character in the scene, run together: its memories, experience, relationships, its own fields, where it went, what it picked up, dropped or handed over. When two take the same item, the changes apply in order and the second shows as a problem in the review.

Each scribe gets its own schema with only the changes it may make, the character scribes with ids limited to their character and what it carries or sees. Results of finished scribes are kept in the round, so a reload only runs the ones that were not done. The cowriter review groups the changes by scribe.

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

- The stores and how state is kept in memory are in [State and storage model](#state-and-storage-model).
- Every change to the game goes through the engine, which also writes it to IndexedDB, so nothing can change without being saved. Text edits (storyteller text, change review) are written after a short pause in typing, and on `visibilitychange` to hidden.
- Prompt drafts are kept in local storage per game and character, local storage writes are synchronous and survive a tab closing mid typing.
- Resuming: the phase and which LLM calls are done are part of the state. Each reply is saved when it finishes. Calls that were running when the page closed are started again on load.
- The game asks the browser to keep its storage (`navigator.storage.persist()`), otherwise the browser may delete it when the disk runs low.
- A save file is one JSON file: a format version, the game, its rounds and its images as base64. The debug call log is optional. Loading a file creates a new game, it never overwrites one. The format version lets older files be upgraded on load.

Open: when the game is opened as a `file://` page, browsers tie its storage to that origin, and some may tie it to the file's path. Moving or renaming the html file could then make saved games disappear (they are still on disk, but not found). To be checked per browser. Save files are the backup either way.

## State and storage model

Decided and built, replaced the prototype's model.

### What is wrong with the prototype

The prototype keeps the whole game as one immutable value in one state. Every change copies the whole world (`structuredClone`), rewrites the whole game record in IndexedDB, and gives every subscriber a new game without saying what changed, so views redraw everything. All of it grows with the size of the world instead of the size of the change, and memories, which only grow, live inside the characters. It also does not use the library's state model, which has array and object states that carry what changed for exactly this.

### Rule

The cost of a change is the size of the change: only the changed things are copied, saved and redrawn.

### In memory

Everything the UI shows is a library state owned by the engine. The UI gets read only views (`owner.read_only`), only the engine writes.

- **One state per thing.** Every location, character and item is its own state, holding a plain object. Changing a thing sets that thing's state, only its subscribers hear about it.
- **The tree is array states of those states** (`Tree` in `src/lib/tree`): every thing has a children state, an array state of the states of what is inside it, and one roots state holds the top level. These map directly to a `list`, the roots state is the rows and a row's children state its sub rows. A change to the children is written with the array helpers (`splice`, `move`), so a list only adds, removes or moves those rows. Changing a thing sets its state and marks its index as changed in its parent's children state (`array.change` with the same state), so a list refreshes only that row.
- **Identity is stable.** A thing's state is made once when the game loads or the thing is added, and stays the same object for the rest of the session (a read only view is also always the same object).
- **The engine keeps an index by id**, a `Map<Id, owner>`, for resolving ids in changes and prompts.
- **Memories are an array state per character**, apart from the character, added to with `push`. Prompts take the last ones.
- **Rounds**: the current round is one state, the finished rounds an array state that is only pushed to. A finished round never changes, so its value is a plain object.
- **Game details** (name, time, round number) are one small state.
- **Prompts** read the states when they are built. That costs the size of what goes into the prompt, which is spent anyway.

### Applying changes

A change list (from the scribes, the builder or an editor) is still all or nothing, without copying the world:

1. **Check.** The changes are run against an overlay: a map of the objects the changes touch, each copied when first touched, on top of the current states. Later changes in the list see earlier ones, and new ids are given out here. Nothing outside the overlay is copied.
2. **Save.** If every change fits, the touched objects (and new memories) are written to IndexedDB in one transaction.
3. **Apply.** After the save succeeded, each touched object's state is set to its new value, added objects get new states pushed to their collection, and new memories are pushed. A failed save changes nothing, and the error is shown.

The cowriter review uses step 1 alone, to show which changes will be skipped and why.

### IndexedDB stores

Every record holds one thing, so a save writes only what changed:

- `games`: game details, keyed by game id. Small.
- `things`: one record per location, character or item, keyed by `[game, id]`. Characters without their memories. A move writes the thing and both parents in one transaction.
- `memories`: one record per memory, keyed by `[game, character, n]`, only ever added.
- `rounds`: one record per round, keyed by `[game, n]`. The current one is rewritten while it runs, finished ones never.
- `calls`: every LLM call, keyed by `[game, round, id]`, for debugging. Can be cleared without harming the game.
- `builds`: game builder sessions.
- `images` later: blobs, referenced by id.

Loading a game reads its records once and makes the states. Save files stay one JSON file, built from the records.

### Depends on the library

Nothing open.

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

Not built yet: images, a story log of earlier rounds, editing characters outside the builder, opening the builder on a running game, a way to tune prompts without code.

Known problems: none.

## Open questions

- Can the player read back earlier rounds (a story log), and where in the UI?
