# Google Play store listing — Cultum

Copy and checklist for the Play Console product page (Grow → Store presence →
Main store listing) and the setup pages a release needs. Paste fields as-is;
character limits are Google's.

## App details

| Field | Value |
|---|---|
| App name (≤30) | `Cultum: Plant Care & Identify` (29) |
| Package name | `com.cultum.ui` (from `app.json`, cannot change after first upload) |
| Default language | English (United States) – en-US |
| App or game | App |
| Free or paid | Free (Cultum Plus is an in-app subscription) |
| Category | House & Home |
| Tags | Gardening, Plants, Home improvement |
| Contact email | `support@cultum.app` (saved in Store settings) |
| Website | https://www.cultum.app (saved in Store settings) |
| Privacy policy | https://cultum.app/privacy |

## Short description (≤80)

```
Identify houseplants by photo and get smart watering reminders for every plant.
```
(79 characters)

## Full description (≤4000)

**Live in Play Console (saved draft, 2,187 characters).** Play Console holds
the current text. It says "gallery" for picked photos, and the Cultum Plus
paragraph says subscriptions are billed and cancelled through Google Play. The
terms and privacy links are at the end.

Earlier draft, superseded:

```
Smart care for happy plants.

Cultum helps you keep every plant alive. Snap a photo, find out what it is, and get a care schedule built for it. Cultum then reminds you every time a plant needs you — watering, feeding, and more.

SCAN TO IDENTIFY
Point your camera at a plant, or pick a photo from your gallery. Cultum identifies it and tells you when it isn't sure, so you never follow care advice meant for a different plant.

YOUR GARDEN, ORGANIZED
Add plants to your garden and group them by room. See at a glance what needs attention today.

REMINDERS THAT FIT YOUR PLANTS
Each plant gets its own care schedule. Cultum sends a notification when it's time — no spreadsheets, no guessing.

CARE GUIDES
Light, water, and growing tips for thousands of species, ready the moment you add a plant.

CULTUM PLUS
Upgrade for more daily scans and the full Cultum experience. Start with a free trial; cancel anytime in Google Play.

Sign in with Google or email. Your garden syncs across your devices.

Questions or ideas? Write to us at <support email> — we read everything.
```

> Before publishing: confirm "thousands of species", rooms, and sync match
> what ships in this build, and fill in the support email. Remove any line
> the release doesn't support — Google rejects listings that overstate features.

## Graphics

| Asset | Spec | Source |
|---|---|---|
| App icon | 512×512 PNG, 32-bit, ≤1 MB | export from `assets/icon.png` |
| Feature graphic | 1024×500 JPG/PNG, no alpha | **to make** — logo + headline on `#93EC7C`/`#EBFCE5` |
| Phone screenshots | 2–8, 16:9 or 9:16, 1080×1920 recommended | **to capture**: Scan, Identification result, Garden, Today/Reminders, Plant care guide, Paywall |
| 7" / 10" tablet screenshots | optional (needed for tablet featuring) | — |

## Policy pages to complete before the first release

These live under **Policy → App content** and block publishing until done:

- [x] **Privacy policy** — saved: https://www.cultum.app/privacy
- [x] **Advertising ID** — saved: no (no AD_ID permission in the manifest)
- [x] **Government apps / Financial features / Health apps** — saved: no / none / none
- [x] **Content ratings** — saved: All Other App Types, online content yes, digital purchases yes. Rated ESRB Everyone, PEGI 3, USK all ages and 3+ elsewhere; ClassInd (Brazil) gave 14+.
- [ ] **App access** — reviewers need a way in past sign-in: provide a test account (email + password) with instructions
- [ ] **Ads** — No, the app does not contain ads
- [ ] **Content rating** — IARC questionnaire (Utility/Productivity; no violence, user content shared, etc. → expect "Everyone")
- [x] **Target audience** — saved: 13–15, 16–17, 18 and over (matches the privacy policy's 13+ minimum)
- [x] **Ads** — saved: no ads
- [x] **Sign in details** — saved: a reviewer Google account. It must have no 2-step verification. It is a Play license tester: it's in the "Testers" email list, which is ticked under Manage developer account → License testing.
- [ ] **Data safety** — saved as a draft in Play Console. It can't be submitted
  until Target audience and content is done. Answers come from cultum.app/privacy:
  - Encrypted in transit: yes. Account creation: OAuth (Apple, Google).
  - Delete account URL: https://www.cultum.app/privacy#delete.
    Partial deletion: yes, at https://www.cultum.app/privacy#rights.
  - No data is shared. Pl@ntNet, Azure, Apple and Google are treated as
    service providers.
  - None of the data is processed ephemerally.

  | Data type | Required/optional | Purposes |
  |---|---|---|
  | Name | Required | App functionality, Account management |
  | Email address, User IDs | Required | App functionality, Account management, Fraud prevention |
  | Purchase history | Optional | App functionality, Account management |
  | Photos | Optional | App functionality (identification, and keeping photos to improve it) |
  | App interactions (plan usage counts) | Required | App functionality |
  | Other user-generated content (garden, rooms, reminders) | Required | App functionality |
  | Diagnostics (server logs) | Required | App functionality, Fraud prevention |

  No push tokens, analytics, crash SDKs or location are collected. Reminders
  are local notifications.
- [ ] **Government apps / Financial features / Health** — No
- [ ] **Photo and video permissions** — the app uses `expo-image-picker`; if the build requests `READ_MEDIA_IMAGES`, justify it or switch to the system photo picker (Google now rejects broad photo access for one-off picks)
- [ ] **Notifications** — `POST_NOTIFICATIONS` for care reminders

## Monetization

- [x] Cultum Plus subscriptions exist under **Monetize → Subscriptions** (created Oct 28, 2026), with IDs matching the app and API: `cultum_plus_monthly` (1 active base plan) and `cultum_plus_yearly` (1 active base plan, 1 offer)
- [ ] Payments profile set up on the developer account

## Developer account

- [x] Trader status declared as **Trader** in Account details. The legal name and address come from the Google payments profile and are shown publicly to EU users.

## Release prerequisites in the repo

- `app.json` → `expo.name` changed from `cultum-ui` to `Cultum` (the launcher label under the icon). First used for the v1.1.9 Android build, versionCode 5 (EAS build 94c9d59d).
- `app.json` → `extra.apiBaseUrl` stays on the **dev** Azure container app, the same as iOS. There is no production backend yet. The dev backend has `GOOGLE_PACKAGE_NAME` and the Play service account set, so it can verify Play purchases.
- **Data safety needs updating:** since v1.1.9 the app sends PostHog analytics (EU host). It records screen views and app lifecycle events, and identifies signed-in users by user ID. The answers above don't cover this. Add App interactions → Analytics and User IDs → Analytics, and list PostHog in the privacy policy.
- `eas.json` has no `submit.production.android` block. To upload with `eas submit`, add a Google Play service account key and `"track": "internal"`.
- First upload must be an AAB (`eas build -p android --profile production`); new personal developer accounts must also run a **closed test with 12+ testers for 14 days** before production access is granted.
