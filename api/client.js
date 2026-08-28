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

  if (!res.ok) {
    const code = res.status === 401 || res.status === 403 ? 'unauthorized' : 'http';
    throw new ApiError(`Request failed with ${res.status}`, { status: res.status, code });
  }

  if (res.status === 204) return null;
  return res.json();
}
