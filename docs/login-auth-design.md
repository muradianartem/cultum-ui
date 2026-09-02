# Login screen + Google SSO wiring

## Summary
Add a real **Login screen** as the app's pre-auth entry point: a full-bleed background photo with a scrim, the Cultum logo/title, and two buttons — **Continue with Google** (fully wired to the backend) and **Continue with Apple** (shows a "coming soon" snackbar only). Google sign-in uses `expo-auth-session` to obtain a Google **ID token** bound to a server-minted **nonce**, exchanges it at `POST /auth/google` for app tokens, persists them (SecureStore on native, `localStorage` on web), and flips the app from the login screen to the existing `today` screen. Auth state lives in a new `AuthProvider`; an `AuthGate` at the app root chooses login vs. the router.

## Goal & non-goals
**Goal:** A user lands on a branded login screen, taps *Continue with Google*, completes Google's sign-in, and arrives on the Today screen authenticated, with tokens stored and reused on next launch. Apple is visibly present but deferred with a snackbar.

**Non-goals:**
- **Apple Sign In** — no real wiring. Button shows a "coming soon" snackbar. `POST /auth/apple` stays unused this pass.
- **Token refresh / auto-refresh on 401** — `POST /auth/refresh` is *implemented in the API client* but the app does **not** yet auto-refresh expired access tokens or attach `Authorization` headers to feature requests (there are no authenticated feature calls yet). V2.
- **Sign-out UI** — `AuthProvider` exposes `signOut()` and it clears storage, but wiring a visible logout control into TabBar/settings is out of scope.
- **Real backend session use** — nothing in Today/Product screens consumes the tokens yet; this pass only establishes and stores the session.
- **Wiring `routing/guards.js#requireAuth`** — the gate is done at the app root via `AuthGate` (see Decisions), not through the pure-function guard. Leave `requireAuth` as-is.
- **Designing the login visuals in Figma** — no Figma node was provided; the screen is composed from existing primitives and tokens with a sensible layout. Treat the layout as adjustable.
  > **Resolved.** A design now exists — "Auth / Welcome", node `250:8` in the app-design file `4jmjNlaM7IRpCOogYRJMks` — and `screens/LoginScreen.js` was rebuilt against it. The layout described in this doc is superseded; see [auth-paywall-design.md](auth-paywall-design.md). The Google/nonce flow below is unchanged and still current.

