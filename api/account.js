// Account lifecycle. One endpoint, and it is the irreversible one.

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
