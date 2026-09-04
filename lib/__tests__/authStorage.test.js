// Force the web branch of the platform-aware storage.
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

let store;
beforeEach(() => {
  jest.resetModules();
  store = {};
  global.window = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
    },
  };
});

const TOKENS = {
  access_token: 'a',
  refresh_token: 'r',
  token_type: 'bearer',
  expires_in: 3600,
};

test('web: saveTokens then loadTokens round-trips the token object', async () => {
  const { saveTokens, loadTokens } = require('../authStorage');
  await saveTokens(TOKENS);
  expect(await loadTokens()).toMatchObject(TOKENS);
});

// `expires_in` is only meaningful at the moment of issue; the absolute deadline
// is what survives a restart, and what lets us refresh before a request rather
// than after its 401.
describe('withExpiry', () => {
  test('stamps an absolute deadline from expires_in', () => {
    const { withExpiry } = require('../authStorage');
    expect(withExpiry(TOKENS, 1_000_000)).toEqual({
      ...TOKENS,
      expires_at: 1_000_000 + 3600 * 1000,
    });
  });

  test('leaves an existing deadline alone — re-stamping would extend it', () => {
    const { withExpiry } = require('../authStorage');
    const already = { ...TOKENS, expires_at: 42 };
    expect(withExpiry(already, 1_000_000)).toEqual(already);
  });

  test('passes through tokens the backend gave no lifetime for', () => {
    const { withExpiry } = require('../authStorage');
    const noLifetime = { access_token: 'a', refresh_token: 'r' };
    expect(withExpiry(noLifetime)).toEqual(noLifetime);
    expect(withExpiry(null)).toBeNull();
  });
});

test('web: saveTokens persists the stamped deadline', async () => {
  const { saveTokens, loadTokens } = require('../authStorage');
  await saveTokens(TOKENS);
  expect((await loadTokens()).expires_at).toEqual(expect.any(Number));
});

test('web: loadTokens returns null when nothing is stored', async () => {
  const { loadTokens } = require('../authStorage');
  expect(await loadTokens()).toBeNull();
});

test('web: clearTokens empties storage so loadTokens is null', async () => {
  const { saveTokens, clearTokens, loadTokens } = require('../authStorage');
  await saveTokens(TOKENS);
  await clearTokens();
  expect(await loadTokens()).toBeNull();
});
