import {
  COMPLETE,
  FRESH,
  clearOnboarding,
  loadOnboardingSync,
  parseOnboarding,
  saveOnboarding,
} from '../storage';

const fs = require('expo-file-system');
const FILE = 'file:///documents/cultum-onboarding.json';

beforeEach(() => {
  fs.__files.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('no file is no record', () => {
  expect(loadOnboardingSync()).toBeNull();
});

test('a corrupt file is no record, and does not throw', () => {
  fs.__files.set(FILE, '{not json');
  expect(loadOnboardingSync()).toBeNull();
});

test.each([
  ['a future version', { ...FRESH, version: 2 }],
  ['an unknown stage', { ...FRESH, stage: 'somewhere' }],
  ['a step past the last screen', { ...FRESH, step: 4 }],
  ['a negative step', { ...FRESH, step: -1 }],
  ['a fractional step', { ...FRESH, step: 1.5 }],
  ['not an object', 'intro'],
])('%s is not trusted', (_, doc) => {
  expect(parseOnboarding(doc)).toBeNull();
});

test('a valid checkpoint round-trips', () => {
  const record = { ...FRESH, stage: 'add-plant', step: 3, savedPlantId: 'p1' };
  expect(saveOnboarding(record)).toBe(true);
  expect(loadOnboardingSync()).toEqual(record);
});

test('a blank saved plant id reads as none', () => {
  expect(parseOnboarding({ ...FRESH, savedPlantId: '' }).savedPlantId).toBeNull();
});

test('completion persists', () => {
  saveOnboarding(COMPLETE);
  expect(loadOnboardingSync()).toMatchObject({ stage: 'complete' });
});

test('writes land in call order: the later checkpoint wins', () => {
  saveOnboarding({ ...FRESH, step: 1 });
  saveOnboarding({ ...FRESH, step: 2 });
  expect(loadOnboardingSync().step).toBe(2);
});

test('a failed write returns false and leaves the previous record intact', () => {
  saveOnboarding({ ...FRESH, step: 1 });
  const spy = jest.spyOn(fs.File.prototype, 'moveSync').mockImplementation(() => {
    throw new Error('disk full');
  });
  expect(saveOnboarding({ ...FRESH, step: 2 })).toBe(false);
  spy.mockRestore();
  expect(loadOnboardingSync().step).toBe(1);
});

test('clearing forgets the record', () => {
  saveOnboarding(COMPLETE);
  clearOnboarding();
  expect(loadOnboardingSync()).toBeNull();
});
