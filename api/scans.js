import { File } from 'expo-file-system';
import { apiFetch, trace } from './client';

// Identification runs a provider call behind the API, and the dev backend
// scales to zero — a cold container alone has been measured at ~30s. Give the
// upload a deadline that reflects that instead of inheriting iOS's ~60s, which
// aborts a working request and reports it as a lost connection.
export const SCAN_TIMEOUT_MS = 120000;

// The API accepts JPEG, PNG or WebP — nothing else, so HEIC is deliberately
// absent here (prepareScanImage re-encodes it before we ever get this far).
// Uploads normally arrive already normalised to JPEG; this map only matters for
// the fallback path where preparation failed and we send the original file.
const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Build the multipart part for a local file.
 *
 * Not React Native's `{ uri, name, type }`: Expo SDK 57's winter runtime
 * replaces global `fetch` with expo/fetch, which assembles the multipart body
 * in JavaScript instead of handing a URI to native networking. It resolves a
 * part by reading `bytes()` off it — a string, a Blob, or anything else
 * implementing that interface — and throws "Unsupported FormDataPart
 * implementation" on a bare `{ uri }`. (`EXPO_PUBLIC_USE_RN_FETCH=1` would put
 * RN's fetch back, but that opts the whole app out of expo/fetch.)
 *
 * The name and type stay explicit rather than deferring to the file's own:
 * prepareScanImage writes its JPEG to a cache path with no extension, which is
 * exactly the case where a mime type derived from the file would come back
 * empty and leave the part with no Content-Type at all.
 */
function filePart({ uri, mimeType }) {
  // The picker reports a mimeType, which beats guessing from the URI; fall back
  // to the extension, then to JPEG.
  const fromMime = EXT_BY_MIME[mimeType];
  const ext = (uri.split('?')[0].split('.').pop() || '').toLowerCase();
  const known = fromMime ?? (MIME_BY_EXT[ext] ? ext : null);
  const file = new File(uri);
  const name = `scan.${known ?? 'jpg'}`;
  const type = known ? MIME_BY_EXT[known] : 'image/jpeg';

  if (!file.exists) {
    // A missing file still encodes — as an empty part the API rejects for
    // reasons that say nothing about the real problem. Name it here instead.
    trace(`upload WARNING file does not exist: ${uri}`);
  }

  return {
    name,
    type,
    // Traced from inside the read because this is the moment expo/fetch pulls
    // the bytes to build the body: a size here is proof the part resolved, and
    // its absence localises a failure to the encoder rather than the network.
    bytes: async () => {
      const data = await file.bytes();
      trace(`upload ${name} ${type} ${(data.length / 1024).toFixed(1)} KB`);
      return data;
    },
  };
}

/**
 * Upload a captured/selected photo for identification.
 *
 * POST /scans — multipart/form-data, field `image`. Bearer-gated: with no token
 * the endpoint 401s (surfaced as ApiError code 'unauthorized').
 *
 * @param {string|{uri: string, mimeType?: string}} image
 *        local file URI, or the prepared file descriptor from prepareScanImage
 * @returns {Promise<object>} ScanResult { id, status, created_at, candidates[], care? }
 */
export async function createScan(image) {
  const file = typeof image === 'string' ? { uri: image } : image;
  trace(`scan source ${file.uri}${file.mimeType ? ` (${file.mimeType})` : ' (unprepared)'}`);

  const form = new FormData();
  form.append('image', filePart(file));
  const scan = await apiFetch('/scans', {
    method: 'POST',
    body: form,
    timeoutMs: SCAN_TIMEOUT_MS,
    // A dropped upload never reaches the server; one automatic re-send saves
    // the user from re-taking the photo.
    retries: 1,
  });

  const top = scan?.candidates?.[0];
  trace(
    `scan ${scan?.id} → ${scan?.candidates?.length ?? 0} candidates` +
      (top ? `, top ${top.species_key} ${Math.round((top.probability ?? 0) * 100)}%` : '') +
      (scan?.care ? ' (care inline)' : '')
  );
  return scan;
}

/**
 * Record which candidate was right — or that none were.
 *
 * POST /scans/{scan_id}/confirm. This is what turns a scan into a labelled
 * training example, so it must reflect an explicit user choice (a tap on a
 * match, or "none of these"), never an auto-picked top result.
 *
 * @param {string}      scanId       ScanResult.id
 * @param {string|null} candidateId  ScanCandidateOut.id, or null for "none of these"
 * @returns {Promise<object>} ScanFeedbackOut
 */
export async function confirmScan(scanId, candidateId) {
  return apiFetch(`/scans/${encodeURIComponent(scanId)}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId ?? null }),
  });
}
