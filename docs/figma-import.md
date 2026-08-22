# Importing components from Figma → cultum-ui

How we turn a Figma component into a React Native primitive in `components/`.
This is the repeatable recipe; `Badge` is the worked example that proves it.

## Source of truth

- **Figma file:** `Cultum.app` — key `JyrSo87oacbcbALO8JO9At`
- **Access:** the `figma-framelink` MCP server (tools `get_figma_data`,
  `download_figma_images`). No manual export needed.
- A URL like `figma.com/design/<fileKey>/…?node-id=26744-5099` gives you both
  the `fileKey` and the `nodeId` (convert the `-` to `:` → `26744:5099`).

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
| P1 | Toggle | `26744:5118` | ✅ done |
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

**🎉 The full component library is complete — every Figma component (P1 + P2 + P3) is imported, tested, and rendering.**

Foundation pages (`Colors – P0`, `Typography – P0`, `Radius – P0`,
`Spacing – P0`, `Stroke`, etc.) feed `theme/tokens.js` — reconcile those first
if a component needs a token that doesn't exist yet.

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
   `assets/`; pass them as React nodes (`leftIcon`/`rightIcon`), don't inline.
   The project has **no `react-native-svg`**, so a glyph that Figma ships as an
   SVG (checkbox tick, radio dot) is drawn with Views + a text glyph instead.

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

- **Exact hex match to an existing `colors.*` token → reuse the token.**
  (Badge's neutral solid `#93EC7C` **is** `colors.green`, so it reuses it.)
- **No exact match → add a new, clearly-labelled token** to `theme/tokens.js`,
  grouped by component (e.g. the `badge` export), then reference it. Never
  hard-code a hex inside a component.
- Reference `radius`/`spacing`/`fontSize` tokens where an exact one exists
  (Badge's pill uses `radius.pill`).

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
- **Tokens added:** `badge` in [`theme/tokens.js`](../theme/tokens.js) — `neutral`
  reuses `colors.green`; `positive`/`negative` are new Figma values.
- **Component:** [`components/Badge.js`](../components/Badge.js) —
  `intent × variant` resolves fill/text/border; `size` sets pill height
  (16/20/24), label stays Body/Body Small (12px).
- **Tests:** [`components/__tests__/Badge.test.js`](../components/__tests__/Badge.test.js) — 11 passing.
