import { authApi } from '../auth';

function mockFetchOnce({ ok = true, status = 200, json = {} } = {}) {
  global.fetch = jest.fn(async () => ({
    ok,
    status,
    json: async () => json,
  }));
}

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

describe('authApi.createNonce', () => {
  test('POSTs /auth/nonce and returns the parsed NonceResponse', async () => {
    mockFetchOnce({ json: { nonce: 'srv-nonce', expires_in: 300 } });

    const res = await authApi.createNonce();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/auth\/nonce$/);
    expect(opts.method).toBe('POST');
    expect(res).toEqual({ nonce: 'srv-nonce', expires_in: 300 });
  });
});

describe('authApi.loginGoogle', () => {
  test('POSTs /auth/google with the id_token and returns the TokenResponse', async () => {
    const tokens = {
      access_token: 'a',
      refresh_token: 'r',
      token_type: 'bearer',
      expires_in: 3600,
    };
    mockFetchOnce({ json: tokens });

    const res = await authApi.loginGoogle('gid');

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/auth\/google$/);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ id_token: 'gid' });
    expect(res).toEqual(tokens);
  });

  test('a non-2xx response rejects with an error carrying the status', async () => {
    mockFetchOnce({ ok: false, status: 422, json: {} });

    await expect(authApi.loginGoogle('bad')).rejects.toMatchObject({ status: 422 });
  });
});

describe('authApi.refresh', () => {
  test('POSTs /auth/refresh with the refresh_token and returns the rotated TokenResponse', async () => {
    const rotated = {
      access_token: 'a2',
      refresh_token: 'r2',
      token_type: 'bearer',
      expires_in: 3600,
    };
    mockFetchOnce({ json: rotated });

    const res = await authApi.refresh('r1');

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/auth\/refresh$/);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ refresh_token: 'r1' });
    expect(res).toEqual(rotated);
  });
});

describe('authApi.logout', () => {
  test('POSTs /auth/logout with the refresh_token and returns null on 204', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error('no body');
      },
    }));

    const res = await authApi.logout('rt');

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/auth\/logout$/);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ refresh_token: 'rt' });
    expect(res).toBeNull();
  });
});
