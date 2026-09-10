// Native modules the garden touches, stubbed for the JS test environment.
//
// expo-file-system is backed by an in-memory map so store/persist.js round-trips
// for real in tests; expo-notifications is inert, because scheduling is verified
// through notifications/pendingOccurrences (a pure function) rather than by
// asserting on the OS.

jest.mock('expo-file-system', () => {
  const files = new Map();
  class File {
    // Mirrors the real signature: any number of URI / File / Directory parts
    // joined into a path, so `new File(uri)` works alongside
    // `new File(Paths.document, name)`.
    constructor(...parts) {
      this.uri = parts.map((p) => p?.uri ?? p ?? '').join('/');
    }
    get exists() {
      return files.has(this.uri);
    }
    create() {
      files.set(this.uri, '');
    }
    write(content) {
      files.set(this.uri, String(content));
    }
    async text() {
      return files.get(this.uri) ?? '';
    }
    async bytes() {
      return new TextEncoder().encode(files.get(this.uri) ?? '');
    }
    textSync() {
      return files.get(this.uri) ?? '';
    }
    delete() {
      files.delete(this.uri);
    }
    moveSync(destination) {
      files.set(destination.uri, files.get(this.uri) ?? '');
      files.delete(this.uri);
    }
  }
  return { File, Paths: { document: { uri: 'file:///documents' } }, __files: files };
});

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