## Context
Grounded in the current tree (Expo SDK 57, RN 0.86, plain JS, no TypeScript — see [AGENTS.md](AGENTS.md), which mandates reading https://docs.expo.dev/versions/v57.0.0/ before writing code).

- **Entry / routing:** [App.js](App.js) wraps everything in `SafeAreaProvider` → `ThemeProvider` → `Router` (the custom minimal navigator in [routing/](routing/index.js)). `<Router initial="today">` currently boots straight into [screens/TodayScreen.js](screens/TodayScreen.js). Routes are declared as `<Route name=... component=... />`. There is **no auth today**; [routing/guards.js](routing/guards.js) has `requireAuth`/`requireSubscription` as always-allow `console.log` stubs.
- **Theming:** Screens read colors from `useTheme()` ([theme/ThemeProvider.js](theme/ThemeProvider.js), resolves the `{light,dark}` semantic tokens in [theme/colorTokens.js](theme/colorTokens.js)) and take geometry/type from [theme/foundations.js](theme/foundations.js) (`radius`, `space`, `typography`). This is the pattern [screens/TodayScreen.js](screens/TodayScreen.js) follows: `const t = useTheme(); const styles = useMemo(() => makeStyles(t), [t]);`. **Primitives** in `components/` still import the older flat [theme/tokens.js](theme/tokens.js) — don't touch that split.
- **Primitives available** (barrel [components/index.js](components/index.js)): `Button`, `TextButton`, `Snackbar`, `Icon`, plus others. 
  - [components/Button.js](components/Button.js): `<Button label onPress variant="primary|secondary|outline|ghost" size="lg|md|sm" leftIcon loading disabled fullWidth />`. Themed via `useTheme()`. `fullWidth` defaults true.
  - [components/Snackbar.js](components/Snackbar.js): renders the dark pill only — **positioning and auto-timeout are the caller's job** (`<Snackbar label icon action onDismiss />`).
  - [components/Icon.js](components/Icon.js): `<Icon name size color />`. The brand logos **`google`** and **`apple`** exist in the registry and keep their own colors (they ignore `color`). Confirmed: `assets/icons/google.svg`, `assets/icons/apple.svg`.
- **Background image:** `assets/plant/hero.png` exists (a large plant hero) and is a usable placeholder. `expo-linear-gradient` (~57.0.1) is **already a dependency** — use it for the scrim.
- **No existing** `lib/`, `api/`, `config/`, or auth modules. `expo-constants`, `expo-auth-session`, `expo-crypto`, `expo-web-browser`, `expo-secure-store` are **not installed**.
- **Verification loop:** `.claude/launch.json` runs `expo start --web` on port **8090**; the team verifies on expo-web. Tests: `jest-expo` (`npm test`), specs live in `screens/__tests__/` and `components/__tests__/`.

### The backend auth contract (verified against the live OpenAPI)
Base: `https://ca-cultum-dev-cac.redsand-9719b340.canadacentral.azurecontainerapps.io`. All auth routes are `POST`, JSON. `servers` is absent from the spec, so the base URL must be configured by us.

| Endpoint | Request body | Success | Notes |
|---|---|---|---|
| `/auth/nonce` | *(empty)* | `200 NonceResponse { nonce: string, expires_in: int }` | "Mint a single-use nonce to pass to the sign-in SDK… The nonce is burned on first use, so a captured token cannot be replayed." |
| `/auth/google` | `GoogleLoginRequest { id_token: string }` *(required)* | `200 TokenResponse` | `422 HTTPValidationError` on bad body |
| `/auth/apple` | `AppleLoginRequest { id_token: string, name?: string\|null }` | `200 TokenResponse` | **not used this pass** |
| `/auth/refresh` | `RefreshRequest { refresh_token: string }` | `200 TokenResponse` | client method only |
| `/auth/logout` | `RefreshRequest { refresh_token: string }` | `204` no content | client method only |

`TokenResponse = { access_token: string, refresh_token: string, token_type: string="bearer", expires_in: int }`.

**The intended flow** (from the `/auth/nonce` description): `POST /auth/nonce` → hand `nonce` to Google's sign-in → Google returns an ID token whose `nonce` claim equals that value → `POST /auth/google { id_token }` → `TokenResponse`. The nonce is the replay defense, so **we must pass the server's nonce to Google, not a locally generated one.**

## Approach & decisions

- **Decision — Google auth library: `expo-auth-session` (chose over `@react-native-google-signin/google-signin`).** The native library does **not** run on web and needs a config plugin + native rebuild; this project's whole verification loop is expo-web (port 8090), and the primitives/screens are all validated there. `expo-auth-session` runs on web, iOS, Android, Expo Go, and dev builds, and supports the OIDC ID-token flow with a custom nonce — exactly what `/auth/google` needs. The Expo docs note a soft recommendation toward provider SDKs, but for *this* codebase's cross-platform verification the portable path wins. (If the team later drops web and wants Google One-Tap UX, swapping to the native lib is a contained change behind `AuthProvider.signInWithGoogle`.)
- **Decision — auth gating: an `AuthGate` at the app root (chose over wiring `routing/guards.js#requireAuth`).** Auth status is async and lives in React state/context; the router's guards are **pure synchronous `(context) => boolean`** functions with no access to context/hooks. Rather than distort that primitive, render login vs. router at the root based on `AuthProvider` status. The router stays untouched and `initial="today"` still holds (the router only mounts once authenticated). `requireAuth` can be revisited later if we need per-route gating.
- **Decision — token storage: `expo-secure-store` on native, `localStorage` on web, behind one `authStorage` wrapper.** SecureStore has **no web implementation** (SDK 57 docs), and web is the primary verify target, so a `Platform.OS === 'web'` branch to `localStorage` (with an in-memory fallback) keeps the loop working. All callers use the wrapper, never SecureStore directly.
- **Decision — config via `app.json > expo.extra` read through `expo-constants`.** Keeps the API base URL and Google client IDs out of code and available at runtime via `Constants.expoConfig.extra`. No secret values here are truly secret (public OAuth client IDs + a public API URL), so committing dev values is acceptable; note where to override.
- **Decision — nonce is minted per attempt and passed as the OIDC `nonce`.** The Login screen fetches a fresh nonce (on mount and after each attempt, since it's single-use/expiring) and feeds it to the `AuthRequest`. **This is the load-bearing correctness detail** — see Risks.

## Implementation plan

Do these in order; the tree stays runnable throughout (nothing is imported until its dependency exists).

### 1. Install dependencies
```bash
npx expo install expo-auth-session expo-crypto expo-web-browser expo-secure-store expo-constants
```
`expo-crypto` is a required peer of `expo-auth-session`; `expo-web-browser` provides `maybeCompleteAuthSession()`. Use `expo install` (not `npm install`) so versions match SDK 57.

### 2. Config — `app.json` + `lib/config.js`
- Add to `app.json` under `expo`: a top-level `"scheme": "cultum"` (needed for the native OAuth redirect URI), and into `expo.extra` (keep the existing `eas` key):
  ```json
  "extra": {
    "eas": { "projectId": "4814abf4-2c89-490f-a0f2-c4619d600b82" },
    "apiBaseUrl": "https://ca-cultum-dev-cac.redsand-9719b340.canadacentral.azurecontainerapps.io",
    "googleWebClientId": "REPLACE_WITH_WEB_CLIENT_ID.apps.googleusercontent.com",
    "googleIosClientId": "REPLACE_WITH_IOS_CLIENT_ID.apps.googleusercontent.com",
    "googleAndroidClientId": "REPLACE_WITH_ANDROID_CLIENT_ID.apps.googleusercontent.com"
  }
  ```
- Create `lib/config.js`:
  ```js
  import Constants from 'expo-constants';
  const extra = Constants.expoConfig?.extra ?? {};
  export const API_BASE_URL = extra.apiBaseUrl;
  export const GOOGLE_CLIENT_IDS = {
    web: extra.googleWebClientId,
    ios: extra.googleIosClientId,
    android: extra.googleAndroidClientId,
  };
  ```
  Adding `scheme` changes native config → a native dev-build rebuild is required before testing Google on device (web is unaffected).

### 3. API client — `lib/api.js`
A tiny `fetch` wrapper. No dependency on React.
- `async function request(path, body)` — `POST ${API_BASE_URL}${path}` with `Content-Type: application/json`, `body: JSON.stringify(body ?? {})`. On non-2xx, throw an `Error` carrying `status` and the parsed body (so callers can distinguish 422). For `204`, return `null` (don't parse JSON).
- Export `authApi` with:
  - `createNonce(): Promise<{ nonce: string, expires_in: number }>` → `request('/auth/nonce')`
  - `loginGoogle(idToken: string): Promise<TokenResponse>` → `request('/auth/google', { id_token: idToken })`
  - `loginApple(idToken, name?): Promise<TokenResponse>` → `request('/auth/apple', { id_token: idToken, name })` *(defined, unused this pass)*
  - `refresh(refreshToken): Promise<TokenResponse>` → `request('/auth/refresh', { refresh_token: refreshToken })` *(defined, unused)*
  - `logout(refreshToken): Promise<null>` → `request('/auth/logout', { refresh_token: refreshToken })`

`TokenResponse` shape: `{ access_token, refresh_token, token_type, expires_in }`.

### 4. Token storage — `lib/authStorage.js`
Platform-aware persistence for the `TokenResponse`. Store under one key, e.g. `cultum.auth.tokens`, as JSON.
- On native (`Platform.OS !== 'web'`): `expo-secure-store` `setItemAsync/getItemAsync/deleteItemAsync`.
- On web: `window.localStorage`. Guard for its absence (SSR/tests) with an in-memory object fallback so calls never throw.
- API:
  - `saveTokens(tokens: TokenResponse): Promise<void>`
  - `loadTokens(): Promise<TokenResponse | null>`
  - `clearTokens(): Promise<void>`

### 5. Auth context — `auth/AuthProvider.js`
A context provider holding session state and the sign-in orchestration that does **not** need the auth-request hook.
- State: `status: 'loading' | 'signedOut' | 'signedIn'`, `tokens: TokenResponse | null`.
- On mount: `loadTokens()` → if present set `signedIn` + tokens, else `signedOut`.
- Exposed via `useAuth()`:
  - `status`, `tokens`
  - `completeGoogleLogin(idToken: string): Promise<void>` — calls `authApi.loginGoogle(idToken)`, `saveTokens(...)`, sets `signedIn`. Throws on failure (caller shows error).
  - `signOut(): Promise<void>` — best-effort `authApi.logout(tokens.refresh_token)` (ignore its errors), then `clearTokens()`, set `signedOut`.
- Keep the Google **ID-token acquisition** (the `useAuthRequest` hook) out of here — it lives in the Login screen (hooks must run in the rendering component). `AuthProvider` only owns the *exchange + persistence*.

### 6. App root wiring — `App.js` + a small `AuthGate`
- Wrap the tree: `SafeAreaProvider` → `ThemeProvider` → **`AuthProvider`** → `AuthGate`.
- `AuthGate` reads `useAuth().status`:
  - `'loading'` → render a minimal centered `LoadingIndicator` (or `null`) on a themed background.
  - `'signedOut'` → render `<LoginScreen />`.
  - `'signedIn'` → render the existing `<Router initial="today"> … </Router>` block (unchanged routes).
- Keep the `<StatusBar style="light" />`. `AuthGate` can be defined inline in `App.js` or as `auth/AuthGate.js`.

### 7. Login screen — `screens/LoginScreen.js`
Follows the TodayScreen pattern (`useTheme()` + `useMemo(makeStyles)` + `foundations`). Layout, top→bottom:
- **Background:** `<ImageBackground source={require('../assets/plant/hero.png')} style={StyleSheet.absoluteFill} resizeMode="cover">`, with a `<LinearGradient>` (from `expo-linear-gradient`) scrim over it — e.g. transparent → dark at the bottom — so the buttons/logo read against any photo. Respect safe-area insets (`useSafeAreaInsets`).
- **Brand block:** the app name/logo and a short tagline near center/lower third (use `typography.display` / `headingMedium`; text color light against the scrim — a fixed light token is fine here since it sits on a photo).
- **Actions (bottom):**
  - **Google:** `<Button label="Continue with Google" leftIcon={<Icon name="google" size={20} />} onPress={onGooglePress} loading={busy} />`.
  - **Apple:** `<Button variant="secondary" label="Continue with Apple" leftIcon={<Icon name="apple" size={20} />} onPress={showAppleComingSoon} />`.
- **Google flow (in this component):**
  - `WebBrowser.maybeCompleteAuthSession()` at module top (required so the web popup closes).
  - Google OIDC discovery: `const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');` (or the static discovery doc).
  - `const [nonce, setNonce] = useState(null);` and a `refreshNonce()` that calls `authApi.createNonce()` and sets `nonce`. Call it in a `useEffect` on mount.
  - Build the request:
    ```js
    const redirectUri = AuthSession.makeRedirectUri({ scheme: 'cultum' });
    const [request, response, promptAsync] = AuthSession.useAuthRequest(
      {
        clientId: Platform.select({ web: GOOGLE_CLIENT_IDS.web, ios: GOOGLE_CLIENT_IDS.ios, android: GOOGLE_CLIENT_IDS.android, default: GOOGLE_CLIENT_IDS.web }),
        redirectUri,
        responseType: AuthSession.ResponseType.IdToken,
        scopes: ['openid', 'profile', 'email'],
        extraParams: nonce ? { nonce } : undefined,
      },
      discovery
    );
    ```
    **The `nonce` must equal the server's minted value** and must be the OIDC nonce echoed into the id_token. If `AuthRequest` also auto-generates a nonce, override it so the server's value wins (verify — see Risks). The request is only usable once `nonce` and `discovery` are set (`disabled` the Google button while `!request || !nonce`).
  - `onGooglePress`: `await promptAsync()`.
  - `useEffect` on `response`: on `response?.type === 'success'`, read `const idToken = response.params.id_token;` then `await auth.completeGoogleLogin(idToken)` (guarded by a `busy` flag). On success `AuthGate` re-renders into the router automatically — no manual navigation needed. On `error`/`dismiss`, clear `busy` and `refreshNonce()` (the old nonce may be spent). On thrown exchange error, show a snackbar ("Couldn't sign in. Try again.").
- **Snackbar host (Apple + errors):** local state `const [snack, setSnack] = useState(null);`. `showAppleComingSoon` sets `{ label: 'Apple Sign In is coming soon' }`. Render, when `snack`, an absolutely-positioned `<Snackbar label={snack.label} onDismiss={() => setSnack(null)} />` above the safe-area bottom inset, and auto-dismiss with a `setTimeout(..., 3000)` in a `useEffect` keyed on `snack` (clear the timer on cleanup). This mirrors how Snackbar is meant to be driven (caller owns timing).

### 8. Tests — `screens/__tests__/LoginScreen.test.js` (+ helpers)
Mock the async/native edges (see Verification) and assert the screen renders both buttons and that Apple shows the snackbar. Keep the existing `__tests__/App.test.js` green (it mocks `react-native-safe-area-context`; it will now also need `AuthProvider`'s async storage mocked to resolve `signedOut`).

## Data & interface changes
- **`app.json`** — add `expo.scheme = "cultum"` and the `expo.extra` keys above (API URL + Google client IDs). Native config change → dev-build rebuild for on-device testing.
- **New modules:** `lib/config.js`, `lib/api.js`, `lib/authStorage.js`, `auth/AuthProvider.js` (`useAuth`), optional `auth/AuthGate.js`, `screens/LoginScreen.js`.
- **`App.js`** — inserts `AuthProvider` + `AuthGate`; the `Router`/`Route` block is unchanged and now only mounts when `signedIn`.
- **New deps** in `package.json`: `expo-auth-session`, `expo-crypto`, `expo-web-browser`, `expo-secure-store`, `expo-constants`.
- No changes to `theme/*`, `routing/*`, or existing screens/components.

## Verification
- **Unit (`npm test`):**
  - `lib/api.js`: mock `global.fetch`; assert `createNonce`/`loginGoogle` hit the right path + body and that a non-2xx throws with `status`.
  - `lib/authStorage.js`: on web path, round-trip through a mocked `localStorage`; assert `clearTokens` empties it.
  - `AuthProvider`: mock `authStorage` — with no stored tokens resolves `signedOut`; with tokens resolves `signedIn`; `completeGoogleLogin` (mock `authApi.loginGoogle`) saves + flips to `signedIn`.
  - `LoginScreen`: mock `expo-auth-session` (return `[request, null, promptAsync]`), `expo-web-browser`, `expo-linear-gradient`, and `authApi`. Assert both buttons render; pressing Apple renders the "coming soon" `Snackbar`.
  - Ensure `__tests__/App.test.js` still passes (add the `authStorage` mock so `AuthProvider` settles to `signedOut` → LoginScreen renders).
- **Manual on web (primary loop):** start the port-8090 preview; the Login screen should render over the hero with both buttons. With real Google **web** client ID + the API URL, *Continue with Google* opens Google, and on completion the app lands on Today. Check `read_console_messages`/`read_network_requests` for the `/auth/nonce` then `/auth/google` calls returning 200. Reload → should stay on Today (tokens rehydrated from `localStorage`).
- **Manual on device (secondary):** after `npm run ios:device` rebuild (needed for the new `scheme` + native modules), same flow using the iOS client ID; tokens persist via SecureStore across launches.

## Acceptance criteria
- [ ] Fresh launch (no stored tokens) shows the Login screen with a background photo, a Google button, and an Apple button.
- [ ] Tapping **Apple** shows a "coming soon" snackbar that auto-dismisses; no network call is made.
- [ ] Tapping **Google** performs `/auth/nonce` → Google sign-in (nonce-bound id_token) → `/auth/google`, receives a `TokenResponse`, and the app transitions to the Today screen.
- [ ] Tokens are persisted (localStorage on web / SecureStore on native) and a relaunch skips login, landing directly on Today.
- [ ] A failed/cancelled Google attempt returns to Login with the button re-enabled and a fresh nonce for the next try (no crash).
- [ ] `npm test` passes, including a new `LoginScreen` test and the updated `App` test.
- [ ] `theme/`, `routing/`, and existing screens/components are unchanged except for `App.js`'s root wrapping.

## Risks, assumptions & open questions
- **Risk (highest) — nonce ↔ id_token binding.** The whole point of `/auth/nonce` is that the id_token's `nonce` claim matches the server value. `expo-auth-session` may inject its own nonce for ID-token requests; if both are set, the server's must win. **Verify at runtime:** decode the returned `response.params.id_token` (middle segment, base64) and confirm its `nonce` claim equals the value from `/auth/nonce`, and that `/auth/google` returns 200. If `extraParams.nonce` doesn't take, set the request's `nonce` field explicitly / disable auto-generation. This is the one detail most likely to fail on first build and can't be validated without live Google + backend.
- **Google OAuth client IDs — source confirmed (no new setup):** a Google OAuth client **already exists** for this backend (it's what `/auth/google` validates against). The web (+ iOS/Android) client IDs come from the backend team and drop into `app.json > expo.extra`. The screen and flow can be built and unit-tested with placeholders; end-to-end Google sign-in works once the real IDs are in. **Critical:** the id_token's `aud` (audience) claim must equal the client ID the **backend** checks — so the app must use *that same* client ID (per platform). When collecting the IDs, confirm with the backend which client ID(s) its `/auth/google` accepts as a valid audience, and register the redirect URIs (web origin + `cultum://`) on that client.
- ~~**Open question (non-blocking):** the **background image**~~ — **resolved:** the Figma frame supplies a 12-photo mosaic, exported to `assets/auth/mosaic-*.png`, plus the final wordmark and tagline copy. `assets/plant/hero.png` is no longer used by the login screen.
- **Assumption:** the API accepts an `Origin`/CORS from the expo-web dev origin (`http://localhost:8090`). If `/auth/*` calls fail CORS on web, test the flow on device instead, or the backend must allow the dev origin. Flag to backend owners.
- **Assumption:** `expo-web-browser`'s `maybeCompleteAuthSession()` + `makeRedirectUri({ scheme: 'cultum' })` yields a redirect URI registered in the Google client. The **exact redirect URIs** (web origin and the `cultum://` native URI) must be added to the Google OAuth client's allowed list — part of the client-ID setup above.
- **Assumption:** deferring token refresh is acceptable for V1 since no screen makes authenticated calls yet. When feature calls arrive, add `Authorization: Bearer <access_token>` + a 401→`authApi.refresh` retry in `lib/api.js`.
