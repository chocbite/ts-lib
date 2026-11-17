# @chocbite/ts-lib/depot

A registry where parts of an app register resources under a path, like `/widgets/basic/rectangle`, so they can be listed and picked by users.

## Registering

Registration is one call per level. A type is the root segment of a path and fixes the content type of every entry below it.

```typescript
import depot from "@chocbite/ts-lib/depot";

const widgets = depot.type<WidgetDefinition>(
  "widgets",
  "Widgets",
  "Elements placed on pages",
);
const basic = widgets.group("basic", "Basic", "Basic shapes");
const rectangle = basic.add(
  "rectangle",
  "Rectangle",
  "A filled rectangle",
  definition,
);

rectangle.path; // "/widgets/basic/rectangle"
```

Functions that register a set of resources should take a group instead of a path, so the app decides where the resources go.

- Ids contain only letters, digits, `_` and `-`, anything else throws.
- Registering an id that exists in the group throws, remove the old node first.
- Names and descriptions are plain strings for showing to users.
- `type`, `group` and `add` take an optional icon as the last argument. Icons are typed by `@chocbite/ts-lib-ui` as `SVGFunc`, without it no icon can be given. An alias shows the icon of its target.

## Content

`add` takes a fixed value or a state, see `StateOrVal` in `@chocbite/ts-lib/state`. `entry.value` is always a state: the given state, or a state of the fixed value. Use a state for content that changes.

## Removing

`remove()` removes a node, removing a group or type also removes everything below it. A removed node keeps its path, its `removed` is true and it can not get children. Removing frees the id for registering again.

## Following changes

`group.children` and `depot.types` are states of arrays in registration order. Their array metadata tells subscribers what was added or removed, see the array helpers in `@chocbite/ts-lib/state`.

## Looking up

Lookups only give states, never a node directly, so code holding a path follows the resource being registered, removed or registered again.

```typescript
const rect = depot.get("/widgets/basic/rectangle"); // StateRES of the node
const typed = widgets.get("/basic/rectangle"); // typed by the type, path inside the type
```

The state is an error while nothing is registered at the path, so a path can be held before its resource is registered. An invalid path gives an error state. The same path gives the same state.

The errors are `NiceError`s with these kinds, in `depot.errors`: `NOT_REGISTERED` ("Data not available") while nothing is registered at the path, `TYPE_REMOVED` ("Data type removed") once the type of the path is removed, and `INVALID_PATH` ("Invalid data path") for a path that isn't valid. `NOT_REGISTERED` is normal use and has only a message. The other two aren't supposed to happen and have an `Error` as `cause`, for `INVALID_PATH` its stack shows the code that gave the path.

## Aliases

When a resource moves, an alias keeps the old path working:

```typescript
basic.alias("rect", rectangle); // "/widgets/basic/rect" gives rectangle
```

- An alias points at a group or entry in the same type, an alias of a group also resolves paths below it.
- Aliases are not listed in `children`, they share the id space of their group.
- Once the target is removed, the alias path gives an error. Removing the alias frees its id.

## States

The depot registers the `states` type itself, `depot.states`, for values of the app that users can pick, like measurements and settings. The content of an entry is the registered state itself, `entry.value` is the state given to `add`. The states type can not be removed.

```typescript
const machine = depot.states.group(
  "machine",
  "Machine",
  "Values from the machine",
);
machine.add("speed", "Speed", "Current speed in rpm", speed_state);
```
