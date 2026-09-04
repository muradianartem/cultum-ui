import { isOffline } from '../lib/net';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://ca-cultum-dev-cac.redsand-9719b340.canadacentral.azurecontainerapps.io';

// iOS gives an unconfigured request NSURLSession's ~60s idle timeout and then
// reports the abort as an indistinguishable "Network request failed". We set
// our own instead, so a slow endpoint is a *timeout* we can name rather than a
// mystery, and so long-running work (identification) can be given real room.
export const DEFAULT_TIMEOUT_MS = 30000;

let authTokenProvider = () => null;
export function setAuthTokenProvider(fn) {
  authTokenProvider = typeof fn === 'function' ? fn : () => null;
}
export async function getAuthToken() {
  return authTokenProvider();
}

// Called when a request comes back 401 so the session can be rotated and the
// request replayed once. AuthProvider registers its refreshSession here; with
// nothing registered a 401 surfaces to the caller as it always did.
let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = typeof fn === 'function' ? fn : null;
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'http', detail = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    // 'unauthorized' | 'offline' | 'network' | 'timeout' | 'http'
    this.code = code;
    // The underlying cause — the platform's transport message, or the server's
    // response body. Never shown as primary copy; it's what makes a TestFlight
    // report diagnosable instead of a guess.
    this.detail = detail;
  }
}

// Read an error response body for the detail field. Bounded and non-throwing:
// diagnostics must never turn a failed request into a different failure.
async function safeText(res) {
  try {
    const text = await res.text();
    return text ? text.slice(0, 500) : null;
  } catch {
    return null;
  }
}

// One fetch with a real deadline. Resolves with the Response; rejects with an
// ApiError already classified as timeout / offline / network.
async function fetchWithTimeout(url, { method, headers, body, timeoutMs }) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const timer = controller
    ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs)
    : null;

  try {
    return await fetch(url, { method, headers, body, signal: controller?.signal });
  } catch (e) {
    if (timedOut) {
      throw new ApiError('The server took too long to respond', {
        code: 'timeout',
        detail: `no response within ${timeoutMs}ms`,
      });
    }
    // Ask the OS before blaming the user's connection: iOS reports a dropped
    // upload, a TLS failure and a genuinely absent network identically.
    const offline = await isOffline();
    throw new ApiError(e?.message || 'Network request failed', {
      code: offline ? 'offline' : 'network',
      detail: e?.message ?? null,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * @param {string} path
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object} [options.headers]
 * @param {*}      [options.body]
 * @param {number} [options.timeoutMs]  deadline for a single attempt
 * @param {number} [options.retries]    extra attempts after a transport failure
 */
export async function apiFetch(
  path,
  {
    method = 'GET',
    headers = {},
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
  } = {}
) {
  const token = await getAuthToken();
  const finalHeaders = { Accept: 'application/json', ...headers };
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isForm && body != null && finalHeaders['Content-Type'] == null) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const url = `${API_BASE_URL}${path}`;
  let res;
  try {
    res = await attempt(url, { method, headers: finalHeaders, body, timeoutMs, retries });
  } catch (e) {
    throw logged(e, method, path);
  }

  // Expired access token → rotate the session once and replay. The auth
  // endpoints are excluded: /auth/refresh answering 401 is the refresh itself
  // failing, and retrying it would recurse.
  if (res.status === 401 && unauthorizedHandler && !path.startsWith('/auth/')) {
    const rotate = unauthorizedHandler;
    let rotated = false;
    try {
      await rotate();
      rotated = true;
    } catch {
      // Refresh failed — fall through and report the original 401. The handler
      // owns clearing the session.
    }
    if (rotated) {
      const retryHeaders = { ...finalHeaders };
      const fresh = await getAuthToken();
      if (fresh) retryHeaders.Authorization = `Bearer ${fresh}`;
      try {
        // The FormData body is a plain object graph here (RN doesn't stream it),
        // so replaying with the same reference is safe.
        res = await attempt(url, {
          method,
          headers: retryHeaders,
          body,
          timeoutMs,
          retries,
        });
      } catch (e) {
        throw logged(e, method, path);
      }
    }
  }

  if (!res.ok) {
    const code = res.status === 401 || res.status === 403 ? 'unauthorized' : 'http';
    throw logged(
      new ApiError(`Request failed with ${res.status}`, {
        status: res.status,
        code,
        detail: await safeText(res),
      }),
      method,
      path
    );
  }

  if (res.status === 204) return null;
  return res.json();
}

// A transport failure means the response never came back — often because the
// request never left the phone (a dropped cellular upload reads exactly like
// this). Re-sending can in principle duplicate a POST the server did receive;
// for a scan that costs a stray row, while not retrying costs the user their
// photo, so the trade is worth it. Timeouts are never retried — the endpoint is
// slow, and a second full wait only makes it worse.
async function attempt(url, { method, headers, body, timeoutMs, retries }) {
  let left = retries;
  for (;;) {
    try {
      return await fetchWithTimeout(url, { method, headers, body, timeoutMs });
    } catch (e) {
      if (left <= 0 || e.code !== 'network') throw e;
      left -= 1;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

// Every failure leaves a breadcrumb. Release builds strip nothing here on
// purpose: without it, "it says I'm offline" is unactionable.
function logged(error, method, path) {
  console.warn(
    `[api] ${method} ${path} failed — code=${error.code} status=${error.status}` +
      (error.detail ? ` detail=${error.detail}` : '')
  );
  return error;
}
