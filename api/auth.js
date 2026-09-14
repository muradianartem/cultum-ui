import { apiFetch } from './client';

// Auth endpoints for the Cultum backend. Thin wrappers over the shared
// apiFetch (which owns base URL, JSON headers, and ApiError on non-2xx).
export const authApi = {
  // Mint a single-use nonce to bind to the sign-in (replay defense). Both the
  // Google and the Apple flow pass it to the provider and the provider echoes
  // it back, unmodified, as the ID token's `nonce` claim.
  createNonce: () => apiFetch('/auth/nonce', { method: 'POST' }),

  // Exchange a Google ID token for app tokens.
  loginGoogle: (idToken) =>
    apiFetch('/auth/google', { method: 'POST', body: JSON.stringify({ id_token: idToken }) }),

  // Exchange an Apple identity token for app tokens. `name` rides along because
  // Apple's identity token carries no name claim and Apple only hands the user's
  // name back on their very first authorization — never again, not even after a
  // reinstall. Send it while we have it so the backend is the thing that
  // remembers it; `null` on every later sign-in.
  loginApple: (idToken, name) =>
    apiFetch('/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken, name: name ?? null }),
    }),

  // Rotate the refresh token for a fresh access token (backend rotates the
  // refresh token too, so callers must persist the whole returned TokenResponse).
  refresh: (refreshToken) =>
    apiFetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  // Best-effort server-side session revoke; returns null (204 no content).
  logout: (refreshToken) =>
    apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),
};
