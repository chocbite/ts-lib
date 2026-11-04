import type { Parsed } from "./parse";
import { make_parser } from "./parse";

const yo = make_parser(["{}", "b"]);

console.warn(yo({ test: 42 }));

const internal_parser = make_parser(
  {
    bln: "b",
    num: ["?", "n", () => 42],
  },
  () => ({
    bln: false,
  }),
);

class ParsedClass {
  constructor(
    public bln: boolean,
    public num: number,
  ) {}
}

const class_parser = (data: unknown) => {
  const parsed = internal_parser(data);
  if (!parsed.ok) return parsed;
  return new ParsedClass(parsed.value.bln, parsed.value.num);
};

const part_parser = make_parser([
  0,
  {
    bln: "nb",
    num: "ns",
  },
]);

// @ts-expect-error Type characters must be unique and in n, s, b, l order.
make_parser({ invalid: "sssssiows" });

const parser = make_parser({
  fom: "b",
  foo: ["?", "n"],
  bar: "sb",
  bak: "l",
  part: part_parser,
  class: class_parser,
  baz: {
    bln: "nb",
    str: "s",
    num: "ns",
  },
  field_c: ["nb", "s"],
  field_d: [3, "s"],
  field_e: [5, ["s", "b"]],
  field_f: [5, { a: "n", b: "s" }],
  field_g: ["?", [5, [4, "s"]]],
  omni: ["?nbl", [5, [4, "s"]], { a: "n", b: "s" }],
});

const parsed = parser({ foo: 42, bar: "hello", baz: true });

type AutoSchema = Parsed<typeof parser>;

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;

const auto_schema_is_correct = {
  fom: true as Assert<Equal<AutoSchema["fom"], boolean>>,
  foo: true as Assert<Equal<AutoSchema["foo"], number | undefined>>,
  bar: true as Assert<Equal<AutoSchema["bar"], string | boolean>>,
  bak: true as Assert<Equal<AutoSchema["bak"], null>>,
  part: true as Assert<
    Equal<AutoSchema["part"], { bln: number | boolean; num: number | string }[]>
  >,
  class: true as Assert<Equal<AutoSchema["class"], ParsedClass>>,
  baz: true as Assert<
    Equal<
      AutoSchema["baz"],
      { bln: number | boolean; str: string; num: number | string }
    >
  >,
};
void auto_schema_is_correct;

console.warn(parsed);
if (parsed.ok) {
  const parsed_ok: AutoSchema = parsed.value;
  console.warn(parsed_ok);
}

const parsed2 = parser({
  fom: false,
  foo: 42,
  bar: "hello",
  bak: null,
  baz: { bln: true, str: "test", num: 123 },
  field_c: [false, "yes"],
  field_d: ["a", "b", "c"],
  part: [
    {
      bln: true,
      num: 123,
    },
  ],
  class: {
    bln: true,
    num: 123,
  },
  field_e: [
    ["x", true],
    ["y", false],
    ["z", true],
    ["w", false],
    ["v", true],
  ],
  field_f: [
    { a: 1, b: "one" },
    { a: 2, b: "two" },
    { a: 3, b: "three" },
    { a: 4, b: "four" },
    { a: 5, b: "five" },
  ],
  field_g: [
    ["a", "b", "c", "d"],
    ["e", "f", "g", "h"],
    ["i", "j", "k", "l"],
    ["m", "n", "o", "p"],
    ["q", "r", "s", "t"],
  ],
  omni: {
    a: 42,
    b: "hello",
  },
});

console.warn(parsed2);
if (parsed2.ok) {
  const parsed_ok: AutoSchema = parsed2.value;
  console.warn(parsed_ok);
}
