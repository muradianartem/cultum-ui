# Figma foundations audit and refactor plan

## Summary

The app needs a targeted foundations refactor, led by typography and font loading. Its color palette, semantic color mappings, and scalar foundation definitions already align with the inspected Figma documentation. The main problems are outdated typography definitions, consumers bypassing those definitions, duplicate prototype tokens, an incomplete icon catalog, and tests that preserve outdated assumptions.

This began as a plan only. It has since been implemented; see the acceptance criteria for what was verified.

## Goal & non-goals

**Goal:** Treat the supplied Cultum design system as the authority for foundations, with traceable mappings from Figma to tokens, assets, and rendered app styles.

**Non-goals:** Redesign screens, change product behavior, upgrade Expo, replace the theme provider, or force every component measurement onto a generic scale. A component-specific Figma value can legitimately differ from the foundation scale; it needs provenance rather than rounding.

## Context

### Sources and coverage

Inspected the live design-system file through `figma-framelink` and the current local working tree on September 21, 2026 (America/Toronto). The supplied [Foundation node](https://www.figma.com/design/JyrSo87oacbcbALO8JO9At/?node-id=12047-31401) is a section-divider canvas; the actual foundation documentation lives on adjacent canvases in the same file.

- [Colors](https://www.figma.com/design/JyrSo87oacbcbALO8JO9At/?node-id=27338-11313): primitives frame `27835:8644`, semantic tokens frame `27465:14108`.
- [Typography](https://www.figma.com/design/JyrSo87oacbcbALO8JO9At/?node-id=27627-2008): documented style names, families, weights, sizes, and line heights.
- [Icons](https://www.figma.com/design/JyrSo87oacbcbALO8JO9At/?node-id=27338-14830): component-name and node-ID inventory.
- [Radius](https://www.figma.com/design/JyrSo87oacbcbALO8JO9At/?node-id=27465-22840), [Spacing](https://www.figma.com/design/JyrSo87oacbcbALO8JO9At/?node-id=27465-22713), [Stroke](https://www.figma.com/design/JyrSo87oacbcbALO8JO9At/?node-id=27518-5435), [Blur](https://www.figma.com/design/JyrSo87oacbcbALO8JO9At/?node-id=27488-592), and [Opacity](https://www.figma.com/design/JyrSo87oacbcbALO8JO9At/?node-id=27518-5511).

Code inspected: `theme/{primitives,colorTokens,foundations,tokens,ThemeProvider}.js`, their tests, `App.js`, `index.js`, `package.json`, `app.json`, the icon exporter/registry/assets, and component/screen consumers. The repository uses Expo `~57.0.9`, React Native `0.86.3`, and React `19.2.3`. Consulted the required [Expo 57 reference](https://docs.expo.dev/versions/v57.0.0/) and [Expo 57 font documentation](https://docs.expo.dev/versions/v57.0.0/sdk/font/).

This is a source-level audit, not a screenshot-based certification of every screen or component state. Icon names were reconciled, but existing SVG path geometry was not re-exported and compared. Matching semantic definitions does not prove that every component chooses the correct semantic role.

### Confirmed matches — retain these values

1. **Color primitives:** all 13 plotted ramps × 17 steps = **221 values match** `theme/primitives.js`. The additional `900` steps are outside that plotted-ramp count and remain required by semantic tokens.
2. **Semantic colors:** the **58 documented rows**, including two interaction rows, align with `theme/colorTokens.js` after translating Figma names into the app's nested names. Examples: brand primary = primary-500/400; background brand = primary-100/800; warning primary = warning-500/300; pressed = black/white at 8%. No color-value rewrite is justified by this audit.
3. **Scalar foundations:** `theme/foundations.js` matches the documented radius `0/4/8/12/16/24/32/full=9999`, spacing `0/2/4/8/12/16/20/24/32/48`, stroke `1/2/8`, blur `8/16/32`, and opacity `0/.25/.5/.75/1`.
4. **Current monochrome SVG normalization:** applying the current generator's normalization leaves no unexpected literal fill/stroke colors in the existing non-brand SVG set. The exporter is fragile for future inputs, but this is not an observed current recoloring failure.

### Confirmed mismatches and gaps

#### P1 — Typography definitions differ from Figma

`theme/foundations.js` assigns Inter to every style. Figma specifies **Literata for Display and every Heading**, and Inter for Body, Button, and Caption.

- `display` and the six existing heading variants have the wrong family.
- `headingExtraSmall` and `headingExtraSmallEmphasized` are absent. Both are Literata 18 with 130% line height (23.4); their weights are 400 and 700.
- `bodyMediumEmphasized` is 700 in code; Figma documents **500**.
- `captionEmphasized` is 700 in code; Figma documents **500**.
- The current test explicitly requires 17 styles and Inter everywhere. Figma now documents **19 styles**.
- Figma text-style data also carries paragraph spacing: Body Large/Medium use 8 and Body Small uses 4. The current token structure does not preserve that metadata. Apply this between actual paragraphs, not as bottom margin on every label.

Correct target style inventory (family, weight, size/line height):

- `display`: Literata 700, 40/48.
- `headingLarge`, `headingLargeEmphasized`: Literata 400/700, 32/38.4.
- `headingMedium`, `headingMediumEmphasized`: Literata 400/700, 24/28.8.
- `headingSmall`, `headingSmallEmphasized`: Literata 400/700, 20/26.
- `headingExtraSmall`, `headingExtraSmallEmphasized`: Literata 400/700, 18/23.4.
- `bodyLarge`, `bodyLargeEmphasized`: Inter 400/700, 16/22.4.
- `bodyMedium`, `bodyMediumEmphasized`: Inter 400/500, 14/19.6.
- `bodySmall`, `bodySmallEmphasized`: Inter 400/700, 12/16.8.
- `buttonMedium`: Inter 500, 16/19.2; `buttonSmall`: Inter 500, 14/16.8.
- `caption`, `captionEmphasized`: Inter 400/500, 12/16.8.

#### P1 — Font assets are not wired into rendering

`package.json` includes Literata and `expo-font`, but not Inter. `App.js` and `index.js` have no font-loading gate; the `expo-font` entry in `app.json` supplies no font files. No application `useFonts`/`loadAsync` call was found. The inspected iOS plist does not declare custom fonts.

`theme/tokens.js` uses `Iowan Old Style` for display and `System` for UI. Those are substitutes for the Figma families. A string such as `fontFamily: 'Inter'` does not make Inter available.

#### P1 — Consumers bypass or compensate for the foundation styles

- `components/NavigationBar.js` uses `fonts.display` and manually assembled 20/26 and 32/38 styles.
- `components/PlantCard.js` uses the same substitute for the 18px plant name, with line height 23 instead of the 23.4 foundation value.
- `components/RoomCard.js`, `components/Dialog.js`, `screens/TaskSheet.js`, `screens/AddReminderSheet.js`, `screens/ReminderValueSheet.js`, `screens/SnoozeContent.js`, `screens/addPlant/SuccessStep.js`, and `screens/scan/SpeciesCard.js` also use `fonts.display`.
- `components/Button.js` sets label weight and size without the font family or complete Figma line-height style. `Card`, `ListItem`, `TextInput`, `State`, and `Divider` similarly assemble text styles manually; several round fractional line heights.
- `screens/LoginScreen.js` and `screens/PaywallScreen.js` already work around the incorrect caption weight. Remove compensating overrides after fixing the canonical token.

Correcting the token file alone will therefore leave visible mismatches in the app.

#### P2 — Two competing geometry systems remain

`theme/tokens.js` retains prototype aliases alongside the accurate scales in `theme/foundations.js`: radius tile=11, lg=20, sheet=26, chip=14, pill=999; spacing cardGap=10 and section=26; and an independent font-size scale. Its component groups also repeat scalar values instead of referring to foundations.

These exports are a definition/governance mismatch, not proof that every value is rendered or wrong for its particular component. For example, Figma component geometry may legitimately use a 6px checkbox corner or a 14px screen-specific corner. Trace consumers before removing aliases, and preserve documented exceptions. Do not globally replace 14→16 or 26→24.

#### P2 — Icon catalog is incomplete and provenance is informal

The current Figma Icons canvas contains **417 component definitions: 157 non-flag icons and 260 flags**. The repository has **158 SVG assets**.

- After accounting for the documented `icon/flash_on` → `flash.svg` alias, **156 of 157 non-flag icons have a local name match**.
- Missing non-flag icon: [icons/all-inclusive, node 29549:77](https://www.figma.com/design/JyrSo87oacbcbALO8JO9At/?node-id=29549-77).
- All 260 `flags/*` definitions are absent locally. This is catalog coverage debt, not evidence that a current screen is missing a flag.
- `cultum-logo.svg` and `star-filled.svg` are outside this foundation inventory. `docs/figma-import.md` says the logo comes from the separate app design file and the filled star has no Figma counterpart. The star is actively used by `screens/PaywallScreen.js`; do not delete it or substitute an outlined star without matching design evidence.
- `scripts/gen-icon-registry.js` only handles one monochrome hex and an Apple-specific black fill. Name matching and successful tint normalization do not prove vector-path parity.
- `components/Checkbox.js` draws its tick and dash using text glyphs, despite documenting a Figma SVG source. These shapes depend on font rendering. Match the exact checkbox component artwork, rather than assuming the generic check icon is identical.

#### P2 — Effects and exceptions need an explicit contract

The Figma file includes `Elevation/Low` and `Elevation/Medium`. The low shadow's three layers agree with `shadow.low` in `theme/tokens.js`; Medium adds a fourth layer: `0px 16px 32px 0px rgba(16,16,16,0.09)`. The app has no named medium elevation token and retains prototype `float`, `raised`, `sheet`, and `green` shadows.

The scalar blur/opacity definitions match, but their presence does not establish correct usage. `Checkbox` adds disabled opacity .6; `overlay.opacity` is .85; photo scrims and pressed overlays use other values. Treat these as component-specific audit candidates, not automatic violations of the five-step opacity scale. Interaction alpha 8% is explicitly valid in Figma.

#### P2 — Existing tests do not establish Figma parity

Baseline run: `npm test -- --runInBand theme/__tests__` → **5 suites, 25 tests passed**. Tests verify local consistency and selected historical anchors; typography tests actively lock in outdated Figma assumptions. The hardcoded-color test allows documented exceptions but has no equivalent provenance checks for typography, geometry, effects, or icons.

## Approach & decisions

1. Keep `ThemeProvider`, `useTheme()`, and the existing semantic-color API. Their structure already supports light/dark modes. Preserve all matching color values.
2. Make `theme/foundations.js` the only foundation-scale definition. Keep `theme/tokens.js` for component recipes, motion, and accessibility measurements. Recipes reference foundation values where exact matches exist; exceptions carry a source node and reason.
3. Retain the ready-to-spread `typography.<name>` API to limit churn. Separate Figma metadata from runtime font-face aliases and paragraph metadata. Never add unsupported metadata properties to a React Native Text style.
4. Load exact static font faces through a single root gate. Runtime loading is the initial choice because this app supports web and currently has no configured embedded fonts. Expo 57 supports runtime loading across platforms; native embedding can follow separately after platform family-name validation.
5. Use a checked-in, reviewed Figma snapshot as the test oracle. Do not generate expected test values from the same source constants being tested, and do not let routine CI rewrite snapshots from live Figma.
6. Preserve current icon names through an explicit node-ID manifest. Record flags as deliberately unbundled until a screen needs them; keep the entire catalog in the manifest so absence is visible. This avoids adding 260 unused assets to the eager `SvgXml` registry merely to increase a coverage count.

## Implementation plan

### 1. Capture a reproducible baseline

Create `design-system/figma-foundations.json` with file key, capture timestamp, source node IDs, the 19 text styles, scalar scales, primitive values, semantic aliases for both modes, and elevation layers. Use the inspected documentation frames as sources; record missing variable/style IDs as unavailable rather than inventing them. Record both the documentation row and applied style if they conflict.

Create `design-system/icon-manifest.json` containing all 417 Figma component IDs and canonical names. Each entry includes `localName`, `kind` (`monochrome`, `brand`, or `flag`), and `status` (`bundled`, `missing`, or `deferred-unused`). Add separate local-extension entries for the logo and filled star, with their provenance status. Retain `flash` as a compatibility alias.

Create `design-system/exceptions.json` for component-specific values and external-source assets. Each exception needs a consumer/property, value, source file/node when available, and justification. Unverified legacy values remain visibly unresolved and cannot count as verified parity.

### 2. Correct typography and load the fonts together

Files: `theme/foundations.js`, new `theme/fonts.js`, `App.js`, `package.json`, `package-lock.json`, and `theme/__tests__/foundations.test.js`.

- Add `@expo-google-fonts/inter`; reuse the existing Literata dependency. Import Inter Regular 400, Medium 500, Bold 700 and Literata Regular 400, Bold 700.
- `theme/fonts.js` exports the stable font map and the aliases used by the runtime typography styles. Map each weight to its real static face; avoid relying on synthesized bold. The snapshot preserves Figma family/weight even if a platform adapter uses a weight-specific runtime family name.
- Add one root `useFonts` gate before mounting the app's provider tree. While loading, render a stable loading surface; on error, render a visible retry/error state instead of silently declaring fallback typography compliant. Do not repeatedly remount the router during theme changes.
- Replace the all-Inter helper with a family/weight-aware builder. Add both XS heading styles, correct the two medium weights, and preserve the exact decimal line heights listed above.
- Export paragraph spacing as separate metadata for true multiline paragraph composition.
- Update tests to compare all 19 definitions to the reviewed Figma snapshot and verify font aliases have registered assets.

Exit: all required faces load on iOS, Android, and web; token values match the snapshot. Font-loading failure is handled without an indefinite blank screen.

### 3. Migrate shared components, then screens

First migrate `NavigationBar`, `PlantCard`, `RoomCard`, `Dialog`, `Button`, `Card`, `ListItem`, `TextInput`, `State`, and `Divider`. Then audit the remaining text-producing files in `components/` (including `Avatar`, `Badge`, `Chip`, `Dropdown`, `DropdownMenu`, `SearchBar`, `SegmentedControl`, `Snackbar`, `TabBar`, `Tabs`, `TextArea`, `Calendar`, `WheelPicker`, and `ConfidenceRing`).

Use the component's Figma text-style reference to choose the role; do not choose only by matching font size. For the already traced examples: small/large NavigationBar titles map to Heading Small/Large, PlantCard name to Heading Extra Small, RoomCard name to Heading Small, and button labels to Button Medium/Small. Verify weight variants against the corresponding component node before replacing hand-written overrides.

Then migrate `screens/TaskSheet.js`, `screens/AddReminderSheet.js`, `screens/ReminderValueSheet.js`, `screens/SnoozeContent.js`, `screens/addPlant/SuccessStep.js`, and `screens/scan/SpeciesCard.js` away from `fonts.display` and literal `Inter`. Remove obsolete caption workarounds in Login and Paywall. Inspect all remaining `screens/` text styles for role overrides after spreading corrected tokens.

Do this in component-sized batches. Preserve alignment, truncation, input behavior, accessibility scaling, and intentional screen-specific styles. Update existing component/screen tests for the corrected styles; add only missing behavioral coverage.

Exit: no product text uses Iowan/System as a substitute for a Figma typeface, and every typography override has a documented reason.

### 4. Consolidate geometry and effect ownership

Files: `theme/tokens.js`, `theme/foundations.js`, affected component/screen styles, and the exceptions manifest.

- Change component recipes to reference `radius`, `space`, and `stroke` from foundations where values match exactly.
- Inventory imports of the legacy `radius`, `spacing`, `fontSize`, `fonts`, and prototype shadows. Remove unused exports. Replace used exports only after mapping each consumer to its Figma component or screen.
- Standardize pill aliases on `radius.full`; remove the duplicate 999 definition after migrating consumers.
- Add named low/medium elevation definitions from Figma. Migrate shadow consumers only when their Figma source establishes the appropriate elevation; do not indiscriminately replace upward sheet shadows with dropdown shadows.
- Keep platform shadow fallback behavior separate from the canonical Figma layers and verify both renderings.
- Review disabled opacity, scrims, and blur per consuming component. Do not add a blur dependency solely because blur tokens exist. If an actual source node requires backdrop blur, design that platform adapter against the Expo 57 docs as a separate bounded change.

Exit: one foundation scale, no unused prototype token families, and traceable component exceptions instead of silent arbitrary values.

### 5. Reconcile and harden icons

Files: `assets/icons/all-inclusive.svg` (new), `scripts/gen-icon-registry.js`, generated `components/iconRegistry.js`, `components/Icon.js`, `components/Checkbox.js`, and new `components/__tests__/Icon.test.js`.

- Export `29549:77` from Figma as `all-inclusive.svg`; regenerate the registry. Preserve the 156 currently mapped names and the `flash` alias.
- Re-export the currently bundled Figma icons to a temporary directory and compare normalized SVG geometry with local assets. Review differences before replacement; name coverage is not an artwork check.
- Make the generator use the manifest's `kind` field. Normalize actual monochrome fill/stroke colors, preserve `none`, opacity, clipping, and intentional brand/flag colors. Reject unknown color behavior instead of silently shipping an untintable glyph.
- Replace checkbox text glyphs with exact Figma vector artwork, retaining checkbox interaction/accessibility behavior. Record the exported component node in the manifest even if it is outside the foundation icon canvas.
- Keep flags deferred with their node IDs until used. An icon marked `deferred-unused` must have no app consumer; a newly referenced one must be exported and tested before shipping.
- Resolve the filled star's design provenance before claiming complete asset parity. Keep its existing behavior while unresolved. Verify the external logo source rather than recoloring a brand asset by inference.

Exit: all 157 non-flag foundation names are available through the manifest/registry, existing glyph geometry is reconciled, and local extensions or deferred flags are explicit.

### 6. Add drift checks and correct import documentation

Files: new `theme/__tests__/figmaParity.test.js`, existing foundation/color tests, new Icon tests, and `docs/figma-import.md`.

- Compare every primitive and light/dark semantic alias to the reviewed snapshot, including the semantic-only 900 steps and interactions.
- Test exact 19-style metadata, registered runtime font faces, scalar scales, and elevation definitions.
- Check registry/asset/manifest consistency, duplicate local names, missing referenced icons, preserved brand colors, and monochrome tinting.
- Extend the current guard approach to flag new legacy typography imports and undocumented foundation overrides. Scope checks to style properties; do not ban all numeric literals or confuse animation values with design tokens.
- Update documentation that says every component is imported or that geometry belongs only in `theme/tokens.js`. Document the foundations → component recipe → consumer layering and the approved snapshot-refresh process.

## Data & interface changes

- No backend, persistence, auth, navigation, or theme-mode contract changes.
- `typography` remains a collection of spreadable React Native styles, grows from 17 to 19 keys, and resolves to loaded family/weight faces. Canonical font metadata and paragraph spacing remain separate from style objects.
- `useTheme()` retains all existing nested color roles.
- Legacy prototype exports are removed only after their imports are migrated; component geometry exports remain available.
- `<Icon name size color>` retains its interface. Figma node IDs and alias decisions move into a manifest rather than implicit filename conventions.

## Verification

Audit baseline already run: `npm test -- --runInBand theme/__tests__` (25 passing tests). No app build or screenshot comparison was performed for this planning task.

For implementation:

1. Run `npm test -- --runInBand theme/__tests__` after snapshot/token changes.
2. Run `npm test -- --runInBand components/__tests__` after shared component migration; run affected screen tests for each subsequent batch.
3. Run `node scripts/gen-icon-registry.js` twice and confirm the second run produces no diff. Validate manifest coverage independently of the generated file.
4. Run `npm test -- --runInBand` after the complete migration; distinguish pre-existing failures from regressions.
5. Use the existing `npm run ios`, `npm run android`, and `npm run web` entry points for runtime verification. Compare a foundation specimen and representative Login, Today, Product, Reminders, Rooms, Settings, Paywall, and sheet views against Figma in light and dark modes.
6. Verify actual registered font faces with Expo Font's `getLoadedFonts()`, including a cold start and direct entry to each major flow. Check wrapping, baseline alignment, fractional line heights, large accessibility text, button/input clipping, and sheet height.
7. Exercise enabled, pressed, disabled, selected, error, and loading states. Review monochrome icons on both light and dark surfaces and brand assets without tinting.

## Acceptance criteria

Status after implementation (2026-09-21, branch `feat/figma-foundations`). Web was checked at runtime; iOS and Android were not run.

- [x] All 19 typography styles match the reviewed Figma metadata and render with registered assets. *(Web: faces confirmed via `document.fonts` and computed styles. Native: not run.)*
- [x] No Iowan/System fallback remains where Figma requires Literata/Inter.
- [x] All plotted palette values and all 58 semantic/interaction rows continue to match; semantic-only primitive steps are covered explicitly.
- [x] Existing matching scalar scales are preserved, consumed consistently, and no duplicate unused prototype scale remains.
- [x] Every component-specific exception has provenance or an explicitly unresolved status; unresolved items are not counted as parity. *(33 entries, 19 unresolved.)*
- [x] All 157 non-flag Figma icons are mapped; the 260 deferred flags and external/local assets are visible in the manifest.
- [x] Existing SVG artwork has been compared, not merely counted; checkbox glyphs use verified vectors. *(148 identical, 4 rounding-only, 4 replaced; `star-filled` still has no exportable node.)*
- [x] Tests validate an independently reviewed Figma snapshot and detect future drift.
- [ ] Representative light/dark screens and interaction states pass visual review on supported platforms. *(Login, Paywall, Choose-a-plan, Today and Settings checked on web in both themes. Native builds and interaction-state screenshots remain.)*

## Risks, assumptions & open questions

- **Font reflow:** switching to actual Literata/Inter will change widths and baselines. Fixed-height controls and sheets are the highest-risk consumers.
- **Source disagreement:** documentation rows and applied Figma component styles can disagree. Record both, resolve the intended style in Figma, and avoid silently choosing whichever resembles current code.
- **Icon limitation:** this audit confirms catalog coverage, not existing path identity. The planned export comparison is required for an artwork-parity claim.
- **Design provenance unresolved:** the active local filled star has no counterpart in the inspected foundation inventory. This blocks complete icon parity, but does not block typography, token consolidation, or the missing-icon import. Locate an authoritative app-design source or have the intended asset added to Figma before replacing it.
- **Flags:** the plan deliberately tracks unused flags without bundling them. If full offline catalog availability becomes a product requirement, import them as a separate multicolor registry rather than treating them as tintable monochrome icons.
- **Existing work:** the initial tree contained unrelated edits in reminder/add-plant screens, data helpers, store code, and tests. Preserve those edits when implementation begins; do not reset files to apply this plan.
- **Completeness:** component geometry, semantic-role selection, blur, and screen-specific effects require the node-by-node migration checks above. This document does not claim every existing component variant has been visually certified.
