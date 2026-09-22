# Importing components from Figma → cultum-ui

How we turn a Figma component into a React Native primitive in `components/`.
This is the repeatable recipe; `Badge` is the worked example that proves it.

## Source of truth

- **Figma file:** `Cultum.app` — key `JyrSo87oacbcbALO8JO9At`
- **Access:** the `figma-framelink` MCP server (tools `get_figma_data`,
  `download_figma_images`). No manual export needed.
- A URL like `figma.com/design/<fileKey>/…?node-id=26744-5099` gives you both
  the `fileKey` and the `nodeId` (convert the `-` to `:` → `26744:5099`).

### The icon foundation

- **Page:** "☼ Icons" — node `27338:14830`. Every glyph in `assets/icons/` comes
  from here; it is the list to diff against when icons look out of date.
- Figma names are **not** the filenames. Flatten to kebab-case:
  `icons/mail` → `mail.svg`, `icons/outlined/cut` → `outlined-cut.svg`,
  `icon/living_room` → `living-room.svg`. Pass `fileName` explicitly to
  `download_figma_images` — it will not do this for you.
- **Every file is in `design-system/icon-manifest.json`.** It lists all 417
  components on the canvas (157 icons, 260 flags) by node id, and each file's
  `kind`: `monochrome` (its single ink becomes `currentColor`, whatever the hex),
  `brand` (kept as drawn) or `flag` (catalogued, deliberately not bundled until
  a screen needs one). Add the manifest entry before running the generator — it
  fails on a file it doesn't know, a bundled entry with no file, or a
  monochrome file with more than one ink colour.
