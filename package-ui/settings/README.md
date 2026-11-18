# @chocbite/ts-lib-ui/settings

Settings of the user stored in the local storage of the browser, each a state that is saved whenever it changes, in groups per package.

```ts
import { settings_init } from "@chocbite/ts-lib-ui/settings";
import { none, some } from "@chocbite/ts-lib/result";
import { state } from "@chocbite/ts-lib/state";
import { version } from "../package.json";

const SETTINGS = settings_init("my-app", version, "My App", "Settings of My App");

const VOLUME = SETTINGS.register(
  "volume",
  "Volume",
  "Sound volume in percent",
  state.rosw(
    SETTINGS.get("volume", 50, (stored) => (typeof stored === "number" ? some(stored) : none())),
    true,
  ),
);
```

## Groups

- **`settings_init(package_name, version, name, description)`** makes the group of a package, once per package. `name` and `description` are for the user. The package name is the start of every stored key, so groups of different packages never mix. The groups of ts-lib-ui are named `@chocbite/ts-lib-xxx`.
- **`group.make_sub_group(id, name, description)`** makes a group inside a group.
- **`settings_set_name_transform(transform)`** renames the groups of every package, like to keep the library names out of the local storage. Groups are made when their module is imported, so call it in a module imported before any module of ts-lib-ui.

## Settings

- **`group.get(id, fallback, check?, migrate?)`** reads a stored value as an ok result, the fallback when nothing is stored. Stored values come from earlier versions and from the user, so give `check` to accept only valid ones, an invalid one gives the fallback.
- **`group.register(id, name, description, state)`** stores the value of a writable state every time it changes, and returns the state. The value is stored as JSON, so the type of the state must be one JSON can hold, TypeScript refuses others. Give a fifth argument, a function turning the state into the stored string, for values JSON can not hold.
- **`group.set(id, value)`** stores a value without a state, for a setting that is not registered.

Read the stored value with `get` and give it as the start of the state you register, like above.

## New versions

`settings_init` takes the version of the package. When it differs from the version the settings were stored with, `group.version_changed` is the old version, and the `migrate` function of `get` is called once per setting with the stored JSON and the old version. It returns the value in the new format, which is stored right away.
