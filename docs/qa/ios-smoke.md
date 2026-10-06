# iOS device smoke checklist

Run before every TestFlight release, on a physical iPhone. Jest mocks the
filesystem, notifications, SecureStore and StoreKit, so these are the checks
that nothing else covers.

Copy the header and the table into `ios-smoke-results-<YYYY-MM-DD>.md` (the
date of the run) and fill in a result for **every** case:

- **pass** — run on hardware, behaved as expected;
- **fail** — run, and it didn't; write reproducible steps;
- **blocked** — not run; name the missing prerequisite.

A missing prerequisite is always *blocked*, never *pass*.

## Run header

| Field | Value |
|---|---|
| Build | version / build number / commit |
| Install | local dev build (`npm run ios:device`) or TestFlight |
| Device | model |
| iOS | version |
| Account(s) | Google / Apple test accounts used |
| Sandbox tester | yes / no |
| Date | |
| Run by | |

## Prerequisites

- A physical iPhone with a signed build. A local dev build signed with the
  personal team (`plugins/withLocalDevSigning.js`) has **no push entitlement
  and no Sign in with Apple**, so AUTH-2 needs a TestFlight build.
- A Google test account, and an Apple ID for AUTH-2.
- A second account of either kind for AUTH-5.
- For PAY-*: subscription products "Ready to Submit" in App Store Connect and
  a sandbox tester (Settings → App Store → Sandbox Account). PAY-3 needs a
  tester who has already used the intro offer.
- For AUTH-3: waiting out the access token's `expires_in`, or a dev build where
  the stored `expires_at` can be edited (see the simulator-verification notes).
  Don't add a production code path for this.

## Cases

| ID | Case | Steps | Expected |
|---|---|---|---|
| AUTH-1 | Sign in with Google | Fresh install → Continue with Google → pick the test account | Lands on Today (or the paywall on first login) |
| AUTH-2 | Sign in with Apple | Fresh install → Continue with Apple | Same as AUTH-1 |
| AUTH-3 | Cold launch past token expiry, online | Sign in, add a plant, kill the app, wait past expiry (or expire it in a dev build), relaunch online | Still signed in; garden syncs |
| AUTH-4 | Cold launch past expiry, offline | As AUTH-3 but enable Airplane mode before relaunching; then disable it | Still signed in, garden visible offline; after reconnecting, sync resumes |
| AUTH-5 | Account switch | Signed in as A with a plant, a photo, a reminder and (if possible) Plus → Settings → Sign out → sign in as B | No plants, photos, notifications or Plus status from A |
| SYNC-1 | Add offline, then go online | Airplane mode → add a plant → disable Airplane mode → wait → delete and reinstall → sign in | The plant is there once (it got a server id), no duplicate |
| SYNC-2 | Rename right after adding, online | Add a plant, rename it immediately → kill → relaunch | Both the plant and the new name survive |
| NOTIF-1 | Permission and delivery | First plant add → allow notifications → set the reminder time ~2 min ahead → background the app | The reminder is delivered in the background |
| NOTIF-2 | Grant later in iOS Settings | Deny at the prompt → iOS Settings → Cultum → allow → return to the app, change nothing | Reminders are scheduled without another edit |
| NOTIF-3 | Tap from cold start | Kill the app → tap a delivered reminder | Opens the right plant or task |
| NOTIF-4 | Master switch and sign-out | Settings → Notifications → off; separately, sign out with reminders scheduled | Nothing is delivered afterwards |
| PAY-1 | Paywall with the backend unreachable | Build with `EXPO_PUBLIC_API_BASE_URL=https://127.0.0.1:9` (or block the host) → Settings → Upgrade | Error state with Try again and Close (spec 06) |
| PAY-2 | Fresh sandbox tester | Open the paywall → compare with the StoreKit sheet → buy | Price and trial copy match the StoreKit sheet; purchase → Plus |
| PAY-3 | Tester who used the trial | Open the paywall | No trial promised; the CTA reads "Subscribe" |
| PAY-4 | Cancel the StoreKit sheet | Start a purchase → Cancel | Paywall stays open, no error |
| PAY-5 | Relaunch after purchase | Kill → relaunch | Still Plus |
| FB-1 | Send feedback | Settings → Send feedback → topic + message → Email feedback | Mail opens pre-filled (spec 12); no "sent" message |

## Cleanup

- Delete the test plants, and sign out of every test account.
- Reset the reminder time in Settings → Notifications if a case changed it.
- Reset the sandbox tester's purchase history in App Store Connect
  (Users and Access → Sandbox → tester → Clear Purchase History) if PAY-2/3
  need to run again.