- Names that aren't a plain flattening are recorded in the manifest's
  `aliases` (`flash` is Figma's `icon/flash_on`). `cultum-logo` and
  `star-filled` are `localExtensions` with their App Design provenance.
- The last artwork comparison (re-export vs. `assets/icons/`) is recorded in the
  manifest's `artworkComparison`; repeat it when Figma's icons change.

### Connection is verified ✅

`get_figma_data` returns structured layout/variant/token data for this file, so
the pipeline below can be run in bulk by an agent, one component per page.

## The component roadmap (one page = one component)

Pulled from the file's canvas list; the `– P#` suffix is the design team's
priority. Node ids are stable handles for `get_figma_data`.

| Priority | Component | Node id | Status |
|----|----|----|----|
| P1 | Button | `26734:3379` | ✅ done (Figma) |
| P1 | Button Icon | `26734:5388` | ✅ done |
| P1 | Checkbox | `26744:5102` | ✅ done |
| P1 | Chip | `26744:6933` | ✅ done |
| P1 | Divider | `26744:5104` | ✅ done |
| P1 | Radio Button | `26744:5111` | ✅ done |
| P1 | Toggle | `27383:1945` | ✅ done |
| P2 | **Badge** | `26744:5100` | ✅ done |
| P2 | Bottom Sheet | `26744:6931` | ✅ done (Figma) |
| P2 | Card | `26744:5101` | ✅ done |
| P2 | Dropdown | `26744:5105` | ✅ done |
| P2 | Dropdown Menu | `26744:5106` | ✅ done |
| P2 | List | `26744:5108` | ✅ done (List + ListItem) |
| P2 | Loading Indicator | `26744:5109` | ✅ done |
| P2 | Navigation bar | `26744:6012` | ✅ done |
| P2 | Search Bar | `26744:5112` | ✅ done |
| P2 | Segmented Control | `26744:5113` | ✅ done |
| P2 | Snackbar | `26744:5114` | ✅ done |
| P2 | State | `26744:5115` | ✅ done |
| P2 | Tab Bar | `26744:5116` | ✅ done |
| P2 | Text Input | `26734:5390` | ✅ done |
| P3 | Avatar | `26744:5099` | ✅ done (Avatar + AvatarGroup) |
| P3 | Overlay | `26744:5110` | ✅ done |
| P3 | Tabs | `26744:5117` | ✅ done |

Every component above has a primitive in `components/`. That is coverage, not
certified parity: where a component departs from its Figma node, the departure
is listed in `design-system/exceptions.json`, and entries marked `unresolved`
are still open.

Screens assembled from these primitives live in their own design notes — see
[auth-paywall-design.md](auth-paywall-design.md) for the Authorization & Paywall
section, which comes from a *different* Figma file (`4jmjNlaM7IRpCOogYRJMks`).

## Foundations → recipes → consumers

Three layers, each with one home:

1. **Foundations** — `theme/primitives.js`, `theme/colorTokens.js` and
   `theme/foundations.js` (radius, spacing, stroke, blur, opacity, the 19 text
   styles). They are the Figma foundation pages, value for value, and
   `theme/__tests__/figmaParity.test.js` holds them to the reviewed snapshot in
   `design-system/figma-foundations.json`.
2. **Recipes** — `theme/tokens.js`: per-component measurements (heights,
   sizes, the text style a slot uses), elevation and motion. A recipe refers to
   a foundation value whenever Figma's number is a scale step.
3. **Consumers** — components and screens spread a named style
   (`...typography.bodyMedium`) and read recipes. A value that isn't a
   foundation step or a named style — a raw Figma text layer, a 6px checkbox
   corner, a platform workaround — goes in `design-system/exceptions.json` with
   its Figma node and a reason. The parity test fails on a raw `fontSize`,
   `lineHeight`, `letterSpacing`, `fontWeight` or `fontFamily` in a file that
   has no matching entry.

**Typography.** Every style names a loaded static face (`theme/fonts.js`,
loaded by `theme/FontGate.js` before the app mounts) and carries no
`fontWeight`: to change weight, change style (`bodyMedium` →
`bodyMediumEmphasized`), never override the weight. For a raw Figma style, use
`fontFace('Inter', 700)` with the Figma size and line height. Pick the style
from the node's `textStyle`, not by matching the font size — Card's title and
the small Navigation Bar title are both 18pt Literata, but only Card's is
Emphasized.

## Refreshing the foundations snapshot

`design-system/figma-foundations.json` is edited on purpose, never regenerated
by CI:

1. Fetch each foundation page listed under `sources` with `get_figma_data`
   (they're large; parse the saved file — `TEXT` labels resolve through the
   `ELEMENTS` templates, swatch fills through `GLOBAL_VARS`).
2. Update the JSON from those rows only — not from `theme/`, or the test stops
   checking anything. Keep documentation/swatch disagreements in
   `docSwatchConflicts` rather than picking one silently.
3. Run `npx jest theme/__tests__/figmaParity.test.js`. Every failure is a real
   Figma change: update the theme file, then review the pair together.

## The recipe

1. **Fetch the node.** `get_figma_data({ fileKey, nodeId })`. Component pages are
   large and often exceed the tool's token limit — the result is then saved to a
   file. Don't dump it into context; `grep`/`awk`/`sed` the saved file for the
   parts you need:
   - the `COMPONENT_SETS` block → the variant **axes** and property definitions;
   - the `COMPONENT` names (`Style=…, Type=…, Function=…, Size=…`) → the full
     variant matrix;
   - `GLOBAL_VARS` (`fill_*`, `layout_*`, text styles) and the `ELEMENTS`
     templates (`EL-*`) → the concrete colours, padding, radius, font.
2. **Reduce the matrix to props.** Each Figma axis becomes one prop. Reuse the
   codebase's existing prop vocabulary rather than Figma's raw labels
   (see naming below).
3. **Map colours to tokens** (rule below).
4. **Write the component** in `components/<Name>.js`, mirroring `Button.js`:
   a JSDoc header stating the Figma origin and the axis→prop mapping, a variant
   map near the top, `StyleSheet.create` at the bottom, token imports only.
5. **Export** it from `components/index.js` (the barrel).
6. **Test** it in `components/__tests__/<Name>.test.js` with
   `react-test-renderer` (see `Badge.test.js` / `BottomSheet.test.js`): assert
   the barrel export, each variant's resolved colour, each size, and
   accessibility. Run `npx jest components/__tests__/<Name>.test.js`.
7. **Icons/vectors**, if any, come via `download_figma_images` (SVG) into
   `assets/icons/`, then `node scripts/gen-icon-registry.js` to regenerate
   `components/iconRegistry.js`; render them with `<Icon name="…">` and pass
   them as React nodes (`leftIcon`/`rightIcon`), don't inline.
   Figma sometimes exports art with `feTurbulence` noise filters —
   react-native-svg cannot render those, so strip them and keep the shapes.

   > **Note:** don't draw a Figma vector as a text glyph (✓, ✕, ▾): how it looks
   > then depends on the font. Checkbox inlines its exported tick and dash
   > paths; close, search and chevron slots use `<Icon>`.

## jest-expo test gotchas (learned the hard way)

- **`Pressable` doesn't appear as its own type** — `findByType(Pressable)` returns
  0. Query the host node by `accessibilityRole` (`'button'`/`'switch'`/`'checkbox'`
  /`'radio'`) instead, and flatten its `style` array to assert colours/sizes.
- **The host node has no `onPress`.** To fire a press, find nodes whose
  `props.onPress` is a function and call the **deepest** one (the inner Pressable
  wrapper). The composite element also carries the raw `onPress` you passed in —
  calling that bypasses the component's `disabled` guard and fails the test.
- **Never animate a colour** (`Animated` + `interpolate` over hex) with the
  default timers — it crashes the run. Native-drive `transform` only and switch
  discrete colours straight off the prop (see `Toggle.js`).

## The colour → token rule

Figma is the source of truth for *this* import. Map mechanically so a bulk
agent needs no judgement:

- **Colours are semantic roles, never hexes.** Every Figma fill is a variable
  from the Design System's Color Tokens page (`27465:14108`), and each one has a
  light and a dark value. Read it from `useTheme()` (`t.surface.primary`,
  `t.text.secondary`, …) — `theme/colorTokens.js` holds the `{ light, dark }`
  pairs. If a Figma hex has no role in the light column, find its role before
  writing code; don't invent a token.
- **Apply colours inline, keep geometry static.** `StyleSheet.create` holds
  sizes/padding/radius; colours go in the style array at render from `t` (see
  `Button.js`). For screens with many coloured styles, build them with
  `makeStyles(t)` + `useMemo`.
- **Pressed is `t.interaction.pressed`**, a translucent layer over the base
  fill — not a darker grey — so it works on any ground in either theme.
- **Geometry comes from `theme/foundations.js`** (`radius[16]`, `space[8]`,
  `radius.full` for pills); a component's own measurements are a recipe in
  `theme/tokens.js`. Neither holds colours, and
  `theme/__tests__/noHardcodedColors.test.js` fails on any hex or `rgba()` in
  `components/` or `screens/` that isn't on its allowlist (photo scrims, the
  modal backdrop — colours that must not follow the theme).
