// The plant image store: bytes on disk, so a card has a picture with the radio
// off and after the garden document has been thrown away and re-pulled.
//
// Two problems this solves, and they are different problems.
//
//   1. A plant's `heroUri` is a URL on the API's media host. An <Image> with a
//      remote source needs a connection; React Native's own image cache is a
//      memory/disk LRU the OS may drop at will, so "it worked yesterday" is not
//      something the offline app can rely on.
//   2. Signing out deletes the garden document (App.js), so signing back in
//      re-adopts every plant from GET /users/me/plants. Anything that only ever
//      lived in that document is gone.
//
// So each image is downloaded once and kept as a file, and the plant records
// *where* rather than *what*.
//
// Paths are stored RELATIVE to the document directory ('media/ab3f.jpg'), never
// as the absolute `file:///var/mobile/Containers/Data/Application/<UUID>/...`
// the File API hands back. iOS gives the app container a new UUID on every
// install and app update, which would turn every stored absolute path into a
// dangling reference the first time the user takes an update. `fileUri()`
// re-resolves against the *current* container at render time.
//
// Two directories, because the two kinds of image have different lifetimes:
//   • `media/`  — catalog photography from GET /media/{key}. Public (that
//     endpoint takes no bearer token) and identical for every user, so it is
//     content-addressed by URL and survives a sign-out: the next person to sign
//     in gets a cache hit rather than a re-download.
//   • `photos/` — pictures the user took of their own plant. Personal, so
//     `clearPhotos()` takes them with the rest of the garden on sign-out.

import { Directory, File, Paths } from 'expo-file-system';

export const CATALOG_DIR = 'media';
export const PHOTO_DIR = 'photos';

// Resolved once and reused: `Paths.document` is fixed for the life of the
// process, and plantPhoto() runs for every card in a grid on every render.
let root = null;
const documentRoot = () => {
  if (root == null) root = String(Paths.document.uri).replace(/\/+$/, '');
  return root;
};

/** Test seam — the mocked document directory changes between suites. */
export const resetRoot = () => {
  root = null;
};

/**
 * A stored relative path as something an <Image> can load.
 * Absolute URIs and remote URLs pass through untouched, so a caller can hand
 * this whatever a plant happens to be carrying.
 */
export function fileUri(rel) {
  if (!rel) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(rel)) return rel;
  return `${documentRoot()}/${rel.replace(/^\/+/, '')}`;
}

