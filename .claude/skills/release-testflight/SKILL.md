---
name: release-testflight
description: Bump the app's version and ship a new iOS build to TestFlight via EAS Build. Use this whenever the user wants to cut a release, bump the version, ship, deploy, or push a build to TestFlight/App Store Connect for cultum-ui — including phrasings like "release a new version", "ship this to testflight", "bump to 1.1.0 and deploy", "cut a patch release", or a bare "/release-testflight". Also use it when the user asks why a build did not reach TestFlight, since the diagnosis notes here cover how to confirm what Apple actually received.
---

# Release to TestFlight

Bump the marketing version, commit it, and kick off a production EAS build that
submits to TestFlight when it finishes. Returns the build URL; it does not wait for
the build.

## The version model — read this first

Two different numbers move on every release, and only one of them is yours to set:

- **Marketing version** (`1.0.1` — iOS `CFBundleShortVersionString`). Lives in
  `app.json` (`expo.version`) and `package.json`. **You bump this.** `autoIncrement`
  explicitly does not touch it.
- **Build number** (`10`, `11`, …). `eas.json` sets `appVersionSource: "remote"` with
  `autoIncrement: true` on the production profile, so this lives on EAS's servers and
  increments itself per build. **Never edit it in app.json** — under remote versioning
  any build-number value in app config is ignored, so editing it just misleads the
  next reader.

Apple rejects a build whose (version, buildNumber) pair already exists. Because EAS
increments the build number for you, re-shipping the same marketing version is fine —
which is why a failed *build* can simply be re-run without a version bump.

## Steps

### 1. Preflight: the working tree must be clean

```bash
git status --porcelain
```

Any output means stop and tell the user what is uncommitted. Two reasons this matters:
the release commit should contain the version bump and nothing else, and `eas build`
interactively prompts to commit a dirty tree — a prompt that hangs forever when there
is no terminal attached.

Note the current branch too (`git rev-parse --abbrev-ref HEAD`). Releasing from a
feature branch is allowed, but say which branch you are on in the final report so the
user is not surprised where the release commit landed.

### 2. Bump the version

The bump argument is `patch` (default), `minor`, `major`, or an explicit `X.Y.Z`:

```bash
node .claude/skills/release-testflight/scripts/bump-version.mjs patch
```

This updates `package.json`, `package-lock.json` and `app.json` together and prints
`{"oldVersion":…,"newVersion":…}`. It refuses to run if `package.json` and `app.json`
have drifted apart, because guessing which one is authoritative is exactly the mistake
that ships a build labelled with the wrong version.

### 3. Commit

Match the existing convention in this repo — the subject line is how releases are
found in `git log`:

```bash
git add package.json package-lock.json app.json && git commit -m "$(cat <<'EOF'
chore(release): v<NEW_VERSION>

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

No git tag — this repo does not tag releases.

### 4. Kick off the build

```bash
eas build --platform ios --profile production --non-interactive --no-wait \
  --auto-submit --message "v<NEW_VERSION>"
```

Why these flags:

- `--no-wait` returns as soon as the build is queued. The build itself takes 15–30
  minutes; holding the session open for it buys nothing.
- `--non-interactive` turns any unexpected prompt into a visible error instead of a
  silent hang. It is safe here specifically because the production profile uses
  `credentialsSource: "local"` — with EAS-managed credentials, non-interactive builds
  fail when a distribution certificate needs minting.
- `--auto-submit` is what actually carries the build to Apple. **Nothing submits on
  its own.** There is no server-side auto-submit on this project: `eas.json` defines a
  `submit.production.ios` profile, but a profile only says *how* to submit if asked, it
  never triggers one. A build run without this flag finishes green on EAS and simply
  sits there, never reaching App Store Connect. It pairs fine with `--no-wait` — EAS
  queues the submission server-side and runs it when the build completes.

Capture the build URL from the command output (`https://expo.dev/accounts/.../builds/...`).

### 5. Confirm the submission was queued

The build output ends with the build URL and, when `--auto-submit` took effect, a note
that a submission will follow. Check that it is there. If the output mentions no
submission at all, the flag did not take — say so in the report rather than promising
TestFlight delivery, and follow the manual `eas submit` path below once the build
finishes.

### 6. Report back

Give the user, in a few lines:

- old version → new version, and the branch the release commit is on
- the EAS build URL
- that the commit is local only, and offer to push it — do not push unless they say
  yes. EAS uploads the working copy, so the build is already running with these
  changes; pushing is about the repo's history, not the build.
- that `--auto-submit` will carry the finished build to TestFlight once the build
  completes — and that this is worth *verifying* rather than assuming (see below).
  Do not tell the user the release reached TestFlight; you have only queued it.

## When something goes wrong

**The build fails on EAS.** Open the build URL for logs. Re-running does not need a new
version bump — EAS assigns a fresh build number automatically.

**The build succeeds but nothing appears in TestFlight.** By far the most likely cause
is that the build was started without `--auto-submit`, so no submission was ever
created. A green build on EAS says nothing about Apple having received it — the two are
separate steps.

Ask Apple what it actually has, rather than inferring from EAS:

```bash
eas build:list --platform ios --limit 5
```

That shows build state and build numbers. To see what reached App Store Connect,
open the TestFlight page for the app (`https://appstoreconnect.apple.com/apps/6804433119/testflight/ios`),
or query the API directly with the ASC key in `certs/` — the builds endpoint lists
every binary Apple has, keyed by `CFBundleVersion` (the build number, not the marketing
version).

If the build is missing from Apple, submit it explicitly by EAS build id:

```bash
eas submit --platform ios --profile production --id <BUILD_ID> --non-interactive --wait
```

`--wait` blocks until the binary is uploaded, so a failure is visible immediately
instead of silently. After it returns, the build still takes ~2-10 minutes to appear in
App Store Connect while Apple processes it; it lands in state `VALID`. This path is
verified working — it is how v1.0.4 / build 13 was shipped on 2026-09-04 after builds
12 and 13 both stalled from a missing `--auto-submit`.

A duplicate submit — resubmitting a (version, buildNumber) pair Apple already has —
fails with a generic error that is really Apple's duplicate rejection, and reads like
the release broke when it did not. So check what Apple has *before* submitting, not as
a reason to avoid submitting.

**Credentials errors.** The production profile reads `certs/dist.p12` and
`credentials.json`, both gitignored and local-only. If they are missing on this machine
the build fails late, during the credentials step — see the project's TestFlight notes
for how they were minted against the App Store Connect API.

**A `version`/`buildNumber` mismatch complaint from Apple.** Almost always means the
marketing version was reused *and* the remote build number was reset or overridden.
Confirm the server's view with `eas build:version:get --platform ios` before changing
anything in app config.
