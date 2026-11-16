# Depot plan

Working plan for `@chocbite/ts-lib/depot` and `@chocbite/ts-lib-ui/depot_ui`. Not published, delete or replace with the README once built.

## Purpose

A registry where parts of an app register resources under a path, like `/widgets/basic/rectangle` or `/states/machine/speed`, so they can be listed, picked in selectors and found again by path.

The depot only registers and looks up. What users of the depot do with paths, like saving them in files, is out of scope.

The library registers no resources itself, only the base types. Sets of resources are registered by functions the app calls, like a future `canvas_widgets.register_basic(group)`, so the app decides where they go.

## Concepts

| Concept | What it is                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------- |
| Type    | The root segment of a path, like `states` or `widgets`. Fixes the content type of every entry below it. |
| Group   | A level in the tree, like `basic` in `/widgets/basic/rectangle`. Holds groups, entries and aliases.     |
| Entry   | A leaf, holds a resource.                                                                               |
| Alias   | A second path to an entry, for resources that moved. Not listed among the children.                     |
| Path    | `/` and the ids from the type down, like `/widgets/basic/rectangle`.                                    |

Every type, group and entry has an id, a name and a description, the name and description are for showing to users, as in `settings`.

## Decisions

- Registration works like `settings`, one call per level: `depot.type`, `group.group`, `group.add`. Registering code gets a group, never a path, so it can be registered anywhere.
- The depot uses `state` for everything that changes, the content of an entry and the children of a group. `state` is a special core part, so the depot imports it and registers the states type itself, `state` does not import the depot.
- The content of an entry is a state, as content can change. `add` takes a `StateOrVal`, a fixed value never changes, see `state.as_state`.
- Registering an id that exists in the group throws. Removing first is explicit.
- Removing a group removes everything below it.
- Registration also happens at runtime, like a feature adding states when activated and removing them when deactivated.
- Moving is done with aliases, a lookup of the old path finds the entry.
- UI data like icons is added through a global `ChocbiteDepotRegister` interface that ts-lib-ui augments, like enum icons in `state`.
- Names and descriptions are plain strings, translation is out of scope.
- Each node stores only its own id and its parent, the full path is built by walking up the parents.
- There is no lookup from content to entry. Whatever picks a resource, like a selector, gets the entry and keeps it, so the same content can be registered more than once.
- Types have no version, versions only matter for files, which are out of scope.
- Lookups only return states, there is no way to get a node outside of a state, so users can not hold on to a node that is later removed or replaced. `depot.get(path)` gives a state of the node.
- `get` takes full paths only, relative paths can be added later if selectors need them.

## Core API sketch

Names are proposals.

```ts
import depot from "@chocbite/ts-lib/depot";

//A type, the generic is the content type of its entries, throws if the id exists
const widgets = depot.type<WidgetDefinition>(
  "widgets",
  "Widgets",
  "Elements placed on pages",
);

//Groups and entries, one call per level, both throw if the id exists in the group
const basic = widgets.group("basic", "Basic", "Basic shapes");
const rectangle = basic.add(
  "rectangle",
  "Rectangle",
  "A filled rectangle",
  definition,
);

rectangle.path; //"/widgets/basic/rectangle", built by walking up the parents
rectangle.value; //State of the content, follows the state given to add
rectangle.remove(); //Removes the entry, a group removes everything below it

//Children of a group as a state, so selectors follow runtime changes
basic.children; //StateROS<readonly DepotNode[]>, array helper metadata gives what was added or removed

//Aliases, the old path finds the entry
basic.alias("rect", rectangle);

//Types
depot.types; //StateROS<readonly DepotType[]>, like children

//Lookup
depot.get("/widgets/basic/rectangle"); //StateRES of the node, err until registered and after removed
widgets.get("/basic/rectangle"); //Typed lookup inside a type, also a state
```

The states type is registered by the depot:

```ts
import depot from "@chocbite/ts-lib/depot";

const machine = depot.states.group(
  "machine",
  "Machine",
  "Values from the machine",
);
const speed = machine.add(
  "speed",
  "Speed",
  "Current speed in rpm",
  speed_state,
);
//For the states type the content is the registered state itself, speed.value is speed_state
```

`get` is the base for references: a user can hold the state of a path before the resource is registered, and gets an error state while it is missing.

## Rules

- Ids are not empty and contain no `/`. Proposed: letters, digits, `_` and `-`.
- A removed node can not get children, `add` and `group` on it throw.
- An alias points at a node, not a path. When the target is removed the alias resolves to an error, like a missing path.
- An alias id shares the id space of its group, it throws like any other duplicate.

## depot_ui

`@chocbite/ts-lib-ui/depot_ui`:

- `ChocbiteDepotRegister` is augmented with `icon: SVGFunc` in `svg`, next to `ChocbiteStateRegister`, so modules registering icons do not need depot_ui.
- `depot_ui.select(from, options)` opens a selector and returns a promise of the selected entries, built on the list module. Options: single or multi mode, a filter from the caller (only matching entries can be picked), preselected entries, title. Search by text in the selector.
- `DepotTree` is the filtered view following the depot, for building other selectors.
- `depot_ui.select_state(options)` selects states with a live value column. Options: `from` (a group of the states type), `writable`, `kind` (number, string, boolean, enum, from the state helper or the current value), plus the options of `select`.
- Selectors for other types are added by the modules registering them.

Types defined in ts-lib-ui are registered by their own module: the widgets type by `canvas`, the colors type by `theme`.

## Steps

1. Core: types, groups, entries, `remove`, children state, id rules, throws. Tests in Node.
2. Core: `get` and aliases.
3. Core: the states type.
4. Dev page for the core part, showing a tree that changes at runtime.
5. depot_ui: icon augmentation and selector utils.
6. depot_ui: state selector, with a dev page.

Each step ends with typecheck, tests and lint passing, and a stop for review.
