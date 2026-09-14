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
- **No IAP.** `onStartTrial` is a stub: there is no in-app-purchase module in
  the project and `POST /billing/apple/verify` wants a StoreKit 2
  `Transaction.jwsRepresentation`. It logs the store product ids that call will
  need (they come down with the rest of the payload), so the swap is that one
  function body. `fallback_price` is right only in a USD storefront until then.
- **Figma's copy now comes from the backend.** `PRICING`, `TRIAL_STEPS`,
  `FEATURES`, `FOOTNOTE` and `ChoosePlanSheet`'s `PLANS` are gone — see
  "Content" below. `SOCIAL_PROOF` and `REVIEWS` stayed: the API has no App Store
  review data.
- **The comparison table lost two rows and gained real numbers.**
  `GET /billing/plans` returns seven features, not Figma's nine — neither
  "Journal and history" nor "Shared household" is in it — and the FREE column
  now says "3 scans a day" where Figma said "Limited". The PLUS column prints a
  string when the tier has a ceiling of its own ("30 scans a day") and draws the
  green tick otherwise. Both value columns are 64px wide, sized for the word
  "Limited", so the longer strings wrap — worth revisiting with the designer.
- **The plan sheet's sub-label is derived, not transcribed.** Figma's
  "$3.33 a month, billed yearly" became `detailFor(product)` keyed on `period`:
  dividing `fallback_price` by twelve would make the sheet lie the moment
  pricing changes in App Store Connect. A `detail` field on `PaywallProduct`
  would retire the helper.

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

## Content

| Piece | Source |
|---|---|
| title, trial timeline, feature table, footnote, products | `GET /billing/plans` via [api/billing.js](../api/billing.js) → [billing/paywallContent.js](../billing/paywallContent.js) |
| rating, reviews | local constants in the screen — no endpoint |
| price headline | `headlineFor(product)`, derived, so it follows the plan sheet |
| plan sub-label | `detailFor(product)`, derived from `period` |

`mapPaywall` validates rather than trusts: a payload it cannot render is
refused whole. **Nothing is bundled.** The app ships no copy of the paywall's
copy — no snapshot, no fallback prices — so there is nothing that can drift out
of step with the server, and the screen can never paint a price it did not just
fetch.

That is why `<PaywallLauncher>` opens the screen rather than `<Router initial>`:
the entry decision has to *wait* for the fetch, and `initial` is read once at
mount. The two alternatives were both worse — a spinner on a sales page for as
long as the backend's cold start takes, or a screen painting prices from a
snapshot the server may have changed. So the app opens on Today and the paywall
arrives over it when its content does. If the request fails, nothing happens at
all: a paywall that cannot be priced has nothing to say, and the user is not
blocked. The Login screen prefetches, so after a fresh sign-in the content is
usually already in hand.

The cache is **write-once** — once the backend has answered, that answer stands
for the session. `PaywallScreen` and `ChoosePlanSheet` both rely on it: neither
reconciles a selected plan against changing products, because the products
cannot change underneath them.

## Reaching the paywall

`AuthGate` builds `<Router>` only once signed in, so that mount *is* the
"entered the app" event — which is why the entry point is the router's `initial`
route rather than a `navigate()` in an effect (no flash of Today, no `today` on
the back stack). [billing/entry.js](../billing/entry.js) owns the decision:

```js
export const PAYWALL_ON_ENTRY = 'every-launch';  // 'fresh-login' | 'never'
```

`every-launch` is a **test setting**: the app is rarely signed out, so keying on
a fresh sign-in would mean almost never seeing the screen.
`auth/AuthProvider.js` now reports `signedInVia` (`'login'` | `'restore'` |
`'dev'` | `null`) so `'fresh-login'` can tell a completed sign-in from a session
restored off disk. Narrow it, or switch the paywall off entirely, by editing
that one constant.

`<PaywallScreen />` is still the `premium-gallery` route's guard fallback, and
`routing/guards.js#requireSubscription` is still an always-true stub — no
entitlement is read yet, so nothing is actually gated. `GET /users/me/subscription`,
a real guard and the free-tier limits are the next pass. Deliberate in-app entry
points (settings, gated actions) still need adding.
