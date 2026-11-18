import { ok, type Option, type ResultOk } from "@chocbite/ts-lib/result";
import st, {
  type StateJsonCompatible,
  type StateROAW,
} from "@chocbite/ts-lib/state";

let name_transformer: ((name: string) => string) | undefined;

const packages = localStorage["settings/packageVersions"] as string | undefined;
let package_versions: { [key: string]: string } = {};
try {
  package_versions = packages
    ? (JSON.parse(packages) as { [key: string]: string })
    : {};
} catch (_e) {}
let store_package_versions_timeout: number | undefined;
const BOTTOM_GROUPS: { [key: string]: SettingsGroup } = {};

/**Stores of nested settings waiting for their delay, by storage key, stored right away when the page is hidden or closed*/
const pending_stores = new Map<string, () => void>();
const store_pending = () => {
  const stores = [...pending_stores.values()];
  pending_stores.clear();
  for (const store of stores) store();
};
window.addEventListener("pagehide", store_pending);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") store_pending();
});

/**Renames the settings groups of every package, the group name is the start of every stored key,
 * so an app can keep the library names, like @chocbite/ts-lib-theme, out of the local storage.
 *
 * Groups are made and read their stored values when their module is imported, so this must be called
 * in a module imported before any other module of @chocbite/ts-lib-ui
 * @param transform gets the package name of a group and returns the name to store it under*/
export const settings_set_name_transform = (
  transform: (name: string) => string,
) => {
  const existing = Object.keys(BOTTOM_GROUPS);
  if (existing.length)
    console.error(
      "settings_set_name_transform must be called before any settings group is made, call it in a module imported before any other module of @chocbite/ts-lib-ui, these groups already use their name: " +
        existing.join(", "),
    );
  name_transformer = transform;
};

/**Initialises the settings for the package
 * @param package_name use import {name} from ("../package.json")
 * @param package_version use import {version} from ("../package.json")
 * @param versionChanged function to call when the version of the package changed
 * @param name name of group formatted for user reading
 * @param description a description of what the setting group is about*/
export const settings_init = (
  package_name: string,
  package_version: string,
  name: string,
  description: string,
) => {
  if (name_transformer) package_name = name_transformer(package_name);
  if (package_name in BOTTOM_GROUPS)
    throw new Error(
      "Settings group already registered " +
        package_name +
        ", by another package or by this library being loaded twice",
    );
  let changed: string | undefined;
  if (package_versions[package_name] !== package_version) {
    changed = package_versions[package_name];
    package_versions[package_name] = package_version;
    if (store_package_versions_timeout)
      clearTimeout(store_package_versions_timeout);
    store_package_versions_timeout = window.setTimeout(() => {
      localStorage["settings/packageVersions"] =
        JSON.stringify(package_versions);
    }, 1000);
  }
  return (BOTTOM_GROUPS[package_name] = new SettingsGroup(
    package_name,
    name,
    description,
    changed ? changed : undefined,
  ));
};

/**Values JSON can store, Map, Set, Date, class instances, functions and undefined are not accepted*/
export type SettingsJson =
  | string
  | number
  | boolean
  | null
  | readonly SettingsJson[]
  | { readonly [key: string]: SettingsJson | undefined };

class Setting {
  readonly state: StateROAW<any>;
  readonly name: string;
  readonly description: string;
  constructor(state: StateROAW<any>, name: string, description: string) {
    this.state = state;
    this.name = name;
    this.description = description;
  }
}

/**Group of settings should never be instantiated manually use initSettings*/
export class SettingsGroup {
  private path_id: string;
  private settings: { [key: string]: Setting } = {};
  private sub_groups: { [key: string]: SettingsGroup } = {};
  /**Ids already migrated for the version change, a migration runs once per id*/
  #migrated = new Set<string>();
  readonly version_changed: string | undefined;
  readonly name: string;
  readonly description: string;

  constructor(
    path: string,
    name: string,
    description: string,
    version_changed?: string,
  ) {
    this.version_changed = version_changed;
    this.path_id = path;
    this.name = name;
    this.description = description;
  }

  /**Makes a settings subgroup for this group
   * @param id unique identifier for this subgroup in the parent group
   * @param name name of group formatted for user reading
   * @param description a description of what the setting group is about formatted for user reading*/
  make_sub_group(id: string, name: string, description: string) {
    if (id in this.sub_groups)
      throw new Error("Sub group already registered " + id);
    return (this.sub_groups[id] = new SettingsGroup(
      this.path_id + "/" + id,
      name,
      description,
      this.version_changed,
    ));
  }

