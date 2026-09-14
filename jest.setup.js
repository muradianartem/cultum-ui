// Native modules the garden touches, stubbed for the JS test environment.
//
// expo-file-system is backed by an in-memory map so store/persist.js round-trips
// for real in tests; expo-notifications is inert, because scheduling is verified
// through notifications/pendingOccurrences (a pure function) rather than by
// asserting on the OS.

jest.mock('expo-file-system', () => {
  const files = new Map();
  // Remote bodies the fake `File.downloadFileAsync` will serve, keyed by URL.
  // A URL with no entry is a 404, so a test can exercise the offline path.
  const remote = new Map();
  const norm = (uri) => String(uri).replace(/\/+$/, '');
  const childrenOf = (dirUri) => {
    const prefix = `${norm(dirUri)}/`;
    return [...files.keys()].filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'));
  };

  class Directory {
    constructor(...parts) {
      this.uri = norm(parts.map((p) => p?.uri ?? p ?? '').join('/'));
    }
    get exists() {
      return dirs.has(this.uri) || childrenOf(this.uri).length > 0;
    }
    create() {
      dirs.add(this.uri);
    }
    delete() {
      for (const key of childrenOf(this.uri)) files.delete(key);
      dirs.delete(this.uri);
    }
    list() {
      return childrenOf(this.uri).map((uri) => new File(uri));
    }
  }
  const dirs = new Set();

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
    get size() {
      return (files.get(this.uri) ?? '').length;
    }
    create() {
      files.set(this.uri, '');
    }
    copySync(destination) {
      files.set(destination.uri, files.get(this.uri) ?? '');
    }
    static async downloadFileAsync(url, destination) {
      if (!remote.has(url)) throw new Error(`404 ${url}`);
      const target = destination.uri.endsWith('/') ? new File(destination, 'download') : destination;
      files.set(target.uri, remote.get(url));
      return target;
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
  return {
    File,
    Directory,
    Paths: {
      document: { uri: 'file:///documents' },
      basename: (uri) => String(uri).split('/').pop(),
    },
    __files: files,
    __remote: remote,
  };
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
