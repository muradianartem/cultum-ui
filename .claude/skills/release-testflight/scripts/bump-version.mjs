#!/usr/bin/env node
// Bump the marketing version across package.json, package-lock.json and app.json.
//
// npm owns package.json + package-lock.json (both the top-level "version" and the
// packages."" copy), so we let `npm version` do that rather than hand-editing JSON.
// app.json is patched with a targeted regex instead of JSON.stringify so the file's
// formatting and its missing trailing newline survive untouched — a reformatted
// app.json turns a one-line release commit into a noisy diff.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const bump = process.argv[2] ?? "patch";
const valid = /^(patch|minor|major|\d+\.\d+\.\d+)$/;
if (!valid.test(bump)) {
  console.error(`Invalid bump "${bump}". Use patch, minor, major, or an explicit X.Y.Z.`);
  process.exit(1);
}

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const pkgPath = join(root, "package.json");
const appPath = join(root, "app.json");

const oldVersion = JSON.parse(readFileSync(pkgPath, "utf8")).version;
const appRaw = readFileSync(appPath, "utf8");

// One "version" key is expected: expo.version. If app.json ever grows another,
// stop rather than silently rewriting the wrong one.
const versionLine = /^(\s*"version":\s*")([^"]+)(")/m;
const matches = appRaw.match(/^\s*"version":\s*"[^"]+"/gm) ?? [];
if (matches.length !== 1) {
  console.error(`Expected exactly one "version" key in app.json, found ${matches.length}. Bump it by hand.`);
  process.exit(1);
}

const appVersion = appRaw.match(versionLine)[2];
if (appVersion !== oldVersion) {
  console.error(`Version drift: package.json is ${oldVersion} but app.json is ${appVersion}.`);
  console.error("Reconcile them first — the App Store reads app.json, npm reads package.json.");
  process.exit(1);
}

// npm is a .cmd shim on Windows — execFileSync cannot resolve it from the bare
// name the way it resolves git.exe, and since CVE-2024-27980 Node refuses to
// spawn a .cmd without a shell at all (EINVAL). Both are needed, and only
// there. `bump` is regex-validated above, so the shell has nothing to
// reinterpret.
const isWindows = process.platform === "win32";
execFileSync(isWindows ? "npm.cmd" : "npm", ["version", bump, "--no-git-tag-version"], {
  cwd: root,
  stdio: "pipe",
  shell: isWindows,
});

const newVersion = JSON.parse(readFileSync(pkgPath, "utf8")).version;
writeFileSync(appPath, appRaw.replace(versionLine, `$1${newVersion}$3`));

console.log(JSON.stringify({ oldVersion, newVersion }, null, 2));