  /**Gets value of setting or fallbacks to default
   * @param id unique identifier for this setting in the parent group
   * @param fallback value to use if no setting is stored
   * @param check function to check if the stored value is valid, if not the fallback will be used
   * @param version_changed function called when the version of the package changed to migrate old value to new formats */
  get<T>(
    id: string,
    fallback: T,
    check?: (parsed: unknown) => Option<T>,
    version_changed?: (existing: string, oldVersion: string) => T,
  ): ResultOk<T> {
    const saved = localStorage.getItem(this.path_id + "/" + id);
    if (saved === null) return ok(fallback);
    try {
      if (this.version_changed && version_changed && !this.#migrated.has(id)) {
        const changed_value = version_changed(saved, this.version_changed);
        this.#migrated.add(id);
        localStorage.setItem(
          this.path_id + "/" + id,
          JSON.stringify(changed_value),
        );
        return ok(changed_value);
      }
      if (check) return ok(check(JSON.parse(saved)).unwrap_or(fallback));
      return ok(JSON.parse(saved) as T);
    } catch (e) {
      return ok(fallback);
    }
  }

  /**Sets value of setting, that has not been registered to a state
   * @param id unique identifier for this setting in the parent group
   * @param value value to set, must be a value JSON can store*/
  set(id: string, value: SettingsJson) {
    if (id in this.settings)
      throw new Error("Settings is registered " + this.path_id + "/" + id);
    localStorage[this.path_id + "/" + id] = JSON.stringify(value);
  }

  /**Registers a state to a setting, the value is stored as JSON so its type must be JSON compatible
   * @param id unique identifier for this setting in the parent group
   * @param name name of setting formatted for user reading
   * @param description a description of what the setting is about formatted for user reading
   * @param state state object representing the setting's value */
  register<READ, S extends StateROAW<READ>>(
    id: string,
    name: string,
    description: string,
    state: S & (StateJsonCompatible<S> extends true ? unknown : never),
  ): S;
  /**Registers a state to a setting, with a transform to store values JSON can not represent
   * @param id unique identifier for this setting in the parent group
   * @param name name of setting formatted for user reading
   * @param description a description of what the setting is about formatted for user reading
   * @param state state object representing the setting's value
   * @param transform converts the state value to the stored string */
  register<READ, S extends StateROAW<READ>>(
    id: string,
    name: string,
    description: string,
    state: S,
    transform: (state: S) => PromiseLike<string>,
  ): S;
  register<READ, S extends StateROAW<READ>>(
    id: string,
    name: string,
    description: string,
    state: S,
    transform?: (state: S) => PromiseLike<string>,
  ): S {
    if (id in this.settings)
      throw new Error("Settings already registered " + this.path_id + "/" + id);
    this.settings[id] = new Setting(state, name, description);
    st.v.viewer(state, async () => {
      localStorage[this.path_id + "/" + id] = await (transform
        ? transform(state)
        : state.to_json());
    });
    return state;
  }

  /**Registers a state like register, but stores it a delay after the last change, for states changing often or storing much, like a page of widgets
   * The value is stored as JSON with the values of every state in it, see to_json of the state
   * Changes of the state and of any state in its value are followed at any depth, see the viewer of the state module,
   * and stored once a delay after the last change, so a burst of changes is stored once.
   * Waiting stores are stored right away when the page is hidden or closed.
   * Loading builds the states again from the JSON, give get a check that does it, as JSON alone does not tell which values were states
   * @param id unique identifier for this setting in the parent group
   * @param name name of setting formatted for user reading
   * @param description a description of what the setting is about formatted for user reading
   * @param state state holding the tree of states, its values must be JSON compatible
   * @param delay milliseconds after the last change before it is stored*/
  register_debounced<READ, S extends StateROAW<READ>>(
    id: string,
    name: string,
    description: string,
    state: S & (StateJsonCompatible<S> extends true ? unknown : never),
    delay: number = 500,
  ): S {
    if (id in this.settings)
      throw new Error("Settings already registered " + this.path_id + "/" + id);
    this.settings[id] = new Setting(state, name, description);
    const key = this.path_id + "/" + id;
    const store = () => {
      void state.to_json().then((json) => {
        localStorage[key] = json;
      });
    };
    let timeout: number | undefined;
    st.v.viewer(state, () => {
      clearTimeout(timeout);
      pending_stores.set(key, store);
      timeout = window.setTimeout(() => {
        pending_stores.delete(key);
        store();
      }, delay);
    });
    return state;
  }
}
