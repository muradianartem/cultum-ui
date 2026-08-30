import { apiFetch } from './client';

// Auth endpoints for the Cultum backend. Thin wrappers over the shared
// apiFetch (which owns base URL, JSON headers, and ApiError on non-2xx).
export const authApi = {
  // Mint a single-use nonce to bind to the Google sign-in (replay defense).
  createNonce: () => apiFetch('/auth/nonce', { method: 'POST' }),

  // Exchange a Google ID token for app tokens.
  loginGoogle: (idToken) =>
    apiFetch('/auth/google', { method: 'POST', body: JSON.stringify({ id_token: idToken }) }),

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
