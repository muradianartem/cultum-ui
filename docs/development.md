# Development

## Checks

Run all three before opening a PR. CI (`.github/workflows/ci.yml`) runs the same
on every pull request and on pushes to `main`.

| Command | What it does |
|---|---|
| `npm run lint` | ESLint via `expo lint`, configured in `eslint.config.js` (`eslint-config-expo`). |
| `npm test -- --runInBand` | The Jest suite (`jest-expo`). |
| `npm run check:config` | Checks `app.json` for an iOS release: an `https://` API URL, a real Google iOS client id, a bundle identifier. Warns on the dev backend and on a `package.json` / `app.json` version mismatch. Use `node scripts/check-release-config.js --platform android` for Android. |

The `release-testflight` skill should run `npm run check:config` before building.

## API base URL

Decided in one place, `lib/config.js`: `EXPO_PUBLIC_API_BASE_URL` wins, then
`app.json` → `expo.extra.apiBaseUrl`, then the dev backend as a last resort.
