import { paywallEntryRoute, PAYWALL_ON_ENTRY } from '../entry';

const ORIGINS = ['login', 'restore', 'dev', null];

test('never: no origin opens the paywall', () => {
  for (const signedInVia of ORIGINS) {
    expect(paywallEntryRoute({ signedInVia, mode: 'never' })).toBeNull();
  }
});

test('fresh-login: only a completed sign-in opens the paywall', () => {
  expect(paywallEntryRoute({ signedInVia: 'login', mode: 'fresh-login' })).toBe('paywall');
  for (const signedInVia of ['restore', 'dev', null]) {
    expect(paywallEntryRoute({ signedInVia, mode: 'fresh-login' })).toBeNull();
  }
});

test('every-launch: any session opens the paywall, no session does not', () => {
  for (const signedInVia of ['login', 'restore', 'dev']) {
    expect(paywallEntryRoute({ signedInVia, mode: 'every-launch' })).toBe('paywall');
  }
  expect(paywallEntryRoute({ signedInVia: null, mode: 'every-launch' })).toBeNull();
});

test('an unrecognised mode falls back to not showing it', () => {
  expect(paywallEntryRoute({ signedInVia: 'login', mode: 'whenever' })).toBeNull();
});

test('the shipped default is every-launch, and it is what the no-mode call uses', () => {
  expect(PAYWALL_ON_ENTRY).toBe('every-launch');
  expect(paywallEntryRoute({ signedInVia: 'restore' })).toBe('paywall');
  expect(paywallEntryRoute({})).toBeNull();
});
