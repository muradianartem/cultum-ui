# Auth + Paywall — Figma "Authorization & Paywall"

What shipped from the app-design file's authorization section, and what was
deliberately left out.

## Source of truth

- **Figma file:** `Cultum.app – App Design` — key `4jmjNlaM7IRpCOogYRJMks`
  (note: this is the *app design* file, distinct from the design-system file
  `JyrSo87oacbcbALO8JO9At` that feeds `theme/`).
- **Canvas:** "↳ Authorization" → section **"Authorization & Paywall"** (`268:554`).

| Frame | Node | Implementation | Status |
|---|---|---|---|
| Auth / Welcome | `250:8` | [screens/LoginScreen.js](../screens/LoginScreen.js) | ✅ built |
| Auth / Email | `268:7508` | — | ⛔ deferred — no backend endpoint |
| Auth / Code | `268:7611` | — | ⛔ deferred — no backend endpoint |
| Paywall / Cultum Plus | `250:11` | [screens/PaywallScreen.js](../screens/PaywallScreen.js) | ✅ built |
| Paywall / Choose a plan | `265:159` | [screens/ChoosePlanSheet.js](../screens/ChoosePlanSheet.js) | ✅ built |

## Deliberate deviations

- **No email provider.** The design's third button ("Continue with email"), the
  "Or" divider above it, and both sheets are omitted: [api/auth.js](../api/auth.js)
  only speaks `/auth/nonce`, `/auth/google`, `/auth/refresh`, `/auth/logout`.
  Add the button, divider and sheets together once an email/OTP endpoint exists.
- **System fonts.** The frames specify Literata (headings) and Inter (body).
  Neither is bundled — there is no `expo-font` dependency — so only size, weight,
  line-height and letter-spacing are matched. Adding the real families is a
  separate, app-wide change (it would touch `theme/foundations.js#typography`,
  which already carries the numeric scale).
- **Figma's 14px corner** (mosaic photos, PLUS column ends) rounds to
  `radius[16]`; 14 has no step on the foundations radius scale.
- **`Caption/Caption Emphasized` is Inter Medium** in these frames, while
  `typography.captionEmphasized` is bold — the weight is pinned back to `'500'`
  at the three call sites.
- **No IAP.** `onStartTrial` is a stub and `PRICING` / `SOCIAL_PROOF` /
  `PLANS` hold the Figma copy. Replace them with resolved StoreKit products when
  in-app purchases are wired up.

## Notes worth keeping

- **The Welcome screen pins its own theme.** It sits on photography and is dark
  in every OS scheme, so it nests a second `<ThemeProvider initialMode="dark">`.
  Every colour in `250:8` then resolves straight out of the dark token set —
  `#151515` background.primary, `#606160` border.primary, `#FAFAFA` text.primary,
  `#DADBDA` text.secondary — with no screen-local colours at all.
- **No new tokens were added.** Both screens read colour from `useTheme()` and
  geometry from `theme/foundations.js`. The one-off pixel dimensions Figma uses
  (300px hero, 218px mosaic photo, 57px day chip, 64px table column) are local
  `const`s; the gradient scrims stay literal `rgba()` strings, matching how
  `colorTokens.interaction` and `BottomSheet`'s backdrop already handle
  translucent layers. The paywall hero's final stop is the exception — it uses
  `t.background.primary` rather than Figma's literal white, so the hero meets
  the page ground with no seam.
- **`Button`'s outline variant is now opaque** (`background.primary` rather than
  `transparent`), which is what `theme/tokens.js#button.outline.bg` said all
  along. The Welcome buttons need it to cover the photo mosaic.
- **`BottomSheet` gained `sheetStyle` / `bodyStyle`** so the plan sheet can take
  its own ground (`#FAFAFA`) and 24px top radius.

## Assets

- `assets/auth/mosaic-01.png` … `mosaic-11.png` — the Welcome mosaic, exported
  via `download_figma_images` from nodes `253:220`–`253:232`. Figma's 12 slots
  share one image between slots 1 and 12, hence 11 files. `mosaic-01.png` is
  also the paywall hero (same `imageRef` in Figma).
- `assets/icons/cultum-logo.svg` — the 48px logo mark (node `268:7176`). Figma
  exports it with `feTurbulence` noise filters that react-native-svg cannot
  render; the committed file is the same art with the filters stripped.
- `assets/icons/star-filled.svg` — the icon set only had an outline star, and
  the paywall's rating and PLUS header both use a filled one.

Both new SVGs are registered as brand glyphs in
[scripts/gen-icon-registry.js](../scripts/gen-icon-registry.js) — rerun
`node scripts/gen-icon-registry.js` after touching `assets/icons/`.

## Reaching the paywall

`App.js` registers a `paywall` route and uses `<PaywallScreen />` as the
`premium-gallery` route's guard fallback. `routing/guards.js#requireSubscription`
is still an always-true stub, so **nothing reaches the paywall in the running
app yet** — it appears automatically once that guard starts returning `false`.
Deliberate in-app entry points (settings, gated actions) still need adding.
