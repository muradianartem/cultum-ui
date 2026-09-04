import {
  apiFetch,
  ApiError,
  setAuthTokenProvider,
  setUnauthorizedHandler,
  API_BASE_URL,
} from '../client';
import { isOffline } from '../../lib/net';

jest.mock('../../lib/net', () => ({ isOffline: jest.fn(async () => false) }));

const json = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const authHeader = (call) => call[1].headers.Authorization;

beforeEach(() => {
  global.fetch = jest.fn();
  isOffline.mockReset();
  isOffline.mockResolvedValue(false);
  setAuthTokenProvider(null);
  setUnauthorizedHandler(null);
  // Every failure logs a breadcrumb; keep it out of the test output.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('auth header', () => {
  test('omits Authorization when no provider is registered', async () => {
    fetch.mockResolvedValueOnce(json({ ok: true }));
    await apiFetch('/plants/search?q=mo');
    expect(authHeader(fetch.mock.calls[0])).toBeUndefined();
  });

  test('attaches the registered bearer token', async () => {
    setAuthTokenProvider(() => 'tok-1');
    fetch.mockResolvedValueOnce(json({ ok: true }));

    await apiFetch('/scans', { method: 'POST' });

    expect(fetch.mock.calls[0][0]).toBe(`${API_BASE_URL}/scans`);
    expect(authHeader(fetch.mock.calls[0])).toBe('Bearer tok-1');
  });

  test('reads the provider per request, so a rotated token is picked up', async () => {
    let token = 'old';
    setAuthTokenProvider(() => token);
    fetch.mockResolvedValue(json({}));

    await apiFetch('/scans');
    token = 'new';
    await apiFetch('/scans');

    expect(authHeader(fetch.mock.calls[0])).toBe('Bearer old');
    expect(authHeader(fetch.mock.calls[1])).toBe('Bearer new');
  });

  test('does not set Content-Type on FormData bodies', async () => {
    fetch.mockResolvedValueOnce(json({}));
    const form = new FormData();
    form.append('image', { uri: 'file://a.jpg', name: 'a.jpg', type: 'image/jpeg' });

    await apiFetch('/scans', { method: 'POST', body: form });

    expect(fetch.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
  });
});

describe('401 handling', () => {
  test('rotates the session and replays the request once with the fresh token', async () => {
    let token = 'expired';
    setAuthTokenProvider(() => token);
    setUnauthorizedHandler(async () => {
      token = 'fresh';
    });
    fetch
      .mockResolvedValueOnce(json(null, 401))
      .mockResolvedValueOnce(json({ id: 'scan-1' }, 201));

    const res = await apiFetch('/scans', { method: 'POST' });

    expect(res).toEqual({ id: 'scan-1' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(authHeader(fetch.mock.calls[0])).toBe('Bearer expired');
    expect(authHeader(fetch.mock.calls[1])).toBe('Bearer fresh');
  });

  test('replays the same body, so a multipart upload survives the rotation', async () => {
    setAuthTokenProvider(() => 't');
    setUnauthorizedHandler(async () => {});
    const form = new FormData();
    fetch.mockResolvedValueOnce(json(null, 401)).mockResolvedValueOnce(json({}, 201));

    await apiFetch('/scans', { method: 'POST', body: form });

    expect(fetch.mock.calls[1][1].body).toBe(form);
  });

  test('retries at most once — a second 401 surfaces as unauthorized', async () => {
    setAuthTokenProvider(() => 't');
    setUnauthorizedHandler(async () => {});
    fetch.mockResolvedValue(json(null, 401));

    await expect(apiFetch('/scans')).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('surfaces the original 401 when the refresh itself fails', async () => {
    setAuthTokenProvider(() => 't');
    setUnauthorizedHandler(async () => {
      throw new Error('refresh token reused');
    });
    fetch.mockResolvedValueOnce(json(null, 401));

    await expect(apiFetch('/scans')).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('never retries /auth/* — refreshing the refresh would recurse', async () => {
    setUnauthorizedHandler(jest.fn());
    fetch.mockResolvedValueOnce(json(null, 401));

    await expect(
      apiFetch('/auth/refresh', { method: 'POST', body: '{}' })
    ).rejects.toMatchObject({ code: 'unauthorized' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('passes a 401 through untouched when no handler is registered', async () => {
    fetch.mockResolvedValueOnce(json(null, 401));

    await expect(apiFetch('/scans')).rejects.toMatchObject({ code: 'unauthorized' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('errors', () => {
  test('wraps a transport failure as a network ApiError', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(apiFetch('/scans')).rejects.toMatchObject({ code: 'network' });
  });

  test('maps 403 to unauthorized and other non-2xx to http', async () => {
    fetch.mockResolvedValueOnce(json(null, 403));
    await expect(apiFetch('/scans')).rejects.toMatchObject({ code: 'unauthorized' });

    fetch.mockResolvedValueOnce(json(null, 422));
    await expect(apiFetch('/scans')).rejects.toMatchObject({ code: 'http', status: 422 });
  });

  test('returns null for 204 rather than parsing an empty body', async () => {
    fetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => {
      throw new Error('should not parse');
    } });
    await expect(apiFetch('/auth/logout', { method: 'POST' })).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Failure classification. iOS reports a timeout, a dropped upload, a TLS
// failure and a genuinely absent network with one identical string, and the
// scan screen was turning all of them into "You're offline."
// ---------------------------------------------------------------------------
describe('failure classification', () => {
  // A fetch that never answers, but honours the abort signal — what a hung
  // request looks like from JS.
  const hangs = () =>
    fetch.mockImplementation(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('Aborted')));
        })
    );

  test('a request that outlives its deadline is a timeout, not a lost network', async () => {
    hangs();
    await expect(apiFetch('/scans', { timeoutMs: 10 })).rejects.toMatchObject({
      code: 'timeout',
    });
    expect(isOffline).not.toHaveBeenCalled();
  });

  test('blames the connection only when the OS confirms there is none', async () => {
    isOffline.mockResolvedValue(true);
    fetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(apiFetch('/scans')).rejects.toMatchObject({ code: 'offline' });
  });

  test('a transport failure with a live connection stays "network"', async () => {
    isOffline.mockResolvedValue(false);
    fetch.mockRejectedValueOnce(new TypeError('The network connection was lost.'));
    await expect(apiFetch('/scans')).rejects.toMatchObject({
      code: 'network',
      detail: 'The network connection was lost.',
    });
  });

  test('carries the server response body as detail', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => '{"detail":[{"loc":["body","image"]}]}',
    });
    await expect(apiFetch('/scans')).rejects.toMatchObject({
      code: 'http',
      status: 422,
      detail: '{"detail":[{"loc":["body","image"]}]}',
    });
  });

  test('an unreadable error body does not become a different error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => {
        throw new Error('stream already consumed');
      },
    });
    await expect(apiFetch('/scans')).rejects.toMatchObject({ status: 500, detail: null });
  });
});

describe('retries', () => {
  test('re-sends once after a transport failure — a dropped upload never arrived', async () => {
    fetch
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(json({ id: 'scan-1' }, 201));

    await expect(apiFetch('/scans', { method: 'POST', retries: 1 })).resolves.toEqual({
      id: 'scan-1',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('gives up after the allowance', async () => {
    fetch.mockRejectedValue(new TypeError('Network request failed'));
    await expect(apiFetch('/scans', { retries: 1 })).rejects.toMatchObject({
      code: 'network',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('does not retry a timeout — the endpoint is slow, not flaky', async () => {
    fetch.mockImplementation(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('Aborted')));
        })
    );
    await expect(apiFetch('/scans', { timeoutMs: 10, retries: 1 })).rejects.toMatchObject({
      code: 'timeout',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('does not retry by default', async () => {
    fetch.mockRejectedValue(new TypeError('Network request failed'));
    await expect(apiFetch('/plants/search?q=a')).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

test('asks for JSON explicitly', async () => {
  fetch.mockResolvedValueOnce(json({}));
  await apiFetch('/scans');
  expect(fetch.mock.calls[0][1].headers.Accept).toBe('application/json');
});
