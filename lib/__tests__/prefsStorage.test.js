import { File, Paths, __files } from 'expo-file-system';
import {
  DEFAULT_PREFS,
  clearPrefs,
  loadPrefsSync,
  migratePrefs,
  savePrefs,
} from '../prefsStorage';
import { clearState, saveState } from '../../store/persist';
import { emptyState } from '../../store/model';

const PREFS_URI = `${Paths.document.uri}/cultum-prefs.json`;

beforeEach(() => __files.clear());

test('a first launch is the defaults, and nothing is written to get there', () => {
  expect(loadPrefsSync()).toEqual(DEFAULT_PREFS);
  expect(__files.has(PREFS_URI)).toBe(false);
});

test('round-trips through disk', async () => {
  await savePrefs({ ...DEFAULT_PREFS, appearance: 'dark', reminderTime: '07:30' });
  expect(loadPrefsSync()).toMatchObject({
    appearance: 'dark',
    reminderTime: '07:30',
    notificationsEnabled: true,
  });
});

test('an unreadable document is the defaults, not a crash', () => {
  new File(PREFS_URI).write('{ not json');
  expect(loadPrefsSync()).toEqual(DEFAULT_PREFS);
});

test('a value the app no longer understands falls back to its default', () => {
  // Only that field is discarded — a bad preference is not worth losing the
  // rest of the document over.
  expect(migratePrefs({ appearance: 'sepia', reminderTime: '25:99' })).toMatchObject({
    appearance: 'system',
    reminderTime: '09:00',
  });
  expect(migratePrefs({ appearance: 'dark', reminderTime: 'nonsense' })).toMatchObject({
    appearance: 'dark',
    reminderTime: '09:00',
  });
});

test('a document from a newer build starts over rather than being guessed at', () => {
  expect(migratePrefs({ version: 99, appearance: 'dark' })).toEqual(DEFAULT_PREFS);
});

test('signing out does NOT take the preferences with it', async () => {
  // The whole reason these live outside the garden document: which theme the
  // phone is in is a property of the device, not of the session.
  await savePrefs({ ...DEFAULT_PREFS, appearance: 'dark' });
  await saveState(emptyState());

  await clearState();

  expect(loadPrefsSync().appearance).toBe('dark');
});

test('clearPrefs is there for tests, and does clear them', () => {
  new File(PREFS_URI).write(JSON.stringify({ appearance: 'dark' }));
  clearPrefs();
  expect(loadPrefsSync()).toEqual(DEFAULT_PREFS);
});
