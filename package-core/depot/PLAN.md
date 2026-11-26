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
- The content of an entry is a state, as content can change. `add` takes a `StateOrVal`, a value that is not a state is wrapped in a read only state and never changes, see `state.as_state`.
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

## Providers

Some resources already live in a structure of their own, like the theme variables, or a tree of objects users create on a server, kept on the client as states. Registering them would store everything twice, and for big or recursive structures it would make a node for every item up front. A provider lets such a structure be mounted in the depot instead.

### Decisions

- The structure implements an interface, `DepotSource`, on its own objects, nothing is copied.
- `group.provide(id, source)` mounts a source at a path, like `group` and `add`, so the app or module still decides where it goes. It gives the node of the source, removing it unmounts the source.
- Nodes for provided items are made only for paths that are looked up or listed, and kept per parent for the source object, so the same path gives the same node while the source object lives. The path comes from the walk, so a source object does not know its parent and can be at several paths, like in a recursive structure.
- Name, description, the children of a group and the content of an entry are each a `StateOrVal`, a constant or a state. Constants cost no state, a state is followed. A source gives states only for what changes, like the name of an object users can rename.
- Registered nodes get the same: name and description are `StateOrValROS<string>` as given to `group` and `add`, and the content of an entry is the `StateOrVal` given to `add`, no longer always wrapped in a state. Readers pass them to elements, which take `StateOrVal`, or use `state.as_state`.
- A provided group is read only in the depot, `group`, `add`, `alias` and `provide` on it throw, its source decides its children. Removing a provided node other than the mounted one throws, the source removes it.
- A lookup through a provided group whose children are a state follows that state, constant children are not followed.
- A child id that is not a valid depot id is left out, it can not be looked up or listed.
- Aliases point at registered nodes only for now.
- Ids from a source should be stable ids, like the id of an object on a server, not its name, so renaming changes the name and not the path, and stored paths keep working.

### Source interface

```ts
interface DepotSourceBase {
  readonly name: StateOrValROS<string>;
  readonly description: StateOrValROS<string>;
  readonly icon?: DepotIcon;
}
interface DepotSourceGroup<T> extends DepotSourceBase {
  /**The children, a constant list or a state of one for a group that changes*/
  readonly children: StateOrValROS<readonly DepotSourceChild<T>[]>;
  /**Optional fast lookup of one child by id, otherwise the children are searched*/
  child?(id: string): DepotSource<T> | undefined;
}
interface DepotSourceEntry<T> extends DepotSourceBase {
  readonly value: StateOrVal<T>;
}
type DepotSource<T> = DepotSourceGroup<T> | DepotSourceEntry<T>;
type DepotSourceChild<T> = {
  readonly id: string;
  readonly source: DepotSource<T>;
};
```

### Open for later steps

- The depot_ui selector walks the whole tree to filter and search, which would make every node of a big provided tree, and never ends on a recursive one. It must list only open groups, and search within what is loaded or through the source.
- Aliases into provided trees.

### Provider steps

1. Core: `DepotSource`, `provide`, `StateOrVal` names, descriptions, children and content, lookups through sources. Readers in ts-lib-ui and the dev page updated. Tests in Node with a test source, also a recursive one.
2. Theme: `package-ui/theme` registers a theme color type and provides its own variable structure through it.
3. Theme: custom theme color variables added and removed at runtime.
4. Canvas: color properties pick a theme color variable, with a None option for no color, there are no plain colors. A color is only a plain value through a linked state.

Each step ends with typecheck, tests and lint passing, and a stop for review.
