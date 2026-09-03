import {
  apiFetch,
  ApiError,
  setAuthTokenProvider,
  setUnauthorizedHandler,
  API_BASE_URL,
} from '../client';

const json = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const authHeader = (call) => call[1].headers.Authorization;

beforeEach(() => {
  global.fetch = jest.fn();
  setAuthTokenProvider(null);
  setUnauthorizedHandler(null);
});

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
