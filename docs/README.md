# Cultum documentation

Cultum is a plant-care app for iOS. You scan a plant or search for it by name, add it to a room, and Cultum reminds you when to water it, feed it and repot it.

This folder describes the app as it is in **v1.1.4**. Start with the overview, then read the screen page for the area you are working on.

## Contents

| Document | What it covers |
|---|---|
| [Overview](overview.md) | What the app does, the stack, how the code is laid out, how it talks to the backend, and how to run it |
| [Screens](screens/README.md) | The navigation map and one page per screen or flow |
| [Tech decisions](tech-decisions.md) | The architectural choices, why each was made, and what each one costs |

### Screens

| Screen | Route(s) |
|---|---|
| [Login](screens/login.md) | shown before sign-in (not a route) |
| [Onboarding](screens/onboarding.md) | `onboarding` |
| [Today](screens/today.md) | `today`, `snoozed` |
| [Plant page](screens/plant-page.md) | `product` |
| [Edit reminders](screens/reminders.md) | `reminders` |
| [Scan & search](screens/scan.md) | `scan-camera`, `scan-matches`, `scan-search` |
| [Add a plant](screens/add-plant.md) | `add-plant` |
| [Rooms](screens/rooms.md) | `rooms`, `room` |
| [Settings](screens/settings.md) | `settings`, `settings-notifications`, `settings-feedback`, `settings-contact`, `settings-about` |
| [Paywall](screens/paywall.md) | `paywall`, `premium-gallery` |

## Design notes and history

These are the design documents and plans written while each feature was built. They record the reasoning at that point in time. Some parts have been replaced since, and each one marks what has changed. Where one of them disagrees with the pages above, trust the pages above.

| Document | Topic |
|---|---|
| [login-auth-design.md](login-auth-design.md) | Google sign-in, nonces, token storage, the `AuthGate` |
| [auth-paywall-design.md](auth-paywall-design.md) | The Welcome and Paywall frames, StoreKit purchase flow |
| [onboarding-execution-plan.md](onboarding-execution-plan.md) | The four-screen onboarding and its checkpoints |
| [reminders-screen-design.md](reminders-screen-design.md) | Edit Reminders |
| [garden-store-design.md](garden-store-design.md) | The garden store (its offline outbox has been **replaced**; see [Tech decisions](tech-decisions.md#2-the-server-is-the-only-source-of-truth)) |
| [figma-import.md](figma-import.md), [figma-foundations-refactor-plan.md](figma-foundations-refactor-plan.md) | Importing the design system from Figma |
| [development.md](development.md) | Lint, test and release-config checks |
| [qa/ios-smoke.md](qa/ios-smoke.md) | The on-device smoke checklist to run before each TestFlight release |
