import { API_BASE_URL } from './client';

/**
 * Fire-and-forget ping at GET /health.
 *
 * The dev backend scales to zero, so the first request after an idle period
 * pays a ~30s cold start — long enough that a scan can hit its deadline. Poking
 * it while the user is still framing their shot means the container is already
 * awake by the time the photo is taken.
 *
 * Deliberately silent and unauthenticated: it is an optimisation, and a failure
 * here means nothing on its own.
 *
 * @returns {Promise<boolean>} whether the ping got a response
 */
export async function warmUp(timeoutMs = 10000) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: controller?.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
