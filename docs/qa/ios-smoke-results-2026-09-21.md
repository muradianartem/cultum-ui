# iOS smoke results — 2026-09-21

**Nothing was run on hardware.** This run was attempted by an agent (Claude
Code) that can only drive iOS *simulators*. An iPhone 16 Pro was paired with
the Mac, but every case needs hands on the device (signing in, Airplane mode,
killing the app, iOS Settings, StoreKit sheets), so all cases are **blocked**.
The next person with the phone should run the checklist ([ios-smoke.md](ios-smoke.md))
and replace this file's results.

| Field | Value |
|---|---|
| Build | 1.1.1, no build installed for this run; branch `feat/paywall-reminders-notifications` @ `43b74a2` (specs 06–13) |
| Install | none |
| Device | iPhone 16 Pro (iPhone17,1), paired but not operated |
| iOS | not recorded |
| Account(s) | none |
| Sandbox tester | none |
| Date | 2026-09-21 |
| Run by | Claude Code (agent) |

| ID | Result | Notes / blocker |
|---|---|---|
| AUTH-1 | blocked | Needs an operator on the device and a Google test account |
| AUTH-2 | blocked | Needs a TestFlight build (local dev signing strips Sign in with Apple) and an Apple ID; Apple Sign In also still needs the portal capability and backend key (project notes) |
| AUTH-3 | blocked | Needs an operator, and waiting out token expiry or a dev build with an editable `expires_at` |
| AUTH-4 | blocked | Needs an operator to toggle Airplane mode and relaunch |
| AUTH-5 | blocked | Needs an operator and two test accounts |
| SYNC-1 | blocked | Needs an operator (Airplane mode, reinstall, sign-in) |
| SYNC-2 | blocked | Needs an operator |
| NOTIF-1 | blocked | Needs an operator; local dev builds carry no push entitlement, but local notifications should still work there |
| NOTIF-2 | blocked | Needs an operator in iOS Settings |
| NOTIF-3 | blocked | Needs an operator and a delivered notification |
| NOTIF-4 | blocked | Needs an operator and time for delivery to (not) happen |
| PAY-1 | blocked | Needs an operator and a build pointed at an unreachable API |
| PAY-2 | blocked | Needs App Store Connect subscription products and a fresh sandbox tester |
| PAY-3 | blocked | Needs a sandbox tester who has already used the intro offer |
| PAY-4 | blocked | Needs StoreKit products and a sandbox tester |
| PAY-5 | blocked | Depends on PAY-2 |
| FB-1 | blocked | Needs an operator and a Mail account on the device |
