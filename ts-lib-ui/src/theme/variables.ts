import { theme_engine } from "./engine";
import { Themes } from "./settings";
import { BOTTOM_GROUPS } from "./shared";

let name_transformer: ((name: string) => string) | undefined;
export const theme_set_name_transform = (
  transform: (name: string) => string
) => {
  name_transformer = transform;
};

/**Initialises the settings for the package
 * @param package_name use import {name} from "../package.json"
 * @param name name of group formatted for user reading
 * @param description a description of what the setting group is about*/
export const theme_init_variable_root = (
  package_name: string,
  name: string,
  description: string
) => {
  if (package_name.includes("-"))
    throw new Error("Dash not permitted in package name " + package_name);
  if (name_transformer) package_name = name_transformer(package_name);
  BOTTOM_GROUPS[package_name] = new ThemeVariableGroup(
    package_name,
    name,
    description
  );
  return BOTTOM_GROUPS[package_name];
};

/**Group of settings should never be instantiated manually use initSettings*/
export class ThemeVariableGroup {
  private path_id: string;
  private variables: {
    [key: string]: {
      name: string;
      desc: string;
      vars: { [key: string]: string };
      type: keyof VariableType;
      typeParams: VariableType[keyof VariableType];
      example?: () => Element;
    };
  } = {};
  private sub_groups: { [key: string]: ThemeVariableGroup } = {};
  readonly name: string;
  readonly description: string;

  constructor(path: string, name: string, description: string) {
    this.path_id = path;
    this.name = name;
    this.description = description;
  }

  /**Makes a variable subgroup for this group
   * @param id unique identifier for this subgroup in the parent group
   * @param name name of group formatted for user reading
   * @param description a description of what the setting group is about formatted for user reading*/
  make_sub_group(id: string, name: string, description: string) {
    if (id.includes("-"))
      throw new Error("Dash not permitted in variable id " + id);
    if (id in this.sub_groups)
      throw new Error("Sub group already registered " + id);
    return (this.sub_groups[id] = new ThemeVariableGroup(
      this.path_id + "-" + id,
      name,
      description
    ));
  }

  /**Makes a variable
   * @param id unique identifier for this variable in the group
   * @param name name of variable formatted for user reading
   * @param description a description of what the variable is about formatted for user reading
   * @param light value for light mode
   * @param dark value for dark mode
   * @param type type of variable for editing
   * @param type_params */
  make_variable<K extends keyof VariableType>(
    id: string,
    name: string,
    description: string,
    light: string,
    dark: string,
    type: K,
    type_params: VariableType[K],
    example?: () => Element
  ): string {
    if (id.includes("-"))
      throw new Error("Dash not permitted in variable id " + id);
    const key = "--" + this.path_id + "-" + id;
    if (key in this.variables)
      throw new Error("Settings already registered " + id);
    const variable = (this.variables[key] = {
      name,
      desc: description,
      vars: { [Themes.Light]: light, [Themes.Dark]: dark },
      type,
      typeParams: type_params,
      example,
    });
    theme_engine.apply_single_property(key, variable.vars);
    return key;
  }

  /**Applies the groups
   * @param style unique identifier for this variable in the group
   * @param theme name of variable formatted for user reading*/
  apply_themes(style: CSSStyleDeclaration, theme: string) {
    for (const key in this.variables)
      style.setProperty(key, this.variables[key].vars[theme]);
    for (const key in this.sub_groups)
      this.sub_groups[key].apply_themes(style, theme);
  }
}

/**Defines the parameters for a variable type */
interface VariableType {
  /**Font variable,  */
  Font: undefined;
  /**Text variable,  */
  String: undefined;
  /**Color variable */
  Color: undefined;
  /**Transition type */
  TransitionType: undefined;
  /**Percent type */
  Percent: undefined;
  /**Filter type */
  Filter: undefined;
  /**Radius type */
  Radius: undefined;
  /**Time variable */
  Time: {
    /**Minimum time in milliseconds */
    min: number;
    /**Maximum time in milliseconds */
    max: number;
  };
  /**Angle variable */
  Angle: { min: number; max: number };
  /**Length variable*/
  Length: { min: number; max: number };
  /**Number variable*/
  Number: { min: number; max: number };
  /**Ratio*/
  Ratio:
    | {
        width: { min: number; max: number };
        height: { min: number; max: number };
      }
    | number;
}