- **Check the dark frame too.** Screen sections in the App Design file have
  `[Dark Mode]` twins (Auth & Paywall `381:27008`, Today `567:8000`, Product page
  `335:8214`) — compare against them, not only the light frame.

## Naming: Figma axis → prop

Keep prop names consistent across the library, not literal to Figma:

| Figma axis | Prop | Notes |
|----|----|----|
| Style | `variant` | `Primary/Secondary/Outlined/No background` → `primary/secondary/outline/ghost` (`ghost` = "No background", matching `Button`) |
| Function | `intent` | `Neutral/Positive/Negative` → `neutral/positive/negative` (Figma "Function"; `function` is a JS reserved word) |
| Size | `size` | `Small/Medium/Large` → `sm/md/lg` |
| Type | *derived* | icon/label composition → `label`/`children` + `leftIcon`/`rightIcon` (icon-only = icons with no label) |

## Worked example: Badge

- **Figma:** page "Badge – P2" (`26744:5100`), component set `Badge`
  (`27817:7465`), 4 Styles × 4 Types × 3 Functions × 3 Sizes.
- **Colours:** `intent` → a semantic family — neutral is `brand.*`, positive
  `success.*`, negative `error.*` — resolved from `useTheme()`.
- **Component:** [`components/Badge.js`](../components/Badge.js) —
  `intent × variant` resolves fill/text/border; `size` sets pill height
  (16/20/24), label stays Body Small (the Small pill keeps a 14 line, an
  exception).
- **Tests:** [`components/__tests__/Badge.test.js`](../components/__tests__/Badge.test.js) — 11 passing.
