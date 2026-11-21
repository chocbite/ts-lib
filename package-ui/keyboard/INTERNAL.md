# Keyboard, internal notes

For working on the keyboard module itself. This file is not published, the module README is for users of the library.

## The layouts, `cldr_layouts.ts`

`cldr_layouts.ts` is generated, do not edit it. It holds the text keyboard layouts and the tables to sort them by continent and country, made by `scripts/cldr_layouts.ts` from [Unicode CLDR](https://github.com/unicode-org/cldr).

Run from the repo root, it needs internet access and takes a few seconds:

```
node package-ui/keyboard/scripts/cldr_layouts.ts
```

Node runs the TypeScript directly (type stripping, Node 22.18 or newer), there is nothing to install or build. The script is typechecked and linted with the rest, through `config/tsconfig.node.json`, and kept out of the package build and `SOURCE.md` like `tests/`.

Then check the result:

```
npm run typecheck
npm run vitest -- run --project ui keyboard
```

and look at the text keyboard on the keyboard dev page (`npm run dev`, page `ui/keyboard`), whose last section has the old text keyboard to compare with.

### Where the data comes from

- **Layouts:** `keyboards/windows/*.xml` of CLDR `release-43`, the Windows keyboard layouts. Release 43 (2023) is the last with the platform keyboards (`android`, `chromeos`, `osx`, `windows`), later releases replaced them with a new format that has only a handful of keyboards so far. The data is not updated anymore, which matters little as keyboard layouts rarely change.
- **Why Windows and not Android:** the Android layouts are made for phones and leave letters out to save width, Norwegian has no `æ ø å` and German no `ü ö ä` there, only by long press. The tray of this keyboard is wide like a desktop keyboard.
- **Countries:** `common/supplemental/supplementalData.xml` (which country is in which region, and the official languages of each country), `common/supplemental/likelySubtags.xml` (the main country of a language) and `common/main/en.xml` (the English names) of the same release.
- **The file list** comes from the GitHub API, one request, which allows 60 requests an hour without a token. The files themselves come from `raw.githubusercontent.com`, 8 at a time.

### What the script does

- Each layout file gives the keys of the default layer, shift (`modifiers="shift"`), and AltGr (`altR` or `ctrl+alt`) by their ISO position: row E is the number row from the key left of 1, D, C and B the letter rows. Caps lock and the other modifier layers are left out. The `transform`s are the dead keys, written once in `CLDR_DEAD_KEYS` as many layouts share them.
- Japanese, Korean and Chinese are left out, they need an input method.
- The id of a layout is its locale, with the variant of the file name after it: `de-CH-t-k0-windows-extended.xml` is `de-CH-extended`.
- **Countries of a layout:** a layout with a region in its locale is used there, `de-CH` in Switzerland, `es-419` (Latin America) in the countries of the region where Spanish is official. Any other layout is used in the main country of its language and the countries where the language is official, except where the language has a layout for that region. So German is in Germany and Austria but not Switzerland. A layout in another script than the usual one of the language, like `az-Cyrl`, is only in its main country.
- **Storage:** every layout is one string in `CLDR_LAYOUTS`, its fields, layers, rows and keys separated by control characters no key types (the format is described in the generated file), and every set of dead keys one string in `CLDR_DEAD_KEYS`. A string literal loads about 5 times faster than the same data as arrays and objects, measured 0.35 ms against 1.7 ms on a desktop, which counts on low end hardware. `languages.ts` splits the id, name and countries of every layout at load, for the picker and for following the browser, and the keys only when a layout is used, once.
- The license of the data, the Unicode license, is copied into the top of the generated file, which is all it asks for.

### How the keyboard uses it

`languages.ts` turns a layout into a keyboard configuration (`keyboard_layout_config`), picks the layout following the browser (`keyboard_layout_for`), and has `KEYBOARD_LAYOUT`, the layout of the `KEYBOARD_LANGUAGE` setting in `settings.ts`. `text.ts` makes the text keyboard from the state of the configuration, so it is built again when the language changes. `picker.ts` is the list of the 🌐 key, which `keyboard_keys.ts` shows in place of the keys.

The grid of a layout is 60 columns, every key 4 wide, with the letter rows staggered like a real keyboard. A position without a key in a layer is a gap.

There is no AltGr layer on the keyboard. The AltGr character of a key, and the letters the dead keys make with it, are what the key types when held (`hold` of the key), the AltGr character first so it is the hint in the corner. The shift layer gets the AltGr characters of the same positions too. The two symbol layers, `sym` and `sym2`, are the same for every layout, `SYMBOLS` in `languages.ts`, and have `dead_keys: false`.

## The Unicode blocks and emoji, `unicode_blocks.ts` and `unicode_emoji.ts`

`unicode_blocks.ts` and `unicode_emoji.ts` are generated too, by `scripts/unicode_blocks.ts` from `Blocks.txt` and `emoji/emoji-test.txt` of the Unicode Character Database, the version pinned as `VERSION` in the script. Run it from the repo root, it needs internet access:

```
node package-ui/keyboard/scripts/unicode_blocks.ts
```

- It writes every block as its name, first and last code point, and whether it is a script, so the picker can group the blocks into Symbols and Scripts. A block is a script when more than half of its characters belong to one script by the Script property of Node's own Unicode data, not `Common` or `Inherited`.
- Blocks of characters that are not typed alone, or too many to page through, are left out by the `EXCLUDED` pattern, and blocks without a single typeable character by Node's Unicode version.
- The characters themselves are not stored. `unicode.ts` lists the code points of a block when it is opened, and leaves out the ones the browser's own Unicode data calls control, format, surrogate, private use or unassigned (`/\p{C}/u`), so a block newer than the browser shows no characters. Keep `VERSION` at or below the Unicode version of Node, `node -p process.versions.unicode`, or the grouping of the new blocks is wrong.
- The emoji are the fully qualified ones of `emoji-test.txt`, in its groups, subgroups and order, without the `Component` group and without the variants with a skin tone, which would add every hand and person 5 more times. Every subgroup is one string, the emoji separated by spaces, as an emoji can be several code points, like a flag or a family. Unlike the blocks they are not checked against the browser, an emoji newer than the browser or its font shows as a box or as its parts.
- `unicode.ts` lists the emoji first, a group as a block with the emoji of all its subgroups, then the blocks.
- `keyboard_keys.ts` shows the view of the Ω key in place of the keys, like the list of languages, with the block list of `unicode.ts` and a grid of keys as many as fit, paged.
