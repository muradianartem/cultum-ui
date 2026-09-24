// The caller's own account: read it, mark onboarding shown, delete it.

import { apiFetch } from './client';

/**
 * DELETE /users/me → AccountDeletedResponse
 * `{ deleted, store_subscription_active, store, message }`
 *
 * The backend answers 200 with a body rather than 204 on purpose, and its own
 * comment says why: "A subscription bought in a store keeps renewing after the
 * account is gone — only the user can cancel it — and a user who is not told
 * that keeps paying for an app they deleted."
 *
 * So `message` is not decoration. Show it before signing the user out.
 */
export async function deleteAccount() {
  return apiFetch('/users/me', { method: 'DELETE' });
}

/**
 * GET /users/me → MeOut
 * `{ id, email, name, timezone, onboarding_shown, onboarding_shown_at }`
 *
 * The backend documents it as a pure read of the row the token already
 * resolved to, safe to call on launch. Read right after sign-in: its
 * `onboarding_shown` decides whether the app opens on onboarding.
 */
export async function getMe({ timeoutMs } = {}) {
  return apiFetch('/users/me', timeoutMs ? { timeoutMs } : undefined);
}

/**
 * PATCH /users/me `{ onboarding_shown }` → MeOut
 *
 * `true` is idempotent on the server and keeps the first timestamp, so a
 * retry is harmless. `false` clears it — how QA walks the flow again.
 */
export async function setOnboardingShown(shown = true) {
  return apiFetch('/users/me', {
    method: 'PATCH',
    body: JSON.stringify({ onboarding_shown: shown }),
  });
}
