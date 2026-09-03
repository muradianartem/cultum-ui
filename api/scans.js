import { apiFetch } from './client';

// The API accepts JPEG, PNG or WebP. The camera hands back .jpg, but the image
// picker can return .png (and on iOS occasionally .heic), so name the part after
// what we actually have rather than claiming everything is a JPEG.
const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

function filePart(uri) {
  const ext = (uri.split('?')[0].split('.').pop() || '').toLowerCase();
  const type = MIME_BY_EXT[ext] ?? 'image/jpeg';
  const name = `scan.${MIME_BY_EXT[ext] ? ext : 'jpg'}`;
  return { uri, name, type };
}

/**
 * Upload a captured/selected photo for identification.
 *
 * POST /scans — multipart/form-data, field `image`. Bearer-gated: with no token
 * the endpoint 401s (surfaced as ApiError code 'unauthorized').
 *
 * @param {string} imageUri  local file URI from the camera or image picker
 * @returns {Promise<object>} ScanResult { id, status, created_at, candidates[], care? }
 */
export async function createScan(imageUri) {
  const form = new FormData();
  form.append('image', filePart(imageUri));
  return apiFetch('/scans', { method: 'POST', body: form });
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
