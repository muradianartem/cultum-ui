// Native modules the garden touches, stubbed for the JS test environment.
//
// expo-file-system is backed by an in-memory map so store/persist.js round-trips
// for real in tests; expo-notifications is inert, because scheduling is verified
// through notifications/pendingOccurrences (a pure function) rather than by
// asserting on the OS.

jest.mock('expo-file-system', () => {
  const files = new Map();
  class File {
    constructor(dir, name) {
      this.uri = `${dir?.uri ?? dir ?? ''}/${name}`;
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
