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
  expect(await loadTokens()).toEqual(TOKENS);
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
