# New onboarding execution plan

## Summary

Implement the four Figma onboarding screens after authentication, reuse the existing scan/search and add-plant flows, and open the existing paywall when the onboarding user taps **Done**. Keep ordinary add-plant navigation unchanged. This document is an implementation plan; no application changes have been made.

## Goal & non-goals

**Goal:** Deliver this journey:

```text
Authentication
  → Scan a plant (intro)
  → Add your plant (intro)
  → Get notified
  → Add your first plant
      → Scan a plant OR Search by name
      → Existing species preview
      → Existing AddPlantScreen: name → room → reminders → success
      → Done
  → Existing paywall
  → Today
```

The onboarding entry screen does not have a selected species. It must enter the existing scan/search journey before the shared add-plant form can receive its plant view model.

**Non-goals:** Replace the router, duplicate plant creation, change billing products or purchase verification, redesign the paywall, introduce backend onboarding endpoints, or implement quiet hours as part of this change.

## Context

### Verified design sources

Read through the Figma connection on September 22, 2026:

- [Onboarding section, node 268:554](https://www.figma.com/design/4jmjNlaM7IRpCOogYRJMks/Cultum.app?node-id=268-554).
- [Add your first plant, node 772:20947](https://www.figma.com/design/4jmjNlaM7IRpCOogYRJMks/Cultum.app?node-id=772-20947).

The second link points to the onboarding entry screen, not the shared naming/room/reminders wizard. The section contains these four onboarding frames, ordered left to right:

1. **Scan a plant — `772:21068`.** “Scan a plant or search by name. Cultum shows possible matches and tells you how confident it is.” Primary action: **Next**. Illustration: `772:21080`.
2. **Add your plant — `772:20998`.** “Each plant gets its own watering and feeding rhythm. Change it whenever you like and the reminders follow.” Primary action: **Next**. Illustration: `772:21010`.
3. **Get notified — `772:20967`.** “Cultum tells you when a plant needs you, and stays quiet during the hours you set.” Primary action: **Continue**. Illustration: `772:20979`.
4. **Add your first plant — `772:20947`.** “Add a plant and Cultum will create a starting care rhythm in about a minute.” Primary action: **Scan a plant**; secondary action: **Search by name**.

Frames use a four-segment progress indicator, Back and Skip controls, 375 × 812 reference dimensions, Literata headings, Inter body text, and bottom actions. The first three illustrations are 272 points tall; the final screen uses a scan icon and centered text. Use device safe areas rather than reproducing Figma's status bar/home indicator artwork.

Figma establishes layout and copy, but the retrieved data does not establish all navigation semantics. Recommended behavior for Skip, first-screen Back, and returning users is explicitly documented below.

### Current application

- `App.js`: `AuthGate` renders login before authentication, then mounts `EntitlementProvider`, `GardenProvider`, `SnackbarProvider`, and the custom `Router` with initial route `today`.
- `routing/Router.js`: supports `navigate`, `replace`, `reset`, and `back`. `reset` clears history; `initial` is read only on mount. `routing/Route.js` unmounts inactive screens and passes route params as props. This app does not use Expo Router.
- `billing/PaywallLauncher.js`: automatically pushes a paywall after billing content arrives. `billing/entry.js` currently defaults to `every-launch`. This conflicts with the requested onboarding order.
- `screens/scan/ScanCameraScreen.js`, `ScanMatchesScreen.js`, and `ScanSearchScreen.js`: already implement acquisition, identification, search, errors, and selection. Some exits explicitly reset to Today.
- `screens/scan/openPlant.js`: loads species details and opens `product`. `screens/ProductPage.js` passes the selected view model into `add-plant`.
- `screens/addPlant/AddPlantScreen.js`: owns name, room, reminders, and success steps. It saves through `garden.addPlant` before displaying success and guards duplicate creation with `savedId`. **Done currently replaces the route with the saved plant's Product page, not Home.** Success Close does the same; Scan another plant resets to the camera.
- `screens/PaywallScreen.js`: already supports loading, retry, and Close when content is unavailable. Its close helper returns through history or resets to Today when history is empty. Verified iOS purchases also use that close path.
- `prefs/PrefsProvider.js`: exposes `setNotificationsEnabled(true)` and permission refresh. Reuse this for notification consent.
- `notifications/NotificationRouter.js`: can navigate to a plant independently of onboarding.
- `lib/prefsStorage.js`: demonstrates synchronous, versioned local reads using `expo-file-system`; `store/persist.js` demonstrates temporary-file writes and garden persistence.

The project uses Expo `~57.0.9`, React Native `0.86.3`, and React `19.2.3`. The required [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) was read. Consult the versioned package documentation before adding Expo API calls. No new dependency or SDK upgrade is expected.

## Approach & decisions

### Keep one onboarding coordinator above routes

Add an `OnboardingProvider` above the Router and a small `OnboardingNavigator` inside it. The provider owns progress and persistence; the navigator owns transitions requiring router access. Shared screens consume a hook with an inactive default so existing isolated tests and ordinary entry points remain valid.

Prefer this over threading a source flag through every scan, matches, search, product, and add-plant transition: the router unmounts screens and several paths reset history. A provider survives those transitions and avoids losing onboarding intent.

Scope the active add-plant session explicitly: it starts only when onboarding's Scan/Search action is pressed. A missing completion record alone must not turn an unrelated add-plant action into an onboarding completion.

### Entry and persistence policy

Recommended default: onboarding is once per installation, after authentication. Completion survives sign-out. This matches the current lack of a stable exposed account ID or backend onboarding status; do not key it on email or access tokens.

- A completed record opens Today.
- An unfinished record resumes its onboarding stage.
- With no record, a restored session (`signedInVia === 'restore'`) is treated as an existing installation and initialized as complete.
- With no record, a fresh login enters onboarding. A development session should have an explicit fixture/override for previewing either path.

This is a pragmatic migration, not a reliable new-account detector. A previously signed-out existing user can see onboarding once. Record that limitation instead of inferring account age from an empty garden.

### Navigation rules

- Next moves to the next intro. Back moves to the previous intro. On the first intro, disable/omit Back rather than signing the user out.
- Skip on an intro jumps to **Add your first plant** without prompting for notifications. Skip on **Add your first plant** goes to the paywall without creating a plant.
- Continue on **Get notified** requests notification permission through the existing preferences API, then advances whether granted or denied. Guard repeat taps and retain a usable Continue path on an unexpected permission error.
- Scan/Search enters the corresponding existing route. Cancelling that journey returns to onboarding step four, including paths that currently reset to Today.
- Preserve ordinary in-wizard Back behavior. Before saving, closing the form returns through the acquisition journey. After saving, onboarding Done and success Close both finish through the paywall.
- Keep Scan another plant functional: it starts another acquisition while retaining onboarding context and already saved plants. The eventual Done still opens the paywall.
- At completion, use `reset('paywall', { source: 'onboarding' })`. Clearing history means closing the paywall cannot remount the form or reopen the camera.
- Only a paywall entered with `source: 'onboarding'` completes onboarding on exit. Room-limit paywalls remain ordinary temporary paywalls and must not mark onboarding complete.
- Remove the automatic launch-paywall behavior from `App.js`; onboarding completion, Settings, and existing premium gates become the entry points. Keep the launcher module available if needed for a separately enabled development preview.

## Implementation plan

### 1. Add onboarding content and illustration assets

Create `screens/onboarding/onboardingData.js` containing the verified copy, stable step IDs, Figma node references, and asset mapping. Create `assets/onboarding/scan.png`, `care.png`, and `notifications.png` by exporting the three full illustration frames above, including their decorative overlays, at 2× resolution.

Use these exports only for decorative illustration content; titles, body copy, navigation, progress, and CTAs must remain native accessible elements. Compare full illustration exports against the design before committing. Do not export entire screens as UI.

### 2. Implement durable progress and the coordinator

Create `onboarding/storage.js`, `OnboardingProvider.js`, and `OnboardingNavigator.js`.

Persist a small versioned document named `cultum-onboarding.json`:

```js
{
  version: 1,
  stage: 'intro', // 'intro' | 'add-plant' | 'paywall' | 'complete'
  step: 0,        // 0..3
  savedPlantId: null
}
```

Storage interfaces: `loadOnboardingSync(): record | null`, `saveOnboarding(record): boolean`. Validate stage, step, and version; handle missing/corrupt files without crashing. Follow the existing File/Paths and temporary-file replacement patterns. Serialize writes so an older transition cannot overwrite a newer one.

Provider hook contract:

- `stage`, `step`, `active`, `addingPlant`, `savedPlantId`.
- `setStep(index)`, `beginPlant()`, `returnToEntry()`, `recordSavedPlant(id)`, `beginPaywall()`, `complete()`.
- Make transitions idempotent and keep progress above route lifetimes. Save transition checkpoints immediately, not only at app backgrounding.

The navigator waits for `garden.ready` before resolving a saved plant on resume. Resume unfinished acquisition at step four rather than reconstructing camera state or an unsaved form draft. If a checkpoint references an existing saved plant, resume at the paywall rather than force another plant creation; if it no longer exists, resume step four. Document that interrupted drafts are not restored.

Garden and onboarding files are separate writes. Do not claim transactional crash recovery: the missing-plant check handles an onboarding checkpoint that reaches disk first. Preserve the garden's existing saving behavior; test that resume never creates a plant automatically.

### 3. Build the four-screen onboarding route

Create `screens/onboarding/OnboardingScreen.js`. Use the coordinator's step state, existing `Button`, `Icon`, theme foundations, typography, and safe-area conventions. Render four progress bars with an accessible “Step N of 4” label. Keep actions reachable on smaller screens and with larger text by allowing content to scroll.

Implement the three intro panels and final Scan/Search entry with the copy above. Use the existing permission API for Get notified; no prompt on mount or Skip. Treat illustrations as decorative for screen readers. Keep the design's notification preview separate from real user reminders.

### 4. Wire authenticated entry and prevent competing redirects

Edit `App.js` to mount the provider above the Router, register `onboarding`, and mount the navigator inside the Router. Choose the initial route from hydrated progress before showing screen content; do not mount Today and redirect a frame later.

Remove the production `PaywallLauncher` mount. Keep authentication and garden/billing provider placement intact. Do not infer onboarding eligibility from `signedInVia` on each render; initialize the durable state once.

Edit `notifications/NotificationRouter.js` to defer notification-driven navigation while onboarding is active, retaining at most the latest tapped destination in memory. Deliver it after completion only if the referenced plant exists; otherwise leave Today visible. Clean up pending state when the authenticated tree unmounts.

### 5. Reuse acquisition and shared plant creation

Edit `screens/scan/ScanCameraScreen.js`, `ScanMatchesScreen.js`, and `ScanSearchScreen.js` only where their exits/reset paths need onboarding-aware destinations. Keep search, scan results, species fetching, retry, and camera permission behavior intact. Search-to-camera transitions must retain a route back to onboarding step four even when resetting history.

No planned change to `openPlant.js` or `ProductPage.js`: their existing plant view-model handoff remains valid because onboarding state lives above them.

Edit `screens/addPlant/AddPlantScreen.js`:

- Keep the single `garden.addPlant` call and existing `savedId` guard.
- When saving in the explicit onboarding add session, call `recordSavedPlant(savedId.current)`.
- Make Done and success Close call one finish handler: onboarding calls `beginPaywall()` and resets to the paywall; ordinary entry keeps `replace('product', { plantId })`.
- Preserve Scan another plant and the saved plant when continuing acquisition.
- Guard rapid repeated finish taps. Do not create/save the plant again on Done, paywall entry, purchase, or dismissal.

### 6. Finish onboarding through the existing paywall

Edit `screens/PaywallScreen.js` to accept optional `source` and pass it through both the loading/error branch and loaded paywall. Extend the shared close helper so `source === 'onboarding'` calls `complete()` before resetting to Today.

Purchase success and any existing successful restore exit must use that same completion path. Purchase cancellation, pending verification, or purchase failure must keep the paywall and onboarding state intact. Loading/error Close must still work. Preserve backend/StoreKit pricing and eligibility; never replace them with Figma's illustrative prices.

Ordinary Settings and room-limit paywalls retain their existing Back behavior. Do not mark onboarding complete when one of those closes.

### 7. Add regression tests and run device verification

Add coordinator/storage tests and cross-screen tests listed below. Update the old launch-paywall assertions in `__tests__/App.test.js` to reflect the new entry policy. Verify both scan and search journeys on a simulator/device before considering the feature complete.

## Data & interface changes

- One new local onboarding document and provider; no backend API changes.
- New route `onboarding`.
- Optional paywall route prop `source: 'onboarding'`; all existing callers may omit it.
- Shared add-plant props remain `{ plant, today }`. Onboarding intent comes from the provider, not a new required screen prop.
- Installation-scoped progress contains no tokens, email, or account identifier. Keep it separate from garden cleanup on sign-out.
- No planned package or router changes.

## Verification

New tests:

- `onboarding/__tests__/storage.test.js`: missing/corrupt records, valid checkpoints, write failure, write ordering, persisted completion.
- `onboarding/__tests__/OnboardingProvider.test.js`: entry policy, Skip/Back, explicit acquisition context, interruption recovery, idempotent completion.
- `screens/onboarding/__tests__/OnboardingScreen.test.js`: exact step copy/actions, progress accessibility, notification allow/deny/error, no permission prompt on Skip.
- `notifications/__tests__/NotificationRouter.test.js`: defer during onboarding, deliver valid target after completion, discard missing target.

Extend existing tests:

- `__tests__/App.test.js`: fresh login → onboarding; restored legacy session/completed installation → Today; billing responses cannot interrupt onboarding.
- `screens/addPlant/__tests__/AddPlantScreen.test.js`: ordinary Done still opens Product; onboarding Done/Close opens paywall; plant/reminders created exactly once; Scan another plant retains context.
- `screens/scan/__tests__/ScanCameraScreen.test.js`, `ScanMatchesScreen.test.js`, and `ScanSearchScreen.test.js`: cancellation and fallback routes preserve onboarding; normal entry behavior remains unchanged.
- `screens/__tests__/PaywallScreen.test.js`: onboarding source works in loaded, loading, and error states; Close completes; purchase failure/cancel does not; ordinary paywall dismissal preserves the originating route.

Run targeted tests while implementing, then the full suite and lint:

```sh
npm test -- --runInBand onboarding screens/onboarding screens/addPlant screens/scan screens/__tests__/PaywallScreen.test.js notifications/__tests__/NotificationRouter.test.js __tests__/App.test.js
npm test -- --runInBand
npm run lint
```

Manual checks: fresh-install sign-in; all four steps; Skip from every step; allow/deny notifications; deny camera then search; select a species; create a room; save reminders; Done → paywall without a Home/Product flash; dismiss paywall → Today with the plant present; relaunch after completion; interrupt before and after saving; ordinary add-plant and room-limit paywall regressions. Check light/dark themes, small screens, keyboard avoidance, and enlarged text. Use StoreKit sandbox/test configuration for purchase verification.

## Acceptance criteria

- [ ] All four screens match the linked Figma copy, layout, and illustration content.
- [ ] Scan and Search reuse the existing acquisition and add-plant screens.
- [ ] Onboarding Done opens the existing paywall directly, with the plant already saved.
- [ ] Ordinary add-plant Done still opens the saved plant's Product page.
- [ ] Skip/cancel/Close have defined destinations and cannot strand users.
- [ ] Automatic launch paywalls and notification taps cannot interrupt onboarding.
- [ ] Closing the onboarding paywall completes onboarding and reaches Today; history cannot reopen the completed wizard.
- [ ] Restarting does not replay completed onboarding or automatically duplicate a saved plant.
- [ ] Billing loading/failure and permission denial remain recoverable.
- [ ] Relevant tests, full regression suite, lint, and device walkthrough pass.

## Risks, assumptions & open questions

- **Recommended product defaults, not verified prototype interactions:** onboarding after login; once per installation; intro Skip → final entry; final Skip → paywall; first-step Back disabled; success Close behaves like Done. These defaults make the plan executable without inventing hidden prototype links.
- **Returning-account limitation:** fresh login versus restored tokens does not identify a new account. Account-level onboarding would require a reliable stable identity and a different persistence policy; it is outside this plan.
- **Notification copy mismatch:** Figma promises quiet hours, while the current preferences expose reminder time and a master switch. Preserve the supplied design in implementation review, but resolve this copy promise before release rather than silently expanding the feature to implement quiet hours.
- **Existing gates:** room limits can legitimately open a paywall before final Done. Preserve entitlement enforcement and ensure these temporary paywalls do not complete onboarding. A requirement to forbid every early paywall would need a separate product decision about those limits.
- **Visual verification remains implementation work:** structured Figma nodes and copy were inspected; exported artwork and rendered native screens still need comparison during execution. Re-fetch the specified nodes if the design changes.
- **Persistence failures:** onboarding completion should remain effective for the current session even if its disk write fails. Record the failure through existing logging conventions; a later launch may replay the unfinished stage. Do not block access to Today on a failed local write.
