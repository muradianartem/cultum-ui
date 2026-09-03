export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://ca-cultum-dev-cac.redsand-9719b340.canadacentral.azurecontainerapps.io';

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
  constructor(message, { status = 0, code = 'http' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code; // 'unauthorized' | 'network' | 'http'
  }
}

export async function apiFetch(path, { method = 'GET', headers = {}, body } = {}) {
  const token = await getAuthToken();
  const finalHeaders = { ...headers };
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isForm && body != null && finalHeaders['Content-Type'] == null) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { method, headers: finalHeaders, body });
  } catch (e) {
    throw new ApiError(e.message || 'Network request failed', { code: 'network' });
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
        res = await fetch(`${API_BASE_URL}${path}`, {
          method,
          headers: retryHeaders,
          body,
        });
      } catch (e) {
        throw new ApiError(e.message || 'Network request failed', { code: 'network' });
      }
    }
  }

  if (!res.ok) {
    const code = res.status === 401 || res.status === 403 ? 'unauthorized' : 'http';
    throw new ApiError(`Request failed with ${res.status}`, { status: res.status, code });
  }

  if (res.status === 204) return null;
  return res.json();
}
