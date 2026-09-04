import { apiFetch } from './client';

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

function filePart({ uri, mimeType }) {
  // The picker reports a mimeType, which beats guessing from the URI; fall back
  // to the extension, then to JPEG.
  const fromMime = EXT_BY_MIME[mimeType];
  const ext = (uri.split('?')[0].split('.').pop() || '').toLowerCase();
  const known = fromMime ?? (MIME_BY_EXT[ext] ? ext : null);
  return {
    uri,
    name: `scan.${known ?? 'jpg'}`,
    type: known ? MIME_BY_EXT[known] : 'image/jpeg',
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
  const form = new FormData();
  form.append('image', filePart(file));
  return apiFetch('/scans', {
    method: 'POST',
    body: form,
    timeoutMs: SCAN_TIMEOUT_MS,
    // A dropped upload never reaches the server; one automatic re-send saves
    // the user from re-taking the photo.
    retries: 1,
  });
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
