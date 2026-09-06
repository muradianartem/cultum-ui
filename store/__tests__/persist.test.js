import { STATE_VERSION, emptyState } from '../model';
import { clearState, createSaver, loadState, migrate, saveState } from '../persist';
import { seedGarden } from '../testing';

jest.useFakeTimers();

describe('the document on disk', () => {
  // jest.setup.js backs expo-file-system with an in-memory map, so this is a
  // real round trip through the same code the app runs.
  beforeEach(() => clearState());

  test('a garden survives being written and read back', async () => {
    const garden = seedGarden({
      now: new Date(2026, 8, 5),
      plants: [
        { nickname: 'Penny', room: 'Kitchen', reminders: [{ action: 'water', intervalDays: 7 }] },
      ],
    });

    expect(await saveState(garden)).toBe(true);
    const loaded = await loadState();

    expect(loaded.plants).toHaveLength(1);
    expect(loaded.plants[0].nickname).toBe('Penny');
    expect(loaded.reminders[0].intervalDays).toBe(7);
    expect(loaded).toEqual(garden);
  });

  test('a second write replaces the first rather than appending', async () => {
    await saveState({ ...emptyState(), profileName: 'first' });
    await saveState({ ...emptyState(), profileName: 'second' });
    expect((await loadState()).profileName).toBe('second');
  });

  test('a first launch — nothing on disk — is an empty garden, not an error', async () => {
    expect(await loadState()).toEqual(emptyState());
  });

  test('clearing takes the document with it', async () => {
    await saveState({ ...emptyState(), profileName: 'gone' });
    await clearState();
    expect((await loadState()).profileName).toBeNull();
  });
});

describe('migrate', () => {
  test('a document from an older build keeps its plants and gains the new fields', () => {
    const old = { version: 0, plants: [{ id: 'p1', nickname: 'Penny' }] };
    const migrated = migrate(old);
    expect(migrated.version).toBe(STATE_VERSION);
    expect(migrated.plants[0]).toEqual({ id: 'p1', nickname: 'Penny', dirty: {} });
    expect(migrated.outbox).toEqual([]);
    expect(migrated.rooms.length).toBeGreaterThan(0);
  });

  test('an existing dirty map is not overwritten by the default', () => {
    const migrated = migrate({ version: 1, plants: [{ id: 'p1', dirty: { nickname: true } }] });
    expect(migrated.plants[0].dirty).toEqual({ nickname: true });
  });

  test('garbage, or nothing at all, is an empty garden rather than a crash', () => {
    expect(migrate(null)).toEqual(emptyState());
    expect(migrate('nonsense')).toEqual(emptyState());
    expect(migrate({ version: 1, plants: 'not an array' }).plants).toEqual([]);
  });

  test('a document from a newer build is not guessed at', () => {
    expect(migrate({ version: STATE_VERSION + 1, plants: [{ id: 'p' }] }).plants).toEqual([]);
  });
});

describe('createSaver', () => {
  test('a burst of mutations costs one write, with the last value', () => {
    const save = jest.fn();
    const saver = createSaver(400, save);
    saver.queue({ n: 1 });
    saver.queue({ n: 2 });
    saver.queue({ n: 3 });
    expect(save).not.toHaveBeenCalled();

    jest.advanceTimersByTime(400);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ n: 3 });
  });

  test('flush writes immediately — the process may not get another chance', () => {
    const save = jest.fn();
    const saver = createSaver(400, save);
    saver.queue({ n: 1 });
    saver.flush();
    expect(save).toHaveBeenCalledWith({ n: 1 });

    // Nothing pending: flushing again must not write a stale duplicate.
    saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
