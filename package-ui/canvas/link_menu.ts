import depot_ui from "#depot_ui";
import form, { type FormElement } from "#form";
import { prompts } from "#prompts";
import state from "@chocbite/ts-lib/state";
import {
  CanvasLink,
  link_value,
  type LinearTransform,
  type LinkTransform,
  type OptionState,
} from "./link";
import { property_value, type WidgetProperty } from "./properties";

/**How the link menu edits a kind of transform, add one for every kind of transform*/
interface TransformEditor<T extends LinkTransform> {
  /**Form elements for the transform, with ids starting with the kind, current is the transform of the link now*/
  fields(current: T | undefined): FormElement[];
  /**The transform from the values of the fields, undefined when it is turned off or the values are not complete*/
  from_values(values: Readonly<Record<string, unknown>>): T | undefined;
}

const EDITORS: {
  readonly [K in LinkTransform["kind"]]: TransformEditor<
    Extract<LinkTransform, { kind: K }>
  >;
} = {
  linear: {
    fields: (current) => [
      form.text({ text: "Linear transform, from the range of the state" }),
      form.switch({ id: "linear", value: current !== undefined }),
      form.number_input({
        id: "linear_from_start",
        value: current?.from[0] ?? 0,
      }),
      form.number_input({
        id: "linear_from_end",
        value: current?.from[1] ?? 1,
      }),
      form.text({ text: "To the range of the option" }),
      form.number_input({ id: "linear_to_start", value: current?.to[0] ?? 0 }),
      form.number_input({ id: "linear_to_end", value: current?.to[1] ?? 1 }),
    ],
    from_values: (values): LinearTransform | undefined => {
      if (values.linear !== true) return undefined;
      const a = values.linear_from_start;
      const b = values.linear_from_end;
      const c = values.linear_to_start;
      const d = values.linear_to_end;
      if (
        typeof a !== "number" ||
        typeof b !== "number" ||
        typeof c !== "number" ||
        typeof d !== "number"
      )
        return undefined;
      return { kind: "linear", from: [a, b], to: [c, d] };
    },
  },
};

const editor_of = (kind: string) =>
  (EDITORS as Record<string, TransformEditor<LinkTransform> | undefined>)[kind];

/**Opens the link menu of an option, to link it to a state of the depot, change the transforms of the link, or unlink it
 * Writes the option state when the user links or unlinks, unlinking keeps the value the link gives now*/
export async function open_link_menu(
  option: OptionState<unknown>,
  property: WidgetProperty,
): Promise<void> {
  const current = await option;
  const link =
    current.ok && current.value instanceof CanvasLink
      ? current.value
      : undefined;
  const path = state.ok_w(link?.path ?? "");
  const fields: FormElement[] = [];
  for (const kind of Object.keys(EDITORS))
    fields.push(
      ...editor_of(kind)!.fields(
        link?.transforms.find((transform) => transform.kind === kind),
      ),
    );
  const UNLINK = { unlink: true };
  const answer = await prompts.form(
    `Link ${property.name}`,
    [
      form.text({ text: "State" }),
      form.text_input({ id: "path", value: path }),
      form.button({
        text: "Choose state",
        on_click: async () => {
          const [entry] = await depot_ui.select_state({
            title: `State for ${property.name}`,
          });
          if (entry) path.set_ok(entry.path);
        },
      }),
      ...fields,
    ],
    [
      ...(link
        ? [
            {
              text: "Unlink",
              click: (_: unknown, close: (submit: never) => void) =>
                close(UNLINK as never),
            },
          ]
        : []),
      {
        text: "Link",
        //An empty path links nothing, the menu stays open
        click: () => path.ok().trim() === "",
      },
    ],
  );
  if (!answer.some) return;
  const values = answer.value.value_partial;
  if (!values.ok) return;
  const given = values.value as Record<string, unknown>;
  const convert = (value: unknown) => property_value(property.kind, value);
  if (given.unlink === true) {
    //Keeps what the widget shows, the default when the link gives nothing
    const value = link ? await link_value(link, convert) : undefined;
    void option.write?.(value?.ok ? value.value : property.default);
    return;
  }
  const transforms: LinkTransform[] = [];
  for (const kind of Object.keys(EDITORS)) {
    const transform = editor_of(kind)!.from_values(given);
    if (transform) transforms.push(transform);
  }
  //Transforms of kinds without an editor, like ones saved by a newer version, are kept
  for (const transform of link?.transforms ?? [])
    if (!editor_of(transform.kind)) transforms.push(transform);
  void option.write?.(new CanvasLink(path.ok().trim(), { transforms }));
}
