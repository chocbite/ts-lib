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
- Names and descriptions are for showing to users, a string or a state of one (`StateOrValROS<string>`), a state for a name that changes. Elements take either, so pass them on as they are.
- `type`, `group` and `add` take an optional icon as the last argument. Icons are typed by `@chocbite/ts-lib-ui` as `SVGFunc`, without it no icon can be given. An alias shows the icon of its target.

## Content

`add` takes a value or a state, see `StateOrVal` in `@chocbite/ts-lib/state`. `entry.value` is what was given, a value costs no state and never changes, use a state for content that changes. Use `state.as_state(entry.value)` where a state is needed.

For types of objects, like the widget definitions of canvas, the entry keeps the type of the content given to `add`, so code using the entry knows the specific content, like the options of one widget. For other types the entry has the content type of the type, so `add("speed", "Speed", "", 5)` on a number type gives a `DepotEntry<number>`.

## Removing

`remove()` removes a node, removing a group or type also removes everything below it. A removed node keeps its path, its `removed` is true and it can not get children. Removing frees the id for registering again.

## Following changes

`group.children` of a registered group and `depot.types` are states of arrays in registration order. Their array metadata tells subscribers what was added or removed, see the array helpers in `@chocbite/ts-lib/state`. The children of a provided group are what its source gives, a constant array or a state, see Providers.

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

The depot registers the `states` type itself, `depot.states`, for values of the app that users can pick, like measurements and settings. The content of an entry is the registered state itself, `entry.value` is the state given to `add`, or the value given for one that never changes. The states type can not be removed.

```typescript
const machine = depot.states.group(
  "machine",
  "Machine",
  "Values from the machine",
);
machine.add("speed", "Speed", "Current speed in rpm", speed_state);
```

## Providers

A structure that already holds its resources, like the theme variables or objects users create on a server, is mounted instead of registered, so nothing is stored twice. It implements `DepotSource` on its own objects, and `group.provide(id, source)` mounts it:

```typescript
import depot, { type DepotSourceGroup } from "@chocbite/ts-lib/depot";

const objects: DepotSourceGroup<number> = {
  name: "Objects",
  description: "Created by users",
  //A constant array, or a state of one for a group that changes
  children: state_of_children,
  //Optional, finds one child without going through all of them
  child: (id) => by_id.get(id),
};
const mount = machine.provide("objects", objects);
```

- A source is a group, with `children` and optionally `child(id)`, or an entry, with `value`. Name, description, children and value are each a constant or a state, constants cost no state, states are followed.
- Nodes are made only for paths that are looked up or listed, so a big or recursive structure costs nothing until used. The same path gives the same node while its source object is the same.
- The path comes from the lookup, so a source object does not know its path and can be at several paths, like in a recursive structure.
- A provided group is read only in the depot, the source decides its children, `group`, `add`, `alias` and `provide` on it throw, and so does `remove` on a node below the mount. `mount.remove()` unmounts the source.
- A child whose id is not a valid depot id is left out.
- Give stable ids, like the id of an object on a server, not its name, so a rename changes the name and stored paths keep working.
- Aliases can not point at provided nodes.