// djb2 over the URL. This only has to spread a few hundred catalog URLs across
// distinct filenames on one device — not resist collisions from an adversary —
// and it keeps the module free of a crypto dependency on a hot path.
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const EXTENSION = /\.(jpe?g|png|webp|gif|heic|avif)(?=$|[?#])/i;

/** `media/<hash>.<ext>` — the same URL always names the same file. */
export function catalogPath(url) {
  const ext = EXTENSION.exec(url)?.[1]?.toLowerCase() ?? 'jpg';
  return `${CATALOG_DIR}/${hash(url)}.${ext === 'jpeg' ? 'jpg' : ext}`;
}

function ensureDir(name) {
  const dir = new Directory(Paths.document, name);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/**
 * Make sure a remote image is on disk, and say where.
 *
 * Idempotent: an image already cached is not fetched again, which is what makes
 * it safe to call this over the whole garden after every sync.
 *
 * @param   {string|null} url  an absolute http(s) URL
 * @returns {Promise<string|null>} the relative path, or null if it could not be
 *          fetched — a missing picture is never worth failing a sync over.
 */
export async function cacheRemote(url) {
  if (!url || !/^https?:/i.test(url)) return null;
  const rel = catalogPath(url);
  try {
    const target = new File(Paths.document, rel);
    // A zero-byte file is a download that died partway; fetch it again rather
    // than caching the failure forever.
    if (target.exists && target.size > 0) return rel;
    if (target.exists) target.delete();
    ensureDir(CATALOG_DIR);
    await File.downloadFileAsync(url, target);
    return target.exists && target.size > 0 ? rel : null;
  } catch (e) {
    console.warn('[media] could not cache', url, e?.message ?? e);
    return null;
  }
}

/**
 * Copy a picture the user just took or picked into the app's own storage.
 *
 * The camera and the image picker both hand back a URI in the OS cache, which
 * the system is free to reclaim — keeping only that URI is how a user's photo
 * silently becomes a grey rectangle a week later.
 *
 * @returns {Promise<string|null>} the relative path under `photos/`
 */
export async function importPhoto(srcUri, name = null) {
  if (!srcUri) return null;
  try {
    const ext = EXTENSION.exec(srcUri)?.[1]?.toLowerCase() ?? 'jpg';
    const rel = `${PHOTO_DIR}/${name ?? `${Date.now().toString(36)}${hash(srcUri)}`}.${ext}`;
    ensureDir(PHOTO_DIR);
    const target = new File(Paths.document, rel);
    if (target.exists) target.delete();
    new File(srcUri).copySync(target);
    return rel;
  } catch (e) {
    console.warn('[media] could not import photo:', e?.message ?? e);
    return null;
  }
}

/**
 * Delete cached files nothing refers to any more — a deleted plant's photo, or
 * a catalog image whose species was re-identified.
 *
 * Driven by the document rather than by the delete path, because a file is not
 * transactional with the reducer: a crash between the two would otherwise leak
 * a file with no owner and no way to name it again.
 *
 * @param {Iterable<string>} keep  every relative path still referenced
 */
export function sweep(keep) {
  const wanted = new Set(keep);
  let removed = 0;
  for (const name of [CATALOG_DIR, PHOTO_DIR]) {
    try {
      const dir = new Directory(Paths.document, name);
      if (!dir.exists) continue;
      for (const entry of dir.list()) {
        const rel = `${name}/${Paths.basename(entry.uri)}`;
        if (wanted.has(rel)) continue;
        entry.delete();
        removed += 1;
      }
    } catch (e) {
      console.warn('[media] sweep failed for', name, e?.message ?? e);
    }
  }
  return removed;
}

const removeDir = (name) => {
  try {
    const dir = new Directory(Paths.document, name);
    if (dir.exists) dir.delete();
  } catch (e) {
    console.warn('[media] could not clear', name, e?.message ?? e);
  }
};

/** Forget the user's own pictures (sign-out). Catalog images are public and stay. */
export const clearPhotos = () => removeDir(PHOTO_DIR);

/** Forget everything, catalog included — for a full reset. */
export const clearAll = () => {
  removeDir(PHOTO_DIR);
  removeDir(CATALOG_DIR);
};

/**
 * Bring the whole garden's pictures onto disk, and report what is still in use.
 *
 * Safe to run after every change to the plant list: a plant whose image is
 * already the right file costs one `exists` check and no network. Three cases
 * it deliberately leaves alone —
 *   • a plant the user has given their own picture — whether the copy landed
 *     under `photos/` or the import failed and only `photoUri` is set. Filling
 *     `imageFile` from the catalog there would quietly replace the user's photo
 *     with the stock one, because the cached file is what `plantPhoto` prefers;
 *   • a plant with no usable `heroUri` keeps whatever it already had, so a
 *     server that stops sending `image_url` cannot blank a working card;
 *   • a download that fails keeps the old file too, so being offline costs
 *     nothing rather than costing the picture.
 *
 * @param   {Array<{id: string, heroUri: ?string, imageFile: ?string}>} plants
 * @returns {Promise<{files: Object<string,string>, keep: Set<string>}>}
 *          `files` is the plant ids whose path changed, for one batched
 *          dispatch; `keep` is every path still referenced, for `sweep`.
 */
export async function reconcile(plants = []) {
  const files = {};
  const keep = new Set();

  for (const plant of plants) {
    const current = plant.imageFile ?? null;

    if (plant.photoUri || current?.startsWith(`${PHOTO_DIR}/`)) {
      if (current) keep.add(current);
      continue;
    }

    const remote = plant.heroUri;
    if (!remote || !/^https?:/i.test(remote)) {
      if (current) keep.add(current);
      continue;
    }

    const wanted = catalogPath(remote);
    if (current === wanted && new File(Paths.document, wanted).exists) {
      keep.add(wanted);
      continue;
    }

    const rel = await cacheRemote(remote);
    if (rel) {
      files[plant.id] = rel;
      keep.add(rel);
    } else if (current) {
      keep.add(current);
    }
  }

  return { files, keep };
}
