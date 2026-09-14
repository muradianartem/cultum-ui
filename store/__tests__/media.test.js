// The local image store. The expo-file-system mock in jest.setup.js is a real
// in-memory filesystem, so these exercise the module's actual logic rather than
// asserting on mocked calls; `__remote` is what a download can find.
import { File, Paths, __files, __remote } from 'expo-file-system';
import {
  CATALOG_DIR,
  PHOTO_DIR,
  cacheRemote,
  catalogPath,
  clearPhotos,
  fileUri,
  importPhoto,
  reconcile,
  resetRoot,
  sweep,
} from '../media';

const HERO = 'https://api.example/media/species/monstera/card.jpg';

beforeEach(() => {
  __files.clear();
  __remote.clear();
  resetRoot();
  __remote.set(HERO, 'JPEG-BYTES');
});

describe('fileUri', () => {
  it('resolves a stored relative path against the current document directory', () => {
    expect(fileUri('media/abc.jpg')).toBe('file:///documents/media/abc.jpg');
  });

  // The whole point of storing paths relative: iOS gives the app container a
  // new UUID on every update, so an absolute path saved yesterday is dangling.
  it('follows the document directory when it moves', () => {
    const first = fileUri('media/abc.jpg');
    Paths.document.uri = 'file:///documents-v2';
    resetRoot();
    expect(fileUri('media/abc.jpg')).not.toBe(first);
    expect(fileUri('media/abc.jpg')).toBe('file:///documents-v2/media/abc.jpg');
    Paths.document.uri = 'file:///documents';
    resetRoot();
  });

  it('passes an absolute uri straight through, and null for nothing', () => {
    expect(fileUri('file:///elsewhere/x.jpg')).toBe('file:///elsewhere/x.jpg');
    expect(fileUri(null)).toBeNull();
  });
});

describe('cacheRemote', () => {
  it('downloads once and names the file after the url', async () => {
    const rel = await cacheRemote(HERO);
    expect(rel).toBe(catalogPath(HERO));
    expect(new File(Paths.document, rel).exists).toBe(true);
  });

  it('is idempotent — a second call does not re-download', async () => {
    await cacheRemote(HERO);
    __remote.delete(HERO); // any further download would now throw
    await expect(cacheRemote(HERO)).resolves.toBe(catalogPath(HERO));
  });

  it('answers null rather than throwing when the fetch fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(cacheRemote('https://api.example/media/missing.jpg')).resolves.toBeNull();
    warn.mockRestore();
  });

  it('ignores a path that is not an absolute url', async () => {
    await expect(cacheRemote('/media/species/x.jpg')).resolves.toBeNull();
  });
});

describe('importPhoto', () => {
  it('copies the picked file into the app, so the OS cache can reclaim it', async () => {
    new File('file:///cache/IMG_0001.jpg').create();
    const rel = await importPhoto('file:///cache/IMG_0001.jpg');
    expect(rel.startsWith(`${PHOTO_DIR}/`)).toBe(true);
    expect(new File(Paths.document, rel).exists).toBe(true);
  });
});

describe('reconcile', () => {
  it('caches a plant whose picture is still only a url', async () => {
    const { files, keep } = await reconcile([{ id: 'p1', heroUri: HERO, imageFile: null }]);
    expect(files.p1).toBe(catalogPath(HERO));
    expect(keep.has(catalogPath(HERO))).toBe(true);
  });

  it('does nothing on a second pass', async () => {
    const { files } = await reconcile([{ id: 'p1', heroUri: HERO, imageFile: null }]);
    const again = await reconcile([{ id: 'p1', heroUri: HERO, imageFile: files.p1 }]);
    expect(again.files).toEqual({});
    expect(again.keep.has(files.p1)).toBe(true);
  });

  it('re-downloads when the file has gone but the record has not', async () => {
    const rel = catalogPath(HERO);
    const { files } = await reconcile([{ id: 'p1', heroUri: HERO, imageFile: rel }]);
    expect(files.p1).toBe(rel); // the file never existed, so it was fetched
  });

  it("never re-derives a user's own photo from the catalog url", async () => {
    const mine = `${PHOTO_DIR}/mine.jpg`;
    const { files, keep } = await reconcile([{ id: 'p1', heroUri: HERO, imageFile: mine }]);
    expect(files).toEqual({});
    expect(keep.has(mine)).toBe(true);
  });

  // If importing the user's pick failed, imageFile is empty but photoUri is set.
  // Caching the catalog image then would show the stock picture instead of
  // theirs, because plantPhoto prefers the cached file.
  it('leaves a plant alone when the user picked a photo whose copy failed', async () => {
    const { files } = await reconcile([
      { id: 'p1', heroUri: HERO, imageFile: null, photoUri: 'file:///cache/IMG.jpg' },
    ]);
    expect(files).toEqual({});
  });

  // Being offline must cost nothing, not cost the picture.
  it('keeps the existing file when the download fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const stale = `${CATALOG_DIR}/old.jpg`;
    const { files, keep } = await reconcile([
      { id: 'p1', heroUri: 'https://api.example/media/gone.jpg', imageFile: stale },
    ]);
    expect(files).toEqual({});
    expect(keep.has(stale)).toBe(true);
    warn.mockRestore();
  });

  it('keeps what it has when the server sends no image at all', async () => {
    const rel = `${CATALOG_DIR}/kept.jpg`;
    const { files, keep } = await reconcile([{ id: 'p1', heroUri: null, imageFile: rel }]);
    expect(files).toEqual({});
    expect(keep.has(rel)).toBe(true);
  });
});

describe('sweep', () => {
  it('deletes files nothing points at and leaves the rest', async () => {
    const rel = await cacheRemote(HERO);
    new File(Paths.document, `${CATALOG_DIR}/orphan.jpg`).create();
    expect(sweep(new Set([rel]))).toBe(1);
    expect(new File(Paths.document, rel).exists).toBe(true);
    expect(new File(Paths.document, `${CATALOG_DIR}/orphan.jpg`).exists).toBe(false);
  });
});

describe('clearPhotos', () => {
  it("drops the user's pictures and keeps the public catalog ones", async () => {
    const catalog = await cacheRemote(HERO);
    new File('file:///cache/IMG.jpg').create();
    const mine = await importPhoto('file:///cache/IMG.jpg');

    clearPhotos();

    expect(new File(Paths.document, mine).exists).toBe(false);
    expect(new File(Paths.document, catalog).exists).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('plantPhoto', () => {
  const { plantPhoto } = require('../model');

  it('prefers the cached file — the only source that works offline', () => {
    expect(
      plantPhoto({ imageFile: 'media/abc.jpg', photoUri: 'file:///cache/x.jpg', heroUri: HERO }),
    ).toEqual({ uri: 'file:///documents/media/abc.jpg' });
  });

  it('falls back to the remote url while the download is still in flight', () => {
    expect(plantPhoto({ imageFile: null, heroUri: HERO })).toEqual({ uri: HERO });
  });

  it('is null for a plant with no picture anywhere', () => {
    expect(plantPhoto({ imageFile: null, photoUri: null, heroUri: null })).toBeNull();
  });
});
